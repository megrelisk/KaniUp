"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertCan, folderPath, galaxyPath, planetPath } from "@/lib/access";
import { requireUser } from "@/lib/session";

const DEFAULT_STATUSES = [
  { name: "Backlog", color: "#64748b", kind: "BACKLOG" },
  { name: "To Do", color: "#38bdf8", kind: "OPEN" },
  { name: "In Progress", color: "#f59e0b", kind: "ACTIVE" },
  { name: "Review", color: "#a855f7", kind: "REVIEW" },
  { name: "Done", color: "#22c55e", kind: "DONE" },
] as const;

const name = z.string().trim().min(1).max(120);

export async function createGalaxy(input: { name: string; icon?: string; color?: string }) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_STRUCTURE", []);
  const count = await db.galaxy.count();
  const galaxy = await db.galaxy.create({
    data: { name: name.parse(input.name), icon: input.icon || "🌌", color: input.color || "#7c5cff", position: count },
  });
  revalidatePath("/", "layout");
  return galaxy.id;
}

/** A folder lives in a galaxy, optionally inside a planet and/or another folder. */
export async function createFolder(input: { name: string; galaxyId: string; planetId?: string; parentId?: string }) {
  const user = await requireUser();
  const path = input.parentId
    ? await folderPath(input.parentId)
    : input.planetId
      ? await planetPath(input.planetId)
      : await galaxyPath(input.galaxyId);
  await assertCan(user, "MANAGE_STRUCTURE", path);
  let planetId = input.planetId ?? null;
  if (input.parentId) planetId = (await db.folder.findUniqueOrThrow({ where: { id: input.parentId } })).planetId;
  const folder = await db.folder.create({
    data: { name: name.parse(input.name), galaxyId: input.galaxyId, planetId, parentId: input.parentId ?? null },
  });
  revalidatePath("/", "layout");
  return folder.id;
}

export async function createPlanet(input: { name: string; galaxyId: string; folderId?: string; icon?: string; color?: string }) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_STRUCTURE", input.folderId ? await folderPath(input.folderId) : await galaxyPath(input.galaxyId));
  const planet = await db.planet.create({
    data: {
      name: name.parse(input.name),
      galaxyId: input.galaxyId,
      folderId: input.folderId ?? null,
      icon: input.icon || "🪐",
      color: input.color || "#22d3ee",
      statuses: { create: DEFAULT_STATUSES.map((s, position) => ({ ...s, position })) },
    },
  });
  revalidatePath("/", "layout");
  return planet.id;
}

type Node = { type: "galaxy" | "folder" | "planet"; id: string };

async function nodePath(node: Node) {
  if (node.type === "galaxy") return galaxyPath(node.id);
  if (node.type === "folder") return folderPath(node.id);
  return planetPath(node.id);
}

export async function renameNode(node: Node, newName: string) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_STRUCTURE", await nodePath(node));
  const data = { name: name.parse(newName) };
  if (node.type === "galaxy") await db.galaxy.update({ where: { id: node.id }, data });
  if (node.type === "folder") await db.folder.update({ where: { id: node.id }, data });
  if (node.type === "planet") await db.planet.update({ where: { id: node.id }, data });
  revalidatePath("/", "layout");
}

/** Soft delete — keeps data recoverable and the activity log intact. */
export async function deleteNode(node: Node) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_STRUCTURE", await nodePath(node));
  const data = { deletedAt: new Date() };
  if (node.type === "galaxy") await db.galaxy.update({ where: { id: node.id }, data });
  if (node.type === "folder") await db.folder.update({ where: { id: node.id }, data });
  if (node.type === "planet") await db.planet.update({ where: { id: node.id }, data });
  revalidatePath("/", "layout");
}

/** Drag & drop in the sidebar: move a planet or folder into another folder or galaxy root. */
export async function moveNode(node: Node, target: { galaxyId: string; folderId: string | null }) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_STRUCTURE", await nodePath(node));
  await assertCan(user, "MANAGE_STRUCTURE", target.folderId ? await folderPath(target.folderId) : await galaxyPath(target.galaxyId));
  if (node.type === "planet") {
    await db.planet.update({ where: { id: node.id }, data: { galaxyId: target.galaxyId, folderId: target.folderId } });
  } else if (node.type === "folder") {
    if (target.folderId === node.id || (await isDescendant(target.folderId, node.id))) return;
    await db.folder.update({ where: { id: node.id }, data: { galaxyId: target.galaxyId, parentId: target.folderId } });
    await moveSubtreeToGalaxy(node.id, target.galaxyId);
  }
  revalidatePath("/", "layout");
}

async function isDescendant(folderId: string | null, ancestorId: string): Promise<boolean> {
  for (let id = folderId; id; ) {
    if (id === ancestorId) return true;
    id = (await db.folder.findUnique({ where: { id }, select: { parentId: true } }))?.parentId ?? null;
  }
  return false;
}

/** Keeps galaxyId consistent for everything below a folder that moved to another galaxy. */
async function moveSubtreeToGalaxy(folderId: string, galaxyId: string) {
  const children = await db.folder.findMany({ where: { parentId: folderId }, select: { id: true } });
  await db.folder.updateMany({ where: { parentId: folderId }, data: { galaxyId } });
  await db.planet.updateMany({ where: { folderId }, data: { galaxyId } });
  for (const c of children) await moveSubtreeToGalaxy(c.id, galaxyId);
}
