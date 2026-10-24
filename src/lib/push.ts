import "server-only";
import { getMessaging } from "firebase-admin/messaging";
import { getApps } from "firebase-admin/app";
import { col, FieldValue } from "./data";
import { fs } from "./firebase/admin";

/** Browser push via Firebase Cloud Messaging. Works only against a real Firebase project (not the emulators). */
export async function sendPush(userId: string, tokens: string[] | undefined, title: string, body: string, url: string) {
  if (!tokens?.length || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") return;
  fs(); // makes sure the admin app is initialised
  try {
    const res = await getMessaging(getApps()[0]).sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: { fcmOptions: { link: url }, notification: { icon: "/icon.png" } },
    });
    // Drop tokens the browser has revoked.
    const dead = res.responses.flatMap((r, i) => (!r.success && /registration-token-not-registered|invalid-registration-token/.test(r.error?.code ?? "") ? [tokens[i]] : []));
    if (dead.length) await col.users().doc(userId).update({ pushTokens: FieldValue.arrayRemove(...dead) });
  } catch (err) {
    console.error("push failed", err);
  }
}
