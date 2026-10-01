-- ════════════════════════════════════════════════════════════════════════════
-- Indexer gaps: don't block forever on an unrecoverable event.
--
-- Incident 2026-09-08: a Sold event referenced a listing whose own
-- ListingCreated row had never been projected (a pre-existing, silent gap from
-- long before this date). apply_sold failed on a foreign-key violation, and
-- the deliberate "never skip a failed apply" policy (see poller.ts) blocked
-- the cursor for 23 days, nobody noticed, and the cursor eventually fell out
-- of the RPC's ~7-day retention window — turning one bad event into an
-- unrecoverable ~16-day hole in the projection.
--
-- That blocking policy is right for a TRANSIENT failure (a Supabase blip, a
-- timeout) — retrying is exactly correct there. It is wrong for a genuinely
-- unresolvable one: nothing changes between retries, so blocking forever
-- just trades one lost event for an ever-growing one. This migration adds the
-- middle ground: keep retrying (and keep /health red) for a while, but once
-- the *same* event has failed MAX_POISON_RETRIES times in a row, record it as
-- a permanent, visible gap and move the cursor past it instead of sitting on
-- it indefinitely. Modeled on the Gap pattern in Trustless Work's indexer
-- (github.com/Trustless-Work/trustlesswork-indexer-go, internal/state/store.go)
-- after their own near-identical 2026-07-22 incident.
-- ════════════════════════════════════════════════════════════════════════════

-- Tracks how many consecutive poll attempts have failed on the *same*
-- (ledger, event_index) currently recorded in last_error_*. Reset to 1 on a
-- new distinct error, incremented when the same one recurs, cleared on
-- either a successful advance or a recorded gap.
ALTER TABLE indexer_cursor
  ADD COLUMN last_error_retry_count INTEGER NOT NULL DEFAULT 0;

-- Append-only, operator-reviewed log of events the indexer gave up retrying
-- and skipped. Never auto-deleted: resolved_at/resolved_note let a human
-- record that a gap was manually backfilled (same spirit as this project's
-- own incident response on 2026-09-08-09), without losing the evidence of
-- what was skipped and why.
CREATE TABLE indexer_gaps (
  id              BIGSERIAL     PRIMARY KEY,
  ledger          BIGINT        NOT NULL,
  event_index     INTEGER       NOT NULL,
  kind            TEXT          NOT NULL,
  message         TEXT          NOT NULL,
  retry_count     INTEGER       NOT NULL,
  detected_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  resolved_note   TEXT,
  UNIQUE (ledger, event_index)
);

-- Same access model as indexer_cursor: operational metadata, not public
-- projection data. No policy for anon/authenticated → zero rows for them;
-- only the service-role poller and /health route (which also uses the
-- service-role client) can read or write it.
ALTER TABLE indexer_gaps ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON indexer_gaps TO anon, authenticated;

-- record_indexer_error: now tracks a retry streak instead of just overwriting
-- the single last-error slot, and returns the resulting count so the caller
-- can decide whether this event has now hit MAX_POISON_RETRIES without a
-- separate read. A new (ledger, event_index) resets the streak to 1; the
-- same one recurring increments it.
--
-- Return type changed (void → INTEGER): CREATE OR REPLACE can't do that in
-- place, so the old signature is dropped first.
DROP FUNCTION IF EXISTS record_indexer_error(BIGINT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION record_indexer_error(
  p_ledger        BIGINT,
  p_event_index   INTEGER,
  p_message       TEXT
) RETURNS INTEGER
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  UPDATE indexer_cursor
     SET last_error_ledger      = p_ledger,
         last_error_event_index = p_event_index,
         last_error_message     = p_message,
         last_error_at          = now(),
         last_error_retry_count = CASE
           WHEN last_error_ledger = p_ledger AND last_error_event_index = p_event_index
             THEN last_error_retry_count + 1
           ELSE 1
         END
   WHERE id = 1
  RETURNING last_error_retry_count;
$$;

-- record_indexer_gap: the poller calls this INSTEAD of re-throwing once a
-- single event's retry streak reaches MAX_POISON_RETRIES. Inserts the
-- permanent gap record, then clears the cursor's error slot — /health goes
-- back to reporting no *current* blocking error, but the gap itself is never
-- deleted, only ever marked resolved by a human after the fact.
CREATE OR REPLACE FUNCTION record_indexer_gap(
  p_ledger        BIGINT,
  p_event_index   INTEGER,
  p_kind          TEXT,
  p_message       TEXT,
  p_retry_count   INTEGER
) RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  INSERT INTO indexer_gaps (ledger, event_index, kind, message, retry_count)
  VALUES (p_ledger, p_event_index, p_kind, p_message, p_retry_count)
  ON CONFLICT (ledger, event_index) DO NOTHING;

  UPDATE indexer_cursor
     SET last_error_ledger      = NULL,
         last_error_event_index = NULL,
         last_error_message     = NULL,
         last_error_at          = NULL,
         last_error_retry_count = 0
   WHERE id = 1;
$$;

-- Low-trust roles must not call either writer (mirror the existing apply_* fns).
REVOKE EXECUTE ON FUNCTION record_indexer_error(BIGINT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION record_indexer_gap(BIGINT, INTEGER, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
