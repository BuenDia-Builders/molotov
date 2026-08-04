import { describe, expect, it } from "vitest";
import {
  buildTokenMetadata,
  normalizeAttributes,
  normalizeTags,
  MAX_ATTRIBUTES,
  MAX_TAGS,
} from "./metadata";

const BASE = { title: "Tiburonas", description: "Una obra", imageCid: "bafy123" };

describe("normalizeTags", () => {
  it("lowercases, trims, dedupes and drops empties", () => {
    expect(normalizeTags([" Arte ", "arte", "", "  ", "FUEGO"])).toEqual(["arte", "fuego"]);
  });

  it("caps the count and the length", () => {
    const many = Array.from({ length: 20 }, (_, i) => `tag${i}`);
    expect(normalizeTags(many)).toHaveLength(MAX_TAGS);
    expect(normalizeTags(["x".repeat(99)])[0]).toHaveLength(30);
  });
});

describe("normalizeAttributes", () => {
  it("keeps only complete pairs, trimmed and capped", () => {
    expect(
      normalizeAttributes([
        { name: " medio ", value: " óleo " },
        { name: "solo-nombre", value: "  " },
        { name: "", value: "solo-valor" },
      ]),
    ).toEqual([{ name: "medio", value: "óleo" }]);
    const many = Array.from({ length: 15 }, (_, i) => ({ name: `n${i}`, value: `v${i}` }));
    expect(normalizeAttributes(many)).toHaveLength(MAX_ATTRIBUTES);
  });
});

describe("buildTokenMetadata", () => {
  it("builds the base shape with the ipfs image uri", () => {
    const m = buildTokenMetadata(BASE);
    expect(m).toEqual({
      name: "Tiburonas",
      description: "Una obra",
      image: "ipfs://bafy123",
      external_url: "",
      attributes: [],
    });
  });

  it("omits optional fields when unset — no nulls fossilized", () => {
    const m = buildTokenMetadata({ ...BASE, tags: [], category: null, license: null });
    expect("tags" in m).toBe(false);
    expect("category" in m).toBe(false);
    expect("license" in m).toBe(false);
    expect("contentRating" in m).toBe(false);
    expect("accessibility" in m).toBe(false);
  });

  it("records category and license only from the known lists", () => {
    const m = buildTokenMetadata({ ...BASE, category: "illustration", license: "CC-BY-4.0" });
    expect(m.category).toBe("illustration");
    expect(m.license).toBe("CC-BY-4.0");
    const bad = buildTokenMetadata({ ...BASE, category: "invento", license: "MIT" });
    expect("category" in bad).toBe(false);
    expect("license" in bad).toBe(false);
  });

  it("treats all-rights-reserved as the default, not a recorded license", () => {
    const m = buildTokenMetadata({ ...BASE, license: "all-rights-reserved" });
    expect("license" in m).toBe(false);
  });

  it("maps nsfw and flashing to contentRating and accessibility hazards", () => {
    const m = buildTokenMetadata({ ...BASE, nsfw: true, flashing: true });
    expect(m.contentRating).toBe("mature");
    expect(m.accessibility).toEqual({ hazards: ["flashing"] });
  });

  it("maps attributes to trait_type/value pairs", () => {
    const m = buildTokenMetadata({
      ...BASE,
      attributes: [{ name: "medio", value: "acuarela" }],
    });
    expect(m.attributes).toEqual([{ trait_type: "medio", value: "acuarela" }]);
  });
});
