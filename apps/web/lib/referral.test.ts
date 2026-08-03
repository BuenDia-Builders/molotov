import { describe, expect, it } from "vitest";
import {
  REFERRAL_TTL_MS,
  clearReferralAttribution,
  getReferralAttribution,
  isValidReferrer,
  saveReferralAttribution,
  type StringStorage,
} from "./referral";

const REFERRER = "GANXCETUVUUILGJPVEZWM7EH66IZM5OICUPMNUWNXKIBRK425MUKZERM";
const OTHER = "GBLTXF46JTCGMWFJASQLVXMMA36OAZTU6BPXDVAULKMTQQQVOWMDKUYT";

function memoryStorage(): StringStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("isValidReferrer", () => {
  it("accepts a well-formed Stellar public key", () => {
    expect(isValidReferrer(REFERRER)).toBe(true);
  });

  it("rejects garbage, contract addresses, and non-strings", () => {
    expect(isValidReferrer("not-an-address")).toBe(false);
    expect(isValidReferrer("CB6T6DOYV2JCD36ZE43ESXNGCL2GBDARCZNRVYQWOXGTZNJBWB72K7DU")).toBe(false);
    expect(isValidReferrer(REFERRER.toLowerCase())).toBe(false);
    expect(isValidReferrer(REFERRER.slice(0, 40))).toBe(false);
    expect(isValidReferrer(null)).toBe(false);
    expect(isValidReferrer(42)).toBe(false);
  });
});

describe("referral attribution", () => {
  it("stores and returns a token-specific attribution", () => {
    const storage = memoryStorage();
    saveReferralAttribution(REFERRER, 7, 1000, storage);
    expect(getReferralAttribution(7, 2000, storage)).toBe(REFERRER);
  });

  it("last touch wins for the same token", () => {
    const storage = memoryStorage();
    saveReferralAttribution(REFERRER, 7, 1000, storage);
    saveReferralAttribution(OTHER, 7, 2000, storage);
    expect(getReferralAttribution(7, 3000, storage)).toBe(OTHER);
  });

  it("token-specific attribution beats the site-wide one", () => {
    const storage = memoryStorage();
    saveReferralAttribution(OTHER, undefined, 2000, storage); // site-wide, later
    saveReferralAttribution(REFERRER, 7, 1000, storage); // token-specific, earlier
    expect(getReferralAttribution(7, 3000, storage)).toBe(REFERRER);
  });

  it("falls back to the site-wide attribution for tokens never visited via a link", () => {
    const storage = memoryStorage();
    saveReferralAttribution(REFERRER, undefined, 1000, storage);
    expect(getReferralAttribution(999, 2000, storage)).toBe(REFERRER);
  });

  it("expires after the TTL and cleans up the stale entry", () => {
    const storage = memoryStorage();
    saveReferralAttribution(REFERRER, 7, 1000, storage);
    expect(getReferralAttribution(7, 1000 + REFERRAL_TTL_MS + 1, storage)).toBeNull();
    // A later read within a fresh window still finds nothing (entry removed).
    expect(getReferralAttribution(7, 2000, storage)).toBeNull();
  });

  it("ignores invalid referrers on save", () => {
    const storage = memoryStorage();
    saveReferralAttribution("not-an-address", 7, 1000, storage);
    expect(getReferralAttribution(7, 2000, storage)).toBeNull();
  });

  it("ignores tampered stored values", () => {
    const storage = memoryStorage();
    storage.setItem("mlv_ref:7", '{"r":"nope","at":1}');
    expect(getReferralAttribution(7, 2000, storage)).toBeNull();
    storage.setItem("mlv_ref:7", "not-json");
    expect(getReferralAttribution(7, 2000, storage)).toBeNull();
  });

  it("clears the consumed attribution but not the site-wide one", () => {
    const storage = memoryStorage();
    saveReferralAttribution(REFERRER, 7, 1000, storage);
    saveReferralAttribution(OTHER, undefined, 1000, storage);
    clearReferralAttribution(7, storage);
    // Token entry gone; the site-wide fallback still answers.
    expect(getReferralAttribution(7, 2000, storage)).toBe(OTHER);
  });

  it("is a no-op without storage", () => {
    saveReferralAttribution(REFERRER, 7, 1000, null);
    expect(getReferralAttribution(7, 2000, null)).toBeNull();
    clearReferralAttribution(7, null);
  });
});
