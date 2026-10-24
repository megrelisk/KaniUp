import { NextResponse } from "next/server";
import { taskPath, userCan } from "@/lib/access";
import { getTask } from "@/lib/data";
import { bucket } from "@/lib/firebase/admin";
import { currentUserOrNull } from "@/lib/session";

/** Streams an attachment to anyone who can view the task. */
export async function GET(_req: Request, { params }: { params: Promise<{ taskId: string; fileId: string }> }) {
  const { taskId, fileId } = await params;
  const user = await currentUserOrNull();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const task = await getTask(taskId);
  const file = task?.attachments.find((a) => a.id === fileId);
  if (!task || !file || !(await userCan(user, "VIEW", await taskPath(task)))) return new NextResponse("not found", { status: 404 });
  const [data] = await bucket().file(file.path).download();
  const inline = file.mime.startsWith("image/") || file.mime === "application/pdf";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
