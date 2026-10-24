import { NextResponse } from "next/server";
import { assertCan, taskPath } from "@/lib/access";
import { col, FieldValue, getTask, logActivity, newId, now, ping } from "@/lib/data";
import { bucket } from "@/lib/firebase/admin";
import { currentUserOrNull } from "@/lib/session";
import type { Attachment } from "@/lib/types";

const MAX_BYTES = 25 * 1024 * 1024;

/** Uploads files to a task (multipart field "files"). Stored privately in Firebase Storage. */
export async function POST(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const user = await currentUserOrNull();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const task = await getTask(taskId);
  if (!task) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    await assertCan(user, "EDIT_TASK", await taskPath(task));
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const form = await req.formData();
  const added: Attachment[] = [];
  for (const file of form.getAll("files")) {
    if (!(file instanceof File) || file.size === 0) continue;
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
    const id = newId();
    const path = `tasks/${taskId}/${id}`;
    await bucket().file(path).save(Buffer.from(await file.arrayBuffer()), { contentType: file.type || "application/octet-stream" });
    added.push({ id, name: file.name.slice(0, 200), mime: file.type || "application/octet-stream", size: file.size, path, uploaderId: user.id, createdAt: now() });
  }
  if (added.length) {
    await col.tasks().doc(taskId).update({ attachments: FieldValue.arrayUnion(...added) });
    await logActivity(taskId, user.id, "files", { names: added.map((a) => a.name) });
    await ping(`task-${taskId}`, `planet-${task.planetId}`);
  }
  return NextResponse.json({ added });
}
