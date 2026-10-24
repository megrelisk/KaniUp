import type { Role, ScopeType } from "@prisma/client";
import { db } from "./db";

export const INVITE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function pendingInvitation(email: string) {
  return db.invitation.findFirst({
    where: { email: email.toLowerCase(), acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}

/** Applies a pending invitation (role + scoped grant) to a freshly signed-in user. */
export async function acceptInvitation(userId: string, email: string) {
  const lower = email.toLowerCase();
  if (ownerEmails().includes(lower)) {
    await db.user.update({ where: { id: userId }, data: { role: "OWNER" } });
    return;
  }
  const invite = await pendingInvitation(lower);
  if (!invite) return;
  await db.$transaction(async (tx) => {
    if (invite.scopeType && invite.scopeId) {
      // A scoped invite: the role applies inside that place; elsewhere the user is a guest
      // when invited as a guest, otherwise a regular member.
      await tx.user.update({ where: { id: userId }, data: { role: invite.role === "GUEST" ? "GUEST" : "MEMBER" } });
      await grant(tx, userId, invite.role, invite.scopeType, invite.scopeId);
    } else {
      await tx.user.update({ where: { id: userId }, data: { role: invite.role } });
    }
    await tx.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  });
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

function grant(tx: Tx, userId: string, role: Role, scopeType: ScopeType, scopeId: string) {
  return tx.roleGrant.upsert({
    where: { userId_scopeType_scopeId: { userId, scopeType, scopeId } },
    create: { userId, role, scopeType, scopeId },
    update: { role },
  });
}
