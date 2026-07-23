-- Event wall-clock timestamps.
--
-- Until now every projection table recorded WHEN something happened only as a
-- ledger sequence number. The Soroban RPC returns `ledgerClosedAt` on every event
-- and the poller was discarding it, so "when did this sell / mint / change hands"
-- was unanswerable off-chain. Worse, it was unanswerable *permanently*: events
-- older than the ~7-day RPC retention window can never be re-fetched, so every day
-- without capture lost those timestamps for good.
--
-- This migration adds the columns, threads `p_closed_at` through the five writer
-- functions, and hardens the writer ACLs. Backfill of rows already projected is a
-- separate one-off (apps/web/scripts/backfill-closed-at.ts) that updates by ledger
-- and never goes through these functions.
--
-- All four columns are nullable ON PURPOSE. NULL means "this event predates the
-- capture and is outside the retention window" — a permanent, legitimate state,
-- not an error. Consumers must render it as unknown, never as a failure.

-- ════════════════════════════════════════════════════════════════════════════
-- PART 1 — columns
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE sales           ADD COLUMN IF NOT EXISTS closed_at  TIMESTAMPTZ;
ALTER TABLE tokens          ADD COLUMN IF NOT EXISTS minted_at  TIMESTAMPTZ;
ALTER TABLE token_transfers ADD COLUMN IF NOT EXISTS closed_at  TIMESTAMPTZ;
ALTER TABLE listings        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 2 — writer functions
--
-- ⚠️ These are NOT replacements. A function's identity in Postgres is
-- (name, argument types), so adding `p_closed_at` CREATES A NEW FUNCTION and
-- leaves the old one alive. Because the new parameter has a DEFAULT, a call using
-- the original signature would then match BOTH overloads and fail with
-- "function ... is not unique" — which in practice means the indexer silently
-- stops writing. Every function below is therefore: CREATE new → DROP old (full
-- type list) → REVOKE on the new one.
--
-- The REVOKE is mandatory, not defensive: a newly created function is born with
-- EXECUTE granted to PUBLIC. Without it, `anon` could call the apply_* functions
-- directly and the single-writer model — Supabase as a pure projection of the
-- chain — would be broken. (20260723000001 could skip the re-revoke precisely
-- because it did not change any signature, so the ACLs carried over.)
--
-- ⚠️ Do NOT "improve" the ON CONFLICT DO NOTHING clauses into DO UPDATE in order
-- to backfill. apply_sold gates its editions_sold increment on the CTE's RETURNING:
-- with DO NOTHING a duplicate event returns zero rows and the counter is untouched,
-- which is what makes replay safe. With DO UPDATE the RETURNING yields a row on
-- every conflict, so each replay would re-increment editions_sold and could flip a
-- live listing to 'sold'. If a real upsert is ever needed here, the correct idiom is
-- `RETURNING listing_id, (xmax = 0) AS was_insert` and filtering on was_insert.
-- ════════════════════════════════════════════════════════════════════════════

-- ── NFT ───────────────────────────────────────────────────────────────────────

-- Carries forward the open-beta artist auto-register (20260628000001) and the
-- owner-position stamp (20260723000001).
CREATE OR REPLACE FUNCTION apply_minted_event(
  p_token_id          INTEGER,
  p_artist            TEXT,
  p_owner             TEXT,
  p_token_uri         TEXT,
  p_royalty_bps       INTEGER,
  p_recipients_count  INTEGER,
  p_ledger            BIGINT,
  p_tx                TEXT,
  p_event_index       INTEGER,
  p_closed_at         TIMESTAMPTZ DEFAULT NULL
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
    owner_ledger, owner_event_index, minted_at
  )
  VALUES (
    p_token_id, p_artist, p_owner, p_token_uri, p_royalty_bps, p_recipients_count,
    p_ledger, p_tx, p_event_index,
    p_ledger, p_event_index, p_closed_at
  )
  ON CONFLICT (token_id) DO NOTHING;
$$;

DROP FUNCTION IF EXISTS apply_minted_event(
  INTEGER, TEXT, TEXT, TEXT, INTEGER, INTEGER, BIGINT, TEXT, INTEGER
);

