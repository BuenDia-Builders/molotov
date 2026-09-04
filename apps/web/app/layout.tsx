import type { Metadata, Viewport } from "next";
import { Syne, DM_Sans, Space_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/providers/wallet-provider";
import { MolotovPrivyProvider } from "@/providers/privy-provider";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { AnalyticsPageview } from "@/components/analytics-pageview";
import { ArtworkProtection } from "@/components/artwork-protection";
import { Suspense } from "react";
import { I18nProvider } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { PageLoader } from "@/components/page-loader";

const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
});
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
});
// Second, editorial-only voice — manifesto, curatorial captions, the
// occasional alternate headline. Never used for UI chrome: nav, buttons,
// labels and CTAs stay Syne/DM Sans/Space Mono. See molotov-overrides.md.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-editorial",
});

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
      className={`${syne.variable} ${dmSans.variable} ${spaceMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col bg-black text-offwhite font-[family-name:var(--font-body)]">
        {/* Grain overlay: sits above the black background, below content (z-10). */}
        <div aria-hidden className="grain pointer-events-none fixed inset-0 z-0 opacity-[0.04]" />
        <PageLoader />
        <I18nProvider>
          <MolotovPrivyProvider>
            <WalletProvider>{children}</WalletProvider>
          </MolotovPrivyProvider>
        </I18nProvider>
        <ServiceWorkerRegister />
        <ArtworkProtection />
        <Suspense fallback={null}>
          <AnalyticsPageview />
        </Suspense>
      </body>
    </html>
  );
}
