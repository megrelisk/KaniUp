"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Difficulty, Priority } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, planetPath, taskPath, userCan } from "@/lib/access";
import { requireUser } from "@/lib/session";
import { evenShares, taskXp } from "@/lib/game";
import { payOut, recordHandIn, revokePayout, type Reward } from "@/lib/gamify";

const difficulty = z.enum(["EASY", "NORMAL", "HARD", "EPIC", "LEGENDARY"]);
const priority = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);

const createSchema = z.object({
  planetId: z.string(),
  title: z.string().trim().min(1).max(300),
  statusId: z.string().optional(),
  parentId: z.string().optional(),
  folderId: z.string().optional(),
  difficulty: difficulty.default("NORMAL"),
  priority: priority.default("NORMAL"),
  dueDate: z.string().optional(),
  assigneeIds: z.array(z.string()).default([]),
});

export async function createTask(input: z.input<typeof createSchema>) {
  const user = await requireUser();
  const data = createSchema.parse(input);
  await assertCan(user, "CREATE_TASK", await planetPath(data.planetId));
  if (data.parentId) {
    // Only one level of subtasks.
    const parent = await db.task.findUniqueOrThrow({ where: { id: data.parentId } });
    if (parent.parentId) throw new Error("subtasks cannot have subtasks");
  }
  const statusId =
    data.statusId ??
    (await db.status.findFirstOrThrow({ where: { planetId: data.planetId, kind: { in: ["OPEN", "BACKLOG"] } }, orderBy: { position: "asc" } })).id;
  const last = await db.task.findFirst({ where: { statusId, parentId: data.parentId ?? null }, orderBy: { position: "desc" } });
  const shares = evenShares(data.assigneeIds.length);
  const task = await db.task.create({
    data: {
      title: data.title,
      planetId: data.planetId,
      folderId: data.folderId ?? null,
      parentId: data.parentId ?? null,
      statusId,
      difficulty: data.difficulty,
      priority: data.priority,
      xp: taskXp(data.difficulty, data.priority),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      position: (last?.position ?? 0) + 1000,
      creatorId: user.id,
      assignees: { create: data.assigneeIds.map((userId, i) => ({ userId, xpShare: shares[i] })) },
    },
  });
  await log(user.id, task.id, "created", { title: task.title });
  revalidatePath("/", "layout");
  return task.id;
}

const updateSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(50_000).nullable().optional(),
  difficulty: difficulty.optional(),
  priority: priority.optional(),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  xp: z.number().int().min(0).max(100_000).nullable().optional(),
});

export async function updateTask(taskId: string, input: z.input<typeof updateSchema>) {
  const user = await requireUser();
  const data = updateSchema.parse(input);
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  const path = await taskPath(task);
  await assertCan(user, "EDIT_TASK", path);

  const next: Record<string, unknown> = {};
  if (data.title !== undefined) next.title = data.title;
  if (data.description !== undefined) next.description = data.description;
  if (data.dueDate !== undefined) next.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.startDate !== undefined) next.startDate = data.startDate ? new Date(data.startDate) : null;
  const diff = (data.difficulty ?? task.difficulty) as Difficulty;
  const prio = (data.priority ?? task.priority) as Priority;
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
  await db.task.update({ where: { id: taskId }, data: next });
  await log(user.id, taskId, "updated", { fields: Object.keys(next) });
  revalidatePath("/", "layout");
}

export type MoveResult = { rewards: Reward[]; streakAchievements: string[] };

