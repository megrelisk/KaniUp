import { describe, expect, it } from "vitest";
import { can, effectiveRole, type ScopeNode } from "./permissions";

const path: ScopeNode[] = [
  { type: "PLANET", id: "kani-site" },
  { type: "FOLDER", id: "web" },
  { type: "GALAXY", id: "dev" },
];

describe("effectiveRole", () => {
  it("uses the closest grant", () => {
    const grants = [
      { role: "MANAGER" as const, scopeType: "GALAXY" as const, scopeId: "dev" },
      { role: "GUEST" as const, scopeType: "PLANET" as const, scopeId: "kani-site" },
    ];
    expect(effectiveRole("MEMBER", grants, path)).toBe("GUEST");
    expect(effectiveRole("MEMBER", grants, path.slice(1))).toBe("MANAGER");
  });
  it("hides everything from guests without a grant", () => {
    expect(effectiveRole("GUEST", [], path)).toBeNull();
  });
});

describe("can", () => {
  it("falls back to defaults", () => {
    expect(can({ role: "MEMBER", grants: [] }, "CHANGE_STATUS", [], path)).toBe(true);
    expect(can({ role: "MEMBER", grants: [] }, "APPROVE_DONE", [], path)).toBe(false);
  });
  it("applies scoped overrides before global ones", () => {
    const overrides = [
      { role: "MEMBER" as const, permission: "DELETE_TASK" as const, allowed: true, scopeType: null, scopeId: null },
      { role: "MEMBER" as const, permission: "DELETE_TASK" as const, allowed: false, scopeType: "FOLDER" as const, scopeId: "web" },
    ];
    expect(can({ role: "MEMBER", grants: [] }, "DELETE_TASK", overrides, path)).toBe(false);
    expect(can({ role: "MEMBER", grants: [] }, "DELETE_TASK", overrides, [{ type: "GALAXY", id: "marketing" }])).toBe(true);
  });
  it("never locks out the owner", () => {
    const overrides = [{ role: "OWNER" as const, permission: "VIEW" as const, allowed: false, scopeType: null, scopeId: null }];
    expect(can({ role: "OWNER", grants: [] }, "VIEW", overrides, path)).toBe(true);
  });
});
