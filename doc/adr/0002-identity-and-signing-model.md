# ADR 0002 — Identity and signing model

**Status:** Proposed
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

## Open questions

- **Off-ramp reality for C-addresses:** can the exchanges and anchors the target artists
  (Latin America) actually use send to / receive from a Soroban contract account? This gates
  option B and the C-address side of C.
- **C-address recovery:** if a device or passkey is lost, does the chosen smart wallet support
  adding or rotating signers, and who runs the resolver that maps a passkey to its C-address?
- **Relayer ownership:** who operates and funds the relayer, and what is the fallback if it is
  down — can a C-address user still sign and submit without it?
- **Any acceptable email path:** the Privy path stores a secret in `localStorage`
  (`apps/web/lib/privy-stellar.ts:11-14`) and must be off for mainnet regardless. Is there an
  email-onboarding path that yields a _recoverable_ G-address, or does email onboarding
  necessarily require smart accounts?
- **Heterogeneity vs. commitment:** given immutability, do we accept permanent mixed
  provenance (C), or commit to one address type before the first mainnet mint (A or B)?

## Decision

**TBD — see open questions.** This ADR is proposed, not decided: it lays out the evidence and
the trade-offs so a human can choose before the first mainnet mint locks the choice into
every token.
