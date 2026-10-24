import Link from "next/link";
import { notFound } from "next/navigation";
import { NewRoleForm, PermissionMatrix } from "@/components/admin/AdminUi";
import { isAdmin, scopePath } from "@/lib/access";
import { loadOverrides, loadRoles } from "@/lib/data";
import { roleAllows } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/roles";
import { scopeOptions } from "@/lib/scopes";
import { getDict, getLocale, requireUser } from "@/lib/session";

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const user = await requireUser();
  if (!(await isAdmin(user))) notFound();
  const [t, locale] = [await getDict(), await getLocale()];
  const { scope: raw } = await searchParams;
  const [scopes, roles, overrides] = await Promise.all([scopeOptions(), loadRoles(), loadOverrides()]);
  const scope = scopes.find((s) => `${s.type}:${s.id}` === raw);
  const path = scope ? await scopePath(scope.type, scope.id) : [];

  const cells = roles.flatMap((role) =>
    PERMISSIONS.map((permission) => {
      const here = scope ? overrides.find((o) => o.roleId === role.id && o.permission === permission && o.scopeType === scope.type && o.scopeId === scope.id) : undefined;
      return { roleId: role.id, permission, effective: roleAllows(role, permission, overrides, path), override: here ? here.allowed : null };
    }),
  );

  return (
    <div className="space-y-4 p-2">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold">🔐 {t.roles}</h1>
        <NewRoleForm />
      </div>
      <p className="muted max-w-3xl text-sm">
        {locale === "ka"
          ? "დააჭირე უჯრას უფლების ჩასართავად / გამოსართავად. „ყველგან“ ცვლის თავად როლს; კონკრეტული გალაქტიკის, მზის სისტემის ან პლანეტის არჩევისას ცვლილება მხოლოდ იქ მოქმედებს (ჩარჩოიანი უჯრა). როლის სახელზე დაჭერით შეცვლი სახელს და იკონს."
          : "Click a cell to toggle a permission. “Everywhere” edits the role itself; pick a galaxy, solar system or planet to change it only there (outlined cells). Click a role name to rename it."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/roles" className={`chip px-3 py-1 ${!scope ? "border-[var(--accent)] text-[var(--accent)]" : "muted border-[var(--border)]"}`}>
          🌍 {t.everywhere}
        </Link>
        {scopes.map((s) => (
          <Link
            key={`${s.type}:${s.id}`}
            href={`/admin/roles?scope=${s.type}:${s.id}`}
            className={`chip px-3 py-1 ${scope?.id === s.id ? "border-[var(--accent)] text-[var(--accent)]" : "muted border-[var(--border)]"}`}
          >
            {s.label}
          </Link>
        ))}
      </div>
      <PermissionMatrix cells={cells} permissions={PERMISSIONS} scope={scope ? { type: scope.type, id: scope.id } : undefined} />
    </div>
  );
}
