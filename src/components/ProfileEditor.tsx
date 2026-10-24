"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/app/actions/prefs";
import { AVATARS } from "@/lib/game";
import { Avatar } from "./Avatar";
import { playCoin } from "./sound";
import { useUi } from "./UiContext";

export function ProfileEditor({ avatar, name }: { avatar: string; name: string }) {
  const { t, locale } = useUi();
  const [current, setCurrent] = useState(avatar);
  const [n, setN] = useState(name);
  const [, start] = useTransition();
  return (
    <div className="space-y-4">
      <label className="block max-w-sm text-sm">
        <span className="muted text-xs">{t.name}</span>
        <input className="input mt-1" value={n} onChange={(e) => setN(e.target.value)} onBlur={() => n !== name && start(() => updateProfile({ name: n }))} />
      </label>
      <h2 className="text-sm font-bold">{t.chooseAvatar}</h2>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-10">
        {AVATARS.map((a) => (
          <button
            key={a.key}
            title={a[locale]}
            onClick={() => {
              setCurrent(a.key);
              playCoin();
              start(() => updateProfile({ avatar: a.key }));
            }}
            className={`flex flex-col items-center gap-1 rounded-xl p-2 transition hover:bg-[var(--bg-soft)] ${current === a.key ? "bg-[var(--bg-soft)] ring-2 ring-[var(--accent)]" : ""}`}
          >
            <Avatar avatar={a.key} size={48} />
            <span className="muted truncate text-[10px]">{a[locale]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
