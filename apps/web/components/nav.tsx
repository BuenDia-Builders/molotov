"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";
import { contractExplorerUrl, NFT_CONTRACT_ID, truncateAddress } from "@/lib/stellar";
import { useI18n } from "@/lib/i18n";
import { useWallet } from "@/hooks/use-wallet";

const PRIMARY_LINKS = [
  { href: "/works", key: "nav.discover" },
  { href: "/create", key: "nav.create" },
  { href: "/artists", key: "nav.artists" },
  { href: "/about", key: "nav.about" },
] as const;

const SECONDARY_LINKS = [
  { href: "/#how", key: "nav.howYouEarn" },
  { href: "/#activity", key: "nav.activity" },
  { href: "/#manifesto", key: "nav.manifesto" },
  { href: "/team", key: "nav.team" },
] as const;

export function Nav() {
  const { t, locale, setLocale } = useI18n();
  const { isConnected, address, disconnect } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const close = () => setMenuOpen(false);

  const localeBtns = (light: boolean) =>
    (["en", "es"] as const).map((loc) => (
      <button
        key={loc}
        onClick={() => setLocale(loc)}
        className={`font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.2em] transition-colors ${
          light
            ? locale === loc
              ? "text-[var(--black)]"
              : "text-[var(--black)]/30 hover:text-[var(--black)]/70"
            : locale === loc
              ? "text-[var(--offwhite)]"
              : "text-[var(--offwhite)]/30 hover:text-[var(--offwhite)]/70"
        }`}
      >
        {loc}
      </button>
    ));

  return (
    <>
      {/* ── Nav bar ── */}
      <header className="sticky top-0 z-40 border-b border-black/10 bg-[var(--offwhite)]">
        <div className="grid h-12 grid-cols-3 items-center px-4 md:px-10 lg:px-20">
          {/* Left: MENU button */}
          <div>
            <button
              onClick={() => setMenuOpen(true)}
              aria-label={t("nav.openMenu")}
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--black)]/45 transition-colors hover:text-[var(--black)]"
            >
              {t("nav.menuLabel")}
            </button>
          </div>

          {/* Center: Logo */}
          <div className="flex justify-center">
            <Link href="/" aria-label={t("nav.homeLabel")}>
              <Image
                src="/brand/logo_sinfondo.png"
                alt="Molotov"
                width={44}
                height={44}
                className="logo-flame h-11 w-11"
                priority
              />
            </Link>
          </div>

          {/* Right: locale + wallet */}
          <div className="flex items-center justify-end gap-4">
            <div className="hidden items-center gap-2 md:flex">{localeBtns(true)}</div>
            <WalletButton theme="light" />
          </div>
        </div>
      </header>

      {/* ── Full-screen menu overlay ── */}
      {menuOpen && (
        <div
          className="menu-enter fixed inset-0 z-50 flex flex-col bg-[var(--black)]"
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.menuLabel")}
        >
          {/* Overlay top bar */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4 md:px-10 lg:px-20">
            <button
              onClick={close}
              className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--offwhite)]/50 underline underline-offset-4 transition-colors hover:text-[var(--offwhite)]"
            >
              {t("nav.closeMenu")}
            </button>
            <div className="flex items-center gap-3">{localeBtns(false)}</div>
          </div>

          {/* Primary links — BIG */}
          <nav className="flex flex-1 flex-col overflow-y-auto px-6 pt-8 pb-4 md:px-16 lg:px-24">
            <ul className="border-t border-white/10">
              {PRIMARY_LINKS.map(({ href, key }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={close}
                    className="group flex items-baseline justify-between border-b border-white/10 py-5 md:py-7"
                  >
                    <span className="font-[family-name:var(--font-display)] text-[clamp(2.2rem,6vw,5.5rem)] font-light leading-none tracking-[-0.02em] text-[var(--offwhite)] transition-colors group-hover:text-[var(--blue)] [font-variation-settings:'opsz'_96]">
                      <span className="mr-3 font-[family-name:var(--font-mono)] text-[1.2rem] text-[var(--offwhite)]/20 group-hover:text-[var(--blue)]/40 md:mr-5 md:text-[1.5rem]">
                        /
                      </span>
                      {t(key)}
                    </span>
                    <span
                      aria-hidden
                      className="font-[family-name:var(--font-mono)] text-sm text-[var(--offwhite)]/20 transition-colors group-hover:text-[var(--blue)] md:text-lg"
                    >
                      ↗
                    </span>
                  </Link>
                </li>
              ))}
              {isConnected && (
                <li>
                  <Link
                    href="/my-work"
                    onClick={close}
                    className="group flex items-baseline justify-between border-b border-white/10 py-5 md:py-7"
                  >
                    <span className="font-[family-name:var(--font-display)] text-[clamp(2.2rem,6vw,5.5rem)] font-light leading-none tracking-[-0.02em] text-[var(--offwhite)] transition-colors group-hover:text-[var(--blue)] [font-variation-settings:'opsz'_96]">
                      <span className="mr-3 font-[family-name:var(--font-mono)] text-[1.2rem] text-[var(--offwhite)]/20 group-hover:text-[var(--blue)]/40 md:mr-5 md:text-[1.5rem]">
                        /
                      </span>
                      {t("nav.myWork")}
                    </span>
                    <span
                      aria-hidden
                      className="font-[family-name:var(--font-mono)] text-sm text-[var(--offwhite)]/20 transition-colors group-hover:text-[var(--blue)] md:text-lg"
                    >
                      ↗
                    </span>
                  </Link>
                </li>
              )}
            </ul>

            {/* Secondary links */}
            <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
              {SECONDARY_LINKS.map(({ href, key }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={close}
                    className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-[var(--offwhite)]/30 transition-colors hover:text-[var(--offwhite)]/70"
                  >
                    · {t(key)}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href={contractExplorerUrl(NFT_CONTRACT_ID)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={close}
                  className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-[var(--offwhite)]/30 transition-colors hover:text-[var(--offwhite)]/70"
                >
                  · {t("nav.contract")}
                </a>
              </li>
            </ul>

            {/* Mobile locale toggle */}
            <div className="mt-8 flex items-center gap-3 md:hidden">{localeBtns(false)}</div>
          </nav>

          {/* Overlay bottom */}
          <div className="flex shrink-0 items-center justify-between gap-4 border-t border-white/10 px-6 py-5 md:px-16 lg:px-24">
            {isConnected ? (
              <div className="flex items-center gap-4">
                <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)]/50">
                  {address ? truncateAddress(address, 6, 6) : ""}
                </span>
                <button
                  onClick={() => {
                    close();
                    void disconnect();
                  }}
                  className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-widest text-[var(--offwhite)]/60 underline underline-offset-4 hover:text-[var(--offwhite)]"
                >
                  {t("wallet.disconnect")}
                </button>
              </div>
            ) : (
              <WalletButton />
            )}
            <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-[var(--offwhite)]/18">
              MOLOTOV · Buenos Aires · 2026
            </p>
          </div>
        </div>
      )}
    </>
  );
}
