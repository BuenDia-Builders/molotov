import { getDb } from "./client";
import { stroopsToXlm } from "../stroops";

/**
 * Artist earnings — the two income streams, kept apart on purpose.
 *
 * An artist earns in two ways, and collapsing them into one number loses exactly
 * what makes this marketplace different:
 *
 *  1. PRIMARY — they sold their own work. `sales.seller` is their address.
 *     They net `price − fee_paid`. This holds on BOTH contract paths: listing with
 *     a `primary_split` distributes `price − fee` and records `royalty_paid = 0`,
 *     while listing without one falls to the secondary path where they collect the
 *     royalty *themselves* plus the remainder — same total.
 *     (contracts/marketplace/src/lib.rs:708-718)
 *
 *  2. ROYALTY — somebody else sold their work and money arrived anyway. They are
 *     `tokens.artist` but not `sales.seller`. They earn `sales.royalty_paid`.
 *     This is the product's whole argument, so it is reported separately.
 *
 * ── Known limit: who received the royalty is not recorded ──────────────────────
 * `sales.royalty_paid` is a single scalar. The `Sold` event flattens the royalty
 * recipient vector to one `i128` (contracts/marketplace/src/lib.rs:152), so the
 * recipient addresses are not in the event stream and cannot be recovered from the
 * projection. Attributing the whole amount to the artist is therefore only exact
 * when the token has a single recipient.
 *
 * `tokens.recipients_count` lets us detect that case precisely, so sales of
 * multi-recipient tokens are EXCLUDED from the headline totals and reported apart
 * (`sharedRoyalty`). The number we show big is never larger than what they got.
 */

/** Platform fee in basis points, fixed at marketplace construction (2.5%). */
const FEE_BPS = BigInt(250);
const BPS_DENOMINATOR = BigInt(10_000);

export type EarningKind = "primary" | "royalty";

export type EarningEvent = {
  kind: EarningKind;
  tokenId: number;
  listingId: string;
  ledger: number;
  eventIndex: number;
  txHash: string;
  /** ISO wall-clock time, or null for events indexed before timestamp capture. */
  closedAt: string | null;
  buyer: string;
  seller: string;
  priceXlm: string;
  /** What this artist earned from this sale, in XLM. */
  earnedXlm: string;
};

export type TokenEarnings = {
  tokenId: number;
  tokenUri: string | null;
  royaltyBps: number;
  /** >1 means the royalty is split and per-recipient amounts are unknowable. */
  recipientsCount: number;
  salesCount: number;
  primaryXlm: string;
  royaltyXlm: string;
  totalXlm: string;
  /** Price of the currently active listing, if any. */
  listedForXlm: string | null;
};

export type ArtistEarnings = {
  /** Total resale royalty that came back after the work stopped being theirs. */
  royaltyXlm: string;
  royaltySalesCount: number;
  royaltyTokensCount: number;
  /** Proceeds from selling their own work. */
  primaryXlm: string;
  primarySalesCount: number;
  totalXlm: string;
  /** Net they would receive if every active listing of theirs sold. Not income. */
  listedXlm: string;
  listedCount: number;
  /** Sales whose royalty is split across recipients — reported, never attributed. */
  sharedRoyalty: { salesCount: number; totalXlm: string; recipients: number } | null;
  mintedCount: number;
  perToken: TokenEarnings[];
  activity: EarningEvent[];
};

type SaleRow = {
  ledger: number;
  event_index: number;
  tx_hash: string;
  closed_at: string | null;
  listing_id: string;
  token_id: number;
  buyer: string;
  seller: string;
  price: string;
  royalty_paid: string;
  fee_paid: string;
};

type TokenRow = {
  token_id: number;
  token_uri: string | null;
  royalty_bps: number;
  recipients_count: number;
};

/** Seller's net on their own sale: the price minus the platform's cut. */
function primaryNet(price: bigint, feePaid: bigint): bigint {
  return price - feePaid;
}

export type PublicSale = {
  tokenId: number;
  txHash: string;
  closedAt: string | null;
  priceXlm: string;
  royaltyXlm: string;
};

/**
 * Recent sales of a set of tokens, for the public artist profile. Only what
 * the chain already makes public: price, royalty paid, when. No buyer/seller
 * addresses and no aggregation — the private earnings view stays /earnings.
 */
