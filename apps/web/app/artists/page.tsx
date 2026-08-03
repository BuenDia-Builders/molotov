import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  isDbConfigured,
  getActiveArtistAddresses,
  getAllTokens,
  getHandlesByAddress,
} from "@/lib/db";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { fetchIpfs, ipfsToGateway } from "@/lib/ipfs";

export const metadata: Metadata = {
  title: "Artists — Molotov",
  description: "Discover artists publishing their work on Molotov with on-chain royalties.",
};

type ArtistCard = {
  address: string;
  short: string;
  /** Team-curated handle; the card shows it when it exists. */
  handle: string | null;
  tokenCount: number;
  latestTokenId: number | null;
  latestImage: string | null;
  latestTitle: string | null;
};

async function getArtists(): Promise<ArtistCard[]> {
  if (!isDbConfigured()) return [];

  const [artistAddressList, allTokens] = await Promise.all([
    getActiveArtistAddresses(),
    getAllTokens(),
  ]);

  if (!artistAddressList.length) return [];

  const handles = await getHandlesByAddress(artistAddressList);

  const artistSet = new Set(artistAddressList);
  const tokens = allTokens.filter((t) => artistSet.has(t.artist));

  const byArtist = new Map<string, typeof tokens>();
  for (const t of tokens) {
    if (!byArtist.has(t.artist)) byArtist.set(t.artist, []);
    byArtist.get(t.artist)!.push(t);
  }

  const cards = await Promise.all(
    artistAddressList.map(async (address) => {
      const artistTokens = byArtist.get(address) ?? [];
      const latest = artistTokens[0] ?? null;

      let latestImage: string | null = null;
      let latestTitle: string | null = null;

      if (latest?.token_uri) {
        try {
          const res = await fetchIpfs(latest.token_uri, { signal: AbortSignal.timeout(4000) });
          const meta = await res.json();
          if (meta.image) latestImage = ipfsToGateway(meta.image);
          if (meta.name) latestTitle = meta.name;
        } catch {
          /* fall through */
        }
      }

      return {
        address,
        short: `${address.slice(0, 6)}…${address.slice(-6)}`,
        handle: handles.get(address) ?? null,
        tokenCount: artistTokens.length,
        latestTokenId: latest?.token_id ?? null,
        latestImage,
        latestTitle,
      };
    }),
  );

  // Only show artists that have at least one work, sorted by token count desc
  return cards.filter((c) => c.tokenCount > 0).sort((a, b) => b.tokenCount - a.tokenCount);
}

function ArtistCard({ artist }: { artist: ArtistCard }) {
  const card = (
    <article className="group flex flex-col bg-[var(--carbon)] overflow-hidden transition-transform duration-300 hover:-translate-y-0.5">
      {/* Artwork thumbnail */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-[var(--blue-deep)] to-[var(--blue)]">
        {artist.latestImage ? (
          <Image
            src={artist.latestImage}
            alt={artist.latestTitle ?? artist.short}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-white/20">
              {artist.tokenCount > 0 ? "Preview unavailable" : "No works yet"}
            </span>
          </div>
        )}
        <span className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm border border-white/15 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.15em] text-white/60">
          {artist.tokenCount} {artist.tokenCount === 1 ? "work" : "works"}
        </span>
      </div>

      {/* Caption */}
      <div className="px-5 py-4">
        <p className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.2em] text-[var(--smoke)] mb-1">
          Artist
        </p>
        <p className="font-[family-name:var(--font-mono)] text-sm text-[var(--offwhite)] truncate">
          {artist.handle ?? artist.short}
        </p>
        {artist.latestTitle && (
          <p className="mt-1 font-[family-name:var(--font-display)] text-[var(--smoke)] text-sm truncate [font-variation-settings:'opsz'_18]">
            Latest: {artist.latestTitle}
          </p>
        )}
      </div>
    </article>
  );

  return <Link href={`/artist/${artist.handle ?? artist.address}`}>{card}</Link>;
}

export default async function ArtistsPage() {
  const artists = await getArtists();

  return (
    <div className="relative z-10 flex flex-1 flex-col min-h-screen">
      <Nav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-16 md:px-10 md:py-20 lg:px-16">
        {/* Header */}
        <div className="flex items-baseline justify-between border-b border-[var(--ember)] pb-5 mb-10">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.3em] text-[var(--smoke)] uppercase mb-1">
              Molotov
            </p>
            <h1 className="font-[family-name:var(--font-display)] font-black text-[clamp(2rem,5vw,3.5rem)] leading-none text-[var(--offwhite)]">
              Artists
            </h1>
          </div>
          {artists.length > 0 && (
            <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.2em] text-[var(--smoke)] uppercase">
              {artists.length} {artists.length === 1 ? "artist" : "artists"}
            </span>
          )}
        </div>

        {artists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--smoke)] mb-6">
              No artists registered yet
            </p>
            <Link
              href="/create"
              className="inline-flex h-12 items-center justify-center bg-[var(--blue)] px-8 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-white transition-opacity hover:opacity-80"
            >
              Be the first — Mint now
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 lg:gap-8">
            {artists.map((artist) => (
              <ArtistCard key={artist.address} artist={artist} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
