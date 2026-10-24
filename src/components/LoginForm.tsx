import { signIn } from "@/auth";
import type { Dict } from "@/lib/i18n";

export function LoginForm({ t, email, redirectTo = "/" }: { t: Dict; email?: string; redirectTo?: string }) {
  const google = Boolean(process.env.AUTH_GOOGLE_ID);
  return (
    <div className="space-y-3">
      <form
        action={async (form) => {
          "use server";
          await signIn("nodemailer", { email: String(form.get("email")), redirectTo });
        }}
        className="space-y-3"
      >
        <input name="email" type="email" required defaultValue={email} placeholder="you@kani.ge" className="input" />
        <button className="btn btn-primary w-full justify-center py-2.5">✉️ {t.loginEmail}</button>
      </form>
      {google && (
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo });
          }}
        >
          <button className="btn btn-ghost w-full justify-center py-2.5">
            <span className="font-bold text-[#4285f4]">G</span> {t.loginGoogle}
          </button>
        </form>
      )}
    </div>
  );
}

export function Brand({ tagline }: { tagline: string }) {
  return (
    <div className="mb-6 text-center">
      <div className="text-5xl">🪐</div>
      <h1 className="neon-text mt-2 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-wider">KaniUp</h1>
      <p className="muted mt-1 text-sm">{tagline}</p>
    </div>
  );
}
