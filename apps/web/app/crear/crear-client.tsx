"use client";

import { Nav } from "@/components/nav";
import { WalletButton } from "@/components/wallet-button";
import { MintForm } from "@/components/mint-form";
import { useWallet } from "@/hooks/use-wallet";

export function CrearClient() {
  const { isConnected } = useWallet();

  return (
    <div className="relative z-10 flex flex-1 flex-col">
      <Nav />
      <main className="flex flex-1 flex-col">
        {isConnected ? (
          <MintForm />
        ) : (
          <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
            <p className="font-[family-name:var(--font-fraunces)] text-3xl leading-tight tracking-[-0.01em] [font-variation-settings:'opsz'_72] md:text-4xl">
              Para mintear tu primera obra necesitás conectar tu wallet.
            </p>
            <div className="mt-10">
              <WalletButton />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
