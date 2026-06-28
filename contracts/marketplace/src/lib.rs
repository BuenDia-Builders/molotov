//! Marketplace — listings, sales, and atomic money distribution for Molotov.
//!
//! Escrow model: the NFT moves into this contract on `list` and out to the buyer
//! on `buy`. The contract **never custodies funds** — it orchestrates
//! buyer→recipient transfers and holds a zero balance after every sale. Settles
//! in a SAC token from an admin allowlist.
//!
//! Money model (objkt, locked in `marketplace-invariants.md`): `fee`, `referral`
//! and `royalty` are all computed on the **gross** sale price `P`. The referral is
//! carved **out of** the fee, never added on top — the seller always pays a flat
//! `fee`; on a referred sale the treasury keeps `fee − referral` and the referrer
//! gets `referral` (constraint: `referral_bps ≤ fee_bps`). The sum of every
//! outgoing transfer equals `P` exactly.
//!
//! Access mirrors the NFT / ArtistRegistry: a single owner set at construction
//! (`stellar-access` Ownable), privileged calls gated by `enforce_owner_auth`.
//!
//! Build order (see the spec): the distribution math lives in the pure
//! [`distribute`] function, proven by property tests before any escrow/transfer
//! logic is wired into `buy`.

#![no_std]
// `list` takes the full listing shape (10 params, fixed by the spec / architecture
// §5.3); the contract macro replicates that signature in the generated client.
#![allow(clippy::too_many_arguments)]

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, token, Address, BytesN, Env, Vec,
};
use stellar_access::ownable::{enforce_owner_auth, set_owner, Ownable};

const BPS_DENOMINATOR: i128 = 10_000; // 100%
// Mirrors the NFT: an unbounded loop over a user-supplied split is a DoS vector.
const MAX_RECIPIENTS: u32 = 10;

// TTL maintenance for persistent listing / allowlist entries — same Phase 0.5
// discipline as the NFT and ArtistRegistry. ~1 day threshold, ~30 day bump.
const TTL_BUMP_THRESHOLD: u32 = 17_280; // ~1 day in ledgers
const TTL_BUMP_AMOUNT: u32 = 518_400; // ~30 days in ledgers

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MarketError {
    InvalidPrice = 1,
    /// The referral cannot exceed the fee — it is carved out of it, not added on.
    ReferralExceedsFee = 2,
    NoSplitRecipients = 3,
    TooManySplitRecipients = 4,
    ShareNotPositive = 5,
    SplitSharesMustSumTo10000 = 6,
    /// `P − fee − royalty < 0`: the fee + royalty would exceed the price.
    RemainderNegative = 7,
    NegativePayout = 8,
    MathOverflow = 9,
    ListingNotFound = 10,
    ListingNotActive = 11,
    CurrencyNotAllowed = 12,
    /// Reserved sale kind (`Auction`), enabled later via upgrade.
    NotImplemented = 13,
    /// `cancel` caller is not the listing's seller.
    NotSeller = 14,
    /// FixedPrice needs exactly 1 edition; OpenEdition needs at least 1.
    InvalidEditions = 15,
    /// `fee_bps + royalty_bps > 10000`: a sale could not leave a non-negative
    /// seller remainder (P9 guard, enforced at `list`).
    FeePlusRoyaltyTooHigh = 16,
    /// Open-edition listing past its `ends_at` window — no more buys; the seller
    /// reclaims the unsold inventory with `cancel`.
    ListingExpired = 17,
}

/// One wallet of a primary-sale split: a share of the post-fee proceeds in bps.
/// Mirrors the NFT's royalty-recipient shape (shares must sum to 10000, cap 10).
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RoyaltyRecipient {
    pub address: Address,
    pub share_bps: u32,
}

/// Sale type. `Auction` is reserved (its `buy` path panics `NotImplemented`,
/// enabled later via upgrade); `OpenEdition` sell-through is wired in a later step.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ListingKind {
    FixedPrice,
    OpenEdition,
    Auction,
}

#[contracttype]
#[derive(Clone)]
pub enum ListingStatus {
    Active,
    Sold,
    Cancelled,
}

