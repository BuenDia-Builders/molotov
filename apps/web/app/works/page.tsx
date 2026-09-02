import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { fetchIpfs, ipfsToGateway } from "@/lib/ipfs";
import { isDbConfigured, getRecentTokens, getActivePricesByTokenId } from "@/lib/db";
import { getSoldTokenIds } from "@/lib/db/landing";
import { getXlmUsdRate, formatUsdEstimate } from "@/lib/price";
import { BrowsePageHeader } from "@/components/browse-page-header";
import { BrowsePageStates } from "@/components/browse-page-states";
import { ArtworkCard } from "@/components/artwork-card";

export const metadata: Metadata = {
  title: "Discover — Molotov",
  description: "Browse digital artworks with on-chain royalties on Stellar.",
};

type Work = {
  token_id: number;
  title: string;
  artist: string;
  royalty_bps: number;
  price_xlm?: string;
  sold: boolean;
  image?: string;
};

type WorksResult =
  | { status: "ok"; works: Work[]; usdRate: number | null }
  | { status: "empty" }
  | { status: "error" };

async function getWorks(): Promise<WorksResult> {
  if (!isDbConfigured()) return { status: "error" };

  let tokens: Awaited<ReturnType<typeof getRecentTokens>>;
  let priceByToken: Awaited<ReturnType<typeof getActivePricesByTokenId>>;
  let soldIds: Set<number>;
  let usdRate: number | null;
  try {
    [tokens, priceByToken] = await Promise.all([getRecentTokens(48), getActivePricesByTokenId()]);
    [soldIds, usdRate] = await Promise.all([
      getSoldTokenIds(tokens.map((t) => t.token_id)),
      getXlmUsdRate(),
    ]);
  } catch {
    return { status: "error" };
  }

  if (!tokens.length) return { status: "empty" };

  const works: Work[] = await Promise.all(
    tokens.map(async (t) => {
      let title = `Token #${String(t.token_id).padStart(4, "0")}`;
      let image: string | undefined;

      try {
        const res = await fetchIpfs(t.token_uri, { signal: AbortSignal.timeout(5000) });
        const meta = await res.json();
        if (meta.name) title = meta.name;
        if (meta.image) image = ipfsToGateway(meta.image);
      } catch {
        /* fall through — show placeholder */
      }

      return {
        token_id: t.token_id,
        title,
        artist: t.artist,
        royalty_bps: t.royalty_bps,
        price_xlm: priceByToken.get(t.token_id),
        sold: soldIds.has(t.token_id),
        image,
      };
    }),
  );

  return { status: "ok", works, usdRate };
}

export default async function WorksPage() {
  const result = await getWorks();

  return (
    <div className="relative z-10 flex flex-1 flex-col min-h-screen">
      <Nav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-16 md:px-10 md:py-20 lg:px-16">
        {/* Header */}
        <BrowsePageHeader
          variant="works"
          count={result.status === "ok" ? result.works.length : 0}
        />

        {result.status === "error" && <BrowsePageStates status="error" variant="works" />}

        {result.status === "empty" && <BrowsePageStates status="empty" variant="works" />}

        {result.status === "ok" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 lg:gap-8">
            {result.works.map((work) => {
              const royaltyPct = Number(
                (work.royalty_bps / 100).toFixed(work.royalty_bps % 100 === 0 ? 0 : 1),
              );
              return (
                <ArtworkCard
                  key={work.token_id}
                  tokenId={work.token_id}
                  title={work.title}
                  imageUrl={work.image ?? null}
                  artistAddress={work.artist}
                  royaltyPct={royaltyPct}
                  priceXlm={work.price_xlm ?? null}
                  priceUsd={
                    work.price_xlm ? formatUsdEstimate(work.price_xlm, result.usdRate) : null
                  }
                  status={work.price_xlm ? "for-sale" : work.sold ? "sold" : "not-listed"}
                />
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
