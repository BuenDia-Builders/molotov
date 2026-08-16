"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useMemo } from "react";

export type PrivyStellarSigner = {
  address: string;
  signXdr: (unsignedXdr: string) => Promise<string>;
};

function networkPassphrase(): string {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === "MAINNET"
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";
}

// DEPRECATED — superseded by ADR 0002 (Accepted, Option D). Deriving a Stellar wallet
// from the social account is no longer the plan: the royalty recipient is an
// artist-supplied G-address they control, not one Privy manages. This hook is kept only
// so that if Privy ships native Stellar support it does not silently wire a signing
// wallet in behind the social login. Remove it when the profile wallet field lands; do
// not add new callers.
export function useStellarWallet(): {
  wallet: PrivyStellarSigner | null;
  address: string | null;
} {
  const { wallets } = useWallets();
  const { user } = usePrivy();

  // Try native Privy Stellar embedded wallet (future-proof for when Privy adds it)
  const raw = wallets.find(
    (w) =>
      w.walletClientType === "privy" &&
      ((w as unknown as { chainType?: string }).chainType === "stellar" ||
        (w as unknown as { chain?: string }).chain === "stellar"),
  );

  const privyWallet: PrivyStellarSigner | null = useMemo(() => {
    if (!raw) return null;
    return {
      address: raw.address,
      async signXdr(unsignedXdr: string): Promise<string> {
        const privyRaw = raw as unknown as {
          signTransaction: (xdr: string, opts?: Record<string, string>) => Promise<string>;
        };
        if (typeof privyRaw.signTransaction !== "function") {
          throw new Error("Privy Stellar wallet does not expose signTransaction");
        }
        return privyRaw.signTransaction(unsignedXdr, { networkPassphrase: networkPassphrase() });
      },
    };
  }, [raw]);

  if (raw && privyWallet) return { wallet: privyWallet, address: raw.address };
  if (user?.id) return { wallet: null, address: null }; // resolved async in WalletButton
  return { wallet: null, address: null };
}
