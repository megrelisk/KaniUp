import type { Permission, ScopeType } from "./types";

export type ScopeNode = { type: ScopeType; id: string };
export type RoleDef = { id: string; permissions: Permission[]; scopedOnly: boolean };
export type Grant = { roleId: string; scopeType: ScopeType; scopeId: string };
export type Override = { roleId: string; permission: Permission; allowed: boolean; scopeType: ScopeType; scopeId: string };
export type Actor = { roleId: string; isOwner: boolean; grants: Grant[] };

export const OWNER = "OWNER" as const;

/**
 * The role a user has at a node. `path` is ordered from most specific
 * (inner folder / planet) to least specific (galaxy). The closest grant wins;
 * otherwise the user's global role applies — unless that role is scoped-only
 * (guests), who see only places they were explicitly granted.
 */
export function effectiveRole(actor: Actor, roles: RoleDef[], path: ScopeNode[]): RoleDef | typeof OWNER | null {
  if (actor.isOwner) return OWNER;
  for (const node of path) {
    const grant = actor.grants.find((g) => g.scopeType === node.type && g.scopeId === node.id);
    if (grant) return roles.find((r) => r.id === grant.roleId) ?? null;
  }
  const global = roles.find((r) => r.id === actor.roleId);
  return !global || global.scopedOnly ? null : global;
}

/** Whether a role has a permission at a node: the closest scoped override wins, else the role's own setting. */
export function roleAllows(role: RoleDef, permission: Permission, overrides: Override[], path: ScopeNode[]): boolean {
  const relevant = overrides.filter((o) => o.roleId === role.id && o.permission === permission);
  for (const node of path) {
    const o = relevant.find((r) => r.scopeType === node.type && r.scopeId === node.id);
    if (o) return o.allowed;
  }
  return role.permissions.includes(permission);
}

export function can(actor: Actor, permission: Permission, roles: RoleDef[], overrides: Override[], path: ScopeNode[]): boolean {
  const role = effectiveRole(actor, roles, path);
  if (role === OWNER) return true;
  if (!role) return false;
  return roleAllows(role, permission, overrides, path);
}
