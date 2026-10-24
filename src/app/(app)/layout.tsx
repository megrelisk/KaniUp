import { cookies } from "next/headers";
import { signOut } from "@/auth";
import { GameProvider } from "@/components/Game";
import { Shell } from "@/components/Shell";
import type { FolderNode, GalaxyNode, PlanetNode } from "@/components/Sidebar";
import { UiProvider } from "@/components/UiContext";
import { isAdmin, loadTree, userCan, visiblePlanetIds } from "@/lib/access";
import { db } from "@/lib/db";
import { activeStreak, levelProgress, tbilisiDay, titleForLevel } from "@/lib/game";
import { getDict, getLocale, requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [t, locale, tree, visible, crew, theme] = await Promise.all([
    getDict(),
    getLocale(),
    loadTree(),
    visiblePlanetIds(user),
    db.user.findMany({ where: { deactivatedAt: null }, orderBy: { name: "asc" } }),
    cookies().then((c) => (c.get("theme")?.value === "light" ? "light" : "dark")),
  ]);
  const canManageStructure = await userCan(user, "MANAGE_STRUCTURE", []);

  const openCounts = await db.task.groupBy({
    by: ["planetId"],
    where: { deletedAt: null, parentId: null, completedAt: null, planetId: { in: visible } },
    _count: true,
  });
  const openBy = new Map(openCounts.map((c) => [c.planetId, c._count]));
  const visibleSet = new Set(visible);

  const planetNode = (p: (typeof tree.planets)[number]): PlanetNode => ({ id: p.id, name: p.name, icon: p.icon, color: p.color, open: openBy.get(p.id) ?? 0 });
  // Sidebar folders are the galaxy-level "solar systems"; folders inside planets show on the planet page.
  const buildFolder = (id: string): FolderNode | null => {
    const f = tree.folderById.get(id)!;
    const folders = tree.folders.filter((c) => c.parentId === id && !c.planetId).map((c) => buildFolder(c.id)).filter((x): x is FolderNode => !!x);
    const planets = tree.planets.filter((p) => p.folderId === id && visibleSet.has(p.id)).map(planetNode);
    if (!canManageStructure && !folders.length && !planets.length) return null;
    return { id: f.id, name: f.name, folders, planets };
  };
  const galaxies: GalaxyNode[] = tree.galaxies
    .map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      color: g.color,
      folders: tree.folders.filter((f) => f.galaxyId === g.id && !f.parentId && !f.planetId).map((f) => buildFolder(f.id)).filter((x): x is FolderNode => !!x),
      planets: tree.planets.filter((p) => p.galaxyId === g.id && !p.folderId && visibleSet.has(p.id)).map(planetNode),
    }))
    .filter((g) => canManageStructure || g.folders.length || g.planets.length);

  const progress = levelProgress(user.xp);
  return (
    <UiProvider
      value={{
        t,
        locale,
        me: { id: user.id, role: user.role },
        crew: crew.map((u) => ({ id: u.id, name: u.name ?? u.email.split("@")[0], email: u.email, avatar: u.avatar })),
        canManageStructure,
      }}
    >
      <GameProvider>
        <Shell
          galaxies={galaxies}
          theme={theme}
          me={{
            name: user.name ?? user.email.split("@")[0],
            avatar: user.avatar,
            xp: user.xp,
            level: progress.level,
            current: progress.current,
            needed: progress.needed,
            title: titleForLevel(progress.level)[locale],
            streak: activeStreak(user.streak, user.lastStreakDay?.toISOString().slice(0, 10) ?? null, tbilisiDay(new Date())),
            isAdmin: isAdmin(user),
          }}
          signOut={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          {children}
        </Shell>
      </GameProvider>
    </UiProvider>
  );
}
