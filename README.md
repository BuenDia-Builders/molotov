# Molotov

**Digital art marketplace where the royalty is enforced by the contract — not by the platform.**

> On every marketplace resale, the artist is paid before the sale can close. Or the sale doesn't happen.

🌐 **Live:** [molotov-web.vercel.app](https://molotov-web.vercel.app) · ⛓️ **Stellar testnet** · 🎨 Built for artists in Latin America

📄 **What is actually deployed** (and what isn't): [`doc/status.md`](doc/status.md) — read this before the roadmap.

---

## 💡 The problem

When a digital artwork resells for more, **the artist who made it usually sees nothing.**

Web3 was supposed to fix this with royalties — a cut for the artist on every resale. In practice, that promise collapsed. To compete on lower fees, the major NFT marketplaces made royalties **optional**, dependent on the goodwill of the buyer or the platform. Creators were cut out again, this time with extra jargon on top.

The real problem isn't technical — it's about **who captures the value**. And that gets decided in exactly one place: the contract that moves the money.

---

## ⚡ The solution

Molotov puts the royalty where nobody can renegotiate it:

- The artist sets their royalty at mint, **1–15%**, enforced by the contract — not by the form.
- Once minted it **can never be changed**. There are no royalty setters; the ERC-2981-style stubs panic `RoyaltiesImmutableAfterMint`.
- On every marketplace resale, the royalty is paid **before the sale can close**. If it can't be distributed, the whole sale reverts.
- The contract holds **zero funds**: it escrows the NFT and the buyer pays each recipient directly.

We call it _inverted Spotify_: income flows **to** the creator, not away from them.

### 📐 What "enforced" means here, precisely

**The guarantee is: every marketplace resale distributes the royalty.**

A plain SEP-50 `transfer` settled privately between two wallets bypasses the marketplace, and therefore the royalty. That is the standard NFT trade-off, and closing it would require transfer restrictions on the token itself — a different product decision, tracked on the mainnet roadmap. We would rather write this down than let someone discover it.

Within the marketplace, the guarantee has no exceptions. See [`doc/marketplace-invariants.md`](doc/marketplace-invariants.md) for the properties and the tests that lock each one in.

---

## 🔄 How it works — a real example

**A 100 XLM resale with a 10% royalty:**

| Recipient        | Amount   | Rule                                     |
| ---------------- | -------- | ---------------------------------------- |
| **Artist**       | 10 XLM   | enforced by contract — cannot be skipped |
| **Platform fee** | 2.5 XLM  | the only cut Molotov takes               |
| **Seller**       | 87.5 XLM | the remainder                            |

Every stroop is accounted for: `treasury(fee) + Σ(royalty) + seller_remainder == price`, exactly. Rounding dust from integer division lands deterministically on the last recipient, so nothing is created or lost. All arithmetic is checked, with `overflow-checks = true` in the release profile.

An optional **referral** share is carved _out of_ the platform fee — never added to the price. The seller's cost is identical whether or not a sale was referred.

### 🔒 The primary-sale gate

A "primary sale" is the one path that skips the royalty — and it exists for a good reason: on a first sale the royalty recipient _is_ the seller, so paying it would just move money in a circle.

The problem is that if anyone could declare a sale "primary", the guarantee would be worthless: a reseller would simply list with `primary_split = [100% to me]` and pay the artist nothing.

So `list` gates it. When a `primary_split` is present, the contract reads `nft.minter_of(token_id)` and panics `SplitNotAllowedForReseller` unless the seller **is** the token's creator. A token whose minter was never recorded can never use a primary split at all — it must sell on the royalty-bearing path.

The result: **every seller who is not the creator lands on the secondary path**, where the royalty vector is paid verbatim before they receive their remainder.

Tests: `b1_reseller_primary_split_rejected_at_list`, `b1_minter_primary_split_still_allowed`, `b1_reseller_without_split_pays_full_royalty`, `b1_legacy_token_without_minter_rejects_split`.

---

## 🏗️ Architecture

Three Soroban contracts, each with one responsibility:

| Contract           | Responsibility                                                               |
| ------------------ | ---------------------------------------------------------------------------- |
| **MolotovNFT**     | The artwork token. Stores the immutable royalty and the minter, set at mint. |
| **ArtistRegistry** | Allowlist of artist addresses. See the note below on its current state.      |
| **Marketplace**    | Listings, NFT escrow, and the money distribution on every sale.              |

> **⚠️ The artist gate is currently OFF on-chain.** The NFT's registry pointer is set to a placeholder, so **any wallet can mint** during the open beta. `/admin` offers register/revoke, and revoking does hide an artist from `/artists`, but it does not currently control who can mint. Turning the gate on is a `set_registry` call on the deployed NFT — a decision, not a build.

**Off-chain indexer** — the chain is the source of truth; we project its events into Supabase for fast reads. The projection is derived data, never authoritative:

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

The browser is a trust boundary: every API route is read-only, no key ever touches the signing path, and the **only** writer to Supabase is the indexer. Row-level security gives the anon key `SELECT` and nothing else.

---

## ✅ What's live

> Deployed and verified on **Stellar testnet**.

### Contracts

| Contract       | ID                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| MolotovNFT     | [`CBS6UQE5…C7XWS`](https://stellar.expert/explorer/testnet/contract/CBS6UQE542PLU54SVUIK76EKWUJ3CNPOQ35IB4WXKF3BU6YDIBEC7XWS)   |
| ArtistRegistry | [`CC37LTUP…RGU533`](https://stellar.expert/explorer/testnet/contract/CC37LTUPS5WLNBQSVNJJGBMZK4QCUJ76EFGW4RGY7XNVLKFKXCRGU533)  |
| Marketplace    | [`CB6T6DOY…B72K7DU`](https://stellar.expert/explorer/testnet/contract/CB6T6DOYV2JCD36ZE43ESXNGCL2GBDARCZNRVYQWOXGTZNJBWB72K7DU) |

### Product

- **Mint** — upload → IPFS (Pinata) → on-chain mint with the royalty written in.
- **Sell and resell** — fixed-price listings with NFT escrow; cancel returns the token.
- **Buy** — a single atomic invocation: payment, royalty, fee and delivery settle together or revert together.
- **Artist earnings** (`/earnings`) — every primary sale and every resale royalty, read from what the indexer projects. The two are reported separately on purpose: the resale royalty is money that arrived _after_ the work stopped being yours, and that is the whole argument.
- **Browse** — `/works`, `/token/[id]`, `/artists`, `/my-work`, and an owner-gated `/admin`.

### Indexer

A cursor-driven poller (`apps/web/app/api/indexer/`) that projects mint, transfer, burn, list, sold, cancel and artist register/revoke events into Supabase.

- **Idempotent** — every `apply_*` can be replayed safely; re-applying an event is a no-op.
- **Never skips** — a failed apply aborts the poll _before_ advancing the cursor, so an event cannot be silently dropped from the projection. The trade-off is deliberate: a genuinely bad event blocks the indexer until it is fixed, and `/api/indexer/health` says exactly which one.
- **Ordering-safe** — ownership only moves forward, stamped by `(ledger, event_index)`, so a partial replay of an old range cannot regress `tokens.owner`.
- **Health** — [`/api/indexer/health`](https://molotov-web.vercel.app/api/indexer/health) reports cursor lag, margin to the RPC retention floor, and the last blocking error. It returns `503` when a threshold is breached, so an uptime monitor can watch it.
- **Authenticated** — `/api/indexer` is gated by a bearer secret and fails closed in production.

### Standards

The contracts implement the Stellar ecosystem standards that let a third party integrate without bespoke work:

| Standard   | Where                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **SEP-50** | MolotovNFT is a standard non-fungible token (`transfer`, `burn`, `owner_of`, `balance`, `token_uri`) via OpenZeppelin Stellar Contracts |
| **SEP-49** | All three contracts are upgradeable in place, owner-gated                                                                               |
| **SEP-43** | Wallet connection through Stellar Wallets Kit — any conforming wallet works                                                             |

---

## 🧪 Engineering proof

Claims here are checkable by cloning the repo and running the commands.

- **111 contract tests** — `cd contracts && cargo test --workspace`. Property-based tests over the distribution math (conservation, dust, non-negativity, clean overflow), boundary cases, TTL lifetime tests, and XDR-level event assertions.
- **Mutation testing** (cargo-mutants) — a full run over all three contracts generates **140 mutants**; the suite currently catches **125**, with 15 unviable and **0 surviving**. Reproduce with `cd contracts && cargo mutants`.

  <sub>The four that survived the first full run were real gaps, all in the NFT: nothing asserted that a royalty of _exactly_ 1% or _exactly_ 15% is accepted (only that outside the range is rejected), that `get_royalty_info` tolerates a zero sale price, or that `burn_from` does anything at all. Tests were added rather than the claim narrowed.</sub>

- **Static analysis** — CoinFabrik Scout runs on every push touching `contracts/`, via [`.github/workflows/scout-audit.yml`](.github/workflows/scout-audit.yml).
- **CI** — contract tests, typecheck, lint and web tests run on every push to `main` and every pull request ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
- **Indexer decoding** — tested against a committed fixture of **real testnet XDR**, not synthetic events.
- **Conservation verified live** — a 100 XLM secondary sale with a 10% royalty and 2.5% fee settles to the stroop, zero residual.

### ⚠️ What CI does not cover

**`@molotov/indexer-db-tests` (25 tests) does not run in CI, and nobody runs it automatically.**

It is an integration suite that exercises the database layer directly — the RLS policies, the `SECURITY DEFINER` writer functions, and the idempotency of `apply_*` — against a **local Supabase**, which needs Docker. In CI there is no such instance, so every test fails on a connection error. Rather than let that make the pipeline permanently red (a red pipeline is a pipeline nobody reads), it is excluded.

The consequence is worth stating plainly: **the tests that cover the database's security model are the ones with no automation behind them.** Run them by hand after touching anything under `supabase/`:

```bash
supabase start                              # needs Docker
pnpm --filter=@molotov/indexer-db-tests test
```

Wiring this into CI means booting the local stack in the job — worth doing, not done yet.

---

## 💼 The business

**Why Stellar.** Low fees and fast settlement make micro-royalties economically viable. On high-gas chains, network fees can swallow a small royalty whole.

**How Molotov makes money.** A **2.5% platform fee** on every sale, set at contract construction and currently live on testnet. For comparison, objkt — the leading Tezos art marketplace — charges 5%. Revenue scales with volume, and the fee is the _only_ cut the platform takes: the royalty is paid by the buyer, not carved out of Molotov's share.

**The moat.** The royalty guarantee lives in the contract: public, immutable, verifiable. Artists don't have to trust the platform. The code is the policy.

**Who it's for.** Contemporary digital artists in Latin America who want their work to earn _over time_, not only at first sale. Editorial and gallery-first, deliberately anti-crypto-bro.

---

## 🛠️ Tech stack

| Layer                    | Stack                                                                     |
| ------------------------ | ------------------------------------------------------------------------- |
| Web app                  | Next.js 16 · React 19 · Tailwind CSS 4                                    |
| Smart contracts          | Soroban (Rust) · OpenZeppelin Stellar Contracts                           |
| Contract bindings        | Generated with `stellar contract bindings typescript` — never hand-edited |
| Wallets                  | Stellar Wallets Kit · Freighter · xBull · Albedo · LOBSTR · Hana          |
| Auth / embedded wallet   | Privy (email + Google) — **testnet only**, see below                      |
| Indexer + off-chain data | Supabase (PostgreSQL, RLS, SECURITY DEFINER writers)                      |
| File storage             | IPFS via Pinata                                                           |
| Monorepo                 | pnpm workspaces + Turborepo                                               |

> **Privy is gated to testnet.** The email path derives a Stellar keypair and keeps the secret in `localStorage`, which is fine for a demo and unacceptable for real funds. It is disabled outside testnet and will be replaced by smart accounts with passkeys before mainnet.

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

| Command                                  | What it does                        |
| ---------------------------------------- | ----------------------------------- |
| `pnpm dev`                               | Run the web app in development      |
| `pnpm build`                             | Build the workspace                 |
| `pnpm lint`                              | ESLint                              |
| `pnpm typecheck`                         | `tsc --noEmit` across the workspace |
| `pnpm --filter=web test`                 | Web + indexer unit tests            |
| `cd contracts && cargo test --workspace` | The 111 contract tests              |

> `pnpm test` at the root also runs `@molotov/indexer-db-tests`, an integration suite that needs a local Supabase (`supabase start`, requires Docker). Without the local stack those tests fail on a connection error — use the scoped commands above instead.

### Repository layout

```
apps/web            Next.js app + the indexer API routes
contracts           Soroban contracts: nft, artist-registry, marketplace
packages/stellar-client   Generated TypeScript bindings
supabase            Migrations and integration tests
doc                 Architecture, contracts, flows, indexer spec, invariants
```

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

_Built for PULSO Hackathon 2026 — NearX × Stellar Development Foundation_
