/**
 * The one and only stroop ↔ XLM conversion.
 *
 * A stroop is 1/10,000,000 XLM and is the atomic unit on-chain: every amount the
 * contracts emit (price, royalty_paid, fee_paid) is an integer number of stroops,
 * and Postgres NUMERIC(39,0) reaches the client as a decimal *string*. So all of
 * this is BigInt string math — never `Number()`, which silently loses precision
 * above 2^53 and introduces float error below it.
 *
 * This module deliberately has no imports: it is pure, so both server code and
 * client components can use it without pulling the Supabase client into the bundle.
 * `lib/db/listings.ts` re-exports `stroopsToXlm` so existing `@/lib/db` imports keep
 * working — there must never be a second implementation of this anywhere.
 */

const DECIMALS = 7;
const STROOP_PER_XLM = BigInt(10_000_000);

/** Format an integer stroop amount as XLM, full precision, trailing zeros trimmed. */
export function stroopsToXlm(stroops: string | bigint): string {
  const value = typeof stroops === "bigint" ? stroops : BigInt(stroops);
  const negative = value < BigInt(0);
  const abs = negative ? -value : value;

  const whole = abs / STROOP_PER_XLM;
  const frac = abs % STROOP_PER_XLM;
  const sign = negative ? "-" : "";

  if (frac === BigInt(0)) return `${sign}${whole}`;
  const fracStr = frac.toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  return `${sign}${whole}.${fracStr}`;
}

/**
 * Parse an XLM amount into stroops.
 *
 * Numbers go through `toFixed(7)` rather than `x * 10_000_000`: multiplying a float
 * and rounding afterwards is the classic way to be one stroop off on amounts that
 * look exact in decimal. Strings are parsed digit-by-digit and never touch a float.
 * Anything finer than a stroop is not representable on-chain, so it throws rather
 * than silently truncating someone's money.
 */
export function xlmToStroops(xlm: string | number): bigint {
  const raw = typeof xlm === "number" ? xlm.toFixed(DECIMALS) : xlm.trim();

  if (!/^-?\d*(\.\d*)?$/.test(raw) || raw === "" || raw === "-" || raw === ".") {
    throw new Error(`Not a decimal XLM amount: ${JSON.stringify(xlm)}`);
  }

  const negative = raw.startsWith("-");
  const [whole, frac = ""] = raw.replace("-", "").split(".");

  if (frac.length > DECIMALS) {
    throw new Error(
      `XLM amounts cannot be finer than 1 stroop (${DECIMALS} decimals): ${JSON.stringify(xlm)}`,
    );
  }

  const stroops = BigInt(whole || "0") * STROOP_PER_XLM + BigInt(frac.padEnd(DECIMALS, "0") || "0");
  return negative ? -stroops : stroops;
}
