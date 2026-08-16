# ADR 0002 — Identity and signing model

**Status:** Accepted
**Date:** 2026-08-16

## Context

Molotov has no server-side accounts: identity _is_ the Stellar address, and every write
is a client-signed transaction. Two signing paths ship today, multiplexed behind one
interface in `WalletProvider`:

- **Stellar Wallets Kit (SWK)** — the default (`walletModeRef` starts `"swk"`,
  `apps/web/providers/wallet-provider.tsx:90`); `signTransaction` calls
  `kit.signTransaction` (`apps/web/providers/wallet-provider.tsx:222-226`). Produces a
  **G-address** held in the user's own wallet extension.
- **Privy (email / Google)** — `connectViaPrivy` flips the mode to `"privy"` and stores a
  signer (`apps/web/providers/wallet-provider.tsx:196-201`); `signTransaction` then calls
  that signer (`apps/web/providers/wallet-provider.tsx:216-221`). Because Privy v2 does
  not expose a Stellar embedded wallet, the app **generates a random keypair**
  (`Keypair.random()`, `apps/web/lib/privy-stellar.ts:28`) and **stores the secret in
  `localStorage`** keyed by the Privy user id (`apps/web/lib/privy-stellar.ts:18,30`). The
  code says so itself: "Testnet / demo only — never store secrets in localStorage in a
  production mainnet context" (`apps/web/lib/privy-stellar.ts:11-14`). This is also a
  **G-address**.

Every _write_ funnels through the single `signTransaction` from `useWallet()`:
`apps/web/hooks/use-mint.ts:218` (mint), `apps/web/hooks/use-buy.ts:42` (buy),
`apps/web/hooks/use-list.ts:50` and `:77` (list), `apps/web/hooks/use-cancel.ts:31`
(cancel). Read-only clients skip the signer and simulate with a published funded account
(`apps/web/app/my-work/[tokenId]/layout.tsx:18,22` and
`apps/web/app/my-work/[tokenId]/page.tsx:77,81`, both `publicKey: READ_SOURCE`). So a
"one signer interface" already exists; what differs between the options below is _which
kind of address_ it produces.

**The contracts do not constrain the signature scheme.** Every user-facing authorization
is a plain `Address::require_auth()`: `contracts/nft/src/lib.rs:139` (artist, on mint),
`contracts/marketplace/src/lib.rs:457` (seller, on list), `:627` (seller, on cancel), and
`:689` (buyer, on buy). Soroban's `require_auth` is satisfied by whatever the address's
own auth logic accepts — a classic ed25519 signature for a **G-address**, or a contract's
`__check_auth` for a Soroban **contract account (C-address)**. A passkey smart wallet (a
C-address) therefore satisfies these calls with **no contract change**. This is entirely a
frontend / product / operations decision, not a contract limitation.

**Why this decision is costly to reverse.** Royalty recipients are written at mint and are
**immutable**: there are no setters — `set_default_royalty` and `set_token_royalty` panic
`RoyaltiesImmutableAfterMint` (`contracts/nft/src/lib.rs:300-301,304-310`), and the royalty
config is fixed from mint onward (`contracts/nft/src/lib.rs:170,291`). The recipient
_addresses_ are part of that config. So whatever address type an artist uses as a royalty
recipient at the **first mainnet mint is locked to that token forever** — if that address
later becomes unusable, the royalties for that token are unrecoverable. The identity model
is not a UI preference; it is baked into every token minted under it.

## Evidence: how live Stellar products handle this

Rather than reason from first principles, we looked at how products already moving real
money on Stellar handle the same constraint. Three independent sources point the same way.

### 1. Payout architecture in production

GrantFox, an SCF-funded platform that pays contributors on Stellar, separates the account
from the payout address entirely:

