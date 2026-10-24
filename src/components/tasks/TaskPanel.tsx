"use client";

import type { CustomField, StatusKind } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { addComment, deleteComment, editComment, toggleReaction } from "@/app/actions/comments";
import { addTime, deleteTask, moveTask, removeAttachment, setAssignees, setTags, setXpShares, toggleTimer, updateTask } from "@/app/actions/tasks";
import { formatDateTime, formatDay, formatTime, isSameTbilisiDay } from "@/lib/dates";
import { DIFFICULTIES, PRIORITIES, taskXp } from "@/lib/game";
import { PRIORITY_ICON, PRIORITY_LABEL } from "@/lib/i18n";
import type { TaskCard } from "@/lib/taskQuery";
import { Avatar } from "../Avatar";
import { Live } from "../Live";
import { useGame } from "../Game";
import { playBlip, playWhoosh } from "../sound";
import { useUi } from "../UiContext";
import { DifficultyChip, DueLabel, useTaskNav, XpChip } from "./bits";
import { QuickAdd } from "./QuickAdd";

export type PanelComment = {
  id: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string;
  body: string;
  system: boolean;
  parentId: string | null;
  parentPreview: string | null;
  createdAt: string;
  edited: boolean;
  deleted: boolean;
  reactions: { emoji: string; count: number; mine: boolean }[];
};

export type PanelAttachment = { id: string; name: string; mime: string; size: number; url: string };

export type PanelTask = TaskCard & {
  description: string;
  customFields: CustomField[];
  fields: Record<string, string>;
  attachments: PanelAttachment[];
  timerSince: string | null;
  runningTimers: string[];
  xpOverride: boolean;
  creatorName: string;
  creatorAvatar: string;
  statuses: { id: string; name: string; color: string; kind: StatusKind }[];
  subtasks: TaskCard[];
  comments: PanelComment[];
  activity: { id: string; actor: string; action: string; detail: string; createdAt: string }[];
  perms: { edit: boolean; assign: boolean; editXp: boolean; approve: boolean; comment: boolean; remove: boolean; status: boolean };
};

const REACTIONS = ["👍", "❤️", "😂", "🎉", "🚀", "👀"];

