import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { mailLayout, sendMail } from "@/lib/mail";
import { acceptInvitation, ownerEmails, pendingInvitation } from "@/lib/invitations";

declare module "next-auth" {
  interface Session {
    user: { id: string; email: string; name?: string | null; role: Role };
  }
}

const providers = [];
if (process.env.AUTH_GOOGLE_ID) providers.push(Google({ allowDangerousEmailAccountLinking: true }));
providers.push(
  Nodemailer({
    server: process.env.SMTP_URL || "smtp://localhost:25",
    from: process.env.MAIL_FROM,
    maxAge: 60 * 60,
    async sendVerificationRequest({ identifier, url }) {
      await sendMail(
        identifier,
        "KaniUp — შესვლის ლინკი / Sign-in link",
        mailLayout("🚀 მზად ხარ გაფრენისთვის?", "დააჭირე ღილაკს KaniUp-ში შესასვლელად. ლინკი 1 საათი მოქმედებს.", {
          url,
          label: "შესვლა / Sign in",
        }),
        `Sign in to KaniUp: ${url}`,
      );
    },
  }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers,
  pages: { signIn: "/login", verifyRequest: "/login", error: "/login" },
  callbacks: {
    // Only invited people (or configured owners) may enter.
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) return !existing.deactivatedAt;
      if (ownerEmails().includes(email)) return true;
      return Boolean(await pendingInvitation(email));
    },
    async session({ session, user }) {
      const u = user as unknown as { id: string; role: Role };
      session.user.id = u.id;
      session.user.role = u.role;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id && user.email) await acceptInvitation(user.id, user.email);
    },
  },
});
