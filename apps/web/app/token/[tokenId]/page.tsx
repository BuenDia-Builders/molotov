import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { BuyButton } from '@/components/buy-button';
import { Nav } from '@/components/nav';

function ipfsToGateway(uri: string): string {
  if (uri.startsWith('ipfs://')) return uri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
  return uri
}

function truncateAddr(address: string): string {
  if (!address || address.length < 8) return address || ''
  return `${address.slice(0, 6)}...${address.slice(-6)}`
}

async function getTokenData(tokenId: number) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      token: {
        token_id: tokenId,
        token_uri: '/icon-512.png',
        owner: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890XYZ',
        artist: 'GDEF1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890XYZ',
        royalty_bps: 1000,
        recipients_count: 2,
        minted_ledger: 1000,
      },
      listing: {
        listing_id: 'mock-listing-1',
        price: '500000000',
        currency: 'native',
        kind: 'open_edition',
        editions_total: 100,
        editions_sold: 42,
        ends_at: null,
      },
    }
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )

  const [tokenRes, listingRes] = await Promise.all([
    db
      .from('tokens')
      .select('token_id, token_uri, owner, artist, royalty_bps, recipients_count, minted_at_ledger')
      .eq('token_id', tokenId)
      .single(),
    db
      .from('listings')
      .select('listing_id, price, currency, kind, editions_total, editions_sold, ends_at')
      .eq('token_id', tokenId)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  if (tokenRes.error) return null

  // Fetch IPFS metadata to get the actual image URL and title
  let imageUrl = ''
  let title = ''
  const metaUri = tokenRes.data?.token_uri
  if (metaUri) {
    try {
      const metaRes = await fetch(ipfsToGateway(metaUri), { next: { revalidate: 3600 } })
      const meta = await metaRes.json()
      if (meta.image) imageUrl = ipfsToGateway(meta.image)
      if (meta.name) title = meta.name
    } catch { /* fall through to placeholder */ }
  }

  return { token: tokenRes.data, listing: listingRes.data, imageUrl, title }
}

export default async function TokenPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await params
  const id = Number(tokenId)
  if (isNaN(id)) notFound()

  const data = await getTokenData(id)
  if (!data) notFound()

  const { token, listing, imageUrl, title } = data
  const imageSrc = imageUrl || '/icon-512.png'

  return (
    <div className="min-h-screen bg-[var(--black)]">
      <Nav />
      <div className="grid grid-cols-1 md:grid-cols-2">
      {/* Left Column */}
      <div className="relative w-full min-h-[50vh] md:min-h-screen">
        <Image
          src={imageSrc}
          alt={`Token ${token.token_id}`}
          fill
          className="object-cover"
        />
      </div>

      {/* Right Column */}
      <div className="pt-16 pr-16 pl-8">
        <p className="font-mono text-[10px] text-[var(--smoke)] uppercase tracking-[0.3em] mb-2">
          #{String(token.token_id).padStart(4, '0')}
        </p>

        {title && (
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.75rem,4vw,3rem)] font-light leading-tight tracking-[-0.02em] text-[var(--offwhite)] mb-4 [font-variation-settings:'opsz'_72]">
            {title}
          </h1>
        )}

        <div className="w-12 h-px bg-[var(--ember)] mb-6" />

        <div className="space-y-2">
          <p className="font-mono text-[10px] text-[var(--smoke)]">
            ARTIST <span className="text-[var(--offwhite)] ml-2">{truncateAddr(token.artist)}</span>
          </p>
          <p className="font-mono text-[10px] text-[var(--smoke)]">
            OWNER <span className="text-[var(--offwhite)] ml-2">{truncateAddr(token.owner)}</span>
          </p>
        </div>

        {/* Royalty Block */}
        <div className="border border-[var(--ember)] p-6 mt-8">
          <p className="font-mono text-[10px] text-[var(--smoke)] uppercase tracking-[0.2em] mb-4">Royalty</p>
          <p className="font-[family-name:var(--font-display)] font-black text-[48px] leading-none text-[var(--blue)]">
            {(token.royalty_bps / 100).toFixed(0)}%
          </p>
          <p className="font-mono text-[10px] text-[var(--smoke)] mt-2">
            {token.recipients_count} {token.recipients_count === 1 ? 'recipient' : 'recipients'}
          </p>
        </div>

        {/* Manage link — shown when not already listed */}
        {!listing && (
          <div className="mt-4">
            <Link
              href={`/my-work/${token.token_id}`}
              className="font-mono text-[10px] text-[var(--smoke)] uppercase tracking-[0.2em] underline-offset-4 hover:text-[var(--offwhite)] hover:underline transition-colors"
            >
              List for sale →
            </Link>
          </div>
        )}

        {/* Active Listing Block */}
        {listing && (
          <div className="border border-[var(--blue)] p-6 mt-4">
            <p className="font-mono text-[10px] text-[var(--smoke)] uppercase tracking-[0.2em] mb-3">For sale</p>
            <p className="font-mono text-2xl text-[var(--offwhite)] mb-4">
              {(BigInt(listing.price) / 10_000_000n).toString()} XLM
            </p>
            {listing.kind === 'open_edition' && (
              <p className="font-mono text-[10px] text-[var(--smoke)] mb-4">
                {listing.editions_sold}/{listing.editions_total} editions sold
              </p>
            )}
            <BuyButton
              listingId={BigInt(listing.listing_id)}
              priceXlm={(BigInt(listing.price) / BigInt(10_000_000)).toString()}
            />
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
