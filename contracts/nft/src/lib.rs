//! MolotovNFT — production NFT contract for the Molotov marketplace.
//!
//! Three product differentiators, baked into the contract:
//!   1. **Immutable** royalties: the royalty config is fixed at mint and can
//!      never change. There are no setters; the inherited base stubs panic with
//!      `RoyaltiesImmutableAfterMint`.
//!   2. **Multi-wallet** split: the royalty is shared among N recipients, each
//!      with its share in basis points (must sum to 10000).
//!   3. **Gated** mint via the ArtistRegistry (cross-contract). Until Step 7 the
//!      registry is a placeholder that disables the gate.
//!
//! SEP-50 core (transfer, burn, owner_of, balance, token_uri) comes from the
//! OpenZeppelin base; `token_uri` is overridden to serve per-token IPFS URIs.

#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, Address, BytesN, Env, String, Vec,
};
use stellar_access::ownable::{enforce_owner_auth, set_owner, Ownable};
use stellar_tokens::non_fungible::{burnable::NonFungibleBurnable, Base, NonFungibleToken};

/// Registry placeholder: an all-zeros contract id (a nonexistent contract).
/// While the NFT points here the artist gate is disabled. Replaced by the real
/// ArtistRegistry in Step 7.
const TEMP_REGISTRY_PLACEHOLDER: &str =
    "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

const MIN_ROYALTY_BPS: u32 = 100; // 1%
const MAX_ROYALTY_BPS: u32 = 1500; // 15%
const BPS_DENOMINATOR: i128 = 10_000; // 100%
// Bounds the royalty-split loop: an unbounded loop over a user-supplied list is a
// gas / DoS vector.
const MAX_RECIPIENTS: u32 = 10;

// TTL maintenance for the persistent royalty/URI entries. Stellar closes a ledger
// roughly every 5s, so ~1 day ≈ 17280 ledgers. When an entry has less than ~1 day
// of life left we bump it back to ~30 days, so an actively used token never lets
// its royalty/URI config expire. `extend_ttl` only pays rent — it does not rewrite
// the stored value.
const TTL_BUMP_THRESHOLD: u32 = 17_280; // ~1 day in ledgers
const TTL_BUMP_AMOUNT: u32 = 518_400; // ~30 days in ledgers

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MolotovError {
    RoyaltyTooLow = 1,
    RoyaltyTooHigh = 2,
    ShareNotPositive = 3,
    SharesMustSumTo10000 = 4,
    NoRecipients = 5,
    ArtistNotRegistered = 6,
    RoyaltiesImmutableAfterMint = 7,
    RoyaltyConfigMissing = 8,
    MathOverflow = 9,
    TooManyRecipients = 10,
}

#[contracttype]
#[derive(Clone)]
pub struct RoyaltyRecipient {
    pub address: Address,
    pub share_bps: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct RoyaltyConfig {
    pub total_bps: u32,
    pub recipients: Vec<RoyaltyRecipient>,
}

/// Structured event emitted on mint. `token_id` is a topic (indexable).
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MintedEvent {
    #[topic]
    pub token_id: u32,
    pub artist: Address,
    pub recipient: Address,
    pub royalty_bps: u32,
    pub recipients_count: u32,
}

#[contracttype]
pub enum DataKey {
    Registry,
    TokenUri(u32),
    Royalty(u32),
}

/// ArtistRegistry interface (implemented by the Step 7 contract). Only used to
/// generate the `ArtistRegistryClient` cross-contract client.
#[contractclient(name = "ArtistRegistryClient")]
pub trait ArtistRegistryInterface {
    fn is_registered(e: Env, artist: Address) -> bool;
}

#[contract]
pub struct MolotovNft;

#[contractimpl]
impl MolotovNft {
    /// Initializes the collection.
    ///
    /// `admin` is the owner ONLY for upgrades / treasury changes, never to touch
    /// royalties. `registry` is the ArtistRegistry (or the placeholder).
    pub fn __constructor(
        e: &Env,
        admin: Address,
        registry: Address,
        name: String,
        symbol: String,
    ) {
        set_owner(e, &admin);
        // Empty base_uri: each token carries its own IPFS URI (see `token_uri`).
        Base::set_metadata(e, String::from_str(e, ""), name, symbol);
        e.storage().instance().set(&DataKey::Registry, &registry);
    }

