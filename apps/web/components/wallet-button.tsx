"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { privyIdentityEmail } from "@/hooks/use-signed-in";
import { useWallet } from "@/hooks/use-wallet";
import { HORIZON_URL, IS_TESTNET, STELLAR_NETWORK_NAME, truncateAddress } from "@/lib/stellar";
import { useI18n } from "@/lib/i18n";
import { useStellarWallet } from "@/lib/privy-stellar";
import { LoginModal } from "@/components/login-modal";

export function WalletButton({ theme = "dark" }: { theme?: "light" | "dark" }) {
  const { address, isConnected, isConnecting, connect, prewarm, disconnect, connectViaPrivy } =
    useWallet();
  const { logout, ready, authenticated, user: privyUser } = usePrivy();
  const privyEmail = privyIdentityEmail(privyUser);
  const isPrivyMode = authenticated && !!privyEmail;
  const { wallet: privyNativeWallet, address: privyNativeAddress } = useStellarWallet();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLight = theme === "light";
  const chipClass = isLight
    ? "border-black/20 text-[var(--black)] hover:bg-black/5 hover:text-[var(--black)]"
    : "border-white/15 text-[var(--offwhite)] hover:bg-white/5 hover:text-[var(--offwhite)]";
  const badgeClass = isLight
    ? "border-black/15 text-[var(--black)]/60"
    : "border-white/15 text-[var(--offwhite)]/60";

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

  // Social login is identity only. It wires a signer into WalletProvider ONLY if
  // Privy ever exposes a native Stellar wallet — it never generates or stores a key.
  // To mint or buy, the user connects their own wallet (Stellar Wallets Kit); that
  // wallet's address is where royalties are paid (see doc/adr/0002).
  useEffect(() => {
    if (!IS_TESTNET) return;
    if (!ready || !authenticated || isConnected) return;
    if (privyNativeAddress && privyNativeWallet) {
      connectViaPrivy(privyNativeAddress, privyNativeWallet.signXdr);
    }
  }, [ready, authenticated, isConnected, privyNativeAddress, privyNativeWallet, connectViaPrivy]);

  const handleDisconnect = async () => {
    setMenuOpen(false);
    await disconnect();
    if (authenticated) await logout();
  };

  // Signed in with a social account but no signing wallet yet. Identity only:
  // shown honestly, not as a silent failure — they connect a wallet to mint or buy.
  if ((!isConnected || !address) && isPrivyMode) {
    const socialName = privyEmail.length > 22 ? privyEmail.slice(0, 20) + "…" : privyEmail;
    return (
      <div ref={containerRef} className="relative">
        <Button
          variant="outline"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`min-h-[44px] bg-transparent font-[family-name:var(--font-mono)] ${chipClass}`}
        >
          {IS_TESTNET && (
            <span className={`mr-2 border px-1.5 py-0.5 text-[12px] uppercase ${badgeClass}`}>
              {t("wallet.testnetBadge")}
            </span>
          )}
          {socialName}
        </Button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-72 border border-white/12 bg-[var(--black)] pb-2"
          >
            <div className="border-b border-white/10 px-4 py-4">
              <p className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--offwhite)]">
                {socialName}
              </p>
              <p className="mt-2 font-[family-name:var(--font-mono)] text-[10px] leading-relaxed text-[var(--smoke)]">
                {t("wallet.noWalletHint")}
              </p>
            </div>
            <nav className="py-1">
              <Link
                href="/works"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-11 w-full items-center px-4 text-left font-[family-name:var(--font-mono)] text-[12px] text-[var(--offwhite)] hover:bg-white/5"
              >
                {t("wallet.browse")}
              </Link>
            </nav>
            <div className="p-2">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  void connect();
                }}
                className="flex min-h-11 w-full items-center justify-center bg-[var(--blue)] px-4 font-[family-name:var(--font-mono)] text-[12px] text-white hover:bg-[var(--blue-light)]"
              >
                {t("wallet.connect")}
              </button>
            </div>
            <div className="border-t border-white/10 pt-1">
              <button
                role="menuitem"
                onClick={handleDisconnect}
                className="flex min-h-11 w-full items-center px-4 text-left font-[family-name:var(--font-mono)] text-[12px] text-red-400 hover:bg-white/5"
              >
                {t("account.signOut")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!isConnected || !address) {
    return (
      <div ref={containerRef} className="relative">
        <Button
          onClick={() => {
            // Opening the sign-in modal is the earliest signal the user
            // intends to connect — warm the kit so WalletConnect is ready.
            prewarm();
            setMenuOpen(true);
          }}
          disabled={isConnecting}
          className="min-h-[44px] bg-[var(--blue)] text-white hover:bg-[var(--blue-light)]"
        >
          {isConnecting ? t("wallet.connecting") : t("nav.signIn")}
        </Button>
        <LoginModal open={menuOpen} onClose={() => setMenuOpen(false)} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        className={`min-h-[44px] bg-transparent font-[family-name:var(--font-mono)] ${chipClass}`}
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        {IS_TESTNET && (
          <span className={`mr-2 border px-1.5 py-0.5 text-[12px] uppercase ${badgeClass}`}>
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
        <AccountPanel
          address={address}
          displayName={
            isPrivyMode
              ? privyEmail.length > 22
                ? privyEmail.slice(0, 20) + "…"
                : privyEmail
              : truncateAddress(address, 6, 6)
          }
          onClose={() => setMenuOpen(false)}
          onSignOut={handleDisconnect}
        />
      )}
    </div>
  );
}

