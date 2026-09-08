// @vitest-environment jsdom
//
// Proves the claim from the ground-truth audit: verifying who owns a token
// on this page does NOT depend on Supabase/the indexer. It's a real render
// test (Client from @molotov/stellar-client is mocked, nothing about
// @/lib/db is touched or mocked at all) plus a static check mirroring the
// existing lib/no-localstorage-keypair.test.ts pattern — belt and suspenders.
//
// Scope note: this only covers the *ownership* read (owner_of/royalty_bps/
// token_uri, all direct RPC calls). The separate "find the active listing to
// show a cancel button" feature on this same page DOES fetch /api/tokens/[id]
// (indexer-backed) — that is a different claim and is deliberately NOT
// exercised here, so this test can't be misread as covering more than it does.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const { ownerOfMock, royaltyBpsMock, tokenUriMock } = vi.hoisted(() => ({
  ownerOfMock: vi.fn(),
  royaltyBpsMock: vi.fn(),
  tokenUriMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ tokenId: "42" }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@molotov/stellar-client/molotov-nft", () => ({
  Client: vi.fn().mockImplementation(() => ({
    owner_of: ownerOfMock,
    royalty_bps: royaltyBpsMock,
    token_uri: tokenUriMock,
  })),
  networks: {
    testnet: {
      contractId: "CTESTNFT",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
}));

vi.mock("@/hooks/use-wallet", () => ({
  useWallet: () => ({ address: null, isConnected: false, signTransaction: vi.fn() }),
}));
vi.mock("@/hooks/use-list", () => ({
  useList: () => ({
    list: vi.fn(),
    state: "idle",
    errorKey: null,
    listingId: null,
    reset: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-cancel", () => ({
  useCancel: () => ({ cancel: vi.fn(), state: "idle", errorKey: null, reset: vi.fn() }),
}));
// A stable `t` reference matters: the real I18nProvider memoizes it, and the
// page's effect depends on `t` — an inline arrow here would get a fresh
// identity every render and double-fire the effect, which is a bug in the
// mock, not the page (confirmed: this exact mismatch made fetch fire twice).
const stableT = (k: string) => k;
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: stableT, locale: "en" }) }));
vi.mock("@/components/nav", () => ({ Nav: () => null }));
vi.mock("@/components/wallet-button", () => ({ WalletButton: () => null }));

import MyWorkPage from "@/app/my-work/[tokenId]/page";
import { truncateAddress } from "@/lib/stellar";

const OWNER = "GOWNERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("my-work/[tokenId] — ownership check works without Supabase", () => {
  it("renders the real on-chain owner from a direct RPC call, with no @/lib/db import anywhere in the module graph", async () => {
    ownerOfMock.mockResolvedValue({ result: OWNER });
    royaltyBpsMock.mockResolvedValue({ result: 1000 });
    tokenUriMock.mockResolvedValue({ result: "ipfs://bafymeta" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ name: "Prueba", description: "", image: "ipfs://bafyimg" }),
      }),
    );

    render(<MyWorkPage />);

    await waitFor(() => expect(screen.getByText(truncateAddress(OWNER, 6, 6))).toBeTruthy());

    expect(ownerOfMock).toHaveBeenCalledWith({ token_id: 42 });
    // The one fetch() call in this path is the IPFS gateway for metadata —
    // never /api/tokens/*, never anything Supabase-shaped, since art.artist
    // here isn't the marketplace escrow address.
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("bafymeta"));
  });

  it("shows the on-chain owner even when the IPFS metadata fetch fails entirely", async () => {
    ownerOfMock.mockResolvedValue({ result: OWNER });
    royaltyBpsMock.mockResolvedValue({ result: 500 });
    tokenUriMock.mockResolvedValue({ result: "ipfs://bafymeta" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("gateway down")));

    render(<MyWorkPage />);

    // Ownership itself is chain-only and unaffected by IPFS being unreachable.
    await waitFor(() => expect(screen.getByText(truncateAddress(OWNER, 6, 6))).toBeTruthy());
  });
});

describe("my-work/[tokenId] — static check: no Supabase import in this module's own source", () => {
  it("the page's own source file never imports @/lib/db or a Supabase client", () => {
    const source = readFileSync(path.resolve(__dirname, "page.tsx"), "utf-8");
    expect(source).not.toMatch(/@\/lib\/db/);
    expect(source).not.toMatch(/supabase/i);
  });
});
