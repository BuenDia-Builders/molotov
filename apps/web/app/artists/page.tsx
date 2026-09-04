import type { Metadata } from "next";
import {
  isDbConfigured,
  getActiveArtistAddresses,
  getAllTokens,
  getHandlesByAddress,
} from "@/lib/db";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { fetchIpfs, ipfsToGateway } from "@/lib/ipfs";
import { truncateAddress } from "@/lib/stellar";
import { BrowsePageHeader } from "@/components/browse-page-header";
import { BrowsePageStates } from "@/components/browse-page-states";
import { ArtistCard, type ArtistCard as ArtistCardType } from "@/components/artist-card";

export const metadata: Metadata = {
  title: "Artists — Molotov",
  description: "Discover artists publishing their work on Molotov with on-chain royalties.",
};

type ArtistsResult =
  | { status: "ok"; artists: ArtistCardType[] }
  | { status: "empty" }
  | { status: "error" };

async function getArtists(): Promise<ArtistsResult> {
  // An unconfigured or erroring DB is an ERROR, not an empty catalog — otherwise a
  // broken backend is indistinguishable from "no artists yet".
  if (!isDbConfigured()) return { status: "error" };

  let artistAddressList: Awaited<ReturnType<typeof getActiveArtistAddresses>>;
  let allTokens: Awaited<ReturnType<typeof getAllTokens>>;
  let handles: Awaited<ReturnType<typeof getHandlesByAddress>>;
  try {
    [artistAddressList, allTokens] = await Promise.all([
      getActiveArtistAddresses(),
      getAllTokens(),
    ]);

    if (!artistAddressList.length) return { status: "empty" };

    handles = await getHandlesByAddress(artistAddressList);
  } catch {
    return { status: "error" };
  }

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
        short: truncateAddress(address, 6, 6),
        handle: handles.get(address) ?? null,
        tokenCount: artistTokens.length,
        latestTokenId: latest?.token_id ?? null,
        latestImage,
        latestTitle,
      };
    }),
  );

  // Only show artists that have at least one work, sorted by token count desc
  const visible = cards.filter((c) => c.tokenCount > 0).sort((a, b) => b.tokenCount - a.tokenCount);
  return visible.length ? { status: "ok", artists: visible } : { status: "empty" };
}

export default async function ArtistsPage() {
  const result = await getArtists();

  return (
    <div className="relative z-10 flex flex-1 flex-col min-h-screen">
      <Nav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-16 md:px-10 md:py-20 lg:px-16">
        {/* Header */}
        <BrowsePageHeader
          variant="artists"
          count={result.status === "ok" ? result.artists.length : 0}
        />

        {result.status === "error" && <BrowsePageStates status="error" variant="artists" />}

        {result.status === "empty" && <BrowsePageStates status="empty" variant="artists" />}

        {result.status === "ok" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 lg:gap-8">
            {result.artists.map((artist) => (
              <ArtistCard key={artist.address} artist={artist} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
