"use client";

import { useState, useTransition } from "react";
import {
  createRole,
  deleteRole,
  inviteMember,
  revokeInvitation,
  setGrant,
  setRolePermission,
  setUserActive,
  setUserPhone,
  setUserRole,
  updateRole,
} from "@/app/actions/admin";
import { PERMISSION_LABEL } from "@/lib/i18n";
import { OWNER_META } from "@/lib/roles";
import type { Permission, ScopeType } from "@/lib/types";
import { Avatar } from "../Avatar";
import { useGame } from "../Game";
import { playCoin } from "../sound";
import { useUi, type RoleInfo } from "../UiContext";

export type ScopeOption = { type: ScopeType; id: string; label: string };

function useRun() {
  const { toast } = useGame();
  const { t } = useUi();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, ok?: string) =>
    start(async () => {
      try {
        await fn();
        if (ok) toast(ok, "info", "✅");
      } catch (err) {
        toast(String(err).includes("role_in_use") ? t.roleInUse : t.noPermission, "error", "⛔");
      }
    });
  return { run, pending };
}

function roleLabel(r: RoleInfo | undefined, locale: "ka" | "en") {
  return r ? `${r.icon} ${locale === "ka" ? r.name : r.nameEn}` : "?";
}

function RoleSelect({ value, onChange, className = "input" }: { value: string; onChange: (id: string) => void; className?: string }) {
  const { roles, locale } = useUi();
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      {roles.map((r) => (
        <option key={r.id} value={r.id}>
          {roleLabel(r, locale)}
        </option>
      ))}
    </select>
  );
}

export function InviteForm({ scopes }: { scopes: ScopeOption[] }) {
  const { t, roles } = useUi();
  const { run, pending } = useRun();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles.find((r) => r.id === "astronaut")?.id ?? roles[0]?.id ?? "");
  const [scope, setScope] = useState("");
  return (
    <form
      className="grid gap-2 sm:grid-cols-[2fr_1fr_1.5fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        const s = scopes.find((x) => `${x.type}:${x.id}` === scope);
        run(async () => {
          await inviteMember({ email, roleId, scopeType: s?.type ?? null, scopeId: s?.id ?? null });
          setEmail("");
          playCoin();
        }, t.inviteSent);
      }}
    >
      <input className="input" type="email" required placeholder={`✉️ ${t.email}`} value={email} onChange={(e) => setEmail(e.target.value)} />
      <RoleSelect value={roleId} onChange={setRoleId} />
      <ScopeSelect scopes={scopes} value={scope} onChange={setScope} />
      <button disabled={pending} className="btn btn-primary justify-center">
        🚀 {t.invite}
      </button>
    </form>
  );
}

