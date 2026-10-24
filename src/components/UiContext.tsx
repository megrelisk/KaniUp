"use client";

import { createContext, useContext } from "react";
import type { Dict, Locale } from "@/lib/i18n";

export type CrewMember = { id: string; name: string; email: string; avatar: string };

type Ui = { t: Dict; locale: Locale; me: { id: string; role: string }; crew: CrewMember[]; canManageStructure: boolean };

const UiCtx = createContext<Ui | null>(null);

export function UiProvider({ value, children }: { value: Ui; children: React.ReactNode }) {
  return <UiCtx.Provider value={value}>{children}</UiCtx.Provider>;
}

export function useUi() {
  const ui = useContext(UiCtx);
  if (!ui) throw new Error("useUi outside UiProvider");
  return ui;
}
