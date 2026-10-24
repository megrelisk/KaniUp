"use client";

import { useState, useTransition } from "react";
import { createTask } from "@/app/actions/tasks";
import { useGame } from "../Game";
import { playBlip } from "../sound";
import { useUi } from "../UiContext";

export function QuickAdd({ planetId, statusId, parentId, compact }: { planetId: string; statusId?: string; parentId?: string; compact?: boolean }) {
  const { t } = useUi();
  const { toast } = useGame();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const value = title.trim();
    if (!value) return setOpen(false);
    start(async () => {
      try {
        await createTask({ planetId, statusId, parentId, title: value });
        playBlip();
        setTitle("");
      } catch {
        toast(t.noPermission, "error", "⛔");
      }
    });
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className={`muted mt-1 w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--bg-elev)] hover:text-[var(--accent)] ${compact ? "" : "border border-dashed border-[var(--border)]"}`}>
        ＋ {parentId ? t.newSubtask : t.newTask}
      </button>
    );
  return (
    <input
      autoFocus
      disabled={pending}
      className="input mt-1"
      placeholder={parentId ? t.newSubtask : t.newTask}
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={() => !title.trim() && setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") setOpen(false);
      }}
    />
  );
}
