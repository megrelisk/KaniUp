"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { markRead } from "@/app/actions/notifications";
import { formatDay, formatTime, isSameTbilisiDay } from "@/lib/dates";
import { useUi } from "./UiContext";

export type BellItem = { id: string; event: string; title: string; body: string; url: string; read: boolean; createdAt: string };

const ICON: Record<string, string> = { assigned: "🎯", mention: "💬", comment: "💭", review: "🔍", done: "✅", level_up: "🚀", due_today: "⏰", overdue: "🔥" };

export function Bell({ items }: { items: BellItem[] }) {
  const { t, locale } = useUi();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const unread = items.filter((i) => !i.read).length;
  return (
    <div className="relative">
      <button className="btn btn-ghost relative px-2.5" title={t.notifications} onClick={() => setOpen((o) => !o)}>
        🔔
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-rose-600 px-1 text-center text-[11px] leading-5 font-bold text-white">{unread > 99 ? "99+" : unread}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="panel pop-in fixed top-16 right-2 left-2 z-50 max-h-[70vh] overflow-hidden sm:absolute sm:top-11 sm:left-auto sm:w-96">
            <div className="flex items-center border-b border-[var(--border)] px-4 py-2.5">
              <span className="flex-1 font-bold">🔔 {t.notifications}</span>
              {unread > 0 && (
                <button className="text-xs text-[var(--accent)]" onClick={() => start(() => markRead("all"))}>
                  {t.markAllRead}
                </button>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {!items.length && <p className="muted p-6 text-center text-sm">{t.noNotifications}</p>}
              {items.map((n) => (
                <Link
                  key={n.id}
                  href={n.url}
                  onClick={() => {
                    setOpen(false);
                    if (!n.read) start(() => markRead([n.id]));
                  }}
                  className={`flex gap-3 border-b border-[var(--border)] px-4 py-3 text-sm last:border-0 hover:bg-[var(--bg-soft)] ${n.read ? "opacity-60" : ""}`}
                >
                  <span className="text-lg">{ICON[n.event] ?? "🔔"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{n.title}</span>
                    <span className="muted line-clamp-2 block text-xs">{n.body}</span>
                    <span className="muted mt-0.5 block text-[11px]">
                      {isSameTbilisiDay(new Date(n.createdAt), new Date()) ? formatTime(n.createdAt) : `${formatDay(n.createdAt, locale)} ${formatTime(n.createdAt)}`}
                    </span>
                  </span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
