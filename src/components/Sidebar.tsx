"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { createFolder, createGalaxy, createPlanet, deleteNode, moveNode, renameNode } from "@/app/actions/structure";
import { useUi } from "./UiContext";
import { useGame } from "./Game";
import { playBlip, playWhoosh } from "./sound";

export type PlanetNode = { id: string; name: string; icon: string; color: string; open: number };
export type FolderNode = { id: string; name: string; folders: FolderNode[]; planets: PlanetNode[] };
export type GalaxyNode = { id: string; name: string; icon: string; color: string; folders: FolderNode[]; planets: PlanetNode[] };

type DropTarget = { galaxyId: string; folderId: string | null };
type Creating = { kind: "galaxy" | "folder" | "planet"; galaxyId?: string; folderId?: string } | null;

export function Sidebar({ galaxies, onNavigate }: { galaxies: GalaxyNode[]; onNavigate?: () => void }) {
  const { t, canManageStructure } = useUi();
  const { toast } = useGame();
  const router = useRouter();
  const [creating, setCreating] = useState<Creating>(null);
  const [, start] = useTransition();
  // Stable id keeps dnd-kit aria attributes identical between server and client renders.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const node = e.active.data.current as { type: "planet" | "folder"; id: string };
    const target = e.over.data.current as DropTarget;
    if (node.type === "folder" && target.folderId === node.id) return;
    playWhoosh();
    start(async () => {
      try {
        await moveNode(node, target);
      } catch {
        toast(t.noPermission, "error", "⛔");
      }
    });
  }

  async function submitCreate(name: string) {
    if (!creating || !name.trim()) return setCreating(null);
    try {
      if (creating.kind === "galaxy") await createGalaxy({ name });
      if (creating.kind === "folder") await createFolder({ name, galaxyId: creating.galaxyId!, parentId: creating.folderId });
      if (creating.kind === "planet") {
        const id = await createPlanet({ name, galaxyId: creating.galaxyId!, folderId: creating.folderId });
        router.push(`/p/${id}`);
      }
      playBlip();
    } catch {
      toast(t.noPermission, "error", "⛔");
    }
    setCreating(null);
  }

  const ctx = { creating, setCreating, submitCreate, onNavigate };

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3 text-sm">
      <NavLink href="/" icon="🎯" label={t.home} onNavigate={onNavigate} />
      <NavLink href="/leaderboard" icon="🏆" label={t.leaderboard} onNavigate={onNavigate} />
      <NavLink href="/profile" icon="🧑‍🚀" label={t.profile} onNavigate={onNavigate} />

      <div className="mt-4 mb-1 flex items-center justify-between px-2">
        <span className="muted text-xs font-bold tracking-widest uppercase">{t.galaxies}</span>
        {canManageStructure && (
          <button className="muted hover:text-[var(--accent)]" title={t.newGalaxy} onClick={() => setCreating({ kind: "galaxy" })}>
            ＋
          </button>
        )}
      </div>
      {creating?.kind === "galaxy" && <InlineInput placeholder={t.newGalaxy} onDone={submitCreate} />}

      <DndContext id={dndId} sensors={sensors} onDragEnd={onDragEnd}>
        {galaxies.map((g) => (
          <GalaxyItem key={g.id} galaxy={g} ctx={ctx} />
        ))}
      </DndContext>
      {!galaxies.length && !creating && <p className="muted px-2 py-4 text-xs">{t.emptySpace}</p>}
    </nav>
  );
}

type Ctx = {
  creating: Creating;
  setCreating: (c: Creating) => void;
  submitCreate: (name: string) => void;
  onNavigate?: () => void;
};

