import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/providers/wallet-provider";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { I18nProvider } from "@/lib/i18n";
import { es } from "@/lib/i18n/es";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: es.meta.title,
  description: es.meta.description,
  manifest: es.meta.manifest,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Molotov",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={es.meta.lang}
      className={`${fraunces.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col bg-black text-[#F5F4ED] font-[family-name:var(--font-geist-sans)]">
        {/* Grain overlay: sits above the black background, below content (z-10). */}
        <div aria-hidden className="grain pointer-events-none fixed inset-0 z-0 opacity-[0.04]" />
        <I18nProvider>
          <WalletProvider>{children}</WalletProvider>
        </I18nProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
