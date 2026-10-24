"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { AVATARS } from "@/lib/game";
import { requireUser } from "@/lib/session";

const YEAR = 60 * 60 * 24 * 365;

export async function setLocale(locale: "ka" | "en") {
  (await cookies()).set("locale", locale === "en" ? "en" : "ka", { maxAge: YEAR, path: "/" });
  revalidatePath("/", "layout");
}

export async function setTheme(theme: "dark" | "light") {
  (await cookies()).set("theme", theme === "light" ? "light" : "dark", { maxAge: YEAR, path: "/" });
  revalidatePath("/", "layout");
}

export async function updateProfile(input: { avatar?: string; name?: string }) {
  const user = await requireUser();
  const data: { avatar?: string; name?: string } = {};
  if (input.avatar && AVATARS.some((a) => a.key === input.avatar)) data.avatar = input.avatar;
  if (input.name?.trim()) data.name = input.name.trim().slice(0, 80);
  await db.user.update({ where: { id: user.id }, data });
  revalidatePath("/", "layout");
}
