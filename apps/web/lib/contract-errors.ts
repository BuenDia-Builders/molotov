/**
 * Contract error decoder — pure module, no React.
 *
 * Soroban surfaces contract panics as errors whose message matches:
 *   "Error(Contract, #<n>)"
 * where <n> is the discriminant of the error enum defined in the contract.
 *
 * MarketError (contracts/marketplace/src/lib.rs):
 *   1  InvalidPrice             11 ListingNotActive
 *   2  ReferralExceedsFee       12 CurrencyNotAllowed
 *   3  NoSplitRecipients        13 NotImplemented
 *   4  TooManySplitRecipients   14 NotSeller
 *   5  ShareNotPositive         15 InvalidEditions
 *   6  SplitSharesMustSumTo10000 16 FeePlusRoyaltyTooHigh
 *   7  RemainderNegative        17 ListingExpired
 *   8  NegativePayout           18 SplitNotAllowedForReseller
 *   9  MathOverflow             19 PriceBelowMinimum
 *  10  ListingNotFound          20 InvalidEndsAt
 *
 * MolotovError (contracts/nft/src/lib.rs):
 *   1  RoyaltyTooLow            7  RoyaltiesImmutableAfterMint
 *   2  RoyaltyTooHigh           8  RoyaltyConfigMissing
 *   3  ShareNotPositive         9  MathOverflow
 *   4  SharesMustSumTo10000    10  TooManyRecipients
 *   5  NoRecipients            11  NegativeSalePrice
 *   6  ArtistNotRegistered
 *
 * The mapper returns an i18n key from the `transaction.errors` namespace.
 * "transaction.errors.failed" is the catch-all for anything unrecognised.
 */

/** The regex that Soroban uses when serialising a contract error. */
const CONTRACT_ERROR_RE = /Error\(Contract,\s*#(\d+)\)/;

/**
 * MarketError discriminants → i18n key suffix.
 * Only codes a buyer/seller can actually encounter are mapped to distinct
 * messages; internal invariants they would never trigger fall through to
 * the default.
 */
const MARKET_ERROR_KEYS: Record<number, string> = {
  10: "listingNotFound", // ListingNotFound
  11: "listingNotActive", // ListingNotActive  ← most common on buy path
  12: "currencyNotAllowed", // CurrencyNotAllowed
  14: "notSeller", // NotSeller
  17: "listingExpired", // ListingExpired     ← common on buy path
  18: "splitNotAllowedForReseller", // SplitNotAllowedForReseller
  19: "priceBelowMinimum", // PriceBelowMinimum
};

/**
 * MolotovError discriminants → i18n key suffix.
 */
const NFT_ERROR_KEYS: Record<number, string> = {
  6: "artistNotRegistered", // ArtistNotRegistered
  7: "royaltiesImmutable", // RoyaltiesImmutableAfterMint
};

export type ContractErrorKey =
  | "transaction.errors.rejected"
  | "transaction.errors.listingNotFound"
  | "transaction.errors.listingNotActive"
  | "transaction.errors.listingExpired"
  | "transaction.errors.currencyNotAllowed"
  | "transaction.errors.notSeller"
  | "transaction.errors.splitNotAllowedForReseller"
  | "transaction.errors.priceBelowMinimum"
  | "transaction.errors.artistNotRegistered"
  | "transaction.errors.royaltiesImmutable"
  | "transaction.errors.approveGeneric"
  | "transaction.errors.failed";

/**
 * Inspects a thrown error and returns the matching i18n key.
 *
 * Pass `context` to distinguish approval failures from listing/buying failures
 * on the same path ("approve" | "list" | "buy" | "cancel").
 *
 * The function never throws — if parsing fails, it returns the generic key.
 */
export function contractErrorKey(
  err: unknown,
  context?: "approve" | "list" | "buy" | "cancel",
): ContractErrorKey {
  const message = errorMessage(err);

  // User-cancelled the wallet prompt — handled before reaching here, but
  // included as a safety net in case callers want a single entry point.
  if (isUserRejectionMessage(message)) {
    return "transaction.errors.rejected";
  }

  // NFT approval step failed but wasn't a user rejection.
  if (context === "approve") {
    return "transaction.errors.approveGeneric";
  }

  const match = CONTRACT_ERROR_RE.exec(message);
  if (!match) {
    return "transaction.errors.failed";
  }

  const code = Number(match[1]);

  // The two contracts share the same numeric space in `Error(Contract, #N)`,
  // so an unmapped code from one contract must not be looked up in the other's
  // table: marketplace #6 (SplitSharesMustSumTo10000) would otherwise read as
  // the NFT's #6 (ArtistNotRegistered). When the call context names the
  // marketplace, consult only the marketplace table.
  if (context === "buy" || context === "list" || context === "cancel") {
    if (code in MARKET_ERROR_KEYS) {
      return `transaction.errors.${MARKET_ERROR_KEYS[code]}` as ContractErrorKey;
    }
    return "transaction.errors.failed";
  }

  // No context: consult both tables, marketplace first.
  if (code in MARKET_ERROR_KEYS) {
    return `transaction.errors.${MARKET_ERROR_KEYS[code]}` as ContractErrorKey;
  }
  if (code in NFT_ERROR_KEYS) {
    return `transaction.errors.${NFT_ERROR_KEYS[code]}` as ContractErrorKey;
  }

  return "transaction.errors.failed";
}

// ── helpers ───────────────────────────────────────────────────────────────────

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return String(err);
  } catch {
    return "";
  }
}

/**
 * Detects the "user rejected" pattern from Stellar Wallets Kit and common
 * wallet extensions. Mirrors the logic in apps/web/lib/stellar.ts so that
 * contract-errors.ts stays independent of that module.
 */
function isUserRejectionMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("user rejected") ||
    lower.includes("user declined") ||
    lower.includes("cancelled by user") ||
    lower.includes("canceled by user")
  );
}
