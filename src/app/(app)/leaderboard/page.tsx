import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { db } from "@/lib/db";
import { activeStreak, DIFFICULTIES, levelFromXp, tbilisiDay, titleForLevel } from "@/lib/game";
import { DIFFICULTY_LABEL, DIFFICULTY_STYLE } from "@/lib/i18n";
import { getDict, getLocale, requireUser } from "@/lib/session";

const PERIODS = { week: 7, month: 30, all: 0 } as const;

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireUser();
  const { period: raw } = await searchParams;
  const period = (raw && raw in PERIODS ? raw : "week") as keyof typeof PERIODS;
  const [t, locale] = [await getDict(), await getLocale()];
  const ka = locale === "ka";
  const since = PERIODS[period] ? new Date(Date.now() - PERIODS[period] * 86_400_000) : new Date(0);

  const [users, events] = await Promise.all([
    db.user.findMany({ where: { deactivatedAt: null, role: { not: "GUEST" } } }),
    db.xpEvent.findMany({ where: { createdAt: { gte: since }, reason: "task_done" }, include: { task: { select: { difficulty: true } } } }),
  ]);
  const today = tbilisiDay(new Date());
  const rows = users
    .map((u) => {
      const mine = events.filter((e) => e.userId === u.id);
      const byDifficulty = Object.fromEntries(DIFFICULTIES.map((d) => [d, mine.filter((e) => e.task?.difficulty === d).length]));
      const level = levelFromXp(u.xp);
      return {
        id: u.id,
        name: u.name ?? u.email.split("@")[0],
        avatar: u.avatar,
        xp: mine.reduce((a, e) => a + e.amount, 0),
        tasks: mine.length,
        byDifficulty,
        level,
        title: titleForLevel(level)[locale],
        streak: activeStreak(u.streak, u.lastStreakDay?.toISOString().slice(0, 10) ?? null, today),
      };
    })
    .sort((a, b) => b.xp - a.xp || b.tasks - a.tasks);

  const podium = rows.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-6 p-2">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold">🏆 {t.leaderboard}</h1>
        <div className="flex rounded-[10px] border border-[var(--border)] p-0.5">
          {(Object.keys(PERIODS) as (keyof typeof PERIODS)[]).map((p) => (
            <Link key={p} href={`/leaderboard?period=${p}`} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${period === p ? "bg-[var(--accent)] text-white" : "muted"}`}>
              {p === "week" ? (ka ? "კვირა" : "Week") : p === "month" ? (ka ? "თვე" : "Month") : ka ? "სულ" : "All time"}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 items-end gap-3">
        {[1, 0, 2].map((i) =>
          podium[i] ? (
            <div key={i} className={`panel pop-in flex flex-col items-center p-4 text-center ${i === 0 ? "border-amber-300/60 pb-8 shadow-[0_0_30px_rgba(251,191,36,.25)]" : ""}`}>
              <div className="text-3xl">{medals[i]}</div>
              <Avatar avatar={podium[i].avatar} size={i === 0 ? 72 : 56} />
              <div className="mt-2 truncate font-bold">{podium[i].name}</div>
              <div className="muted text-xs">
                LV {podium[i].level} · {podium[i].title}
              </div>
              <div className="mt-1 text-xl font-extrabold text-amber-300">🪙 {podium[i].xp}</div>
            </div>
          ) : (
            <div key={i} />
          ),
        )}
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="muted text-left text-xs uppercase">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">{ka ? "კოსმონავტი" : "Astronaut"}</th>
              <th className="p-3">XP</th>
              <th className="p-3">{t.tasksDone}</th>
              <th className="p-3 max-md:hidden">{t.difficulty}</th>
              <th className="p-3">🔥</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <td className="p-3 font-bold">{medals[i] ?? i + 1}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Avatar avatar={r.avatar} size={30} />
                    <div>
                      <div className="font-semibold">{r.name}</div>
                      <div className="muted text-xs">
                        LV {r.level} · {r.title}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-3 font-bold text-amber-300">🪙 {r.xp}</td>
                <td className="p-3">{r.tasks}</td>
                <td className="p-3 max-md:hidden">
                  <div className="flex flex-wrap gap-1">
                    {DIFFICULTIES.filter((d) => r.byDifficulty[d]).map((d) => (
                      <span key={d} className={`chip ${DIFFICULTY_STYLE[d]}`}>
                        {r.byDifficulty[d]}× {DIFFICULTY_LABEL[locale][d]}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-3">{r.streak > 0 ? `🔥 ${r.streak}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
