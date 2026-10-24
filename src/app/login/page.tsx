import { redirect } from "next/navigation";
import { Brand, LoginForm } from "@/components/LoginForm";
import { currentUserOrNull, getDict } from "@/lib/session";

export default async function LoginPage() {
  if (await currentUserOrNull()) redirect("/");
  const t = await getDict();
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="panel pop-in w-full max-w-sm p-7">
        <Brand tagline={t.appTagline} />
        <LoginForm t={t} />
      </div>
    </main>
  );
}
