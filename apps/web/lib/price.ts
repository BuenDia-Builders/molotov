const RATE_URL = "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd";

/**
 * XLM/USD rate, cached for an hour (same idiom as the IPFS metadata cache in
 * app/page.tsx). This is a Stellar-native marketplace — USD is always a
 * secondary estimate next to the authoritative XLM price, never the only
 * number shown. Any failure (network, rate limit, bad shape) degrades to
 * `null`, and every caller falls back to XLM-only display.
 */
export async function getXlmUsdRate(): Promise<number | null> {
  try {
    const res = await fetch(RATE_URL, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data?.stellar?.usd;
    return typeof rate === "number" && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

/** Formats a stroops-precision XLM amount as a rounded USD estimate, e.g. "12.40". */
export function formatUsdEstimate(priceXlm: string, rate: number | null): string | null {
  if (rate === null) return null;
  const amount = Number(priceXlm);
  if (!Number.isFinite(amount)) return null;
  return (amount * rate).toFixed(2);
}
