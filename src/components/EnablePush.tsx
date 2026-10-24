"use client";

import { useEffect, useState } from "react";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { savePushToken } from "@/app/actions/notifications";
import { firebaseApp } from "@/lib/firebase/client";
import { useUi } from "./UiContext";

const VAPID = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
const EMULATORS = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

/** Asks for notification permission and registers this browser for push. */
export function EnablePush() {
  const { t } = useUi();
  const [state, setState] = useState<"hidden" | "off" | "on" | "busy">("hidden");

  useEffect(() => {
    if (!VAPID || EMULATORS || typeof Notification === "undefined") return;
    void isSupported().then((ok) => ok && setState(Notification.permission === "granted" ? "on" : "off"));
  }, []);

  // Re-register on each visit while permission is granted, since tokens rotate.
  useEffect(() => {
    if (state === "on") void register().catch(() => {});
  }, [state]);

  async function register() {
    const sw = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const token = await getToken(getMessaging(firebaseApp()), { vapidKey: VAPID, serviceWorkerRegistration: sw });
    if (token) await savePushToken(token);
  }

  if (state === "hidden") return null;
  if (state === "on") return <p className="text-sm text-emerald-500">{t.pushEnabled}</p>;
  return (
    <button
      className="btn btn-ghost"
      disabled={state === "busy"}
      onClick={async () => {
        setState("busy");
        const permission = await Notification.requestPermission();
        setState(permission === "granted" ? "on" : "off");
      }}
    >
      📲 {t.enablePush}
    </button>
  );
}
