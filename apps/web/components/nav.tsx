"use client";

import Image from "next/image";
import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";
import { SearchBox } from "@/components/search-box";
import { useI18n } from "@/lib/i18n";
import { START_HREF } from "@/lib/routes";

/**
 * Top bar: wordmark, artist search, create / start / sign-in. Site navigation
 * lives in the footer (objkt-style) — there is no menu overlay.
 */
export function Nav() {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-[var(--offwhite)]">
      <div className="flex h-12 items-center gap-4 px-4 md:gap-6 md:px-10 lg:px-20">
        {/* Left: wordmark */}
        <Link href="/" aria-label={t("nav.homeLabel")} className="flex shrink-0 items-center gap-2">
          <Image
            src="/brand/logo_sinfondo.png"
            alt=""
            width={28}
            height={28}
            className="logo-flame h-7 w-7"
            priority
          />
          <span className="font-[family-name:var(--font-display)] text-sm font-bold tracking-[0.18em] text-[var(--black)]">
            MOLOTOV
          </span>
        </Link>

        {/* Center: artist search (md+; mobile gets the row below) */}
        <div className="hidden flex-1 justify-center md:flex">
          <SearchBox />
        </div>

        {/* Right: create / start / locale / wallet */}
        <div className="ml-auto flex items-center gap-3 md:ml-0 md:gap-4">
          <Link
            href="/create"
            className="hidden min-h-11 items-center font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--black)]/60 transition-colors hover:text-[var(--black)] sm:inline-flex"
          >
            {t("nav.create")}
          </Link>
          <Link
            href={START_HREF}
            className="hidden h-8 items-center bg-[var(--blue)] px-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] text-white transition-colors hover:bg-[var(--blue-light)] sm:inline-flex"
          >
            {t("nav.start")}
          </Link>
          <WalletButton theme="light" />
        </div>
      </div>
      {/* Mobile search row */}
      <div className="border-t border-black/5 px-4 py-2 md:hidden">
        <SearchBox variant="block" />
      </div>
    </header>
  );
}
