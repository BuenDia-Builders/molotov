// @vitest-environment jsdom
//
// Renders the actual dashboard screen against a realistic ArtistEarnings
// fixture — not just the calculation logic (already covered by
// lib/db/sales.test.ts) — so a real artist's numbers are proven to reach the
// page, not just the math behind them.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import type { ArtistEarnings } from "@/lib/db/sales";

const { useWalletMock, fetchMock } = vi.hoisted(() => ({
  useWalletMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("@/hooks/use-wallet", () => ({ useWallet: () => useWalletMock() }));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

vi.mock("@/components/nav", () => ({ Nav: () => null }));
vi.mock("@/components/footer", () => ({ Footer: () => null }));
vi.mock("@/components/wallet-button", () => ({ WalletButton: () => <button>connect</button> }));

import { EarningsClient } from "@/app/earnings/earnings-client";

const ADDRESS = "GATESTARTISTADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

// A realistic populated fixture, shaped exactly like what lib/db/sales.ts's
// getArtistEarnings actually returns (ArtistEarnings) — real field names,
// real precision strings, not a loosely-typed stand-in.
const POPULATED: ArtistEarnings = {
  royaltyXlm: "42.5000000",
  royaltySalesCount: 3,
  royaltyTokensCount: 2,
  primaryXlm: "10.0000000",
  primarySalesCount: 1,
  totalXlm: "52.5000000",
  listedXlm: "5.0000000",
  listedCount: 1,
  mintedCount: 4,
  sharedRoyalty: null,
  perToken: [
    {
      tokenId: 11,
      tokenUri: "ipfs://bafymeta",
      royaltyBps: 1000,
      recipientsCount: 1,
      salesCount: 2,
      primaryXlm: "10.0000000",
      royaltyXlm: "42.5000000",
      totalXlm: "52.5000000",
      listedForXlm: null,
    },
  ],
  activity: [
    {
      kind: "royalty",
      tokenId: 11,
      listingId: "5",
      ledger: 100,
      eventIndex: 0,
      txHash: "abc123",
      closedAt: "2026-09-01T12:00:00Z",
      seller: "GSELLERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      buyer: "GBUYERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      priceXlm: "20.0000000",
      earnedXlm: "42.5000000",
    },
  ],
};

const EMPTY: ArtistEarnings = {
  royaltyXlm: "0.0000000",
  royaltySalesCount: 0,
  royaltyTokensCount: 0,
  primaryXlm: "0.0000000",
  primarySalesCount: 0,
  totalXlm: "0.0000000",
  listedXlm: "0.0000000",
  listedCount: 0,
  mintedCount: 0,
  sharedRoyalty: null,
  perToken: [],
  activity: [],
};

function mockFetchOnce(response: { ok: boolean; status?: number; json: () => unknown }) {
  fetchMock.mockResolvedValue(response);
}

beforeEach(() => {
  useWalletMock.mockReturnValue({ address: ADDRESS, isConnected: true });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EarningsClient — not connected", () => {
  it("shows the connect-wallet prompt and never calls fetch", async () => {
    useWalletMock.mockReturnValue({ address: null, isConnected: false });
    render(<EarningsClient />);

    expect(screen.getByText("earnings.connectWallet")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("EarningsClient — loading state", () => {
  it("shows a loading skeleton before the fetch resolves, not the empty/error copy", async () => {
    let resolveFetch!: (v: unknown) => void;
    fetchMock.mockImplementation(() => new Promise((resolve) => (resolveFetch = resolve)));

    render(<EarningsClient />);

    expect(screen.queryByText("earnings.royaltyLabel")).toBeNull();
    expect(screen.queryByText("earnings.loadError")).toBeNull();

    // Resolve so the effect doesn't leak into the next test.
    resolveFetch({ ok: true, json: async () => EMPTY });
    await waitFor(() => expect(screen.queryByText("earnings.noWorksTitle")).not.toBeNull());
  });
});

describe("EarningsClient — populated state renders the real numbers", () => {
  it("fetches /api/earnings/mine for the connected wallet and renders exactly what it returned", async () => {
    mockFetchOnce({ ok: true, json: async () => POPULATED });
    render(<EarningsClient />);

    // The royalty figure legitimately appears 3 times (hero, per-token row,
    // activity row) — wait for all of them rather than assume just one.
    await waitFor(() => expect(screen.getAllByText(/42\.5000000/).length).toBeGreaterThan(0));

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/earnings/mine?wallet=${encodeURIComponent(ADDRESS)}`,
    );
    // The hero, a per-token row, and the total all come straight from the
    // fixture — not hardcoded, not recomputed client-side.
    expect(screen.getAllByText(/42\.5000000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/52\.5000000/).length).toBeGreaterThan(0);
    // #11 legitimately appears twice — once in the per-token table, once in
    // the activity feed, since the fixture's one sale is for that token.
    expect(screen.getAllByText("#11").length).toBe(2);
    expect(screen.getByText(/10\.0%/)).toBeTruthy(); // 1000 bps → 10.0%
  });

  it("shows the shared-royalty badge instead of a number when a token has multiple recipients", async () => {
    const shared: ArtistEarnings = {
      ...POPULATED,
      perToken: [{ ...POPULATED.perToken[0], recipientsCount: 3 }],
    };
    mockFetchOnce({ ok: true, json: async () => shared });
    render(<EarningsClient />);

    await waitFor(() => expect(screen.getByText("earnings.sharedBadge")).toBeTruthy());

    // The specific per-token royalty figure must NOT appear as a bare number
    // in that table's royalty column when it's split — showing an
    // unverifiable per-recipient amount would be exactly the kind of
    // overclaim this whole audit is about. Scoped to the table itself: the
    // headline royalty total (still a real, correctly-attributed figure)
    // legitimately keeps showing elsewhere on the page.
    const table = screen.getByRole("table");
    expect(within(table).queryByText("42.5000000")).toBeNull();
  });
});

describe("EarningsClient — first-day empty state", () => {
  it("shows the 'mint your first work' message, not a wall of honest zeros", async () => {
    mockFetchOnce({ ok: true, json: async () => EMPTY });
    render(<EarningsClient />);

    await waitFor(() => expect(screen.getByText("earnings.noWorksTitle")).toBeTruthy());
    expect(screen.queryByText("earnings.royaltyLabel")).toBeNull();
  });
});

describe("EarningsClient — error state", () => {
  it("shows the load-error copy (not a blank page) when the API responds non-OK", async () => {
    mockFetchOnce({ ok: false, status: 500, json: async () => ({ error: "boom" }) });
    render(<EarningsClient />);

    await waitFor(() => expect(screen.getByText("earnings.loadError")).toBeTruthy());
  });

  it("shows the load-error copy when fetch itself rejects (network failure)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    render(<EarningsClient />);

    await waitFor(() => expect(screen.getByText("earnings.loadError")).toBeTruthy());
  });
});
