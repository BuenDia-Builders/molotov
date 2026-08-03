// Retrieval gateways, tried in order. Server-only consumers (the /api/ipfs
// proxy and fetchIpfs) see PINATA_GATEWAY when set — the account's dedicated
// gateway, which is the supported high-limit path. gateway.pinata.cloud is the
// PUBLIC gateway: per-IP rate-limited regardless of JWT, so it is only a
// fallback. ipfs.io / dweb.link only work for content that propagated beyond
// Pinata, which for fresh pins is usually not yet the case.
const DEDICATED = process.env.PINATA_GATEWAY ?? "";

export const IPFS_GATEWAYS: { url: string; auth: string }[] = [
  ...(DEDICATED ? [{ url: `https://${DEDICATED}/ipfs`, auth: "" }] : []),
  { url: "https://gateway.pinata.cloud/ipfs", auth: process.env.PINATA_JWT ?? "" },
  { url: "https://ipfs.io/ipfs", auth: "" },
  { url: "https://dweb.link/ipfs", auth: "" },
];
