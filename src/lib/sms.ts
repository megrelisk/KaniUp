import "server-only";

/**
 * SMS sending through a Georgian provider. Not configured yet: until SMS_PROVIDER
 * is set, messages are only printed to the server console.
 *
 *   SMS_PROVIDER=smsoffice  SMS_API_KEY=…  SMS_SENDER=KaniUp
 *     → https://smsoffice.ge/api/v2/send/ (check the provider's docs when the key arrives)
 *   SMS_PROVIDER=http  SMS_API_URL="https://provider/send?key={key}&to={to}&from={sender}&text={text}"
 *     → any provider with a simple GET API; {placeholders} are URL-encoded.
 */
export function smsConfigured() {
  return Boolean(process.env.SMS_PROVIDER && (process.env.SMS_API_KEY || process.env.SMS_API_URL));
}

/** Normalizes Georgian numbers to 9955XXXXXXXX. Returns null for anything that doesn't look like a phone. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9 && digits.startsWith("5")) digits = "995" + digits;
  return /^\d{11,15}$/.test(digits) ? digits : null;
}

export async function sendSms(phone: string | null | undefined, text: string) {
  const to = normalizePhone(phone);
  if (!to) return;
  const provider = process.env.SMS_PROVIDER;
  if (!smsConfigured()) {
    console.log(`\n📱 [sms → ${to}] ${text}\n`);
    return;
  }
  const key = process.env.SMS_API_KEY ?? "";
  const sender = process.env.SMS_SENDER ?? "KaniUp";
  let url: string;
  if (provider === "smsoffice") {
    const q = new URLSearchParams({ key, destination: to, sender, content: text, urgent: "true" });
    url = `https://smsoffice.ge/api/v2/send/?${q}`;
  } else {
    const vars: Record<string, string> = { key, to, sender, text };
    url = (process.env.SMS_API_URL ?? "").replace(/\{(key|to|sender|text)\}/g, (_, k: string) => encodeURIComponent(vars[k]));
  }
  try {
    const res = await fetch(url);
    if (!res.ok) console.error(`SMS failed (${res.status}): ${await res.text()}`);
  } catch (err) {
    console.error("SMS failed", err);
  }
}
