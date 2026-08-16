# Status — what is actually live

A single-page snapshot of the deployed system, gathered from the code and the chain —
**not** from `README.md` or `doc/architecture.md`, which describe intent and have drifted.
When this page disagrees with those, this page (and the code it is drawn from) wins.

## 1. Network & deployed contracts

Everything is on **Stellar testnet**. There is no mainnet deployment.

- RPC: `https://soroban-testnet.stellar.org`
- Horizon: `https://horizon-testnet.stellar.org`
- Network passphrase: `Test SDF Network ; September 2015`
- Frontend targets testnet unless `NEXT_PUBLIC_STELLAR_NETWORK=PUBLIC` (see `apps/web/lib/stellar.ts`).

| Contract       | ID                                                         | Source                                                                                  |
| -------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| MolotovNFT     | `CBS6UQE542PLU54SVUIK76EKWUJ3CNPOQ35IB4WXKF3BU6YDIBEC7XWS` | `apps/web/lib/stellar.ts`                                                               |
| Marketplace    | `CB6T6DOYV2JCD36ZE43ESXNGCL2GBDARCZNRVYQWOXGTZNJBWB72K7DU` | `apps/web/lib/stellar.ts`                                                               |
| ArtistRegistry | `CC37LTUPS5WLNBQSVNJJGBMZK4QCUJ76EFGW4RGY7XNVLKFKXCRGU533` | `apps/web/app/api/indexer/config.ts` — **deployed but not wired into the NFT** (see §3) |
| Native XLM SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | only allowlisted settlement currency                                                    |

Each contract is governed by a single Ownable owner set at construction; privileged calls
(`upgrade`, `set_registry`, `set_allowed_currency`) are owner-gated. There is no
multisig/timelock yet.

## 2. What works today

- **Mint** an NFT with a contract-enforced **1–15% royalty**, immutable after mint (no setters; the ERC-2981 stubs panic).
- **List** a token into marketplace escrow and **buy** it, with the creator's royalty paid before a secondary sale can close.
- **Enforce the royalty on every _marketplace_ resale** by a non-creator — the only royalty-skipping path (a primary-sale split) is gated to the token's minter.
- **Settle only in the allowlisted currency** (native XLM SAC); the currency allowlist is checked at both `list` and `buy`.
- **Take a 2.5% platform fee**, with an optional **referral** carved out of that fee (never added on top).
- **Project on-chain events** (mint / transfer / burn / listing / sale / registry) into a read-only Supabase mirror via the indexer, with a `/api/indexer/health` endpoint.
- **Show artist earnings** (royalties, fees, referrals) read from that projection.
- **Connect a wallet** — Freighter, xBull, Albedo, LOBSTR, Hana, plus WalletConnect; Privy email wallet on testnet only.
- **Browse** works, artists, token detail and profiles; **search** artists; carry **curatorial metadata** (tags, category, license, sensitive flags, attributes, editions).

## 3. Deliberately OFF: the ArtistRegistry mint gate

The mint gate is **disabled on-chain — any wallet can mint.**

`MolotovNFT.mint` calls `require_registered_artist`, which reads the NFT's stored
`registry` pointer and **returns early (gate disabled) when it equals the all-zeros
placeholder** `CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4`
(`TEMP_REGISTRY_PLACEHOLDER` in `contracts/nft/src/lib.rs`). Only when the pointer is a
real registry does it call `is_registered` and panic `ArtistNotRegistered`.

Verified live: `NFT.registry()` returns that placeholder. So although a real
ArtistRegistry (`CC37…`) **is** deployed and `/admin` can `register`/`revoke` artists,
none of that controls who can mint — the registry is not wired into the NFT. Registry
membership today only affects whether an artist appears on `/artists` (via the indexer).

Activating the gate is one owner call: `NFT.set_registry(<real registry>)`.

## 4. Known gaps

- **NFT-contract allowlist is implemented but NOT deployed.** Commit `99124b1` added
  `set_allowed_nft` / `DataKey::AllowedNft`, checked in `list` and `buy` — but the live
  marketplace WASM predates it (verified: `set_allowed_nft` is an unrecognized subcommand
  on the deployed contract). On-chain, `list`/`buy` do **not** yet restrict which NFT
  contract is used. Deploying it needs a SEP-49 `upgrade` followed by
  `set_allowed_nft(<MolotovNFT>, true)`.
- **The indexer lags the chain by hours.** It runs on a GitHub Actions cron; scheduled
  events are throttled to ~2–3 h in practice (not the configured `*/5`), so the Supabase
  projection trails on-chain state. `MAX_LEDGER_LAG` (5000 ledgers) is calibrated to that,
  not to a real-time indexer. No sub-daily cron on Vercel Hobby.
- **The projection is read-only and derived.** The chain is the source of truth, but
  outside the RPC retention window the Supabase mirror is the only copy of historical
  events — a stalled or reset cursor beyond the window needs manual recovery.
- **The database security suite has no CI.** `@molotov/indexer-db-tests` (RLS, the
  `SECURITY DEFINER` writers, `apply_*` idempotency) needs a local Supabase/Docker and is
  excluded from CI — it runs only when someone runs it by hand.
- **Testnet only.** No mainnet deployment; `apps/mobile` is an empty placeholder.

---

_Last verified against commit `d872fc8`, 2026-08-16._
