'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'

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

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`)
    return r.json()
  })

function stroopsToXlm(stroops: string): string {
  const n = Number(stroops)
  if (Number.isNaN(n)) return '—'
  return (n / 10_000_000).toFixed(2)
}

function truncate(addr: string): string {
  if (addr.length <= 8) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

function ListingCard({ listing }: { listing: Listing }) {
  const { t } = useI18n()
  const xlm = stroopsToXlm(listing.price)
  const royaltyPct = listing.tokens ? (listing.tokens.royalty_bps / 100).toFixed(0) : null
  const isEdition = listing.kind === 'edition' && listing.editions_total != null

  return (
    <article className="min-w-[280px] max-w-[280px] shrink-0 border border-white/12 bg-[var(--black)] overflow-hidden flex flex-col">
      <div className="relative aspect-[4/5] bg-[var(--carbon)] flex items-center justify-center border-b border-white/8">
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--offwhite)]/20">
          {t('activity.workPlaceholder')}
        </span>
        {royaltyPct && (
          <span className="absolute top-3 right-3 border border-white/15 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] tracking-wider text-[var(--offwhite)]/60">
            {t('activity.royalty')} {royaltyPct}%
          </span>
        )}
        {isEdition && (
          <span className="absolute bottom-3 left-3 font-[family-name:var(--font-mono)] text-[10px] text-[var(--offwhite)]/40">
            {listing.editions_sold ?? 0}/{listing.editions_total} {t('activity.sold')}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)]/40 truncate">
            #{listing.token_id}
          </p>
          <p className="font-[family-name:var(--font-mono)] text-sm text-[var(--offwhite)] shrink-0">
            {xlm} XLM
          </p>
        </div>
        <p className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)]/40 truncate">
          {truncate(listing.seller)}
        </p>
      </div>
    </article>
  )
}

export function ActivityFeed() {
  const { t } = useI18n()
  const { data, isLoading } = useSWR<Listing[]>('/api/listings/active', fetcher, {
    refreshInterval: 15_000,
  })

  return (
    <section
      id="activity"
      className="scroll-mt-24 bg-[var(--black)] px-4 py-16 md:px-6 md:py-24"
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.3em] text-[var(--offwhite)]/60 uppercase flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 bg-[var(--blue)] animate-pulse" />
          {t('activity.liveLabel')}
        </p>
        <Link
          href="/works"
          className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.3em] text-[var(--offwhite)]/40 uppercase hover:text-[var(--offwhite)]/80 transition-colors"
        >
          {t('activity.viewAll')}
        </Link>
      </div>

      {isLoading && (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="min-w-[280px] h-[380px] bg-[var(--carbon)] animate-pulse shrink-0"
            />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <p className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--offwhite)]/40 uppercase tracking-widest py-12 text-center">
          {t('activity.noListings')}
        </p>
      )}

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
