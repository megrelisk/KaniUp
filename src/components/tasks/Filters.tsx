"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DIFFICULTIES, PRIORITIES } from "@/lib/game";
import { DIFFICULTY_LABEL, PRIORITY_LABEL } from "@/lib/i18n";
import { useUi } from "../UiContext";

export function Filters({ statuses, showView = true, defaultView = "board" }: { statuses?: { id: string; name: string }[]; showView?: boolean; defaultView?: string }) {
  const { t, locale, crew } = useUi();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const id = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) set("q", q || null);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const view = params.get("view") ?? defaultView;
  const active = ["assignee", "status", "difficulty", "priority", "due", "createdFrom", "createdTo"].filter((k) => params.get(k)).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {showView && (
          <div className="flex rounded-[10px] border border-[var(--border)] p-0.5">
            {[
              ["board", "🗂️", t.board],
              ["list", "📋", t.list],
            ].map(([key, icon, label]) => (
              <button
                key={key}
                onClick={() => set("view", key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${view === key ? "bg-[var(--accent)] text-white" : "muted"}`}
              >
                {icon} <span className="max-sm:hidden">{label}</span>
              </button>
            ))}
          </div>
        )}
        <input className="input min-w-36 max-w-64 flex-1" placeholder={`🔎 ${t.search}`} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={`btn ${active ? "btn-primary" : "btn-ghost"}`} onClick={() => setOpen((o) => !o)}>
          ⚙️ {t.filters}
          {active > 0 && ` (${active})`}
        </button>
        {active > 0 && (
          <button
            className="muted text-xs underline"
            onClick={() => {
              const next = new URLSearchParams();
              for (const k of ["view", "task", "q"]) if (params.get(k)) next.set(k, params.get(k)!);
              router.replace(`${pathname}?${next}`, { scroll: false });
            }}
          >
            ✕
          </button>
        )}
      </div>
      {open && (
        <div className="panel pop-in grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-6">
          <Select label={t.assignees} value={params.get("assignee")} onChange={(v) => set("assignee", v)}
            options={[["me", "🎯 " + t.home], ["none", t.unassigned], ...crew.map((c) => [c.id, c.name] as [string, string])]} />
          {statuses && <Select label={t.status} value={params.get("status")} onChange={(v) => set("status", v)} options={statuses.map((s) => [s.id, s.name])} />}
          <Select label={t.difficulty} value={params.get("difficulty")} onChange={(v) => set("difficulty", v)} options={DIFFICULTIES.map((d) => [d, DIFFICULTY_LABEL[locale][d]])} />
          <Select label={t.priority} value={params.get("priority")} onChange={(v) => set("priority", v)} options={PRIORITIES.map((p) => [p, PRIORITY_LABEL[locale][p]])} />
          <Select label={t.dueDate} value={params.get("due")} onChange={(v) => set("due", v)}
            options={[["overdue", t.overdue], ["today", t.today], ["week", locale === "ka" ? "ამ კვირაში" : "This week"], ["none", "—"]]} />
          <label className="text-xs">
            <span className="muted">{t.createdAt} ≥</span>
            <input type="date" className="input mt-1" value={params.get("createdFrom") ?? ""} onChange={(e) => set("createdFrom", e.target.value || null)} />
          </label>
        </div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string | null; onChange: (v: string | null) => void; options: [string, string][] }) {
  const { t } = useUi();
  return (
    <label className="text-xs">
      <span className="muted">{label}</span>
      <select className="input mt-1" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{t.all}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
