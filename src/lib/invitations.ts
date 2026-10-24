import "server-only";
import { col, all, now } from "./data";
import { DEFAULT_ROLE_ID } from "./roles";
import type { InvitationDoc, UserDoc } from "./types";

export const INVITE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function pendingInvitation(email: string) {
  const invites = await all<InvitationDoc>(col.invitations().where("email", "==", email.toLowerCase()));
  return invites
    .filter((i) => !i.acceptedAt && i.expiresAt > now())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

/** Whether this email may sign in: existing active crew, configured owners, or a pending invitation. */
export async function mayEnter(email: string) {
  const lower = email.toLowerCase();
  const existing = await all<UserDoc>(col.users().where("email", "==", lower));
  if (existing.length) return !existing[0].deactivatedAt;
  return ownerEmails().includes(lower) || Boolean(await pendingInvitation(lower));
}

/** Creates the crew member on first sign-in, applying their invitation (role + scoped grant). */
export async function ensureMember(uid: string, email: string, displayName: string | null) {
  const ref = col.users().doc(uid);
  if ((await ref.get()).exists) return;
  const lower = email.toLowerCase();
  const isOwner = ownerEmails().includes(lower);
  const invite = isOwner ? null : await pendingInvitation(lower);
  let roleId = DEFAULT_ROLE_ID;
  if (invite) {
    if (invite.scopeType && invite.scopeId) {
      // A scoped invite: the role applies inside that place only.
      await col.grants().add({ userId: uid, roleId: invite.roleId, scopeType: invite.scopeType, scopeId: invite.scopeId });
      roleId = "alien";
    } else {
      roleId = invite.roleId;
    }
    await col.invitations().doc(invite.id).update({ acceptedAt: now() });
  }
  await ref.set({
    email: lower,
    name: displayName || lower.split("@")[0],
    avatar: "polar-bear",
    roleId: isOwner ? "admin" : roleId,
    isOwner,
    xp: 0,
    streak: 0,
    bestStreak: 0,
    lastStreakDay: null,
    achievements: {},
    phone: null,
    deactivatedAt: null,
    createdAt: now(),
  } satisfies Omit<UserDoc, "id">);
}
