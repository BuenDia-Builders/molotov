// Client-side IPFS helpers. They post to /api/ipfs/upload, which holds the
// Pinata JWT server-side — it is never exposed to the browser.

export type IpfsResult = { cid: string; gatewayUrl: string };

/** Resolves an `ipfs://` URI to a Pinata gateway URL. Passes through any other URI unchanged. */
export function ipfsToGateway(uri: string): string {
  return uri.startsWith("ipfs://")
    ? `https://gateway.pinata.cloud/ipfs/${uri.slice("ipfs://".length)}`
    : uri;
}

async function postFile(file: File): Promise<IpfsResult> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/ipfs/upload", { method: "POST", body });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? "Falló la subida a IPFS");
  }
  return res.json();
}

/** Sube una imagen a IPFS y devuelve su CID + gateway URL. */
export function uploadImage(file: File): Promise<IpfsResult> {
  return postFile(file);
}

/** Serializa un objeto a JSON y lo sube a IPFS como blob. */
export function uploadMetadata(metadata: object): Promise<IpfsResult> {
  const blob = new Blob([JSON.stringify(metadata)], {
    type: "application/json",
  });
  const file = new File([blob], "metadata.json", { type: "application/json" });
  return postFile(file);
}
