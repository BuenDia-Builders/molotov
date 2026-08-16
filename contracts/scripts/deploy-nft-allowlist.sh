#!/usr/bin/env bash
#
# deploy-nft-allowlist.sh — TESTNET deploy for the marketplace NFT-allowlist upgrade.
#
# What it does, in order:
#   1. Builds + optimizes the marketplace wasm locally and shows its hash (no signing).
#   2. Prints a DRY-RUN summary: network, owner key, the exact contract IDs it will
#      touch, the wasm hash it will upload, and the three transactions it will send.
#   3. Waits for you to type 'yes'. Nothing is signed or sent before that.
#   4. Uploads the wasm, calls upgrade(new_wasm_hash), then set_allowed_nft(NFT, true).
#   5. Reads the ledger back and verifies AllowedNft(<MolotovNft>) == true on-chain.
#
# It NEVER runs itself — you run it, with your owner key:
#
#   SOURCE=<your-stellar-cli-identity> contracts/scripts/deploy-nft-allowlist.sh
#
# or:  contracts/scripts/deploy-nft-allowlist.sh --source <identity>
#
# The identity must be the marketplace owner; upgrade() and set_allowed_nft() are
# owner-gated and will fail otherwise.
#
# ⚠ Between tx #2 (upgrade) and tx #3 (set_allowed_nft) every list()/buy() on the
#   marketplace fails with NftNotAllowed, because existing listings reference the
#   MolotovNft which is not yet allowlisted. cancel() keeps working; the window
#   closes the moment tx #3 lands. That is why #2 and #3 run back-to-back here.

set -euo pipefail

# ---- configuration (TESTNET defaults; override via env or flags) -------------
NETWORK="${NETWORK:-testnet}"
MARKET_ID="${MARKET_ID:-CB6T6DOYV2JCD36ZE43ESXNGCL2GBDARCZNRVYQWOXGTZNJBWB72K7DU}"
NFT_ID="${NFT_ID:-CBS6UQE542PLU54SVUIK76EKWUJ3CNPOQ35IB4WXKF3BU6YDIBEC7XWS}"
SOURCE="${SOURCE:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --source)  SOURCE="$2"; shift 2 ;;
    --network) NETWORK="$2"; shift 2 ;;
    --market)  MARKET_ID="$2"; shift 2 ;;
    --nft)     NFT_ID="$2"; shift 2 ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$CONTRACTS_DIR/.." && pwd)"
WEB_DIR="$REPO_ROOT/apps/web"   # resolves @stellar/stellar-sdk for the key-xdr builder

# ---- preflight ---------------------------------------------------------------
command -v stellar >/dev/null || { echo "error: stellar CLI not found in PATH" >&2; exit 1; }
command -v node >/dev/null    || { echo "error: node not found in PATH (needed for verification)" >&2; exit 1; }
[ -n "$SOURCE" ] || { echo "error: owner key required — pass --source <identity> or set SOURCE=" >&2; exit 1; }

# ---- network guard -----------------------------------------------------------
# These contract IDs are TESTNET. Refuse to run against anything else: mainnet is a
# separate track and its owner key is meant to be a multisig/timelock, not this path.
if [ "$NETWORK" != "testnet" ]; then
  echo "error: NETWORK is '$NETWORK', but this script and its contract IDs are TESTNET-only." >&2
  echo "       Refusing to continue." >&2
  exit 1
fi

# ---- build + optimize (local, no signing) ------------------------------------
echo "==> Building marketplace wasm (package molotov-marketplace)…"
( cd "$CONTRACTS_DIR" && stellar contract build --package molotov-marketplace >/dev/null )

RAW_WASM="$CONTRACTS_DIR/target/wasm32-unknown-unknown/release/molotov_marketplace.wasm"
[ -f "$RAW_WASM" ] || { echo "error: built wasm not found at $RAW_WASM" >&2; exit 1; }

echo "==> Optimizing…"
stellar contract optimize --wasm "$RAW_WASM" >/dev/null
OPT_WASM="${RAW_WASM%.wasm}.optimized.wasm"
[ -f "$OPT_WASM" ] || OPT_WASM="$RAW_WASM"   # fall back if the optimizer wrote in place

