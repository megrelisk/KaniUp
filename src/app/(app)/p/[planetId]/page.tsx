import { notFound } from "next/navigation";
import { Board } from "@/components/tasks/Board";
import { Filters } from "@/components/tasks/Filters";
import { TaskPanel } from "@/components/tasks/TaskPanel";
import { planetPath, userCan, visiblePlanetIds } from "@/lib/access";
import { db } from "@/lib/db";
import { loadPanelTask } from "@/lib/panel";
import { getLocale, requireUser } from "@/lib/session";
import { buildTaskWhere, findTasks, taskFilterSchema } from "@/lib/taskQuery";

export default async function PlanetPage({ params, searchParams }: { params: Promise<{ planetId: string }>; searchParams: Promise<Record<string, string>> }) {
  const { planetId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const locale = await getLocale();
  const planet = await db.planet.findFirst({ where: { id: planetId, deletedAt: null }, include: { galaxy: true, folder: true } });
  if (!planet || !(await userCan(user, "VIEW", await planetPath(planetId)))) notFound();

  const filters = taskFilterSchema.parse({ ...sp, planetId });
  // Status filter is shown as columns on the board, so it narrows tasks only in list view.
  const where = buildTaskWhere(filters, await visiblePlanetIds(user), user.id);
  const [statuses, tasks, panel] = await Promise.all([
    db.status.findMany({ where: { planetId }, orderBy: { position: "asc" } }),
    findTasks({ AND: [where, { parentId: null }] }),
    sp.task ? loadPanelTask(user, sp.task, locale) : null,
  ]);
  const view = sp.view === "list" ? "list" : "board";
  const shown = filters.status ? statuses.filter((s) => s.id === filters.status || s.kind === filters.status) : statuses;

  return (
    <div className="space-y-4 p-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-4xl drop-shadow-[0_0_12px_var(--glow)]">{planet.icon}</div>
        <div>
          <div className="muted text-xs">
            {planet.galaxy.icon} {planet.galaxy.name}
            {planet.folder && ` / ☀️ ${planet.folder.name}`}
          </div>
          <h1 className="text-2xl font-bold">{planet.name}</h1>
        </div>
      </div>
      <Filters statuses={statuses.map((s) => ({ id: s.id, name: s.name }))} />
      <Board key={view} layout={view} planetId={planetId} statuses={shown.map((s) => ({ id: s.id, name: s.name, color: s.color, kind: s.kind }))} tasks={tasks} />
      {panel && <TaskPanel task={panel} />}
    </div>
  );
}
