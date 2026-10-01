/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { rpc } from "@stellar/stellar-sdk";
import { decodeEvent } from "./decode";
import { pollOnce } from "./poller";

const mocks = vi.hoisted(() => ({
  mockGetEvents: vi.fn(),
  mockGetLatestLedger: vi.fn(),
  mockDbRpc: vi.fn(),
  mockDbFrom: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", () => ({
  rpc: {
    Server: vi.fn(() => ({
      getEvents: mocks.mockGetEvents,
      getLatestLedger: mocks.mockGetLatestLedger,
    })),
    Api: { isSimulationError: vi.fn(() => false) },
  },
  xdr: { ScVal: { scvU32: vi.fn() } },
  scValToNative: vi.fn(),
  Contract: vi.fn(),
  TransactionBuilder: vi.fn(() => ({
    addOperation: vi.fn(() => ({ setTimeout: vi.fn(() => ({ build: vi.fn() })) })),
  })),
  Account: vi.fn(),
  Networks: {},
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc: mocks.mockDbRpc, from: mocks.mockDbFrom })),
}));

vi.mock("./config", () => ({
  SUPABASE_URL: "mock",
  SUPABASE_SECRET_KEY: "mock",
  RPC_URL: "mock",
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  NFT_ID: "mock",
  CONTRACT_IDS: ["mock"],
  POLL_LIMIT: 200,
  START_LEDGER: 0,
  MAX_POISON_RETRIES: 8,
}));

vi.mock("./decode", () => ({
  decodeEvent: vi.fn(),
}));

function makeEvent(overrides?: Partial<rpc.Api.EventResponse>): rpc.Api.EventResponse {
  return {
    topic: [],
    value: {} as any,
    txHash: "0xtx",
    ledger: 1001,
    ledgerClosedAt: "2026-07-23T12:00:00Z",
    inSuccessfulContractCall: true,
    ...overrides,
  } as rpc.Api.EventResponse;
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(decodeEvent).mockImplementation(
    (raw: any) => ({ kind: raw._mockKind ?? "Unknown", discriminant: "mock" }) as any,
  );

  // getCursor → starting position
  mocks.mockDbFrom.mockReturnValue({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => ({ data: { last_ledger: 1000, last_cursor: null }, error: null })),
      })),
    })),
  });

  // resolveOldestLedger probe
  mocks.mockGetEvents.mockResolvedValueOnce({
    events: [],
    latestLedger: 1001,
    cursor: null,
  });
});

// A failed apply_* must ABORT the poll without advancing the cursor. Skipping the
// event and moving on would drop it from the projection forever, since the RPC only
// serves events inside its retention window. See doc/indexer-operations.md
// ("Poison events — why the poller can block").
describe("pollOnce — a failed apply blocks the cursor", () => {
  it("rethrows and never advances the cursor", async () => {
    const events = [
      makeEvent({ txHash: "0x1", _mockKind: "Transfer" } as any),
      makeEvent({ txHash: "0x2", _mockKind: "ListingCreated" } as any),
      makeEvent({ txHash: "0x3", _mockKind: "Sold" } as any),
    ];

    mocks.mockGetEvents.mockResolvedValueOnce({
      events,
      latestLedger: 1001,
      cursor: "cursor-1",
    });

    mocks.mockDbRpc
      .mockResolvedValueOnce({ error: null }) // event 1 — apply_transfer
      .mockRejectedValueOnce(new Error("FK violation")) // event 2 — apply_listing_created
      .mockResolvedValueOnce({ error: null }); // record_indexer_error

    await expect(pollOnce()).rejects.toThrow("FK violation");

    const called = mocks.mockDbRpc.mock.calls.map((c) => c[0]);
    expect(called).toEqual(["apply_transfer", "apply_listing_created", "record_indexer_error"]);
    // The third event is never reached and the cursor never moves.
    expect(called).not.toContain("apply_sold");
    expect(called).not.toContain("advance_cursor");
  });

  it("records which event blocked the poll, for /health", async () => {
    const events = [
      makeEvent({ txHash: "0x1", ledger: 1005, _mockKind: "Transfer" } as any),
      makeEvent({ txHash: "0x2", ledger: 1005, _mockKind: "ListingCreated" } as any),
    ];

    mocks.mockGetEvents.mockResolvedValueOnce({
      events,
      latestLedger: 1005,
      cursor: "cursor-1",
    });

    mocks.mockDbRpc
      .mockResolvedValueOnce({ error: null })
      .mockRejectedValueOnce(new Error("FK violation"))
      .mockResolvedValueOnce({ error: null }); // record_indexer_error

    await expect(pollOnce()).rejects.toThrow("FK violation");

    expect(mocks.mockDbRpc).toHaveBeenCalledWith(
      "record_indexer_error",
      expect.objectContaining({
        p_ledger: 1005,
        p_event_index: 0,
        p_message: expect.stringContaining("ListingCreated"),
      }),
    );
  });

  it("logs the failing event with full context", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const events = [makeEvent({ txHash: "0x2", ledger: 1005, _mockKind: "ListingCreated" } as any)];

    mocks.mockGetEvents.mockResolvedValueOnce({
      events,
      latestLedger: 1005,
      cursor: "cursor-1",
    });

    mocks.mockDbRpc
      .mockRejectedValueOnce(new Error("FK violation"))
      .mockResolvedValueOnce({ error: null }); // record_indexer_error

    await expect(pollOnce()).rejects.toThrow("FK violation");

    expect(consoleSpy).toHaveBeenCalledWith(
      "[poller] failed to apply event",
      expect.objectContaining({
        ledger: 1005,
        txHash: "0x2",
        eventIndex: 0,
        kind: "ListingCreated",
      }),
    );

    consoleSpy.mockRestore();
  });
});

