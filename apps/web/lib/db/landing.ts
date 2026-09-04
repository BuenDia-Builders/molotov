import { getDb } from "./client";
import { getAllTokens } from "./tokens";
import { stroopsToXlm } from "../stroops";
import { getHandlesByAddress } from "./artists";

/**
 * Landing-page reads. Everything here reports REAL numbers from the
 * projection — small numbers are shown as they are, never inflated. All
 * token-derived data goes through the curated (non-hidden) token set.
 */

export type LandingStats = {
  works: number;
  artists: number;
  /** Completed marketplace sales of visible tokens. */
  collected: number;
};

export type TrendingWork = {
  tokenId: number;
  tokenUri: string;
  artist: string;
  priceXlm: string | null;
  sold: boolean;
};

export type LandingSale = {
  tokenId: number;
  txHash: string;
  closedAt: string | null;
  priceXlm: string;
  royaltyXlm: string;
};

export type FeaturedCreator = {
  address: string;
  handle: string | null;
  works: number;
  /** Sum of sale prices of their tokens, in XLM. */
  volumeXlm: string;
};

export type TopCollector = {
  address: string;
  purchases: number;
  spentXlm: string;
};

export type LandingCollection = {
  slug: string;
  title: string;
  coverTokenId: number | null;
  tokenCount: number;
};

type SaleRow = { token_id: number; buyer: string; seller: string; price: string };

/** Which of these token ids have at least one completed sale. */
export async function getSoldTokenIds(tokenIds: number[]): Promise<Set<number>> {
  if (tokenIds.length === 0) return new Set();
  const { data } = await getDb().from("sales").select("token_id").in("token_id", tokenIds);
  return new Set((data ?? []).map((s) => s.token_id as number));
}

/** Sales restricted to the curated token set — one fetch, shared by callers. */
async function getVisibleContext() {
  const tokens = await getAllTokens(); // already curation-filtered
  const visibleIds = new Set(tokens.map((t) => t.token_id));

  const { data } = await getDb()
    .from("sales")
    .select("token_id, buyer, seller, price")
    .in("token_id", [...visibleIds]);
  const sales = (data ?? []) as SaleRow[];

  return { tokens, visibleIds, sales };
}

export async function getLandingStats(): Promise<LandingStats> {
  const [{ tokens, sales }, { count: artistCount }] = await Promise.all([
    getVisibleContext(),
    getDb().from("artists").select("address", { count: "exact", head: true }).eq("revoked", false),
  ]);

  return {
    works: tokens.length,
    artists: artistCount ?? 0,
    collected: sales.length,
  };
}

/**
 * Works ranked for the "trending" fallback: on sale first, then sold, then
 * newest. With a testnet-sized catalog this is honest ordering, not a
 * popularity model — revisit when there is enough volume to rank on.
 */
export async function getTrendingWorks(limit = 10): Promise<TrendingWork[]> {
  const [{ tokens, sales }, prices] = await Promise.all([getVisibleContext(), getActivePrices()]);
  const soldIds = new Set(sales.map((s) => s.token_id));

  return tokens
    .map((t) => ({
      tokenId: t.token_id,
      tokenUri: t.token_uri,
      artist: t.artist,
      priceXlm: prices.get(t.token_id) ?? null,
      sold: soldIds.has(t.token_id),
    }))
    .sort((a, b) => {
      const score = (w: TrendingWork) => (w.priceXlm ? 2 : 0) + (w.sold ? 1 : 0);
      return score(b) - score(a) || b.tokenId - a.tokenId;
    })
    .slice(0, limit);
}

async function getActivePrices(): Promise<Map<number, string>> {
  const { data } = await getDb().from("listings").select("token_id, price").eq("status", "active");
  const map = new Map<number, string>();
  for (const l of data ?? []) if (l.token_id != null) map.set(l.token_id, stroopsToXlm(l.price));
  return map;
}

export async function getLandingSales(limit = 6): Promise<LandingSale[]> {
  const { visibleIds } = await getVisibleContext();
  const { data, error } = await getDb()
    .from("sales")
    .select("token_id, tx_hash, closed_at, price, royalty_paid, ledger, event_index")
    .in("token_id", [...visibleIds])
    .order("ledger", { ascending: false })
    .order("event_index", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((s) => ({
    tokenId: s.token_id,
    txHash: s.tx_hash,
    closedAt: s.closed_at,
    priceXlm: stroopsToXlm(BigInt(s.price)),
    royaltyXlm: stroopsToXlm(BigInt(s.royalty_paid)),
  }));
}

export async function getFeaturedCreators(limit = 6): Promise<FeaturedCreator[]> {
  const { tokens, sales } = await getVisibleContext();

  const byArtist = new Map<string, { works: number; volume: bigint }>();
  const artistOf = new Map(tokens.map((t) => [t.token_id, t.artist]));
  for (const t of tokens) {
    const entry = byArtist.get(t.artist) ?? { works: 0, volume: BigInt(0) };
    entry.works += 1;
    byArtist.set(t.artist, entry);
  }
  // A seller buying their own listing back is a real on-chain sale (the
  // contract has no reason to forbid it — see doc/marketplace-invariants.md)
  // but it is never a real transaction between two people, so it doesn't
  // count toward this leaderboard.
  for (const s of sales) {
    if (s.buyer === s.seller) continue;
    const artist = artistOf.get(s.token_id);
    if (!artist) continue;
    const entry = byArtist.get(artist);
    if (entry) entry.volume += BigInt(s.price);
  }

  const handles = await getHandlesByAddress([...byArtist.keys()]);

  return [...byArtist.entries()]
    .sort(
      (a, b) =>
        (b[1].volume > a[1].volume ? 1 : b[1].volume < a[1].volume ? -1 : 0) ||
        b[1].works - a[1].works,
    )
    .slice(0, limit)
    .map(([address, entry]) => ({
      address,
      handle: handles.get(address) ?? null,
      works: entry.works,
      volumeXlm: stroopsToXlm(entry.volume),
    }));
}

export async function getTopCollectors(limit = 6): Promise<TopCollector[]> {
  const { sales } = await getVisibleContext();
  const byBuyer = new Map<string, { purchases: number; spent: bigint }>();
  // Same wash-sale exclusion as getFeaturedCreators — buying your own listing
  // back shouldn't count as a purchase for this leaderboard either.
  for (const s of sales) {
    if (s.buyer === s.seller) continue;
    const entry = byBuyer.get(s.buyer) ?? { purchases: 0, spent: BigInt(0) };
    entry.purchases += 1;
    entry.spent += BigInt(s.price);
    byBuyer.set(s.buyer, entry);
  }
  return [...byBuyer.entries()]
    .sort((a, b) => (b[1].spent > a[1].spent ? 1 : b[1].spent < a[1].spent ? -1 : 0))
    .slice(0, limit)
    .map(([address, entry]) => ({
      address,
      purchases: entry.purchases,
      spentXlm: stroopsToXlm(entry.spent),
    }));
}

/** Team-curated collections; [] until the table exists (pre-migration 42P01). */
export async function getLandingCollections(limit = 10): Promise<LandingCollection[]> {
  const { data, error } = await getDb()
    .from("collections")
    .select("slug, title, cover_token_id, token_ids")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((c) => ({
    slug: c.slug,
    title: c.title,
    coverTokenId: c.cover_token_id,
    tokenCount: (c.token_ids ?? []).length,
  }));
}
