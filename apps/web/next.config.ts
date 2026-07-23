import type { NextConfig } from "next";

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud",
  "https://ipfs.io",
  "https://cloudflare-ipfs.com",
];

const WALLET_ICON_HOSTS = ["https://stellar.creit.tech"];

const PRIVY_HOSTS = ["https://auth.privy.io", "https://*.privy.io", "wss://*.privy.io"];

// WalletConnect: the SignClient opens a WebSocket to the relay (it tries both the
// .com and .org hosts), plus HTTPS for the Verify anti-phishing check, Pulse
// analytics, and the wallet-explorer API. Without these in connect-src the relay
// socket is CSP-blocked, SignClient never comes up, and the module reports "not
// running yet" forever. (walletconnect.* is the current relay domain; reown.* is
// the rebrand, included so an SDK bump does not break this again.)
const WALLETCONNECT_CONNECT = [
  "wss://*.walletconnect.com",
  "wss://*.walletconnect.org",
  "https://*.walletconnect.com",
  "https://*.walletconnect.org",
  "wss://*.reown.com",
  "https://*.reown.com",
];

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-eval in dev
  `img-src 'self' data: blob: ${IPFS_GATEWAYS.join(" ")} ${WALLET_ICON_HOSTS.join(" ")} https://images.unsplash.com https://explorer-api.walletconnect.com https://imagedelivery.net`,
  `connect-src 'self' ${IPFS_GATEWAYS.join(" ")} https://*.supabase.co wss://*.supabase.co https://horizon-testnet.stellar.org https://soroban-testnet.stellar.org https://friendbot.stellar.org ${PRIVY_HOSTS.join(" ")} ${WALLETCONNECT_CONNECT.join(" ")}`,
  "font-src 'self' https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // The WalletConnect Verify check runs in an iframe from verify.walletconnect.*.
  `frame-src 'self' ${PRIVY_HOSTS.join(" ")} https://verify.walletconnect.com https://verify.walletconnect.org`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@molotov/stellar-client"],
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "https", hostname: "gateway.pinata.cloud" },
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      // local dev (Next.js Image with src="/api/ipfs/..." routes through self)
      { protocol: "http", hostname: "localhost" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
