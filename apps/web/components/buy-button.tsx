"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/use-wallet";
import { useBuy } from "@/hooks/use-buy";
import { WalletButton } from "@/components/wallet-button";

type Props = {
  listingId: bigint;
  priceXlm: string;
  tokenId: number;
};

export function BuyButton({ listingId, priceXlm, tokenId }: Props) {
  const router = useRouter();
  const { isConnected } = useWallet();
  const { buy, state, errorKind, txHash, reset } = useBuy();

  useEffect(() => {
    if (state === "success") {
      const timer = setTimeout(() => router.push(`/my-work/${tokenId}`), 2000);
      return () => clearTimeout(timer);
    }
  }, [state, router, tokenId]);

  if (!isConnected) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[10px] text-[var(--smoke)]">Connect your wallet to buy</p>
        <WalletButton />
      </div>
    );
  }

  if (state === "buying") {
    return (
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[10px] text-[var(--smoke)]">
          Confirm the transaction in your wallet…
        </p>
        <div className="relative h-0.5 w-full overflow-hidden bg-white/12">
          <span className="progress-fill" />
        </div>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[10px] text-[var(--blue)] uppercase tracking-widest">
          Purchase confirmed
        </p>
        {txHash && (
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-[var(--smoke)] underline underline-offset-2"
          >
            View transaction →
          </a>
        )}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[10px] text-red-400">
          {errorKind === "rejected"
            ? "Transaction rejected."
            : "Transaction failed. Please try again."}
        </p>
        <button
          onClick={reset}
          className="font-mono text-[10px] text-[var(--smoke)] underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={async () => {
        try {
          await buy({ listingId });
        } catch {
          // error state handled by hook
        }
      }}
      className="w-full bg-[var(--blue)] text-white font-bold text-xs tracking-widest uppercase px-8 py-4 transition-colors hover:bg-[#3493E5]"
    >
      Buy now — {priceXlm} XLM
    </button>
  );
}