// The actual fix for incident 2026-09-08: a genuinely unresolvable event must
// eventually stop blocking the cursor instead of retrying forever — but only
// after MAX_POISON_RETRIES consecutive failures on that *exact* event, never
// on the first one.
describe("pollOnce — gives up after MAX_POISON_RETRIES and records a gap", () => {
  it("records a gap, continues applying the rest of the batch, and advances the cursor", async () => {
    const events = [
      makeEvent({ txHash: "0x1", ledger: 1005, _mockKind: "Transfer" } as any),
      makeEvent({ txHash: "0x2", ledger: 1005, _mockKind: "ListingCreated" } as any),
      makeEvent({ txHash: "0x3", ledger: 1005, _mockKind: "Sold" } as any),
    ];

    mocks.mockGetEvents.mockResolvedValueOnce({
      events,
      latestLedger: 1005,
      cursor: "cursor-1",
    });

    mocks.mockDbRpc
      .mockResolvedValueOnce({ error: null }) // apply_transfer
      .mockRejectedValueOnce(new Error("FK violation")) // apply_listing_created
      .mockResolvedValueOnce({ data: 8, error: null }) // record_indexer_error → hit the limit
      .mockResolvedValueOnce({ error: null }) // record_indexer_gap
      .mockResolvedValueOnce({ error: null }) // apply_sold — the batch continues
      .mockResolvedValueOnce({ error: null }); // advance_cursor

    const result = await pollOnce();

    expect(result.processedEvents).toBe(3);
    const called = mocks.mockDbRpc.mock.calls.map((c) => c[0]);
    expect(called).toEqual([
      "apply_transfer",
      "apply_listing_created",
      "record_indexer_error",
      "record_indexer_gap",
      "apply_sold",
      "advance_cursor",
    ]);
    expect(mocks.mockDbRpc).toHaveBeenCalledWith(
      "record_indexer_gap",
      expect.objectContaining({
        p_ledger: 1005,
        // event_index is counted per (ledger, txHash), and each event here has
        // its own distinct txHash — so this is 0, not its position in the array.
        p_event_index: 0,
        p_kind: "ListingCreated",
        p_retry_count: 8,
      }),
    );
  });

  it("keeps retrying (no gap, still throws) below the retry limit", async () => {
    const events = [makeEvent({ txHash: "0x2", ledger: 1005, _mockKind: "ListingCreated" } as any)];

    mocks.mockGetEvents.mockResolvedValueOnce({
      events,
      latestLedger: 1005,
      cursor: "cursor-1",
    });

    mocks.mockDbRpc
      .mockRejectedValueOnce(new Error("FK violation")) // apply_listing_created
      .mockResolvedValueOnce({ data: 3, error: null }); // record_indexer_error — below the limit of 8

    await expect(pollOnce()).rejects.toThrow("FK violation");

    const called = mocks.mockDbRpc.mock.calls.map((c) => c[0]);
    expect(called).not.toContain("record_indexer_gap");
    expect(called).not.toContain("advance_cursor");
  });
});

describe("pollOnce — happy path", () => {
  it("applies every event and advances the cursor", async () => {
    const events = [
      makeEvent({ txHash: "0x1", _mockKind: "Transfer" } as any),
      makeEvent({ txHash: "0x2", _mockKind: "Sold" } as any),
    ];

    mocks.mockGetEvents.mockResolvedValueOnce({
      events,
      latestLedger: 1001,
      cursor: "cursor-1",
    });

    mocks.mockDbRpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null }); // advanceCursor

    const result = await pollOnce();

    expect(result.processedEvents).toBe(2);
    expect(mocks.mockDbRpc).toHaveBeenCalledTimes(3);
    expect(mocks.mockDbRpc).toHaveBeenNthCalledWith(3, "advance_cursor", expect.any(Object));
  });
});

// The RPC only serves ledgerClosedAt inside its retention window, so the poller
// capturing it is the only chance we get: once an event ages out, its wall-clock
// timestamp is unrecoverable.
describe("pollOnce — ledger close time capture", () => {
  it("passes ledgerClosedAt through as p_closed_at", async () => {
    const events = [
      makeEvent({
        txHash: "0x1",
        ledgerClosedAt: "2026-07-23T12:34:56Z",
        _mockKind: "Sold",
      } as any),
    ];

    mocks.mockGetEvents.mockResolvedValueOnce({
      events,
      latestLedger: 1001,
      cursor: "cursor-1",
    });

    mocks.mockDbRpc.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: null }); // advanceCursor

    await pollOnce();

    expect(mocks.mockDbRpc).toHaveBeenNthCalledWith(
      1,
      "apply_sold",
      expect.objectContaining({ p_closed_at: "2026-07-23T12:34:56Z" }),
    );
  });

  it("sends null when the RPC omits the close time", async () => {
    const events = [makeEvent({ txHash: "0x1", _mockKind: "Transfer" } as any)];
    delete (events[0] as any).ledgerClosedAt;

    mocks.mockGetEvents.mockResolvedValueOnce({
      events,
      latestLedger: 1001,
      cursor: "cursor-1",
    });

    mocks.mockDbRpc.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: null }); // advanceCursor

    await pollOnce();

    expect(mocks.mockDbRpc).toHaveBeenNthCalledWith(
      1,
      "apply_transfer",
      expect.objectContaining({ p_closed_at: null }),
    );
  });
});
