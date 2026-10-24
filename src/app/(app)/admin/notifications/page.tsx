import { notFound } from "next/navigation";
import { NotifyMatrix } from "@/components/admin/NotifyMatrix";
import { isAdmin } from "@/lib/access";
import { loadNotifySettings, NOTIFY_CHANNELS, NOTIFY_EVENTS } from "@/lib/notify";
import { smsConfigured } from "@/lib/sms";
import { getDict, getLocale, requireUser } from "@/lib/session";

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  if (!(await isAdmin(user))) notFound();
  const [t, locale, settings] = [await getDict(), await getLocale(), await loadNotifySettings()];
  const status = {
    inApp: true,
    email: Boolean(process.env.SMTP_URL),
    push: Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "true",
    sms: smsConfigured(),
  };
  return (
    <div className="space-y-4 p-2">
      <h1 className="text-2xl font-bold">🔔 {t.notificationSettings}</h1>
      <p className="muted max-w-3xl text-sm">
        {locale === "ka"
          ? "აირჩიე, რომელ მოვლენაზე რომელი არხით წავიდეს შეტყობინება. დედლაინის შეხსენებები მიდის შემსრულებელთან, შემქმნელთან და ადმინთან ყოველ დილას 09:00-ზე. „არ არის დაკავშირებული“ არხი ჩართული შეიძლება იყოს — ამოქმედდება, როგორც კი პარამეტრებს (.env) შევავსებთ."
          : "Choose which channels each event uses. Deadline reminders go to assignees, the creator and admins every morning at 09:00. A channel marked “not connected” can stay on — it starts working once its settings (.env) are filled in."}
      </p>
      <NotifyMatrix settings={settings} events={NOTIFY_EVENTS} channels={NOTIFY_CHANNELS} status={status} />
    </div>
  );
}
