import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Brand, LoginForm } from "@/components/LoginForm";
import { getDict } from "@/lib/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ type?: string; error?: string }> }) {
  if ((await auth())?.user) redirect("/");
  const { type, error } = await searchParams;
  // Auth.js redirects here with ?type=email after sending a magic link.
  const sent = type === "email";
  const t = await getDict();
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="panel pop-in w-full max-w-sm p-7">
        <Brand tagline={t.appTagline} />
        {sent ? (
          <p className="rounded-lg bg-emerald-500/10 p-4 text-center text-emerald-400">{t.linkSent}</p>
        ) : (
          <>
            {error && <p className="mb-3 rounded-lg bg-rose-500/10 p-3 text-center text-sm text-rose-400">{t.loginDenied}</p>}
            <LoginForm t={t} />
          </>
        )}
      </div>
    </main>
  );
}
