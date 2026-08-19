import { getDb } from "./client";
import { stroopsToXlm } from "../stroops";
import { MARKETPLACE_CONTRACT_ID } from "../stellar";

/**
 * On-chain activity feed for a profile, read from the indexer projection.
 *
 * Every row the wallet's own address is the actor of: minted, listed,
 * cancelled, bought, sold, and wallet-to-wallet transfers. The feed is a
 * unified reverse-chronological merge across the four projection tables,
 * sorted by (ledger, event_index) descending so ties stay stable.
 *
 * Known limits, both baked into the projection (not fixable here):
 *  - A cancelled listing has no cancelled_at_ledger/tx projected — the
 *    `ListingCancelled` event only flips `listings.status`. The row shows the
 *    original listing's creation position and tx, which is the only honest
 *    timestamp the schema has.
 *  - Marketplace escrow movements (seller→marketplace on list, marketplace→
 *    buyer on buy, marketplace→seller on cancel) already surface as the
 *    Listed / Bought / Cancelled rows, so transfers to or from the marketplace
 *    contract are dropped here. Burns (from = address, to = NULL) are reported
 *    as `sent`.
 */

type Base = {
  tokenId: number;
  ledger: number;
  eventIndex: number;
  txHash: string;
  closedAt: string | null;
};

export type ProfileActivity =
  | ({ kind: "minted" } & Base)
  | ({ kind: "listed"; priceXlm: string } & Base)
  | ({ kind: "cancelled" } & Base)
  | ({ kind: "bought"; priceXlm: string; royaltyXlm: string | null } & Base)
  | ({ kind: "sold"; priceXlm: string; royaltyXlm: string | null } & Base)
  | ({ kind: "sent" } & Base)
  | ({ kind: "received" } & Base);

type MintRow = {
  token_id: number;
  minted_at_ledger: number;
  minted_at_tx: string;
  minted_event_index: number;
  minted_at: string | null;
};

type ListingRow = {
  token_id: number;
  status: string;
  price: string;
  created_at_ledger: number;
  created_at_tx: string;
  created_event_index: number;
  created_at: string | null;
};

type SaleRow = {
  token_id: number;
  buyer: string;
  seller: string;
  price: string;
  royalty_paid: string;
  ledger: number;
  event_index: number;
  tx_hash: string;
  closed_at: string | null;
};

type TransferRow = {
  token_id: number;
  from_address: string | null;
  to_address: string | null;
  ledger: number;
  event_index: number;
  tx_hash: string;
  closed_at: string | null;
};

export async function getWalletActivity(address: string, limit = 50): Promise<ProfileActivity[]> {
  const db = getDb();

  const [mints, listings, sales, transfers] = await Promise.all([
    db
      .from("tokens")
      .select("token_id, minted_at_ledger, minted_at_tx, minted_event_index, minted_at")
      .eq("artist", address)
      .limit(limit),
    db
      .from("listings")
      .select(
        "token_id, status, price, created_at_ledger, created_at_tx, created_event_index, created_at",
      )
      .eq("seller", address)
      .limit(limit),
    db
      .from("sales")
      .select(
        "token_id, buyer, seller, price, royalty_paid, ledger, event_index, tx_hash, closed_at",
      )
      .or(`buyer.eq.${address},seller.eq.${address}`)
      .limit(limit),
    db
      .from("token_transfers")
      .select("token_id, from_address, to_address, ledger, event_index, tx_hash, closed_at")
      .or(`from_address.eq.${address},to_address.eq.${address}`)
      .limit(limit),
  ]);
  if (mints.error) throw mints.error;
  if (listings.error) throw listings.error;
  if (sales.error) throw sales.error;
  if (transfers.error) throw transfers.error;

  const mintRows = (mints.data ?? []) as MintRow[];
  const listingRows = (listings.data ?? []) as ListingRow[];
  const saleRows = (sales.data ?? []) as SaleRow[];
  const transferRows = (transfers.data ?? []) as TransferRow[];

  // Which tokens the address is the artist of, to attribute royalty on sales
  // of their own work. `sales.token_id` has no FK to `tokens`, so the lookup
  // has to be a separate query.
  const saleTokenIds = [...new Set(saleRows.map((s) => s.token_id))];
  let artistOf = new Map<number, string>();
  if (saleTokenIds.length) {
    const { data, error } = await db
      .from("tokens")
      .select("token_id, artist")
      .in("token_id", saleTokenIds);
    if (error) throw error;
    artistOf = new Map(
      ((data ?? []) as { token_id: number; artist: string }[]).map((t) => [t.token_id, t.artist]),
    );
  }

  const events: ProfileActivity[] = [];

  for (const t of mintRows) {
    events.push({
      kind: "minted",
      tokenId: t.token_id,
      ledger: t.minted_at_ledger,
      eventIndex: t.minted_event_index,
      txHash: t.minted_at_tx,
      closedAt: t.minted_at,
    });
  }

  for (const l of listingRows) {
    if (l.status === "cancelled") {
      events.push({
        kind: "cancelled",
        tokenId: l.token_id,
        ledger: l.created_at_ledger,
        eventIndex: l.created_event_index,
        txHash: l.created_at_tx,
        closedAt: l.created_at,
      });
    } else {
      events.push({
        kind: "listed",
        tokenId: l.token_id,
        ledger: l.created_at_ledger,
        eventIndex: l.created_event_index,
        txHash: l.created_at_tx,
        closedAt: l.created_at,
        priceXlm: stroopsToXlm(BigInt(l.price)),
      });
    }
  }

  for (const s of saleRows) {
    const isSeller = s.seller === address;
    events.push({
      kind: isSeller ? "sold" : "bought",
      tokenId: s.token_id,
      ledger: s.ledger,
      eventIndex: s.event_index,
      txHash: s.tx_hash,
      closedAt: s.closed_at,
      priceXlm: stroopsToXlm(BigInt(s.price)),
      royaltyXlm:
        artistOf.get(s.token_id) === address ? stroopsToXlm(BigInt(s.royalty_paid)) : null,
    });
  }

  for (const t of transferRows) {
    if (t.from_address === MARKETPLACE_CONTRACT_ID || t.to_address === MARKETPLACE_CONTRACT_ID) {
      continue;
    }
    events.push({
      kind: t.from_address === address ? "sent" : "received",
      tokenId: t.token_id,
      ledger: t.ledger,
      eventIndex: t.event_index,
      txHash: t.tx_hash,
      closedAt: t.closed_at,
    });
  }

  events.sort((a, b) => b.ledger - a.ledger || b.eventIndex - a.eventIndex);
  return events.slice(0, limit);
}
