import "server-only";
import type { PanelTask } from "@/components/tasks/TaskPanel";
import { taskPath, userCan } from "./access";
import { all, col, getTask, loadTree, loadUsers } from "./data";
import type { Locale } from "./i18n";
import type { CurrentUser } from "./session";
import { toCards } from "./taskQuery";
import type { ActivityDoc, CommentDoc, TaskDoc } from "./types";

const ACTION_TEXT: Record<Locale, Record<string, string>> = {
  ka: { created: "შექმნა", updated: "შეცვალა", status: "სტატუსი შეცვალა", assignees: "შემსრულებლები შეცვალა", xp_shares: "XP გადაანაწილა", deleted: "წაშალა", files: "ფაილი დაამატა", time: "დრო დაამატა" },
  en: { created: "created", updated: "updated", status: "changed status", assignees: "changed assignees", xp_shares: "re-split XP", deleted: "deleted", files: "added files", time: "logged time" },
};

/** Everything the task side panel needs, or null when the user can't see the task. */
export async function loadPanelTask(user: CurrentUser, taskId: string, locale: Locale): Promise<PanelTask | null> {
  const task = await getTask(taskId);
  if (!task) return null;
  const path = await taskPath(task);
  if (!(await userCan(user, "VIEW", path))) return null;

  const [tree, users, comments, activity, subtaskDocs, perms] = await Promise.all([
    loadTree(),
    loadUsers(),
    all<CommentDoc>(col.comments(taskId)),
    all<ActivityDoc>(col.activity().where("taskId", "==", taskId)),
    all<TaskDoc>(col.tasks().where("parentId", "==", taskId)),
    Promise.all((["EDIT_TASK", "ASSIGN", "EDIT_XP", "APPROVE_DONE", "COMMENT", "DELETE_TASK", "CHANGE_STATUS"] as const).map((p) => userCan(user, p, path))),
  ]);
  const planet = tree.planetById.get(task.planetId)!;
  const userMap = new Map(users.map((u) => [u.id, u]));
  const name = (id: string | null) => (id ? (userMap.get(id)?.name ?? "?") : "KaniUp");
  const subtasks = subtaskDocs.filter((s) => !s.deletedAt);
  const [card] = await toCards([task], subtasks);
  comments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  activity.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const byId = new Map(comments.map((c) => [c.id, c]));

  return {
    ...card,
    description: task.description,
    xpOverride: task.xpOverride,
    creatorName: name(task.creatorId),
    creatorAvatar: userMap.get(task.creatorId)?.avatar ?? "robot",
    statuses: [...planet.statuses].sort((a, b) => a.position - b.position).map(({ id, name, color, kind }) => ({ id, name, color, kind })),
    customFields: planet.customFields,
    fields: task.fields,
    attachments: task.attachments.map((a) => ({ id: a.id, name: a.name, mime: a.mime, size: a.size, url: `/api/tasks/${task.id}/files/${a.id}` })),
    timerSince: task.timers?.[user.id] ?? null,
    runningTimers: Object.keys(task.timers ?? {}).map((id) => name(id)),
    subtasks: await toCards(subtasks, []),
    comments: comments.map((c) => {
      const parent = c.parentId ? byId.get(c.parentId) : undefined;
      return {
        id: c.id,
        authorId: c.authorId,
        authorName: name(c.authorId),
        authorAvatar: c.authorId ? (userMap.get(c.authorId)?.avatar ?? "robot") : "robot",
        body: c.deletedAt ? "" : c.body,
        system: c.system,
        parentId: c.parentId,
        parentPreview: parent && !parent.deletedAt ? parent.body.slice(0, 80) : null,
        createdAt: c.createdAt,
        edited: !!c.editedAt,
        deleted: !!c.deletedAt,
        reactions: Object.entries(c.reactions ?? {}).map(([emoji, ids]) => ({ emoji, count: ids.length, mine: ids.includes(user.id) })),
      };
    }),
    activity: activity.slice(0, 30).map((a) => {
      const base = ACTION_TEXT[locale][a.action] ?? a.action;
      const detail =
        a.action === "status"
          ? `${base}: ${a.data.from} → ${a.data.to}`
          : a.action === "time"
            ? `${base}: ${Math.round(Number(a.data.seconds) / 60)} min`
            : a.action === "files"
              ? `${base}: ${(a.data.names as string[]).join(", ")}`
              : base;
      return { id: a.id, actor: name(a.actorId), action: a.action, detail, createdAt: a.createdAt };
    }),
    perms: { edit: perms[0], assign: perms[1], editXp: perms[2], approve: perms[3], comment: perms[4], remove: perms[5], status: perms[6] },
  };
}
