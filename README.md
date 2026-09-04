# Molotov

**Molotov is an on-chain NFT marketplace built on Stellar.** Artists mint, list, sell
and resell digital art while ownership, settlement, fees, and royalties are enforced by
Soroban smart contracts on the Stellar network — not by the platform.

> On every marketplace resale, the artist is paid before the sale can close. Or the sale doesn't happen.

🌐 **Live:** [molotov-web.vercel.app](https://molotov-web.vercel.app) · ⛓️ **Stellar testnet** · 🎨 Built for artists in Latin America

📄 **What is actually deployed** (and what isn't): [`doc/status.md`](doc/status.md) — read this before the roadmap.

---

## 💡 What is Molotov?

### The problem

When a digital artwork resells for more, **the artist who made it usually sees nothing.**

Web3 was supposed to fix this with royalties — a cut for the artist on every resale. In practice, that promise collapsed. To compete on lower fees, the major NFT marketplaces made royalties **optional**, dependent on the goodwill of the buyer or the platform. Creators were cut out again, this time with extra jargon on top.

The real problem isn't technical — it's about **who captures the value**. And that gets decided in exactly one place: the contract that moves the money.

### The solution

Molotov puts the royalty where nobody can renegotiate it. The web app is the interface
people use, but it is not where the guarantee lives — the **Soroban smart contracts**
are where minting, listing, purchase, ownership transfer, fees and royalty
distribution actually execute, on Stellar:

- The artist sets their royalty at mint, **1–15%**, enforced by the contract — not by the form.
- Once minted it **can never be changed**. There are no royalty setters; the ERC-2981-style stubs panic `RoyaltiesImmutableAfterMint`.
- On every marketplace resale, the royalty is paid **before the sale can close**. If it can't be distributed, the whole sale reverts.
- The contract holds **zero funds**: it escrows the NFT and the buyer pays each recipient directly.

We call it _inverted Spotify_: income flows **to** the creator, not away from them.

> **What "enforced" means here, precisely:** the guarantee is that every marketplace
> resale distributes the royalty. A plain SEP-50 `transfer` settled privately between
> two wallets bypasses the marketplace, and therefore the royalty — the standard NFT
> trade-off, tracked on the Roadmap, below. Within the marketplace, the
> guarantee has no exceptions. See
> [`doc/marketplace-invariants.md`](doc/marketplace-invariants.md) for the properties
> and the tests that lock each one in.

**Why Stellar.** Low fees and fast settlement make micro-royalties economically
viable — on high-gas chains, network fees can swallow a small royalty whole. That's why
the contracts, not a side integration, are where Molotov's guarantees live.

**Who it's for.** Contemporary digital artists in Latin America who want their work to
earn _over time_, not only at first sale. Editorial and gallery-first, deliberately
anti-crypto-bro.

---

## 🔄 How it works

**Mint → List → Sale → Ownership transfer → (on resale) Royalty**

1. **Mint** — the artist uploads to IPFS (Pinata) and mints on-chain; the royalty (1–15%, one or more recipients) is written into the token at this step and can never change afterwards.
2. **List** — the seller escrows the token into the marketplace contract at a fixed price. A **primary sale** (only the token's original minter can use it) skips the royalty, since the recipient would be the seller themselves. Every other listing is a **secondary sale** and always pays the royalty.
3. **Buy** — one atomic contract call: payment, fee, royalty (if secondary) and NFT delivery settle together, or the whole transaction reverts.
4. **Resell** — the new owner can list again; every subsequent resale is a secondary sale, so the royalty is paid again.

A concrete example — **a 100 XLM resale with a 10% royalty:**

| Recipient        | Amount   | Rule                                     |
| ---------------- | -------- | ---------------------------------------- |
| **Artist**       | 10 XLM   | enforced by contract — cannot be skipped |
| **Platform fee** | 2.5 XLM  | the only cut Molotov takes               |
| **Seller**       | 87.5 XLM | the remainder                            |

Every stroop is accounted for: `treasury(fee) + Σ(royalty) + seller_remainder == price`, exactly. Rounding dust from integer division lands deterministically on the last recipient, so nothing is created or lost. All arithmetic is checked, with `overflow-checks = true` in the release profile.

An optional **referral** share is carved _out of_ the platform fee — never added to the price. The seller's cost is identical whether or not a sale was referred.

### The primary-sale gate

A "primary sale" is the one path that skips the royalty — and it exists for a good reason: on a first sale the royalty recipient _is_ the seller, so paying it would just move money in a circle.

The problem is that if anyone could declare a sale "primary", the guarantee would be worthless: a reseller would simply list with `primary_split = [100% to me]` and pay the artist nothing.

So `list` gates it. When a `primary_split` is present, the contract reads `nft.minter_of(token_id)` and panics `SplitNotAllowedForReseller` unless the seller **is** the token's creator. A token whose minter was never recorded can never use a primary split at all — and the split itself must match the royalty recipients recorded at mint, so a minter can't route a collaborator's share to themselves.

The result: **every seller who is not the creator lands on the secondary path**, where the royalty vector is paid verbatim before they receive their remainder.

---

## 🏗️ Architecture

Molotov's critical state — who owns what, what's listed, what's been paid — lives in
Soroban smart contracts on Stellar, not in a database Molotov controls. The web app and
the indexer are **clients** of that on-chain state; neither is its source of truth.

Three Soroban contracts, each with one responsibility:

| Contract           | Responsibility                                                               |
| ------------------ | ---------------------------------------------------------------------------- |
| **MolotovNFT**     | The artwork token. Stores the immutable royalty and the minter, set at mint. |
| **ArtistRegistry** | Allowlist of artist addresses. See the note below on its current state.      |
| **Marketplace**    | Listings, NFT escrow, and the money distribution on every sale.              |

> **⚠️ The artist gate is currently OFF on-chain.** The NFT's registry pointer is set to a placeholder, so **any wallet can mint** during the open beta. `/admin` offers register/revoke, and revoking does hide an artist from `/artists`, but it does not currently control who can mint. Turning the gate on is a `set_registry` call on the deployed NFT — a decision, not a build.

**Off-chain indexer** — the chain is the source of truth; the indexer projects its
events into Supabase so the web app can query them quickly. The projection is derived
data, never authoritative:

```
Contracts (Stellar) ── emit events
        ↓
Soroban RPC (getEvents)
        ↓
Indexer: fetch → decode → apply → advance cursor ↻
        ↓
Supabase (queryable projection, read-only to the client)
        ↓
Web app (Next.js)
```

The browser is a trust boundary: every API route is read-only, no key ever touches the signing path, and the **only** writer to Supabase is the indexer. Row-level security gives the anon key `SELECT` and nothing else. If the indexer stopped entirely, the contracts' state — and the guarantees above — would be unaffected; only the web app's read speed would suffer.

---

## ✅ Core features

- **Mint** — upload → IPFS (Pinata) → on-chain mint with the royalty written in.
- **List, sell and resell** — fixed-price listings with NFT escrow; cancel returns the token.
- **Buy** — a single atomic invocation: payment, royalty, fee and delivery settle together or revert together.
- **Creator royalties, enforced on-chain** — 1–15%, immutable after mint, paid on every marketplace resale.
- **Marketplace fee** — a flat 2.5%, the only cut Molotov takes.
- **Ownership tracked on-chain** — the NFT contract is the source of truth for who owns what.
- **Artist earnings** (`/earnings`) — every primary sale and every resale royalty, read from what the indexer projects. The two are reported separately on purpose: the resale royalty is money that arrived _after_ the work stopped being yours.
- **Browse** — `/works`, `/token/[id]`, `/artists`, `/my-work`, and an owner-gated `/admin`.

### Standards

| Standard   | Where                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **SEP-50** | MolotovNFT is a standard non-fungible token (`transfer`, `burn`, `owner_of`, `balance`, `token_uri`) via OpenZeppelin Stellar Contracts |
| **SEP-49** | All three contracts are upgradeable in place, owner-gated                                                                               |
| **SEP-43** | Wallet connection through Stellar Wallets Kit — any conforming wallet works                                                             |

---

## 📡 Current status

> Deployed on **Stellar testnet** only. **[`doc/status.md`](doc/status.md)** is the
> single source for what is live right now — network, deployed contract IDs, and
> exactly which features are on or off. This section will drift out of date; that one
> won't.

### Indexer

A cursor-driven poller (`apps/web/app/api/indexer/`) that projects mint, transfer, burn, list, sold, cancel and artist register/revoke events into Supabase.

- **Idempotent** — every `apply_*` can be replayed safely; re-applying an event is a no-op.
- **Never skips** — a failed apply aborts the poll _before_ advancing the cursor, so an event cannot be silently dropped from the projection. A genuinely bad event blocks the indexer until it is fixed, and `/api/indexer/health` says exactly which one.
- **Ordering-safe** — ownership only moves forward, stamped by `(ledger, event_index)`, so a partial replay of an old range cannot regress `tokens.owner`.
- **Health** — [`/api/indexer/health`](https://molotov-web.vercel.app/api/indexer/health) reports cursor lag, margin to the RPC retention floor, and the last blocking error; returns `503` when a threshold is breached.
- **Authenticated** — `/api/indexer` is gated by a bearer secret and fails closed in production.

### Not yet built

- `apps/mobile/` — empty placeholder, no native app exists yet.
- `packages/ui/`, `packages/types/` — empty placeholders for shared code not extracted yet.
- The artist gate described above is implemented but switched off.
- See the Roadmap, below, for what's planned next.

---

## 🔒 Engineering & security guarantees

See [`SECURITY.md`](SECURITY.md) for the public security model, its scope, and how to
report a vulnerability. What follows here is checkable by cloning the repo and running
the commands below — nothing in this section is a claim without a test behind it.

Guarantees currently backed by contract tests:

- **Atomic settlement** — `buy` is one contract call; payment, fee, royalty and delivery succeed together, or the whole transaction reverts.
- **No double purchase** — a listing is marked `Sold` before any token or payment moves, so a repeat or re-entrant `buy` on the same listing fails.
- **Ownership integrity** — the NFT contract is the sole source of truth for `owner_of`; the marketplace only ever moves a token it currently escrows.
- **Fee conservation** — `treasury(fee) + Σ(royalty) + seller_remainder == price`, exactly, checked by property-based tests over the pure distribution function (`distribute` / `distribute_full`).
- **Royalty enforcement on marketplace resales** — see "The primary-sale gate" above; a reseller cannot skip it.
- **Primary vs. secondary sale behavior** — a primary split is accepted only from the token's recorded minter, and must match the royalty recipients set at mint.

Proof:

- **Contract tests** — `cd contracts && cargo test --workspace`. Property-based tests over the distribution math (conservation, dust, non-negativity, clean overflow), boundary cases, TTL lifetime tests, and XDR-level event assertions.
- **Mutation testing** (cargo-mutants) — a full run over all three contracts generates **140 mutants**; the suite currently catches **125**, with 15 unviable and **0 surviving**. Reproduce with `cd contracts && cargo mutants`.
- **Static analysis** — CoinFabrik Scout runs on every push touching `contracts/`, via [`.github/workflows/scout-audit.yml`](.github/workflows/scout-audit.yml).
- **Indexer decoding** — tested against a committed fixture of **real testnet XDR**, not synthetic events.
- **Conservation verified live** — a 100 XLM secondary sale with a 10% royalty and 2.5% fee settles to the stroop, zero residual.

### What this doesn't cover

- A plain SEP-50 `transfer` settled off-market bypasses the marketplace, and therefore the royalty — the standard NFT trade-off (see [`doc/marketplace-invariants.md`](doc/marketplace-invariants.md)).
- All three contracts currently share a single owner key for upgrades — moving it to a multisig/timelock is a mainnet roadmap item.
- `@molotov/indexer-db-tests` (25 tests — the database security/RLS suite) does not run in CI; it needs a local Supabase over Docker. See Testing, below.

---

## 🛠️ Tech stack

| Layer                    | Stack                                                                     |
| ------------------------ | ------------------------------------------------------------------------- |
| Web app                  | Next.js 16 · React 19 · Tailwind CSS 4                                    |
| Smart contracts          | Soroban (Rust) on Stellar · OpenZeppelin Stellar Contracts                |
| Contract bindings        | Generated with `stellar contract bindings typescript` — never hand-edited |
| Wallets                  | Stellar Wallets Kit · Freighter · xBull · Albedo · LOBSTR · Hana          |
| Auth / embedded wallet   | Privy (email + Google) — **testnet only**, see below                      |
| Indexer + off-chain data | Supabase (PostgreSQL, RLS, SECURITY DEFINER writers)                      |
| File storage             | IPFS via Pinata                                                           |
| Monorepo                 | pnpm workspaces + Turborepo                                               |

> **Privy is gated to testnet.** The email path derives a Stellar keypair and keeps the secret in `localStorage`, which is fine for a demo and unacceptable for real funds. It is disabled outside testnet and will be replaced by smart accounts with passkeys before mainnet.

---

## 🗂️ Repository structure

```text
.
├── apps/
│   ├── web/        # Next.js app: UI, indexer API routes, IPFS/Pinata integration
│   └── mobile/     # Empty placeholder — no native app yet
├── contracts/
│   ├── nft/              # MolotovNFT — the artwork token
│   ├── marketplace/      # Listings, escrow, money distribution
│   └── artist-registry/  # Artist allowlist (deployed but not yet wired to mint gating)
├── packages/
│   ├── stellar-client/   # Generated TypeScript contract bindings — never hand-edited
│   ├── types/            # Empty placeholder — shared types not extracted yet
│   └── ui/               # Empty placeholder — shared UI not extracted yet
├── supabase/
│   ├── migrations/       # Projection schema
│   └── tests/            # Database/RLS integration suite (needs local Supabase)
├── doc/            # Technical documentation — see Documentation below
├── docs/           # Public GitHub Pages brand microsite (unrelated to doc/)
└── .github/
    └── workflows/  # CI, indexer cron, projection backup, static analysis
```

---

## 📚 Documentation

Each doc is the single source for one thing — link to it instead of restating its facts.

| Document                                                                                                               | Audience              | Purpose                                                                    |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------- |
| [`doc/status.md`](doc/status.md)                                                                                       | Everyone              | What is live right now — network, contract IDs, features on/off.           |
| [`doc/architecture.md`](doc/architecture.md)                                                                           | Developers            | The intended design — flows, contract interfaces. Not current state.       |
| [`doc/marketplace-invariants.md`](doc/marketplace-invariants.md)                                                       | Developers / Auditors | The royalty & marketplace invariants and the tests that lock each in.      |
| [`doc/indexer-spec.md`](doc/indexer-spec.md)                                                                           | Developers            | The indexer contract — events consumed, projection schema, decoding rules. |
| [`doc/indexer-operations.md`](doc/indexer-operations.md)                                                               | Developers / Ops      | Runbook — retention window, scheduling, health, cursor recovery.           |
| [`doc/analytics.md`](doc/analytics.md)                                                                                 | Developers            | Analytics spec (PostHog events and tracking).                              |
| [`doc/adr/`](doc/adr/)                                                                                                 | Developers            | Architecture decision records — why a decision was made.                   |
| [`doc/i18n.md`](doc/i18n.md)                                                                                           | Developers            | i18n conventions for the ES/EN dictionaries.                               |
| [`doc/wave-moderation.md`](doc/wave-moderation.md)                                                                     | Developers            | Contribution/wave moderation log.                                          |
| [`doc/branding/`](doc/branding/)                                                                                       | Everyone              | Brand assets.                                                              |
| [`doc/flows.md`](doc/flows.md), [`doc/contracts.md`](doc/contracts.md), [`doc/migration-map.md`](doc/migration-map.md) | Developers            | Legacy Spanish references; kept as-is, may have drifted.                   |
| [`SECURITY.md`](SECURITY.md)                                                                                           | Everyone              | Public security model and how to report a vulnerability.                   |

---

## 🚀 Getting started

**Requirements:** Node 20, pnpm 10, Rust with the `wasm32v1-none` target, Stellar CLI.

```bash
git clone https://github.com/BuenDia-Builders/molotov.git
cd molotov
pnpm install
cp apps/web/.env.example apps/web/.env.local   # Supabase, Pinata and Privy keys
pnpm dev
```

| Command          | What it does                        |
| ---------------- | ----------------------------------- |
| `pnpm dev`       | Run the web app in development      |
| `pnpm build`     | Build the workspace                 |
| `pnpm lint`      | ESLint                              |
| `pnpm typecheck` | `tsc --noEmit` across the workspace |

---

## 🧪 Testing

| Command                                  | Covers                                       |
| ---------------------------------------- | -------------------------------------------- |
| `cd contracts && cargo test --workspace` | Contract tests — money math, invariants, TTL |
| `cd contracts && cargo mutants`          | Mutation testing (numbers above)             |
| `pnpm --filter=web test`                 | Web + indexer unit tests                     |
| `pnpm lint` / `pnpm typecheck`           | Static checks across the workspace           |

> `pnpm test` at the root also runs `@molotov/indexer-db-tests`, an integration suite
> that needs a local Supabase (`supabase start`, requires Docker). Without the local
> stack those tests fail on a connection error — use the scoped commands above, or run
> that suite directly:
>
> ```bash
> supabase start                              # needs Docker
> pnpm --filter=@molotov/indexer-db-tests test
> ```

**CI** runs contract tests, typecheck, lint and web tests on every push to `main` and every pull request ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). The database/RLS suite above is the one exception — see "What this doesn't cover", above.

---

## 🌍 Deployment & networks

| What               | Where                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| Network            | Stellar **testnet** only — see [`doc/status.md`](doc/status.md) for exact contract IDs           |
| Web app            | [molotov-web.vercel.app](https://molotov-web.vercel.app), deployed from `main`                   |
| Indexer scheduling | GitHub Actions cron ([`.github/workflows/indexer-cron.yml`](.github/workflows/indexer-cron.yml)) |
| Projection backups | Daily, via [`.github/workflows/projection-backup.yml`](.github/workflows/projection-backup.yml)  |
| Brand microsite    | GitHub Pages, served from `main:/docs` — unrelated to the app above                              |

---

## 💼 Business model

**How Molotov makes money.** A **2.5% platform fee** on every sale, set at contract construction and currently live on testnet. For comparison, objkt — the leading Tezos art marketplace — charges 5%. Revenue scales with volume, and the fee is the _only_ cut the platform takes: the royalty is paid by the buyer, not carved out of Molotov's share.

**The moat.** The royalty guarantee lives in the contract: public, immutable, verifiable. Artists don't have to trust the platform. The code is the policy.

---

## 🗺️ Roadmap

Nothing in this section exists yet.

**Toward mainnet**

- Move the upgrade key to a multisig with a timelock. Today all three contracts share a single owner key, which means "immutable" is only as strong as that key.
- Replace the Privy email path with smart accounts + passkeys, so onboarding does not require a browser extension and no secret ever lives in `localStorage`.
- Centralize network configuration; today the testnet/mainnet switch is not a single source of truth.
- Add an emergency pause (`Pausable`) to the marketplace. _(The allowlist of NFT contracts the marketplace will settle is already implemented in the contract — `set_allowed_nft`, checked in `list`/`buy` — and pending deployment; see [`doc/status.md`](doc/status.md).)_
- Decide and document the royalty-recipient trustline requirement.

**Product**

- USDC-denominated listings so artists price in dollars and Stellar stays invisible.
- WalletConnect, making responsive web the mobile story for this stage — there is no native app, and `apps/mobile/` is an empty placeholder.
- Bank withdrawal for Argentine artists (ARS or USD).
- Portuguese. Spanish and English both ship today; Spanish is the product's voice.

---

_Molotov — digital art where creating earns you a permanent stake in what you made._
