"use client";

import type { TaskCard } from "@/lib/taskQuery";
import { AvatarStack } from "../Avatar";
import { DifficultyChip, DueLabel, PriorityIcon, XpChip } from "./bits";

export function TaskCardView({ task, onOpen, showPlanet }: { task: TaskCard; onOpen: () => void; showPlanet?: boolean }) {
  const done = task.statusKind === "DONE";
  return (
    <div
      onClick={onOpen}
      className={`panel group cursor-pointer space-y-2 p-3 transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_0_18px_var(--glow)] ${
        task.difficulty === "LEGENDARY" ? "legendary-glow border-orange-300/50" : ""
      } ${done ? "opacity-70" : ""}`}
    >
      {showPlanet && (
        <div className="muted flex items-center gap-1.5 text-[11px]">
          <span className="h-2 w-2 rounded-full" style={{ background: task.planetColor }} />
          {task.planetName}
        </div>
      )}
      <div className="flex items-start gap-1.5">
        <PriorityIcon value={task.priority} />
        <span className={`flex-1 text-sm leading-snug font-medium ${done ? "line-through" : ""}`}>{task.title}</span>
      </div>
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span key={tag.name} className="chip" style={{ color: tag.color, borderColor: tag.color + "66" }}>
              #{tag.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <DifficultyChip value={task.difficulty} />
        <XpChip xp={task.xp} />
        <DueLabel due={task.dueDate} done={!!task.completedAt} />
        <span className="flex-1" />
        {task.subtaskCount > 0 && (
          <span className="muted text-xs">
            ☑ {task.subtaskDone}/{task.subtaskCount}
          </span>
        )}
        {task.commentCount > 0 && <span className="muted text-xs">💬 {task.commentCount}</span>}
        <AvatarStack people={task.assignees} size={22} />
      </div>
    </div>
  );
}
