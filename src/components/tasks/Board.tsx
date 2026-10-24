"use client";

import type { StatusKind } from "@/lib/types";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { moveTask } from "@/app/actions/tasks";
import type { TaskCard } from "@/lib/taskQuery";
import { useGame } from "../Game";
import { playBlip, playWhoosh } from "../sound";
import { useUi } from "../UiContext";
import { DifficultyChip, DueLabel, PriorityIcon, useTaskNav, XpChip } from "./bits";
import { AvatarStack } from "../Avatar";
import { QuickAdd } from "./QuickAdd";
import { TaskCardView } from "./TaskCardView";

export type StatusCol = { id: string; name: string; color: string; kind: StatusKind };

/** Kanban board, or (layout="list") the same drag & drop grouped as a list. */
export function Board({ statuses, tasks: initial, planetId, layout = "board" }: { statuses: StatusCol[]; tasks: TaskCard[]; planetId: string; layout?: "board" | "list" }) {
  const { t } = useUi();
  const { celebrate, toast } = useGame();
  const { openTask } = useTaskNav();
  const [tasks, setTasks] = useState(initial);
  const [dragging, setDragging] = useState<TaskCard | null>(null);
  const [fromStatus, setFromStatus] = useState<string | null>(null);
  const [, start] = useTransition();
  useEffect(() => {
    setTasks(initial);
  }, [initial]);

  // Stable id keeps dnd-kit aria attributes identical between server and client renders.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const byStatus = useMemo(() => {
    const m = new Map<string, TaskCard[]>(statuses.map((s) => [s.id, []]));
    for (const task of tasks) m.get(task.statusId)?.push(task);
    for (const list of m.values()) list.sort((a, b) => a.position - b.position);
    return m;
  }, [tasks, statuses]);

  const statusOf = (id: string) => (byStatus.has(id) ? id : tasks.find((x) => x.id === id)?.statusId);

  function onDragStart(e: DragStartEvent) {
    const task = tasks.find((x) => x.id === e.active.id) ?? null;
    setDragging(task);
    setFromStatus(task?.statusId ?? null);
    playBlip();
  }

  // Moving across columns while dragging so the card previews in its new column.
  function onDragOver(e: DragOverEvent) {
    if (!e.over) return;
    const to = statusOf(String(e.over.id));
    const task = tasks.find((x) => x.id === e.active.id);
    if (!to || !task || task.statusId === to) return;
    const col = statuses.find((s) => s.id === to)!;
    setTasks((ts) => ts.map((x) => (x.id === task.id ? { ...x, statusId: to, statusName: col.name, statusColor: col.color, statusKind: col.kind } : x)));
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const task = tasks.find((x) => x.id === e.active.id);
    if (!task || !e.over) return;
    const col = byStatus.get(task.statusId)!.filter((x) => x.id !== task.id);
    let index = col.findIndex((x) => x.id === e.over!.id);
    if (index === -1) index = col.length;
    const before = col[index - 1]?.position;
    const after = col[index]?.position;
    const position = before === undefined ? (after ?? 1000) - 1000 : after === undefined ? before + 1000 : (before + after) / 2;
    setTasks((ts) => ts.map((x) => (x.id === task.id ? { ...x, position } : x)));
    const changed = fromStatus !== task.statusId;
    if (changed) playWhoosh();
    start(async () => {
      try {
        const result = await moveTask(task.id, task.statusId, position);
        celebrate(result);
      } catch (err) {
        setTasks(initial);
        toast(String(err).includes("only_admin_done") ? t.onlyAdminDone : t.noPermission, "error", "⛔");
      }
    });
  }

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      {layout === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-4 max-md:snap-x max-md:snap-mandatory">
          {statuses.map((s) => (
            <Column key={s.id} status={s} tasks={byStatus.get(s.id) ?? []} onOpen={openTask} planetId={planetId} />
          ))}
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {statuses.map((s) => (
            <ListGroup key={s.id} status={s} tasks={byStatus.get(s.id) ?? []} onOpen={openTask} planetId={planetId} />
          ))}
        </div>
      )}
      <DragOverlay>
        {dragging && <div className="scale-105 rotate-1">{layout === "board" ? <TaskCardView task={dragging} onOpen={() => {}} /> : <TaskRow task={dragging} onOpen={() => {}} />}</div>}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ status, tasks, onOpen, planetId }: { status: StatusCol; tasks: TaskCard[]; onOpen: (id: string) => void; planetId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  const xp = tasks.reduce((a, x) => a + x.xp, 0);
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)]/60 p-2 transition max-md:w-[85vw] max-md:snap-center ${
        isOver ? "border-[var(--accent)] bg-[var(--accent-soft)]" : ""
      }`}
    >
      <div className="flex items-center gap-2 px-1.5 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: status.color }} />
        <span className="text-sm font-bold">{status.name}</span>
        <span className="muted text-xs">{tasks.length}</span>
        <span className="flex-1" />
        {xp > 0 && <span className="text-[11px] text-amber-500">🪙 {xp}</span>}
      </div>
      <SortableContext items={tasks.map((x) => x.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-12 flex-col gap-2">
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} onOpen={() => onOpen(task.id)} />
          ))}
        </div>
      </SortableContext>
      {status.kind !== "DONE" && <QuickAdd planetId={planetId} statusId={status.id} compact />}
    </div>
  );
}

function SortableCard({ task, onOpen, row }: { task: TaskCard; onOpen: () => void; row?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? "opacity-30" : ""} {...attributes} {...listeners}>
      {row ? <TaskRow task={task} onOpen={onOpen} /> : <TaskCardView task={task} onOpen={onOpen} />}
    </div>
  );
}

function ListGroup({ status, tasks, onOpen, planetId }: { status: StatusCol; tasks: TaskCard[]; onOpen: (id: string) => void; planetId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  const [open, setOpen] = useState(status.kind !== "DONE");
  return (
    <div ref={setNodeRef} className={`panel p-2 ${isOver ? "border-[var(--accent)] bg-[var(--accent-soft)]" : ""}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-1.5 py-1 text-left">
        <span className="muted w-3 text-xs">{open ? "▾" : "▸"}</span>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: status.color }} />
        <span className="text-sm font-bold">{status.name}</span>
        <span className="muted text-xs">{tasks.length}</span>
      </button>
      {open && (
        <>
          <SortableContext items={tasks.map((x) => x.id)} strategy={verticalListSortingStrategy}>
            <div className="mt-1 flex min-h-6 flex-col">
              {tasks.map((task) => (
                <SortableCard key={task.id} task={task} onOpen={() => onOpen(task.id)} row />
              ))}
            </div>
          </SortableContext>
          {status.kind !== "DONE" && <QuickAdd planetId={planetId} statusId={status.id} compact />}
        </>
      )}
    </div>
  );
}

