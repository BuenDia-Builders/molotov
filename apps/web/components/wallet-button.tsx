"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { IS_TESTNET, STELLAR_NETWORK_NAME, truncateAddress } from "@/lib/stellar";
import { useI18n } from "@/lib/i18n";

export function WalletButton() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  if (!isConnected || !address) {
    return (
      <Button
        onClick={connect}
        disabled={isConnecting}
        className="bg-[var(--blue)] text-white hover:bg-[var(--blue-light)]"
      >
        {isConnecting ? t("wallet.connecting") : t("wallet.connect")}
      </Button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        className="min-h-[44px] border-white/15 bg-transparent font-[family-name:var(--font-mono)] text-[var(--offwhite)] hover:bg-white/5 hover:text-[var(--offwhite)]"
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        {IS_TESTNET && (
          <span className="mr-2 border border-white/15 px-1.5 py-0.5 text-[12px] uppercase text-[var(--offwhite)]/60">
            {t("wallet.testnetBadge")}
          </span>
        )}
        {truncateAddress(address)}
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
            onClick={() => {
              setMenuOpen(false);
              void disconnect();
            }}
          >
            {t("wallet.disconnect")}
          </button>
        </div>
      )}
    </div>
  );
}
