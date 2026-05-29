"use client";

import { NFT_CONTRACT_ID, contractExplorerUrl, truncateAddress } from "@/lib/stellar";
import { useI18n } from "@/lib/i18n";

// Product properties live here as an archive-style list, not a marquee.
const PROPS = [
  "footer.props.royalties",
  "footer.props.immutable",
  "footer.props.fee",
  "footer.props.noAi",
  "footer.props.stellar",
  "footer.props.latam",
] as const;

const PRODUCT = [
  { href: "#como-cobras", labelKey: "nav.howYouEarn" },
  { href: "#actividad", labelKey: "nav.activity" },
  { href: "#manifiesto", labelKey: "nav.manifesto" },
  { href: "#crear", labelKey: "footer.mintWork" },
] as const;

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="mt-auto border-t border-white/12">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-3 md:px-10 lg:px-16">
        <div>
          <p className="font-[family-name:var(--font-fraunces)] text-xl [font-variation-settings:'opsz'_40]">
            Molotov
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#F5F4ED]/60">
            {t("footer.description")}
          </p>
        </div>

        <nav aria-label={t("footer.productLabel")}>
          <p className="font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.18em] text-[#F5F4ED]/40">
            {t("footer.productLabel")}
          </p>
          <ul className="mt-4 space-y-2">
            {PRODUCT.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="font-[family-name:var(--font-geist-mono)] text-[13px] text-[#F5F4ED]/70 underline-offset-4 transition-colors hover:text-[#F5F4ED] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0178DE]"
                >
                  {t(link.labelKey)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.18em] text-[#F5F4ED]/40">
            {t("footer.propertiesLabel")}
          </p>
          <ul className="mt-4 space-y-2">
            {PROPS.map((prop) => (
              <li
                key={prop}
                className="font-[family-name:var(--font-geist-mono)] text-[13px] text-[#F5F4ED]/60"
              >
                {t(prop)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-white/12 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-10 lg:px-16">
        <p className="font-[family-name:var(--font-geist-mono)] text-[12px] text-[#F5F4ED]/40">
          {t("footer.copyright")}
        </p>
        <a
          href={contractExplorerUrl(NFT_CONTRACT_ID)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-[family-name:var(--font-geist-mono)] text-[12px] text-[#F5F4ED]/60 underline-offset-4 transition-colors hover:text-[#F5F4ED] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0178DE]"
        >
          {t("footer.contractPrefix")} {truncateAddress(NFT_CONTRACT_ID, 6, 6)}{" "}
          {t("common.externalArrow")}
        </a>
      </div>
    </footer>
  );
}
