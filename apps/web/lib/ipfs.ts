// Client-side IPFS helpers. They post to /api/ipfs/upload, which holds the
// Pinata JWT server-side — it is never exposed to the browser.

export type IpfsResult = { cid: string; gatewayUrl: string };

/**
 * Client-side: resolves ipfs:// to our own proxy (/api/ipfs/{cid}) so the
 * browser never hits the rate-limited public Pinata gateway directly.
 */
export function ipfsToGateway(uri: string): string {
  return uri.startsWith("ipfs://") ? `/api/ipfs/${uri.slice("ipfs://".length)}` : uri;
}

/**
 * Server-side: fetch IPFS content directly from Pinata with JWT auth.
 * Use this in React Server Components instead of ipfsToGateway().
 */
export function fetchIpfs(
  uri: string,
  opts?: { revalidate?: number; signal?: AbortSignal },
): Promise<Response> {
  const url = uri.startsWith("ipfs://")
    ? `https://gateway.pinata.cloud/ipfs/${uri.slice("ipfs://".length)}`
    : uri;
  const jwt = process.env.PINATA_JWT ?? "";
  return fetch(url, {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
    next: { revalidate: opts?.revalidate ?? 3600 },
    signal: opts?.signal,
  });
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
