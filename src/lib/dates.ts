// Deterministic date formatting in Tbilisi time, so server and browser render the same text.

const MONTHS = {
  ka: ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tbilisi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function tbilisiParts(d: Date) {
  const p = Object.fromEntries(parts.formatToParts(d).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: p.hour, minute: p.minute, key: `${p.year}-${p.month}-${p.day}` };
}

export function formatDay(iso: string | Date, locale: "ka" | "en") {
  const p = tbilisiParts(new Date(iso));
  return locale === "ka" ? `${p.day} ${MONTHS.ka[p.month - 1]}` : `${MONTHS.en[p.month - 1]} ${p.day}`;
}

export function formatDateTime(iso: string | Date, locale: "ka" | "en") {
  const p = tbilisiParts(new Date(iso));
  return `${formatDay(iso, locale)} ${p.year}, ${p.hour}:${p.minute}`;
}

export function formatTime(iso: string | Date) {
  const p = tbilisiParts(new Date(iso));
  return `${p.hour}:${p.minute}`;
}

export function isSameTbilisiDay(a: Date, b: Date) {
  return tbilisiParts(a).key === tbilisiParts(b).key;
}
