"use client";

import { useState, useTransition } from "react";
import type { Permission, Role, ScopeType } from "@prisma/client";
import { inviteMember, revokeInvitation, setRolePermission, setUserActive, setUserPhone, setUserRole } from "@/app/actions/admin";
import { PERMISSION_LABEL } from "@/lib/i18n";
import { ROLE_META } from "@/lib/roles";
import { Avatar } from "../Avatar";
import { useGame } from "../Game";
import { playCoin } from "../sound";
import { useUi } from "../UiContext";

export type ScopeOption = { type: ScopeType; id: string; label: string };

const INVITABLE: Role[] = ["ADMIN", "MANAGER", "MEMBER", "GUEST"];

function useRun() {
  const { toast } = useGame();
  const { t } = useUi();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, ok?: string) =>
    start(async () => {
      try {
        await fn();
        if (ok) toast(ok, "info", "✅");
      } catch {
        toast(t.noPermission, "error", "⛔");
      }
    });
  return { run, pending };
}

export function InviteForm({ scopes }: { scopes: ScopeOption[] }) {
  const { t, locale } = useUi();
  const { run, pending } = useRun();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [scope, setScope] = useState("");
  return (
    <form
      className="grid gap-2 sm:grid-cols-[2fr_1fr_1.5fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        const s = scopes.find((x) => `${x.type}:${x.id}` === scope);
        run(async () => {
          await inviteMember({ email, role, scopeType: s?.type ?? null, scopeId: s?.id ?? null });
          setEmail("");
          playCoin();
        }, t.inviteSent);
      }}
    >
      <input className="input" type="email" required placeholder={`✉️ ${t.email}`} value={email} onChange={(e) => setEmail(e.target.value)} />
      <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
        {INVITABLE.map((r) => (
          <option key={r} value={r}>
            {ROLE_META[r].icon} {ROLE_META[r][locale]}
          </option>
        ))}
      </select>
      <select className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
        <option value="">🌍 {t.everywhere}</option>
        {scopes.map((s) => (
          <option key={`${s.type}:${s.id}`} value={`${s.type}:${s.id}`}>
            {s.label}
          </option>
        ))}
      </select>
      <button disabled={pending} className="btn btn-primary justify-center">
        🚀 {t.invite}
      </button>
    </form>
  );
}

export function RevokeInvite({ id }: { id: string }) {
  const { run } = useRun();
  return (
    <button className="muted text-xs hover:text-rose-400" onClick={() => run(() => revokeInvitation(id))}>
      ✕
    </button>
  );
}

export function MemberRow({ m, isOwnerViewer }: { m: { id: string; name: string; email: string; avatar: string; role: Role; phone: string; active: boolean; level: number }; isOwnerViewer: boolean }) {
  const { locale, t } = useUi();
  const { run } = useRun();
  const [phone, setPhone] = useState(m.phone);
  const locked = m.role === "OWNER";
  return (
    <tr className={`border-t border-[var(--border)] ${m.active ? "" : "opacity-40"}`}>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <Avatar avatar={m.avatar} size={30} />
          <div className="min-w-0">
            <div className="truncate font-semibold">
              {m.name} <span className="muted text-xs">LV {m.level}</span>
            </div>
            <div className="muted truncate text-xs">{m.email}</div>
          </div>
        </div>
      </td>
      <td className="p-3">
        {locked ? (
          <span>
            {ROLE_META.OWNER.icon} {ROLE_META.OWNER[locale]}
          </span>
        ) : (
          <select className="input" value={m.role} onChange={(e) => run(() => setUserRole(m.id, e.target.value as Role))}>
            {INVITABLE.filter((r) => r !== "ADMIN" || isOwnerViewer || m.role === "ADMIN").map((r) => (
              <option key={r} value={r}>
                {ROLE_META[r].icon} {ROLE_META[r][locale]}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="p-3 max-md:hidden">
        <input className="input" placeholder="+995 5XX XX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => phone !== m.phone && run(() => setUserPhone(m.id, phone))} />
      </td>
      <td className="p-3 text-right">
        {!locked && (
          <button className="btn btn-ghost text-xs" onClick={() => run(() => setUserActive(m.id, !m.active))}>
            {m.active ? "⏸" : "▶"} <span className="max-sm:hidden">{m.active ? (locale === "ka" ? "გათიშვა" : "Disable") : t.save}</span>
          </button>
        )}
      </td>
    </tr>
  );
}

type Cell = { role: Role; permission: Permission; effective: boolean; override: boolean | null };

export function PermissionMatrix({ cells, roles, permissions, scope }: { cells: Cell[]; roles: Role[]; permissions: Permission[]; scope?: { type: ScopeType; id: string } }) {
  const { locale } = useUi();
  const { run } = useRun();
  const cell = (r: Role, p: Permission) => cells.find((c) => c.role === r && c.permission === p)!;
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="p-3 text-left"></th>
            {roles.map((r) => (
              <th key={r} className="p-3 text-center text-xs">
                <div className="text-xl">{ROLE_META[r].icon}</div>
                {ROLE_META[r][locale]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permissions.map((p) => (
            <tr key={p} className="border-t border-[var(--border)]">
              <td className="p-3 font-medium">{PERMISSION_LABEL[locale][p]}</td>
              {roles.map((r) => {
                const c = cell(r, p);
                const locked = r === "OWNER";
                // Click cycles: inherit → allow → deny → inherit.
                const next = c.override === null ? !c.effective : c.override === !c.effective ? null : !c.override;
                return (
                  <td key={r} className="p-2 text-center">
                    <button
                      disabled={locked}
                      onClick={() => run(() => setRolePermission(r, p, next, scope))}
                      title={c.override === null ? (locale === "ka" ? "მემკვიდრეობით" : "inherited") : locale === "ka" ? "შეცვლილია აქ" : "set here"}
                      className={`h-9 w-9 rounded-lg text-lg transition ${
                        c.effective ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                      } ${c.override !== null ? "ring-2 ring-[var(--accent)]" : ""} ${locked ? "opacity-50" : "hover:scale-110"}`}
                    >
                      {c.effective ? "✓" : "✕"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
