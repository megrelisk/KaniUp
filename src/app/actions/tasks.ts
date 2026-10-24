"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addSystemComment, all, col, FieldValue, getTaskOrThrow, loadTree, logActivity, nextTaskNumber, now, ping } from "@/lib/data";
import { assertCan, planetPath, taskPath, userCan } from "@/lib/access";
import { requireUser } from "@/lib/session";
import { evenShares, taskXp } from "@/lib/game";
import { payOut, recordHandIn, revokePayout, type Reward } from "@/lib/gamify";
import type { TaskDoc } from "@/lib/types";
import { adminIds, ergative, notify, taskUrl } from "@/lib/notify";

const difficulty = z.enum(["EASY", "NORMAL", "HARD", "EPIC", "LEGENDARY"]);
const priority = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);

function sharesFor(ids: string[]) {
  const shares = evenShares(ids.length);
  return Object.fromEntries(ids.map((id, i) => [id, shares[i]]));
}

async function changed(task: { id: string; planetId: string }) {
  revalidatePath("/", "layout");
  await ping(`planet-${task.planetId}`, `task-${task.id}`, "home");
}

const createSchema = z.object({
  planetId: z.string(),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(50_000).optional(),
  statusId: z.string().optional(),
  parentId: z.string().optional(),
  folderId: z.string().optional(),
  difficulty: difficulty.default("NORMAL"),
  priority: priority.default("NORMAL"),
  dueDate: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export type CreateTaskInput = z.input<typeof createSchema>;

export async function createTask(input: CreateTaskInput) {
  const user = await requireUser();
  const data = createSchema.parse(input);
  await assertCan(user, "CREATE_TASK", await planetPath(data.planetId));
  const planet = (await loadTree()).planetById.get(data.planetId);
  if (!planet) throw new Error("not_found");
  if (data.parentId) {
    // Only one level of subtasks.
    const parent = await getTaskOrThrow(data.parentId);
    if (parent.parentId) throw new Error("subtasks cannot have subtasks");
  }
  const statuses = [...planet.statuses].sort((a, b) => a.position - b.position);
  const statusId =
    data.statusId && statuses.some((s) => s.id === data.statusId)
      ? data.statusId
      : (statuses.find((s) => s.kind === "OPEN") ?? statuses.find((s) => s.kind !== "DONE") ?? statuses[0]).id;
  if (data.assigneeIds.length) await assertCan(user, "ASSIGN", await planetPath(data.planetId));
  const at = now();
  const task: Omit<TaskDoc, "id"> = {
    number: await nextTaskNumber(),
    title: data.title,
    description: data.description ?? "",
    planetId: data.planetId,
    folderId: data.folderId ?? null,
    parentId: data.parentId ?? null,
    statusId,
    difficulty: data.difficulty,
    priority: data.priority,
    xp: taskXp(data.difficulty, data.priority),
    xpOverride: false,
    assigneeIds: data.assigneeIds,
    xpShares: sharesFor(data.assigneeIds),
    tags: [],
    fields: {},
    attachments: [],
    timeSpentSec: 0,
    timers: {},
    startDate: null,
    dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
    position: Date.now(),
    creatorId: user.id,
    completedAt: null,
    reviewedAt: null,
    commentCount: 0,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  };
  const ref = await col.tasks().add(task);
  if (data.tags.length) await setTags(ref.id, data.tags);
  await logActivity(ref.id, user.id, "created", { title: task.title });
  await notify(
    "assigned",
    task.assigneeIds,
    { title: `ახალი მისია: ${task.title}`, body: `${ergative(user.name)} მოგანიჭა თასქი პლანეტაზე „${planet.name}“`, url: taskUrl({ id: ref.id, planetId: task.planetId }), taskId: ref.id },
    user.id,
  );
  await changed({ id: ref.id, planetId: task.planetId });
  return { id: ref.id, number: task.number };
}

const updateSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(50_000).optional(),
  difficulty: difficulty.optional(),
  priority: priority.optional(),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  xp: z.number().int().min(0).max(100_000).nullable().optional(),
  field: z.object({ id: z.string(), value: z.string().max(2000) }).optional(),
});

export type UpdateTaskInput = z.input<typeof updateSchema>;

