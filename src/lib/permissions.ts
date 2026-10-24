import type { Permission, Role, ScopeType } from "@prisma/client";
import { DEFAULT_PERMISSIONS } from "./roles";

export type ScopeNode = { type: ScopeType; id: string };
export type Grant = { role: Role; scopeType: ScopeType; scopeId: string };
export type Override = {
  role: Role;
  permission: Permission;
  allowed: boolean;
  scopeType: ScopeType | null;
  scopeId: string | null;
};

const sameNode = (n: ScopeNode, type: ScopeType | null, id: string | null) => n.type === type && n.id === id;

/**
 * The role a user has at a node. `path` is ordered from most specific
 * (planet / inner folder) to least specific (galaxy). The closest grant wins;
 * otherwise the user's global role applies — except guests, who only see
 * places they were explicitly granted.
 */
export function effectiveRole(globalRole: Role, grants: Grant[], path: ScopeNode[]): Role | null {
  if (globalRole === "OWNER") return "OWNER";
  for (const node of path) {
    const grant = grants.find((g) => sameNode(node, g.scopeType, g.scopeId));
    if (grant) return grant.role;
  }
  return globalRole === "GUEST" ? null : globalRole;
}

/** Whether a role has a permission at a node: closest scoped override → global override → default. */
export function roleAllows(role: Role, permission: Permission, overrides: Override[], path: ScopeNode[]): boolean {
  if (role === "OWNER") return true;
  const relevant = overrides.filter((o) => o.role === role && o.permission === permission);
  for (const node of path) {
    const o = relevant.find((r) => sameNode(node, r.scopeType, r.scopeId));
    if (o) return o.allowed;
  }
  const global = relevant.find((r) => r.scopeType === null);
  if (global) return global.allowed;
  return DEFAULT_PERMISSIONS[role].has(permission);
}

export function can(
  user: { role: Role; grants: Grant[] },
  permission: Permission,
  overrides: Override[],
  path: ScopeNode[],
): boolean {
  const role = effectiveRole(user.role, user.grants, path);
  if (!role) return false;
  return roleAllows(role, permission, overrides, path);
}
