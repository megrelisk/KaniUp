import { notFound } from "next/navigation";
import { Board } from "@/components/tasks/Board";
import { Filters } from "@/components/tasks/Filters";
import { PlanetSettings } from "@/components/tasks/PlanetSettings";
import { TaskPanel } from "@/components/tasks/TaskPanel";
import { Live } from "@/components/Live";
import { planetPath, userCan, visiblePlanetIds } from "@/lib/access";
import { loadTree } from "@/lib/data";
import { loadPanelTask } from "@/lib/panel";
import { getLocale, requireUser } from "@/lib/session";
import { searchTasks, taskFilterSchema } from "@/lib/taskQuery";

export default async function PlanetPage({ params, searchParams }: { params: Promise<{ planetId: string }>; searchParams: Promise<Record<string, string>> }) {
  const { planetId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const locale = await getLocale();
  const tree = await loadTree();
  const planet = tree.planetById.get(planetId);
  const path = await planetPath(planetId);
  if (!planet || !(await userCan(user, "VIEW", path))) notFound();
  const galaxy = tree.galaxies.find((g) => g.id === planet.galaxyId);
  const folder = planet.folderId ? tree.folderById.get(planet.folderId) : undefined;

  const filters = taskFilterSchema.parse({ ...sp, planetId });
  const [tasks, panel, canStatuses, canFields] = await Promise.all([
    searchTasks({ ...filters, status: undefined }, await visiblePlanetIds(user), user.id),
    sp.task ? loadPanelTask(user, sp.task, locale) : null,
    userCan(user, "MANAGE_STATUSES", path),
    userCan(user, "MANAGE_FIELDS", path),
  ]);
  const statuses = [...planet.statuses].sort((a, b) => a.position - b.position);
  const view = sp.view === "list" ? "list" : "board";
  // The status filter narrows which columns / groups are shown.
  const shown = filters.status ? statuses.filter((s) => s.id === filters.status || s.kind === filters.status) : statuses;

  return (
    <div className="space-y-4 p-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-4xl">{planet.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="muted text-xs">
            {galaxy?.icon} {galaxy?.name}
            {folder && ` / ☀️ ${folder.name}`}
          </div>
          <h1 className="text-2xl font-bold">{planet.name}</h1>
        </div>
        {(canStatuses || canFields) && (
          <PlanetSettings planetId={planetId} statuses={statuses} fields={planet.customFields} canStatuses={canStatuses} canFields={canFields} />
        )}
      </div>
      <Filters statuses={statuses.map((s) => ({ id: s.id, name: s.name }))} />
      <Board key={view} layout={view} planetId={planetId} statuses={shown.map(({ id, name, color, kind }) => ({ id, name, color, kind }))} tasks={tasks} />
      {panel && <TaskPanel task={panel} />}
      <Live keys={[`planet-${planetId}`, "structure"]} />
    </div>
  );
}
