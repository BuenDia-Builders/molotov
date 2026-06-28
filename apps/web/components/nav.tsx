"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";
import { contractExplorerUrl, NFT_CONTRACT_ID } from "@/lib/stellar";
import { useI18n } from "@/lib/i18n";

const MOBILE_LINK_KEYS = [
  { href: "/works",       key: "nav.discover"  },
  { href: "/create",      key: "nav.create"    },
  { href: "/artists",     key: "nav.artists"   },
  { href: "/#how",        key: "nav.howYouEarn"},
  { href: "/#activity",   key: "nav.activity"  },
  { href: "/#manifesto",  key: "nav.manifesto" },
] as const;

export function Nav() {
  const { t, locale, setLocale } = useI18n();
  const [moreOpen,   setMoreOpen]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMoreOpen(false); setMobileOpen(false); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const linkClass =
    "font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--smoke)] transition-colors hover:text-[var(--offwhite)]";

  const featureCards = [
    {
      id: "manifesto",
      title: t("manifesto.title"),
      body:  t("nav.megaManifestoBody"),
      href:  "/#manifesto",
      bar:   "var(--smoke)",
    },
    {
      id: "how",
      title: t("nav.howYouEarn"),
      body:  t("nav.megaHowBody"),
      href:  "/#how",
      bar:   "var(--blue)",
    },
    {
      id: "stellar",
      title: t("nav.megaStellarTitle"),
      body:  t("nav.megaStellarBody"),
      href:  "https://stellar.org",
      bar:   "var(--blue-deep)",
      external: true,
    },
  ];

  const quickLinks = [
    { label: t("nav.howYouEarn"), href: "/#how" },
    { label: t("nav.activity"),   href: "/#activity" },
    { label: t("nav.artists"),    href: "/artists" },
    { label: t("nav.contract"),   href: contractExplorerUrl(NFT_CONTRACT_ID), external: true },
  ];

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-[var(--ember)] bg-[var(--carbon)]">

      {/* ── Main bar ── */}
      <div className="flex h-12 items-center justify-between px-4 md:grid md:grid-cols-[auto_1fr_auto] md:px-0">

        {/* Logo */}
        <div className="md:pl-16">
          <Link href="/" aria-label={t("nav.homeLabel")} className="flex items-center">
            <Image
              src="/brand/logo-wordmark-dark.png"
              alt="Molotov"
              width={120}
              height={40}
              className="h-8 w-auto brightness-0 invert"
              priority
            />
          </Link>
        </div>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center justify-center gap-8">
          <li><Link href="/works"   className={linkClass}>{t("nav.discover")}</Link></li>
          <li><Link href="/create"  className={linkClass}>{t("nav.create")}</Link></li>
          <li><Link href="/artists" className={linkClass}>{t("nav.artists")}</Link></li>
          <li>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-haspopup="true"
              className={`${linkClass} flex items-center gap-1.5`}
            >
              {t("nav.more")}
              <span
                aria-hidden
                className={`text-[8px] transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`}
              >
                ▾
              </span>
            </button>
          </li>
        </ul>

        {/* Right: locale toggle + wallet + hamburger */}
        <div className="flex items-center gap-4 md:pr-16">

          {/* EN · ES toggle */}
          <div className="hidden md:flex items-center gap-1.5">
            {(["en", "es"] as const).map((loc) => (
              <button
                key={loc}
                onClick={() => setLocale(loc)}
                className={`font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.15em] transition-colors ${
                  locale === loc
                    ? "text-[var(--offwhite)]"
                    : "text-[var(--smoke)] hover:text-[var(--offwhite)]"
                }`}
              >
                {loc}
              </button>
            ))}
          </div>

          <div className="hidden md:block">
            <WalletButton />
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            className="md:hidden flex flex-col justify-center gap-[5px] p-1"
          >
            <span className={`block h-px w-5 bg-[var(--offwhite)] transition-all duration-200 ${mobileOpen ? "translate-y-[7px] rotate-45"  : ""}`} />
            <span className={`block h-px w-5 bg-[var(--offwhite)] transition-all duration-200 ${mobileOpen ? "opacity-0"                      : ""}`} />
            <span className={`block h-px w-5 bg-[var(--offwhite)] transition-all duration-200 ${mobileOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── More mega-menu (desktop) ── */}
      {moreOpen && (
        <div className="hidden md:block absolute left-0 right-0 top-full border-b border-[var(--ember)] bg-[var(--carbon)] z-50">
          <div className="mx-auto max-w-7xl px-10 py-6 lg:px-16">

            {/* Feature cards */}
            <div className="grid grid-cols-3 gap-px bg-[var(--ember)]">
              {featureCards.map((card) => (
                <Link
                  key={card.id}
                  href={card.href}
                  target={card.external ? "_blank" : undefined}
                  rel={card.external ? "noopener noreferrer" : undefined}
                  onClick={() => setMoreOpen(false)}
                  className="group flex flex-col gap-3 bg-[var(--carbon)] p-6 transition-colors hover:bg-[var(--black)]"
                >
                  <div className="h-px w-10" style={{ backgroundColor: card.bar }} />
                  <p className="font-[family-name:var(--font-display)] font-bold text-lg text-[var(--offwhite)]">
                    {card.title}
                  </p>
                  <p className="text-sm text-[var(--smoke)] leading-relaxed">
                    {card.body}
                  </p>
                </Link>
              ))}
            </div>

            {/* Quick links */}
            <div className="mt-px grid grid-cols-4 gap-px bg-[var(--ember)]">
              {quickLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  onClick={() => setMoreOpen(false)}
                  className="bg-[var(--carbon)] px-6 py-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] text-[var(--smoke)] transition-colors hover:bg-[var(--black)] hover:text-[var(--offwhite)]"
                >
                  {link.label}
                </a>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* ── Mobile menu ── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--ember)] bg-[var(--carbon)]">
          {MOBILE_LINK_KEYS.map(({ href, key }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="flex border-b border-[var(--ember)] px-6 py-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--smoke)] hover:text-[var(--offwhite)]"
            >
              {t(key)}
            </Link>
          ))}

          {/* Mobile locale toggle */}
          <div className="flex items-center gap-3 border-b border-[var(--ember)] px-6 py-4">
            {(["en", "es"] as const).map((loc) => (
              <button
                key={loc}
                onClick={() => setLocale(loc)}
                className={`font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] transition-colors ${
                  locale === loc
                    ? "text-[var(--offwhite)]"
                    : "text-[var(--smoke)] hover:text-[var(--offwhite)]"
                }`}
              >
                {loc}
              </button>
            ))}
          </div>

          <div className="px-6 py-4">
            <WalletButton />
          </div>
        </div>
      )}

    </header>
  );
}
