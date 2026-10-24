"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { ACHIEVEMENTS, titleForLevel } from "@/lib/game";
import { playCash, playCoin, playLevelUp } from "./sound";
import { useUi } from "./UiContext";

type Reward = { userId: string; xp: number; levelUp?: number; achievements: string[] };
type Toast = { id: number; kind: "xp" | "achievement" | "error" | "info"; text: string; icon?: string };

type Game = {
  celebrate: (r: { rewards: Reward[]; streakAchievements: string[] }) => void;
  toast: (text: string, kind?: Toast["kind"], icon?: string) => void;
};

const GameCtx = createContext<Game | null>(null);

export function useGame() {
  const g = useContext(GameCtx);
  if (!g) throw new Error("useGame outside GameProvider");
  return g;
}

let nextId = 1;

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { t, locale, me } = useUi();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [levelUp, setLevelUp] = useState<number | null>(null);

  const toast = useCallback((text: string, kind: Toast["kind"] = "info", icon?: string) => {
    const id = nextId++;
    setToasts((ts) => [...ts, { id, kind, text, icon }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), kind === "achievement" ? 5000 : 3000);
  }, []);

  const celebrate = useCallback<Game["celebrate"]>(
    ({ rewards, streakAchievements }) => {
      const mine = rewards.find((r) => r.userId === me.id);
      const total = rewards.reduce((a, r) => a + r.xp, 0);
      if (total > 0) {
        if (total >= 100) playCash();
        else playCoin();
        toast(mine ? `+${mine.xp} ${t.xpGained}` : `+${total} XP → ${rewards.length} 👩‍🚀`, "xp", "🪙");
      }
      const unlocked = [...(mine?.achievements ?? []), ...streakAchievements];
      for (const key of unlocked) {
        const a = ACHIEVEMENTS.find((x) => x.key === key);
        if (a) toast(`${a[locale]} — ${locale === "ka" ? a.descKa : a.descEn}`, "achievement", a.icon);
      }
      if (mine?.levelUp) {
        setTimeout(playLevelUp, 300);
        setLevelUp(mine.levelUp);
      }
    },
    [me.id, t, locale, toast],
  );

  return (
    <GameCtx.Provider value={{ celebrate, toast }}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex flex-col items-end gap-2">
        {toasts.map((x) => (
          <div
            key={x.id}
            className={`pop-in panel flex items-center gap-2 px-4 py-2.5 text-sm font-semibold shadow-xl ${
              x.kind === "xp" ? "text-amber-300" : x.kind === "achievement" ? "text-fuchsia-300" : x.kind === "error" ? "text-rose-400" : ""
            }`}
          >
            {x.icon && <span className="text-xl">{x.icon}</span>}
            {x.text}
          </div>
        ))}
      </div>
      {levelUp !== null && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={() => setLevelUp(null)}>
          <div className="panel pop-in max-w-sm p-8 text-center">
            <div className="text-6xl">🚀</div>
            <div className="neon-text mt-3 font-[family-name:var(--font-display)] text-3xl font-extrabold">{t.levelUp}</div>
            <div className="mt-2 text-5xl font-extrabold">{levelUp}</div>
            <div className="muted mt-2">{titleForLevel(levelUp)[locale]}</div>
            <button className="btn btn-primary mt-6">OK</button>
          </div>
        </div>
      )}
    </GameCtx.Provider>
  );
}