# The Soroban wasm hash == SHA-256 of the wasm bytes, so we can show it before upload.
WASM_HASH="$(shasum -a 256 "$OPT_WASM" | awk '{print $1}')"

# ---- dry-run summary ---------------------------------------------------------
cat <<EOF

──────────────────────────────────────────────────────────────────────
 DRY RUN — nothing has been signed or sent yet.
──────────────────────────────────────────────────────────────────────
 Network         : $NETWORK
 Owner key       : $SOURCE   (must be the marketplace owner)
 Marketplace     : $MARKET_ID   ← will be UPGRADED
 MolotovNft      : $NFT_ID   ← will be ALLOWLISTED
 Wasm file       : $OPT_WASM
 Wasm hash       : $WASM_HASH

 Transactions to be signed, in order:
   1. stellar contract upload  --wasm <above>
   2. stellar contract invoke  --id $MARKET_ID
        -- upgrade --new_wasm_hash $WASM_HASH
   3. stellar contract invoke  --id $MARKET_ID
        -- set_allowed_nft --nft $NFT_ID --allowed true

 ⚠  Between #2 and #3, list()/buy() fail with NftNotAllowed
    (cancel() still works). The window closes when #3 lands.
──────────────────────────────────────────────────────────────────────

EOF
printf "Type 'yes' to sign and send these three transactions: "
read -r CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Aborted — nothing was signed."; exit 0; }

# ---- execute -----------------------------------------------------------------
echo "==> [1/3] Uploading wasm…"
UPLOADED_HASH="$(stellar contract upload --wasm "$OPT_WASM" --source "$SOURCE" --network "$NETWORK")"
echo "    uploaded hash: $UPLOADED_HASH"
if [ "$UPLOADED_HASH" != "$WASM_HASH" ]; then
  echo "error: uploaded hash != locally computed hash — aborting BEFORE upgrade." >&2
  exit 1
fi

echo "==> [2/3] upgrade(new_wasm_hash)…"
stellar contract invoke --id "$MARKET_ID" --source "$SOURCE" --network "$NETWORK" \
  -- upgrade --new_wasm_hash "$UPLOADED_HASH"

echo "==> [3/3] set_allowed_nft(<MolotovNft>, true)…"
stellar contract invoke --id "$MARKET_ID" --source "$SOURCE" --network "$NETWORK" \
  -- set_allowed_nft --nft "$NFT_ID" --allowed true

# ---- verify on-chain ---------------------------------------------------------
echo "==> Verifying AllowedNft(<MolotovNft>) == true on-chain…"

# Build the persistent storage key: DataKey::AllowedNft(Address) serializes to
# ScVal::Vec([Symbol("AllowedNft"), Address(nft)]).
KEY_XDR="$(cd "$WEB_DIR" && node -e '
const { xdr, Address } = require("@stellar/stellar-sdk");
const key = xdr.ScVal.scvVec([
  xdr.ScVal.scvSymbol("AllowedNft"),
  Address.fromString(process.argv[1]).toScVal(),
]);
process.stdout.write(key.toXDR("base64"));
' "$NFT_ID")"

VALUE="$(stellar contract read --id "$MARKET_ID" --network "$NETWORK" \
  --durability persistent --key-xdr "$KEY_XDR" --output json 2>/dev/null || true)"

echo "    ledger entry value: ${VALUE:-<none found>}"
if printf '%s' "$VALUE" | grep -qiw 'true'; then
  echo "✅ VERIFIED: the MolotovNft is allowlisted. Existing listings can settle again."
else
  echo "❌ NOT VERIFIED: allowlist entry is missing or not 'true'." >&2
  echo "   Do NOT assume success — re-run set_allowed_nft (tx #3) and re-verify:" >&2
  echo "     stellar contract invoke --id $MARKET_ID --source $SOURCE --network $NETWORK \\" >&2
  echo "       -- set_allowed_nft --nft $NFT_ID --allowed true" >&2
  exit 1
fi
