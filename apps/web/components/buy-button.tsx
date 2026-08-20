"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useWallet } from "@/hooks/use-wallet";
import { useBuy } from "@/hooks/use-buy";
import { WalletButton } from "@/components/wallet-button";
import { useI18n } from "@/lib/i18n";
import { clearReferralAttribution, getReferralAttribution } from "@/lib/referral";

type Props = {
  listingId: bigint;
  priceXlm: string;
  tokenId: number;
};

export function BuyButton({ listingId, priceXlm, tokenId }: Props) {
  const { isConnected } = useWallet();
  const { buy, state, errorKey, txHash, reset } = useBuy();
  const { t } = useI18n();

  useEffect(() => {
    if (state === "success") {
      // The attribution did its job — a repeat purchase should not keep
      // crediting a link followed before this sale.
      clearReferralAttribution(tokenId);
    }
  }, [state, tokenId]);

  if (!isConnected) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[10px] text-[var(--smoke)]">{t("buy.connectPrompt")}</p>
        <WalletButton />
      </div>
    );
  }

  if (state === "buying") {
    return (
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[10px] text-[var(--smoke)]">{t("buy.confirming")}</p>
        <div className="relative h-0.5 w-full overflow-hidden bg-white/12">
          <span className="progress-fill" />
        </div>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="flex flex-col gap-3" role="status" aria-live="polite">
        <p className="font-mono text-[10px] text-[var(--blue)] uppercase tracking-widest">
          {t("buy.confirmed")}
        </p>
        <p className="font-mono text-[10px] text-[var(--smoke)]">{t("buy.confirmedDetail")}</p>
        <p className="font-mono text-[10px] text-[var(--smoke)]">{t("buy.confirmedDelay")}</p>
        {txHash && (
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-[var(--smoke)] underline underline-offset-2"
          >
            {t("buy.viewTx")}
          </a>
        )}
        <Link
          href="/my-work"
          className="font-mono text-[10px] text-[var(--smoke)] underline underline-offset-2"
        >
          {t("buy.viewCollection")}
        </Link>
      </div>
    );
  }

  if (state === "error") {
    const message = errorKey ? t(errorKey) : t("transaction.errors.failed");
    return (
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[10px] text-red-400">{message}</p>
        <button
          onClick={reset}
          className="font-mono text-[10px] text-[var(--smoke)] underline underline-offset-2"
        >
          {t("buy.tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={async () => {
        try {
          await buy({ listingId, referrer: getReferralAttribution(tokenId) });
        } catch {
          // error state handled by hook
        }
      }}
      className="w-full bg-[var(--blue)] text-white font-bold text-xs tracking-widest uppercase px-8 py-4 transition-colors hover:bg-[#3493E5]"
    >
      {t("buy.ctaPrefix")} {priceXlm} XLM
    </button>
  );
}
