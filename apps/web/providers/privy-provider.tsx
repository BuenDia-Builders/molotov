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
      }}
    >
      {children}
    </PrivyProvider>
  );
}
