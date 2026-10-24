import { Avatar } from "@/components/Avatar";
import { ProfileEditor } from "@/components/ProfileEditor";
import { all, col, loadRoles } from "@/lib/data";
import { ACHIEVEMENTS, activeStreak, levelProgress, tbilisiDay, TITLES, titleForLevel } from "@/lib/game";
import { OWNER_META } from "@/lib/roles";
import type { XpEventDoc } from "@/lib/types";
import { getDict, getLocale, requireUser } from "@/lib/session";

export default async function ProfilePage() {
  const user = await requireUser();
  const [t, locale] = [await getDict(), await getLocale()];
  const [events, roles] = await Promise.all([all<XpEventDoc>(col.xpEvents().where("userId", "==", user.id)), loadRoles()]);
  const done = events.filter((e) => e.reason === "task_done").length;
  const p = levelProgress(user.xp);
  const r = roles.find((x) => x.id === user.roleId);
  const role = user.isOwner ? OWNER_META : { icon: r?.icon ?? "", ka: r?.name ?? "", en: r?.nameEn ?? "" };
  const streak = activeStreak(user.streak, user.lastStreakDay, tbilisiDay(new Date()));

  return (
    <div className="space-y-5 p-2">
      <div className="panel flex flex-wrap items-center gap-5 p-5">
        <Avatar avatar={user.avatar} size={96} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <div className="muted text-sm">
            {role.icon} {role[locale]} · {titleForLevel(p.level)[locale]}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="rounded-md bg-[var(--accent)] px-2 py-0.5 text-sm font-extrabold text-white">LV {p.level}</span>
            <div className="h-3 max-w-sm flex-1 overflow-hidden rounded-full bg-[var(--bg-soft)]">
              <div className="xp-bar h-full rounded-full" style={{ width: `${Math.max(3, p.ratio * 100)}%` }} />
            </div>
            <span className="muted text-xs">
              {p.current}/{p.needed} XP
            </span>
          </div>
        </div>
        <div className="flex gap-6 text-center">
          <div>
            <div className="text-2xl font-extrabold text-amber-500">🪙 {user.xp}</div>
            <div className="muted text-xs">XP</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold">{done}</div>
            <div className="muted text-xs">{t.tasksDone}</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-orange-500">🔥 {streak}</div>
            <div className="muted text-xs">
              {t.streak} (max {user.bestStreak})
            </div>
          </div>
        </div>
      </div>

      <section className="panel p-5">
        <h2 className="mb-3 text-sm font-bold">🏅 {t.achievements}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ACHIEVEMENTS.map((a) => {
            const got = user.achievements?.[a.key];
            return (
              <div key={a.key} className={`rounded-xl border p-3 text-center ${got ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] opacity-40 grayscale"}`}>
                <div className="text-3xl">{a.icon}</div>
                <div className="mt-1 text-sm font-bold">{a[locale]}</div>
                <div className="muted text-xs">{locale === "ka" ? a.descKa : a.descEn}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="mb-3 text-sm font-bold">🎖️ {locale === "ka" ? "ტიტულები" : "Titles"}</h2>
        <div className="flex flex-wrap gap-2">
          {TITLES.map((x) => (
            <span key={x.level} className={`chip px-3 py-1 ${p.level >= x.level ? "border-[var(--accent)] text-[var(--accent)]" : "muted border-[var(--border)]"}`}>
              LV {x.level} · {x[locale]}
            </span>
          ))}
        </div>
      </section>

      <section className="panel p-5">
        <ProfileEditor avatar={user.avatar} name={user.name} />
      </section>
    </div>
  );
}
