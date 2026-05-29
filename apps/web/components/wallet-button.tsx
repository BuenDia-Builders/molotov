"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { truncateAddress } from "@/lib/stellar";
import { useI18n } from "@/lib/i18n";

export function WalletButton() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside of it.
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
        className="bg-[#0178DE] text-white hover:bg-[#3493E5]"
      >
        {isConnecting ? t("wallet.connecting") : t("wallet.connect")}
      </Button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        className="border-white/15 bg-transparent font-[family-name:var(--font-geist-mono)] text-[#F5F4ED] hover:bg-white/5 hover:text-[#F5F4ED]"
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        {truncateAddress(address)}
      </Button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-44 rounded-md border border-white/12 bg-[#0A0A0B] p-1 shadow-lg"
        >
          <button
            role="menuitem"
            className="w-full rounded-sm px-3 py-2 text-left text-sm text-[#F5F4ED] hover:bg-white/5"
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
