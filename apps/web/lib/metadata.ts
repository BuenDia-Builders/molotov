/**
 * Token metadata builder — pure module, no React, no IPFS.
 *
 * The JSON pinned to IPFS is the work's permanent record, so its shape is a
 * contract of its own: `name`/`description`/`image` (the base every wallet
 * understands), plus optional curatorial fields inspired by TZIP-21 naming
 * (tags, contentRating, accessibility hazards) and OpenSea-style
 * `attributes`. Optional fields are OMITTED when unset — no `null`s and no
 * empty arrays fossilized on-chain-adjacent storage.
 */

export const CATEGORIES = [
  "illustration",
  "photography",
  "painting",
  "generative",
  "3d",
  "animation",
  "collage",
  "pixel-art",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const LICENSES = [
  "all-rights-reserved",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "CC-BY-NC-4.0",
  "CC-BY-NC-SA-4.0",
  "CC0-1.0",
] as const;
export type License = (typeof LICENSES)[number];

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;
export const MAX_ATTRIBUTES = 10;

export type AttributeInput = { name: string; value: string };

export type MetadataInput = {
  title: string;
  description: string;
  imageCid: string;
  tags?: string[];
  category?: string | null;
  license?: string | null;
  nsfw?: boolean;
  flashing?: boolean;
  attributes?: AttributeInput[];
};

export type TokenMetadata = {
  name: string;
  description: string;
  image: string;
  external_url: "";
  tags?: string[];
  category?: string;
  license?: string;
  contentRating?: "mature";
  accessibility?: { hazards: ["flashing"] };
  attributes: Array<{ trait_type: string; value: string }>;
};

/** Lowercase, trim, drop empties and dupes, cap count and length. */
export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of raw) {
    const clean = tag.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** Keep only pairs where both sides have content, capped. */
export function normalizeAttributes(raw: AttributeInput[]): AttributeInput[] {
  return raw
    .map((a) => ({ name: a.name.trim(), value: a.value.trim() }))
    .filter((a) => a.name && a.value)
    .slice(0, MAX_ATTRIBUTES);
}

export function buildTokenMetadata(input: MetadataInput): TokenMetadata {
  const metadata: TokenMetadata = {
    name: input.title,
    description: input.description,
    image: `ipfs://${input.imageCid}`,
    external_url: "",
    attributes: normalizeAttributes(input.attributes ?? []).map((a) => ({
      trait_type: a.name,
      value: a.value,
    })),
  };

  const tags = normalizeTags(input.tags ?? []);
  if (tags.length > 0) metadata.tags = tags;

  if (input.category && (CATEGORIES as readonly string[]).includes(input.category)) {
    metadata.category = input.category;
  }

  // "All rights reserved" is the legal default — only a real license choice
  // is worth recording.
  if (
    input.license &&
    input.license !== "all-rights-reserved" &&
    (LICENSES as readonly string[]).includes(input.license)
  ) {
    metadata.license = input.license;
  }

  if (input.nsfw) metadata.contentRating = "mature";
  if (input.flashing) metadata.accessibility = { hazards: ["flashing"] };

  return metadata;
}
