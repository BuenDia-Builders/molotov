import { describe, expect, it, vi, beforeEach } from "vitest";
import { MARKETPLACE_CONTRACT_ID } from "../stellar";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("./client", () => ({ getDb: () => ({ from: mocks.from }) }));

import { getWalletActivity } from "./activity";

const ARTIST = "GARTIST";
const OTHER = "GSELLER";
const BUYER = "GBUYER";

const XLM = (n: number) => String(n * 10_000_000);

type Rows = {
  tokens?: unknown[];
  listings?: unknown[];
  sales?: unknown[];
  transfers?: unknown[];
  /** tokens(token_id, artist) rows for the sale royalty attribution lookup. */
  tokenArtists?: unknown[];
};

/**
 * Minimal PostgREST-ish builder. The module runs two different `tokens`
 * queries — the mint list and the artist lookup — which this stub tells apart
 * by the selected columns (`minted_at_ledger` is only in the mint query).
 */
type DbRow = { data: unknown[]; error: null };
type Builder = PromiseLike<DbRow> & {
  select: (cols: string) => Builder;
  eq: () => Builder;
  in: () => Builder;
  or: () => Builder;
  limit: () => Builder;
};

function stubDb({
  tokens = [],
  listings = [],
  sales = [],
  transfers = [],
  tokenArtists = [],
}: Rows) {
  mocks.from.mockImplementation((table: string) => {
    let selectCols = "";
    const pick = () => {
      if (table === "tokens") {
        return selectCols.includes("minted_at_ledger") ? tokens : tokenArtists;
      }
      if (table === "listings") return listings;
      if (table === "sales") return sales;
      return transfers;
    };
    const result = () => Promise.resolve<DbRow>({ data: pick(), error: null });
    const builder: Builder = {
      then: (onfulfilled, onrejected) => result().then(onfulfilled, onrejected),
      select: (cols: string) => {
        selectCols = cols;
        return builder;
      },
      eq: () => builder,
      in: () => builder,
      or: () => builder,
      limit: () => builder,
    };
    return builder;
  });
}

function mint(id: number, over: Record<string, unknown> = {}) {
  return {
    token_id: id,
    minted_at_ledger: 10,
    minted_at_tx: "0xmint",
    minted_event_index: 0,
    minted_at: null,
    ...over,
  };
}

function listing(id: number, over: Record<string, unknown> = {}) {
  return {
    token_id: id,
    status: "active",
    price: XLM(100),
    created_at_ledger: 20,
    created_at_tx: "0xlist",
    created_event_index: 0,
    created_at: null,
    ...over,
  };
}

function sale(id: number, over: Record<string, unknown> = {}) {
  return {
    token_id: id,
    buyer: BUYER,
    seller: OTHER,
    price: XLM(100),
    royalty_paid: XLM(10),
    ledger: 30,
    event_index: 0,
    tx_hash: "0xsale",
    closed_at: null,
    ...over,
  };
}