export async function getRecentSalesForTokens(
  tokenIds: number[],
  limit = 10,
): Promise<PublicSale[]> {
  if (!tokenIds.length) return [];
  const { data, error } = await getDb()
    .from("sales")
    .select("token_id, tx_hash, closed_at, price, royalty_paid, ledger, event_index")
    .in("token_id", tokenIds)
    .order("ledger", { ascending: false })
    .order("event_index", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((s) => ({
    tokenId: s.token_id,
    txHash: s.tx_hash,
    closedAt: s.closed_at,
    priceXlm: stroopsToXlm(BigInt(s.price)),
    royaltyXlm: stroopsToXlm(BigInt(s.royalty_paid)),
  }));
}

export async function getArtistEarnings(wallet: string): Promise<ArtistEarnings> {
  const db = getDb();

  const { data: tokenRows, error: tokensError } = await db
    .from("tokens")
    .select("token_id, token_uri, royalty_bps, recipients_count")
    .eq("artist", wallet);
  if (tokensError) throw tokensError;

  const tokens = (tokenRows ?? []) as TokenRow[];
  const tokenById = new Map(tokens.map((t) => [t.token_id, t]));
  const tokenIds = tokens.map((t) => t.token_id);

  const empty: ArtistEarnings = {
    royaltyXlm: "0",
    royaltySalesCount: 0,
    royaltyTokensCount: 0,
    primaryXlm: "0",
    primarySalesCount: 0,
    totalXlm: "0",
    listedXlm: "0",
    listedCount: 0,
    sharedRoyalty: null,
    mintedCount: tokens.length,
    perToken: [],
    activity: [],
  };

  if (!tokenIds.length) return empty;

  // Sales of this artist's tokens, plus their own active listings.
  const [salesResult, listingsResult] = await Promise.all([
    db
      .from("sales")
      .select(
        "ledger, event_index, tx_hash, closed_at, listing_id, token_id, buyer, seller, price, royalty_paid, fee_paid",
      )
      .in("token_id", tokenIds),
    db
      .from("listings")
      .select("token_id, price, status")
      .eq("seller", wallet)
      .eq("status", "active"),
  ]);
  if (salesResult.error) throw salesResult.error;
  if (listingsResult.error) throw listingsResult.error;

  const sales = (salesResult.data ?? []) as SaleRow[];
  const listings = (listingsResult.data ?? []) as { token_id: number; price: string }[];

  // ── aggregate, all in BigInt ────────────────────────────────────────────────
  let royaltyTotal = BigInt(0);
  let primaryTotal = BigInt(0);
  let royaltySales = 0;
  let primarySales = 0;
  let sharedTotal = BigInt(0);
  let sharedSales = 0;
  const sharedRecipients = new Set<number>();
  const royaltyTokens = new Set<number>();

  const perToken = new Map<number, { sales: number; primary: bigint; royalty: bigint }>();
  const bump = (tokenId: number) => {
    let entry = perToken.get(tokenId);
    if (!entry) {
      entry = { sales: 0, primary: BigInt(0), royalty: BigInt(0) };
      perToken.set(tokenId, entry);
    }
    return entry;
  };

  const activity: EarningEvent[] = [];

  for (const sale of sales) {
    const token = tokenById.get(sale.token_id);
    if (!token) continue; // not this artist's token

    const price = BigInt(sale.price);
    const entry = bump(sale.token_id);
    entry.sales += 1;

    if (sale.seller === wallet) {
      const earned = primaryNet(price, BigInt(sale.fee_paid));
      primaryTotal += earned;
      primarySales += 1;
      entry.primary += earned;
      activity.push(toEvent("primary", sale, price, earned));
      continue;
    }

    // Someone else sold this artist's work: the royalty came back to them.
    const royalty = BigInt(sale.royalty_paid);
    if (token.recipients_count > 1) {
      // Per-recipient amounts are not in the event stream — do not attribute.
      sharedTotal += royalty;
      sharedSales += 1;
      sharedRecipients.add(token.recipients_count);
      continue;
    }

    royaltyTotal += royalty;
    royaltySales += 1;
    royaltyTokens.add(sale.token_id);
    entry.royalty += royalty;
    activity.push(toEvent("royalty", sale, price, royalty));
  }

  // What they'd net if every active listing sold. For their own work that is
  // price − fee; the royalty would come back to them either way.
  let listedTotal = BigInt(0);
  const listedByToken = new Map<number, string>();
  for (const listing of listings) {
    const price = BigInt(listing.price);
    listedTotal += price - (price * FEE_BPS) / BPS_DENOMINATOR;
    listedByToken.set(listing.token_id, stroopsToXlm(price));
  }

  activity.sort((a, b) => b.ledger - a.ledger || b.eventIndex - a.eventIndex);

  // Sorted by total earned so "which work pays me most" is the first thing read.
  // Sort on the BigInt total, then format — never sort formatted strings.
  const perTokenList: TokenEarnings[] = tokens
    .map((token) => {
      const entry = perToken.get(token.token_id) ?? {
        sales: 0,
        primary: BigInt(0),
        royalty: BigInt(0),
      };
      return { token, entry, total: entry.primary + entry.royalty };
    })
    .sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0))
    .map(({ token, entry, total }) => ({
      tokenId: token.token_id,
      tokenUri: token.token_uri || null,
      royaltyBps: token.royalty_bps,
      recipientsCount: token.recipients_count,
      salesCount: entry.sales,
      primaryXlm: stroopsToXlm(entry.primary),
      royaltyXlm: stroopsToXlm(entry.royalty),
      totalXlm: stroopsToXlm(total),
      listedForXlm: listedByToken.get(token.token_id) ?? null,
    }));

  return {
    royaltyXlm: stroopsToXlm(royaltyTotal),
    royaltySalesCount: royaltySales,
    royaltyTokensCount: royaltyTokens.size,
    primaryXlm: stroopsToXlm(primaryTotal),
    primarySalesCount: primarySales,
    totalXlm: stroopsToXlm(royaltyTotal + primaryTotal),
    listedXlm: stroopsToXlm(listedTotal),
    listedCount: listings.length,
    sharedRoyalty: sharedSales
      ? {
          salesCount: sharedSales,
          totalXlm: stroopsToXlm(sharedTotal),
          recipients: Math.max(...sharedRecipients),
        }
      : null,
    mintedCount: tokens.length,
    perToken: perTokenList,
    activity,
  };
}

function toEvent(kind: EarningKind, sale: SaleRow, price: bigint, earned: bigint): EarningEvent {
  return {
    kind,
    tokenId: sale.token_id,
    listingId: sale.listing_id,
    ledger: sale.ledger,
    eventIndex: sale.event_index,
    txHash: sale.tx_hash,
    closedAt: sale.closed_at,
    buyer: sale.buyer,
    seller: sale.seller,
    priceXlm: stroopsToXlm(price),
    earnedXlm: stroopsToXlm(earned),
  };
}
