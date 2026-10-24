import type { ScopeOption } from "@/components/admin/AdminUi";
import { loadTree } from "./data";

/** Every galaxy / solar system / planet as a pickable scope for invites and permissions. */
export async function scopeOptions(): Promise<ScopeOption[]> {
  const tree = await loadTree();
  return [
    ...tree.galaxies.map((g) => ({ type: "GALAXY" as const, id: g.id, label: `${g.icon} ${g.name}` })),
    ...tree.folders.map((f) => ({ type: "FOLDER" as const, id: f.id, label: `☀️ ${f.name}` })),
    ...tree.planets.map((p) => ({ type: "PLANET" as const, id: p.id, label: `${p.icon} ${p.name}` })),
  ];
}
