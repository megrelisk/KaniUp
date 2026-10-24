"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { all, col, loadTree, newId, now, one, ping } from "@/lib/data";
import { assertCan, folderPath, galaxyPath, planetPath } from "@/lib/access";
import { requireUser } from "@/lib/session";
import type { CustomField, CustomFieldType, FolderDoc, GalaxyDoc, PlanetDoc, Status, StatusKind, TaskDoc } from "@/lib/types";

const DEFAULT_STATUSES: Omit<Status, "id" | "position">[] = [
  { name: "Backlog", color: "#64748b", kind: "BACKLOG" },
  { name: "To Do", color: "#3b82f6", kind: "OPEN" },
  { name: "In Progress", color: "#f59e0b", kind: "ACTIVE" },
  { name: "In Review", color: "#8b5cf6", kind: "REVIEW" },
  { name: "Done", color: "#10b981", kind: "DONE" },
];

const name = z.string().trim().min(1).max(120);

function changed() {
  revalidatePath("/", "layout");
  return ping("structure");
}

export async function createGalaxy(input: { name: string; icon?: string; color?: string }) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_STRUCTURE", []);
  const tree = await loadTree();
  const ref = await col.galaxies().add({
    name: name.parse(input.name),
    icon: input.icon || "🌌",
    color: input.color || "#6366f1",
    position: tree.galaxies.length,
    createdAt: now(),
    deletedAt: null,
  } satisfies Omit<GalaxyDoc, "id">);
  await changed();
  return ref.id;
}

/** A folder ("solar system") lives in a galaxy, optionally inside a planet and/or another folder. */
export async function createFolder(input: { name: string; galaxyId: string; planetId?: string; parentId?: string }) {
  const user = await requireUser();
  const path = input.parentId ? await folderPath(input.parentId) : input.planetId ? await planetPath(input.planetId) : await galaxyPath(input.galaxyId);
  await assertCan(user, "MANAGE_STRUCTURE", path);
  let planetId = input.planetId ?? null;
  if (input.parentId) planetId = (await loadTree()).folderById.get(input.parentId)?.planetId ?? null;
  const ref = await col.folders().add({
    name: name.parse(input.name),
    galaxyId: input.galaxyId,
    planetId,
    parentId: input.parentId ?? null,
    position: Date.now(),
    createdAt: now(),
    deletedAt: null,
  } satisfies Omit<FolderDoc, "id">);
  await changed();
  return ref.id;
}

export async function createPlanet(input: { name: string; galaxyId: string; folderId?: string; icon?: string; color?: string }) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_STRUCTURE", input.folderId ? await folderPath(input.folderId) : await galaxyPath(input.galaxyId));
  const ref = await col.planets().add({
    name: name.parse(input.name),
    galaxyId: input.galaxyId,
    folderId: input.folderId ?? null,
    icon: input.icon || "🪐",
    color: input.color || "#06b6d4",
    position: Date.now(),
    statuses: DEFAULT_STATUSES.map((s, position) => ({ ...s, id: newId(), position })),
    customFields: [],
    tags: {},
    createdAt: now(),
    deletedAt: null,
  } satisfies Omit<PlanetDoc, "id">);
  await changed();
  return ref.id;
}

type Node = { type: "galaxy" | "folder" | "planet"; id: string };

const nodeRef = (n: Node) => (n.type === "galaxy" ? col.galaxies() : n.type === "folder" ? col.folders() : col.planets()).doc(n.id);
const nodePath = (n: Node) => (n.type === "galaxy" ? galaxyPath(n.id) : n.type === "folder" ? folderPath(n.id) : planetPath(n.id));

export async function updateNode(node: Node, input: { name?: string; icon?: string; color?: string }) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_STRUCTURE", await nodePath(node));
  const data: Record<string, string> = {};
  if (input.name !== undefined) data.name = name.parse(input.name);
  if (input.icon) data.icon = input.icon.slice(0, 8);
  if (input.color && /^#[0-9a-f]{6}$/i.test(input.color)) data.color = input.color;
  await nodeRef(node).update(data);
  await changed();
}

