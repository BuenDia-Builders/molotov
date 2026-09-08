# Status — what is actually live

A single-page snapshot of the deployed system, gathered from the code and the chain —
**not** from `README.md` or `doc/architecture.md`, which describe intent and have drifted.
When this page disagrees with those, this page (and the code it is drawn from) wins.

## Which doc owns what

Each doc under `doc/` is the single source for one thing. Don't restate another doc's
facts — link to it instead.

| Doc                                                        | Single source for                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `doc/status.md` (this file)                                | **What is live right now** — network, deployed contract IDs, which features are on/off, known gaps.   |
| `doc/architecture.md`                                      | The **intended design** — the _what_ and _why_, system flows, contract interfaces. Not current state. |
| `doc/marketplace-invariants.md`                            | The royalty & marketplace **invariants** and the tests that lock each one.                            |
| `doc/indexer-spec.md`                                      | The **indexer contract** — events consumed, projection schema, decoding rules.                        |
| `doc/indexer-operations.md`                                | The indexer **operations runbook** — retention window, scheduling, health, cursor recovery.           |
| `doc/analytics.md`                                         | The **analytics** spec (PostHog events and tracking).                                                 |
| `doc/adr/`                                                 | **Architecture decision records** — why a decision was made.                                          |
| `doc/i18n.md`                                              | **i18n conventions** for the ES/EN UI dictionaries.                                                   |
| `doc/wave-moderation.md`                                   | The **contribution / wave moderation** log.                                                           |
| `doc/branding/`                                            | **Brand assets** and design tokens.                                                                   |
| `doc/flows.md`, `doc/contracts.md`, `doc/migration-map.md` | Legacy Spanish references (product flows, contracts, migration map); kept as-is, may have drifted.    |

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
- **Settle only through the allowlisted NFT contract** (MolotovNFT); same shape as the currency allowlist, checked at both `list` and `buy`, proven in the sandboxed contract test suite. A live `buy` simulation against real testnet listings confirmed this once (2026-09-07); a later attempt to reproduce it cleanly did not succeed — see §5.
- **Take a 2.5% platform fee**, with an optional **referral** carved out of that fee (never added on top).
- **Project on-chain events** (mint / transfer / burn / listing / sale / registry) into a read-only Supabase mirror via the indexer, with a `/api/indexer/health` endpoint.
- **Show artist earnings** (royalties, fees, referrals) read from that projection.
- **Connect a wallet** — Freighter, xBull, Albedo, LOBSTR, Hana, plus WalletConnect; Privy email wallet on testnet only.
- **Browse** works, artists, token detail and profiles; **search** artists; carry **curatorial metadata** (tags, category, license, sensitive flags, attributes, editions).
- **Show a pre-signature network-fee estimate** on both mint and buy, read from the simulated transaction; **reconcile a buy against `getTransaction`** on failure or reload instead of assuming it didn't charge; **guide an artist with no prior Stellar knowledge** through mint (why a wallet, identity vs. wallet, a plain-language pre-submit summary, decoded contract errors).

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

- **The indexer lags the chain by hours.** It runs on a GitHub Actions cron; scheduled
  events are throttled to ~2–3 h in practice (not the configured `*/5`), so the Supabase
  projection trails on-chain state. `MAX_LEDGER_LAG` (5000 ledgers) is calibrated to that,
  not to a real-time indexer. No sub-daily cron on Vercel Hobby.
- **The projection is read-only and derived; backups run daily.** The chain is the
  source of truth, but outside the RPC retention window the Supabase mirror is the only
  copy of historical events. `.github/workflows/projection-backup.yml` snapshots the
  projection tables once a day (`doc/indexer-operations.md` § Backups, including the
  restore procedure). A stalled or reset cursor within the retention window still needs
  manual recovery (same doc).
- **The database security suite has no CI.** `@molotov/indexer-db-tests` (RLS, the
  `SECURITY DEFINER` writers, `apply_*` idempotency) needs a local Supabase/Docker and is
  excluded from CI — it runs only when someone runs it by hand. Details in §5.
- **Testnet only.** No mainnet deployment; `apps/mobile` is an empty placeholder.

## 5. Verification gaps — automated-tested vs. confirmed live

From a ground-truth audit (2026-09-08) that converted every "this works" claim into a
claim with cited evidence, then went hunting for the ones that only had code, not proof.
Four gaps came out the other side genuinely open — automated coverage exists and passes,
but a live, real-infrastructure confirmation does not (yet), and the two should not be
read as the same thing:

- **NFT-contract allowlist, live.** The gating logic itself is proven in the sandboxed
  contract test suite (`list_rejects_non_allowlisted_nft`, `set_allowed_nft_requires_owner_auth`).
  A live `buy` simulation against real testnet listings confirmed it once, cleanly
  (2026-09-07: listings 5 and 6, full `Sold` events with correct royalty/fee). A second
  attempt the next day did not reproduce cleanly — a quick scan of listing ids briefly
  showed two as sellable, but re-checking each individually 10 seconds later found them
  already consumed. That's the shared testnet having real concurrent activity, not a sign
  the allowlist regressed — but a flaky read is not evidence, so this stays open rather
  than getting marked confirmed on the strength of one ambiguous pass.
- **RLS + indexer idempotency.** All 25 tests in `@molotov/indexer-db-tests` exist and are
  well-formed, but need a full local Supabase stack (`supabase start`), which needs a
  container runtime. Confirmed directly: neither `docker` nor `podman` is on `PATH` in a
  normal dev checkout, and `supabase start` fails immediately with
  `LegacyDockerLifecycleInspectError`. A local Postgres binary alone isn't sufficient
  either — `@supabase/supabase-js` (what the tests use) talks to PostgREST, the HTTP layer
  Supabase's container stack provides, not raw SQL, and no local PostgREST is installed.
  Closing this needs Docker Desktop or Podman installed on the machine that runs it — not
  a code change.
- **Buy fee estimate, end to end.** `hooks/use-buy.test.ts` exercises the real hook —
  `estimateFee`'s call shape, the fee read off `tx.built.fee`, silent failure on a bad
  simulation — against a mocked contract client. It has never been confirmed against a
  real wallet signing a real simulated transaction (the mint side of this was, once, with
  Freighter connected on testnet). Automated and passing; not yet seen live.
- **Artist earnings dashboard, end to end.** `earnings-client.test.tsx` and
  `app/api/earnings/mine/route.test.ts` together prove the chain from a rendered number
  back to `getArtistEarnings` in `lib/db/sales.ts`, against realistic fixtures shaped
  exactly like that function's real return type. Nobody has actually loaded `/earnings`
  as a real artist with real sales and watched the populated screen render — only the
  logged-out state has been seen live.

None of these four block anything today; they're the honest boundary of what this repo
can currently prove about itself, not a list of known-broken behavior.

---

_Last verified against commit `b7c1824`, 2026-09-08._