function NavLink({ href, icon, label, onNavigate }: { href: string; icon: string; label: string; onNavigate?: () => void }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium transition ${
        active ? "bg-[var(--bg-soft)] text-[var(--accent)] shadow-[inset_3px_0_0_var(--accent)]" : "hover:bg-[var(--bg-soft)]"
      }`}
    >
      <span className="text-base">{icon}</span>
      {label}
    </Link>
  );
}

function useToggle(key: string) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(key) === "0") setOpen(false);
    } catch {}
  }, [key]);
  return [
    open,
    () =>
      setOpen((o) => {
        try {
          localStorage.setItem(key, o ? "0" : "1");
        } catch {}
        return !o;
      }),
  ] as const;
}

function GalaxyItem({ galaxy, ctx }: { galaxy: GalaxyNode; ctx: Ctx }) {
  const [open, toggle] = useToggle(`g:${galaxy.id}`);
  const drop = useDroppable({ id: `g-${galaxy.id}`, data: { galaxyId: galaxy.id, folderId: null } satisfies DropTarget });
  return (
    <div ref={drop.setNodeRef} className={`rounded-lg ${drop.isOver ? "bg-[var(--glow)]" : ""}`}>
      <Row
        icon={galaxy.icon}
        label={galaxy.name}
        open={open}
        onToggle={toggle}
        bold
        node={{ type: "galaxy", id: galaxy.id }}
        onAdd={(kind) => ctx.setCreating({ kind, galaxyId: galaxy.id })}
      />
      {open && (
        <div className="ml-3 border-l border-[var(--border)] pl-1.5">
          <Children folders={galaxy.folders} planets={galaxy.planets} galaxyId={galaxy.id} folderId={undefined} ctx={ctx} />
        </div>
      )}
    </div>
  );
}

function Children({ folders, planets, galaxyId, folderId, ctx }: { folders: FolderNode[]; planets: PlanetNode[]; galaxyId: string; folderId?: string; ctx: Ctx }) {
  const { t } = useUi();
  const c = ctx.creating;
  const here = c && c.galaxyId === galaxyId && c.folderId === folderId && c.kind !== "galaxy";
  return (
    <>
      {here && <InlineInput placeholder={c.kind === "folder" ? t.newFolder : t.newPlanet} onDone={ctx.submitCreate} />}
      {folders.map((f) => (
        <FolderItem key={f.id} folder={f} galaxyId={galaxyId} ctx={ctx} />
      ))}
      {planets.map((p) => (
        <PlanetItem key={p.id} planet={p} onNavigate={ctx.onNavigate} />
      ))}
    </>
  );
}

function FolderItem({ folder, galaxyId, ctx }: { folder: FolderNode; galaxyId: string; ctx: Ctx }) {
  const [open, toggle] = useToggle(`f:${folder.id}`);
  const drop = useDroppable({ id: `f-${folder.id}`, data: { galaxyId, folderId: folder.id } satisfies DropTarget });
  const drag = useDraggable({ id: `df-${folder.id}`, data: { type: "folder", id: folder.id } });
  return (
    <div ref={drop.setNodeRef} className={`rounded-lg ${drop.isOver ? "bg-[var(--glow)]" : ""} ${drag.isDragging ? "opacity-40" : ""}`}>
      <div ref={drag.setNodeRef} {...drag.listeners} {...drag.attributes}>
        <Row
          icon="☀️"
          label={folder.name}
          open={open}
          onToggle={toggle}
          node={{ type: "folder", id: folder.id }}
          onAdd={(kind) => ctx.setCreating({ kind, galaxyId, folderId: folder.id })}
        />
      </div>
      {open && (
        <div className="ml-3 border-l border-dashed border-[var(--border)] pl-1.5">
          <Children folders={folder.folders} planets={folder.planets} galaxyId={galaxyId} folderId={folder.id} ctx={ctx} />
        </div>
      )}
    </div>
  );
}

function PlanetItem({ planet, onNavigate }: { planet: PlanetNode; onNavigate?: () => void }) {
  const href = `/p/${planet.id}`;
  const active = usePathname() === href;
  const drag = useDraggable({ id: `dp-${planet.id}`, data: { type: "planet", id: planet.id } });
  return (
    <div ref={drag.setNodeRef} {...drag.listeners} {...drag.attributes} className={drag.isDragging ? "opacity-40" : ""}>
      <Link
        href={href}
        onClick={onNavigate}
        className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${active ? "bg-[var(--bg-soft)] text-[var(--accent)]" : "hover:bg-[var(--bg-soft)]"}`}
      >
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: planet.color, boxShadow: `0 0 8px ${planet.color}` }} />
        <span className="flex-1 truncate">{planet.name}</span>
        {planet.open > 0 && <span className="muted text-xs">{planet.open}</span>}
      </Link>
    </div>
  );
}

function Row({
  icon,
  label,
  open,
  onToggle,
  bold,
  node,
  onAdd,
}: {
  icon: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  bold?: boolean;
  node: { type: "galaxy" | "folder"; id: string };
  onAdd: (kind: "folder" | "planet") => void;
}) {
  const { t, canManageStructure } = useUi();
  const { toast } = useGame();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);

  if (renaming)
    return (
      <InlineInput
        placeholder={label}
        initial={label}
        onDone={async (v) => {
          setRenaming(false);
          if (v.trim() && v !== label) await renameNode(node, v).catch(() => toast(t.noPermission, "error", "⛔"));
        }}
      />
    );

  return (
    <div className="group relative flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 hover:bg-[var(--bg-soft)]">
      <button onClick={onToggle} className="muted w-4 text-xs">
        {open ? "▾" : "▸"}
      </button>
      <span>{icon}</span>
      <span onClick={onToggle} className={`flex-1 cursor-pointer truncate ${bold ? "font-semibold" : ""}`}>
        {label}
      </span>
      {canManageStructure && (
        <button className="muted opacity-0 group-hover:opacity-100 max-md:opacity-100" onClick={() => setMenu((m) => !m)}>
          ⋯
        </button>
      )}
      {menu && (
        <div className="panel absolute top-8 right-0 z-30 w-52 p-1 shadow-xl" onMouseLeave={() => setMenu(false)}>
          <MenuItem label={`☀️ ${t.newFolder}`} onClick={() => (setMenu(false), onAdd("folder"))} />
          <MenuItem label={`🪐 ${t.newPlanet}`} onClick={() => (setMenu(false), onAdd("planet"))} />
          <MenuItem label={`✏️ ${t.rename}`} onClick={() => (setMenu(false), setRenaming(true))} />
          <MenuItem
            label={`🗑️ ${t.delete}`}
            danger
            onClick={async () => {
              setMenu(false);
              if (confirm(`${t.delete}: ${label}?`)) await deleteNode(node).catch(() => toast(t.noPermission, "error", "⛔"));
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--bg-soft)] ${danger ? "text-rose-400" : ""}`}>
      {label}
    </button>
  );
}

function InlineInput({ placeholder, initial = "", onDone }: { placeholder: string; initial?: string; onDone: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  // Enter and the following blur would both fire; only the first counts.
  const done = useRef(false);
  const finish = (v: string) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  return (
    <input
      autoFocus
      className="input my-1"
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(value);
        if (e.key === "Escape") finish("");
      }}
    />
  );
}
