"use client";

import { NFT_CONTRACT_ID, contractExplorerUrl } from "@/lib/stellar";
import { useI18n } from "@/lib/i18n";

// Subtle trust badge. The full hash lives in the footer, not in the fold.
export function ContractEvidence() {
  const { t } = useI18n();

  return (
    <a
      href={contractExplorerUrl(NFT_CONTRACT_ID)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-11 items-center gap-2.5 rounded-full border border-white/12 bg-[#0A0A0B] px-4 font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.16em] text-[#F5F4ED]/60 transition-colors hover:border-white/25 hover:text-[#F5F4ED] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0178DE]"
    >
      <span aria-hidden className="inline-block size-1.5 rounded-full bg-[#16A34A]" />
      {t("contractEvidence.label")}
      <span aria-hidden className="text-[#F5F4ED]/40">
        {t("common.externalArrow")}
      </span>
    </a>
  );
}
