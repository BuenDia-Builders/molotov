"use client";

import Link from "next/link";
import { NFT_CONTRACT_ID, contractExplorerUrl, truncateAddress } from "@/lib/stellar";
import { useI18n } from "@/lib/i18n";

const PRODUCT_LINKS = [
  { href: "#how", labelKey: "nav.howYouEarn" },
  { href: "#activity", labelKey: "nav.activity" },
  { href: "#manifesto", labelKey: "nav.manifesto" },
  { href: "/create", labelKey: "footer.mintWork" },
  { href: "/artists", labelKey: "footer.artists" },
] as const;

const SOCIAL_LINKS = [
  { href: "https://x.com/Molotovappart", label: "X / Twitter", external: true },
  { href: "https://www.instagram.com/molotov.app", label: "Instagram", external: true },
] as const;

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="mt-auto border-t border-white/12">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 sm:grid-cols-2 md:px-10 lg:grid-cols-4 lg:px-16">
        {/* Brand */}
        <div className="md:col-span-1">
          <p className="font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--offwhite)]">
            Molotov
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--offwhite)]/60">
            {t("footer.description")}
          </p>
          <p className="mt-4 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--blue)]">
            Stellar · Testnet
          </p>
        </div>

        {/* Product */}
        <nav aria-label={t("footer.productLabel")} className="md:col-span-1">
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--offwhite)]/40 mb-4">
            {t("footer.productLabel")}
          </p>
          <ul className="space-y-3">
            {PRODUCT_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--offwhite)]/70 transition-colors hover:text-[var(--offwhite)]"
                >
                  {t(link.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Properties */}
        <div className="md:col-span-1">
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--offwhite)]/40 mb-4">
            {t("footer.propertiesLabel")}
          </p>
          <ul className="space-y-3">
            {(
              [
                "footer.props.royalties",
                "footer.props.immutable",
                "footer.props.fee",
                "footer.props.noAi",
                "footer.props.stellar",
                "footer.props.latam",
              ] as const
            ).map((prop) => (
              <li
                key={prop}
                className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--offwhite)]/50"
              >
                {t(prop)}
              </li>
            ))}
          </ul>
        </div>

        {/* Community */}
        <div className="md:col-span-1">
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--offwhite)]/40 mb-4">
            Community
          </p>
          <ul className="space-y-3">
            {SOCIAL_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--offwhite)]/70 transition-colors hover:text-[var(--offwhite)] inline-flex items-center gap-1.5"
                >
                  {link.label}
                  <span className="text-[var(--offwhite)]/30">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-white/12 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-10 lg:px-16">
        <p className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)]/30">
          {t("footer.copyright")}
        </p>
        <div className="flex items-center gap-6">
          <a
            href={contractExplorerUrl(NFT_CONTRACT_ID)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)]/40 transition-colors hover:text-[var(--offwhite)]/70"
          >
            Contract · {truncateAddress(NFT_CONTRACT_ID, 6, 6)} ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