/**
 * objkt-style account panel: identity, XLM balance, the places that are
 * yours (profile, works, earnings) and sign-out. Balance comes from a
 * lightweight Horizon read; an unfunded account is a normal state, not an
 * error.
 */
function AccountPanel({
  address,
  displayName,
  onClose,
  onSignOut,
}: {
  address: string;
  displayName: string;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const { t } = useI18n();
  const [balance, setBalance] = useState<string | null | "unfunded">(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${HORIZON_URL}/accounts/${address}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setBalance("unfunded");
          return;
        }
        const data = await res.json();
        const native = (data.balances ?? []).find(
          (b: { asset_type: string }) => b.asset_type === "native",
        );
        if (!cancelled && native) setBalance(Number(native.balance).toFixed(2));
      })
      .catch(() => {
        /* leave the row blank on network failure */
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  const linkClass =
    "flex w-full min-h-11 items-center px-4 text-left font-[family-name:var(--font-mono)] text-[12px] text-[var(--offwhite)] hover:bg-white/5";

  return (
    <div
      role="menu"
      className="absolute right-0 z-50 mt-2 w-72 border border-white/12 bg-[var(--black)] pb-2"
    >
      {/* Identity */}
      <div className="border-b border-white/10 px-4 py-4">
        <p className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--offwhite)]">
          {displayName}
        </p>
        <button
          onClick={copy}
          className="mt-1 font-[family-name:var(--font-mono)] text-[10px] text-[var(--smoke)] hover:text-[var(--offwhite)]"
        >
          {copied
            ? t("account.copied")
            : `${truncateAddress(address, 8, 8)} · ${t("account.copyAddress")}`}
        </button>
        {IS_TESTNET && (
          <p className="mt-2 font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.2em] text-[var(--smoke)]">
            {t("wallet.networkLabel")} · {STELLAR_NETWORK_NAME}
          </p>
        )}
      </div>

      {/* Balance */}
      <div className="flex items-baseline justify-between border-b border-white/10 px-4 py-3">
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--smoke)]">
          {t("account.balance")}
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--offwhite)]">
          {balance === "unfunded"
            ? t("account.balanceUnavailable")
            : balance
              ? `${balance} XLM`
              : "…"}
        </span>
      </div>

      {/* Your places */}
      <nav className="py-1">
        <Link href={`/artist/${address}`} className={linkClass} onClick={onClose}>
          {t("account.profile")}
        </Link>
        <Link href="/my-work" className={linkClass} onClick={onClose}>
          {t("nav.myWork")}
        </Link>
        <Link href="/earnings" className={linkClass} onClick={onClose}>
          {t("nav.earnings")}
        </Link>
      </nav>

      <div className="border-t border-white/10 pt-1">
        <button
          role="menuitem"
          onClick={onSignOut}
          className="flex w-full min-h-11 items-center px-4 text-left font-[family-name:var(--font-mono)] text-[12px] text-red-400 hover:bg-white/5"
        >
          {t("account.signOut")}
        </button>
      </div>
    </div>
  );
}
