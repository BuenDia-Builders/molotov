-- Artist profiles: handle (vanity slug) + bio, both team-curated for now.
--
-- The artists table is written by the indexer from chain events; handle and bio
-- are the first purely off-chain columns on it. They are loaded by the team
-- (service role) until self-serve editing lands (see doc/adr/0001). RLS already
-- allows public SELECT on artists and blocks anon writes, so no policy changes.
--
-- Routing contract (apps/web/app/artist/[slug]):
--   /artist/<address> always resolves; when a handle exists it 301-redirects to
--   /artist/<handle>, the canonical URL. The handle is never displayed as a
--   name by itself — display name falls back to the truncated address.

ALTER TABLE artists
  ADD COLUMN handle TEXT,
  ADD COLUMN bio    TEXT;

-- Format: lowercase letters/digits/hyphens, 3-30 chars, no leading/trailing
-- hyphen. Lowercase-only in the CHECK plus a unique index over lower(handle)
-- keeps the namespace case-insensitively unique even if a future write path
-- forgets to normalize.
ALTER TABLE artists
  ADD CONSTRAINT artists_handle_format
  CHECK (handle IS NULL OR handle ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$');

CREATE UNIQUE INDEX artists_handle_unique_ci ON artists (lower(handle)) WHERE handle IS NOT NULL;

-- Reserved namespace: everything routed at the app root, plus obvious traps.
-- A handle equal to an app route would shadow that route (or be shadowed).
ALTER TABLE artists
  ADD CONSTRAINT artists_handle_not_reserved
  CHECK (
    handle IS NULL
    OR handle NOT IN (
      'about', 'admin', 'api', 'artist', 'artists', 'create', 'earnings',
      'my-work', 'team', 'token', 'works',
      'molotov', 'root', 'soporte', 'support', 'wallet', 'www'
    )
  );