/// A listing in escrow. `primary_split = Some(..)` is a primary sale (proceeds
/// split across the artist's wallets); `None` is a resale (royalty via the NFT,
/// remainder to the seller). Fields cover open-edition/auction so the shape is
/// stable for the indexer; only the FixedPrice path is wired in this step.
#[contracttype]
#[derive(Clone)]
pub struct Listing {
    pub seller: Address,
    pub nft: Address,
    pub token_id: u32,
    pub price: i128,
    pub currency: Address,
    pub kind: ListingKind,
    pub primary_split: Option<Vec<RoyaltyRecipient>>,
    pub referral_bps: u32,
    pub editions_total: u32,
    pub editions_sold: u32,
    pub ends_at: u64,
    pub status: ListingStatus,
}

/// Emitted on a completed sale. Carries everything the indexer needs to
/// reconstruct the distribution: `fee_paid` is the total platform fee, of which
/// `referral_paid` went to the referrer (so treasury = `fee_paid − referral_paid`);
/// `royalty_paid` is the resale royalty total (0 on a primary sale).
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Sold {
    #[topic]
    pub listing_id: u64,
    #[topic]
    pub token_id: u32,
    pub buyer: Address,
    pub seller: Address,
    pub price: i128,
    pub currency: Address,
    pub royalty_paid: i128,
    pub referral_paid: i128,
    pub fee_paid: i128,
}

/// Cross-contract view of the NFT this marketplace settles: the SEP-50 `transfer`
/// (used to move tokens in/out of escrow) and `get_royalty_info` (resale royalty).
#[contractclient(name = "NftClient")]
pub trait NftInterface {
    fn transfer(e: Env, from: Address, to: Address, token_id: u32);
    fn get_royalty_info(e: Env, token_id: u32, sale_price: i128) -> Vec<(Address, i128)>;
    fn royalty_bps(e: Env, token_id: u32) -> u32;
}

/// Emitted when a listing is created. Carries the full listing so the indexer can
/// project browse/listing state without a follow-up read.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ListingCreated {
    #[topic]
    pub listing_id: u64,
    #[topic]
    pub seller: Address,
    pub nft: Address,
    pub token_id: u32,
    pub price: i128,
    pub currency: Address,
    pub kind: ListingKind,
    pub editions_total: u32,
    pub ends_at: u64,
    pub referral_bps: u32,
    pub primary_split: Option<Vec<RoyaltyRecipient>>,
}

/// Emitted when a listing is cancelled by its seller.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ListingCancelled {
    #[topic]
    pub listing_id: u64,
    #[topic]
    pub seller: Address,
}

#[contracttype]
pub enum DataKey {
    FeeBps,
    Treasury,
    /// Allowlist of payment SACs. Absent/false = not allowed.
    AllowedCurrency(Address),
    Listing(u64),
    NextListingId,
}

/// Which distribution applies, fixed at `list` time. Not stored as-is; `buy`
/// builds it from the listing (`Primary` from the stored split, `Secondary` from
/// `nft.get_royalty_info` + the seller).
pub enum DistMode {
    /// First sale: proceeds after fee are split across the artist's wallets.
    Primary(Vec<RoyaltyRecipient>),
    /// Resale: the royalty vector the NFT computed, then the remainder to a single
    /// seller wallet (v1).
    Secondary(Address, Vec<(Address, i128)>),
}

/// `a * b / denom` with checked mul/div; never wraps.
fn mul_div(a: i128, b: i128, denom: i128) -> Result<i128, MarketError> {
    a.checked_mul(b)
        .ok_or(MarketError::MathOverflow)?
        .checked_div(denom)
        .ok_or(MarketError::MathOverflow)
}