export async function updateTask(taskId: string, input: UpdateTaskInput) {
  const user = await requireUser();
  const data = updateSchema.parse(input);
  const task = await getTaskOrThrow(taskId);
  const path = await taskPath(task);
  await assertCan(user, "EDIT_TASK", path);

  const next: Record<string, unknown> = { updatedAt: now() };
  if (data.title !== undefined) next.title = data.title;
  if (data.description !== undefined) next.description = data.description;
  if (data.dueDate !== undefined) next.dueDate = data.dueDate ? new Date(data.dueDate).toISOString() : null;
  if (data.startDate !== undefined) next.startDate = data.startDate ? new Date(data.startDate).toISOString() : null;
  if (data.field) next[`fields.${data.field.id}`] = data.field.value;
  const diff = data.difficulty ?? task.difficulty;
  const prio = data.priority ?? task.priority;
  if (data.difficulty) next.difficulty = diff;
  if (data.priority) next.priority = prio;
  if (data.xp !== undefined) {
    await assertCan(user, "EDIT_XP", path);
    // null resets to the automatic value.
    next.xpOverride = data.xp !== null;
    next.xp = data.xp ?? taskXp(diff, prio);
  } else if (!task.xpOverride && (data.difficulty || data.priority)) {
    next.xp = taskXp(diff, prio);
  }
  await col.tasks().doc(taskId).update(next);
  await logActivity(taskId, user.id, "updated", { fields: Object.keys(next).filter((k) => k !== "updatedAt") });
  await changed(task);
}

export type MoveResult = { rewards: Reward[]; streakAchievements: string[] };

/** Kanban drag & drop / status change. In Review → Done needs APPROVE_DONE and pays out XP. */
export async function moveTask(taskId: string, statusId: string, position?: number): Promise<MoveResult> {
  const user = await requireUser();
  const task = await getTaskOrThrow(taskId);
  const planet = (await loadTree()).planetById.get(task.planetId);
  const from = planet?.statuses.find((s) => s.id === task.statusId);
  const target = planet?.statuses.find((s) => s.id === statusId);
  if (!target) throw new Error("status belongs to another planet");
  const path = await taskPath(task);
  await assertCan(user, "CHANGE_STATUS", path);
  const intoDone = target.kind === "DONE" && from?.kind !== "DONE";
  const outOfDone = from?.kind === "DONE" && target.kind !== "DONE";
  if ((intoDone || outOfDone) && !(await userCan(user, "APPROVE_DONE", path))) throw new Error("only_admin_done");

  const at = now();
  const updated: TaskDoc = {
    ...task,
    statusId,
    position: position ?? task.position,
    completedAt: intoDone ? at : outOfDone ? null : task.completedAt,
    reviewedAt: target.kind === "REVIEW" ? at : intoDone ? (task.reviewedAt ?? at) : task.reviewedAt,
    updatedAt: at,
  };
  await col.tasks().doc(taskId).update({
    statusId,
    position: updated.position,
    completedAt: updated.completedAt,
    reviewedAt: updated.reviewedAt,
    updatedAt: at,
  });

  const result: MoveResult = { rewards: [], streakAchievements: [] };
  if (task.statusId !== statusId) {
    await addSystemComment(taskId, `${user.name} → ${target.name}`);
    await logActivity(taskId, user.id, "status", { from: from?.name, to: target.name });
    if (target.kind === "REVIEW" && task.assigneeIds.includes(user.id)) result.streakAchievements = await recordHandIn(user.id);
    if (intoDone) result.rewards = await payOut(updated);
    if (outOfDone) await revokePayout(taskId);

    const url = taskUrl(task);
    if (target.kind === "REVIEW") {
      await notify("review", [task.creatorId, ...(await adminIds())], { title: `შემოწმებაზეა: ${task.title}`, body: `${ergative(user.name)} ჩააბარა თასქი`, url, taskId }, user.id);
    }
    for (const r of result.rewards) {
      await notify("done", [r.userId], { title: `დადასტურდა: ${task.title}`, body: `+${r.xp} XP 🪙`, url, taskId }, user.id);
      if (r.levelUp) await notify("level_up", [r.userId], { title: `ახალი ლეველი: ${r.levelUp}! 🚀`, body: task.title, url: "/profile" });
    }
  }
  await changed(task);
  return result;
}

