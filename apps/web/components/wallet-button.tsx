"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { IS_TESTNET, STELLAR_NETWORK_NAME, truncateAddress } from "@/lib/stellar";
import { useI18n } from "@/lib/i18n";
import { useStellarWallet, getOrCreateLocalKeypair } from "@/lib/privy-stellar";

export function WalletButton({ theme = "dark" }: { theme?: "light" | "dark" }) {
  const { address, isConnected, isConnecting, connect, disconnect, connectViaPrivy } = useWallet();
  const { login, logout, ready, authenticated, user: privyUser } = usePrivy();
  const privyEmail = privyUser?.email?.address ?? privyUser?.google?.email ?? null;
  const isPrivyMode = authenticated && !!privyEmail;
  const { wallet: privyNativeWallet, address: privyNativeAddress } = useStellarWallet();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [privyLoading, setPrivyLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  // When Privy auth resolves, wire up the Stellar address + signer into WalletProvider
  useEffect(() => {
    if (!ready || !authenticated || isConnected) return;

    // Case 1: Privy exposes a native Stellar wallet (future)
    if (privyNativeAddress && privyNativeWallet) {
      connectViaPrivy(privyNativeAddress, privyNativeWallet.signXdr);
      Promise.resolve().then(() => setPrivyLoading(false));
      return;
    }

    // Case 2: fallback — generate/restore keypair in localStorage keyed by Privy user ID
    if (privyUser?.id) {
      const userId = privyUser.id;
      getOrCreateLocalKeypair(userId)
        .then(({ address: localAddr, secret }) => {
          const signer = async (unsignedXdr: string): Promise<string> => {
            const { Keypair, Transaction } = await import("@stellar/stellar-sdk");
            const networkPassphrase =
              process.env.NEXT_PUBLIC_STELLAR_NETWORK === "MAINNET"
                ? "Public Global Stellar Network ; September 2015"
                : "Test SDF Network ; September 2015";
            const kp = Keypair.fromSecret(secret);
            const tx = new Transaction(unsignedXdr, networkPassphrase);
            tx.sign(kp);
            return tx.toEnvelope().toXDR("base64");
          };
          connectViaPrivy(localAddr, signer);
          setPrivyLoading(false);
          // Best-effort friendbot fund on first use (testnet only)
          if (IS_TESTNET) {
            const fundedKey = `molotov_funded_${localAddr}`;
            if (!localStorage.getItem(fundedKey)) {
              fetch(`https://friendbot.stellar.org?addr=${localAddr}`)
                .then(() => localStorage.setItem(fundedKey, "1"))
                .catch(() => {});
            }
          }
        })
        .catch(() => setPrivyLoading(false));
    }
  }, [
    ready,
    authenticated,
    isConnected,
    privyNativeAddress,
    privyNativeWallet,
    privyUser?.id,
    connectViaPrivy,
  ]);

  const handlePrivyLogin = async () => {
    if (authenticated) return;
    setPrivyLoading(true);
    try {
      await login();
    } catch {
      setPrivyLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setMenuOpen(false);
    await disconnect();
    if (authenticated) await logout();
  };

  if (!isConnected || !address) {
    return (
      <div ref={containerRef} className="relative">
        <Button
          onClick={() => setMenuOpen((o) => !o)}
          disabled={isConnecting || privyLoading}
          className="bg-[var(--blue)] text-white hover:bg-[var(--blue-light)]"
        >
          {isConnecting || privyLoading ? t("wallet.connecting") : "Connect"}
        </Button>
        {menuOpen && (
          <div className="absolute right-0 z-50 mt-2 min-w-48 border border-black/10 bg-[var(--offwhite)] p-1 shadow-md">
            <button
              className="w-full px-3 py-2.5 text-left text-sm text-[var(--black)] hover:bg-black/5"
              onClick={() => {
                setMenuOpen(false);
                void connect();
              }}
            >
              {t("wallet.connect")}
            </button>
            <div className="my-1 border-t border-black/8" />
            <button
              className="w-full px-3 py-2.5 text-left text-sm text-[var(--black)]/70 hover:bg-black/5"
              onClick={() => {
                setMenuOpen(false);
                void handlePrivyLogin();
              }}
            >
              Sign in with email
            </button>
          </div>
        )}
      </div>
    );
  }

  const isLight = theme === "light";
  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        className={`min-h-[44px] bg-transparent font-[family-name:var(--font-mono)] ${
          isLight
            ? "border-black/20 text-[var(--black)] hover:bg-black/5 hover:text-[var(--black)]"
            : "border-white/15 text-[var(--offwhite)] hover:bg-white/5 hover:text-[var(--offwhite)]"
        }`}
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        {IS_TESTNET && (
          <span
            className={`mr-2 border px-1.5 py-0.5 text-[12px] uppercase ${
              isLight
                ? "border-black/15 text-[var(--black)]/60"
                : "border-white/15 text-[var(--offwhite)]/60"
            }`}
          >
            {t("wallet.testnetBadge")}
          </span>
        )}
        {isPrivyMode
          ? privyEmail.length > 22
            ? privyEmail.slice(0, 20) + "…"
            : privyEmail
          : truncateAddress(address)}
      </Button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-44 border border-white/12 bg-[var(--black)] p-1"
        >
          {IS_TESTNET && (
            <div className="mb-1 border-b border-white/12 px-3 py-2 text-xs text-[var(--offwhite)]/60">
              {t("wallet.networkLabel")} · {STELLAR_NETWORK_NAME}
            </div>
          )}
          <button
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-[var(--offwhite)] hover:bg-white/5"
            onClick={handleDisconnect}
          >
            {t("wallet.disconnect")}
          </button>
        </div>
      )}
    </div>
  );
}