REVOKE EXECUTE ON FUNCTION apply_minted_event(
  INTEGER, TEXT, TEXT, TEXT, INTEGER, INTEGER, BIGINT, TEXT, INTEGER, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

-- Carries forward the ownership ordering guard (20260723000001): ownership moves
-- only forward, while the provenance log stays an unconditional record.
CREATE OR REPLACE FUNCTION apply_transfer(
  p_token_id      INTEGER,
  p_from          TEXT,
  p_to            TEXT,
  p_ledger        BIGINT,
  p_tx            TEXT,
  p_event_index   INTEGER,
  p_closed_at     TIMESTAMPTZ DEFAULT NULL
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

  INSERT INTO token_transfers (
    ledger, tx_hash, event_index, token_id, from_address, to_address, kind, closed_at
  )
  VALUES (p_ledger, p_tx, p_event_index, p_token_id, p_from, p_to, 'transfer', p_closed_at)
  ON CONFLICT DO NOTHING;
END;
$$;

DROP FUNCTION IF EXISTS apply_transfer(INTEGER, TEXT, TEXT, BIGINT, TEXT, INTEGER);

REVOKE EXECUTE ON FUNCTION apply_transfer(
  INTEGER, TEXT, TEXT, BIGINT, TEXT, INTEGER, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION apply_burn(
  p_token_id      INTEGER,
  p_from          TEXT,
  p_ledger        BIGINT,
  p_tx            TEXT,
  p_event_index   INTEGER,
  p_closed_at     TIMESTAMPTZ DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE tokens SET burned = TRUE WHERE token_id = p_token_id;

  INSERT INTO token_transfers (
    ledger, tx_hash, event_index, token_id, from_address, to_address, kind, closed_at
  )
  VALUES (p_ledger, p_tx, p_event_index, p_token_id, p_from, NULL, 'burn', p_closed_at)
  ON CONFLICT DO NOTHING;
END;
$$;

DROP FUNCTION IF EXISTS apply_burn(INTEGER, TEXT, BIGINT, TEXT, INTEGER);

REVOKE EXECUTE ON FUNCTION apply_burn(
  INTEGER, TEXT, BIGINT, TEXT, INTEGER, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

-- ── Marketplace ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION apply_listing_created(
  p_listing_id      BIGINT,
  p_nft_contract    TEXT,
  p_seller          TEXT,
  p_token_id        INTEGER,
  p_price           NUMERIC,
  p_currency        TEXT,
  p_kind            TEXT,
  p_editions_total  INTEGER,
  p_ends_at         BIGINT,
  p_referral_bps    INTEGER,
  p_primary_split   JSONB,
  p_ledger          BIGINT,
  p_tx              TEXT,
  p_event_index     INTEGER,
  p_closed_at       TIMESTAMPTZ DEFAULT NULL
) RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  INSERT INTO listings (
    listing_id, nft_contract, seller, token_id, price, currency, kind,
    editions_total, ends_at, referral_bps, primary_split,
    created_at_ledger, created_at_tx, created_event_index, created_at
  )
  VALUES (
    p_listing_id, p_nft_contract, p_seller, p_token_id, p_price, p_currency, p_kind,
    p_editions_total, p_ends_at, p_referral_bps, p_primary_split,
    p_ledger, p_tx, p_event_index, p_closed_at
  )
  ON CONFLICT (listing_id) DO NOTHING;
$$;

DROP FUNCTION IF EXISTS apply_listing_created(
  BIGINT, TEXT, TEXT, INTEGER, NUMERIC, TEXT, TEXT, INTEGER, BIGINT, INTEGER, JSONB,
  BIGINT, TEXT, INTEGER
);

REVOKE EXECUTE ON FUNCTION apply_listing_created(
  BIGINT, TEXT, TEXT, INTEGER, NUMERIC, TEXT, TEXT, INTEGER, BIGINT, INTEGER, JSONB,
  BIGINT, TEXT, INTEGER, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

-- The CTE ties the listings UPDATE to the sales INSERT: if the INSERT no-ops
-- (duplicate event), `inserted` returns zero rows, the FROM join matches nothing,
-- and editions_sold is not double-incremented. See the DO UPDATE warning above.
CREATE OR REPLACE FUNCTION apply_sold(
  p_ledger          BIGINT,
  p_tx              TEXT,
  p_event_index     INTEGER,
  p_listing_id      BIGINT,
  p_token_id        INTEGER,
  p_buyer           TEXT,
  p_seller          TEXT,
  p_price           NUMERIC,
  p_currency        TEXT,
  p_royalty_paid    NUMERIC,
  p_referral_paid   NUMERIC,
  p_fee_paid        NUMERIC,
  p_closed_at       TIMESTAMPTZ DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  WITH inserted AS (
    INSERT INTO sales (
      ledger, tx_hash, event_index,
      listing_id, token_id, buyer, seller, price, currency,
      royalty_paid, referral_paid, fee_paid, closed_at
    )
    VALUES (
      p_ledger, p_tx, p_event_index,
      p_listing_id, p_token_id, p_buyer, p_seller, p_price, p_currency,
      p_royalty_paid, p_referral_paid, p_fee_paid, p_closed_at
    )
    ON CONFLICT DO NOTHING
    RETURNING listing_id
  )
  UPDATE listings l
     SET editions_sold = l.editions_sold + 1,
         status = CASE
           WHEN l.kind = 'fixed_price'              THEN 'sold'
           WHEN l.editions_sold + 1 >= l.editions_total THEN 'sold'
           ELSE l.status
         END
    FROM inserted i
   WHERE l.listing_id = i.listing_id;
END;
$$;

DROP FUNCTION IF EXISTS apply_sold(
  BIGINT, TEXT, INTEGER, BIGINT, INTEGER, TEXT, TEXT, NUMERIC, TEXT,
  NUMERIC, NUMERIC, NUMERIC
);

REVOKE EXECUTE ON FUNCTION apply_sold(
  BIGINT, TEXT, INTEGER, BIGINT, INTEGER, TEXT, TEXT, NUMERIC, TEXT,
  NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 3 — close a pre-existing hole the guard below found
--
-- reset_projection() TRUNCATEs sales, token_transfers, listings, tokens and
-- artists and rewinds the indexer cursor to 0. It is SECURITY DEFINER, and
-- 20260611000011 revoked it `FROM anon, authenticated` — without PUBLIC.
--
-- Postgres grants EXECUTE to PUBLIC by default, and revoking from anon does not
-- take away what anon holds *through* PUBLIC. So the function stayed callable by
-- the anon key, which ships in the client bundle: anyone could wipe the whole
-- projection. Recovery would be a replay, which only reaches back as far as the
-- RPC retention window — everything older would be gone for good.
--
-- Every other writer in this schema revokes FROM PUBLIC, anon, authenticated.
-- This is that one line, applied forward rather than by editing a migration that
-- already ran.
-- ════════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION reset_projection() FROM PUBLIC, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 4 — guards
--
-- Both failure modes above are silent: an orphan overload only surfaces on the
-- next write, and a leaked EXECUTE grant surfaces never. Fail the migration
-- instead of leaving either latent.
-- ════════════════════════════════════════════════════════════════════════════

-- No apply_* may be left with more than one overload.
DO $$
DECLARE dup TEXT;
BEGIN
  SELECT string_agg(proname, ', ') INTO dup FROM (
    SELECT p.proname
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.proname LIKE 'apply\_%'
     GROUP BY p.proname HAVING count(*) > 1
  ) s;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION
      'Orphan apply_* overloads remain (the indexer would fail with "is not unique"): %',
      dup;
  END IF;
END $$;

-- No writer function may be executable by anon/authenticated.
DO $$
DECLARE leaked TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN RETURN; END IF;

  SELECT string_agg(format('%s(%s)', p.proname,
                    pg_get_function_identity_arguments(p.oid)), ', ') INTO leaked
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public'
     AND (p.proname LIKE 'apply\_%'
          OR p.proname IN ('advance_cursor', 'record_indexer_error', 'reset_projection'))
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));

  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION
      'Writer functions executable by anon/authenticated (single-writer model broken): %',
      leaked;
  END IF;
END $$;
