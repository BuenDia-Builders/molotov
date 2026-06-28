"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { WalletButton } from "@/components/wallet-button";
import { TokenCard } from "@/components/token-card";
import { useWallet } from "@/hooks/use-wallet";
import { useI18n } from "@/lib/i18n";

type Token = {
  token_id: number;
  token_uri: string;
  owner: string;
  artist: string;
  royalty_bps: number;
  price_xlm?: string;
};

export default function MyWorksPage() {
  const { address, isConnected } = useWallet();
  const { t } = useI18n();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) {
      setTokens([]);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/tokens/mine?wallet=${encodeURIComponent(address)}`);
        if (!res.ok) {
          const detail = await res.json().catch(() => null);
          throw new Error(detail?.error ?? "Failed to fetch tokens");
        }
        const data = await res.json();
        if (active) {
          setTokens(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [address, isConnected]);

  return (
    <div className="relative z-10 flex flex-1 flex-col min-h-screen bg-black text-[var(--offwhite)]">
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16 md:px-10 md:py-24 lg:px-16">
        
        {/* Section Header Row */}
        <div className="flex justify-between items-baseline border-b border-[var(--ember)] pb-4 mb-8">
          <h1 className="font-[family-name:var(--font-display)] text-[40px] font-bold text-[var(--offwhite)] uppercase tracking-tight">
            {t("myWork.title")}
          </h1>
          {isConnected && address && !loading && !error && (
            <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--smoke)] uppercase tracking-[0.2em]">
              {tokens.length} {tokens.length === 1 ? t("myWork.tokensSingular") : t("myWork.tokensPlural")}
            </span>
          )}
        </div>

        {/* State Rendering */}
        {!isConnected || !address ? (
          /* Wallet Not Connected State */
          <div className="flex flex-col items-center justify-center py-32">
            <p className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--smoke)] uppercase tracking-[0.3em] mb-4 text-center">
              {t("myWork.connectWallet")}
            </p>
            <WalletButton />
          </div>
        ) : loading ? (
          /* Loading Skeleton */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-[var(--ember)] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          /* Error State */
          <div className="flex flex-col items-center justify-center py-32">
            <p className="font-[family-name:var(--font-mono)] text-[10px] text-red-500 uppercase tracking-[0.3em] mb-4 text-center">
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[var(--blue)] text-white font-bold text-xs tracking-widest uppercase px-8 py-3 transition-colors hover:opacity-80"
            >
              {t("artwork.reload")}
            </button>
          </div>
        ) : tokens.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-32">
            <p className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--smoke)] uppercase tracking-[0.3em] mb-6 text-center">
              {t("myWork.noWorks")}
            </p>
            <a
              href="/create"
              className="bg-[var(--blue)] text-white font-bold text-xs tracking-widest uppercase px-8 py-3 transition-colors hover:opacity-80"
            >
              {t("myWork.mintFirst")}
            </a>
          </div>
        ) : (
          /* Works Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokens.map((token) => (
              <TokenCard
                key={token.token_id}
                token_id={token.token_id}
                token_uri={token.token_uri}
                owner={token.owner}
                artist={token.artist}
                royalty_bps={token.royalty_bps}
                price={token.price_xlm}
              />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
