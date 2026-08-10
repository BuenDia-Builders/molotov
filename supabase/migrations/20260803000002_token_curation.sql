-- Token curation: a team-set flag to keep a token out of every public surface.
--
-- The chain is the source of truth and cannot forget: smoke-test mints with
-- fabricated URIs (ipfs://smoke-*, fixture-*, poll-test-*) exist on-chain and
-- the indexer rightly projects them. Deleting their rows would silently break
-- "the projection mirrors the chain", so instead the site filters on `hidden`
-- — curation is an off-chain concern, same as artists.handle. Set by the team
-- via service role; RLS already blocks anon writes.

ALTER TABLE tokens
  ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT FALSE;