    /// Mints a token to `recipient`, attributed to `artist`, with its IPFS URI
    /// and immutable royalty config. Returns the sequential `token_id`.
    pub fn mint(
        e: &Env,
        artist: Address,
        recipient: Address,
        token_uri: String,
        royalty_bps: u32,
        recipients: Vec<RoyaltyRecipient>,
    ) -> u32 {
        artist.require_auth();

        Self::require_registered_artist(e, &artist);

        if royalty_bps < MIN_ROYALTY_BPS {
            panic_with_error!(e, MolotovError::RoyaltyTooLow);
        }
        if royalty_bps > MAX_ROYALTY_BPS {
            panic_with_error!(e, MolotovError::RoyaltyTooHigh);
        }
        if recipients.is_empty() {
            panic_with_error!(e, MolotovError::NoRecipients);
        }
        if recipients.len() > MAX_RECIPIENTS {
            panic_with_error!(e, MolotovError::TooManyRecipients);
        }
        let mut sum: u32 = 0;
        for r in recipients.iter() {
            if r.share_bps == 0 {
                panic_with_error!(e, MolotovError::ShareNotPositive);
            }
            sum = sum
                .checked_add(r.share_bps)
                .unwrap_or_else(|| panic_with_error!(e, MolotovError::MathOverflow));
        }
        if sum != BPS_DENOMINATOR as u32 {
            panic_with_error!(e, MolotovError::SharesMustSumTo10000);
        }

        let token_id = Base::sequential_mint(e, &recipient);

        // Persist URI + royalty config (immutable from here on), then bump both
        // entries to a ~30-day TTL so they don't expire out from under the token.
        e.storage()
            .persistent()
            .set(&DataKey::TokenUri(token_id), &token_uri);
        e.storage().persistent().extend_ttl(
            &DataKey::TokenUri(token_id),
            TTL_BUMP_THRESHOLD,
            TTL_BUMP_AMOUNT,
        );
        let recipients_count = recipients.len();
        let config = RoyaltyConfig { total_bps: royalty_bps, recipients };
        e.storage()
            .persistent()
            .set(&DataKey::Royalty(token_id), &config);
        e.storage().persistent().extend_ttl(
            &DataKey::Royalty(token_id),
            TTL_BUMP_THRESHOLD,
            TTL_BUMP_AMOUNT,
        );

        MintedEvent {
            token_id,
            artist,
            recipient,
            royalty_bps,
            recipients_count,
        }
        .publish(e);

        token_id
    }

    /// Royalty distribution for a sale: a list of `(recipient, amount_stroops)`.
    /// The marketplace consumes it to distribute proceeds.
    ///
    /// `total = sale_price * total_bps / 10000`; each share is
    /// `total * share_bps / 10000`. The last recipient absorbs the rounding dust
    /// so that the sum of amounts == total.
    pub fn get_royalty_info(e: &Env, token_id: u32, sale_price: i128) -> Vec<(Address, i128)> {
        let config = Self::royalty_config(e, token_id);
        // Keep the royalty entry alive on access: when the marketplace reads it,
        // bump its TTL. Only extends rent — the value is not rewritten.
        e.storage().persistent().extend_ttl(
            &DataKey::Royalty(token_id),
            TTL_BUMP_THRESHOLD,
            TTL_BUMP_AMOUNT,
        );
        let total_amount = mul_div(e, sale_price, config.total_bps as i128, BPS_DENOMINATOR);

        let mut out: Vec<(Address, i128)> = Vec::new(e);
        let n = config.recipients.len();
        let mut distributed: i128 = 0;
        for i in 0..n {
            let r = config.recipients.get(i).unwrap();
            let amount = if i == n - 1 {
                // last: the remainder, so the sum closes exactly against `total`.
                total_amount
                    .checked_sub(distributed)
                    .unwrap_or_else(|| panic_with_error!(e, MolotovError::MathOverflow))
            } else {
                let a = mul_div(e, total_amount, r.share_bps as i128, BPS_DENOMINATOR);
                distributed = distributed
                    .checked_add(a)
                    .unwrap_or_else(|| panic_with_error!(e, MolotovError::MathOverflow));
                a
            };
            out.push_back((r.address, amount));
        }
        out
    }

