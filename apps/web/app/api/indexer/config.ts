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
// unhealthy. Calibrated to the scheduler that actually runs, not the one configured:
// the workflow asks for */5, but GitHub Actions heavily throttles scheduled events on
// this repo — observed spacing between `schedule` runs is 2–3 h, not 5 min.
//
// Derivation:
//   worst observed gap    3 h            = 2160 ledgers (3*3600s / 5s per ledger)
//   tolerate one miss     2 x 3 h = 6 h  = 4320 ledgers
//   rounded up            5000 ledgers   ≈ 6.9 h without progress
//
// So a single skipped or failed run does not trip the alarm, but two consecutive
// worst-case gaps do. The ordering that matters: this alarm must fire long before the
// cursor is at risk of falling out of the ~120 960-ledger retention window. It does —
// 5000 is ~24x below that window, so /health goes red on lag days before
// retentionMarginLedgers gets anywhere near MIN_RETENTION_MARGIN. Lag is the freshness
// alarm; retention margin is the data-loss alarm. Move this back down (~50) once a
// real sub-5-min scheduler exists (Vercel Pro cron); see doc/indexer-operations.md.
export const MAX_LEDGER_LAG = 5000;

// Minimum margin between the cursor and the RPC retention floor. Below this the
// cursor is close to falling out of the window — after which its next events stop
// being fetchable and only a manual reset recovers. 20000 ledgers * 5s ≈ ~28h of
// lead time to react (this is exactly the failure that just bit us).
export const MIN_RETENTION_MARGIN = 20000;
