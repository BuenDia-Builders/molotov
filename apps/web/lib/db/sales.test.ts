import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("./client", () => ({ getDb: () => ({ from: mocks.from }) }));

import { getArtistEarnings } from "./sales";

const ARTIST = "GARTIST";
const OTHER = "GSELLER";
const BUYER = "GBUYER";

const XLM = (n: number) => String(n * 10_000_000);

type Rows = {
  tokens?: unknown[];
  sales?: unknown[];
  listings?: unknown[];
};

/** Minimal PostgREST-ish builder: each table resolves to its canned rows. */
function stubDb({ tokens = [], sales = [], listings = [] }: Rows) {
  mocks.from.mockImplementation((table: string) => {
    const data = table === "tokens" ? tokens : table === "sales" ? sales : listings;
    const result = Promise.resolve({ data, error: null });
    const builder: Record<string, unknown> = {
      then: result.then.bind(result),
      catch: result.catch.bind(result),
      finally: result.finally.bind(result),
    };
    for (const method of ["select", "eq", "in"]) {
      builder[method] = () => builder;
    }
    return builder;
  });
}

function token(id: number, over: Record<string, unknown> = {}) {
  return {
    token_id: id,
    token_uri: `ipfs://${id}`,
    royalty_bps: 1000,
    recipients_count: 1,
    ...over,
  };
}

function sale(over: Record<string, unknown> = {}) {
  return {
    ledger: 100,
    event_index: 0,
    tx_hash: "0xabc",
    closed_at: null,
    listing_id: "1",
    token_id: 1,
    buyer: BUYER,
    seller: OTHER,
    price: XLM(100),
    royalty_paid: XLM(10),
    fee_paid: XLM(2.5),
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("getArtistEarnings — the two income streams", () => {
  it("counts a resale by someone else as royalty, not as a sale of theirs", async () => {
    stubDb({ tokens: [token(1)], sales: [sale()] });

    const result = await getArtistEarnings(ARTIST);

    expect(result.royaltyXlm).toBe("10");
    expect(result.royaltySalesCount).toBe(1);
    expect(result.primaryXlm).toBe("0");
    expect(result.primarySalesCount).toBe(0);
    expect(result.activity[0].kind).toBe("royalty");
  });

  // Holds on both contract paths: with a primary_split the contract distributes
  // price − fee and records royalty_paid = 0; without one the artist collects the
  // royalty themselves plus the remainder — same total either way.
  it("nets price − fee when the artist is the seller, whichever path was used", async () => {
    stubDb({
      tokens: [token(1)],
      sales: [
        sale({ seller: ARTIST, royalty_paid: "0", event_index: 0 }), // primary_split path
        sale({ seller: ARTIST, royalty_paid: XLM(10), event_index: 1 }), // secondary path
      ],
    });

    const result = await getArtistEarnings(ARTIST);

    expect(result.primaryXlm).toBe("195"); // (100 − 2.5) × 2
    expect(result.primarySalesCount).toBe(2);
    expect(result.royaltyXlm).toBe("0");
  });

  it("adds both streams into the total", async () => {
    stubDb({
      tokens: [token(1)],
      sales: [
        sale({ seller: ARTIST, royalty_paid: "0", event_index: 0 }),
        sale({ seller: OTHER, event_index: 1 }),
      ],
    });

    const result = await getArtistEarnings(ARTIST);

    expect(result.primaryXlm).toBe("97.5");
    expect(result.royaltyXlm).toBe("10");
    expect(result.totalXlm).toBe("107.5");
  });
});

describe("getArtistEarnings — never overstate a shared royalty", () => {
  it("excludes multi-recipient royalties from the headline total", async () => {
    stubDb({
      tokens: [token(1, { recipients_count: 3 })],
      sales: [sale({ royalty_paid: XLM(30) })],
    });

    const result = await getArtistEarnings(ARTIST);

    // The recipient breakdown is not in the event stream, so it is reported apart.
    expect(result.royaltyXlm).toBe("0");
    expect(result.royaltySalesCount).toBe(0);
    expect(result.sharedRoyalty).toEqual({
      salesCount: 1,
      totalXlm: "30",
      recipients: 3,
    });
    // And it never appears in the activity feed as money they earned.
    expect(result.activity).toHaveLength(0);
  });

  it("reports no shared block when every token has a single recipient", async () => {
    stubDb({ tokens: [token(1)], sales: [sale()] });
    expect((await getArtistEarnings(ARTIST)).sharedRoyalty).toBeNull();
  });
});

describe("getArtistEarnings — listings are a projection, not income", () => {
  it("nets the platform fee off active listings and keeps them out of the total", async () => {
    stubDb({
      tokens: [token(1)],
      sales: [],
      listings: [{ token_id: 1, price: XLM(200) }],
    });

    const result = await getArtistEarnings(ARTIST);

    expect(result.listedXlm).toBe("195"); // 200 − 2.5%
    expect(result.listedCount).toBe(1);
    expect(result.totalXlm).toBe("0");
  });
});

describe("getArtistEarnings — precision and ordering", () => {
  it("sums in BigInt without float drift", async () => {
    stubDb({
      tokens: [token(1)],
      sales: [
        sale({ royalty_paid: "1", event_index: 0 }),
        sale({ royalty_paid: "2", event_index: 1 }),
      ],
    });

    expect((await getArtistEarnings(ARTIST)).royaltyXlm).toBe("0.0000003");
  });

  it("orders activity newest first by (ledger, event_index)", async () => {
    stubDb({
      tokens: [token(1)],
      sales: [
        sale({ ledger: 100, event_index: 0, tx_hash: "0xold" }),
        sale({ ledger: 200, event_index: 1, tx_hash: "0xnew" }),
        sale({ ledger: 200, event_index: 0, tx_hash: "0xmid" }),
      ],
    });

    const hashes = (await getArtistEarnings(ARTIST)).activity.map((e) => e.txHash);
    expect(hashes).toEqual(["0xnew", "0xmid", "0xold"]);
  });

  it("ranks per-token rows by total earned, not by string order", async () => {
    stubDb({
      tokens: [token(1), token(2)],
      sales: [
        sale({ token_id: 1, royalty_paid: XLM(9) }),
        sale({ token_id: 2, royalty_paid: XLM(100), event_index: 1 }),
      ],
    });

    const result = await getArtistEarnings(ARTIST);
    expect(result.perToken.map((r) => r.tokenId)).toEqual([2, 1]);
  });
});

describe("getArtistEarnings — first day", () => {
  it("returns zeroed totals for an artist with no tokens", async () => {
    stubDb({ tokens: [] });

    const result = await getArtistEarnings(ARTIST);

    expect(result.mintedCount).toBe(0);
    expect(result.totalXlm).toBe("0");
    expect(result.activity).toHaveLength(0);
    expect(result.perToken).toHaveLength(0);
  });

  it("ignores sales of tokens the artist did not mint", async () => {
    stubDb({ tokens: [token(1)], sales: [sale({ token_id: 99 })] });

    const result = await getArtistEarnings(ARTIST);
    expect(result.royaltyXlm).toBe("0");
    expect(result.activity).toHaveLength(0);
  });
});