/// Pure distribution: turns a sale into the exact list of `(recipient, amount)`
/// transfers, with no escrow, storage, or auth. `buy` wires the transfers around
/// it. The sum of the returned amounts equals `price` exactly (conservation).
///
/// Platform side (both modes): `treasury ← fee − referral`, and `referrer ←
/// referral` when a referrer is present and the referral is non-zero. `referral`
/// is carved out of `fee` (`referral_bps ≤ fee_bps`), so the platform's total
/// take is always exactly `fee`.
///
/// - `Primary(split)`: `distributable = price − fee` split by `share_bps`
///   (Σ = 10000, 1..=10 wallets); the **last** wallet absorbs the rounding dust.
/// - `Secondary(seller, royalties)`: pays the royalty vector verbatim, then
///   `remainder = price − fee − Σroyalties` to the seller.
pub fn distribute(
    e: &Env,
    price: i128,
    fee_bps: u32,
    referral_bps: u32,
    treasury: &Address,
    referrer: &Option<Address>,
    mode: &DistMode,
) -> Result<Vec<(Address, i128)>, MarketError> {
    if price <= 0 {
        return Err(MarketError::InvalidPrice);
    }
    // The referral is carved OUT of the fee — it can never exceed it.
    if referral_bps > fee_bps {
        return Err(MarketError::ReferralExceedsFee);
    }

    let fee = mul_div(price, fee_bps as i128, BPS_DENOMINATOR)?;
    let referral = match referrer {
        Some(_) => mul_div(price, referral_bps as i128, BPS_DENOMINATOR)?,
        None => 0,
    };
    let treasury_amount = fee.checked_sub(referral).ok_or(MarketError::MathOverflow)?;

    let mut out: Vec<(Address, i128)> = Vec::new(e);
    out.push_back((treasury.clone(), treasury_amount));
    if let Some(r) = referrer {
        if referral > 0 {
            out.push_back((r.clone(), referral));
        }
    }

    match mode {
        DistMode::Primary(split) => {
            let distributable = price.checked_sub(fee).ok_or(MarketError::MathOverflow)?;
            let n = split.len();
            if n == 0 {
                return Err(MarketError::NoSplitRecipients);
            }
            if n > MAX_RECIPIENTS {
                return Err(MarketError::TooManySplitRecipients);
            }
            let mut sum_bps: u32 = 0;
            for r in split.iter() {
                if r.share_bps == 0 {
                    return Err(MarketError::ShareNotPositive);
                }
                sum_bps = sum_bps
                    .checked_add(r.share_bps)
                    .ok_or(MarketError::MathOverflow)?;
            }
            if sum_bps != BPS_DENOMINATOR as u32 {
                return Err(MarketError::SplitSharesMustSumTo10000);
            }
            let mut distributed: i128 = 0;
            for i in 0..n {
                let r = split.get(i).unwrap();
                let amount = if i == n - 1 {
                    // Last wallet absorbs the dust so the split closes against `distributable`.
                    distributable
                        .checked_sub(distributed)
                        .ok_or(MarketError::MathOverflow)?
                } else {
                    let a = mul_div(distributable, r.share_bps as i128, BPS_DENOMINATOR)?;
                    distributed = distributed.checked_add(a).ok_or(MarketError::MathOverflow)?;
                    a
                };
                out.push_back((r.address.clone(), amount));
            }
        }
        DistMode::Secondary(seller, royalties) => {
            if royalties.len() > MAX_RECIPIENTS {
                return Err(MarketError::TooManySplitRecipients);
            }
            let mut royalty_total: i128 = 0;
            for entry in royalties.iter() {
                let (addr, amount) = entry;
                if amount < 0 {
                    return Err(MarketError::NegativePayout);
                }
                royalty_total = royalty_total
                    .checked_add(amount)
                    .ok_or(MarketError::MathOverflow)?;
                out.push_back((addr, amount));
            }
            let remainder = price
                .checked_sub(fee)
                .ok_or(MarketError::MathOverflow)?
                .checked_sub(royalty_total)
                .ok_or(MarketError::MathOverflow)?;
            if remainder < 0 {
                return Err(MarketError::RemainderNegative);
            }
            out.push_back((seller.clone(), remainder));
        }
    }

    Ok(out)
}

#[contract]
pub struct MolotovMarketplace;

#[contractimpl]
impl MolotovMarketplace {
    /// Initializes the marketplace with `admin` as owner, the platform `fee_bps`,
    /// and the `treasury` that collects `fee − referral` on every sale.
    pub fn __constructor(e: &Env, admin: Address, fee_bps: u32, treasury: Address) {
        set_owner(e, &admin);
        e.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        e.storage().instance().set(&DataKey::Treasury, &treasury);
    }

    /// Current platform fee in basis points.
    pub fn fee_bps(e: &Env) -> u32 {
        e.storage().instance().get(&DataKey::FeeBps).unwrap()
    }

