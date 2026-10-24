import { Brand, LoginForm } from "@/components/LoginForm";
import { db } from "@/lib/db";
import { ROLE_META } from "@/lib/roles";
import { getDict, getLocale } from "@/lib/session";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [t, locale] = [await getDict(), await getLocale()];
  const invite = await db.invitation.findUnique({ where: { token }, include: { inviter: true } });
  const valid = invite && !invite.acceptedAt && invite.expiresAt > new Date();
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="panel pop-in w-full max-w-sm p-7">
        <Brand tagline={t.appTagline} />
        {valid ? (
          <>
            <p className="mb-5 text-center">
              <b>{invite.inviter.name ?? invite.inviter.email}</b>{" "}
              {locale === "ka" ? "გიწვევს ეკიპაჟში როლით" : "invites you to the crew as"}
              <span className="mt-2 block text-lg font-bold">
                {ROLE_META[invite.role].icon} {ROLE_META[invite.role][locale]}
              </span>
            </p>
            <LoginForm t={t} email={invite.email} />
          </>
        ) : (
          <p className="text-center text-rose-400">
            {locale === "ka" ? "მოწვევის ლინკს ვადა გაუვიდა ან უკვე გამოყენებულია." : "This invitation has expired or was already used."}
          </p>
        )}
      </div>
    </main>
  );
}
