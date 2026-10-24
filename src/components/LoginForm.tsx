"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GoogleAuthProvider, isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink, signInWithPopup, signOut, type User } from "firebase/auth";
import { canSignIn } from "@/app/actions/auth";
import { clientAuth } from "@/lib/firebase/client";
import type { Dict } from "@/lib/i18n";

const EMAIL_KEY = "kaniup-signin-email";

/** Trades the Firebase sign-in for a server session cookie. */
async function startSession(user: User): Promise<"ok" | "denied" | "error"> {
  const res = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: await user.getIdToken() }) });
  if (res.ok) return "ok";
  await signOut(clientAuth());
  return res.status === 403 ? "denied" : "error";
}

export function LoginForm({ t, email: initial = "" }: { t: Dict; email?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initial);
  const [state, setState] = useState<"idle" | "busy" | "sent" | "denied" | "error">("idle");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    if (!(await canSignIn(email))) return setState("denied");
    try {
      await sendSignInLinkToEmail(clientAuth(), email, { url: `${location.origin}/login/finish`, handleCodeInApp: true });
      localStorage.setItem(EMAIL_KEY, email);
      setState("sent");
    } catch {
      setState("error");
    }
  }

  async function google() {
    setState("busy");
    try {
      const cred = await signInWithPopup(clientAuth(), new GoogleAuthProvider());
      const result = await startSession(cred.user);
      if (result === "ok") router.replace("/");
      else setState(result);
    } catch {
      setState("idle");
    }
  }

  if (state === "sent") return <p className="rounded-lg bg-emerald-500/10 p-4 text-center text-emerald-500">{t.linkSent}</p>;

  return (
    <div className="space-y-3">
      {state === "denied" && <p className="rounded-lg bg-rose-500/10 p-3 text-center text-sm text-rose-500">{t.loginDenied}</p>}
      {state === "error" && <p className="rounded-lg bg-rose-500/10 p-3 text-center text-sm text-rose-500">⚠️ Error</p>}
      <form onSubmit={sendLink} className="space-y-3">
        <input name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@kani.ge" className="input" />
        <button disabled={state === "busy"} className="btn btn-primary w-full justify-center py-2.5">
          ✉️ {t.loginEmail}
        </button>
      </form>
      <button disabled={state === "busy"} onClick={google} className="btn btn-ghost w-full justify-center py-2.5">
        <span className="font-bold text-[#4285f4]">G</span> {t.loginGoogle}
      </button>
    </div>
  );
}

/** Completes a magic-link sign-in on /login/finish. */
export function FinishSignIn({ t }: { t: Dict }) {
  const router = useRouter();
  const [needEmail, setNeedEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function finish(address: string) {
    try {
      const cred = await signInWithEmailLink(clientAuth(), address, location.href);
      localStorage.removeItem(EMAIL_KEY);
      const result = await startSession(cred.user);
      if (result === "ok") router.replace("/");
      else setError(result === "denied" ? t.loginDenied : "⚠️ Error");
    } catch {
      setError("⚠️ Link expired / invalid");
    }
  }

  useEffect(() => {
    if (!isSignInWithEmailLink(clientAuth(), location.href)) return router.replace("/login");
    const saved = localStorage.getItem(EMAIL_KEY);
    // Opened on another device: ask which email the link was sent to.
    if (saved) void finish(saved);
    else setNeedEmail(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p className="rounded-lg bg-rose-500/10 p-3 text-center text-sm text-rose-500">{error}</p>;
  if (needEmail)
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setNeedEmail(false);
          void finish(email);
        }}
      >
        <p className="muted text-sm">{t.emailLinkPrompt}</p>
        <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn btn-primary w-full justify-center">{t.login}</button>
      </form>
    );
  return <p className="muted text-center">⏳ {t.signingIn}</p>;
}

export function Brand({ tagline }: { tagline: string }) {
  return (
    <div className="mb-6 text-center">
      <div className="text-5xl">🪐</div>
      <h1 className="brand mt-2 font-[family-name:var(--font-display)] text-3xl font-extrabold">KaniUp</h1>
      <p className="muted mt-1 text-sm">{tagline}</p>
    </div>
  );
}
