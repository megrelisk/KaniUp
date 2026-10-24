import { db } from "./db";
import { levelFromXp, nextStreak, splitXp, STREAK_MILESTONES, tbilisiDay } from "./game";

export type Reward = { userId: string; xp: number; levelUp?: number; achievements: string[] };

async function unlock(userId: string, keys: string[]): Promise<string[]> {
  if (!keys.length) return [];
  const existing = await db.userAchievement.findMany({ where: { userId, key: { in: keys } } });
  const fresh = keys.filter((k) => !existing.some((e) => e.key === k));
  if (fresh.length) await db.userAchievement.createMany({ data: fresh.map((key) => ({ userId, key })) });
  return fresh;
}

/** Called when an assignee hands work in (moves a task to Review): advances their streak. */
export async function recordHandIn(userId: string): Promise<string[]> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const today = tbilisiDay(new Date());
  const last = user.lastStreakDay ? user.lastStreakDay.toISOString().slice(0, 10) : null;
  const streak = nextStreak(user.streak, last, today);
  await db.user.update({
    where: { id: userId },
    data: { streak, bestStreak: Math.max(user.bestStreak, streak), lastStreakDay: new Date(today) },
  });
  return unlock(userId, STREAK_MILESTONES.filter(([n]) => streak >= n).map(([, key]) => key));
}

/** Called when a task reaches Done: pays out XP to assignees according to their shares. */
export async function payOut(taskId: string): Promise<Reward[]> {
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId }, include: { assignees: { orderBy: { assignedAt: "asc" } } } });
  if (!task.assignees.length) return [];
  const parts = splitXp(task.xp, task.assignees.map((a) => a.xpShare));
  const rewards: Reward[] = [];
  for (const [i, a] of task.assignees.entries()) {
    const amount = parts[i];
    const before = await db.user.findUniqueOrThrow({ where: { id: a.userId } });
    const after = await db.user.update({ where: { id: a.userId }, data: { xp: { increment: amount } } });
    await db.xpEvent.create({ data: { userId: a.userId, taskId, amount, reason: "task_done" } });

    const doneCount = await db.xpEvent.count({ where: { userId: a.userId, reason: "task_done" } });
    const handedIn = task.reviewedAt ?? new Date();
    const keys: string[] = [];
    if (doneCount >= 1) keys.push("first_mission");
    if (doneCount >= 50) keys.push("tasks_50");
    if (task.difficulty === "LEGENDARY") keys.push("legendary_1");
    if (task.dueDate && handedIn <= task.dueDate) {
      const onTime = await db.task.count({
        where: {
          assignees: { some: { userId: a.userId } },
          completedAt: { not: null },
          reviewedAt: { lte: db.task.fields.dueDate },
          deletedAt: null,
        },
      });
      if (onTime >= 10) keys.push("on_time_10");
    }
    const levelBefore = levelFromXp(before.xp);
    const levelAfter = levelFromXp(after.xp);
    rewards.push({
      userId: a.userId,
      xp: amount,
      levelUp: levelAfter > levelBefore ? levelAfter : undefined,
      achievements: await unlock(a.userId, keys),
    });
  }
  return rewards;
}

/** Reverses a payout when a task leaves Done. */
export async function revokePayout(taskId: string) {
  const events = await db.xpEvent.findMany({ where: { taskId, reason: "task_done" } });
  for (const e of events) {
    await db.user.update({ where: { id: e.userId }, data: { xp: { decrement: e.amount } } });
  }
  await db.xpEvent.deleteMany({ where: { taskId, reason: "task_done" } });
}
