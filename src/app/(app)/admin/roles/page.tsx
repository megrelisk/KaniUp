import Link from "next/link";
import { notFound } from "next/navigation";
import type { ScopeType } from "@prisma/client";
import { PermissionMatrix } from "@/components/admin/AdminUi";
import { folderPath, galaxyPath, isAdmin, loadOverrides, planetPath } from "@/lib/access";
import { roleAllows, type Override } from "@/lib/permissions";
import { PERMISSIONS, ROLES } from "@/lib/roles";
import { getDict, getLocale, requireUser } from "@/lib/session";
import { scopeOptions } from "@/lib/scopes";

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  const [t, locale] = [await getDict(), await getLocale()];
  const { scope: raw } = await searchParams;
  const scopes = await scopeOptions();
  const scope = scopes.find((s) => `${s.type}:${s.id}` === raw);
  const path = scope ? await pathFor(scope.type, scope.id) : [];
  const overrides = (await loadOverrides()) as Override[];

  const cells = ROLES.flatMap((role) =>
    PERMISSIONS.map((permission) => {
      const here = overrides.find(
        (o) => o.role === role && o.permission === permission && o.scopeType === (scope?.type ?? null) && o.scopeId === (scope?.id ?? null),
      );
      return { role, permission, effective: roleAllows(role, permission, overrides, path), override: here ? here.allowed : null };
    }),
  );

  return (
    <div className="space-y-4 p-2">
      <h1 className="text-2xl font-bold">🔐 {t.roles}</h1>
      <p className="muted max-w-3xl text-sm">
        {locale === "ka"
          ? "დააჭირე უჯრას უფლების ჩასართავად / გამოსართავად. შეგიძლია შეცვალო ყველგან, ან მხოლოდ კონკრეტულ გალაქტიკაზე, მზის სისტემაზე ან პლანეტაზე. ჩარჩოიანი უჯრა ნიშნავს, რომ აქ არის შეცვლილი; დანარჩენი მემკვიდრეობით მოდის."
          : "Click a cell to toggle a permission — everywhere, or only inside a specific galaxy, solar system or planet. Outlined cells are set at this level; others are inherited."}
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
      <PermissionMatrix cells={cells} roles={ROLES} permissions={PERMISSIONS} scope={scope ? { type: scope.type, id: scope.id } : undefined} />
    </div>
  );
}

function pathFor(type: ScopeType, id: string) {
  if (type === "GALAXY") return galaxyPath(id);
  if (type === "FOLDER") return folderPath(id);
  return planetPath(id);
}
