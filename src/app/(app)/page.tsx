import Link from "next/link";
import { Filters } from "@/components/tasks/Filters";
import { MissionList } from "@/components/tasks/MissionList";
import { TaskPanel } from "@/components/tasks/TaskPanel";
import { Live } from "@/components/Live";
import { visiblePlanetIds } from "@/lib/access";
import { all, col } from "@/lib/data";
import { levelProgress } from "@/lib/game";
import { loadPanelTask } from "@/lib/panel";
import { getDict, getLocale, requireUser } from "@/lib/session";
import { searchTasks, taskFilterSchema } from "@/lib/taskQuery";
import type { XpEventDoc } from "@/lib/types";

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const [t, locale] = [await getDict(), await getLocale()];
  const showDone = sp.done === "1";
  const filters = taskFilterSchema.parse({ assignee: "me", ...sp, open: showDone ? undefined : true });
  const visible = await visiblePlanetIds(user);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [tasks, inReview, events, panel] = await Promise.all([
    searchTasks(filters, visible, user.id),
    searchTasks({ assignee: "me", status: "REVIEW" }, visible, user.id),
    all<XpEventDoc>(col.xpEvents().where("userId", "==", user.id)),
    sp.task ? loadPanelTask(user, sp.task, locale) : null,
  ]);
  const weekXp = events.filter((e) => e.createdAt >= weekAgo).reduce((a, e) => a + e.amount, 0);
  const p = levelProgress(user.xp);
  const overdue = tasks.filter((x) => x.dueDate && new Date(x.dueDate) < new Date() && !x.completedAt).length;
  const ka = locale === "ka";
  const mode = sp.view === "board" ? "status" : "due";

  return (
    <div className="space-y-5 p-2">
      <h1 className="text-2xl font-bold">
        🎯 {t.home}
        <span className="muted ml-2 text-base font-normal">{ka ? `გამარჯობა, ${user.name}!` : `Hi, ${user.name}!`}</span>
      </h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="🪐" label={ka ? "აქტიური მისიები" : "Active missions"} value={tasks.filter((x) => !x.completedAt).length} />
        <Stat icon="🔥" label={t.overdue} value={overdue} danger={overdue > 0} />
        <Stat icon="🔍" label={ka ? "რივიუზე" : "In review"} value={inReview.length} />
        <Stat icon="🪙" label={ka ? "XP ამ კვირაში" : "XP this week"} value={weekXp} sub={`LV ${p.level}`} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <Filters showView defaultView="list" />
        </div>
        <Link href={showDone ? "/" : "/?done=1"} className="btn btn-ghost text-xs">
          {showDone ? "🙈" : "👁️"} Done
        </Link>
      </div>
      <MissionList tasks={tasks} mode={mode} />
      {panel && <TaskPanel task={panel} />}
      <Live keys={["home"]} />
    </div>
  );
}

function Stat({ icon, label, value, sub, danger }: { icon: string; label: string; value: number; sub?: string; danger?: boolean }) {
  return (
    <div className={`panel p-4 ${danger ? "border-rose-500/50" : ""}`}>
      <div className="muted flex items-center gap-1.5 text-xs">
        {icon} {label}
      </div>
      <div className={`mt-1 text-3xl font-extrabold ${danger ? "text-rose-400" : ""}`}>
        {value}
        {sub && <span className="muted ml-2 text-sm font-semibold">{sub}</span>}
      </div>
    </div>
  );
}
