import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { tbilisiDay } from "./game";

/** Filters shared by the planet page, "My missions", the REST API and the MCP server. */
export const taskFilterSchema = z.object({
  q: z.string().optional(),
  planetId: z.string().optional(),
  assignee: z.string().optional(), // user id, "me" or "none"
  status: z.string().optional(), // status id or kind (BACKLOG/OPEN/ACTIVE/REVIEW/DONE)
  difficulty: z.string().optional(),
  priority: z.string().optional(),
  tag: z.string().optional(),
  due: z.enum(["overdue", "today", "week", "none"]).optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  dueFrom: z.string().optional(),
  dueTo: z.string().optional(),
  open: z.coerce.boolean().optional(),
});

export type TaskFilters = z.infer<typeof taskFilterSchema>;

const KINDS = ["BACKLOG", "OPEN", "ACTIVE", "REVIEW", "DONE"];

export function buildTaskWhere(f: TaskFilters, visiblePlanetIds: string[], meId: string): Prisma.TaskWhereInput {
  const and: Prisma.TaskWhereInput[] = [{ deletedAt: null }, { planetId: { in: visiblePlanetIds } }];
  if (f.planetId) and.push({ planetId: f.planetId });
  if (f.q) {
    const num = Number(f.q.replace("#", ""));
    and.push({
      OR: [
        { title: { contains: f.q, mode: "insensitive" } },
        { description: { contains: f.q, mode: "insensitive" } },
        ...(Number.isInteger(num) && num > 0 ? [{ number: num }] : []),
      ],
    });
  }
  if (f.assignee === "none") and.push({ assignees: { none: {} } });
  else if (f.assignee) and.push({ assignees: { some: { userId: f.assignee === "me" ? meId : f.assignee } } });
  if (f.status) and.push(KINDS.includes(f.status) ? { status: { kind: f.status as never } } : { statusId: f.status });
  if (f.difficulty) and.push({ difficulty: { in: f.difficulty.split(",") as never } });
  if (f.priority) and.push({ priority: { in: f.priority.split(",") as never } });
  if (f.tag) and.push({ tags: { some: { tag: { name: f.tag } } } });
  if (f.open) and.push({ completedAt: null });

  const now = new Date();
  // Days are Tbilisi days (UTC+4, no DST) regardless of where the server runs.
  const startOfDay = new Date(`${tbilisiDay(now)}T00:00:00+04:00`);
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
  if (f.due === "overdue") and.push({ dueDate: { lt: now }, completedAt: null });
  if (f.due === "today") and.push({ dueDate: { gte: startOfDay, lt: endOfDay } });
  if (f.due === "week") and.push({ dueDate: { gte: startOfDay, lt: new Date(startOfDay.getTime() + 7 * 86_400_000) } });
  if (f.due === "none") and.push({ dueDate: null });
  if (f.createdFrom) and.push({ createdAt: { gte: new Date(f.createdFrom) } });
  if (f.createdTo) and.push({ createdAt: { lte: new Date(f.createdTo) } });
  if (f.dueFrom) and.push({ dueDate: { gte: new Date(f.dueFrom) } });
  if (f.dueTo) and.push({ dueDate: { lte: new Date(f.dueTo) } });
  return { AND: and };
}

export const taskCardInclude = {
  status: true,
  planet: { select: { id: true, name: true, color: true } },
  assignees: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } }, orderBy: { assignedAt: "asc" } },
  tags: { include: { tag: true } },
  subtasks: { where: { deletedAt: null }, select: { id: true, completedAt: true } },
  _count: { select: { comments: { where: { deletedAt: null, system: false } } } },
} satisfies Prisma.TaskInclude;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskCardInclude }>;

export type TaskCard = ReturnType<typeof toCard>;

export function toCard(t: TaskRow) {
  return {
    id: t.id,
    number: t.number,
    title: t.title,
    parentId: t.parentId,
    planetId: t.planetId,
    planetName: t.planet.name,
    planetColor: t.planet.color,
    statusId: t.statusId,
    statusName: t.status.name,
    statusColor: t.status.color,
    statusKind: t.status.kind,
    difficulty: t.difficulty,
    priority: t.priority,
    xp: t.xp,
    position: t.position,
    dueDate: t.dueDate?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    completedAt: t.completedAt?.toISOString() ?? null,
    assignees: t.assignees.map((a) => ({ id: a.user.id, name: a.user.name ?? a.user.email.split("@")[0], avatar: a.user.avatar, share: a.xpShare })),
    tags: t.tags.map((x) => ({ name: x.tag.name, color: x.tag.color })),
    subtaskCount: t.subtasks.length,
    subtaskDone: t.subtasks.filter((s) => s.completedAt).length,
    commentCount: t._count.comments,
  };
}

export async function findTasks(where: Prisma.TaskWhereInput, take = 500) {
  const rows = await db.task.findMany({ where, include: taskCardInclude, orderBy: [{ position: "asc" }, { createdAt: "asc" }], take });
  return rows.map(toCard);
}
