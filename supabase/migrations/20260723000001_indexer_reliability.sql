-- Indexer reliability: ownership ordering guard + error visibility.
-- New migration (does not edit existing ones). CREATE OR REPLACE preserves the
-- EXECUTE ACLs set in 20260611000010, so no re-revoke is needed for redefined fns.

-- ════════════════════════════════════════════════════════════════════════════
-- PART 1.3 — apply_transfer ordering guard
-- A partial or out-of-order replay of an OLD ledger range must never regress
-- ownership. We stamp each token with the (ledger, event_index) of the event that
-- set its current owner, and only let a transfer move ownership forward.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE tokens ADD COLUMN IF NOT EXISTS owner_ledger      BIGINT  NOT NULL DEFAULT 0;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS owner_event_index INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows accurately: the current owner reflects the LATEST
-- transfer (if any), otherwise the mint. Using the mint position for an
-- already-transferred token would leave a window where replaying an intermediate
-- transfer could regress ownership, so we read the real last transfer.
UPDATE tokens t
   SET owner_ledger      = lt.ledger,
       owner_event_index = lt.event_index
  FROM (
    SELECT DISTINCT ON (token_id) token_id, ledger, event_index
      FROM token_transfers
     WHERE kind = 'transfer'
     ORDER BY token_id, ledger DESC, event_index DESC
  ) lt
 WHERE t.token_id = lt.token_id
   AND t.owner_ledger = 0;

-- Tokens never transferred fall back to their mint position.
UPDATE tokens
   SET owner_ledger = minted_at_ledger, owner_event_index = minted_event_index
 WHERE owner_ledger = 0;

-- apply_minted_event: preserve the open-beta auto-register (20260628000001) AND
-- stamp the owner position, so the first transfer's guard compares against a real
-- baseline instead of 0.
CREATE OR REPLACE FUNCTION apply_minted_event(
  p_token_id          INTEGER,
  p_artist            TEXT,
  p_owner             TEXT,
  p_token_uri         TEXT,
  p_royalty_bps       INTEGER,
  p_recipients_count  INTEGER,
  p_ledger            BIGINT,
  p_tx                TEXT,
  p_event_index       INTEGER
) RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  INSERT INTO artists (address, registered_at_ledger, registered_at_tx, registered_event_index)
  VALUES (p_artist, p_ledger, p_tx, p_event_index)
  ON CONFLICT (address) DO NOTHING;

  INSERT INTO tokens (
    token_id, artist, owner, token_uri, royalty_bps, recipients_count,
    minted_at_ledger, minted_at_tx, minted_event_index,
    owner_ledger, owner_event_index
  )
  VALUES (
    p_token_id, p_artist, p_owner, p_token_uri, p_royalty_bps, p_recipients_count,
    p_ledger, p_tx, p_event_index,
    p_ledger, p_event_index
  )
  ON CONFLICT (token_id) DO NOTHING;
$$;

-- apply_transfer: move ownership only forward. `(ledger, event_index)` gives a
-- total order even for multiple transfers in the same ledger. The token_transfers
-- provenance log stays a full, unconditional record (ON CONFLICT DO NOTHING dedupes
-- replays).
CREATE OR REPLACE FUNCTION apply_transfer(
  p_token_id      INTEGER,
  p_from          TEXT,
  p_to            TEXT,
  p_ledger        BIGINT,
  p_tx            TEXT,
  p_event_index   INTEGER
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE tokens
     SET owner = p_to,
         owner_ledger = p_ledger,
         owner_event_index = p_event_index
   WHERE token_id = p_token_id
     AND (p_ledger, p_event_index) >= (owner_ledger, owner_event_index);

  INSERT INTO token_transfers (ledger, tx_hash, event_index, token_id, from_address, to_address, kind)
  VALUES (p_ledger, p_tx, p_event_index, p_token_id, p_from, p_to, 'transfer')
  ON CONFLICT DO NOTHING;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 2 (AJUSTE 3) — indexer error visibility
-- With the poller now rethrowing on a failed apply_*, a poison event blocks the
-- indexer (intended). To keep that diagnosable without log-diving, the poller
-- records WHICH event failed; /api/indexer/health surfaces it. Cleared on the next
-- successful cursor advance.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE indexer_cursor ADD COLUMN IF NOT EXISTS last_error_ledger      BIGINT;
ALTER TABLE indexer_cursor ADD COLUMN IF NOT EXISTS last_error_event_index INTEGER;
ALTER TABLE indexer_cursor ADD COLUMN IF NOT EXISTS last_error_message     TEXT;
ALTER TABLE indexer_cursor ADD COLUMN IF NOT EXISTS last_error_at          TIMESTAMPTZ;

-- Record the failing event (called by the poller just before it rethrows).
CREATE OR REPLACE FUNCTION record_indexer_error(
  p_ledger        BIGINT,
  p_event_index   INTEGER,
  p_message       TEXT
) RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  UPDATE indexer_cursor
     SET last_error_ledger      = p_ledger,
         last_error_event_index = p_event_index,
         last_error_message     = p_message,
         last_error_at          = now()
   WHERE id = 1;
$$;

-- advance_cursor: on a successful run, clear any recorded error alongside the
-- cursor advance (same signature as before).
CREATE OR REPLACE FUNCTION advance_cursor(
  p_last_ledger BIGINT,
  p_last_cursor TEXT
) RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  UPDATE indexer_cursor
     SET last_ledger            = p_last_ledger,
         last_cursor            = p_last_cursor,
         updated_at             = now(),
         last_error_ledger      = NULL,
         last_error_event_index = NULL,
         last_error_message     = NULL,
         last_error_at          = NULL
   WHERE id = 1;
$$;

-- Low-trust roles must not call the new writer (mirror the existing apply_* fns).
REVOKE EXECUTE ON FUNCTION record_indexer_error(BIGINT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
