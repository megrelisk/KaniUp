import { NextResponse } from "next/server";
import { all, col, loadTree, now } from "@/lib/data";
import { deadlineState } from "@/lib/deadlines";
import { tbilisiDay } from "@/lib/game";
import { adminIds, notify, taskUrl } from "@/lib/notify";
import type { TaskDoc } from "@/lib/types";

/**
 * Morning deadline reminders. Call once a day at 09:00 Tbilisi time
 * (Cloud Scheduler → GET with "Authorization: Bearer $CRON_SECRET").
 * Safe to call more than once: each task is reminded at most once per day.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("unauthorized", { status: 401 });

  const at = new Date();
  const today = tbilisiDay(at);
  const [tasks, admins, tree] = await Promise.all([all<TaskDoc>(col.tasks().where("completedAt", "==", null)), adminIds(), loadTree()]);
  let sent = 0;
  for (const task of tasks) {
    if (task.deletedAt || !tree.planetById.has(task.planetId)) continue;
    const state = deadlineState(task.dueDate, task.completedAt, at);
    if (!state) continue;
    // create() fails when today's reminder for this task already exists.
    const claimed = await col
      .reminders()
      .doc(`${task.id}_${today}`)
      .create({ taskId: task.id, day: today, kind: state.kind, createdAt: now() })
      .then(() => true)
      .catch(() => false);
    if (!claimed) continue;
    const planet = tree.planetById.get(task.planetId)!.name;
    const msg =
      state.kind === "due_today"
        ? { title: `⏰ დღეს ბოლო დღეა: ${task.title}`, body: `დედლაინი დღეს არის (${planet}).` }
        : { title: `🔥 ვადა გადაცილდა: ${task.title}`, body: `დედლაინი გადაცილებულია ${state.days} დღით (${planet}).` };
    await notify(state.kind, [...task.assigneeIds, task.creatorId, ...admins], { ...msg, url: taskUrl(task), taskId: task.id });
    sent++;
  }
  return NextResponse.json({ day: today, reminded: sent });
}
