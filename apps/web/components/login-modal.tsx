"use client";

import { useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallet } from "@/hooks/use-wallet";
import { IS_TESTNET } from "@/lib/stellar";
import { useI18n } from "@/lib/i18n";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * objkt-style sign-in: social login (identity only — no key is created or stored;
 * see doc/adr/0002) or a wallet the visitor already has (Stellar Wallets Kit). A
 * social sign-in reaches an authenticated, no-signing-wallet state; WalletButton
 * shows that state as signed in (they can browse) and prompts for a wallet
 * only when they want to mint or buy.
 * Social buttons are testnet-gated like the rest of the Privy path.
 */
export function LoginModal({ open, onClose }: Props) {
  const { t } = useI18n();
  const { connect } = useWallet();
  const { login, authenticated } = usePrivy();

  const privyLogin = useCallback(
    (method: "email" | "google" | "twitter") => {
      onClose();
      if (authenticated) return;
      try {
        // Narrows Privy's modal to the chosen provider so each button feels
        // like a direct OAuth flow. Email is identity only — no key is created.
        login({ loginMethods: [method] });
      } catch {
        /* Privy not configured — the button simply does nothing harmful */
      }
    },
    [authenticated, login, onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("auth.title")}
    >
      <div
        className="mx-auto my-16 w-full max-w-sm border border-white/12 bg-[var(--black)] p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--offwhite)]">
            {t("auth.title")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("auth.close")}
            className="-m-3 flex min-h-11 min-w-11 items-center justify-center p-3 text-xl leading-none text-[var(--offwhite)]/50 hover:text-[var(--offwhite)]"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {IS_TESTNET && (
            <>
              <button
                onClick={() => privyLogin("email")}
                className="flex min-h-12 w-full items-center justify-center gap-3 border border-white/15 px-4 font-[family-name:var(--font-mono)] text-[12px] text-[var(--offwhite)] transition-colors hover:border-white/40"
              >
                <span aria-hidden className="text-base">
                  @
                </span>
                {t("auth.email")}
              </button>
              <button
                onClick={() => privyLogin("google")}
                className="flex min-h-12 w-full items-center justify-center gap-3 border border-white/15 px-4 font-[family-name:var(--font-mono)] text-[12px] text-[var(--offwhite)] transition-colors hover:border-white/40"
              >
                <span aria-hidden className="text-base">
                  G
                </span>
                {t("auth.google")}
              </button>
              <button
                onClick={() => privyLogin("twitter")}
                className="flex min-h-12 w-full items-center justify-center gap-3 border border-white/15 px-4 font-[family-name:var(--font-mono)] text-[12px] text-[var(--offwhite)] transition-colors hover:border-white/40"
              >
                <span aria-hidden className="text-base">
                  𝕏
                </span>
                {t("auth.x")}
              </button>
            </>
          )}
          <button
            onClick={() => {
              onClose();
              void connect();
            }}
            className="flex min-h-12 w-full items-center justify-center gap-3 border border-[var(--blue)]/60 px-4 font-[family-name:var(--font-mono)] text-[12px] text-[var(--offwhite)] transition-colors hover:border-[var(--blue)]"
          >
            <span aria-hidden className="text-base text-[var(--blue-light)]">
              ✦
            </span>
            {t("auth.stellar")}
          </button>
        </div>

        {IS_TESTNET && (
          <p className="mt-5 font-[family-name:var(--font-mono)] text-[10px] leading-relaxed text-[var(--smoke)]">
            {t("auth.note")}
          </p>
        )}
      </div>
    </div>
  );
}
