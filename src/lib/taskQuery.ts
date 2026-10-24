import "server-only";
import { z } from "zod";
import { all, col, loadTree, loadUsers, tasksOfPlanets } from "./data";
import { tbilisiDay } from "./game";
import type { PlanetDoc, TaskDoc, UserDoc } from "./types";

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
const DAY = 86_400_000;

export function matchTask(t: TaskDoc, f: TaskFilters, planet: PlanetDoc | undefined, meId: string): boolean {
  if (f.planetId && t.planetId !== f.planetId) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    const num = Number(f.q.replace("#", ""));
    if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q) && t.number !== num) return false;
  }
  if (f.assignee === "none" && t.assigneeIds.length) return false;
  if (f.assignee && f.assignee !== "none" && !t.assigneeIds.includes(f.assignee === "me" ? meId : f.assignee)) return false;
  if (f.status) {
    const kind = planet?.statuses.find((s) => s.id === t.statusId)?.kind;
    if (KINDS.includes(f.status) ? kind !== f.status : t.statusId !== f.status) return false;
  }
  if (f.difficulty && !f.difficulty.split(",").includes(t.difficulty)) return false;
  if (f.priority && !f.priority.split(",").includes(t.priority)) return false;
  if (f.tag && !t.tags.includes(f.tag)) return false;
  if (f.open && t.completedAt) return false;

  const now = new Date();
  // Days are Tbilisi days (UTC+4, no DST) regardless of where the server runs.
  const startOfDay = new Date(`${tbilisiDay(now)}T00:00:00+04:00`).toISOString();
  const endOfDay = new Date(Date.parse(startOfDay) + DAY).toISOString();
  const endOfWeek = new Date(Date.parse(startOfDay) + 7 * DAY).toISOString();
  const due = t.dueDate;
  if (f.due === "overdue" && !(due && due < now.toISOString() && !t.completedAt)) return false;
  if (f.due === "today" && !(due && due >= startOfDay && due < endOfDay)) return false;
  if (f.due === "week" && !(due && due >= startOfDay && due < endOfWeek)) return false;
  if (f.due === "none" && due) return false;
  if (f.createdFrom && t.createdAt < new Date(f.createdFrom).toISOString()) return false;
  if (f.createdTo && t.createdAt > new Date(f.createdTo).toISOString()) return false;
  if (f.dueFrom && !(due && due >= new Date(f.dueFrom).toISOString())) return false;
  if (f.dueTo && !(due && due <= new Date(f.dueTo).toISOString())) return false;
  return true;
}

export type TaskCard = {
  id: string;
  number: number;
  title: string;
  parentId: string | null;
  planetId: string;
  planetName: string;
  planetColor: string;
  statusId: string;
  statusName: string;
  statusColor: string;
  statusKind: "BACKLOG" | "OPEN" | "ACTIVE" | "REVIEW" | "DONE";
  difficulty: TaskDoc["difficulty"];
  priority: TaskDoc["priority"];
  xp: number;
  position: number;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  assignees: { id: string; name: string; avatar: string; share: number }[];
  tags: { name: string; color: string }[];
  subtaskCount: number;
  subtaskDone: number;
  commentCount: number;
  attachmentCount: number;
  timeSpentSec: number;
};

export function toCard(t: TaskDoc, planet: PlanetDoc | undefined, users: Map<string, UserDoc>, subtasks: TaskDoc[]): TaskCard {
  const status = planet?.statuses.find((s) => s.id === t.statusId);
  return {
    id: t.id,
    number: t.number,
    title: t.title,
    parentId: t.parentId,
    planetId: t.planetId,
    planetName: planet?.name ?? "?",
    planetColor: planet?.color ?? "#64748b",
    statusId: t.statusId,
    statusName: status?.name ?? "?",
    statusColor: status?.color ?? "#64748b",
    statusKind: status?.kind ?? "OPEN",
    difficulty: t.difficulty,
    priority: t.priority,
    xp: t.xp,
    position: t.position,
    startDate: t.startDate,
    dueDate: t.dueDate,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
    assignees: t.assigneeIds.map((id) => {
      const u = users.get(id);
      return { id, name: u?.name ?? "?", avatar: u?.avatar ?? "robot", share: t.xpShares[id] ?? 0 };
    }),
    tags: t.tags.map((name) => ({ name, color: planet?.tags[name] ?? "#94a3b8" })),
    subtaskCount: subtasks.length,
    subtaskDone: subtasks.filter((s) => s.completedAt).length,
    commentCount: t.commentCount,
    attachmentCount: t.attachments.length,
    timeSpentSec: t.timeSpentSec,
  };
}

/** Converts tasks to cards; subtasks are looked up in `pool` (or fetched when missing). */
export async function toCards(tasks: TaskDoc[], pool?: TaskDoc[]): Promise<TaskCard[]> {
  const [tree, users] = await Promise.all([loadTree(), loadUsers()]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  let subs = pool;
  if (!subs) {
    const ids = tasks.filter((t) => !t.parentId).map((t) => t.id);
    subs = [];
    for (let i = 0; i < ids.length; i += 30) subs.push(...(await all<TaskDoc>(col.tasks().where("parentId", "in", ids.slice(i, i + 30)))));
    subs = subs.filter((s) => !s.deletedAt);
  }
  return tasks
    .map((t) => toCard(t, tree.planetById.get(t.planetId), userMap, subs!.filter((s) => s.parentId === t.id)))
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

/** Searches top-level tasks across the visible planets. */
export async function searchTasks(filters: TaskFilters, visiblePlanetIds: string[], meId: string, opts: { includeSubtasks?: boolean } = {}) {
  const tree = await loadTree();
  const planets = filters.planetId ? visiblePlanetIds.filter((id) => id === filters.planetId) : visiblePlanetIds;
  let pool: TaskDoc[];
  if (!filters.planetId && filters.assignee && filters.assignee !== "none") {
    // Cheaper path for "my missions": query by assignee instead of loading every planet.
    const uid = filters.assignee === "me" ? meId : filters.assignee;
    const mine = (await all<TaskDoc>(col.tasks().where("assigneeIds", "array-contains", uid))).filter((t) => !t.deletedAt && planets.includes(t.planetId));
    const matched = mine.filter((t) => matchTask(t, filters, tree.planetById.get(t.planetId), meId));
    return toCards(opts.includeSubtasks ? matched : matched.filter((t) => !t.parentId));
  }
  pool = await tasksOfPlanets(planets);
  const matched = pool.filter((t) => (opts.includeSubtasks || !t.parentId) && matchTask(t, filters, tree.planetById.get(t.planetId), meId));
  return toCards(matched, pool);
}