export function TaskPanel({ task }: { task: PanelTask }) {
  const { t, locale, me } = useUi();
  const { closeTask, openTask } = useTaskNav();
  const { celebrate, toast } = useGame();
  const [tab, setTab] = useState<"details" | "chat">("details");
  const [, start] = useTransition();


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeTask();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeTask]);

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      try {
        await fn();
      } catch (err) {
        toast(String(err).includes("only_admin_done") ? t.onlyAdminDone : t.noPermission, "error", "⛔");
      }
    });

  const changeStatus = (statusId: string) =>
    run(async () => {
      playWhoosh();
      celebrate(await moveTask(task.id, statusId));
    });

  const isAssignee = task.assignees.some((a) => a.id === me.id);
  const review = task.statuses.find((s) => s.kind === "REVIEW");
  const done = task.statuses.find((s) => s.kind === "DONE");

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={closeTask}>
      <Live keys={[`task-${task.id}`]} />
      <div className="slide-in flex h-full w-full max-w-6xl flex-col border-l border-[var(--border)] bg-[var(--bg)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: task.planetColor }} />
          <span className="muted text-sm">{task.planetName}</span>
          <span className="muted text-sm">· #{task.number}</span>
          {task.parentId && (
            <button className="text-sm text-[var(--accent)] underline" onClick={() => openTask(task.parentId!)}>
              ↑ parent
            </button>
          )}
          <span className="flex-1" />
          {task.perms.remove && (
            <button
              className="btn btn-ghost px-2.5 text-rose-400"
              title={t.delete}
              onClick={() => confirm(`${t.delete}?`) && run(async () => (await deleteTask(task.id), closeTask()))}
            >
              🗑️
            </button>
          )}
          <button className="btn btn-ghost px-3" onClick={closeTask}>
            ✕
          </button>
        </div>

        {/* Mobile tabs */}
        <div className="flex border-b border-[var(--border)] lg:hidden">
          {(["details", "chat"] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2.5 text-sm font-semibold ${tab === k ? "border-b-2 border-[var(--accent)] text-[var(--accent)]" : "muted"}`}>
              {k === "details" ? `📝 ${t.description}` : `💬 ${t.comments} (${task.comments.filter((c) => !c.system).length})`}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Details */}
          <div className={`min-w-0 flex-1 space-y-5 overflow-y-auto p-5 ${tab === "chat" ? "max-lg:hidden" : ""}`}>
            <EditableTitle value={task.title} disabled={!task.perms.edit} onSave={(title) => run(() => updateTask(task.id, { title }))} />

            {/* Primary actions: hand in / approve */}
            <div className="flex flex-wrap gap-2">
              {isAssignee && review && task.statusKind !== "REVIEW" && task.statusKind !== "DONE" && (
                <button className="btn btn-primary" onClick={() => changeStatus(review.id)}>
                  📤 {t.sendToReview}
                </button>
              )}
              {task.perms.approve && done && task.statusKind === "REVIEW" && (
                <button className="btn bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => changeStatus(done.id)}>
                  ✅ {t.approve} (+{task.xp} XP)
                </button>
              )}
            </div>

            <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 text-sm">
              <Label>{t.status}</Label>
              <select className="input max-w-56" value={task.statusId} disabled={!task.perms.status} onChange={(e) => changeStatus(e.target.value)}>
                {task.statuses.map((s) => (
                  <option key={s.id} value={s.id} disabled={(s.kind === "DONE" || task.statusKind === "DONE") && !task.perms.approve && s.id !== task.statusId}>
                    {s.name}
                  </option>
                ))}
              </select>

              <Label>{t.assignees}</Label>
              <AssigneePicker
                value={task.assignees.map((a) => a.id)}
                disabled={!task.perms.assign}
                onChange={(ids) => run(() => setAssignees(task.id, ids))}
              />

              <Label>{t.difficulty}</Label>
              <div className="flex flex-wrap gap-1">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    disabled={!task.perms.edit}
                    onClick={() => run(() => updateTask(task.id, { difficulty: d }))}
                    className={task.difficulty === d ? "" : "opacity-35 hover:opacity-80"}
                  >
                    <DifficultyChip value={d} />
                  </button>
                ))}
              </div>

              <Label>{t.priority}</Label>
              <div className="flex flex-wrap gap-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    disabled={!task.perms.edit}
                    onClick={() => run(() => updateTask(task.id, { priority: p }))}
                    className={`chip border-[var(--border)] ${task.priority === p ? "bg-[var(--bg-soft)] text-[var(--text)]" : "muted opacity-60"}`}
                  >
                    {PRIORITY_ICON[p]} {PRIORITY_LABEL[locale][p]}
                  </button>
                ))}
              </div>

              <Label>{t.dueDate}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  className="input max-w-56"
                  disabled={!task.perms.edit}
                  defaultValue={task.dueDate ? toLocalInput(task.dueDate) : ""}
                  onBlur={(e) => run(() => updateTask(task.id, { dueDate: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                />
                <DueLabel due={task.dueDate} done={!!task.completedAt} />
              </div>

              <Label>{t.xp}</Label>
              <XpEditor task={task} onSave={(xp) => run(() => updateTask(task.id, { xp }))} />

              {task.assignees.length > 1 && (
                <>
                  <Label>{t.xpShares}</Label>
                  <SharesEditor task={task} onSave={(shares) => run(() => setXpShares(task.id, shares))} />
                </>
              )}

              <Label>{t.tags}</Label>
              <TagEditor value={task.tags.map((x) => x.name)} disabled={!task.perms.edit} onSave={(names) => run(() => setTags(task.id, names))} />

              <Label>⏱ {t.timeSpent}</Label>
              <TimeTracker task={task} run={run} />

              {task.customFields.map((f) => (
                <FieldRow key={f.id} field={f} value={task.fields[f.id] ?? ""} disabled={!task.perms.edit} onSave={(value) => run(() => updateTask(task.id, { field: { id: f.id, value } }))} />
              ))}

              <Label>{t.createdAt}</Label>
              <span className="muted flex items-center gap-2">
                <Avatar avatar={task.creatorAvatar} size={20} /> {task.creatorName} · {formatDateTime(task.createdAt, locale)}
              </span>
            </div>

            <section>
              <h3 className="mb-2 text-sm font-bold">📝 {t.description}</h3>
              <Description value={task.description} disabled={!task.perms.edit} onSave={(description) => run(() => updateTask(task.id, { description }))} />
            </section>

            <Attachments task={task} />

            {!task.parentId && (
              <section>
                <h3 className="mb-2 text-sm font-bold">
                  ☑ {t.subtasks} {task.subtasks.length > 0 && <span className="muted">({task.subtaskDone}/{task.subtaskCount})</span>}
                </h3>
                <div className="panel divide-y divide-[var(--border)]">
                  {task.subtasks.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-soft)]">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.statusColor }} title={s.statusName} />
                      <button className={`min-w-0 flex-1 truncate text-left ${s.statusKind === "DONE" ? "muted line-through" : ""}`} onClick={() => openTask(s.id)}>
                        {s.title}
                      </button>
                      <DifficultyChip value={s.difficulty} />
                      <XpChip xp={s.xp} />
                      <DueLabel due={s.dueDate} done={!!s.completedAt} />
                      <span className="flex -space-x-1.5">
                        {s.assignees.map((a) => (
                          <Avatar key={a.id} avatar={a.avatar} size={20} title={a.name} />
                        ))}
                      </span>
                    </div>
                  ))}
                  <div className="px-2 py-1">
                    <QuickAdd planetId={task.planetId} parentId={task.id} compact />
                  </div>
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-sm font-bold">🕓 {t.activity}</h3>
              <ul className="muted space-y-1 text-xs">
                {task.activity.map((a) => (
                  <li key={a.id}>
                    <b className="text-[var(--text)]">{a.actor}</b> {a.detail} · {formatDateTime(a.createdAt, locale)}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Chat */}
          <div className={`flex w-full flex-col border-l border-[var(--border)] bg-[var(--bg-elev)] lg:w-[420px] lg:shrink-0 ${tab === "details" ? "max-lg:hidden" : ""}`}>
            <Chat task={task} run={run} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="muted text-xs font-semibold tracking-wide uppercase">{children}</span>;
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function EditableTitle({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => {
    setV(value);
  }, [value]);
  return (
    <textarea
      rows={1}
      disabled={disabled}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() && v !== value && onSave(v)}
      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
      className="w-full resize-none bg-transparent text-2xl font-bold outline-none [field-sizing:content]"
    />
  );
}

function Description({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const { t } = useUi();
  const [v, setV] = useState(value);
  useEffect(() => {
    setV(value);
  }, [value]);
  return (
    <textarea
      disabled={disabled}
      value={v}
      placeholder={`${t.description}...`}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
      className="input min-h-32 [field-sizing:content]"
    />
  );
}

function AssigneePicker({ value, disabled, onChange }: { value: string[]; disabled: boolean; onChange: (ids: string[]) => void }) {
  const { crew, t } = useUi();
  const [open, setOpen] = useState(false);
  const selected = crew.filter((c) => value.includes(c.id));
  return (
    <div className="relative">
      <button disabled={disabled} onClick={() => setOpen((o) => !o)} className="flex flex-wrap items-center gap-1.5 rounded-lg px-1 py-0.5 hover:bg-[var(--bg-soft)]">
        {selected.length ? (
          selected.map((c) => (
            <span key={c.id} className="chip border-[var(--border)] py-0.5">
              <Avatar avatar={c.avatar} size={18} /> {c.name}
            </span>
          ))
        ) : (
          <span className="muted">{t.unassigned}</span>
        )}
        {!disabled && <span className="muted">＋</span>}
      </button>
      {open && (
        <div className="panel absolute z-20 mt-1 max-h-72 w-64 overflow-y-auto p-1 shadow-xl" onMouseLeave={() => setOpen(false)}>
          {crew.map((c) => {
            const on = value.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => onChange(on ? value.filter((x) => x !== c.id) : [...value, c.id])}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--bg-soft)]"
              >
                <Avatar avatar={c.avatar} size={22} />
                <span className="flex-1 truncate">{c.name}</span>
                {on && <span className="text-[var(--accent)]">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function XpEditor({ task, onSave }: { task: PanelTask; onSave: (xp: number | null) => void }) {
  const { locale } = useUi();
  const [v, setV] = useState(String(task.xp));
  useEffect(() => {
    setV(String(task.xp));
  }, [task.xp]);
  const auto = taskXp(task.difficulty, task.priority);
  if (!task.perms.editXp) return <XpChip xp={task.xp} />;
  return (
    <div className="flex items-center gap-2">
      <span className="text-amber-500">🪙</span>
      <input type="number" min={0} className="input w-24" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => Number(v) !== task.xp && onSave(Number(v))} />
      {task.xpOverride ? (
        <button className="muted text-xs underline" onClick={() => onSave(null)}>
          {locale === "ka" ? `ავტომატური (${auto})` : `auto (${auto})`}
        </button>
      ) : (
        <span className="muted text-xs">{locale === "ka" ? "ავტომატური" : "auto"}</span>
      )}
    </div>
  );
}

function SharesEditor({ task, onSave }: { task: PanelTask; onSave: (s: Record<string, number>) => void }) {
  const [shares, setShares] = useState(() => Object.fromEntries(task.assignees.map((a) => [a.id, a.share])));
  const sum = Object.values(shares).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-1.5">
      {task.assignees.map((a) => (
        <div key={a.id} className="flex items-center gap-2 text-sm">
          <Avatar avatar={a.avatar} size={20} />
          <span className="w-28 truncate">{a.name}</span>
          <input
            type="number"
            min={0}
            max={100}
            disabled={!task.perms.editXp}
            className="input w-20"
            value={shares[a.id]}
            onChange={(e) => setShares({ ...shares, [a.id]: Number(e.target.value) })}
          />
          <span className="muted text-xs">% → 🪙 {Math.floor((task.xp * (shares[a.id] ?? 0)) / 100)}</span>
        </div>
      ))}
      {task.perms.editXp && (
        <button className="btn btn-ghost text-xs" disabled={sum !== 100} onClick={() => onSave(shares)}>
          💾 {sum}/100%
        </button>
      )}
    </div>
  );
}

function TagEditor({ value, disabled, onSave }: { value: string[]; disabled: boolean; onSave: (v: string[]) => void }) {
  const [v, setV] = useState(value.join(", "));
  useEffect(() => {
    setV(value.join(", "));
  }, [value]);
  return (
    <input
      className="input max-w-md"
      disabled={disabled}
      placeholder="frontend, bug, design"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value.join(", ") && onSave(v.split(",").map((s) => s.trim()).filter(Boolean))}
    />
  );
}

function Chat({ task, run }: { task: PanelTask; run: (fn: () => Promise<unknown>) => void }) {
  const { t, locale, me, crew } = useUi();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<PanelComment | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const count = task.comments.length;
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [count]);

  // @mention autocomplete on the word under the cursor.
  const mention = /@([\p{L}\p{N}._-]*)$/u.exec(text)?.[1];
  const suggestions = mention !== undefined ? crew.filter((c) => c.name.toLowerCase().includes(mention.toLowerCase()) || c.email.startsWith(mention.toLowerCase())).slice(0, 5) : [];

  function send() {
    const body = text.trim();
    if (!body) return;
    if (editing) {
      run(() => editComment(task.id, editing, body));
      setEditing(null);
    } else {
      run(() => addComment(task.id, body, replyTo?.id));
      playBlip();
    }
    setText("");
    setReplyTo(null);
  }

  return (
    <>
      <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-bold max-lg:hidden">💬 {t.comments}</div>
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {task.comments.map((c) =>
          c.system ? (
            <div key={c.id} className="muted text-center text-[11px]">
              ⚡ {c.body} · {time(c.createdAt, locale)}
            </div>
          ) : (
            <div key={c.id} className={`group flex gap-2 ${c.authorId === me.id ? "flex-row-reverse" : ""}`}>
              <Avatar avatar={c.authorAvatar} size={28} title={c.authorName} />
              <div className={`max-w-[80%] ${c.authorId === me.id ? "items-end" : ""} flex flex-col`}>
                <div className="muted mb-0.5 text-[11px]">
                  {c.authorName} · {time(c.createdAt, locale)} {c.edited && `· ${t.edited}`}
                </div>
                <div
                  className={`rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap ${
                    c.authorId === me.id ? "rounded-tr-sm bg-[var(--accent)] text-white" : "rounded-tl-sm bg-[var(--bg-soft)]"
                  } ${c.deleted ? "italic opacity-50" : ""}`}
                >
                  {c.parentPreview && <div className="mb-1 border-l-2 border-white/40 pl-2 text-xs opacity-75">↩ {c.parentPreview}</div>}
                  {c.deleted ? "🗑️" : highlight(c.body)}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {c.reactions.map((r) => (
                    <button
                      key={r.emoji}
                      onClick={() => run(() => toggleReaction(task.id, c.id, r.emoji))}
                      className={`chip ${r.mine ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"}`}
                    >
                      {r.emoji} {r.count}
                    </button>
                  ))}
                  {!c.deleted && task.perms.comment && (
                    <span className="hidden gap-0.5 group-hover:flex max-lg:flex">
                      {REACTIONS.map((e) => (
                        <button key={e} className="text-xs opacity-60 hover:scale-125 hover:opacity-100" onClick={() => run(() => toggleReaction(task.id, c.id, e))}>
                          {e}
                        </button>
                      ))}
                      <button className="muted ml-1 text-[11px] underline" onClick={() => setReplyTo(c)}>
                        {t.reply}
                      </button>
                      {c.authorId === me.id && (
                        <>
                          <button className="muted ml-1 text-[11px]" onClick={() => (setEditing(c.id), setText(c.body))}>
                            ✏️
                          </button>
                          <button className="muted ml-1 text-[11px]" onClick={() => run(() => deleteComment(task.id, c.id))}>
                            🗑️
                          </button>
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ),
        )}
        <div ref={bottom} />
      </div>
      {task.perms.comment && (
        <div className="relative border-t border-[var(--border)] p-3">
          {suggestions.length > 0 && (
            <div className="panel absolute bottom-full left-3 mb-1 w-60 p-1 shadow-xl">
              {suggestions.map((c) => (
                <button
                  key={c.id}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--bg-soft)]"
                  onClick={() => setText(text.replace(/@[\p{L}\p{N}._-]*$/u, `@${c.email.split("@")[0]} `))}
                >
                  <Avatar avatar={c.avatar} size={20} /> {c.name}
                </button>
              ))}
            </div>
          )}
          {(replyTo || editing) && (
            <div className="muted mb-2 flex items-center gap-2 text-xs">
              {replyTo ? `↩ ${replyTo.authorName}: ${replyTo.body.slice(0, 60)}` : `✏️ ${t.edited}`}
              <button onClick={() => (setReplyTo(null), setEditing(null), setText(""))}>✕</button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              className="input max-h-40 [field-sizing:content]"
              placeholder={t.writeComment}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button className="btn btn-primary" onClick={send}>
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function time(iso: string, locale: "ka" | "en") {
  return isSameTbilisiDay(new Date(iso), new Date()) ? formatTime(iso) : `${formatDay(iso, locale)} ${formatTime(iso)}`;
}

function highlight(body: string) {
  return body.split(/(@[\p{L}\p{N}._-]+)/u).map((part, i) =>
    part.startsWith("@") ? (
      <b key={i} className="rounded bg-white/15 px-0.5">
        {part}
      </b>
    ) : (
      part
    ),
  );
}


function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function TimeTracker({ task, run }: { task: PanelTask; run: (fn: () => Promise<unknown>) => void }) {
  const { t } = useUi();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!task.timerSince) return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [task.timerSince]);
  const running = task.timerSince ? Math.max(0, Math.round((Date.now() - Date.parse(task.timerSince)) / 1000)) : 0;
  void tick;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={`btn ${task.timerSince ? "bg-rose-600 text-white hover:bg-rose-500" : "btn-ghost"}`} onClick={() => run(() => toggleTimer(task.id))}>
        {task.timerSince ? `⏹ ${formatDuration(running)}` : `▶ ${t.startTimer}`}
      </button>
      <span className="text-sm font-semibold">{formatDuration(task.timeSpentSec)}</span>
      {task.perms.edit && (
        <select className="input w-auto py-1 text-xs" value="" onChange={(e) => e.target.value && run(() => addTime(task.id, Number(e.target.value)))}>
          <option value="">＋ {t.addTime}</option>
          {[15, 30, 60, 120, 240].map((m) => (
            <option key={m} value={m}>
              +{formatDuration(m * 60)}
            </option>
          ))}
        </select>
      )}
      {task.runningTimers.length > 0 && <span className="muted text-xs">⏱ {task.runningTimers.join(", ")}</span>}
    </div>
  );
}