function ScopeSelect({ scopes, value, onChange, allowEverywhere = true }: { scopes: ScopeOption[]; value: string; onChange: (v: string) => void; allowEverywhere?: boolean }) {
  const { t } = useUi();
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEverywhere && <option value="">🌍 {t.everywhere}</option>}
      {scopes.map((s) => (
        <option key={`${s.type}:${s.id}`} value={`${s.type}:${s.id}`}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

export function RevokeInvite({ id }: { id: string }) {
  const { run } = useRun();
  return (
    <button className="muted text-xs hover:text-rose-500" onClick={() => run(() => revokeInvitation(id))}>
      ✕
    </button>
  );
}

export type MemberInfo = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  roleId: string;
  isOwner: boolean;
  phone: string;
  active: boolean;
  level: number;
  grants: { roleId: string; scopeType: ScopeType; scopeId: string }[];
};

export function MemberRow({ m, scopes }: { m: MemberInfo; scopes: ScopeOption[] }) {
  const { locale, t, roles } = useUi();
  const { run } = useRun();
  const [phone, setPhone] = useState(m.phone);
  const [showAccess, setShowAccess] = useState(false);
  const [newScope, setNewScope] = useState(scopes[0] ? `${scopes[0].type}:${scopes[0].id}` : "");
  const [newRole, setNewRole] = useState(roles[0]?.id ?? "");
  const label = (type: string, id: string) => scopes.find((s) => s.type === type && s.id === id)?.label ?? "?";
  return (
    <>
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
          {m.isOwner ? <span>{OWNER_META.icon} {OWNER_META[locale]}</span> : <RoleSelect value={m.roleId} onChange={(id) => run(() => setUserRole(m.id, id))} />}
        </td>
        <td className="p-3 max-md:hidden">
          <input className="input" placeholder="+995 5XX XX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => phone !== m.phone && run(() => setUserPhone(m.id, phone))} />
        </td>
        <td className="p-3 text-right whitespace-nowrap">
          {!m.isOwner && (
            <>
              <button className="btn btn-ghost mr-1 text-xs" onClick={() => setShowAccess((s) => !s)}>
                🔑 {t.access} {m.grants.length > 0 && `(${m.grants.length})`}
              </button>
              <button className="btn btn-ghost text-xs" onClick={() => run(() => setUserActive(m.id, !m.active))}>
                {m.active ? "⏸" : "▶"}
              </button>
            </>
          )}
        </td>
      </tr>
      {showAccess && (
        <tr>
          <td colSpan={4} className="bg-[var(--bg-soft)] p-3">
            <div className="space-y-2 text-sm">
              {m.grants.map((g) => (
                <div key={`${g.scopeType}:${g.scopeId}`} className="flex items-center gap-2">
                  <span className="flex-1">{label(g.scopeType, g.scopeId)}</span>
                  <RoleSelect className="input w-56" value={g.roleId} onChange={(id) => run(() => setGrant(m.id, g.scopeType, g.scopeId, id))} />
                  <button className="muted hover:text-rose-500" onClick={() => run(() => setGrant(m.id, g.scopeType, g.scopeId, null))}>
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-48 flex-1">
                  <ScopeSelect scopes={scopes} value={newScope} onChange={setNewScope} allowEverywhere={false} />
                </div>
                <RoleSelect className="input w-56" value={newRole} onChange={setNewRole} />
                <button
                  className="btn btn-primary text-xs"
                  onClick={() => {
                    const [type, id] = newScope.split(":") as [ScopeType, string];
                    if (id) run(() => setGrant(m.id, type, id, newRole));
                  }}
                >
                  ＋
                </button>
              </div>
              <p className="muted text-xs">{locale === "ka" ? "აქ მითითებული როლი მოქმედებს მხოლოდ ამ ადგილას და აქვს უპირატესობა ძირითად როლთან შედარებით." : "A role here applies only in that place and overrides the member's main role."}</p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

type Cell = { roleId: string; permission: Permission; effective: boolean; override: boolean | null };

export function PermissionMatrix({ cells, permissions, scope }: { cells: Cell[]; permissions: Permission[]; scope?: { type: ScopeType; id: string } }) {
  const { locale, roles, t } = useUi();
  const { run } = useRun();
  const cell = (r: string, p: Permission) => cells.find((c) => c.roleId === r && c.permission === p)!;
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="p-3 text-left"></th>
            {roles.map((r) => (
              <th key={r.id} className="min-w-28 p-3 text-center text-xs align-bottom">
                <RoleHeader role={r} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permissions.map((p) => (
            <tr key={p} className="border-t border-[var(--border)]">
              <td className="p-3 font-medium">{PERMISSION_LABEL[locale][p]}</td>
              {roles.map((r) => {
                const c = cell(r.id, p);
                // Without a scope, a click flips the role itself. With a scope it cycles inherit → flip → inherit.
                const next = !scope ? !c.effective : c.override === null ? !c.effective : null;
                return (
                  <td key={r.id} className="p-2 text-center">
                    <button
                      onClick={() => run(() => setRolePermission(r.id, p, next, scope))}
                      title={scope && c.override === null ? (locale === "ka" ? "მემკვიდრეობით" : "inherited") : ""}
                      className={`h-9 w-9 rounded-lg text-base transition hover:scale-105 ${c.effective ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/10 text-rose-500"} ${
                        c.override !== null ? "ring-2 ring-[var(--accent)]" : ""
                      }`}
                    >
                      {c.effective ? "✓" : "✕"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t border-[var(--border)]">
            <td className="muted p-3 text-xs">{t.guestOnly}</td>
            {roles.map((r) => (
              <td key={r.id} className="p-2 text-center">
                <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={r.scopedOnly} disabled={!!scope} onChange={(e) => run(() => updateRole(r.id, { scopedOnly: e.target.checked }))} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function RoleHeader({ role }: { role: RoleInfo }) {
  const { locale } = useUi();
  const { run } = useRun();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(role.name);
  const [nameEn, setNameEn] = useState(role.nameEn);
  const [icon, setIcon] = useState(role.icon);
  if (edit)
    return (
      <div className="space-y-1 text-left font-normal">
        <input className="input px-2 py-1 text-xs" value={icon} onChange={(e) => setIcon(e.target.value)} />
        <input className="input px-2 py-1 text-xs" value={name} onChange={(e) => setName(e.target.value)} placeholder="ქართ." />
        <input className="input px-2 py-1 text-xs" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="EN" />
        <div className="flex gap-1">
          <button className="btn btn-primary px-2 py-1 text-xs" onClick={() => (setEdit(false), run(() => updateRole(role.id, { name, nameEn, icon })))}>
            ✓
          </button>
          <button className="btn btn-ghost px-2 py-1 text-xs text-rose-500" onClick={() => confirm("Delete role?") && run(() => deleteRole(role.id))}>
            🗑️
          </button>
        </div>
      </div>
    );
  return (
    <button className="group" onClick={() => setEdit(true)}>
      <div className="text-xl">{role.icon}</div>
      {locale === "ka" ? role.name : role.nameEn}
      <span className="muted ml-1 opacity-0 group-hover:opacity-100">✏️</span>
    </button>
  );
}

export function NewRoleForm() {
  const { t } = useUi();
  const { run } = useRun();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [icon, setIcon] = useState("🚀");
  if (!open)
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        ＋ {t.newRole}
      </button>
    );
  return (
    <form
      className="panel flex flex-wrap items-center gap-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await createRole({ name, nameEn, icon });
          setOpen(false);
          setName("");
          setNameEn("");
        });
      }}
    >
      <input className="input w-16" value={icon} onChange={(e) => setIcon(e.target.value)} />
      <input className="input w-48" required placeholder="სახელი" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input w-48" placeholder="Name (EN)" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
      <button className="btn btn-primary">{t.create}</button>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
        {t.cancel}
      </button>
    </form>
  );
}

export { roleLabel };
