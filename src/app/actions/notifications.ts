"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { col, FieldValue, now, ping } from "@/lib/data";
import { requireUser } from "@/lib/session";

export async function markRead(ids: string[] | "all") {
  const user = await requireUser();
  const ref = col.notifications(user.id);
  const docs = ids === "all" ? (await ref.where("readAt", "==", null).get()).docs.map((d) => d.ref) : z.array(z.string()).parse(ids).map((id) => ref.doc(id));
  const at = now();
  await Promise.all(docs.map((d) => d.update({ readAt: at })));
  revalidatePath("/", "layout");
  await ping(`notif-${user.id}`);
}

/** Stores this browser's FCM token so push notifications reach it. */
export async function savePushToken(token: string) {
  const user = await requireUser();
  await col.users().doc(user.id).update({ pushTokens: FieldValue.arrayUnion(z.string().min(10).max(4096).parse(token)) });
}
