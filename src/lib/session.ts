import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "./firebase/admin";
import { col, loadGrantsOf, one } from "./data";
import { DICTS, type Locale } from "./i18n";
import type { UserDoc } from "./types";

/** Firebase Hosting only forwards a cookie named "__session". */
export const SESSION_COOKIE = "__session";

export const currentUserOrNull = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(token, true);
    const user = await one<UserDoc>(col.users().doc(decoded.uid));
    if (!user || user.deactivatedAt) return null;
    return { ...user, grants: await loadGrantsOf(user.id) };
  } catch {
    return null;
  }
});

/** The signed-in user with their scoped grants. Redirects to /login when signed out. */
export const requireUser = cache(async () => {
  const user = await currentUserOrNull();
  if (!user) redirect("/login");
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof currentUserOrNull>>>;

export const getLocale = cache(async (): Promise<Locale> => ((await cookies()).get("locale")?.value === "en" ? "en" : "ka"));

export async function getDict() {
  return DICTS[await getLocale()];
}
