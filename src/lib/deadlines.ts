import { tbilisiDay } from "./game";

export type DeadlineState = { kind: "due_today" } | { kind: "overdue"; days: number } | null;

/**
 * What the morning reminder should say about a task: its deadline is today
 * (Tbilisi day), or it has already passed. Done tasks never get reminders.
 */
export function deadlineState(dueDate: string | null, completedAt: string | null, now: Date): DeadlineState {
  if (!dueDate || completedAt) return null;
  const due = new Date(dueDate);
  const today = tbilisiDay(now);
  const dueDay = tbilisiDay(due);
  if (dueDay === today && due > now) return { kind: "due_today" };
  if (due <= now) {
    const days = Math.max(1, Math.round((Date.parse(today) - Date.parse(dueDay)) / 86_400_000));
    return { kind: "overdue", days };
  }
  return null;
}
