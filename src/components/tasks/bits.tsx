"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { formatDateTime, formatDay, isSameTbilisiDay } from "@/lib/dates";
import { DIFFICULTY_LABEL, DIFFICULTY_STYLE, PRIORITY_ICON, PRIORITY_LABEL } from "@/lib/i18n";
import { useUi } from "../UiContext";

export function DifficultyChip({ value }: { value: string }) {
  const { locale } = useUi();
  return <span className={`chip ${DIFFICULTY_STYLE[value]}`}>{DIFFICULTY_LABEL[locale][value]}</span>;
}

export function PriorityIcon({ value }: { value: string }) {
  const { locale } = useUi();
  if (value === "NORMAL") return null;
  return (
    <span title={PRIORITY_LABEL[locale][value]} className="text-xs">
      {PRIORITY_ICON[value]}
    </span>
  );
}

export function XpChip({ xp }: { xp: number }) {
  return <span className="chip border-amber-500/40 bg-amber-500/10 text-amber-500">🪙 {xp}</span>;
}

export function DueLabel({ due, done }: { due: string | null; done?: boolean }) {
  const { t, locale } = useUi();
  if (!due) return null;
  const d = new Date(due);
  const now = new Date();
  const overdue = !done && d < now;
  const today = isSameTbilisiDay(d, now);
  const text = today ? t.today : formatDay(d, locale);
  return (
    <span className={`text-xs ${overdue ? "font-bold text-rose-400" : today ? "font-semibold text-amber-500" : "muted"}`} title={formatDateTime(d, locale)}>
      {overdue ? "⏰" : "📅"} {text}
    </span>
  );
}

/** Opens / closes the task side panel via the ?task= search param. */
export function useTaskNav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const go = useCallback(
    (taskId: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (taskId) next.set("task", taskId);
      else next.delete("task");
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, params],
  );
  return { openTask: go, closeTask: () => go(null), current: params.get("task") };
}
