"use client";

import type { TaskCard } from "@/lib/taskQuery";
import { useUi } from "../UiContext";
import { useTaskNav } from "./bits";
import { TaskCardView } from "./TaskCardView";

type Group = { key: string; icon: string; label: string; tasks: TaskCard[] };

/** "My missions": tasks across planets, grouped by deadline urgency or by status kind. */
export function MissionList({ tasks, mode }: { tasks: TaskCard[]; mode: "due" | "status" }) {
  const { t, locale } = useUi();
  const { openTask } = useTaskNav();
  const ka = locale === "ka";
  const groups: Group[] = mode === "due" ? byDue(tasks, t.overdue, t.today, ka) : byKind(tasks, ka);

  if (!tasks.length) return <p className="muted panel p-8 text-center">{ka ? "ყველა მისია შესრულებულია! 🎉" : "All missions complete! 🎉"}</p>;

  return (
    <div className={mode === "status" ? "flex gap-3 overflow-x-auto pb-4" : "space-y-5"}>
      {groups
        .filter((g) => g.tasks.length)
        .map((g) => (
          <section key={g.key} className={mode === "status" ? "w-72 shrink-0 max-md:w-[85vw]" : ""}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
              {g.icon} {g.label} <span className="muted font-normal">{g.tasks.length}</span>
            </h2>
            <div className={mode === "status" ? "flex flex-col gap-2" : "grid gap-2 sm:grid-cols-2 xl:grid-cols-3"}>
              {g.tasks.map((task) => (
                <TaskCardView key={task.id} task={task} showPlanet onOpen={() => openTask(task.id)} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

function byDue(tasks: TaskCard[], overdue: string, today: string, ka: boolean): Group[] {
  const now = new Date();
  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);
  const endWeek = new Date(endToday.getTime() + 6 * 86_400_000);
  const g: Group[] = [
    { key: "overdue", icon: "🔥", label: overdue, tasks: [] },
    { key: "today", icon: "⚡", label: today, tasks: [] },
    { key: "week", icon: "📅", label: ka ? "ამ კვირაში" : "This week", tasks: [] },
    { key: "later", icon: "🔭", label: ka ? "მოგვიანებით" : "Later", tasks: [] },
    { key: "none", icon: "🌀", label: ka ? "დედლაინის გარეშე" : "No deadline", tasks: [] },
  ];
  for (const task of tasks) {
    const d = task.dueDate ? new Date(task.dueDate) : null;
    const i = !d ? 4 : d < now ? 0 : d <= endToday ? 1 : d <= endWeek ? 2 : 3;
    g[i].tasks.push(task);
  }
  for (const x of g) x.tasks.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  return g;
}

function byKind(tasks: TaskCard[], ka: boolean): Group[] {
  const kinds: [string, string, string][] = [
    ["BACKLOG", "🌫️", "Backlog"],
    ["OPEN", "🎯", "To Do"],
    ["ACTIVE", "🚀", "In Progress"],
    ["REVIEW", "🔍", "Review"],
    ["DONE", "✅", "Done"],
  ];
  return kinds.map(([kind, icon, label]) => ({ key: kind, icon, label: ka && kind === "DONE" ? "Done" : label, tasks: tasks.filter((t) => t.statusKind === kind) }));
}
