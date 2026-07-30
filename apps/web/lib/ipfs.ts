// Client-side IPFS helpers. They post to /api/ipfs/upload, which holds the
// Pinata JWT server-side — it is never exposed to the browser.

import { IPFS_GATEWAYS } from "@/lib/ipfs-gateways";

export type IpfsResult = { cid: string; gatewayUrl: string };

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
    const jwt = process.env.PINATA_JWT ?? "";
    return fetch(uri, {
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
      next: { revalidate: opts?.revalidate ?? 3600 },
      signal: opts?.signal,
    });
  }

  const path = uri.slice("ipfs://".length);
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
