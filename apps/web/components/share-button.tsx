"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useI18n } from "@/lib/i18n";

type Props = {
  /** App-relative path to share, e.g. `/token/7` or `/artist/lucia`. */
  path: string;
};

/**
 * Builds a share link for the current visitor. With a wallet connected the
 * link carries `?r=<address>`, so a later purchase through it pays the
 * referral (out of the platform fee, never on top). Uses the native share
 * sheet when available, otherwise copies to the clipboard.
 */
export function ShareButton({ path }: Props) {
  const { address, isConnected } = useWallet();
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const share = async () => {
    const url = new URL(path, window.location.origin);
    if (address) url.searchParams.set("r", address);
    const link = url.toString();

    try {
      if (navigator.share) {
        await navigator.share({ url: link });
      } else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user dismissed the share sheet — nothing to do */
      return;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => void share()}
        className="inline-flex min-h-11 w-fit items-center gap-2 border border-white/15 px-5 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--offwhite)] transition-colors hover:border-white/40"
      >
        {copied ? t("share.copied") : t("share.cta")}
      </button>
      <p className="max-w-sm font-mono text-[10px] leading-relaxed text-[var(--smoke)]">
        {isConnected ? t("share.hintConnected") : t("share.hintDisconnected")}
      </p>
    </div>
  );
}
