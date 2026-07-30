import { describe, expect, it } from "vitest";
import { contractErrorKey } from "./contract-errors";

// ── helpers ───────────────────────────────────────────────────────────────────

/** Simulate how the Stellar SDK surfaces a contract panic. */
function marketErr(code: number): Error {
  return new Error(`Transaction simulation failed: Error(Contract, #${code})`);
}

function nftErr(code: number): Error {
  return new Error(`Contract call failed: Error(Contract, #${code})`);
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe("contractErrorKey", () => {
  // ── marketplace errors (buy path) ──────────────────────────────────────────

  it("ListingNotActive (#11) → transaction.errors.listingNotActive", () => {
    expect(contractErrorKey(marketErr(11), "buy")).toBe("transaction.errors.listingNotActive");
  });

  it("ListingExpired (#17) → transaction.errors.listingExpired", () => {
    expect(contractErrorKey(marketErr(17), "buy")).toBe("transaction.errors.listingExpired");
  });

  it("CurrencyNotAllowed (#12) → transaction.errors.currencyNotAllowed", () => {
    expect(contractErrorKey(marketErr(12), "buy")).toBe("transaction.errors.currencyNotAllowed");
  });

  it("ListingNotFound (#10) → transaction.errors.listingNotFound", () => {
    expect(contractErrorKey(marketErr(10), "buy")).toBe("transaction.errors.listingNotFound");
  });

  it("NotSeller (#14) → transaction.errors.notSeller", () => {
    expect(contractErrorKey(marketErr(14), "cancel")).toBe("transaction.errors.notSeller");
  });

  it("SplitNotAllowedForReseller (#18) → transaction.errors.splitNotAllowedForReseller", () => {
    expect(contractErrorKey(marketErr(18), "list")).toBe(
      "transaction.errors.splitNotAllowedForReseller",
    );
  });

  it("PriceBelowMinimum (#19) → transaction.errors.priceBelowMinimum", () => {
    expect(contractErrorKey(marketErr(19), "list")).toBe("transaction.errors.priceBelowMinimum");
  });

  // ── marketplace errors that fall through to generic ────────────────────────

  it("internal market error (#1 InvalidPrice) → transaction.errors.failed", () => {
    expect(contractErrorKey(marketErr(1), "list")).toBe("transaction.errors.failed");
  });

  it("internal market error (#9 MathOverflow) → transaction.errors.failed", () => {
    expect(contractErrorKey(marketErr(9), "buy")).toBe("transaction.errors.failed");
  });

  // ── NFT contract errors ────────────────────────────────────────────────────

  it("ArtistNotRegistered (#6) → transaction.errors.artistNotRegistered", () => {
    expect(contractErrorKey(nftErr(6))).toBe("transaction.errors.artistNotRegistered");
  });

  // ── cross-contract code collisions ─────────────────────────────────────────
  // Marketplace and NFT errors share the same numeric space. In a marketplace
  // context an unmapped market code must fall back to the generic message, not
  // resolve through the NFT table to an unrelated one.

  it("market #6 (SplitSharesMustSumTo10000) in list context → generic, not artistNotRegistered", () => {
    expect(contractErrorKey(marketErr(6), "list")).toBe("transaction.errors.failed");
  });

  it("market #7 (RemainderNegative) in buy context → generic, not royaltiesImmutable", () => {
    expect(contractErrorKey(marketErr(7), "buy")).toBe("transaction.errors.failed");
  });

  it("RoyaltiesImmutableAfterMint (#7) → transaction.errors.royaltiesImmutable", () => {
    expect(contractErrorKey(nftErr(7))).toBe("transaction.errors.royaltiesImmutable");
  });

  it("NFT internal error (#9 MathOverflow) → transaction.errors.failed", () => {
    expect(contractErrorKey(nftErr(9))).toBe("transaction.errors.failed");
  });

  // ── approval context ───────────────────────────────────────────────────────

  it("any error in approve context → transaction.errors.approveGeneric", () => {
    expect(contractErrorKey(new Error("connection reset"), "approve")).toBe(
      "transaction.errors.approveGeneric",
    );
  });

  it("contract error in approve context still → transaction.errors.approveGeneric", () => {
    // Even if the NFT emits a contract code during approve, surface the
    // approve-specific message since the user sees an "approving…" spinner.
    expect(contractErrorKey(nftErr(7), "approve")).toBe("transaction.errors.approveGeneric");
  });

  // ── user rejection ─────────────────────────────────────────────────────────

  it("user rejected → transaction.errors.rejected", () => {
    expect(contractErrorKey(new Error("User rejected the request."))).toBe(
      "transaction.errors.rejected",
    );
  });

  it("user declined → transaction.errors.rejected", () => {
    expect(contractErrorKey(new Error("User declined the transaction"))).toBe(
      "transaction.errors.rejected",
    );
  });

  // ── unknown / garbled errors → generic fallback ────────────────────────────

  it("plain network error → transaction.errors.failed", () => {
    expect(contractErrorKey(new Error("fetch failed"))).toBe("transaction.errors.failed");
  });

  it("string error → transaction.errors.failed", () => {
    expect(contractErrorKey("something went wrong")).toBe("transaction.errors.failed");
  });

  it("null error → transaction.errors.failed", () => {
    expect(contractErrorKey(null)).toBe("transaction.errors.failed");
  });

  it("undefined error → transaction.errors.failed", () => {
    expect(contractErrorKey(undefined)).toBe("transaction.errors.failed");
  });

  it("garbled contract error string → transaction.errors.failed", () => {
    expect(contractErrorKey(new Error("Error(Wasm, #11)"))).toBe("transaction.errors.failed");
  });

  it("out-of-range contract code → transaction.errors.failed", () => {
    expect(contractErrorKey(marketErr(999), "buy")).toBe("transaction.errors.failed");
  });

  // ── no context argument ────────────────────────────────────────────────────

  it("works without context argument", () => {
    expect(contractErrorKey(marketErr(11))).toBe("transaction.errors.listingNotActive");
  });
});
