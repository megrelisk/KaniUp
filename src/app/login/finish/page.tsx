import { Brand, FinishSignIn } from "@/components/LoginForm";
import { getDict } from "@/lib/session";

export default async function FinishPage() {
  const t = await getDict();
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="panel pop-in w-full max-w-sm p-7">
        <Brand tagline={t.appTagline} />
        <FinishSignIn t={t} />
      </div>
    </main>
  );
}
