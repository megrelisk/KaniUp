"use client";

import { useTransition } from "react";
import { sendTestNotification, setNotifyChannel } from "@/app/actions/admin";
import type { NotifyChannel, NotifyEvent, NotifySettings } from "@/lib/types";
import { useGame } from "../Game";
import { useUi } from "../UiContext";

const EVENT_LABEL: Record<NotifyEvent, [string, string]> = {
  assigned: ["🎯 თასქის მინიჭება", "🎯 Task assigned"],
  mention: ["💬 მონიშვნა (@)", "💬 Mention (@)"],
  comment: ["💭 ახალი კომენტარი", "💭 New comment"],
  review: ["🔍 ჩაბარდა შესამოწმებლად (შემქმნელს + ადმინს)", "🔍 Handed in for review (creator + admins)"],
  done: ["✅ დადასტურდა + XP", "✅ Approved + XP"],
  level_up: ["🚀 ახალი ლეველი", "🚀 Level up"],
  due_today: ["⏰ დღეს ბოლო დღეა (დილით)", "⏰ Due today (morning)"],
  overdue: ["🔥 ვადა გადაცილდა (ყოველ დილით)", "🔥 Overdue (every morning)"],
};
const CHANNEL_LABEL: Record<NotifyChannel, string> = { inApp: "🔔 App", email: "✉️ Email", push: "📲 Push", sms: "📱 SMS" };

export function NotifyMatrix({ settings, events, channels, status }: { settings: NotifySettings; events: NotifyEvent[]; channels: NotifyChannel[]; status: Record<NotifyChannel, boolean> }) {
  const { locale } = useUi();
  const { toast } = useGame();
  const [pending, start] = useTransition();
  const ka = locale === "ka";
  return (
    <div className="space-y-4">
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-3 text-left"></th>
              {channels.map((c) => (
                <th key={c} className="p-3 text-center text-xs">
                  {CHANNEL_LABEL[c]}
                  {!status[c] && <div className="font-normal text-amber-500">{ka ? "არ არის დაკავშირებული" : "not connected"}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e} className="border-t border-[var(--border)]">
                <td className="p-3">{EVENT_LABEL[e][ka ? 0 : 1]}</td>
                {channels.map((c) => {
                  const on = settings[e].includes(c);
                  return (
                    <td key={c} className="p-2 text-center">
                      <button
                        disabled={pending}
                        onClick={() => start(() => setNotifyChannel(e, c, !on))}
                        className={`h-9 w-9 rounded-lg transition hover:scale-105 ${on ? "bg-emerald-500/15 text-emerald-500" : "bg-[var(--bg-soft)] text-[var(--muted)]"}`}
                      >
                        {on ? "✓" : "—"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="btn btn-ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await sendTestNotification();
            toast(ka ? "სატესტო შეტყობინება გაიგზავნა" : "Test notification sent", "info", "📨");
          })
        }
      >
        📨 {ka ? "სატესტო შეტყობინება ჩემთან" : "Send me a test notification"}
      </button>
    </div>
  );
}