function FieldRow({ field, value, disabled, onSave }: { field: CustomField; value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => {
    setV(value);
  }, [value]);
  const commit = (next: string) => next !== value && onSave(next);
  let input: React.ReactNode;
  if (field.type === "CHECKBOX") {
    input = <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" disabled={disabled} checked={v === "true"} onChange={(e) => commit(String(e.target.checked))} />;
  } else if (field.type === "SELECT") {
    input = (
      <select className="input max-w-56" disabled={disabled} value={v} onChange={(e) => commit(e.target.value)}>
        <option value="">—</option>
        {field.options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  } else {
    const type = field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : field.type === "URL" ? "url" : "text";
    input = (
      <div className="flex max-w-md items-center gap-2">
        <input className="input" type={type} disabled={disabled} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => commit(v)} />
        {field.type === "URL" && v && (
          <a href={v} target="_blank" rel="noreferrer" className="text-[var(--accent)]">
            ↗
          </a>
        )}
      </div>
    );
  }
  return (
    <>
      <Label>{field.name}</Label>
      {input}
    </>
  );
}

function Attachments({ task }: { task: PanelTask }) {
  const { t } = useUi();
  const { toast } = useGame();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | File[]) {
    const list = [...files];
    if (!list.length) return;
    setBusy(true);
    const form = new FormData();
    list.forEach((f) => form.append("files", f));
    const res = await fetch(`/api/tasks/${task.id}/files`, { method: "POST", body: form });
    setBusy(false);
    if (!res.ok) return toast(res.status === 413 ? "25MB max" : t.noPermission, "error", "⛔");
    playBlip();
    router.refresh();
  }

  return (
    <section
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (task.perms.edit) upload(e.dataTransfer.files);
      }}
    >
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
        📎 {t.files} {task.attachments.length > 0 && <span className="muted">({task.attachments.length})</span>}
      </h3>
      <div className={`rounded-xl border border-dashed p-3 transition ${over ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"}`}>
        {task.attachments.length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {task.attachments.map((a) => (
              <div key={a.id} className="group relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-soft)]">
                <a href={a.url} target="_blank" rel="noreferrer" className="block">
                  {a.mime.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt={a.name} className="h-24 w-full object-cover" />
                  ) : (
                    <div className="flex h-24 items-center justify-center text-3xl">📄</div>
                  )}
                  <div className="truncate px-2 py-1 text-xs">{a.name}</div>
                </a>
                {task.perms.edit && (
                  <button
                    className="absolute top-1 right-1 hidden rounded-md bg-black/60 px-1.5 text-xs text-white group-hover:block max-lg:block"
                    onClick={async () => {
                      await removeAttachment(task.id, a.id);
                      router.refresh();
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {task.perms.edit && (
          <button className="muted w-full text-center text-sm hover:text-[var(--accent)]" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "⏳ ..." : `⬆ ${t.dropFiles}`}
          </button>
        )}
        <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
      </div>
    </section>
  );
}
