"use client";

import Image from "next/image";
import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";
import { type Locale, useI18n } from "@/lib/i18n";

const LINKS = [
  { href: "#como-cobras", labelKey: "nav.howYouEarn" },
  { href: "#actividad", labelKey: "nav.activity" },
  { href: "#manifiesto", labelKey: "nav.manifesto" },
  { href: "#contrato", labelKey: "nav.contract" },
] as const;

const LOCALES: Locale[] = ["es", "en"];

function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-2 font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.16em] text-[#F5F4ED]/50">
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          aria-current={locale === option ? "true" : undefined}
          className={`underline-offset-4 transition-colors hover:text-[#F5F4ED] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0178DE] ${
            locale === option ? "text-[#F5F4ED] decoration-[#0178DE] underline" : ""
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function Nav() {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 border-b border-white/12 bg-black/70 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10 lg:px-16">
        <Link
          href="/"
          className="flex items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0178DE]"
          aria-label={t("nav.homeLabel")}
        >
          <Image
            src="/brand/logo-wordmark-dark.png"
            alt="Molotov"
            width={820}
            height={612}
            priority
            className="h-10 w-auto md:h-11"
          />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="font-[family-name:var(--font-geist-mono)] text-[13px] tracking-wide text-[#F5F4ED]/60 underline-offset-4 transition-colors hover:text-[#F5F4ED] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0178DE]"
              >
                {t(link.labelKey)}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <WalletButton />
        </div>
      </nav>
    </header>
  );
}
