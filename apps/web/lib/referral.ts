/**
 * Referral attribution — pure module, no React.
 *
 * A share link carries `?r=<G...>`. Landing on a work (or an artist profile)
 * persists that referrer locally; when the visitor later buys, the stored
 * referrer rides along in `buy(listing_id, referrer)` and the contract pays
 * the referral out of the platform fee (never on top of it). The contract
 * also zeroes self-referral (referrer == buyer or seller), so everything
 * stored here is best-effort attribution, not money logic.
 *
 * Semantics: last-touch. The most recent link that brought the visitor in
 * wins. A token-specific attribution (captured on that work's page) beats
 * the site-wide one (captured on a profile or any non-work page), because
 * it is the more specific claim. Attributions expire after 30 days.
 */

const KEY_PREFIX = "mlv_ref:";
const SITE_WIDE_KEY = `${KEY_PREFIX}*`;
export const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

/** Minimal storage shape so the module is testable without a DOM. */
export type StringStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type StoredAttribution = { r: string; at: number };

function defaultStorage(): StringStorage | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* privacy mode can throw on access */
  }
  return null;
}

function keyFor(tokenId?: number): string {
  return tokenId === undefined ? SITE_WIDE_KEY : `${KEY_PREFIX}${tokenId}`;
}

export function isValidReferrer(value: unknown): value is string {
  return typeof value === "string" && STELLAR_ADDRESS_RE.test(value);
}

/**
 * Persist a referral attribution (last-touch: an existing entry is
 * overwritten). Pass `tokenId` when captured on a work page; omit it for the
 * site-wide fallback (profile pages, etc). Invalid referrers are ignored.
 */
export function saveReferralAttribution(
  referrer: string,
  tokenId?: number,
  now: number = Date.now(),
  storage: StringStorage | null = defaultStorage(),
): void {
  if (!storage || !isValidReferrer(referrer)) return;
  try {
    const entry: StoredAttribution = { r: referrer, at: now };
    storage.setItem(keyFor(tokenId), JSON.stringify(entry));
  } catch {
    /* storage full — attribution is best-effort */
  }
}

function readEntry(storage: StringStorage, key: string, now: number): string | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<StoredAttribution>;
    if (
      !isValidReferrer(entry.r) ||
      typeof entry.at !== "number" ||
      now - entry.at > REFERRAL_TTL_MS
    ) {
      storage.removeItem(key);
      return null;
    }
    return entry.r;
  } catch {
    return null;
  }
}

/**
 * The referrer to attach to a buy of `tokenId`, or null.
 * Token-specific attribution wins over the site-wide one.
 */
export function getReferralAttribution(
  tokenId: number,
  now: number = Date.now(),
  storage: StringStorage | null = defaultStorage(),
): string | null {
  if (!storage) return null;
  return readEntry(storage, keyFor(tokenId), now) ?? readEntry(storage, SITE_WIDE_KEY, now);
}

/** Consume the attribution after a confirmed purchase of `tokenId`. */
export function clearReferralAttribution(
  tokenId: number,
  storage: StringStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(keyFor(tokenId));
  } catch {
    /* ignore */
  }
}