function TaskRow({ task, onOpen }: { task: TaskCard; onOpen: () => void }) {
  const done = task.statusKind === "DONE";
  return (
    <div onClick={onOpen} className="flex cursor-pointer items-center gap-2 border-b border-[var(--border)]/60 bg-[var(--bg-elev)] px-2 py-2 text-sm last:border-0 hover:bg-[var(--bg-soft)]">
      <span className="muted w-10 shrink-0 text-xs">#{task.number}</span>
      <PriorityIcon value={task.priority} />
      <span className={`min-w-0 flex-1 truncate font-medium ${done ? "muted line-through" : ""}`}>{task.title}</span>
      {task.subtaskCount > 0 && <span className="muted text-xs max-sm:hidden">☑ {task.subtaskDone}/{task.subtaskCount}</span>}
      {task.commentCount > 0 && <span className="muted text-xs max-sm:hidden">💬 {task.commentCount}</span>}
      <span className="max-sm:hidden"><DifficultyChip value={task.difficulty} /></span>
      <span className="w-20 text-right"><DueLabel due={task.dueDate} done={!!task.completedAt} /></span>
      <span className="max-sm:hidden"><XpChip xp={task.xp} /></span>
      <span className="w-16 justify-end flex"><AvatarStack people={task.assignees} size={22} max={3} /></span>
    </div>
  );
}
