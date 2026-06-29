"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useMemo } from "react";

export type PrivyStellarSigner = {
  address: string;
  signXdr: (unsignedXdr: string) => Promise<string>;
};

// Privy v2.x does not yet expose Stellar embedded wallets through useWallets().
// Fallback: generate a random keypair once, persist it in localStorage keyed by
// the Privy user ID. Testnet / demo only — never store secrets in localStorage
// in a production mainnet context.
export async function getOrCreateLocalKeypair(
  userId: string,
): Promise<{ address: string; secret: string }> {
  const storageKey = `molotov_stellar_kp_${userId}`;
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    try {
      return JSON.parse(stored) as { address: string; secret: string };
    } catch {
      // corrupted entry — fall through and recreate
    }
  }
  const { Keypair } = await import("@stellar/stellar-sdk");
  const kp = Keypair.random();
  const entry = { address: kp.publicKey(), secret: kp.secret() };
  localStorage.setItem(storageKey, JSON.stringify(entry));
  return entry;
}

function networkPassphrase(): string {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === "MAINNET"
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";
}

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
