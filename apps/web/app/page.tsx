import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Manifesto } from "@/components/manifesto";
import { FinalCta } from "@/components/final-cta";
import { HeroCarousel, type HeroSlide } from "@/components/landing/hero-carousel";
import { StatsTagline } from "@/components/landing/stats-tagline";
import { TrendingSection, type TrendingItem } from "@/components/landing/trending-section";
import { RecentSales, type SaleCard } from "@/components/landing/recent-sales";
import { FeaturedPeople } from "@/components/landing/featured-people";
import {
  isDbConfigured,
  getLandingStats,
  getTrendingWorks,
  getLandingSales,
  getFeaturedCreators,
  getTopCollectors,
  getLandingCollections,
  getHandlesByAddress,
  type LandingStats,
} from "@/lib/db";
import { fetchIpfs, ipfsToGateway } from "@/lib/ipfs";
import { getXlmUsdRate, formatUsdEstimate } from "@/lib/price";

export const revalidate = 300;

type Meta = { title: string | null; image: string | null };

/** Metadata JSON → {title,image}, tolerant of every failure mode. */
async function hydrate(tokenUri: string | null): Promise<Meta> {
  if (!tokenUri) return { title: null, image: null };
  try {
    const res = await fetchIpfs(tokenUri, {
      revalidate: 3600,
      signal: AbortSignal.timeout(4000),
    });
    const meta = await res.json();
    return {
      title: meta.name ?? null,
      image: meta.image ? ipfsToGateway(meta.image) : null,
    };
  } catch {
    return { title: null, image: null };
  }
}

const EMPTY_STATS: LandingStats = { works: 0, artists: 0, collected: 0 };

async function getLandingData() {
  if (!isDbConfigured()) {
    return {
      stats: EMPTY_STATS,
      slides: [] as HeroSlide[],
      trending: [] as TrendingItem[],
      collections: [],
      sales: [] as SaleCard[],
      creators: [],
      collectors: [],
    };
  }

  const [stats, works, collections, rawSales, creators, collectors, usdRate] = await Promise.all([
    getLandingStats(),
    getTrendingWorks(10),
    getLandingCollections(10),
    getLandingSales(6),
    getFeaturedCreators(6),
    getTopCollectors(6),
    getXlmUsdRate(),
  ]);
  const handleByAddress = await getHandlesByAddress([...new Set(works.map((w) => w.artist))]);

  // One hydration pass for everything the sections need.
  const uriByToken = new Map(works.map((w) => [w.tokenId, w.tokenUri]));
  const metaEntries = await Promise.all(
    [...uriByToken.entries()].map(async ([tokenId, uri]) => [tokenId, await hydrate(uri)] as const),
  );
  const metaByToken = new Map<number, Meta>(metaEntries);
  // Sales may reference tokens outside the trending set — hydrate the misses.
  const missing = rawSales.filter((s) => !metaByToken.has(s.tokenId));
  if (missing.length) {
    const { getAllTokens } = await import("@/lib/db");
    const all = await getAllTokens();
    const uriOf = new Map(all.map((t) => [t.token_id, t.token_uri]));
    await Promise.all(
      missing.map(async (s) => {
        metaByToken.set(s.tokenId, await hydrate(uriOf.get(s.tokenId) ?? null));
      }),
    );
  }

  const titled = (tokenId: number) => metaByToken.get(tokenId)?.title ?? `Obra #${tokenId}`;

  const trending: TrendingItem[] = works.map((w) => ({
    tokenId: w.tokenId,
    title: titled(w.tokenId),
    artist: w.artist,
    artistHandle: handleByAddress.get(w.artist) ?? null,
    image: metaByToken.get(w.tokenId)?.image ?? null,
    priceXlm: w.priceXlm,
    priceUsd: w.priceXlm ? formatUsdEstimate(w.priceXlm, usdRate) : null,
    sold: w.sold,
  }));

  const slides: HeroSlide[] = trending
    .filter((w) => w.image)
    .slice(0, 5)
    .map((w) => ({
      tokenId: w.tokenId,
      image: w.image as string,
      title: w.title,
      artist: w.artist,
      artistHandle: w.artistHandle,
      priceXlm: w.priceXlm,
      priceUsd: w.priceUsd,
    }));

  const sales: SaleCard[] = rawSales.map((s) => ({
    tokenId: s.tokenId,
    title: titled(s.tokenId),
    image: metaByToken.get(s.tokenId)?.image ?? null,
    priceXlm: s.priceXlm,
    royaltyXlm: s.royaltyXlm,
    closedAt: s.closedAt,
    txHash: s.txHash,
  }));

  return { stats, slides, trending, collections, sales, creators, collectors };
}

export default async function Home() {
  const { stats, slides, trending, collections, sales, creators, collectors } =
    await getLandingData();

  return (
    <div className="relative z-10 flex flex-1 flex-col">
      <Nav />
      <main className="flex flex-1 flex-col">
        <HeroCarousel slides={slides} />
        <StatsTagline stats={stats} />
        <TrendingSection collections={collections} works={trending} />
        <RecentSales sales={sales} />
        <FeaturedPeople creators={creators} collectors={collectors} />
        <Manifesto />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
