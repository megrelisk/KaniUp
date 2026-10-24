import { notFound } from "next/navigation";
import { InviteForm, MemberRow, RevokeInvite } from "@/components/admin/AdminUi";
import { isAdmin } from "@/lib/access";
import { all, col, loadRoles, loadUsers, now } from "@/lib/data";
import { formatDateTime } from "@/lib/dates";
import { levelFromXp } from "@/lib/game";
import { scopeOptions } from "@/lib/scopes";
import { getDict, getLocale, requireUser } from "@/lib/session";
import type { GrantDoc, InvitationDoc } from "@/lib/types";

export default async function CrewPage() {
  const user = await requireUser();
  if (!(await isAdmin(user))) notFound();
  const [t, locale] = [await getDict(), await getLocale()];
  const [members, invites, grants, roles, scopes] = await Promise.all([
    loadUsers(),
    all<InvitationDoc>(col.invitations()),
    all<GrantDoc>(col.grants()),
    loadRoles(),
    scopeOptions(),
  ]);
  const pending = invites.filter((i) => !i.acceptedAt && i.expiresAt > now()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const scopeLabel = (type: string | null, id: string | null) => scopes.find((s) => s.type === type && s.id === id)?.label ?? `🌍 ${t.everywhere}`;
  const roleName = (id: string) => {
    const r = roles.find((x) => x.id === id);
    return r ? `${r.icon} ${locale === "ka" ? r.name : r.nameEn}` : "?";
  };

  return (
    <div className="space-y-5 p-2">
      <h1 className="text-2xl font-bold">🛰️ {t.crew}</h1>
      <section className="panel space-y-3 p-5">
        <h2 className="text-sm font-bold">🚀 {t.invite}</h2>
        <InviteForm scopes={scopes} />
        {pending.length > 0 && (
          <div className="space-y-1 pt-2">
            <h3 className="muted text-xs font-bold uppercase">{t.pendingInvites}</h3>
            {pending.map((i) => (
              <div key={i.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1 truncate">✉️ {i.email}</span>
                <span className="muted text-xs">
                  {roleName(i.roleId)} · {scopeLabel(i.scopeType, i.scopeId)} · ⏳ {formatDateTime(i.expiresAt, locale)}
                </span>
                <RevokeInvite id={i.id} />
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="muted text-left text-xs uppercase">
            <tr>
              <th className="p-3">{t.members}</th>
              <th className="p-3">{t.role}</th>
              <th className="p-3 max-md:hidden">📱 {t.phone}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <MemberRow
                key={m.id}
                scopes={scopes}
                m={{
                  id: m.id,
                  name: m.name,
                  email: m.email,
                  avatar: m.avatar,
                  roleId: m.roleId,
                  isOwner: m.isOwner,
                  phone: m.phone ?? "",
                  active: !m.deactivatedAt,
                  level: levelFromXp(m.xp),
                  grants: grants.filter((g) => g.userId === m.id).map(({ roleId, scopeType, scopeId }) => ({ roleId, scopeType, scopeId })),
                }}
              />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
