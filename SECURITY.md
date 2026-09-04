# Security

## Scope

Molotov's critical guarantees — ownership, listings, settlement, fees, and royalty
distribution — are enforced by the Soroban smart contracts in [`contracts/`](contracts/),
currently deployed on **Stellar testnet**. The web app and the indexer are clients of
that on-chain state: they read and display it, but do not decide it.

This means the security model that matters most is the contracts', not the frontend's.
See [`doc/marketplace-invariants.md`](doc/marketplace-invariants.md) for the exact
properties enforced and the tests that lock each one in.

## What's verified today

- **Money conservation** — every outgoing transfer in a sale sums to the sale price
  exactly, checked by property-based tests over the pure distribution function
  (`distribute` / `distribute_full`).
- **Royalty enforcement on marketplace resales** — a reseller cannot skip the royalty;
  only the token's original minter can use a primary-sale split, and that split is
  validated against the royalty configuration set at mint. See
  [`doc/marketplace-invariants.md`](doc/marketplace-invariants.md) for the precise scope
  of this guarantee (marketplace resales, not every possible token transfer).
- **No double-purchase** — a listing is marked sold before any transfer happens, so a
  repeat or re-entrant `buy` on the same listing fails.
- **Mutation testing** (`cargo mutants`) — the current run generates 140 mutants across
  all three contracts; the suite catches 125, with 15 unviable and 0 surviving.
- **Static analysis** — CoinFabrik Scout runs on every push touching `contracts/`
  ([`.github/workflows/scout-audit.yml`](.github/workflows/scout-audit.yml)).

All of the above is reproducible: `cd contracts && cargo test --workspace` and
`cd contracts && cargo mutants`.

## What this does not cover

- **Off-marketplace transfers.** A plain token transfer settled outside the marketplace
  bypasses it, and therefore the royalty. This is a known, documented trade-off — see
  `doc/marketplace-invariants.md`.
- **Upgrade key custody.** All three contracts currently share a single owner key for
  upgrades. Moving this to a multisig/timelock is on the roadmap before mainnet.
- **The embedded-wallet (Privy) path** is gated to testnet only and is not part of the
  production trust model.

Detailed internal audit findings and attack-scenario write-ups are not published here —
they're used to drive fixes, not as public documentation.

## Reporting a vulnerability

**A private reporting channel is not configured on this repository yet.** Until it is,
please do not open a public GitHub issue for a suspected vulnerability.

To set one up (for a repo maintainer): go to **Settings → Security → Private vulnerability
reporting** on the GitHub repository and enable it. That gives reporters a "Report a
vulnerability" button under the Security tab, backed by GitHub Security Advisories,
without ever making the report public until a fix ships.
