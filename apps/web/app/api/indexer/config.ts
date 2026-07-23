// Indexer configuration — contract IDs and environment.
// All values come from .env (gitignored) or the hard-coded testnet constants below.

export const SUPABASE_URL = process.env.SUPABASE_URL!;
export const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

export const RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

// Deployed contract IDs on testnet
export const REGISTRY_ID = "CC37LTUPS5WLNBQSVNJJGBMZK4QCUJ76EFGW4RGY7XNVLKFKXCRGU533";
export const NFT_ID = "CBS6UQE542PLU54SVUIK76EKWUJ3CNPOQ35IB4WXKF3BU6YDIBEC7XWS";
export const MARKET_ID = "CB6T6DOYV2JCD36ZE43ESXNGCL2GBDARCZNRVYQWOXGTZNJBWB72K7DU";

export const CONTRACT_IDS = [REGISTRY_ID, NFT_ID, MARKET_ID] as const;

// Number of events fetched per RPC call. 200 is the Soroban RPC maximum.
export const POLL_LIMIT = 200;

// Approximate ledger of the earliest contract deploy (ArtistRegistry, Phase 1).
// Used as startLedger on the very first poll when the cursor is unset.
// Override via env to limit history on fresh deploys.
export const START_LEDGER = Number(process.env.INDEXER_START_LEDGER ?? "0");

// ── Health thresholds (consumed by /api/indexer/health) ─────────────────────────
// Testnet closes ~1 ledger every 5s.

// Max acceptable lag between the cursor and the network tip before /health reports
// unhealthy. With the cron every 2 min the normal lag is ~24 ledgers (2min / 5s), so
// 500 is a generous ceiling: exceeding it means the indexer has not advanced for
// roughly half an hour (500 * 5s ≈ 42 min).
export const MAX_LEDGER_LAG = 500;

// Minimum margin between the cursor and the RPC retention floor. Below this the
// cursor is close to falling out of the window — after which its next events stop
// being fetchable and only a manual reset recovers. 20000 ledgers * 5s ≈ ~28h of
// lead time to react (this is exactly the failure that just bit us).
export const MIN_RETENTION_MARGIN = 20000;
