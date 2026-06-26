'use client'

import useSWR from 'swr'
import Link from 'next/link'

// ─── types ────────────────────────────────────────────────────────────────────

interface Listing {
  listing_id: number
  token_id: number
  seller: string
  price: string
  currency: string
  kind: string
  editions_total: number | null
  editions_sold: number | null
  ends_at: number | null
  tokens: {
    token_uri: string
    royalty_bps: number
    artist: string
  } | null
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/** Convert stroops (string) to XLM with 2 decimal places */
function stroopsToXlm(stroops: string): string {
  const n = Number(stroops)
  if (Number.isNaN(n)) return '—'
  return (n / 10_000_000).toFixed(2)
}

/** Truncate bech32 address: first 4 + last 4 */
function truncate(addr: string): string {
  if (addr.length <= 8) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

// ─── inline card (replaces TokenCard until #20 lands) ────────────────────────

function ListingCard({ listing }: { listing: Listing }) {
  const xlm = stroopsToXlm(listing.price)
  const royaltyPct = listing.tokens ? (listing.tokens.royalty_bps / 100).toFixed(0) : null
  const isEdition = listing.kind === 'edition' && listing.editions_total != null

  return (
    <article className="min-w-[280px] max-w-[280px] shrink-0 rounded-lg border border-white/12 bg-[#0A0A0B] overflow-hidden flex flex-col">
      {/* media placeholder — real image via IPFS metadata in TokenCard #20 */}
      <div className="relative aspect-[4/5] bg-[#111113] flex items-center justify-center border-b border-white/8">
        <span className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.3em] text-[#F5F4ED]/20">
          obra
        </span>
        {royaltyPct && (
          <span className="absolute top-3 right-3 rounded-full border border-white/15 px-2 py-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] tracking-wider text-[#F5F4ED]/60">
            royalty {royaltyPct}%
          </span>
        )}
        {isEdition && (
          <span className="absolute bottom-3 left-3 font-[family-name:var(--font-geist-mono)] text-[10px] text-[#F5F4ED]/40">
            {listing.editions_sold ?? 0}/{listing.editions_total} vendidas
          </span>
        )}
      </div>

      {/* metadata */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[#F5F4ED]/40 truncate">
            #{listing.token_id}
          </p>
          <p className="font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED] shrink-0">
            {xlm} XLM
          </p>
        </div>
        <p className="font-[family-name:var(--font-geist-mono)] text-[11px] text-[#F5F4ED]/40 truncate">
          {truncate(listing.seller)}
        </p>
      </div>
    </article>
  )
}

// ─── section ──────────────────────────────────────────────────────────────────

export function ActivityFeed() {
  const { data, isLoading } = useSWR<Listing[]>('/api/listings/active', fetcher, {
    refreshInterval: 15_000,
  })

  return (
    <section
      id="actividad"
      className="scroll-mt-24 bg-[#0A0A0A] px-4 py-16 md:px-6 md:py-24"
    >
      {/* header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="font-[family-name:var(--font-geist-mono)] text-[10px] tracking-[0.3em] text-[#F5F4ED]/60 uppercase flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#0178DE] animate-pulse" />
          LIVE · LISTADOS ACTIVOS
        </p>
        <Link
          href="/galeria"
          className="font-[family-name:var(--font-geist-mono)] text-[10px] tracking-[0.3em] text-[#F5F4ED]/40 uppercase hover:text-[#F5F4ED]/80 transition-colors"
        >
          Ver todos →
        </Link>
      </div>

      {/* loading skeleton */}
      {isLoading && (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="min-w-[280px] h-[380px] rounded-lg bg-[#111113] animate-pulse shrink-0"
            />
          ))}
        </div>
      )}

      {/* empty state */}
      {!isLoading && (!data || data.length === 0) && (
        <p className="font-[family-name:var(--font-geist-mono)] text-[10px] text-[#F5F4ED]/40 uppercase tracking-widest py-12 text-center">
          Sin listados activos aún. Sé el primero en mintear.
        </p>
      )}

      {/* cards */}
      {!isLoading && data && data.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {data.map((listing) => (
            <ListingCard key={listing.listing_id} listing={listing} />
          ))}
        </div>
      )}
    </section>
  )
}
