"use server";

import { z } from "zod";
import { mayEnter } from "@/lib/invitations";

/** Checked before sending a magic link, so uninvited addresses don't get one. */
export async function canSignIn(email: string) {
  const parsed = z.string().trim().email().safeParse(email);
  return parsed.success && (await mayEnter(parsed.data));
}
