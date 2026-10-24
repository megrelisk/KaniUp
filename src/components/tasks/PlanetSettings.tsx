"use client";

import { useState, useTransition } from "react";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { saveCustomFields, saveStatuses } from "@/app/actions/structure";
import type { CustomField, CustomFieldType, Status, StatusKind } from "@/lib/types";
import { useGame } from "../Game";
import { useUi } from "../UiContext";

const KIND_LABEL: Record<StatusKind, string> = { BACKLOG: "Backlog", OPEN: "To Do", ACTIVE: "In Progress", REVIEW: "Review", DONE: "Done ✓ XP" };
const FIELD_TYPES: CustomFieldType[] = ["TEXT", "NUMBER", "DATE", "SELECT", "CHECKBOX", "URL"];

type EditStatus = { key: string; id?: string; name: string; color: string; kind: StatusKind };
type EditField = { key: string; id?: string; name: string; type: CustomFieldType; options: string };

/** Planet settings drawer: drag to reorder statuses, rename / recolor / add them, manage custom fields. */
export function PlanetSettings({ planetId, statuses, fields, canStatuses, canFields }: { planetId: string; statuses: Status[]; fields: CustomField[]; canStatuses: boolean; canFields: boolean }) {
  const { t, locale } = useUi();
  const { toast } = useGame();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<EditStatus[]>([]);
  const [fieldList, setFieldList] = useState<EditField[]>([]);
  const [pending, start] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));

  function openDrawer() {
    setList(statuses.map((s) => ({ key: s.id, id: s.id, name: s.name, color: s.color, kind: s.kind })));
    setFieldList(fields.map((f) => ({ key: f.id, id: f.id, name: f.name, type: f.type, options: f.options.join(", ") })));
    setOpen(true);
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = list.findIndex((s) => s.key === e.active.id);
    const to = list.findIndex((s) => s.key === e.over!.id);
    setList(arrayMove(list, from, to));
  }

  function save() {
    start(async () => {
      try {
        if (canStatuses) await saveStatuses(planetId, list.map(({ id, name, color, kind }) => ({ id, name, color, kind })));
        if (canFields)
          await saveCustomFields(
            planetId,
            fieldList.filter((f) => f.name.trim()).map(({ id, name, type, options }) => ({ id, name, type, options: options.split(",").map((o) => o.trim()).filter(Boolean) })),
          );
        setOpen(false);
      } catch (err) {
        toast(String(err).includes("Done") ? (locale === "ka" ? "Done სტატუსი აუცილებელია" : "A Done status is required") : t.noPermission, "error", "⛔");
      }
    });
  }

  return (
    <>
      <button className="btn btn-ghost" onClick={openDrawer}>
        ⚙️ <span className="max-sm:hidden">{t.settings}</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="slide-in flex h-full w-full max-w-lg flex-col border-l border-[var(--border)] bg-[var(--bg)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center border-b border-[var(--border)] px-4 py-3">
              <h2 className="flex-1 font-bold">⚙️ {t.settings}</h2>
              <button className="btn btn-ghost px-3" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto p-4">
              {canStatuses && (
                <section>
                  <h3 className="mb-2 text-sm font-bold">{t.statuses}</h3>
                  <DndContext id="status-editor" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={list.map((s) => s.key)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {list.map((s, i) => (
                          <StatusRow
                            key={s.key}
                            s={s}
                            onChange={(next) => setList(list.map((x, j) => (j === i ? next : x)))}
                            onRemove={() => setList(list.filter((_, j) => j !== i))}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                  <button
                    className="muted mt-2 text-sm hover:text-[var(--accent)]"
                    onClick={() => setList([...list, { key: crypto.randomUUID(), name: "", color: "#64748b", kind: "ACTIVE" }])}
                  >
                    ＋ {t.addStatus}
                  </button>
                </section>
              )}
              {canFields && (
                <section>
                  <h3 className="mb-2 text-sm font-bold">{t.customFields}</h3>
                  <div className="space-y-2">
                    {fieldList.map((f, i) => (
                      <div key={f.key} className="panel space-y-2 p-2">
                        <div className="flex gap-2">
                          <input className="input" placeholder={t.name} value={f.name} onChange={(e) => setFieldList(fieldList.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                          <select className="input w-32" value={f.type} onChange={(e) => setFieldList(fieldList.map((x, j) => (j === i ? { ...x, type: e.target.value as CustomFieldType } : x)))}>
                            {FIELD_TYPES.map((ft) => (
                              <option key={ft}>{ft}</option>
                            ))}
                          </select>
                          <button className="muted px-2 hover:text-rose-500" onClick={() => setFieldList(fieldList.filter((_, j) => j !== i))}>
                            ✕
                          </button>
                        </div>
                        {f.type === "SELECT" && (
                          <input className="input" placeholder="option 1, option 2" value={f.options} onChange={(e) => setFieldList(fieldList.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))} />
                        )}
                      </div>
                    ))}
                  </div>
                  <button className="muted mt-2 text-sm hover:text-[var(--accent)]" onClick={() => setFieldList([...fieldList, { key: crypto.randomUUID(), name: "", type: "TEXT", options: "" }])}>
                    ＋ {t.addField}
                  </button>
                </section>
              )}
            </div>
            <div className="border-t border-[var(--border)] p-4">
              <button className="btn btn-primary w-full justify-center" disabled={pending} onClick={save}>
                💾 {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatusRow({ s, onChange, onRemove }: { s: EditStatus; onChange: (s: EditStatus) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: s.key });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="panel flex items-center gap-2 p-2">
      <span className="muted cursor-grab touch-none px-1" {...attributes} {...listeners}>
        ⠿
      </span>
      <input type="color" className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent" value={s.color} onChange={(e) => onChange({ ...s, color: e.target.value })} />
      <input className="input" value={s.name} placeholder="Status" onChange={(e) => onChange({ ...s, name: e.target.value })} />
      <select className="input w-36" value={s.kind} onChange={(e) => onChange({ ...s, kind: e.target.value as StatusKind })}>
        {(Object.keys(KIND_LABEL) as StatusKind[]).map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </select>
      <button className="muted px-1 hover:text-rose-500" onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}
