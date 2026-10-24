"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { clientAuth, clientDb } from "@/lib/firebase/client";

/**
 * Refreshes the current server-rendered view when any of the given ping documents
 * changes (the server bumps them after every write). Data itself is never read
 * client-side; this is only a "something changed" signal. Falls back to polling
 * when the browser has no Firebase sign-in.
 */
export function Live({ keys }: { keys: string[] }) {
  const router = useRouter();
  const joined = keys.join("|");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    let unsubs: (() => void)[] = [];
    let poll: ReturnType<typeof setInterval> | undefined;
    const stopAuth = onAuthStateChanged(clientAuth(), (user) => {
      unsubs.forEach((u) => u());
      unsubs = [];
      clearInterval(poll);
      if (!user) {
        poll = setInterval(() => document.visibilityState === "visible" && router.refresh(), 15000);
        return;
      }
      for (const key of joined.split("|")) {
        let first = true;
        unsubs.push(
          onSnapshot(
            doc(clientDb(), "pings", key),
            () => {
              if (first) first = false;
              else refresh();
            },
            () => {},
          ),
        );
      }
    });
    return () => {
      stopAuth();
      unsubs.forEach((u) => u());
      clearInterval(poll);
      clearTimeout(timer);
    };
  }, [joined, router]);
  return null;
}
