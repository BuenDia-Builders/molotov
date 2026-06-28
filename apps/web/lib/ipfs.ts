// Client-side IPFS helpers. They post to /api/ipfs/upload, which holds the
// Pinata JWT server-side — it is never exposed to the browser.

export type IpfsResult = { cid: string; gatewayUrl: string };

/** Resolves an `ipfs://` URI to a Pinata gateway URL. Passes through any other URI unchanged. */
export function ipfsToGateway(uri: string): string {
  return uri.startsWith("ipfs://")
    ? `https://gateway.pinata.cloud/ipfs/${uri.slice("ipfs://".length)}`
    : uri;
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