    /// Current treasury address.
    pub fn treasury(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Treasury).unwrap()
    }

    /// Allowlist (or de-list) a payment SAC. Owner-gated. `buy` refuses to settle
    /// in a currency that is not allowlisted — the contract never calls an
    /// arbitrary token.
    pub fn set_allowed_currency(e: &Env, currency: Address, allowed: bool) {
        enforce_owner_auth(e);
        e.storage()
            .persistent()
            .set(&DataKey::AllowedCurrency(currency.clone()), &allowed);
        e.storage().persistent().extend_ttl(
            &DataKey::AllowedCurrency(currency),
            TTL_BUMP_THRESHOLD,
            TTL_BUMP_AMOUNT,
        );
    }

    /// Create a listing and escrow the token(s) into the contract. Returns the new
    /// listing id.
    ///
    /// `primary_split = Some(..)` is a primary sale (post-fee proceeds split across
    /// the artist's wallets); `None` is a resale (royalty via the NFT, remainder to
    /// the seller). For `OpenEdition`, the artist pre-mints `editions` contiguous
    /// tokens starting at `token_id`; all are escrowed and sold from inventory.
    ///
    /// Guards (P9, enforced here, re-checked in `buy`): `referral_bps ≤ fee_bps`
    /// and `fee_bps + royalty_bps ≤ 10000`; the currency must be allowlisted; the
    /// primary split is validated up-front via a dry run of [`distribute`].
    pub fn list(
        e: &Env,
        seller: Address,
        nft: Address,
        token_id: u32,
        price: i128,
        currency: Address,
        kind: ListingKind,
        editions: u32,
        ends_at: u64,
        primary_split: Option<Vec<RoyaltyRecipient>>,
        referral_bps: u32,
    ) -> u64 {
        seller.require_auth();

        if price <= 0 {
            panic_with_error!(e, MarketError::InvalidPrice);
        }
        match kind {
            // Reserved; listing an auction is enabled later together with its buy path.
            ListingKind::Auction => panic_with_error!(e, MarketError::NotImplemented),
            ListingKind::FixedPrice => {
                if editions != 1 {
                    panic_with_error!(e, MarketError::InvalidEditions);
                }
            }
            ListingKind::OpenEdition => {
                if editions == 0 {
                    panic_with_error!(e, MarketError::InvalidEditions);
                }
            }
        }

        let allowed: bool = e
            .storage()
            .persistent()
            .get(&DataKey::AllowedCurrency(currency.clone()))
            .unwrap_or(false);
        if !allowed {
            panic_with_error!(e, MarketError::CurrencyNotAllowed);
        }
        e.storage().persistent().extend_ttl(
            &DataKey::AllowedCurrency(currency.clone()),
            TTL_BUMP_THRESHOLD,
            TTL_BUMP_AMOUNT,
        );

        let fee_bps: u32 = e.storage().instance().get(&DataKey::FeeBps).unwrap();
        let treasury: Address = e.storage().instance().get(&DataKey::Treasury).unwrap();

        // P9 guard part 1: referral is carved out of the fee.
        if referral_bps > fee_bps {
            panic_with_error!(e, MarketError::ReferralExceedsFee);
        }
        // P9 guard part 2: fee + royalty must leave a non-negative remainder. The
        // royalty only applies to the resale path; a primary sale has none.
        let royalty_bps = match &primary_split {
            Some(_) => 0,
            None => NftClient::new(e, &nft).royalty_bps(&token_id),
        };
        if fee_bps
            .checked_add(royalty_bps)
            .unwrap_or_else(|| panic_with_error!(e, MarketError::MathOverflow))
            > BPS_DENOMINATOR as u32
        {
            panic_with_error!(e, MarketError::FeePlusRoyaltyTooHigh);
        }
        // Validate the primary split up-front by dry-running the audited distributor
        // (cap, positivity, shares summing to 10000) — no duplicated money math.
        if let Some(split) = &primary_split {
            distribute(
                e,
                price,
                fee_bps,
                referral_bps,
                &treasury,
                &None,
                &DistMode::Primary(split.clone()),
            )
            .unwrap_or_else(|err| panic_with_error!(e, err));
        }

        // Escrow IN: move token(s) from the seller into the contract.
        let nft_client = NftClient::new(e, &nft);
        let here = e.current_contract_address();
        for i in 0..editions {
            let tid = token_id
                .checked_add(i)
                .unwrap_or_else(|| panic_with_error!(e, MarketError::MathOverflow));
            nft_client.transfer(&seller, &here, &tid);
        }

        // Persist the listing.
        let listing_id: u64 = e
            .storage()
            .instance()
            .get(&DataKey::NextListingId)
            .unwrap_or(0);
        let listing = Listing {
            seller: seller.clone(),
            nft: nft.clone(),
            token_id,
            price,
            currency: currency.clone(),
            kind: kind.clone(),
            primary_split: primary_split.clone(),
            referral_bps,
            editions_total: editions,
            editions_sold: 0,
            ends_at,
            status: ListingStatus::Active,
        };
        e.storage()
            .persistent()
            .set(&DataKey::Listing(listing_id), &listing);
        e.storage().persistent().extend_ttl(
            &DataKey::Listing(listing_id),
            TTL_BUMP_THRESHOLD,
            TTL_BUMP_AMOUNT,
        );
        e.storage()
            .instance()
            .set(&DataKey::NextListingId, &(listing_id + 1));

        ListingCreated {
            listing_id,
            seller,
            nft,
            token_id,
            price,
            currency,
            kind,
            editions_total: editions,
            ends_at,
            referral_bps,
            primary_split,
        }
        .publish(e);

        listing_id
    }

    /// Cancel an active listing and return the unsold escrowed token(s) to the
    /// seller. Only the seller can cancel, only while `Active`. Checks-effects-
    /// interactions: the status flips to `Cancelled` before any token moves, and
    /// the contract holds no residual afterwards.
    pub fn cancel(e: &Env, seller: Address, listing_id: u64) {
        seller.require_auth();

        let listing: Listing = e
            .storage()
            .persistent()
            .get(&DataKey::Listing(listing_id))
            .unwrap_or_else(|| panic_with_error!(e, MarketError::ListingNotFound));

        if listing.seller != seller {
            panic_with_error!(e, MarketError::NotSeller);
        }
        match listing.status {
            ListingStatus::Active => {}
            _ => panic_with_error!(e, MarketError::ListingNotActive),
        }

        // --- EFFECTS (before any interaction) ---
        let mut cancelled = listing.clone();
        cancelled.status = ListingStatus::Cancelled;
        e.storage()
            .persistent()
            .set(&DataKey::Listing(listing_id), &cancelled);
        e.storage().persistent().extend_ttl(
            &DataKey::Listing(listing_id),
            TTL_BUMP_THRESHOLD,
            TTL_BUMP_AMOUNT,
        );

        // --- INTERACTIONS ---
        // Return the unsold inventory: tokens [token_id + editions_sold,
        // token_id + editions_total). For FixedPrice that is the single token.
        let nft_client = NftClient::new(e, &listing.nft);
        let here = e.current_contract_address();
        let mut i = listing.editions_sold;
        while i < listing.editions_total {
            let tid = listing
                .token_id
                .checked_add(i)
                .unwrap_or_else(|| panic_with_error!(e, MarketError::MathOverflow));
            nft_client.transfer(&here, &listing.seller, &tid);
            i += 1;
        }

        ListingCancelled {
            listing_id,
            seller: listing.seller,
        }
        .publish(e);
    }

    /// Atomic purchase + distribution. Reuses [`distribute`] for all money math;
    /// this function only orchestrates escrow, transfers, and state.
    ///
    /// Checks-effects-interactions: the listing is marked `Sold` and persisted
    /// **before** any token moves, so a re-entrant or repeat `buy` on the same
    /// listing fails. The marketplace never custodies funds — payments go straight
    /// from buyer to each recipient and the NFT moves straight to the buyer, so the
    /// contract holds a zero balance afterwards.
    ///
    /// Self-referral: if `referrer` is the buyer or the seller, the referral is
    /// zeroed and the treasury keeps the full fee; the sale still proceeds.
    pub fn buy(e: &Env, buyer: Address, listing_id: u64, referrer: Option<Address>) {
        buyer.require_auth();

        let listing: Listing = e
            .storage()
            .persistent()
            .get(&DataKey::Listing(listing_id))
            .unwrap_or_else(|| panic_with_error!(e, MarketError::ListingNotFound));

        match listing.kind {
            // Reserved; enabled later via upgrade.
            ListingKind::Auction => panic_with_error!(e, MarketError::NotImplemented),
            ListingKind::FixedPrice | ListingKind::OpenEdition => {}
        }

        match listing.status {
            ListingStatus::Active => {}
            _ => panic_with_error!(e, MarketError::ListingNotActive),
        }

        // Open-edition window: past `ends_at` no more buys; the seller reclaims the
        // unsold inventory with `cancel`. `ends_at == 0` means no expiry.
        if let ListingKind::OpenEdition = listing.kind {
            if listing.ends_at != 0 && e.ledger().timestamp() > listing.ends_at {
                panic_with_error!(e, MarketError::ListingExpired);
            }
        }

        // Allowlist: never settle in an arbitrary SAC.
        let allowed: bool = e
            .storage()
            .persistent()
            .get(&DataKey::AllowedCurrency(listing.currency.clone()))
            .unwrap_or(false);
        if !allowed {
            panic_with_error!(e, MarketError::CurrencyNotAllowed);
        }
        e.storage().persistent().extend_ttl(
            &DataKey::AllowedCurrency(listing.currency.clone()),
            TTL_BUMP_THRESHOLD,
            TTL_BUMP_AMOUNT,
        );

        // Self-referral → no referral; treasury keeps the full fee, sale proceeds.
        let eff_referrer = match referrer {
            Some(r) if r != buyer && r != listing.seller => Some(r),
            _ => None,
        };

        let fee_bps: u32 = e.storage().instance().get(&DataKey::FeeBps).unwrap();
        let treasury: Address = e.storage().instance().get(&DataKey::Treasury).unwrap();

        // Which edition is being sold: FixedPrice has a single token; OpenEdition
        // sells from contiguous inventory starting at `token_id`.
        let handed_token_id = match listing.kind {
            ListingKind::OpenEdition => listing
                .token_id
                .checked_add(listing.editions_sold)
                .unwrap_or_else(|| panic_with_error!(e, MarketError::MathOverflow)),
            _ => listing.token_id,
        };

        // Build the distribution mode from the listing (no new money logic here).
        let (mode, royalty_paid) = match &listing.primary_split {
            Some(split) => (DistMode::Primary(split.clone()), 0i128),
            None => {
                let royalties = NftClient::new(e, &listing.nft)
                    .get_royalty_info(&handed_token_id, &listing.price);
                let mut total: i128 = 0;
                for entry in royalties.iter() {
                    total += entry.1;
                }
                (DistMode::Secondary(listing.seller.clone(), royalties), total)
            }
        };

        let payouts = distribute(
            e,
            listing.price,
            fee_bps,
            listing.referral_bps,
            &treasury,
            &eff_referrer,
            &mode,
        )
        .unwrap_or_else(|err| panic_with_error!(e, err));

        // --- EFFECTS (before any interaction) ---
        // FixedPrice closes on the sale; OpenEdition decrements inventory and only
        // closes once the last edition is sold.
        let mut updated = listing.clone();
        match listing.kind {
            ListingKind::OpenEdition => {
                updated.editions_sold = listing
                    .editions_sold
                    .checked_add(1)
                    .unwrap_or_else(|| panic_with_error!(e, MarketError::MathOverflow));
                if updated.editions_sold >= listing.editions_total {
                    updated.status = ListingStatus::Sold;
                }
            }
            _ => updated.status = ListingStatus::Sold,
        }
        e.storage()
            .persistent()
            .set(&DataKey::Listing(listing_id), &updated);
        e.storage().persistent().extend_ttl(
            &DataKey::Listing(listing_id),
            TTL_BUMP_THRESHOLD,
            TTL_BUMP_AMOUNT,
        );

        // --- INTERACTIONS ---
        // Payments: buyer → each recipient (skip zero-value transfers).
        let pay = token::TokenClient::new(e, &listing.currency);
        for entry in payouts.iter() {
            let (to, amount) = entry;
            // Skip zero-value transfers (every payout is >= 0, so `!= 0` == `> 0`).
            if amount != 0 {
                pay.transfer(&buyer, &to, &amount);
            }
        }
        // NFT out of escrow to the buyer.
        NftClient::new(e, &listing.nft).transfer(
            &e.current_contract_address(),
            &buyer,
            &handed_token_id,
        );

        // Event for the indexer: derive fee/referral from the distribution output.
        let treasury_amount = payouts.get(0).unwrap().1; // treasury is always first
        let referral_paid = match &eff_referrer {
            Some(r) => {
                let mut a: i128 = 0;
                for entry in payouts.iter() {
                    if &entry.0 == r {
                        a += entry.1;
                    }
                }
                a
            }
            None => 0,
        };
        let fee_paid = treasury_amount + referral_paid;

        Sold {
            listing_id,
            token_id: handed_token_id,
            buyer,
            seller: listing.seller,
            price: listing.price,
            currency: listing.currency,
            royalty_paid,
            referral_paid,
            fee_paid,
        }
        .publish(e);
    }

    /// Upgrade the contract WASM in place (SEP-49). Owner-gated. Mirrors the NFT
    /// and ArtistRegistry.
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        enforce_owner_auth(e);
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

#[contractimpl(contracttrait)]
impl Ownable for MolotovMarketplace {}

#[cfg(test)]
mod test;
