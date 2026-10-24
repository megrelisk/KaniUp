import "server-only";
import { all, col, FieldValue, now, one } from "./data";
import { levelFromXp, nextStreak, splitXp, STREAK_MILESTONES, tbilisiDay, VISIT_MILESTONES } from "./game";
import type { TaskDoc, UserDoc, XpEventDoc } from "./types";

export type Reward = { userId: string; xp: number; levelUp?: number; achievements: string[] };

async function unlock(user: UserDoc, keys: string[]): Promise<string[]> {
  const fresh = [...new Set(keys)].filter((k) => !user.achievements?.[k]);
  if (fresh.length) {
    const at = now();
    await col.users().doc(user.id).update(Object.fromEntries(fresh.map((k) => [`achievements.${k}`, at])));
  }
  return fresh;
}

/** Called when an assignee hands work in (moves a task to In Review): advances their streak. */
export async function recordHandIn(userId: string): Promise<string[]> {
  const user = await one<UserDoc>(col.users().doc(userId));
  if (!user) return [];
  const today = tbilisiDay(new Date());
  const streak = nextStreak(user.streak, user.lastStreakDay, today);
  await col.users().doc(userId).update({ streak, bestStreak: Math.max(user.bestStreak, streak), lastStreakDay: today });
  return unlock(user, STREAK_MILESTONES.filter(([n]) => streak >= n).map(([, key]) => key));
}

/** Called on every visit; advances the "came in today" streak once per Tbilisi day. */
export async function recordVisit(user: UserDoc): Promise<string[]> {
  const today = tbilisiDay(new Date());
  if (user.lastVisitDay === today) return [];
  const streak = nextStreak(user.visitStreak ?? 0, user.lastVisitDay ?? null, today);
  await col.users().doc(user.id).update({ visitStreak: streak, bestVisitStreak: Math.max(user.bestVisitStreak ?? 0, streak), lastVisitDay: today });
  return unlock(user, VISIT_MILESTONES.filter(([n]) => streak >= n).map(([, key]) => key));
}

/** Called when a task reaches Done: pays out XP to assignees according to their shares. */
export async function payOut(task: TaskDoc): Promise<Reward[]> {
  if (!task.assigneeIds.length) return [];
  const parts = splitXp(task.xp, task.assigneeIds.map((id) => task.xpShares[id] ?? 0));
  const handedIn = task.reviewedAt ?? now();
  const rewards: Reward[] = [];
  for (const [i, userId] of task.assigneeIds.entries()) {
    const user = await one<UserDoc>(col.users().doc(userId));
    if (!user) continue;
    const amount = parts[i];
    await col.users().doc(userId).update({ xp: FieldValue.increment(amount) });
    await col.xpEvents().add({ userId, taskId: task.id, amount, difficulty: task.difficulty, reason: "task_done", createdAt: now() } satisfies Omit<XpEventDoc, "id">);

    const done = await all<XpEventDoc>(col.xpEvents().where("userId", "==", userId));
    const doneCount = done.filter((e) => e.reason === "task_done").length;
    const keys = ["first_mission"];
    if (doneCount >= 50) keys.push("tasks_50");
    if (task.difficulty === "LEGENDARY") keys.push("legendary_1");
    if (task.dueDate && handedIn <= task.dueDate) {
      // Count tasks handed in by their deadline; stored on the user to avoid scanning tasks.
      await col.users().doc(userId).update({ onTimeCount: FieldValue.increment(1) });
      const count = ((await col.users().doc(userId).get()).data()?.onTimeCount ?? 1) as number;
      if (count >= 10) keys.push("on_time_10");
    }
    const levelBefore = levelFromXp(user.xp);
    const levelAfter = levelFromXp(user.xp + amount);
    rewards.push({ userId, xp: amount, levelUp: levelAfter > levelBefore ? levelAfter : undefined, achievements: await unlock(user, keys) });
  }
  return rewards;
}

/** Reverses a payout when a task leaves Done. */
export async function revokePayout(taskId: string) {
  const events = await all<XpEventDoc>(col.xpEvents().where("taskId", "==", taskId));
  for (const e of events.filter((x) => x.reason === "task_done")) {
    await col.users().doc(e.userId).update({ xp: FieldValue.increment(-e.amount) });
    await col.xpEvents().doc(e.id).delete();
  }
}
