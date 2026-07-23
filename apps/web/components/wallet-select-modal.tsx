"use client";

import { useMemo } from "react";
import type { ISupportedWallet } from "@/lib/stellar";

interface Props {
  wallets: ISupportedWallet[];
  /** id of the wallet a connection is currently in flight for, if any. */
  connectingId?: string | null;
  /** user-facing connection error to show, if the last attempt failed. */
  error?: string | null;
  onSelect: (wallet: ISupportedWallet) => void;
  onClose: () => void;
}

/**
 * Most likely to already be installed, first. LOBSTR leads: it is the most used
 * wallet in the Stellar ecosystem, so it is the best first guess for someone who
 * owns a Stellar wallet at all. Anything not listed keeps the kit's order, behind
 * these.
 */
const PREFERRED_ORDER = ["lobstr", "wallet_connect", "freighter", "xbull", "albedo", "hana"];

function rank(wallet: ISupportedWallet): number {
  const index = PREFERRED_ORDER.indexOf(wallet.id);
  return index === -1 ? PREFERRED_ORDER.length : index;
}

function WalletRow({
  wallet,
  connecting,
  disabled,
  onSelect,
}: {
  wallet: ISupportedWallet;
  connecting: boolean;
  disabled: boolean;
  onSelect: (wallet: ISupportedWallet) => void;
}) {
  const available = wallet.isAvailable;

  return (
    <li>
      <button
        disabled={!available || disabled}
        onClick={() => onSelect(wallet)}
        className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors ${
          available ? "hover:bg-white/5" : "cursor-default"
        } disabled:cursor-default`}
      >
        {wallet.icon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={wallet.icon}
            alt=""
            width={28}
            height={28}
            className={`shrink-0 rounded-sm ${available ? "" : "opacity-30 grayscale"}`}
          />
        )}
        <span
          className={`flex-1 text-sm ${
            available ? "text-[var(--offwhite)]" : "text-[var(--offwhite)]/35"
          }`}
        >
          {wallet.name}
        </span>
        {connecting && (
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--offwhite)]/50">
            Connecting…
          </span>
        )}
      </button>
    </li>
  );
}

export function WalletSelectModal({ wallets, connectingId, error, onSelect, onClose }: Props) {
  const busy = connectingId != null;
  // Installed wallets first, missing ones grouped at the bottom instead of
  // interleaved: a greyed-out row between two usable ones reads as something broken
  // rather than as "you don't have this one".
  const { available, unavailable } = useMemo(() => {
    const sorted = [...wallets].sort((a, b) => rank(a) - rank(b));
    return {
      available: sorted.filter((w) => w.isAvailable),
      unavailable: sorted.filter((w) => !w.isAvailable),
    };
  }, [wallets]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-sm overflow-y-auto border border-white/12 bg-[var(--black)] p-6"
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

        {error && (
          <p className="mb-4 border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        {available.length > 0 && (
          <ul className="space-y-1">
            {available.map((wallet) => (
              <WalletRow
                key={wallet.id}
                wallet={wallet}
                connecting={connectingId === wallet.id}
                disabled={busy}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}

        {unavailable.length > 0 && (
          <>
            <p className="mt-5 mb-2 border-t border-white/10 pt-4 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.25em] text-[var(--offwhite)]/35 uppercase">
              Not installed
            </p>
            <ul className="space-y-1">
              {unavailable.map((wallet) => (
                <WalletRow
                  key={wallet.id}
                  wallet={wallet}
                  connecting={connectingId === wallet.id}
                  disabled={busy}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </>
        )}

        <p className="mt-5 text-xs text-[var(--offwhite)]/40">
          Don&apos;t have a wallet?{" "}
          <a
            href="https://lobstr.co"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--offwhite)]/70"
          >
            Get LOBSTR
          </a>
        </p>
      </div>
    </div>
  );
}
