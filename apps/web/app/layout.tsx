import type { Metadata, Viewport } from "next";
import { Syne, DM_Sans, Space_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/providers/wallet-provider";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { I18nProvider } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { PageLoader } from "@/components/page-loader";

const syne = Syne({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-body" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: en.meta.title,
  description: en.meta.description,
  manifest: en.meta.manifest,
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
  themeColor: "#0A0A0A",
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
      lang={en.meta.lang}
      className={`${syne.variable} ${dmSans.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col bg-black text-offwhite font-[family-name:var(--font-body)]">
        {/* Grain overlay: sits above the black background, below content (z-10). */}
        <div aria-hidden className="grain pointer-events-none fixed inset-0 z-0 opacity-[0.04]" />
        <PageLoader />
        <I18nProvider>
          <WalletProvider>{children}</WalletProvider>
        </I18nProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
