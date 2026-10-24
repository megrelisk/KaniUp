import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { ensureMember, mayEnter } from "@/lib/invitations";
import { SESSION_COOKIE } from "@/lib/session";

const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // Firebase's maximum session length

/** Exchanges a Firebase ID token (after magic link / Google sign-in) for a session cookie. */
export async function POST(req: Request) {
  const { idToken } = (await req.json()) as { idToken?: string };
  if (!idToken) return NextResponse.json({ error: "missing token" }, { status: 400 });
  const decoded = await adminAuth().verifyIdToken(idToken);
  const email = decoded.email;
  // Only recently signed-in tokens may mint a session.
  if (!email || Date.now() / 1000 - decoded.auth_time > 5 * 60) return NextResponse.json({ error: "stale" }, { status: 401 });
  if (!(await mayEnter(email))) return NextResponse.json({ error: "not_invited" }, { status: 403 });
  await ensureMember(decoded.uid, email, decoded.name ?? null);
  const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: MAX_AGE_MS });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, cookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: MAX_AGE_MS / 1000, path: "/" });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
