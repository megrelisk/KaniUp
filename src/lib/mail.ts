import nodemailer from "nodemailer";

const transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;

export async function sendMail(to: string, subject: string, html: string, text: string) {
  if (!transport) {
    // No SMTP configured (local dev): print the message so links can be clicked from the console.
    console.log(`\n📧 [mail → ${to}] ${subject}\n${text}\n`);
    return;
  }
  await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, html, text });
}

export function mailLayout(title: string, body: string, cta?: { url: string; label: string }) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.url}" style="background:linear-gradient(90deg,#7c5cff,#22d3ee);color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">${cta.label}</a></p>`
    : "";
  return `<div style="background:#070a1a;padding:32px;font-family:system-ui,sans-serif;color:#e2e8f0">
  <div style="max-width:520px;margin:auto;background:#0f1430;border:1px solid #2a3170;border-radius:16px;padding:28px">
    <div style="font-size:22px;font-weight:700;color:#a5b4fc">🪐 KaniUp</div>
    <h1 style="font-size:20px;color:#fff">${title}</h1>
    <div style="line-height:1.6">${body}</div>${button}
  </div></div>`;
}
