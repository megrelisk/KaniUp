"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { col, FieldValue, getTaskOrThrow, loadUsers, now, one, ping } from "@/lib/data";
import { assertCan, isAdmin, taskPath } from "@/lib/access";
import { requireUser } from "@/lib/session";
import type { CommentDoc } from "@/lib/types";
import { ergative, notify, taskUrl } from "@/lib/notify";

const body = z.string().trim().min(1).max(10_000);

async function changed(taskId: string) {
  revalidatePath("/", "layout");
  await ping(`task-${taskId}`);
}

export async function addComment(taskId: string, text: string, parentId?: string) {
  const user = await requireUser();
  const task = await getTaskOrThrow(taskId);
  await assertCan(user, "COMMENT", await taskPath(task));
  const value = body.parse(text);
  // @mentions resolve against email local parts: "@nika" → nika@kani.ge.
  const handles = [...value.matchAll(/@([\p{L}\p{N}._-]+)/gu)].map((m) => m[1].toLowerCase());
  const mentioned = handles.length ? (await loadUsers()).filter((u) => handles.some((h) => u.email.startsWith(h + "@"))) : [];
  await col.comments(taskId).add({
    taskId,
    authorId: user.id,
    parentId: parentId ?? null,
    body: value,
    system: false,
    mentions: mentioned.map((u) => u.id),
    reactions: {},
    attachments: [],
    editedAt: null,
    deletedAt: null,
    createdAt: now(),
  } satisfies Omit<CommentDoc, "id">);
  await col.tasks().doc(taskId).update({ commentCount: FieldValue.increment(1) });
  const mentionedIds = mentioned.map((u) => u.id);
  const preview = value.length > 140 ? value.slice(0, 140) + "…" : value;
  const url = taskUrl(task);
  await notify("mention", mentionedIds, { title: `${ergative(user.name)} მოგნიშნა: ${task.title}`, body: preview, url, taskId }, user.id);
  await notify(
    "comment",
    [...task.assigneeIds, task.creatorId].filter((id) => !mentionedIds.includes(id)),
    { title: `ახალი კომენტარი: ${task.title}`, body: `${user.name}: ${preview}`, url, taskId },
    user.id,
  );
  await changed(taskId);
}

export async function editComment(taskId: string, commentId: string, text: string) {
  const user = await requireUser();
  const comment = await one<CommentDoc>(col.comments(taskId).doc(commentId));
  if (!comment || comment.authorId !== user.id) throw new Error("forbidden");
  await col.comments(taskId).doc(commentId).update({ body: body.parse(text), editedAt: now() });
  await changed(taskId);
}

export async function deleteComment(taskId: string, commentId: string) {
  const user = await requireUser();
  const comment = await one<CommentDoc>(col.comments(taskId).doc(commentId));
  if (!comment || (comment.authorId !== user.id && !(await isAdmin(user)))) throw new Error("forbidden");
  await col.comments(taskId).doc(commentId).update({ deletedAt: now() });
  if (!comment.deletedAt) await col.tasks().doc(taskId).update({ commentCount: FieldValue.increment(-1) });
  await changed(taskId);
}

export async function toggleReaction(taskId: string, commentId: string, emoji: string) {
  const user = await requireUser();
  const task = await getTaskOrThrow(taskId);
  await assertCan(user, "COMMENT", await taskPath(task));
  const ref = col.comments(taskId).doc(commentId);
  const comment = await one<CommentDoc>(ref);
  if (!comment) throw new Error("not_found");
  const e = emoji.slice(0, 8);
  const users = comment.reactions[e] ?? [];
  const reactions = { ...comment.reactions, [e]: users.includes(user.id) ? users.filter((u) => u !== user.id) : [...users, user.id] };
  if (!reactions[e].length) delete reactions[e];
  await ref.update({ reactions });
  await changed(taskId);
}