    pub fn royalty_bps(e: &Env, token_id: u32) -> u32 {
        Self::royalty_config(e, token_id).total_bps
    }

    pub fn registry(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Registry).unwrap()
    }

    /// Point the mint gate at a new ArtistRegistry. Owner-gated.
    ///
    /// Required to activate the gate (swap out the placeholder) or rotate the
    /// registry without redeploying the NFT.
    pub fn set_registry(e: &Env, new_registry: Address) {
        enforce_owner_auth(e);
        e.storage()
            .instance()
            .set(&DataKey::Registry, &new_registry);
    }

    /// Upgrade the contract WASM in place (SEP-49). Owner-gated.
    ///
    /// Same address, same data, new code. The per-token royalty config stays
    /// immutable — no code path here rewrites it.
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        enforce_owner_auth(e);
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    // --- Immutability guards: the royalty NEVER changes post-mint. ---
    // Stubs in case someone tries the standard ERC2981 path; they always panic.

    pub fn set_default_royalty(e: &Env, _receiver: Address, _basis_points: u32) {
        panic_with_error!(e, MolotovError::RoyaltiesImmutableAfterMint);
    }

    pub fn set_token_royalty(
        e: &Env,
        _token_id: u32,
        _receiver: Address,
        _basis_points: u32,
    ) {
        panic_with_error!(e, MolotovError::RoyaltiesImmutableAfterMint);
    }

    // --- internals ---

    fn royalty_config(e: &Env, token_id: u32) -> RoyaltyConfig {
        e.storage()
            .persistent()
            .get(&DataKey::Royalty(token_id))
            .unwrap_or_else(|| panic_with_error!(e, MolotovError::RoyaltyConfigMissing))
    }

    fn require_registered_artist(e: &Env, artist: &Address) {
        let registry: Address = e.storage().instance().get(&DataKey::Registry).unwrap();
        let placeholder = Address::from_str(e, TEMP_REGISTRY_PLACEHOLDER);
        if registry == placeholder {
            return; // gate disabled until Step 7
        }
        if !ArtistRegistryClient::new(e, &registry).is_registered(artist) {
            panic_with_error!(e, MolotovError::ArtistNotRegistered);
        }
    }
}

#[contractimpl(contracttrait)]
impl NonFungibleToken for MolotovNft {
    type ContractType = Base;

    /// Override: returns the per-token IPFS URI stored at mint (not base_uri + id).
    /// Bumps the URI entry TTL on every successful read so it stays alive as long
    /// as the token is queried.
    fn token_uri(e: &Env, token_id: u32) -> String {
        let _ = Base::owner_of(e, token_id); // panics if the token does not exist
        if let Some(uri) = e
            .storage()
            .persistent()
            .get(&DataKey::TokenUri(token_id))
        {
            e.storage().persistent().extend_ttl(
                &DataKey::TokenUri(token_id),
                TTL_BUMP_THRESHOLD,
                TTL_BUMP_AMOUNT,
            );
            uri
        } else {
            Base::token_uri(e, token_id)
        }
    }
}

#[contractimpl(contracttrait)]
impl NonFungibleBurnable for MolotovNft {}

#[contractimpl(contracttrait)]
impl Ownable for MolotovNft {}

/// `a * b / denom` with checked mul/div; panics on overflow.
fn mul_div(e: &Env, a: i128, b: i128, denom: i128) -> i128 {
    a.checked_mul(b)
        .unwrap_or_else(|| panic_with_error!(e, MolotovError::MathOverflow))
        .checked_div(denom)
        .unwrap_or_else(|| panic_with_error!(e, MolotovError::MathOverflow))
}

#[cfg(test)]
mod test;
