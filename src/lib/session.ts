import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "./db";
import { DICTS, type Locale } from "./i18n";

/** The signed-in user with grants, loaded once per request. Redirects to /login when signed out. */
export const requireUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.user.id }, include: { grants: true } });
  if (!user || user.deactivatedAt) redirect("/login");
  return user;
});

export type CurrentUser = Awaited<ReturnType<typeof requireUser>>;

export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get("locale")?.value;
  return c === "en" ? "en" : "ka";
});

export async function getDict() {
  return DICTS[await getLocale()];
}
