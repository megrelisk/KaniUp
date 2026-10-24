"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { all, col, loadRoles, now, one } from "@/lib/data";
import { adminAuth } from "@/lib/firebase/admin";
import { assertCan, scopePath } from "@/lib/access";
import { requireUser } from "@/lib/session";
import { INVITE_TTL_MS } from "@/lib/invitations";
import { mailLayout, sendMail } from "@/lib/mail";
import { PERMISSIONS } from "@/lib/roles";
import type { GrantDoc, InvitationDoc, OverrideDoc, Permission, RoleDoc, ScopeType, UserDoc } from "@/lib/types";

const scopeType = z.enum(["GALAXY", "FOLDER", "PLANET"]);

async function roleExists(roleId: string) {
  const role = (await loadRoles()).find((r) => r.id === roleId);
  if (!role) throw new Error("unknown role");
  return role;
}

export async function inviteMember(input: { email: string; roleId: string; scopeType?: ScopeType | null; scopeId?: string | null }) {
  const user = await requireUser();
  const email = z.string().trim().toLowerCase().email().parse(input.email);
  const role = await roleExists(input.roleId);
  const st = input.scopeType ? scopeType.parse(input.scopeType) : null;
  const sid = st ? z.string().parse(input.scopeId) : null;
  await assertCan(user, "INVITE", await scopePath(st ?? "ROOT", sid));
  // Handing out a role that manages roles is reserved to people who manage roles themselves.
  if (role.permissions.includes("MANAGE_ROLES")) await assertCan(user, "MANAGE_ROLES", []);

  const token = randomBytes(24).toString("base64url");
  await col.invitations().doc(token).set({
    email,
    roleId: role.id,
    scopeType: st,
    scopeId: sid,
    inviterId: user.id,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    acceptedAt: null,
    createdAt: now(),
  } satisfies Omit<InvitationDoc, "id">);
  const url = `${process.env.APP_URL ?? "http://localhost:3000"}/invite/${token}`;
  await sendMail(
    email,
    "🚀 მოწვევა KaniUp-ში / You're invited to KaniUp",
    mailLayout("შენ მიგიწვიეს ეკიპაჟში!", `${user.name} გიწვევს KaniUp-ში როლით <b>${role.icon} ${role.name}</b>. ლინკი მოქმედებს 3 დღე.`, {
      url,
      label: "შეუერთდი / Join the crew",
    }),
    `You're invited to KaniUp: ${url}`,
  );
  revalidatePath("/admin");
}

export async function revokeInvitation(id: string) {
  const user = await requireUser();
  await assertCan(user, "INVITE", []);
  await col.invitations().doc(id).delete();
  revalidatePath("/admin");
}

async function manageableTarget(userId: string) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_ROLES", []);
  const target = await one<UserDoc>(col.users().doc(userId));
  if (!target || target.isOwner) throw new Error("forbidden");
  return target;
}

export async function setUserRole(userId: string, roleId: string) {
  await manageableTarget(userId);
  await roleExists(roleId);
  await col.users().doc(userId).update({ roleId });
  revalidatePath("/admin");
}

export async function setUserPhone(userId: string, phone: string) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_ROLES", []);
  await col.users().doc(userId).update({ phone: phone.trim().slice(0, 30) || null });
  revalidatePath("/admin");
}

export async function setUserActive(userId: string, active: boolean) {
  await manageableTarget(userId);
  await col.users().doc(userId).update({ deactivatedAt: active ? null : now() });
  if (!active) await adminAuth().revokeRefreshTokens(userId).catch(() => {});
  revalidatePath("/admin");
}

/** Gives a user a role inside a galaxy / folder / planet (roleId=null removes it). */
export async function setGrant(userId: string, st: ScopeType, scopeId: string, roleId: string | null) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_ROLES", await scopePath(scopeType.parse(st), scopeId));
  const existing = await all<GrantDoc>(col.grants().where("userId", "==", userId));
  for (const g of existing.filter((g) => g.scopeType === st && g.scopeId === scopeId)) await col.grants().doc(g.id).delete();
  if (roleId) {
    await roleExists(roleId);
    await col.grants().add({ userId, roleId, scopeType: st, scopeId } satisfies Omit<GrantDoc, "id">);
  }
  revalidatePath("/admin", "layout");
}

// ─── Roles ───────────────────────────────────────────────────────────────

const roleSchema = z.object({
  name: z.string().trim().min(1).max(40),
  nameEn: z.string().trim().max(40).default(""),
  icon: z.string().trim().min(1).max(8),
  scopedOnly: z.boolean().default(false),
});

export async function createRole(input: z.input<typeof roleSchema>) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_ROLES", []);
  const data = roleSchema.parse(input);
  const roles = await loadRoles();
  const ref = await col.roles().add({ ...data, nameEn: data.nameEn || data.name, permissions: ["VIEW", "COMMENT"], position: roles.length } satisfies Omit<RoleDoc, "id">);
  revalidatePath("/admin", "layout");
  return ref.id;
}

export async function updateRole(roleId: string, input: Partial<z.input<typeof roleSchema>>) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_ROLES", []);
  await roleExists(roleId);
  await col.roles().doc(roleId).update(roleSchema.partial().parse(input));
  revalidatePath("/admin", "layout");
}

export async function deleteRole(roleId: string) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_ROLES", []);
  const inUse =
    (await col.users().where("roleId", "==", roleId).limit(1).get()).size + (await col.grants().where("roleId", "==", roleId).limit(1).get()).size;
  if (inUse) throw new Error("role_in_use");
  await col.roles().doc(roleId).delete();
  for (const o of await all<OverrideDoc>(col.overrides().where("roleId", "==", roleId))) await col.overrides().doc(o.id).delete();
  revalidatePath("/admin", "layout");
}

/**
 * Toggles one permission. Without a scope it edits the role itself; with a scope it
 * sets (or with allowed=null clears) an override only inside that galaxy / folder / planet.
 */
export async function setRolePermission(roleId: string, permission: Permission, allowed: boolean | null, scope?: { type: ScopeType; id: string }) {
  const user = await requireUser();
  await assertCan(user, "MANAGE_ROLES", scope ? await scopePath(scope.type, scope.id) : []);
  const role = await roleExists(roleId);
  if (!PERMISSIONS.includes(permission)) throw new Error("unknown permission");
  if (!scope) {
    const permissions = allowed ? [...new Set([...role.permissions, permission])] : role.permissions.filter((p) => p !== permission);
    await col.roles().doc(roleId).update({ permissions });
  } else {
    const existing = await all<OverrideDoc>(col.overrides().where("roleId", "==", roleId));
    for (const o of existing.filter((o) => o.permission === permission && o.scopeType === scope.type && o.scopeId === scope.id)) {
      await col.overrides().doc(o.id).delete();
    }
    if (allowed !== null) await col.overrides().add({ roleId, permission, allowed, scopeType: scope.type, scopeId: scope.id } satisfies Omit<OverrideDoc, "id">);
  }
  revalidatePath("/admin", "layout");
}
