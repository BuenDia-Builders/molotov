export const IPFS_GATEWAYS: { url: string; auth: string }[] = [
  { url: "https://gateway.pinata.cloud/ipfs", auth: process.env.PINATA_JWT ?? "" },
  { url: "https://ipfs.io/ipfs", auth: "" },
  { url: "https://dweb.link/ipfs", auth: "" },
];

