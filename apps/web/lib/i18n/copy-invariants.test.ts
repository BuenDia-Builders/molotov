// Not a general copy-quality test — this exists because two specific
// sentences in create.connectExplain were found, live in production copy, to
// overclaim what the product actually guarantees (ground-truth audit,
// 2026-09-08): they said the work itself "lives on Stellar" (only a pointer
// does — the file lives on IPFS) and promised the royalty "on every resale"
// without the marketplace scope the contract actually enforces. Fixed once;
// this is the guard against it quietly regressing back.
import { describe, expect, it } from "vitest";
import { es } from "@/lib/i18n/es";
import { en } from "@/lib/i18n/en";

// Phrases that would re-introduce the "the artwork itself is on Stellar"
// overclaim — the file/metadata live on IPFS; only a pointer and the
// ownership/royalty record are on-chain.
const WORK_LOCATION_OVERCLAIMS = [/obra queda grabada en stellar/i, /work is recorded on stellar/i];

// Phrases that would re-introduce the "royalty on every resale, unscoped"
// overclaim — the contract only enforces it on a marketplace resale
// (list → buy); a direct transfer() is not covered.
const UNSCOPED_ROYALTY_OVERCLAIMS = [
  /en cada reventa, para siempre/i,
  /on every resale, permanently/i,
];

describe("create.connectExplain — copy invariants (regression guard)", () => {
  it("es: does not claim the work itself lives on Stellar", () => {
    for (const pattern of WORK_LOCATION_OVERCLAIMS) {
      expect(es.create.connectExplain).not.toMatch(pattern);
    }
  });

  it("en: does not claim the work itself lives on Stellar", () => {
    for (const pattern of WORK_LOCATION_OVERCLAIMS) {
      expect(en.create.connectExplain).not.toMatch(pattern);
    }
  });

  it("es: does not promise the royalty on every resale without the marketplace scope", () => {
    for (const pattern of UNSCOPED_ROYALTY_OVERCLAIMS) {
      expect(es.create.connectExplain).not.toMatch(pattern);
    }
    // The corrected copy scopes it to Molotov specifically — check the fix
    // is still there, not just that the old wording is gone.
    expect(es.create.connectExplain).toMatch(/dentro de molotov/i);
  });

  it("en: does not promise the royalty on every resale without the marketplace scope", () => {
    for (const pattern of UNSCOPED_ROYALTY_OVERCLAIMS) {
      expect(en.create.connectExplain).not.toMatch(pattern);
    }
    expect(en.create.connectExplain).toMatch(/within molotov/i);
  });
});
