import { getDb } from "./client";

export type DbListing = {
  listing_id: string;
  token_id: number;
  price: string;
  currency: string;
  kind: string;
  editions_total: number | null;
  editions_sold: number | null;
  ends_at: string | null;
  seller: string;
  status: string;
};

const STROOP_PER_XLM = BigInt(10_000_000);

export function stroopsToXlm(price: string): string {
  return (BigInt(price) / STROOP_PER_XLM).toString();
}

export async function findActiveListingByToken(
  tokenId: number,
): Promise<Pick<
  DbListing,
  | "listing_id"
  | "price"
  | "currency"
  | "kind"
  | "editions_total"
  | "editions_sold"
  | "ends_at"
  | "seller"
> | null> {
  const { data } = await getDb()
    .from("listings")
    .select("listing_id, price, currency, kind, editions_total, editions_sold, ends_at, seller")
    .eq("token_id", tokenId)
    .eq("status", "active")
    .maybeSingle();
  return data ?? null;
}

export async function getActivePricesByTokenId(): Promise<Map<number, string>> {
  const { data } = await getDb().from("listings").select("token_id, price").eq("status", "active");

  const map = new Map<number, string>();
  for (const l of data ?? []) {
    if (l.token_id != null) map.set(l.token_id, stroopsToXlm(l.price));
  }
  return map;
}

export async function getPricesByListingIds(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data } = await getDb().from("listings").select("listing_id, price").in("listing_id", ids);

  const record: Record<string, string> = {};
  for (const l of data ?? []) {
    record[l.listing_id] = stroopsToXlm(l.price);
  }
  return record;
}

export async function getActiveListingsWithTokens(limit: number) {
  const { data, error } = await getDb()
    .from("listings")
    .select(
      `listing_id, token_id, seller, price, currency, kind,
       editions_total, editions_sold, ends_at,
       tokens(token_uri, royalty_bps, artist)`,
    )
    .eq("status", "active")
    .order("created_at_ledger", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
