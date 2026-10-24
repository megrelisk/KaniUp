import { notFound } from "next/navigation";
import { InviteForm, MemberRow, RevokeInvite } from "@/components/admin/AdminUi";
import { isAdmin } from "@/lib/access";
import { scopeOptions } from "@/lib/scopes";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { levelFromXp } from "@/lib/game";
import { ROLE_META } from "@/lib/roles";
import { getDict, getLocale, requireUser } from "@/lib/session";

export default async function CrewPage() {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  const [t, locale] = [await getDict(), await getLocale()];
  const [members, invites, scopes] = await Promise.all([
    db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] }),
    db.invitation.findMany({ where: { acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
    scopeOptions(),
  ]);
  const scopeLabel = (type: string | null, id: string | null) => scopes.find((s) => s.type === type && s.id === id)?.label ?? `🌍 ${t.everywhere}`;

  return (
    <div className="space-y-5 p-2">
      <h1 className="text-2xl font-bold">🛰️ {t.crew}</h1>
      <section className="panel space-y-3 p-5">
        <h2 className="text-sm font-bold">🚀 {t.invite}</h2>
        <InviteForm scopes={scopes} />
        {invites.length > 0 && (
          <div className="space-y-1 pt-2">
            <h3 className="muted text-xs font-bold uppercase">{t.pendingInvites}</h3>
            {invites.map((i) => (
              <div key={i.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1 truncate">✉️ {i.email}</span>
                <span className="muted text-xs">
                  {ROLE_META[i.role].icon} {ROLE_META[i.role][locale]} · {scopeLabel(i.scopeType, i.scopeId)} · ⏳ {formatDateTime(i.expiresAt, locale)}
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
                isOwnerViewer={user.role === "OWNER"}
                m={{ id: m.id, name: m.name ?? m.email.split("@")[0], email: m.email, avatar: m.avatar, role: m.role, phone: m.phone ?? "", active: !m.deactivatedAt, level: levelFromXp(m.xp) }}
              />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
