import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getLang } from "@/lib/i18n-server";
import { I18nProvider } from "@/components/I18nProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Capacita — Treinamento de Segurança",
  description: "Plataforma de capacitação e conscientização por cliente.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await getLang();
  return (
    <html
      lang={lang === "es" ? "es" : "pt-BR"}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
