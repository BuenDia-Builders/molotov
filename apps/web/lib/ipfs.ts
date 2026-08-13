// Client-side IPFS helpers. They post to /api/ipfs/upload, which holds the
// Pinata JWT server-side — it is never exposed to the browser.

import { IPFS_GATEWAYS } from "@/lib/ipfs-gateways";

export type IpfsResult = { cid: string; gatewayUrl: string };

/** Thrown when a token_uri / image URL is not a URL we are willing to fetch. */
export class IpfsUriError extends Error {}

// Derived from the single source of truth (IPFS_GATEWAYS) so the allowlist can
// never drift from what we actually fetch. A token_uri is minter-controlled, so
// a full https URL is only fetched when its host is one of our gateways.
const ALLOWED_HTTPS_HOSTS = new Set(
  IPFS_GATEWAYS.map((gw) => new URL(gw.url).hostname.toLowerCase()),
);

// The subset that carries a non-empty auth token in the gateway config gets the
// credential; every other host is fetched anonymously. Derived, not hardcoded —
// today this is just gateway.pinata.cloud.
const PINATA_AUTH_HOSTS = new Set(
  IPFS_GATEWAYS.filter((gw) => gw.auth !== "").map((gw) => new URL(gw.url).hostname.toLowerCase()),
);

/**
 * True only for IP *literals* in private, loopback or link-local ranges.
 * Hostnames are never matched here (e.g. "fd-cdn.com" must not trip the IPv6
 * unique-local check) — the allowlist is what rejects unknown hostnames. This
 * is defense-in-depth for the day this runs outside a lambda.
 */
function isBlockedAddress(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const octets = v4.slice(1).map(Number);
    if (octets.some((o) => o > 255)) return false; // not a real v4 literal
    const [a, b] = octets;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254
    return false;
  }

  // IPv6 literals contain a colon; DNS hostnames never do.
  if (h.includes(":")) {
    if (h === "::1" || h === "::") return true; // loopback / unspecified
    if (h.startsWith("fe80:")) return true; // link-local
    if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique-local
    if (h.startsWith("::ffff:")) return isBlockedAddress(h.slice("::ffff:".length)); // v4-mapped
    return false;
  }

  return false;
}

/** Reject anything that is not https:// to an allowlisted, non-private host. */
function assertFetchableHttps(url: URL): void {
  if (url.protocol !== "https:") {
    throw new IpfsUriError(`Refusing non-https token_uri: ${url.protocol}`);
  }
  const host = url.hostname.toLowerCase();
  if (isBlockedAddress(host)) {
    throw new IpfsUriError(`Refusing private/link-local host: ${host}`);
  }
  if (!ALLOWED_HTTPS_HOSTS.has(host)) {
    throw new IpfsUriError(`Host not in gateway allowlist: ${host}`);
  }
}

/**
 * Client-side: resolves ipfs:// to our own proxy (/api/ipfs/{cid}) so the
 * browser never hits the rate-limited public Pinata gateway directly.
 */
export function ipfsToGateway(uri: string): string {
  return uri.startsWith("ipfs://") ? `/api/ipfs/${uri.slice("ipfs://".length)}` : uri;
}

/**
 * Server-side: fetch IPFS content with multi-gateway fallback.
 * Use this in React Server Components instead of ipfsToGateway().
 */
export async function fetchIpfs(
  uri: string,
  opts?: { revalidate?: number; signal?: AbortSignal },
): Promise<Response> {
  if (!uri.startsWith("ipfs://")) {
    // A full URL from minter-controlled data. Validate the host BEFORE fetching,
    // and only send the Pinata credential to Pinata's own gateway.
    let url: URL;
    try {
      url = new URL(uri);
    } catch {
      throw new IpfsUriError(`token_uri is not a valid absolute URL: ${uri}`);
    }
    assertFetchableHttps(url);

    // redirect: "manual" — do not trust fetch to strip Authorization on a
    // cross-origin redirect; a 3xx surfaces as non-ok and callers fall back.
    const jwt = PINATA_AUTH_HOSTS.has(url.hostname.toLowerCase())
      ? (process.env.PINATA_JWT ?? "")
      : "";
    return fetch(url.toString(), {
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
      redirect: "manual",
      next: { revalidate: opts?.revalidate ?? 3600 },
      signal: opts?.signal,
    });
  }

  const path = uri.slice("ipfs://".length);
  // The CID segment is minter-controlled; keep it from climbing out of /ipfs.
  if (path.split("/").some((seg) => seg === "..")) {
    throw new IpfsUriError(`Refusing path traversal in ipfs uri: ${uri}`);
  }
  let lastResponse: Response | undefined;
  let lastError: unknown;

  for (const gw of IPFS_GATEWAYS) {
    // A gateway can fail by answering non-ok or by throwing outright (dead
    // DNS, reset, timeout). Both must fall through to the next gateway; only
    // a caller-initiated abort exits the chain.
    try {
      const res = await fetch(`${gw.url}/${path}`, {
        headers: gw.auth ? { Authorization: `Bearer ${gw.auth}` } : {},
        next: { revalidate: opts?.revalidate ?? 3600 },
        signal: opts?.signal,
      });

      if (res.ok) return res;
      lastResponse = res;
    } catch (err) {
      if (opts?.signal?.aborted) throw err;
      lastError = err;
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError;
}

const MAX_ATTEMPTS = 3;

async function postFile(file: File): Promise<IpfsResult> {
  let lastError: Error = new Error("IPFS upload failed");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 2)));
    }

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/ipfs/upload", { method: "POST", body });

      // 4xx = client error (bad file type, rate limit) — do not retry
      if (res.status >= 400 && res.status < 500) {
        const detail = await res.json().catch(() => null);
        throw Object.assign(new Error(detail?.error ?? "Upload rejected"), {
          retryable: false,
        });
      }

      if (!res.ok) throw new Error(`IPFS gateway error ${res.status}`);

      return res.json() as Promise<IpfsResult>;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if ((e as { retryable?: boolean }).retryable === false) throw e;
      lastError = e;
    }
  }

  throw lastError;
}

export function uploadImage(file: File): Promise<IpfsResult> {
  return postFile(file);
}

export function uploadMetadata(metadata: object): Promise<IpfsResult> {
  const blob = new Blob([JSON.stringify(metadata)], {
    type: "application/json",
  });
  const file = new File([blob], "metadata.json", { type: "application/json" });
  return postFile(file);
}
