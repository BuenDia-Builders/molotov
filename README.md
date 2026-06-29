# Molotov

**Digital art marketplace where royalties are enforced by the contract — not the platform.**

> On every resale, the artist is paid automatically. Or the sale doesn't happen.

🌐 **Live:** [molotov-web.vercel.app](https://molotov-web.vercel.app) · 🔗 **Testnet contracts:** [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CB6T6DOYV2JCD36ZE43ESXNGCL2GBDARCZNRVYQWOXGTZNJBWB72K7DU)

---

## 💡 The problem

When a digital artwork resells for more, **the artist who made it usually sees nothing.**

Web3 was supposed to fix this with royalties — a cut for the artist on every resale. In practice, that promise collapsed. To compete on lower fees, the major NFT marketplaces made royalties **optional**, dependent on the goodwill of the buyer or the platform. Creators were cut out again, this time with extra jargon on top.

The real problem isn't technical — it's about **who captures the value**. And that gets decided in exactly one place: the contract that moves the money.

---

## ⚡ The solution

Molotov makes the royalty **immutable and mandatory at the contract level**:

- The artist sets their royalty when minting (**1–15%**). Once minted, it **can never be changed**.
- On every resale, the marketplace contract pays the artist **before the sale can close**. No royalty → no sale.
- The contract acts as **escrow**: zero residual, every part sums to the stroop (1/10,000,000 XLM).

We call it _inverted Spotify_: income flows **to** the creator, not away from them.

---

## 🔄 How it works — a real example

**A 100 XLM resale with a 10% royalty:**

| Recipient        | Amount   | Rule                                    |
| ---------------- | -------- | --------------------------------------- |
| **Artist**       | 10 XLM   | enforced by contract — can't be skipped |
| **Platform fee** | 2.5 XLM  | half of what competitors charge         |
| **Seller**       | 87.5 XLM |                                         |

> Every stroop is accounted for. If the royalty can't be distributed, the entire sale reverts.

An optional **referral** share is carved _out of_ the platform fee — never added to the price. Whoever brings a buyer earns part of the fee.

---

## 🔌 Stellar Integrations

This is where Molotov touches Stellar — not superficially, but as **load-bearing infrastructure**:

### ✅ Live integrations

| Integration                           | Role in Molotov                                      | Why it matters                                           |
| ------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| **Soroban** (Stellar smart contracts) | NFT minting, marketplace escrow, royalty enforcement | The royalty guarantee lives here — it's the core product |
| **Stellar Wallets Kit**               | Multi-wallet connection (Freighter, xBull, Albedo)   | Users sign every transaction from their own wallet       |
| **Privy**                             | Embedded wallet via email/Google login               | No-extension onboarding for non-crypto artists           |

### 🗺️ Roadmap integrations (post-hackathon)

| Integration                       | What it unlocks                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------- |
| **alfredpay / BlindPay**          | Artists withdraw royalties directly to their Argentine bank account (ARS or USD) |
| **Anchor Platform**               | USDC-denominated listings — artists price in dollars, Stellar is invisible       |
| **Blend v2**                      | Royalties parked in a yield pool between sales — idle money earns                |
| **CCTP / Allbridge**              | Cross-chain collectors (Ethereum, Base) buy with their native stablecoins        |
| **Stellar Disbursement Platform** | Batch royalty drops to artists at the end of each period                         |

---

## 🏗️ Architecture

Three Soroban contracts, each with one responsibility:

| Contract           | Responsibility                                                   |
| ------------------ | ---------------------------------------------------------------- |
| **MolotovNFT**     | The artwork token. Stores the artist's immutable royalty.        |
| **ArtistRegistry** | Registry of verified artists. Only a registered artist can mint. |
| **Marketplace**    | Escrow, listings, and royalty enforcement on every sale.         |

**Off-chain indexer** — the chain is the source of truth, but we project events into a queryable database (Supabase) for fast reads. The projection is **reconstructable**: wipe it, replay the events, get exactly the same state.

```
Contracts (Stellar) ── emit events
        ↓
Soroban RPC (getEvents)
        ↓
Indexer: fetch → decode → write → advance cursor ↻
        ↓
Supabase (queryable projection)
        ↓
Web app (Next.js)
```

---

## ✅ What's live

> This is not a plan — it's what is **already deployed and verified on Stellar testnet**.

**Contracts:**

- ArtistRegistry — [`CC37LTUP…GU533`](https://stellar.expert/explorer/testnet/contract/CC37LTUPS5WLNBQSVNJJGBMZK4QCUJ76EFGW4RGY7XNVLKFKXCRGU533)
- Marketplace — [`CB6T6DOY…2K7DU`](https://stellar.expert/explorer/testnet/contract/CB6T6DOYV2JCD36ZE43ESXNGCL2GBDARCZNRVYQWOXGTZNJBWB72K7DU)
- MolotovNFT — see [`doc/contracts.md`](doc/contracts.md)

**Engineering proof:**

- **Mutation testing** (cargo-mutants): 0 surviving mutants across `distribute`, `buy`, `list`, `cancel`, `upgrade`
- **Static analysis** (Scout): 0 findings across all three contracts
- **Conservation verified live**: a 100 XLM secondary sale with 10% royalty + 2.5% fee settles to the stroop — zero residual
- **Indexer idempotency**: replaying the same events yields an identical projection, no duplicate sales

---

## 💼 The business

**Why Stellar.** Low fees and fast settlement make micro-royalties economically viable — on high-gas chains, network fees can swallow a small royalty whole.

**How Molotov makes money.** A flat **2.5% platform fee** on every sale — half of what objkt (leading Tezos art marketplace) charges. Revenue scales with volume.

**The moat.** The royalty guarantee lives in the contract: public, immutable, verifiable. Artists don't have to trust the platform. The code is the policy.

**Who it's for.** Contemporary digital artists in Latin America who want their work to earn _over time_ — not only at first sale. Editorial and gallery-first brand, deliberately anti-crypto-bro.

---

## 🛠️ Tech stack

| Layer                    | Stack                                            |
| ------------------------ | ------------------------------------------------ |
| Web app                  | Next.js 16 + React 19 + Tailwind + shadcn/ui     |
| Smart contracts          | Soroban (Rust) + OpenZeppelin Stellar Contracts  |
| Wallet                   | Stellar Wallets Kit · Freighter · xBull · Albedo |
| Auth / embedded wallet   | Privy (email + Google login)                     |
| Indexer + off-chain data | Supabase                                         |
| File storage             | IPFS via Pinata                                  |
| Monorepo                 | pnpm + Turborepo                                 |

---

## 🚀 Getting started

**Requirements:** Node 20, pnpm 10, Rust with `wasm32v1-none` target, Stellar CLI.

```bash
git clone https://github.com/BuenDia-Builders/molotov.git
cd molotov
cp apps/web/.env.example apps/web/.env.local
# fill in your Supabase, Pinata, and Privy keys
pnpm install
pnpm dev
```

| Command      | What it does                   |
| ------------ | ------------------------------ |
| `pnpm dev`   | Run apps in development        |
| `pnpm build` | Build the full workspace       |
| `pnpm lint`  | ESLint across all packages     |
| `pnpm test`  | Run contract + workspace tests |

---

## 🗺️ Roadmap

- **Done** — Soroban contracts deployed and verified. Full indexer. Web app live on Vercel.
- **Next** — Mainnet: multisig admin keys, final audit. USDC-denominated listings via Anchor Platform.
- **Later** — Mobile apps, PT/EN/ES full support, bank withdrawal for Argentine artists.

---

_Molotov — digital art where creating earns you a permanent stake in what you made._

_Built for PULSO Hackathon 2026 — NearX × Stellar Development Foundation_
