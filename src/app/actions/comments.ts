"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertCan, taskPath } from "@/lib/access";
import { requireUser } from "@/lib/session";

export async function addComment(taskId: string, body: string, parentId?: string) {
  const user = await requireUser();
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  await assertCan(user, "COMMENT", await taskPath(task));
  const text = z.string().trim().min(1).max(10_000).parse(body);
  // @mentions are resolved against crew names / email local parts: "@nika".
  const handles = [...text.matchAll(/@([\p{L}\p{N}._-]+)/gu)].map((m) => m[1].toLowerCase());
  const mentioned = handles.length
    ? (await db.user.findMany({ where: { deactivatedAt: null } })).filter((u) =>
        handles.some((h) => u.email.toLowerCase().startsWith(h + "@") || u.name?.toLowerCase().replace(/\s+/g, "") === h),
      )
    : [];
  await db.comment.create({
    data: { taskId, authorId: user.id, body: text, parentId: parentId ?? null, mentions: mentioned.map((u) => u.id) },
  });
  revalidatePath("/", "layout");
}

export async function editComment(commentId: string, body: string) {
  const user = await requireUser();
  const comment = await db.comment.findUniqueOrThrow({ where: { id: commentId } });
  if (comment.authorId !== user.id) throw new Error("forbidden");
  await db.comment.update({
    where: { id: commentId },
    data: { body: z.string().trim().min(1).max(10_000).parse(body), editedAt: new Date() },
  });
  revalidatePath("/", "layout");
}

export async function deleteComment(commentId: string) {
  const user = await requireUser();
  const comment = await db.comment.findUniqueOrThrow({ where: { id: commentId } });
  if (comment.authorId !== user.id && user.role !== "OWNER" && user.role !== "ADMIN") throw new Error("forbidden");
  await db.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function toggleReaction(commentId: string, emoji: string) {
  const user = await requireUser();
  const comment = await db.comment.findUniqueOrThrow({ where: { id: commentId }, include: { task: true } });
  await assertCan(user, "COMMENT", await taskPath(comment.task));
  const key = { commentId_userId_emoji: { commentId, userId: user.id, emoji } };
  const existing = await db.commentReaction.findUnique({ where: key });
  if (existing) await db.commentReaction.delete({ where: key });
  else await db.commentReaction.create({ data: { commentId, userId: user.id, emoji: emoji.slice(0, 8) } });
  revalidatePath("/", "layout");
}
