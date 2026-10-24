import { describe, expect, it } from "vitest";
import { can, effectiveRole, type RoleDef, type ScopeNode } from "./permissions";

const path: ScopeNode[] = [
  { type: "PLANET", id: "kani-site" },
  { type: "FOLDER", id: "web" },
  { type: "GALAXY", id: "dev" },
];

const roles: RoleDef[] = [
  { id: "admin", permissions: ["VIEW", "DELETE_TASK", "APPROVE_DONE"], scopedOnly: false },
  { id: "member", permissions: ["VIEW", "CHANGE_STATUS"], scopedOnly: false },
  { id: "guest", permissions: ["VIEW"], scopedOnly: true },
  { id: "reviewer", permissions: ["VIEW", "APPROVE_DONE"], scopedOnly: false },
];

const user = (roleId: string, grants = [] as { roleId: string; scopeType: "GALAXY" | "FOLDER" | "PLANET"; scopeId: string }[]) => ({ roleId, isOwner: false, grants });

describe("effectiveRole", () => {
  it("uses the closest grant", () => {
    const u = user("member", [
      { roleId: "admin", scopeType: "GALAXY", scopeId: "dev" },
      { roleId: "guest", scopeType: "PLANET", scopeId: "kani-site" },
    ]);
    expect(effectiveRole(u, roles, path)).toMatchObject({ id: "guest" });
    expect(effectiveRole(u, roles, path.slice(1))).toMatchObject({ id: "admin" });
  });
  it("hides everything from scoped-only roles without a grant", () => {
    expect(effectiveRole(user("guest"), roles, path)).toBeNull();
    expect(effectiveRole(user("guest", [{ roleId: "guest", scopeType: "PLANET", scopeId: "kani-site" }]), roles, path)).toMatchObject({ id: "guest" });
  });
});

describe("can", () => {
  it("uses the role's permissions, including custom roles", () => {
    expect(can(user("member"), "CHANGE_STATUS", roles, [], path)).toBe(true);
    expect(can(user("member"), "APPROVE_DONE", roles, [], path)).toBe(false);
    expect(can(user("reviewer"), "APPROVE_DONE", roles, [], path)).toBe(true);
  });
  it("applies the closest scoped override", () => {
    const overrides = [
      { roleId: "member", permission: "DELETE_TASK" as const, allowed: true, scopeType: "GALAXY" as const, scopeId: "dev" },
      { roleId: "member", permission: "DELETE_TASK" as const, allowed: false, scopeType: "FOLDER" as const, scopeId: "web" },
    ];
    expect(can(user("member"), "DELETE_TASK", roles, overrides, path)).toBe(false);
    expect(can(user("member"), "DELETE_TASK", roles, overrides, [{ type: "PLANET", id: "x" }, { type: "GALAXY", id: "dev" }])).toBe(true);
  });
  it("never locks out the owner", () => {
    expect(can({ roleId: "guest", isOwner: true, grants: [] }, "MANAGE_ROLES", roles, [], path)).toBe(true);
  });
});
