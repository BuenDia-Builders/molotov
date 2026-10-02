# Contributing

Molotov is open to outside contributors through GrantFox-listed issues. Read this
before opening a PR — it covers the two things that get a PR closed without reward
no matter how good the code is.

## Never target `main` directly

`main` is connected to a live production deploy. Any merge to it ships to
`https://molotov-web.vercel.app` automatically — there is no manual approval step
between merge and production.

- Open your PR against a feature branch, not `main`.
- A PR only gets merged — and only then reaches production — after a maintainer
  reviews it and CI passes. Don't assume CI passing means it's safe to merge
  yourself; wait for the maintainer.
- If your change needs a live wallet or contract interaction to test, use **testnet
  only**. Never point local config at mainnet contract IDs, even temporarily.

## Rewards are conditional, not automatic

Payout happens only after a maintainer reviews the actual diff and confirms it does
what the issue asked — not from the PR being opened, titled correctly, or passing CI.

- Low-effort, placeholder, or boilerplate-only PRs (empty diffs, unrelated changes,
  copy-pasted scaffolding) will be closed without reward.
- We check the GitHub profile opening the PR. Accounts created immediately before
  submitting, with no prior history, matching a pattern of reward-farming across
  multiple bounty platforms, will not be rewarded and may be blocked from future
  issues in this repo.

## Backend work never needs our real credentials

If your issue touches `apps/web/app/api/*` or `apps/web/lib/db/*`, you don't need
any key from us. Run `supabase start` (config already in `supabase/config.toml`) —
it spins up Postgres + the API locally and prints you a local anon key. Point your
own `.env.local` at that local instance, apply the migrations in
`supabase/migrations/`, and seed a few fake rows yourself to exercise the endpoint
you're working on.

You will never be asked for `SUPABASE_SECRET_KEY`, `PINATA_JWT`, `CRON_SECRET`, or
any Privy/Stellar RPC credential to complete a backend issue. If an issue's
description seems to require one of those, that's a mistake in the issue — flag it
instead of asking for the real value.

Several routes also have a fully mocked test pattern already (see
`lib/db/sales.test.ts`) — you can write and verify logic with zero real or local
database connection at all.

## Everything else

- One concern per PR. If you find a second problem while fixing the first, open a
  separate issue for it instead of bundling the fix in.
- English for code, comments, commit messages, and any new doc.
- Before claiming a change works: `pnpm typecheck && pnpm --filter=web test && pnpm lint`.
  Contracts: `cd contracts && cargo test --workspace`.
