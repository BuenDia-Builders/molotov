-- Collections: off-chain, team-curated grouping of tokens (architecture §9.2).
-- Nothing on-chain knows about collections — they are editorial structure over
-- minted tokens, written by the team via service role until curation tooling
-- exists. Public read only, same RLS posture as the projection tables.

CREATE TABLE collections (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE
                 CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  title          TEXT NOT NULL,
  -- Curator/owner address when the collection belongs to one artist; null for
  -- editorial (team) collections.
  artist         TEXT,
  -- Token whose artwork fronts the collection card.
  cover_token_id INTEGER,
  token_ids      INTEGER[] NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON collections FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON collections TO anon, authenticated;