export async function renameNode(node: Node, newName: string) {
  await updateNode(node, { name: newName });
}

/** Soft delete — keeps data recoverable and the activity log intact. */
export async function deleteNode(node: Node) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_STRUCTURE", await nodePath(node));
  await nodeRef(node).update({ deletedAt: now() });
  await changed();
}

/** Drag & drop in the sidebar: move a planet or folder into another folder or a galaxy root. */
export async function moveNode(node: Node, target: { galaxyId: string; folderId: string | null }) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_STRUCTURE", await nodePath(node));
  await assertCan(user, "MANAGE_STRUCTURE", target.folderId ? await folderPath(target.folderId) : await galaxyPath(target.galaxyId));
  const tree = await loadTree();
  if (node.type === "planet") {
    await nodeRef(node).update({ galaxyId: target.galaxyId, folderId: target.folderId });
  } else if (node.type === "folder") {
    // Refuse to drop a folder into itself or one of its descendants.
    for (let id = target.folderId; id; id = tree.folderById.get(id)?.parentId ?? null) if (id === node.id) return;
    await nodeRef(node).update({ galaxyId: target.galaxyId, parentId: target.folderId });
    // Keep galaxyId consistent for everything below the moved folder.
    const stack = [node.id];
    while (stack.length) {
      const id = stack.pop()!;
      for (const f of tree.folders.filter((x) => x.parentId === id)) {
        await col.folders().doc(f.id).update({ galaxyId: target.galaxyId });
        stack.push(f.id);
      }
      for (const p of tree.planets.filter((x) => x.folderId === id)) await col.planets().doc(p.id).update({ galaxyId: target.galaxyId });
    }
  }
  await changed();
}

// ─── Planet settings: statuses and custom fields ─────────────────────────

const statusSchema = z.array(
  z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(40),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    kind: z.enum(["BACKLOG", "OPEN", "ACTIVE", "REVIEW", "DONE"]),
  }),
);

/** Replaces a planet's statuses (order = position). Tasks in a removed status move to the first one. */
export async function saveStatuses(planetId: string, input: { id?: string; name: string; color: string; kind: StatusKind }[]) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_STATUSES", await planetPath(planetId));
  const list = statusSchema.parse(input);
  if (!list.length) throw new Error("at least one status");
  if (!list.some((s) => s.kind === "DONE")) throw new Error("a Done status is required");
  const statuses: Status[] = list.map((s, position) => ({ ...s, id: s.id || newId(), position }));
  const planet = await one<PlanetDoc>(col.planets().doc(planetId));
  if (!planet) throw new Error("not_found");
  const removed = planet.statuses.filter((s) => !statuses.some((n) => n.id === s.id)).map((s) => s.id);
  if (removed.length) {
    const fallback = statuses[0].id;
    const tasks = await all<TaskDoc>(col.tasks().where("planetId", "==", planetId));
    await Promise.all(tasks.filter((t) => removed.includes(t.statusId)).map((t) => col.tasks().doc(t.id).update({ statusId: fallback })));
  }
  await col.planets().doc(planetId).update({ statuses });
  revalidatePath("/", "layout");
  await ping(`planet-${planetId}`);
}

const fieldSchema = z.array(
  z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(60),
    type: z.enum(["TEXT", "NUMBER", "DATE", "SELECT", "CHECKBOX", "URL"]),
    options: z.array(z.string().trim().min(1).max(60)).default([]),
  }),
);

export async function saveCustomFields(planetId: string, input: { id?: string; name: string; type: CustomFieldType; options?: string[] }[]) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_FIELDS", await planetPath(planetId));
  const fields: CustomField[] = fieldSchema.parse(input).map((f) => ({ ...f, id: f.id || newId() }));
  await col.planets().doc(planetId).update({ customFields: fields });
  revalidatePath("/", "layout");
  await ping(`planet-${planetId}`);
}
