import type { Permission } from "@prisma/client";
import { cache } from "react";
import { db } from "./db";
import { can, effectiveRole, type ScopeNode } from "./permissions";
import type { CurrentUser } from "./session";

export class ForbiddenError extends Error {
  constructor() {
    super("forbidden");
  }
}

export const loadOverrides = cache(() => db.rolePermission.findMany());

/** The whole galaxy/folder/planet structure, loaded once per request (it is small). */
export const loadTree = cache(async () => {
  const [galaxies, folders, planets] = await Promise.all([
    db.galaxy.findMany({ where: { deletedAt: null }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    db.folder.findMany({ where: { deletedAt: null }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    db.planet.findMany({ where: { deletedAt: null }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
  ]);
  return {
    galaxies,
    folders,
    planets,
    folderById: new Map(folders.map((f) => [f.id, f])),
    planetById: new Map(planets.map((p) => [p.id, p])),
  };
});

type Tree = Awaited<ReturnType<typeof loadTree>>;

function folderChain(tree: Tree, folderId: string | null): ScopeNode[] {
  const nodes: ScopeNode[] = [];
  for (let f = folderId ? tree.folderById.get(folderId) : undefined; f; f = f.parentId ? tree.folderById.get(f.parentId) : undefined) {
    nodes.push({ type: "FOLDER", id: f.id });
  }
  return nodes;
}

export function planetPathIn(tree: Tree, planetId: string): ScopeNode[] {
  const planet = tree.planetById.get(planetId);
  if (!planet) return [];
  return [{ type: "PLANET", id: planet.id }, ...folderChain(tree, planet.folderId), { type: "GALAXY", id: planet.galaxyId }];
}

export function folderPathIn(tree: Tree, folderId: string): ScopeNode[] {
  const folder = tree.folderById.get(folderId);
  if (!folder) return [];
  const chain = folderChain(tree, folder.id);
  if (folder.planetId) return [...chain, ...planetPathIn(tree, folder.planetId)];
  return [...chain, { type: "GALAXY", id: folder.galaxyId }];
}

export async function planetPath(planetId: string) {
  return planetPathIn(await loadTree(), planetId);
}

export async function folderPath(folderId: string) {
  return folderPathIn(await loadTree(), folderId);
}

export async function galaxyPath(galaxyId: string): Promise<ScopeNode[]> {
  return [{ type: "GALAXY", id: galaxyId }];
}

export async function taskPath(task: { planetId: string; folderId: string | null }) {
  // A folder inside a planet is more specific than the planet itself.
  return task.folderId ? folderPath(task.folderId) : planetPath(task.planetId);
}

export async function userCan(user: CurrentUser, permission: Permission, path: ScopeNode[]) {
  return can(user, permission, await loadOverrides(), path);
}

export async function assertCan(user: CurrentUser, permission: Permission, path: ScopeNode[]) {
  if (!(await userCan(user, permission, path))) throw new ForbiddenError();
}

export function isAdmin(user: { role: string }) {
  return user.role === "OWNER" || user.role === "ADMIN";
}

/** Planet ids the user may view — scopes lists, search and the home dashboard. */
export async function visiblePlanetIds(user: CurrentUser): Promise<string[]> {
  const [tree, overrides] = await Promise.all([loadTree(), loadOverrides()]);
  return tree.planets
    .filter((p) => {
      const path = planetPathIn(tree, p.id);
      return effectiveRole(user.role, user.grants, path) !== null && can(user, "VIEW", overrides, path);
    })
    .map((p) => p.id);
}
