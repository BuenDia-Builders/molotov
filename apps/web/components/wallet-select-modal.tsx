"use client";

import type { ISupportedWallet } from "@/lib/stellar";

interface Props {
  wallets: ISupportedWallet[];
  onSelect: (wallet: ISupportedWallet) => void;
  onClose: () => void;
}

export function WalletSelectModal({ wallets, onSelect, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm border border-white/12 bg-[var(--black)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--offwhite)]">Connect a Wallet</h2>
          <button
            onClick={onClose}
            className="text-xl leading-none text-[var(--offwhite)]/50 hover:text-[var(--offwhite)]"
          >
            ×
          </button>
        </div>

        <ul className="space-y-1">
          {wallets.map((wallet) => (
            <li key={wallet.id}>
              <button
                disabled={!wallet.isAvailable}
                onClick={() => onSelect(wallet)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {wallet.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={wallet.icon}
                    alt=""
                    width={28}
                    height={28}
                    className="shrink-0 rounded-sm"
                  />
                )}
                <span className="flex-1 text-sm text-[var(--offwhite)]">{wallet.name}</span>
                {!wallet.isAvailable && (
                  <span className="border border-white/10 px-2 py-0.5 text-xs text-[var(--offwhite)]/40">
                    Not available
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-5 text-xs text-[var(--offwhite)]/40">
          Don&apos;t have a wallet?{" "}
          <a
            href="https://freighter.app"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--offwhite)]/70"
          >
            Get Freighter
          </a>
        </p>
      </div>
    </div>
  );
}
