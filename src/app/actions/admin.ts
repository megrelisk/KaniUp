"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Permission, Role, ScopeType } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, folderPath, galaxyPath, planetPath } from "@/lib/access";
import { requireUser } from "@/lib/session";
import { INVITE_TTL_MS } from "@/lib/invitations";
import { mailLayout, sendMail } from "@/lib/mail";
import { ROLE_META } from "@/lib/roles";

const role = z.enum(["ADMIN", "MANAGER", "MEMBER", "GUEST"]);
const scopeType = z.enum(["GALAXY", "FOLDER", "PLANET"]);

async function scopePath(type: ScopeType, id: string) {
  if (type === "GALAXY") return galaxyPath(id);
  if (type === "FOLDER") return folderPath(id);
  return planetPath(id);
}

export async function inviteMember(input: { email: string; role: Role; scopeType?: ScopeType | null; scopeId?: string | null }) {
  const user = await requireUser();
  const email = z.string().trim().toLowerCase().email().parse(input.email);
  const r = role.parse(input.role);
  const st = input.scopeType ? scopeType.parse(input.scopeType) : null;
  const sid = st ? z.string().parse(input.scopeId) : null;
  await assertCan(user, "INVITE", st && sid ? await scopePath(st, sid) : []);
  // Only owners can hand out admin.
  if (r === "ADMIN" && user.role !== "OWNER") throw new Error("forbidden");

  const token = randomBytes(24).toString("base64url");
  await db.invitation.create({
    data: { email, role: r, scopeType: st, scopeId: sid, token, inviterId: user.id, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });
  const url = `${process.env.AUTH_URL ?? "http://localhost:3000"}/invite/${token}`;
  const meta = ROLE_META[r];
  await sendMail(
    email,
    "🚀 მოწვევა KaniUp-ში / You're invited to KaniUp",
    mailLayout(
      "შენ მიგიწვიეს ეკიპაჟში!",
      `${user.name ?? user.email} გიწვევს KaniUp-ში როლით <b>${meta.icon} ${meta.ka}</b>. ლინკი მოქმედებს 3 დღე.`,
      { url, label: "შეუერთდი / Join the crew" },
    ),
    `You're invited to KaniUp: ${url}`,
  );
  revalidatePath("/admin");
}

export async function revokeInvitation(id: string) {
  const user = await requireUser();
  await assertCan(user, "INVITE", []);
  await db.invitation.delete({ where: { id } });
  revalidatePath("/admin");
}

export async function setUserRole(userId: string, newRole: Role) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_ROLES", []);
  const r = role.parse(newRole);
  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.role === "OWNER" || (r === "ADMIN" && user.role !== "OWNER")) throw new Error("forbidden");
  await db.user.update({ where: { id: userId }, data: { role: r } });
  revalidatePath("/admin");
}

export async function setUserPhone(userId: string, phone: string) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_ROLES", []);
  await db.user.update({ where: { id: userId }, data: { phone: phone.trim().slice(0, 30) || null } });
  revalidatePath("/admin");
}

export async function setUserActive(userId: string, active: boolean) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_ROLES", []);
  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.role === "OWNER") throw new Error("forbidden");
  await db.user.update({ where: { id: userId }, data: { deactivatedAt: active ? null : new Date() } });
  if (!active) await db.session.deleteMany({ where: { userId } });
  revalidatePath("/admin");
}

/** Gives a user a role inside a galaxy / folder / planet (or removes it with role=null). */
export async function setGrant(userId: string, st: ScopeType, scopeId: string, newRole: Role | null) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_ROLES", await scopePath(scopeType.parse(st), scopeId));
  const key = { userId_scopeType_scopeId: { userId, scopeType: st, scopeId } };
  if (newRole === null) await db.roleGrant.deleteMany({ where: { userId, scopeType: st, scopeId } });
  else await db.roleGrant.upsert({ where: key, create: { userId, scopeType: st, scopeId, role: role.parse(newRole) }, update: { role: role.parse(newRole) } });
  revalidatePath("/admin");
}

/**
 * Toggles one cell of the permission matrix. A null scope edits the global matrix;
 * a scope edits it only for that galaxy / folder / planet. allowed=null removes the override.
 */
export async function setRolePermission(
  r: Role,
  permission: Permission,
  allowed: boolean | null,
  scope?: { type: ScopeType; id: string },
) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_ROLES", scope ? await scopePath(scope.type, scope.id) : []);
  if (r === "OWNER") throw new Error("owner permissions are fixed");
  const where = { role: r, permission, scopeType: scope?.type ?? null, scopeId: scope?.id ?? null };
  // Prisma can't upsert on a unique with nullable columns, so delete + create.
  await db.rolePermission.deleteMany({ where });
  if (allowed !== null) await db.rolePermission.create({ data: { ...where, allowed } });
  revalidatePath("/admin");
}
