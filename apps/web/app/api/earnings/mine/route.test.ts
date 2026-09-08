// @vitest-environment node
//
// Closes the loop the ground-truth audit flagged: the earnings dashboard's
// math is unit-tested (lib/db/sales.test.ts), but nothing proved the route
// the UI actually fetches calls that real function with the real wallet.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { isDbConfiguredMock, getArtistEarningsMock } = vi.hoisted(() => ({
  isDbConfiguredMock: vi.fn(),
  getArtistEarningsMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  isDbConfigured: () => isDbConfiguredMock(),
  getArtistEarnings: (wallet: string) => getArtistEarningsMock(wallet),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null, // never rate-limited in tests
}));

import { GET } from "@/app/api/earnings/mine/route";

const VALID_WALLET = "G".padEnd(56, "A");

function req(wallet?: string) {
  const url = wallet
    ? `http://localhost/api/earnings/mine?wallet=${encodeURIComponent(wallet)}`
    : "http://localhost/api/earnings/mine";
  return new NextRequest(url);
}

beforeEach(() => {
  isDbConfiguredMock.mockReturnValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/earnings/mine — real wiring to getArtistEarnings", () => {
  it("rejects a missing wallet param without ever touching the database", async () => {
    const res = await GET(req());
    expect(res.status).toBe(422);
    expect(getArtistEarningsMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed wallet (not a valid Stellar public key)", async () => {
    const res = await GET(req("not-a-real-address"));
    expect(res.status).toBe(422);
    expect(getArtistEarningsMock).not.toHaveBeenCalled();
  });

  it("returns 503 when Supabase isn't configured, before calling getArtistEarnings", async () => {
    isDbConfiguredMock.mockReturnValue(false);
    const res = await GET(req(VALID_WALLET));
    expect(res.status).toBe(503);
    expect(getArtistEarningsMock).not.toHaveBeenCalled();
  });

  it("calls getArtistEarnings with exactly the requested wallet and returns its result verbatim", async () => {
    const fixture = {
      royaltyXlm: "42.5000000",
      royaltySalesCount: 3,
      royaltyTokensCount: 2,
      primaryXlm: "10.0000000",
      primarySalesCount: 1,
      totalXlm: "52.5000000",
      listedXlm: "5.0000000",
      mintedCount: 4,
      sharedRoyalty: null,
      perToken: [],
      activity: [],
    };
    getArtistEarningsMock.mockResolvedValue(fixture);

    const res = await GET(req(VALID_WALLET));
    const body = await res.json();

    expect(getArtistEarningsMock).toHaveBeenCalledWith(VALID_WALLET);
    expect(res.status).toBe(200);
    expect(body).toEqual(fixture);
  });

  it("returns 500 (not a silent empty state) when getArtistEarnings itself throws", async () => {
    getArtistEarningsMock.mockRejectedValue(new Error("connection reset"));
    const res = await GET(req(VALID_WALLET));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("connection reset");
  });
});