export async function setAssignees(taskId: string, userIds: string[]) {
  const user = await requireUser();
  const task = await getTaskOrThrow(taskId);
  await assertCan(user, "ASSIGN", await taskPath(task));
  const ids = [...new Set(z.array(z.string()).parse(userIds))];
  await col.tasks().doc(taskId).update({ assigneeIds: ids, xpShares: sharesFor(ids), updatedAt: now() });
  await logActivity(taskId, user.id, "assignees", { userIds: ids });
  const added = ids.filter((id) => !task.assigneeIds.includes(id));
  await notify("assigned", added, { title: `ახალი მისია: ${task.title}`, body: `${ergative(user.name)} მოგანიჭა თასქი`, url: taskUrl(task), taskId }, user.id);
  await changed(task);
}

/** Admin re-splits XP between assignees after review. Shares are percentages summing to 100. */
export async function setXpShares(taskId: string, shares: Record<string, number>) {
  const user = await requireUser();
  const task = await getTaskOrThrow(taskId);
  await assertCan(user, "EDIT_XP", await taskPath(task));
  const values = Object.values(shares);
  if (values.reduce((a, b) => a + b, 0) !== 100 || values.some((s) => s < 0) || Object.keys(shares).some((id) => !task.assigneeIds.includes(id))) {
    throw new Error("shares must sum to 100");
  }
  await col.tasks().doc(taskId).update({ xpShares: shares });
  await logActivity(taskId, user.id, "xp_shares", shares);
  await changed(task);
}

export async function deleteTask(taskId: string) {
  const user = await requireUser();
  const task = await getTaskOrThrow(taskId);
  await assertCan(user, "DELETE_TASK", await taskPath(task));
  const at = now();
  await col.tasks().doc(taskId).update({ deletedAt: at });
  for (const sub of await all<TaskDoc>(col.tasks().where("parentId", "==", taskId))) await col.tasks().doc(sub.id).update({ deletedAt: at });
  await logActivity(taskId, user.id, "deleted", { title: task.title });
  await changed(task);
}

const TAG_COLORS = ["#ec4899", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];

export async function setTags(taskId: string, tagNames: string[]) {
  const user = await requireUser();
  const task = await getTaskOrThrow(taskId);
  await assertCan(user, "EDIT_TASK", await taskPath(task));
  const tags = [...new Set(tagNames.map((t) => t.trim().slice(0, 40)).filter(Boolean))];
  const planet = (await loadTree()).planetById.get(task.planetId);
  const fresh = tags.filter((t) => !planet?.tags[t]);
  // Tag names may contain dots, so write the whole map rather than field paths.
  if (fresh.length) {
    const merged = { ...planet?.tags, ...Object.fromEntries(fresh.map((t) => [t, TAG_COLORS[t.length % TAG_COLORS.length]])) };
    await col.planets().doc(task.planetId).update({ tags: merged });
  }
  await col.tasks().doc(taskId).update({ tags });
  await changed(task);
}

// ─── Time tracking ───────────────────────────────────────────────────────

/** Starts or stops the current user's timer on a task. */
export async function toggleTimer(taskId: string) {
  const user = await requireUser();
  const task = await getTaskOrThrow(taskId);
  await assertCan(user, "VIEW", await taskPath(task));
  const since = task.timers?.[user.id];
  if (since) {
    const seconds = Math.max(0, Math.round((Date.now() - Date.parse(since)) / 1000));
    await col.tasks().doc(taskId).update({ [`timers.${user.id}`]: FieldValue.delete(), timeSpentSec: FieldValue.increment(seconds) });
    await logActivity(taskId, user.id, "time", { seconds });
  } else {
    await col.tasks().doc(taskId).update({ [`timers.${user.id}`]: now() });
  }
  await changed(task);
}

export async function addTime(taskId: string, minutes: number) {
  const user = await requireUser();
  const task = await getTaskOrThrow(taskId);
  await assertCan(user, "EDIT_TASK", await taskPath(task));
  const seconds = Math.round(z.number().min(-10_000).max(10_000).parse(minutes) * 60);
  await col.tasks().doc(taskId).update({ timeSpentSec: Math.max(0, task.timeSpentSec + seconds) });
  await logActivity(taskId, user.id, "time", { seconds });
  await changed(task);
}

export async function removeAttachment(taskId: string, attachmentId: string) {
  const user = await requireUser();
  const task = await getTaskOrThrow(taskId);
  await assertCan(user, "EDIT_TASK", await taskPath(task));
  await col.tasks().doc(taskId).update({ attachments: task.attachments.filter((a) => a.id !== attachmentId) });
  await changed(task);
}