- The account is social login only — GitHub or Google — with no wallet at signup
  ([contributor login guide](https://docs.grantfox.xyz/user-manual-guides/ux-bounties-guide/contributor-guide/logging-in)).
- The payout wallet is a separate profile field, supplied by the user after signup, and
  changeable ([wallets and payments](https://docs.grantfox.xyz/key-concepts/wallets-and-payments)).
- Payouts go only to non-custodial Stellar wallets that do not require a memo (they
  recommend LOBSTR, Decaf and Freighter). Memo-required destinations — exchange deposit
  addresses, custodial wallets, Binance deposit wallets, Meru — are explicitly unsupported,
  on the stated grounds that such payments may fail, be delayed, or be lost unrecoverably.

Plainly: a production system paying users at scale does not try to solve the memo problem.
It routes around it — paying to addresses the user controls, and leaving the exchange hop
to the user.

### 2. Protocol position on contract accounts and memos

Two Stellar documentation pages currently disagree. Both are recorded rather than picking
the convenient one:

- [Send and receive with contract accounts](https://developers.stellar.org/docs/build/guides/transactions/send-and-receive-c-accounts)
  (updated 2026-08-13) describes the solution: a contract account paying a memo-requiring
  recipient encodes the memo id in a muxed address, and the receiving side reads
  `to_muxed_id` instead of the memo field — made ingestible by Unified Asset Events
  (CAP-67, Protocol 23).
- [Smart wallets](https://developers.stellar.org/docs/build/apps/smart-wallets) still states
  that transfers from contract accounts are not supported by exchanges.

Conclusion: the protocol supports it, but whether any given exchange has implemented
muxed-ID ingestion cannot be verified from outside. Because royalty recipients are
immutable, that is not a dependency we can accept for a permanent destination.

### 3. Argentine off-ramp reality

This corrects an assumption in `doc/flows.md` section F1, which names alfredpay and BlindPay
— B2B infrastructure, not apps our artists hold.

The destinations Argentine artists actually use are heterogeneous, and none of them is a
valid permanent royalty recipient:

- Lemon supports USDC over Stellar but **requires a memo**
  ([cómo ingreso crypto en Lemon](https://help.lemon.me/es/articles/5473779-como-ingreso-crypto-en-lemon)).
- Belo does not support the Stellar network at all. Its supported-networks page (updated
  2026-01-19) lists Bitcoin, Lightning, Ethereum, TRON, BNB Chain, Polygon, Optimism,
  Arbitrum, Solana, Plasma and Base — no Stellar
  ([which networks are supported by Belo](https://help.belo.app/en/articles/5964418-which-networks-are-supported-by-belo)).
- The memo requirement is universal for custodial destinations, not a Lemon quirk: Binance,
  Kraken, Bitfinex and WazirX all require a memo for XLM deposits. Crypto.com states the rule
  directly — a memo is required when sending to a centralized wallet, and not required when
  the recipient controls their own recovery phrase
  ([how to send and receive XRP and XLM](https://help.crypto.com/en/articles/3957426-how-to-send-and-receive-xrp-and-xlm)).

Structural conclusion: custodial destinations require a memo; non-custodial wallets do not.
The set of exchanges supporting Stellar today is not the set that will support it in five
years, and an artist may switch apps at any time. Royalty recipients are immutable, so they
cannot be bound to a moving landscape. The artist's own non-custodial wallet is the only
stable point; which exchange they move funds to afterwards is their decision and can change
freely.

## Options

Each option is stated with what it costs and what it gives up, and answers the four
questions that matter per option: what happens when an artist **clears browser storage**,
what happens on a **second device**, whether **exchanges / off-ramps** can receive from the
address type, and the **migration cost** if we ship it and later change our mind.

### A. G-address only — drop the Privy path, ship Stellar Wallets Kit alone

Ship only Stellar Wallets Kit; remove the Privy email path.

- **Costs / gives up:** the email/social onboarding path. A newcomer with no wallet must
  install one (Freighter, xBull, etc.) before they can mint or buy — friction that cuts
  against the "saw it on social → tap → collect" flow.
- **Clears browser storage:** safe. The key lives in the wallet extension, not in Molotov;
  site storage holds only the reconnect hint `SELECTED_WALLET_KEY`
  (`apps/web/providers/wallet-provider.tsx:22,106`). Clearing it costs a reconnect, not the
  key.
- **Second device:** the user installs their wallet there and restores their seed → the
  same G-address on every device. Portable by design.
- **Exchanges / off-ramps:** G-addresses are classic Stellar accounts — universally
  supported by exchanges, anchors, and SEP-24/SEP-6 off-ramps.
- **Migration cost later:** low. Adding smart accounts afterwards is additive (a new signer
  path). G-addresses are portable, so nothing minted under this option gets stranded.

### B. Passkey smart accounts (C-address) via passkey-kit + a relayer

Newcomers get a Soroban smart wallet keyed by a device passkey; a relayer sponsors fees and
submission. The contracts already accept C-addresses (see Context), so no contract change is
required.

- **Costs / gives up:** a relayer to operate and fund, plus the passkey-kit / smart-wallet
  stack to build and maintain — a hard dependency on infrastructure that does not exist in
  the repo yet.
- **Clears browser storage:** the passkey lives in the platform authenticator (OS keychain /
  secure enclave), not in `localStorage`, so the _signer_ survives clearing site storage —
  strictly better than today's Privy secret. The open risk is **address discovery**:
  resolving a passkey to its C-address needs a lookup service; if the only record of the
  address is client-side, clearing storage can lose the pointer even though the key is
  intact.
- **Second device:** works only if passkeys sync (iCloud Keychain / Google Password Manager)
  _or_ the smart wallet supports adding a second passkey as an extra signer. A real design
  decision, not free.
- **Exchanges / off-ramps:** the weak point. C-addresses are contract accounts; many
  exchanges and anchor flows assume a classic G-address (and a memo) for deposit/withdraw. An
  artist paid royalties at a C-address may be unable to withdraw to a given exchange. Must be
  verified against the ramps the target artists actually use.
- **Migration cost later:** highest and permanent. Tokens minted with a C-address recipient
  keep paying that C-address forever (immutability). If the smart-wallet infra or the relayer
  is later abandoned, those royalties can become unrecoverable — the worst case the
  immutability constraint creates.

### C. Hybrid — both, behind one signer interface

Keep both address types behind the existing single `signTransaction` interface
(`apps/web/providers/wallet-provider.tsx:216-229`), which already multiplexes SWK and Privy.

- **Costs / gives up:** two identity types in circulation, permanently. Because recipients
  are immutable, some tokens will always have G-address recipients and others C-address
  recipients — heterogeneous provenance that can never be normalized after the fact.
- **Clears browser storage / second device / off-ramps:** inherits A's answers for G-address
  users and B's for C-address users. The trap: if the hybrid lets the **current
  Privy-localStorage path mint on mainnet**, an artist can mint with a G-address whose secret
  is only in `localStorage` (`apps/web/lib/privy-stellar.ts:18,30`); clearing storage then
  loses the key and strands that token's royalties forever. A hybrid must bar the
  localStorage-secret path from any mainnet mint.
- **Migration cost later:** you cannot cleanly retire either path without stranding the
  tokens minted under it. Highest optionality up front; highest permanent complexity.

### D. Social account, artist-supplied G-address for royalties

Identity in the app is a social login; the royalty destination is a G-address the artist
owns, kept separate from the account.

- **Account and login:** social (Google), already wired through Privy
  (`apps/web/providers/wallet-provider.tsx:196-201`). It creates no key and holds no funds —
  it is identity inside the app, nothing more.
- **Royalty recipient:** a Stellar G-address the artist supplies in their profile, validated
  as not being a memo-required address, and required before the artist can mint.
- **Wallet-less artists** are pointed at Decaf ([decaf.so](https://www.decaf.so/)) or LOBSTR
  ([lobstr.co](https://lobstr.co/)). What both genuinely share — and the only thing Option D
  requires — is that each gives the artist a **memo-free G-address they control**. Their fiat
  paths differ, and only sourced claims are made for each:
  - **Decaf** — non-custodial, with email / Google / Apple social-login onboarding and no
    seed phrase
    ([create an account](https://intercom.help/decaf/en/articles/10984824-create-an-account-with-decaf));
    it withdraws to local bank transfer or cash in 184 currencies, ARS among them
    ([Google Play listing](https://play.google.com/store/apps/details?id=so.decaf.wallet)),
    over the MoneyGram / Stellar ramp ([Stellar case study](https://stellar.org/case-studies/decaf)).
  - **LOBSTR** — non-custodial, gives a memo-free G-address; its fiat conversion is handled
    off-chain through the token's issuer/anchor (the Stellar SEP-24 interactive-anchor
    mechanism), **not** a direct Argentine bank withdrawal, and it is not a social-login
    wallet
    ([depositing crypto and fiat on LOBSTR](https://lobstr.freshdesk.com/support/solutions/articles/151000001280-basics-depositing-crypto-and-fiat-on-lobstr)).
- **Signing:** unchanged for now (Stellar Wallets Kit,
  `apps/web/providers/wallet-provider.tsx:222-226`). Passkey smart accounts remain a possible
  future improvement to the signing experience only — never to the receiving address.

The same four questions:

- **Clears browser storage:** safe. The app holds no key — the social login is identity only,
  and the royalty G-address lives in the artist's own wallet and their profile row, not in
  browser storage.
- **Second device:** the social login resumes on any device; the royalty address is a profile
  field, not device state. The artist's wallet is restored from its own seed, independently.
- **Exchanges / off-ramps:** the artist supplies a memo-free non-custodial G-address, which is
  universally receivable; moving funds onward to an exchange (memo and all) is the artist's own
  step, unconstrained by anything immutable.
- **Migration cost later:** low. The receiving address is a portable standalone keypair; the
  social login and signing layer can change without touching any minted token.

Costs, stated honestly rather than sold:

- It adds a **required step before an artist can mint** — friction at exactly the moment we
  would rather have none.
- It gives up "saw it on social, tapped, collected" onboarding **for artists**. Buyers are
  unaffected: a buyer receives nothing immutable, so a frictionless buyer path stays open.
- It depends on **third-party wallets (Decaf, LOBSTR)** for the wallet-less artist's first
  step, which we do not control.

## Decision

**Option D.** In three points:

1. Royalty recipients are immutable, so the receiving address must be maximally portable and
   must not depend on infrastructure Molotov operates or on an integration a third party may
   or may not have built.
2. A G-address is a keypair that works standalone, indefinitely, with no maintained
   infrastructure behind it. A contract account is a contract that depends on a relayer and on
   exchange-side support (see Evidence §2). For something that can never be changed, that
   difference outweighs the onboarding convenience.
3. This **supersedes rather than replaces** the current Privy path: the random keypair
   persisted to `localStorage` (`apps/web/lib/privy-stellar.ts:28,30`) is to be removed, not
   migrated.

What would reopen this: if memo-free receipt from contract accounts becomes verifiable across
the ramps our artists use, option B becomes viable again for signing **and** receiving, and
this ADR should be revisited.

## Consequences

Follow-up work this decision implies. None of it is implemented in this ADR.

- [ ] Remove the localStorage keypair path from the Privy flow
      (`apps/web/lib/privy-stellar.ts:15-32`).
- [ ] Add a wallet-address field to the artist profile, with validation rejecting
      memo-required addresses, required before mint.
- [ ] Add onboarding copy for artists without a wallet, pointing at Decaf and LOBSTR.
- [ ] Update `doc/flows.md` section 1 (artist onboarding) and section F1 (fiat), which
      currently describe the Privy path and name alfredpay / BlindPay.
- [ ] Update `doc/status.md` to reflect the decided identity model.
- [ ] Note for a future ADR: passkey smart accounts as a signing-only improvement.
