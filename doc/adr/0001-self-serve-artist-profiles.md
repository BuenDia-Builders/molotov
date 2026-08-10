# ADR 0001 — Self-serve artist profile editing via wallet signature

**Status:** Proposed
**Date:** 2026-08-03

## Context

Artist profiles (`artists.handle`, `artists.bio`, migration `20260803000001`)
are team-curated: the service role writes them, RLS blocks everything else.
That is fine for the current cohort size, but it does not scale and it makes
the team a bottleneck for something that belongs to the artist.

Molotov has no server-side accounts on purpose — identity _is_ the Stellar
address. So "the artist edits their own profile" must mean "someone who can
sign with the artist's key edits the profile", not "someone logged into an
account". This ADR proposes that mechanism; it is deliberately **out of scope**
of the distribution block and should land as its own PR.

## Decision (proposed)

A signed-message flow, no transaction and no fees:

1. **Nonce issuance.** `GET /api/profile/nonce?address=G...` returns
   `{ nonce, issuedAt }`. The nonce is a server-generated UUID stored with a
   10-minute TTL and a single-use flag (a small `profile_nonces` table written
   by the service role). Issuing is rate-limited per address and per IP with
   the existing helper in `lib/rate-limit.ts`.

2. **Message format.** The wallet signs this exact UTF-8 payload (SEP-53
   style, human-readable so wallets can display what is being approved):

   ```
   molotov:profile-update:v1
   address:<G...>
   nonce:<uuid>
   issued_at:<ISO-8601>
   handle:<handle-or-empty>
   bio:<bio-or-empty>
   ```

   The version line is first so a future v2 cannot be confused with v1. Every
   field the server will write is inside the signed payload — nothing is taken
   from the request body unsigned.

3. **Submission.** `POST /api/profile` with
   `{ address, nonce, issuedAt, handle, bio, signatureBase64 }`. The server:
   - rebuilds the payload from the fields and verifies the ed25519 signature
     against the address (`Keypair.fromPublicKey(address).verify(...)`);
   - checks the nonce exists, is unused, unexpired, and was issued for this
     address; marks it used in the same transaction;
   - validates `handle` against the same rules the DB enforces (lowercase,
     `[a-z0-9-]`, 3–30 chars, no edge hyphens, reserved-word blocklist) and
     `bio` length (≤ 500 chars, plain text);
   - rejects revoked artists (`artists.revoked = true`);
   - upserts via the service role.

4. **Wallet support.** Freighter and most SEP-43 wallets expose message
   signing (`signMessage` in Stellar Wallets Kit). Wallets that cannot sign
   messages keep the team-curated path; smart wallets (passkeys) are out of
   scope until the mainnet track defines their signature verification.

## Consequences

- The artist owns their handle and bio without Molotov holding any account
  state beyond a short-lived nonce table.
- Replay is blocked by the single-use nonce; cross-site reuse is blocked
  because the address is inside the signed payload; a stolen signature for v1
  cannot authorize anything else because the payload is purpose-prefixed.
- Handle squatting is bounded by the registry gate: only registered artists
  have rows, and the reserved-word blocklist plus uniqueness live in the DB,
  not just in the endpoint.
- The team keeps override capability (service role) for moderation.
