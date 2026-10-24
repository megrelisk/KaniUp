"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { useEffect, useState } from "react";
import { setLocale, setTheme } from "@/app/actions/prefs";
import { Avatar } from "./Avatar";
import { Sidebar, type GalaxyNode } from "./Sidebar";
import { isMuted, setMuted } from "./sound";
import { useUi } from "./UiContext";

type Me = { name: string; avatar: string; xp: number; level: number; current: number; needed: number; title: string; streak: number; isAdmin: boolean };

export function Shell({ galaxies, me, theme, children }: { galaxies: GalaxyNode[]; me: Me; theme: string; children: React.ReactNode }) {
  const { t, locale } = useUi();
  const [drawer, setDrawer] = useState(false);
  const [muted, setMutedState] = useState(false);
  const router = useRouter();
  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    await signOut(clientAuth()).catch(() => {});
    router.replace("/login");
  }
  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  return (
    <div className="flex h-dvh">
      <aside className="panel m-2 mr-0 hidden w-64 shrink-0 flex-col md:flex">
        <Logo />
        <Sidebar galaxies={galaxies} />
        {me.isAdmin && <AdminLinks />}
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={() => setDrawer(false)}>
          <aside className="panel slide-in absolute top-0 bottom-0 left-0 flex w-72 flex-col rounded-l-none" onClick={(e) => e.stopPropagation()}>
            <Logo />
            <Sidebar galaxies={galaxies} onNavigate={() => setDrawer(false)} />
            {me.isAdmin && <AdminLinks onNavigate={() => setDrawer(false)} />}
            <button className="muted border-t border-[var(--border)] p-4 text-left text-sm" onClick={logout}>
              ⏻ {t.signOut}
            </button>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="panel m-2 flex items-center gap-3 px-3 py-2">
          <button className="btn btn-ghost px-2.5 md:hidden" onClick={() => setDrawer(true)} aria-label="menu">
            ☰
          </button>
          <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar avatar={me.avatar} size={38} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 text-sm">
                <span className="truncate font-semibold">{me.name}</span>
                <span className="muted hidden truncate text-xs sm:inline">{me.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-[var(--accent)] px-1.5 text-[10px] font-extrabold text-white">LV {me.level}</span>
                <div className="h-2 max-w-64 flex-1 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                  <div className="xp-bar h-full rounded-full" style={{ width: `${Math.max(3, (me.current / me.needed) * 100)}%` }} />
                </div>
                <span className="muted hidden text-[11px] sm:inline">
                  {me.current}/{me.needed} XP
                </span>
              </div>
            </div>
          </Link>
          {me.streak > 0 && (
            <span className="chip border-orange-500/40 text-orange-500" title={t.streak}>
              🔥 {me.streak}
            </span>
          )}
          <button
            className="btn btn-ghost px-2.5"
            title="sound"
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button className="btn btn-ghost px-2.5" title={t.theme} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
          <button className="btn btn-ghost px-2.5 text-xs" title={t.language} onClick={() => setLocale(locale === "ka" ? "en" : "ka")}>
            {locale === "ka" ? "EN" : "ქა"}
          </button>
          <button className="btn btn-ghost hidden px-2.5 sm:inline-flex" title={t.signOut} onClick={logout}>
            ⏻
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-auto px-2 pb-2">{children}</main>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 px-4 pt-4 pb-2">
      <span className="text-2xl">🪐</span>
      <span className="brand font-[family-name:var(--font-display)] text-xl font-extrabold">KaniUp</span>
    </Link>
  );
}

function AdminLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useUi();
  return (
    <div className="border-t border-[var(--border)] p-3 text-sm">
      <Link href="/admin" onClick={onNavigate} className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-[var(--bg-soft)]">
        🛰️ {t.crew}
      </Link>
      <Link href="/admin/roles" onClick={onNavigate} className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-[var(--bg-soft)]">
        🔐 {t.roles}
      </Link>
    </div>
  );
}
