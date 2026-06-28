"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ipfsToGateway } from "@/lib/ipfs";
import { truncateAddress } from "@/lib/stellar";
import { useI18n } from "@/lib/i18n";

export interface TokenCardProps {
  token_id: number;
  token_uri: string;
  owner: string;
  artist: string;
  royalty_bps: number;
  price?: string;
}

type Metadata = {
  name?: string;
  description?: string;
  image?: string;
};

export function TokenCard({ token_id, token_uri, owner, artist, royalty_bps, price }: TokenCardProps) {
  const { locale, t } = useI18n();
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(ipfsToGateway(token_uri));
        if (!res.ok) throw new Error("Metadata fetch failed");
        const data = await res.json();
        if (active) {
          setMetadata(data);
        }
      } catch (err) {
        console.error(`[TokenCard] Error fetching metadata for token ${token_id}:`, err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [token_uri, token_id]);

  const title = metadata?.name ?? t("artwork.untitled");
  const imageUrl = metadata?.image ? ipfsToGateway(metadata.image) : "";
  const displayRoyalty = locale === "es"
    ? (royalty_bps / 100).toFixed(1).replace(".", ",")
    : (royalty_bps / 100).toFixed(1);

  return (
    <Link
      href={`/token/${token_id}`}
      className="mockup-card token-card border border-white/12 bg-[#141414] aspect-[3/4] flex flex-col overflow-hidden relative p-7 select-none transition-colors hover:border-[var(--blue)]/40 rounded-none group"
    >
      {/* Media container */}
      <div className="tc-image flex-1 bg-gradient-to-br from-[#0D3FA8] to-[#1564FF] relative overflow-hidden -mx-7 -mt-7">
        <div className="tc-image-overlay absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(21,100,255,0.3)_0%,transparent_60%)] pointer-events-none" />

        {loading ? (
          <div className="w-full h-full animate-pulse bg-white/5" />
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-[family-name:var(--font-mono)] text-[10px] text-white/40 uppercase tracking-widest p-4 text-center">
            {t("artwork.imageFallback")}
          </div>
        )}
        <div className="tc-image-num absolute bottom-4 right-4 font-[family-name:var(--font-mono)] text-[48px] font-bold text-white/5 tracking-tight leading-none pointer-events-none select-none">
          {String(token_id).padStart(2, "0")}
        </div>
      </div>

      {/* Body container */}
      <div className="tc-body pt-5 flex flex-col">
        <div className="tc-artist font-[family-name:var(--font-mono)] text-[9px] tracking-[0.2em] uppercase text-[var(--blue)] mb-1.5 truncate">
          {truncateAddress(artist, 6, 6)}
        </div>
        <div className="tc-title font-[family-name:var(--font-display)] text-base font-bold text-[#F5F4ED] tracking-tight leading-normal truncate">
          {title}
        </div>

        <div className="tc-footer mt-4 pt-4 border-t border-white/12 flex justify-between items-center">
          <div className="flex flex-col">
            {price && (
              <div className="tc-price font-[family-name:var(--font-mono)] text-sm font-bold text-[#F5F4ED]">
                {price} XLM
              </div>
            )}
            <div className="tc-royalty font-[family-name:var(--font-mono)] text-[9px] tracking-[0.15em] uppercase text-[#6B6B6B] mt-0.5">
              {t("artwork.royalty")} · {displayRoyalty}%
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
