import "server-only";
import { col, loadRoles, loadUsers, now, one, ping } from "./data";
import { mailLayout, sendMail } from "./mail";
import { sendPush } from "./push";
import { sendSms } from "./sms";
import type { NotificationDoc, NotifyChannel, NotifyEvent, NotifySettings, TaskDoc, UserDoc } from "./types";

export const NOTIFY_EVENTS: NotifyEvent[] = ["assigned", "mention", "comment", "review", "done", "level_up", "due_today", "overdue"];
export const NOTIFY_CHANNELS: NotifyChannel[] = ["inApp", "email", "push", "sms"];

export const DEFAULT_NOTIFY_SETTINGS: NotifySettings = {
  assigned: ["inApp", "email", "push"],
  mention: ["inApp", "email", "push"],
  comment: ["inApp", "push"],
  review: ["inApp", "email", "push"],
  done: ["inApp", "push"],
  level_up: ["inApp"],
  due_today: ["inApp", "email", "push", "sms"],
  overdue: ["inApp", "email", "push", "sms"],
};

export async function loadNotifySettings(): Promise<NotifySettings> {
  const doc = await one<NotifySettings & { id: string }>(col.settings().doc("notifications"));
  return { ...DEFAULT_NOTIFY_SETTINGS, ...(doc ?? {}) };
}

/** Owners and anyone whose main role may manage roles — they get the "admin" copies. */
export async function adminIds(): Promise<string[]> {
  const [users, roles] = await Promise.all([loadUsers(), loadRoles()]);
  const adminRoles = new Set(roles.filter((r) => r.permissions.includes("MANAGE_ROLES")).map((r) => r.id));
  return users.filter((u) => !u.deactivatedAt && (u.isOwner || adminRoles.has(u.roleId))).map((u) => u.id);
}

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
export const taskUrl = (task: Pick<TaskDoc, "id" | "planetId">) => `/p/${task.planetId}?task=${task.id}`;

type Message = { title: string; body: string; url: string; taskId?: string | null };

/**
 * Sends one event to a set of users through the channels the admin enabled for it.
 * `exclude` is usually the person who caused the event — nobody is notified of their own action.
 */
export async function notify(event: NotifyEvent, userIds: Iterable<string>, msg: Message, exclude?: string) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== exclude);
  if (!ids.length) return;
  const [settings, users] = await Promise.all([loadNotifySettings(), loadUsers()]);
  const channels = new Set(settings[event] ?? []);
  const at = now();
  await Promise.all(
    ids.map(async (id) => {
      const user = users.find((u) => u.id === id);
      if (!user || user.deactivatedAt) return;
      try {
        await deliver(user, channels, event, msg, at);
      } catch (err) {
        // One failing channel (e.g. SMTP down) must not break the action that triggered it.
        console.error(`notify ${event} → ${user.email} failed`, err);
      }
    }),
  );
}

async function deliver(user: UserDoc, channels: Set<NotifyChannel>, event: NotifyEvent, msg: Message, at: string) {
  const absolute = appUrl() + msg.url;
  const jobs: Promise<unknown>[] = [];
  if (channels.has("inApp")) {
    jobs.push(
      col
        .notifications(user.id)
        .add({ userId: user.id, event, title: msg.title, body: msg.body, url: msg.url, taskId: msg.taskId ?? null, readAt: null, createdAt: at } satisfies Omit<NotificationDoc, "id">)
        .then(() => ping(`notif-${user.id}`)),
    );
  }
  if (channels.has("email")) {
    jobs.push(sendMail(user.email, `KaniUp — ${msg.title}`, mailLayout(msg.title, escapeHtml(msg.body), { url: absolute, label: "გახსნა / Open" }), `${msg.title}\n${msg.body}\n${absolute}`));
  }
  if (channels.has("push")) jobs.push(sendPush(user.id, user.pushTokens, msg.title, msg.body, absolute));
  if (channels.has("sms")) jobs.push(sendSms(user.phone, `KaniUp: ${msg.title}. ${msg.body}`.slice(0, 300)));
  await Promise.allSettled(jobs);
}

/** Every channel at once, ignoring the admin settings — used by the "send test" button. */
export async function deliverTest(userId: string) {
  const user = (await loadUsers()).find((u) => u.id === userId);
  if (!user) return;
  await deliver(user, new Set(NOTIFY_CHANNELS), "assigned", { title: "სატესტო შეტყობინება 🚀", body: "თუ ამას ხედავ, ეს არხი მუშაობს.", url: "/" }, now());
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** Georgian ergative for "X did …": ნიკა → ნიკამ, ლევან → ლევანმა, Admin → Admin-მა. */
export function ergative(name: string) {
  const last = name.trim().slice(-1);
  if ("აეიოუ".includes(last)) return name + "მ";
  if (/[ა-ჿ]/.test(last)) return name + "მა";
  return `${name}-მა`;
}
