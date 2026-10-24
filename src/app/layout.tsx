import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "KaniUp",
  description: "Cosmic task management with RPG progression",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#060818" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const theme = store.get("theme")?.value === "light" ? "light" : "dark";
  const locale = store.get("locale")?.value === "en" ? "en" : "ka";
  return (
    <html lang={locale} className={theme === "dark" ? "dark" : ""}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@400;500;600;700&family=Orbitron:wght@600;800&display=swap"
        />
      </head>
      <body>
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
