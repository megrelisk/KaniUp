import "server-only";
import { loadOverrides, loadRoles, loadTree, type Tree } from "./data";
import { can, effectiveRole, OWNER, type ScopeNode } from "./permissions";
import type { CurrentUser } from "./session";
import type { Permission, ScopeType } from "./types";

export class ForbiddenError extends Error {
  constructor() {
    super("forbidden");
  }
}

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

export async function scopePath(type: ScopeType | "ROOT", id?: string | null): Promise<ScopeNode[]> {
  if (type === "ROOT" || !id) return [];
  const tree = await loadTree();
  if (type === "GALAXY") return [{ type, id }];
  if (type === "FOLDER") return folderPathIn(tree, id);
  return planetPathIn(tree, id);
}

export const planetPath = (id: string) => scopePath("PLANET", id);
export const folderPath = (id: string) => scopePath("FOLDER", id);
export const galaxyPath = (id: string) => scopePath("GALAXY", id);

/** A folder inside a planet is more specific than the planet itself. */
export const taskPath = (task: { planetId: string; folderId: string | null }) => (task.folderId ? folderPath(task.folderId) : planetPath(task.planetId));

export async function userCan(user: CurrentUser, permission: Permission, path: ScopeNode[]) {
  const [roles, overrides] = await Promise.all([loadRoles(), loadOverrides()]);
  return can(user, permission, roles, overrides, path);
}

export async function assertCan(user: CurrentUser, permission: Permission, path: ScopeNode[]) {
  if (!(await userCan(user, permission, path))) throw new ForbiddenError();
}

/** Admin areas (crew, roles) are for owners and roles that may manage roles. */
export async function isAdmin(user: CurrentUser) {
  return user.isOwner || (await userCan(user, "MANAGE_ROLES", []));
}

/** Planet ids the user may view — scopes lists, search and the home dashboard. */
export async function visiblePlanetIds(user: CurrentUser): Promise<string[]> {
  const [tree, roles, overrides] = await Promise.all([loadTree(), loadRoles(), loadOverrides()]);
  return tree.planets
    .filter((p) => {
      const path = planetPathIn(tree, p.id);
      const role = effectiveRole(user, roles, path);
      return role === OWNER || (role !== null && can(user, "VIEW", roles, overrides, path));
    })
    .map((p) => p.id);
}
