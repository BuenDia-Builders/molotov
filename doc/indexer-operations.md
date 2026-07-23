# Indexer operations

The Molotov indexer projects on-chain events (mint, transfer, burn, list, sold,
cancel, artist register/revoke) into Supabase. It is a single cursor-driven poller
(`apps/web/app/api/indexer/poller.ts`) invoked either by a scheduler (production) or
the local loop `apps/web/scripts/run-indexer.ts`.

This doc covers the one operational hazard that has actually bitten us — the RPC
retention window — plus scheduling, health, and recovery.

## The RPC retention window (the load-bearing limit)

The Stellar **testnet** RPC only serves contract events from roughly the **last ~7
days** (~120 960 ledgers at ~5 s/ledger). Events older than the window are gone from
the RPC — `getEvents` with a `startLedger`/cursor below the floor returns error
**-32600** ("startLedger must be within the ledger range: `<min>` - `<max>`").

Implications:

- **Reconstruction is only possible within the window.** You can truncate the
  projection tables, reset the cursor to the retention floor, and replay to rebuild —
  but only for events still inside the window. Anything older is unrecoverable from
  the chain.
- **Beyond the window, Supabase is the ONLY source of truth**, and it currently has
  **no backups**. If the cursor falls out of the window while events happened in the
  gap, those events are lost permanently (they were never projected and can no longer
  be fetched). → **Action item: schedule periodic backups (e.g. `pg_dump` /
  Supabase scheduled backups) of the projection tables** so the DB itself is
  recoverable independent of the RPC window.
- Mainnet RPC retention is provider-dependent and can differ; re-check before relying
  on replay there.

## Keep it running — scheduling

The indexer must be polled continuously; if it stops for longer than the retention
window, the cursor falls out and events are lost. Two scheduler paths:

- **Vercel Hobby plan → GitHub Actions (`.github/workflows/indexer-cron.yml`).**
  Vercel Cron on **Hobby only runs once per day**, so the `crons` entry in
  `apps/web/vercel.json` would silently NOT run every 2 minutes — worse than nothing,
  because it looks solved. The GitHub Actions workflow curls `/api/indexer` with the
  `CRON_SECRET` bearer every ~5 min (GitHub's minimum; sometimes delayed, fine for
  testnet). Set repo secrets **`INDEXER_URL`** (deployed base URL) and
  **`CRON_SECRET`** (same value as the deployment env var).
- **Vercel Pro plan → `apps/web/vercel.json` cron.** The `crons` entry
  (`*/2 * * * *`) becomes real on Pro; Vercel sends the `Authorization: Bearer
$CRON_SECRET` header automatically. Once on Pro, prefer this and disable the GitHub
  Actions workflow.

Frequency rationale: every 2 min keeps the projection within ~24 ledgers of the tip
against a ~120 960-ledger window — an enormous safety margin. Freshness, not safety,
is the reason to poll often; the health check below is what protects against the
cursor falling out.

**Bonus — anti-idle:** a poll every few minutes also keeps the Supabase project
active, which prevents the **free-tier inactivity pause**. That pause is exactly what
left the indexer dead in the water once (the project URL stopped resolving); the cron
doubles as a keep-alive.

## Auth

`/api/indexer` is guarded by `CRON_SECRET` (bearer token). In **production a missing
`CRON_SECRET` fails closed** (503) — an unauthenticated indexer endpoint would let
anyone trigger RPC scans and DB writes. In local dev (non-production) the endpoint is
open for convenience.

## Health check — `/api/indexer/health`

Reports and thresholds (both defined in `apps/web/app/api/indexer/config.ts`):

- **`lagLedgers`** = network tip − cursor. Unhealthy if `> MAX_LEDGER_LAG` (500 ≈ ~42
  min without progress).
- **`retentionMarginLedgers`** = cursor − RPC retention floor. Unhealthy if
  `< MIN_RETENTION_MARGIN` (20000 ≈ ~28 h of lead time before the cursor falls out) —
  this is the metric that would have warned us before the outage.
- **`lastAppliedAt`** = when the cursor last advanced successfully.
- **`lastError`** = the event (ledger + `event_index` + message) currently blocking
  the poll, if any (see below). Cleared automatically on the next successful advance.

Returns **503** when any threshold is breached or an apply error is recorded, **200**
otherwise. Point an uptime monitor at it.

## Poison events — why the poller can block

A failed `apply_*` is **not** skipped: the poller records which event failed
(`record_indexer_error` → surfaced by `/health` as `lastError`) and **rethrows before
advancing the cursor**, so the poll aborts and the cursor stays put. This is
deliberate — skipping the event and advancing would drop it from the projection
forever. The trade-off is that a genuinely poison event (an `apply_*` bug, not an
infra blip) **blocks the indexer until fixed**. `/health` tells you exactly which
event so you can debug without log-diving; fix the cause and the next run clears the
error and proceeds.

## Recovery: cursor fell out of the retention window

Symptom: the poller throws `CursorOutOfRetentionError` (the local loop stops with a
FATAL message instead of retrying), and/or `/health` shows a negative/small
`retentionMarginLedgers`.

Steps:

1. Find the current retention floor. Any `getEvents` with a too-old `startLedger`
   returns the valid range in its error; or read it off `/health`
   (`retentionFloorLedger`).
2. Reset the cursor into the window, dropping the stale RPC cursor:
   ```sql
   -- via the SECURITY DEFINER RPC (service role), or the SQL editor:
   select advance_cursor(<floor_ledger>, null);
   ```
   Setting `last_cursor = null` makes the poller resume by `startLedger` (clamped to
   the exact floor by `resolveOldestLedger`), not by the dead cursor.
3. Re-run the indexer (`run-indexer.ts`, or hit `/api/indexer`) to replay
   `[floor, tip]`. All `apply_*` are idempotent, so re-applying already-projected
   events is safe.
4. **Accept the gap:** any events between the old cursor and the floor that were
   never projected are unrecoverable. This is the permanent-loss case backups are
   meant to prevent.

## Ownership ordering guard

`apply_transfer` moves ownership **only forward**: a token's owner is stamped with the
`(ledger, event_index)` that set it, and a transfer updates the owner only when its
`(ledger, event_index)` is `>=` the stored one. This makes a partial or out-of-order
replay of an old range safe — it cannot regress `tokens.owner`. The `token_transfers`
provenance log stays a full, unconditional record (deduped by `ON CONFLICT`).
