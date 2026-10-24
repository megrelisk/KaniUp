import type { PanelTask } from "@/components/tasks/TaskPanel";
import { taskPath, userCan } from "./access";
import { db } from "./db";
import type { Locale } from "./i18n";
import type { CurrentUser } from "./session";
import { findTasks, taskCardInclude, toCard } from "./taskQuery";

const ACTION_TEXT: Record<Locale, Record<string, string>> = {
  ka: { created: "შექმნა", updated: "შეცვალა", status: "სტატუსი შეცვალა", assignees: "შემსრულებლები შეცვალა", xp_shares: "XP გადაანაწილა", deleted: "წაშალა" },
  en: { created: "created", updated: "updated", status: "changed status", assignees: "changed assignees", xp_shares: "re-split XP", deleted: "deleted" },
};

/** Everything the task side panel needs, or null when the user can't see the task. */
export async function loadPanelTask(user: CurrentUser, taskId: string, locale: Locale): Promise<PanelTask | null> {
  const task = await db.task.findFirst({
    where: { id: taskId, deletedAt: null },
    include: {
      ...taskCardInclude,
      creator: { select: { name: true, email: true, avatar: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true, avatar: true } }, reactions: true, parent: { select: { body: true } } },
      },
      activity: { orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { name: true, email: true } } } },
    },
  });
  if (!task) return null;
  const path = await taskPath(task);
  if (!(await userCan(user, "VIEW", path))) return null;

  const [statuses, subtasks, perms] = await Promise.all([
    db.status.findMany({ where: { planetId: task.planetId }, orderBy: { position: "asc" } }),
    findTasks({ parentId: task.id, deletedAt: null }),
    Promise.all(
      (["EDIT_TASK", "ASSIGN", "EDIT_XP", "APPROVE_DONE", "COMMENT", "DELETE_TASK", "CHANGE_STATUS"] as const).map((p) => userCan(user, p, path)),
    ),
  ]);
  const display = (u: { name: string | null; email: string } | null) => (u ? (u.name ?? u.email.split("@")[0]) : "KaniUp");

  return {
    ...toCard(task),
    description: task.description,
    xpOverride: task.xpOverride,
    creatorName: display(task.creator),
    creatorAvatar: task.creator.avatar,
    statuses: statuses.map((s) => ({ id: s.id, name: s.name, color: s.color, kind: s.kind })),
    subtasks,
    comments: task.comments.map((c) => {
      const grouped = new Map<string, { count: number; mine: boolean }>();
      for (const r of c.reactions) {
        const g = grouped.get(r.emoji) ?? { count: 0, mine: false };
        grouped.set(r.emoji, { count: g.count + 1, mine: g.mine || r.userId === user.id });
      }
      return {
        id: c.id,
        authorId: c.authorId,
        authorName: display(c.author),
        authorAvatar: c.author?.avatar ?? "robot",
        body: c.deletedAt ? "" : c.body,
        system: c.system,
        parentId: c.parentId,
        parentPreview: c.parent ? c.parent.body.slice(0, 80) : null,
        createdAt: c.createdAt.toISOString(),
        edited: !!c.editedAt,
        deleted: !!c.deletedAt,
        reactions: [...grouped].map(([emoji, g]) => ({ emoji, ...g })),
      };
    }),
    activity: task.activity.map((a) => {
      const data = a.data as Record<string, unknown> | null;
      const base = ACTION_TEXT[locale][a.action] ?? a.action;
      const detail = a.action === "status" && data ? `${base}: ${data.from} → ${data.to}` : base;
      return { id: a.id, actor: display(a.actor), action: a.action, detail, createdAt: a.createdAt.toISOString() };
    }),
    perms: { edit: perms[0], assign: perms[1], editXp: perms[2], approve: perms[3], comment: perms[4], remove: perms[5], status: perms[6] },
  };
}
