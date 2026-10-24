import { Brand, LoginForm } from "@/components/LoginForm";
import { col, loadRoles, now, one } from "@/lib/data";
import { getDict, getLocale } from "@/lib/session";
import type { InvitationDoc, UserDoc } from "@/lib/types";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [t, locale] = [await getDict(), await getLocale()];
  const invite = await one<InvitationDoc>(col.invitations().doc(token));
  const valid = invite && !invite.acceptedAt && invite.expiresAt > now();
  const [inviter, role] = valid
    ? await Promise.all([one<UserDoc>(col.users().doc(invite.inviterId)), loadRoles().then((r) => r.find((x) => x.id === invite.roleId))])
    : [null, null];
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="panel pop-in w-full max-w-sm p-7">
        <Brand tagline={t.appTagline} />
        {valid ? (
          <>
            <p className="mb-5 text-center">
              <b>{inviter?.name}</b> {locale === "ka" ? "გიწვევს ეკიპაჟში როლით" : "invites you to the crew as"}
              <span className="mt-2 block text-lg font-bold">
                {role?.icon} {locale === "ka" ? role?.name : role?.nameEn}
              </span>
            </p>
            <LoginForm t={t} email={invite.email} />
          </>
        ) : (
          <p className="text-center text-rose-500">
            {locale === "ka" ? "მოწვევის ლინკს ვადა გაუვიდა ან უკვე გამოყენებულია." : "This invitation has expired or was already used."}
          </p>
        )}
      </div>
    </main>
  );
}
