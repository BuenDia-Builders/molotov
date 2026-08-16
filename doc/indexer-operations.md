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
  This is the ACTIVE scheduler. It curls `/api/indexer` with the `CRON_SECRET` bearer
  every ~5 min (GitHub's minimum; sometimes delayed, fine for testnet). Required repo
  secrets: **`INDEXER_URL`** (deployed base URL, `https://molotov-web.vercel.app`) and
  **`CRON_SECRET`** (same value as the Vercel prod env var). Both are set.
- **⚠️ Do NOT put a sub-daily `crons` entry in `apps/web/vercel.json` while on Hobby.**
  Vercel Hobby rejects any cron more frequent than daily and **fails the entire
  deploy** (`"Hobby accounts are limited to daily cron jobs"`) — it is a hard deploy
  blocker, not a silent no-op. A commit that adds such a `crons` entry will have its
  auto-deploy FAIL, leaving production stuck on the previous commit (this bit us: the
  indexer-reliability merge commit failed to deploy for exactly this reason). Only add
  a `crons` entry after moving to **Vercel Pro**, where sub-daily crons are allowed and
  Vercel sends the `Authorization: Bearer $CRON_SECRET` header automatically — then you
  can prefer it and disable the GitHub Actions workflow.

### ⚠️ GitHub Actions does not honour `*/5` — expect 2–3 h

The workflow requests `*/5 * * * *`, but **GitHub heavily throttles `schedule` events**
and drops ticks under load; the schedule is best-effort with no SLA. Observed here:
consecutive `schedule` runs land **2–3 h apart**, not 5 min. The cron expression is
correct — this is the platform, not the config, so there is nothing to fix in the
workflow.

Consequences, and what we decided for testnet:

- **Accept the delay, calibrate the monitoring to it.** `MAX_LEDGER_LAG` is set to
  **5000 ledgers (≈ 6.9 h)** — derived from the worst observed gap (3 h ≈ 2160 ledgers)
  doubled to tolerate one missed run, then rounded up. At the old value of 500 (≈ 42
  min) `/health` reported 503 permanently, which is worse than no alarm: a monitor that
  is always red tells you nothing. See the derivation in `config.ts`.
- **`workflow_dispatch` is not throttled.** To force a poll right now:
  `gh workflow run indexer-cron.yml --repo BuenDia-Builders/molotov`. Use it after any
  fix, before reading `/health`.
- **Rejected: an external cron service** (cron-job.org, EasyCron, …). It would mean
  handing `CRON_SECRET` to a third-party vendor for a testnet freshness problem.
- Freshness, not safety, is what suffers. Even at a 3 h cadence the cursor stays
  ~2160 ledgers from the tip against a ~120 960-ledger retention window — still a ~55x
  margin. `retentionMarginLedgers` is the metric that guards against actual data loss,
  and it is nowhere near its threshold.

### ⚠️ GitHub disables scheduled workflows after 60 days of repo inactivity

A **public** repo with **no commits for 60 days** has its scheduled workflows
**automatically disabled** by GitHub. No run, no failure, no email beyond the notice —
the cron simply stops, and the first symptom is the indexer silently falling behind and
eventually out of the retention window (permanent event loss).

Mitigation while on Actions: push something at least every 60 days, or re-enable the
workflow from the Actions tab (or `gh workflow enable indexer-cron.yml`) when it gets
disabled. Both are manual and easy to forget — treat this as a reason to move off
Actions, not as an operating procedure.

### The definitive fix: Vercel Pro

Both problems above — the 2–3 h throttling and the 60-day auto-disable — are properties
of GitHub Actions as a scheduler, and both disappear on **Vercel Pro**, where sub-daily
crons are allowed, run on a real schedule, and Vercel sends the
`Authorization: Bearer $CRON_SECRET` header automatically (no secret in a third-party
vendor). This is the answer when there are real users; it is deliberately not worth the
cost for testnet today.

Migration, when the time comes:

1. Upgrade the `molotov-web` project to Pro.
2. Re-add the `crons` entry to `apps/web/vercel.json` (it was removed in `55831d5`
   because Hobby rejected it — it is **not** in the file today):
   ```jsonc
   "crons": [{ "path": "/api/indexer", "schedule": "*/2 * * * *" }]
   ```
3. Lower `MAX_LEDGER_LAG` back to ~50 (a real 2-min cadence means a normal lag of ~24
   ledgers), since the 5000 value only exists to absorb Actions' throttling.
4. Disable this workflow (`gh workflow disable indexer-cron.yml`) so the two schedulers
   do not both poll.

**Bonus — anti-idle:** a poll every few minutes also keeps the Supabase project
active, which prevents the **free-tier inactivity pause**. That pause is exactly what
left the indexer dead in the water once (the project URL stopped resolving); the cron
doubles as a keep-alive.

## Deployment & CI

- **Production:** `https://molotov-web.vercel.app` — Vercel project `molotov-web`
  under team `molotovappart-5590s-projects`. (An older/stale `.vercel` link pointed at
  a different team; re-link with
  `vercel link --project molotov-web --scope molotovappart-5590s-projects`.)
- **Auto-deploy IS wired.** The project is git-connected to
  `BuenDia-Builders/molotov`, `productionBranch = main`, `rootDirectory = apps/web`.
  **A push to `main` triggers a production build automatically** — no manual
  `vercel --prod` needed.
- **If a push seems not to deploy, check the Vercel deployments list for a FAILED
  build.** Auto-deploy fires, but if that commit's build errors, production silently
  stays on the last good commit. The classic cause here is the Hobby sub-daily-cron
  blocker above. `vercel list molotov-web --scope molotovappart-5590s-projects` or the
  dashboard shows each commit's deploy state.
- **Manual CLI deploy is NOT the supported path.** `vercel --prod` must run from the
  repo root (rootDirectory is `apps/web`), and it uploads the working tree — which in
  this monorepo includes multi-GB build artifacts (`node_modules`, `contracts/target`,
  `.next`) and can abort the upload. Prefer git auto-deploy; if you must CLI-deploy,
  add a `.vercelignore`.

## Secrets

`CRON_SECRET` gates `/api/indexer`. It must be set in **two** places with the **same**
value:

- **Vercel** — prod env var `CRON_SECRET` (`vercel env add CRON_SECRET production`).
  Only deployments built AFTER it is set pick it up, so redeploy (or push) after
  adding/rotating it.
- **GitHub** — repo secrets `CRON_SECRET` and `INDEXER_URL`
  (`gh secret set … --repo BuenDia-Builders/molotov`), read by the cron workflow.

To rotate: `openssl rand -hex 32`, update both places, redeploy. Never commit the value.

## Auth

`/api/indexer` is guarded by `CRON_SECRET` (bearer token):

- No / wrong bearer when the secret IS set → **401 Unauthorized** (the request is
  rejected — this is what closes the endpoint).
- Missing `CRON_SECRET` config in production → **503** (fail-closed: the endpoint
  refuses to run unauthenticated rather than expose an open trigger).
- Local dev (non-production) with no secret → open, for convenience.

This closed a real, live gap: before the secret was set, `GET /api/indexer` returned
**200 without any auth** — anyone with the URL could trigger RPC scans and Supabase
writes (the audit's MEDIUM finding, confirmed live). It now returns 401 without a valid
bearer.

## Health check — `/api/indexer/health`

Reports and thresholds (both defined in `apps/web/app/api/indexer/config.ts`):

- **`lagLedgers`** = network tip − cursor. Unhealthy if `> MAX_LEDGER_LAG` (**5000 ≈
  ~6.9 h** without progress — calibrated to GitHub Actions' real 2–3 h spacing, not to
  the `*/5` the workflow asks for; see the scheduling section above).
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

## Event timestamps — and why there is a permanent cut

Until migration `20260723000002` the projection recorded _when_ something happened only
as a ledger sequence number. The RPC returns `ledgerClosedAt` on every event and the
poller was throwing it away, so questions like "how much did I earn this month" were
unanswerable — and unanswerable **permanently**, since an event that ages out of the
retention window can never be re-fetched.

The poller now captures it into four columns: `sales.closed_at`,
`token_transfers.closed_at`, `tokens.minted_at` and `listings.created_at`.

**All four are nullable, and NULL is a legitimate permanent state**, not an error:
it means "this event was projected before the capture existed and is now outside the
retention window". Render it as unknown; never as a failure.

### The cut

`apps/web/scripts/backfill-closed-at.ts` fills in what the window still allowed at the
time it was run. It sweeps the window once to build a `ledger → closeTime` map and then
issues plain `UPDATE`s guarded by `IS NULL` — it never calls the `apply_*` functions, so
it cannot re-trigger the `editions_sold` increment, and it is safe to re-run.

Everything **below the retention floor on the day it ran** keeps `closed_at = NULL`
forever. The script prints that floor when it finishes:

> `Record ledger <N> in doc/indexer-operations.md as the cut.`

**Cut ledger: `3639980`** (backfill run 2026-07-23). Rows below it have no wall-clock
time and no way to get one. Anything at or above it should be non-NULL — if it is not,
the backfill did not cover that range and it is worth re-running before the window moves
past it.

What the run recovered, and what it could not:

| Table                       | Filled | Still NULL (below the cut) |
| --------------------------- | ------ | -------------------------- |
| `sales.closed_at`           | 1      | 1                          |
| `token_transfers.closed_at` | 2      | 6                          |
| `tokens.minted_at`          | 2      | 7                          |
| `listings.created_at`       | 1      | 3                          |

Most of the history predates the retention window — the projection was built from a
`startLedger` far below today's floor, so those events are long gone from the RPC. That
is exactly the loss this capture exists to stop repeating: everything from ledger
3639980 onward gets a real timestamp at index time.

### ⚠️ Changing a writer function's signature

If a future migration adds or removes a parameter on any `apply_*`, `CREATE OR REPLACE`
will **not** replace it — a function's identity in Postgres is `(name, argument types)`,
so you get a second overload and the old one stays alive. With a defaulted parameter the
original call then matches both and fails with `function ... is not unique`, which means
the indexer stops writing. Always `DROP FUNCTION` the old signature explicitly (full type
list) and re-`REVOKE EXECUTE` on the new one, since a newly created function is born with
`EXECUTE` granted to `PUBLIC`. `20260723000002` does this and ends with two `DO $$`
guards that fail the migration if either invariant is violated — copy that pattern.

## Ownership ordering guard

`apply_transfer` moves ownership **only forward**: a token's owner is stamped with the
`(ledger, event_index)` that set it, and a transfer updates the owner only when its
`(ledger, event_index)` is `>=` the stored one. This makes a partial or out-of-order
replay of an old range safe — it cannot regress `tokens.owner`. The `token_transfers`
provenance log stays a full, unconditional record (deduped by `ON CONFLICT`).
