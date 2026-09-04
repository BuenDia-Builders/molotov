"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { IS_TESTNET } from "@/lib/stellar";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function MolotovPrivyProvider({ children }: { children: ReactNode }) {
  if (!appId || !IS_TESTNET) return <>{children}</>;

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google"],
        appearance: { theme: "dark", accentColor: "#2D43FF" },
        embeddedWallets: { createOnLogin: "off" },
        // Molotov never uses Privy for EVM wallet connections — Stellar wallets
        // go through Stellar Wallets Kit (see providers/wallet-provider.tsx).
        // Without this, Privy still scans window.ethereum for injected EVM
        // wallets on every load and crashes if a browser has one that doesn't
        // implement the full EIP-1193 event interface (e.g. two extensions
        // both claiming window.ethereum, one a thin non-conforming proxy).
        externalWallets: { disableAllExternalWallets: true },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
