# Marketplace invariants

Referenced from `contracts/marketplace/src/lib.rs`. These are the properties the
marketplace + NFT contracts guarantee, and the tests that lock each one in. They are
the contract-level promises the product depends on — money conservation and,
above all, **royalty enforcement on every resale**.

## The central invariant

> **Every sale in which the seller is not the token's minter distributes the token's
> royalty, without exception.**

A "primary sale" (`primary_split = Some(..)`) is the only path that skips the
royalty, and it is gated to the token's creator. Concretely, in `list`:

- If `primary_split.is_some()`, the contract reads `nft.minter_of(token_id)` and
  panics `SplitNotAllowedForReseller` unless the caller (`seller`) equals the minter.
- A token whose minter is unknown — any legacy token minted before minter tracking
  existed (`minter_of` → `None`) — can **never** use a primary split. It must sell on
  the secondary, royalty-bearing path.

Therefore any seller who is not the creator lands on `DistMode::Secondary`, where the
royalty vector returned by `nft.get_royalty_info` is paid verbatim before the seller
receives their remainder. There is no marketplace path that transfers a token to a
buyer against payment while skipping a non-creator's royalty.

Modeled after objkt.com's "Advanced Sale": the split-and-skip mechanic exists, but
only the creator may invoke it — so skipping the royalty is harmless, because the
royalty recipient is the seller themselves.

**Out of scope (documented limitation):** a plain SEP-50 `transfer` between two
parties, settled off-market, bypasses the marketplace and therefore the royalty. This
is the standard NFT tradeoff; the guarantee is "royalty enforced on every _marketplace_
resale," not on every possible transfer. Closing this would require transfer
restrictions on the NFT and is a separate design decision (mainnet track).

Tests: `b1_reseller_primary_split_rejected_at_list`, `b1_minter_primary_split_still_allowed`,
`b1_reseller_without_split_pays_full_royalty`, `b1_legacy_token_without_minter_rejects_split`,
`b1_secondary_fee_plus_royalty_plus_remainder_eq_price`.

## Money conservation

> The sum of every outgoing transfer in a sale equals the sale price `P`, exactly.

All distribution math lives in the pure `distribute` / `distribute_full` function,
proven by property tests before any escrow/transfer logic. `buy` only orchestrates
escrow and transfers around it — it introduces no money math of its own.

- **Secondary:** `treasury(fee) + Σ(royalty) + seller_remainder == P`.
- **Primary:** `treasury(fee) + Σ(split) == P`, where the split covers `P − fee`.
- Rounding dust from integer division lands deterministically on the **last** recipient
  of a split, so nothing is created or lost.
- All arithmetic is checked (`checked_add/sub/mul/div`) with `overflow-checks = true`
  in the release profile; extreme prices return `MathOverflow`, never wrap.

Tests: `p1_secondary_conserves`, `p2_primary_conserves`, `p6_primary_last_absorbs_dust`,
`p7_pays_exact_royalty_vector`, `p12_extreme_price_errors_cleanly`, plus the concrete
stroop-level cases.

## Platform fee & referral

> The platform's total take is always exactly `fee = P * fee_bps / 10000`. A referral
> is carved **out of** the fee (`referral_bps ≤ fee_bps`), never added on top.

- Treasury receives `fee − referral`; the referrer receives `referral`.
- The seller's cost is invariant to whether a sale was referred.
- Self-referral (referrer == buyer or seller) zeroes the referral; the treasury keeps
  the full fee and the sale still completes.
- The `Sold` event's `fee_paid` / `referral_paid` come straight from `distribute_full`,
  **not** reconstructed by scanning payouts for the referrer's address (which
  double-counts when the referrer is also the treasury or a royalty recipient).

Tests: `p4_fee_referral_split`, `p5_seller_remainder_invariant_to_referral`,
`p15_self_referral_*`, `sold_event_fields`, `sold_event_referral_no_address_collision`.

## Royalty immutability (NFT)

> A token's royalty percentage and recipients are fixed at mint and can never change.

There are no royalty setters; the ERC-2981-style stubs panic
`RoyaltiesImmutableAfterMint`. The royalty bound (1%–15%) is enforced in the contract
at mint, not merely in the UI. The minter recorded at mint is likewise immutable.

> The only path that can alter stored royalty/minter data is a full WASM `upgrade`
> (SEP-49), which is owner-gated. Before mainnet this owner key moves to a
> multisig/timelock (mainnet track).

Tests (NFT): `test_set_default_royalty_is_immutable`, `test_set_token_royalty_is_immutable`,
`test_minter_of_returns_creator`.

## Listing hygiene

- **Minimum price:** `list` rejects `price < 10_000` stroops (`PriceBelowMinimum`), so a
  low fee/royalty can never floor-divide to 0 stroops — the royalty is never silently
  rounded away on a micro-priced sale. (objkt enforces an equivalent floor.)
- **Expiry:** a non-zero `ends_at` must be strictly in the future at `list` time
  (`InvalidEndsAt`); no listing is born already expired. Open editions stop selling
  once `ends_at` passes, and the seller reclaims unsold inventory via `cancel`.
- **Currency allowlist:** the settlement SAC must be owner-allowlisted at both `list`
  and `buy`; the contract never calls an arbitrary token.

Tests: `list_rejects_price_below_minimum`, `list_accepts_minimum_price`,
`list_rejects_non_future_ends_at`, `oe_buy_*_expiry_*`, `list_rejects_disallowed_currency`.

## Custody & atomicity

- **NFT escrow, zero fund custody:** the token moves into the contract on `list` and out
  to the buyer on `buy`; payments go buyer → each recipient directly, so the contract
  holds a zero token balance after every sale.
- **Checks-effects-interactions:** the listing is marked `Sold`/`Cancelled` and persisted
  **before** any token or payment moves, so a repeat or re-entrant `buy` on the same
  listing fails.
- **Access control:** `list`/`cancel` require the seller's auth (and `cancel` matches the
  stored seller); `buy` requires the buyer's auth; `set_allowed_currency` and `upgrade`
  are owner-gated.

Tests: `p3_*_buy_conserves_zero_residual`, `p13_second_buy_fails`, `cancel_only_seller`,
`cancel_only_active`, `set_allowed_currency_requires_owner_auth`, `upgrade_requires_owner_auth`.

## Storage lifetime

Persistent entries (listings, currency allowlist, per-token royalty/URI/minter) and the
contract instance are TTL-bumped on the hot paths (`list`, `buy`, `mint`, reads) so an
actively used marketplace/collection never lets its data or code archive. A burned token
has its royalty, URI, and minter entries removed so it stops paying rent for data no one
can reach.

Tests: `test_*_bumps_*_ttl`, `test_marketplace_survives_30_day_gap`,
`test_burn_removes_token_metadata` (NFT).
