import Image from 'next/image';
import { notFound } from 'next/navigation';

export default async function TokenPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const resolvedParams = await params;
  const { tokenId } = resolvedParams;

  // Assuming local dev base URL; in production this would be handled via env vars
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/tokens/${tokenId}`, { cache: 'no-store' });
  
  if (!res.ok) {
    if (res.status === 404) notFound();
    throw new Error('Failed to fetch token data');
  }

  const { token, listing } = await res.json();

  const truncateAddr = (address: string) => {
    if (!address || address.length < 8) return address || '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-[var(--black)] grid grid-cols-1 md:grid-cols-2">
      {/* Left Column */}
      <div className="relative w-full min-h-[50vh] md:min-h-screen">
        <Image
          src={token.token_uri || '/placeholder.png'}
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
          <p className="font-display font-black text-[48px] leading-none text-[var(--blue)]">
            {(token.royalty_bps / 100).toFixed(0)}%
          </p>
          <p className="font-mono text-[10px] text-[var(--smoke)] mt-2">
            {token.recipients_count} {token.recipients_count === 1 ? 'recipient' : 'recipients'}
          </p>
        </div>

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
            <button className="w-full bg-[var(--blue)] text-white font-bold text-xs tracking-widest uppercase px-8 py-4">
              Buy now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
