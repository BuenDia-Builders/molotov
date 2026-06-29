-- During open-beta the ArtistRegistry gate is disabled on-chain (any wallet can mint).
-- Auto-insert the minting wallet into artists using the mint event's ledger/tx as a
-- proxy registration so the FK constraint on tokens.artist is satisfied.
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
    minted_at_ledger, minted_at_tx, minted_event_index
  )
  VALUES (
    p_token_id, p_artist, p_owner, p_token_uri, p_royalty_bps, p_recipients_count,
    p_ledger, p_tx, p_event_index
  )
  ON CONFLICT (token_id) DO NOTHING;
$$;
