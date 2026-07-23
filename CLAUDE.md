# CLAUDE.md

Working notes for AI assistants in this repo. Public information only — everything here
is already in the code or the README.

## What Molotov is

A digital art marketplace on Stellar/Soroban where **the royalty is enforced by the
contract, not by the platform**. Major NFT marketplaces made royalties optional to
compete on fees; Molotov makes them mandatory at the contract level. The premise is
_inverted Spotify_: income flows **to** the creator, not away from them.

This premise is the product. When a change would weaken it, say so before implementing.

## Monorepo layout

pnpm workspaces + Turborepo. Node >= 20, pnpm 10.

| Path                            | What                                                                      |
| ------------------------------- | ------------------------------------------------------------------------- |
| `apps/web`                      | Next.js App Router frontend + the indexer API routes (`app/api/indexer/`) |
| `apps/mobile`                   | Empty placeholder — no app exists yet                                     |
| `contracts/`                    | Soroban contracts in Rust: `nft`, `marketplace`, `artist-registry`        |
| `packages/stellar-client`       | Generated TypeScript bindings (`stellar contract bindings typescript`)    |
| `packages/ui`, `packages/types` | Empty placeholders                                                        |
| `supabase/`                     | Migrations for the read-only projection the indexer writes                |
| `doc/`                          | Architecture, contracts, flows, indexer spec, marketplace invariants      |

Root scripts: `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm dev` (all via Turbo),
`pnpm format`.

Bindings in `packages/stellar-client` are **generated**. Change the Rust contract, then
regenerate — never hand-edit them.

## Royalty rules — the invariant that constrains most changes

Read `doc/marketplace-invariants.md` before touching `contracts/marketplace` or
`contracts/nft`. In short:

- The artist sets the royalty at mint, **1–15%**, enforced in the contract (not just the
  UI). After mint it is **immutable** — there are no setters; the ERC-2981-style stubs
  panic `RoyaltiesImmutableAfterMint`.
- A **primary sale** (`primary_split = Some(..)`) is the only path that skips the
  royalty, and `list` gates it: the caller must equal `nft.minter_of(token_id)`, else it
  panics `SplitNotAllowedForReseller`. A token with no recorded minter can never use a
  primary split.
- Therefore **every seller who is not the creator lands on the royalty-bearing secondary
  path**. There is no marketplace path that delivers a token against payment while
  skipping a non-creator's royalty.
- **Scope, stated precisely:** the guarantee is "royalty enforced on every _marketplace_
  resale." A plain SEP-50 `transfer` settled off-market bypasses the marketplace and
  therefore the royalty — the standard NFT tradeoff. Do not write copy or comments that
  claim enforcement on _every transfer_.
- Money conservation: every outgoing transfer in a sale sums to the sale price exactly.
  All distribution math lives in the pure `distribute` / `distribute_full`; `buy` only
  orchestrates around it. Keep new money math out of `buy`.

## Language conventions

- **The repo is 100% English** — code, comments, commit messages, and every versioned
  doc. No exceptions, including new files.
- **Product copy is Rioplatense Spanish** (voseo: _contá_, _mirá_, _tenés_). The UI
  dictionaries live in `apps/web/lib/i18n/` (ES + EN peers); see `docs/i18n.md`.
- **Voice: deliberately anti-crypto-bro.** No moon/gm/wagmi, no hype, no jargon as
  decoration. Speak to artists, not to traders — if a sentence would only land with
  someone already in crypto, rewrite it.