function transfer(id: number, over: Record<string, unknown> = {}) {
  return {
    token_id: id,
    from_address: OTHER,
    to_address: BUYER,
    ledger: 40,
    event_index: 0,
    tx_hash: "0xtx",
    closed_at: null,
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("getWalletActivity — sources map to the six kinds", () => {
  it("returns an empty feed for a wallet with no rows anywhere", async () => {
    stubDb({});
    expect(await getWalletActivity(ARTIST)).toEqual([]);
  });

  it("maps tokens.artist to minted events", async () => {
    stubDb({
      tokens: [mint(1), mint(2, { minted_at_ledger: 20, minted_at_tx: "0xmint2" })],
    });

    const result = await getWalletActivity(ARTIST);

    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe("minted");
    expect(result[0].tokenId).toBe(2);
    expect(result[0].txHash).toBe("0xmint2");
  });

  it("maps active and sold listings to listed, cancelled to cancelled", async () => {
    stubDb({
      listings: [
        listing(1, { status: "active" }),
        listing(2, { status: "sold" }),
        listing(3, { status: "cancelled" }),
      ],
    });

    const result = await getWalletActivity(ARTIST);

    expect(result.map((e) => e.kind)).toEqual(["listed", "listed", "cancelled"]);
    const listed = result.find((e) => e.tokenId === 1);
    const cancelled = result.find((e) => e.tokenId === 3);
    if (listed?.kind !== "listed" || cancelled?.kind !== "cancelled") throw new Error("bad kind");
    expect(listed.priceXlm).toBe("100");
    // No price on a cancelled row: the issue lists price for listed/bought/sold only.
    expect("priceXlm" in cancelled).toBe(false);
  });

  it("maps sales to bought when the wallet is the buyer and sold when the seller", async () => {
    stubDb({
      sales: [sale(1, { buyer: ARTIST, ledger: 20 }), sale(2, { seller: ARTIST, ledger: 40 })],
    });

    const result = await getWalletActivity(ARTIST);

    expect(result.map((e) => e.kind)).toEqual(["sold", "bought"]);
    for (const e of result) {
      if (e.kind === "bought" || e.kind === "sold") {
        expect(e.priceXlm).toBe("100");
      }
    }
  });

  it("maps transfers from→sent and to→received", async () => {
    stubDb({
      transfers: [
        transfer(1, { from_address: ARTIST, ledger: 20 }),
        transfer(2, { to_address: ARTIST, ledger: 40 }),
      ],
    });

    const result = await getWalletActivity(ARTIST);

    expect(result.map((e) => e.kind)).toEqual(["received", "sent"]);
  });

  it("drops marketplace escrow movements from the transfer feed", async () => {
    stubDb({
      transfers: [
        transfer(1, { from_address: ARTIST, to_address: MARKETPLACE_CONTRACT_ID }),
        transfer(2, { from_address: MARKETPLACE_CONTRACT_ID, to_address: ARTIST }),
        transfer(3, { from_address: ARTIST, to_address: BUYER }),
      ],
    });

    const result = await getWalletActivity(ARTIST);

    expect(result.map((e) => e.tokenId)).toEqual([3]);
    expect(result[0].kind).toBe("sent");
  });

  it("reports a burn (from = address, to = NULL) as sent", async () => {
    stubDb({ transfers: [transfer(1, { from_address: ARTIST, to_address: null })] });

    const result = await getWalletActivity(ARTIST);

    expect(result[0].kind).toBe("sent");
    expect(result[0].tokenId).toBe(1);
  });
});

describe("getWalletActivity — royalty attribution", () => {
  it("shows royalty only when the wallet is the token's artist", async () => {
    stubDb({
      sales: [sale(1, { buyer: ARTIST, token_id: 1 }), sale(2, { seller: ARTIST, token_id: 2 })],
      // Only token 1 belongs to the profile address.
      tokenArtists: [{ token_id: 1, artist: ARTIST }],
    });

    const result = await getWalletActivity(ARTIST);

    const bought = result.find((e) => e.kind === "bought");
    const sold = result.find((e) => e.kind === "sold");
    if (bought?.kind !== "bought" || sold?.kind !== "sold") throw new Error("bad kind");
    expect(bought.royaltyXlm).toBe("10");
    expect(sold.royaltyXlm).toBeNull();
  });
});

describe("getWalletActivity — ordering and cap", () => {
  it("merges all sources and orders by (ledger, event_index) descending", async () => {
    stubDb({
      tokens: [mint(1, { minted_at_ledger: 100, minted_at_tx: "0xm" })],
      listings: [listing(2, { created_at_ledger: 200, created_at_tx: "0xl" })],
      sales: [sale(3, { ledger: 300, tx_hash: "0xs" })],
      transfers: [transfer(4, { ledger: 400, from_address: ARTIST, tx_hash: "0xt" })],
    });

    const result = await getWalletActivity(ARTIST);

    expect(result.map((e) => [e.kind, e.ledger])).toEqual([
      ["sent", 400],
      ["bought", 300],
      ["listed", 200],
      ["minted", 100],
    ]);
  });

  it("breaks ties by event_index and keeps stable order", async () => {
    stubDb({
      sales: [
        sale(1, { ledger: 200, event_index: 0, seller: ARTIST, tx_hash: "0xa" }),
        sale(2, { ledger: 200, event_index: 1, seller: ARTIST, tx_hash: "0xb" }),
      ],
    });

    const result = await getWalletActivity(ARTIST);

    expect(result.map((e) => e.txHash)).toEqual(["0xb", "0xa"]);
  });

  it("caps the merged feed at the requested limit", async () => {
    stubDb({
      sales: [
        sale(1, { seller: ARTIST, ledger: 1 }),
        sale(2, { seller: ARTIST, ledger: 2 }),
        sale(3, { seller: ARTIST, ledger: 3 }),
      ],
    });

    expect(await getWalletActivity(ARTIST, 2)).toHaveLength(2);
  });
});