/** Kanban drag & drop / status change. Review → Done needs APPROVE_DONE and pays out XP. */
export async function moveTask(taskId: string, statusId: string, position?: number): Promise<MoveResult> {
  const user = await requireUser();
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId }, include: { status: true, assignees: true } });
  const target = await db.status.findUniqueOrThrow({ where: { id: statusId } });
  if (target.planetId !== task.planetId) throw new Error("status belongs to another planet");
  const path = await taskPath(task);
  await assertCan(user, "CHANGE_STATUS", path);
  const intoDone = target.kind === "DONE" && task.status.kind !== "DONE";
  const outOfDone = task.status.kind === "DONE" && target.kind !== "DONE";
  if ((intoDone || outOfDone) && !(await userCan(user, "APPROVE_DONE", path))) throw new Error("only_admin_done");

  const now = new Date();
  await db.task.update({
    where: { id: taskId },
    data: {
      statusId,
      position: position ?? task.position,
      completedAt: intoDone ? now : outOfDone ? null : task.completedAt,
      reviewedAt: target.kind === "REVIEW" ? now : intoDone ? (task.reviewedAt ?? now) : task.reviewedAt,
    },
  });

  const result: MoveResult = { rewards: [], streakAchievements: [] };
  if (task.statusId !== statusId) {
    await systemComment(taskId, `${user.name ?? user.email} → ${target.name}`);
    await log(user.id, taskId, "status", { from: task.status.name, to: target.name });
    if (target.kind === "REVIEW" && task.assignees.some((a) => a.userId === user.id)) {
      result.streakAchievements = await recordHandIn(user.id);
    }
    if (intoDone) result.rewards = await payOut(taskId);
    if (outOfDone) await revokePayout(taskId);
  }
  revalidatePath("/", "layout");
  return result;
}

export async function setAssignees(taskId: string, userIds: string[]) {
  const user = await requireUser();
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  await assertCan(user, "ASSIGN", await taskPath(task));
  const shares = evenShares(userIds.length);
  await db.$transaction([
    db.taskAssignee.deleteMany({ where: { taskId } }),
    db.taskAssignee.createMany({ data: userIds.map((userId, i) => ({ taskId, userId, xpShare: shares[i] })) }),
  ]);
  await log(user.id, taskId, "assignees", { userIds });
  revalidatePath("/", "layout");
}

/** Admin re-splits XP between assignees after review. Shares are percentages summing to 100. */
export async function setXpShares(taskId: string, shares: Record<string, number>) {
  const user = await requireUser();
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  await assertCan(user, "EDIT_XP", await taskPath(task));
  const total = Object.values(shares).reduce((a, b) => a + b, 0);
  if (total !== 100 || Object.values(shares).some((s) => s < 0)) throw new Error("shares must sum to 100");
  await db.$transaction(
    Object.entries(shares).map(([userId, xpShare]) =>
      db.taskAssignee.update({ where: { taskId_userId: { taskId, userId } }, data: { xpShare } }),
    ),
  );
  await log(user.id, taskId, "xp_shares", shares);
  revalidatePath("/", "layout");
}

export async function deleteTask(taskId: string) {
  const user = await requireUser();
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  await assertCan(user, "DELETE_TASK", await taskPath(task));
  await db.task.update({ where: { id: taskId }, data: { deletedAt: new Date() } });
  await log(user.id, taskId, "deleted", { title: task.title });
  revalidatePath("/", "layout");
}

export async function setTags(taskId: string, tagNames: string[]) {
  const user = await requireUser();
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  await assertCan(user, "EDIT_TASK", await taskPath(task));
  const palette = ["#f472b6", "#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#fb7185", "#22d3ee"];
  const tags = [];
  for (const raw of tagNames) {
    const tagName = raw.trim().slice(0, 40);
    if (!tagName) continue;
    tags.push(
      await db.tag.upsert({
        where: { planetId_name: { planetId: task.planetId, name: tagName } },
        create: { planetId: task.planetId, name: tagName, color: palette[tagName.length % palette.length] },
        update: {},
      }),
    );
  }
  await db.$transaction([
    db.taskTag.deleteMany({ where: { taskId } }),
    db.taskTag.createMany({ data: tags.map((t) => ({ taskId, tagId: t.id })) }),
  ]);
  revalidatePath("/", "layout");
}

async function systemComment(taskId: string, body: string) {
  await db.comment.create({ data: { taskId, body, system: true } });
}

async function log(actorId: string, taskId: string, action: string, data: object) {
  await db.activityLog.create({ data: { actorId, taskId, action, data } });
}

