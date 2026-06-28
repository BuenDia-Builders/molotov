extern crate std;

use soroban_sdk::{
    contract, contractimpl, symbol_short,
    testutils::Address as _,
    vec, Address, BytesN, Env, String, Vec,
};

use crate::{MolotovNft, MolotovNftClient, RoyaltyRecipient};

// --- Mock ArtistRegistry, used to exercise the cross-contract gate. ---
#[contract]
pub struct MockRegistry;

#[contractimpl]
impl MockRegistry {
    pub fn __constructor(e: &Env, answer: bool) {
        e.storage().instance().set(&symbol_short!("ANS"), &answer);
    }
    pub fn is_registered(e: &Env, _artist: Address) -> bool {
        e.storage().instance().get(&symbol_short!("ANS")).unwrap()
    }
}

fn placeholder(e: &Env) -> Address {
    Address::from_str(e, crate::TEMP_REGISTRY_PLACEHOLDER)
}

/// Deploy with the placeholder registry (gate disabled).
fn deploy(e: &Env) -> (MolotovNftClient<'_>, Address) {
    let admin = Address::generate(e);
    let id = e.register(
        MolotovNft,
        (
            admin.clone(),
            placeholder(e),
            String::from_str(e, "Molotov"),
            String::from_str(e, "MOLO"),
        ),
    );
    (MolotovNftClient::new(e, &id), admin)
}

fn one_recipient(e: &Env, who: &Address) -> Vec<RoyaltyRecipient> {
    vec![
        e,
        RoyaltyRecipient {
            address: who.clone(),
            share_bps: 10_000,
        },
    ]
}

// ============================ Happy path ============================

#[test]
fn test_mint_with_valid_royalty() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);

    let artist = Address::generate(&e);
    let uri = String::from_str(&e, "ipfs://obra-1");
    let recipients = one_recipient(&e, &artist);

    let token_id = client.mint(&artist, &artist, &uri, &1000u32, &recipients);

    // Storage.
    assert_eq!(client.royalty_bps(&token_id), 1000);
    assert_eq!(client.owner_of(&token_id), artist);
    assert_eq!(client.token_uri(&token_id), uri);

    // 100 XLM sale -> 10% -> 10 XLM, all to the single recipient.
    let info = client.get_royalty_info(&token_id, &1_000_000_000i128);
    assert_eq!(info.len(), 1);
    assert_eq!(info.get(0).unwrap(), (artist.clone(), 100_000_000i128));

    // Note: the Minted event is published by the contract (verified live in the
    // smoke test). soroban-sdk 25.3's unit-test env does not surface contract
    // events via events().all(), so we assert storage here, not the event.
}

#[test]
fn test_mint_with_royalty_split() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);

    let artist = Address::generate(&e);
    let r0 = Address::generate(&e);
    let r1 = Address::generate(&e);
    let r2 = Address::generate(&e);
    let recipients = vec![
        &e,
        RoyaltyRecipient { address: r0.clone(), share_bps: 5000 },
        RoyaltyRecipient { address: r1.clone(), share_bps: 3000 },
        RoyaltyRecipient { address: r2.clone(), share_bps: 2000 },
    ];

    let token_id = client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://obra-split"),
        &1200u32,
        &recipients,
    );

    // 100 XLM sale -> 12% -> 12 XLM total, split 50/30/20.
    let info = client.get_royalty_info(&token_id, &1_000_000_000i128);
    assert_eq!(info.len(), 3);
    assert_eq!(info.get(0).unwrap(), (r0, 60_000_000i128));
    assert_eq!(info.get(1).unwrap(), (r1, 36_000_000i128));
    assert_eq!(info.get(2).unwrap(), (r2, 24_000_000i128));

    // The sum closes exactly against the total (no rounding leak).
    let total: i128 = info.get(0).unwrap().1 + info.get(1).unwrap().1 + info.get(2).unwrap().1;
    assert_eq!(total, 120_000_000i128);
}

#[test]
fn test_transfer() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);

    let artist = Address::generate(&e);
    let collector_a = Address::generate(&e);
    let collector_b = Address::generate(&e);
    let token_id = client.mint(
        &artist,
        &collector_a,
        &String::from_str(&e, "ipfs://obra-t"),
        &1000u32,
        &one_recipient(&e, &artist),
    );

    assert_eq!(client.owner_of(&token_id), collector_a);
    client.transfer(&collector_a, &collector_b, &token_id);
    assert_eq!(client.owner_of(&token_id), collector_b);
}

#[test]
fn test_burn() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);

    let owner = Address::generate(&e);
    let token_id = client.mint(
        &owner,
        &owner,
        &String::from_str(&e, "ipfs://obra-b"),
        &1000u32,
        &one_recipient(&e, &owner),
    );

    client.burn(&owner, &token_id);
    // owner_of must fail for a burned token.
    assert!(client.try_owner_of(&token_id).is_err());
}

// ============================ Error cases ============================

#[test]
#[should_panic]
fn test_mint_rejects_royalty_below_min() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);
    client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://x"),
        &99u32,
        &one_recipient(&e, &artist),
    );
}

#[test]
#[should_panic]
fn test_mint_rejects_royalty_above_max() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);
    client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://x"),
        &1501u32,
        &one_recipient(&e, &artist),
    );
}

#[test]
#[should_panic]
fn test_mint_rejects_split_not_summing_10000() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);
    let recipients = vec![
        &e,
        RoyaltyRecipient { address: Address::generate(&e), share_bps: 4000 },
        RoyaltyRecipient { address: Address::generate(&e), share_bps: 4000 },
        RoyaltyRecipient { address: Address::generate(&e), share_bps: 1000 },
    ];
    client.mint(&artist, &artist, &String::from_str(&e, "ipfs://x"), &1000u32, &recipients);
}

#[test]
#[should_panic]
fn test_mint_rejects_unregistered_artist() {
    let e = Env::default();
    e.mock_all_auths();
    // Real (mock) registry that answers `false` for everyone.
    let registry = e.register(MockRegistry, (false,));
    let admin = Address::generate(&e);
    let id = e.register(
        MolotovNft,
        (
            admin,
            registry,
            String::from_str(&e, "Molotov"),
            String::from_str(&e, "MOLO"),
        ),
    );
    let client = MolotovNftClient::new(&e, &id);
    let artist = Address::generate(&e);
    client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://x"),
        &1000u32,
        &one_recipient(&e, &artist),
    );
}

#[test]
fn test_mint_accepts_registered_artist() {
    let e = Env::default();
    e.mock_all_auths();
    // Mock registry that answers `true`: the gate lets the mint through.
    let registry = e.register(MockRegistry, (true,));
    let admin = Address::generate(&e);
    let id = e.register(
        MolotovNft,
        (
            admin,
            registry,
            String::from_str(&e, "Molotov"),
            String::from_str(&e, "MOLO"),
        ),
    );
    let client = MolotovNftClient::new(&e, &id);
    let artist = Address::generate(&e);
    let token_id = client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://ok"),
        &1000u32,
        &one_recipient(&e, &artist),
    );
    assert_eq!(client.owner_of(&token_id), artist);
}

#[test]
#[should_panic]
fn test_set_default_royalty_is_immutable() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);
    client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://x"),
        &1000u32,
        &one_recipient(&e, &artist),
    );
    // Must panic: ROYALTIES_IMMUTABLE_AFTER_MINT.
    client.set_default_royalty(&artist, &500u32);
}

#[test]
#[should_panic]
fn test_set_token_royalty_is_immutable() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);
    let token_id = client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://x"),
        &1000u32,
        &one_recipient(&e, &artist),
    );
    // Must panic: ROYALTIES_IMMUTABLE_AFTER_MINT.
    client.set_token_royalty(&token_id, &artist, &500u32);
}

#[test]
#[should_panic]
fn test_burn_by_non_owner_fails() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let owner = Address::generate(&e);
    let stranger = Address::generate(&e);
    let token_id = client.mint(
        &owner,
        &owner,
        &String::from_str(&e, "ipfs://x"),
        &1000u32,
        &one_recipient(&e, &owner),
    );
    client.burn(&stranger, &token_id);
}

// ===================== Recipient cap (MAX_RECIPIENTS) =====================

/// Exactly 10 recipients (the cap) is allowed.
#[test]
fn test_mint_accepts_exactly_max_recipients() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);

    // 10 recipients, each 1000 bps -> sums to 10000.
    let mut recipients: Vec<RoyaltyRecipient> = Vec::new(&e);
    for _ in 0..10 {
        recipients.push_back(RoyaltyRecipient {
            address: Address::generate(&e),
            share_bps: 1000,
        });
    }

    let token_id = client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://max"),
        &1000u32,
        &recipients,
    );
    assert_eq!(client.owner_of(&token_id), artist);
}

/// 11 recipients is rejected by the cap. The shares are crafted to sum to 10000
/// with every share positive, so the ONLY reason this can panic is the cap.
#[test]
#[should_panic]
fn test_mint_rejects_more_than_max_recipients() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);

    let mut recipients: Vec<RoyaltyRecipient> = Vec::new(&e);
    for _ in 0..10 {
        recipients.push_back(RoyaltyRecipient {
            address: Address::generate(&e),
            share_bps: 900,
        });
    }
    recipients.push_back(RoyaltyRecipient {
        address: Address::generate(&e),
        share_bps: 1000,
    }); // 10*900 + 1000 = 10000, 11 recipients

    client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://too-many"),
        &1000u32,
        &recipients,
    );
}

// ============================ set_registry ============================

/// The owner can repoint the registry; `registry()` reflects the new value.
#[test]
fn test_set_registry_updates_value() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);

    let new_registry = Address::generate(&e);
    client.set_registry(&new_registry);
    assert_eq!(client.registry(), new_registry);
}

/// `set_registry` requires the owner's auth (no auth mocked -> panics).
#[test]
#[should_panic]
fn test_set_registry_requires_owner_auth() {
    let e = Env::default();
    let (client, _admin) = deploy(&e); // construction needs no auth
    let new_registry = Address::generate(&e);
    client.set_registry(&new_registry);
}

/// Rotating the registry actually rewires the gate: starting from the
/// placeholder (gate off), pointing at a registry that denies blocks the mint,
/// and pointing at one that allows lets it through again.
#[test]
fn test_set_registry_activates_gate() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);

    // Gate off (placeholder): mint succeeds.
    client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://gate-off"),
        &1000u32,
        &one_recipient(&e, &artist),
    );

    // Point at a registry that denies everyone: mint is now blocked.
    let denying = e.register(MockRegistry, (false,));
    client.set_registry(&denying);
    assert!(client
        .try_mint(
            &artist,
            &artist,
            &String::from_str(&e, "ipfs://denied"),
            &1000u32,
            &one_recipient(&e, &artist),
        )
        .is_err());

    // Point at a registry that allows: mint goes through again.
    let allowing = e.register(MockRegistry, (true,));
    client.set_registry(&allowing);
    let token_id = client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://allowed"),
        &1000u32,
        &one_recipient(&e, &artist),
    );
    assert_eq!(client.owner_of(&token_id), artist);
}

// ============================== upgrade ==============================

/// `upgrade` requires the owner's auth: with no auth mocked the owner check
/// panics before any WASM swap is attempted.
#[test]
#[should_panic]
fn test_upgrade_requires_owner_auth() {
    let e = Env::default();
    let (client, _admin) = deploy(&e); // construction needs no auth
    let dummy_hash = BytesN::from_array(&e, &[0u8; 32]);
    client.upgrade(&dummy_hash);
}

// ================================ TTL ================================

/// `mint` bumps both persistent entries (URI + royalty) to the ~30-day TTL,
/// and reading royalty via `get_royalty_info` keeps the royalty entry bumped.
#[test]
fn test_mint_and_read_extend_persistent_ttl() {
    use crate::{DataKey, TTL_BUMP_AMOUNT};
    use soroban_sdk::testutils::storage::Persistent as _;
    use soroban_sdk::testutils::Ledger as _;

    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let id = e.register(
        MolotovNft,
        (
            admin,
            placeholder(&e),
            String::from_str(&e, "Molotov"),
            String::from_str(&e, "MOLO"),
        ),
    );
    let client = MolotovNftClient::new(&e, &id);

    let artist = Address::generate(&e);
    let token_id = client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://ttl"),
        &1000u32,
        &one_recipient(&e, &artist),
    );

    // Both entries got the ~30-day TTL at mint.
    e.as_contract(&id, || {
        let uri_ttl = e.storage().persistent().get_ttl(&DataKey::TokenUri(token_id));
        let roy_ttl = e.storage().persistent().get_ttl(&DataKey::Royalty(token_id));
        assert!(uri_ttl >= TTL_BUMP_AMOUNT - 16, "uri ttl too low: {}", uri_ttl);
        assert!(roy_ttl >= TTL_BUMP_AMOUNT - 16, "royalty ttl too low: {}", roy_ttl);
    });

    // Advance close to expiry, then a royalty read should bump it back up.
    e.ledger().with_mut(|l| l.sequence_number += TTL_BUMP_AMOUNT - 100);
    client.get_royalty_info(&token_id, &1_000_000_000i128);
    e.as_contract(&id, || {
        let roy_ttl = e.storage().persistent().get_ttl(&DataKey::Royalty(token_id));
        assert!(roy_ttl >= TTL_BUMP_AMOUNT - 16, "royalty ttl not re-bumped: {}", roy_ttl);
    });
}

// ================= URI TTL bump on token_uri read =================

/// `token_uri` bumps the URI entry TTL on every read, mirroring what
/// `get_royalty_info` does for the royalty entry. After a bump the entry
/// should have ~30 days of life left.
#[test]
fn test_token_uri_bumps_ttl_on_read() {
    use crate::{DataKey, TTL_BUMP_AMOUNT};
    use soroban_sdk::testutils::storage::Persistent as _;
    use soroban_sdk::testutils::Ledger as _;

    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);

    let artist = Address::generate(&e);
    let uri = String::from_str(&e, "ipfs://obra-ttl-bump");
    let token_id = client.mint(&artist, &artist, &uri, &1000u32, &one_recipient(&e, &artist));

    let id = client.address.clone();
    // Advance close to expiry so the bump is measurable.
    e.ledger().with_mut(|l| l.sequence_number += TTL_BUMP_AMOUNT - 100);

    // Read — this should bump.
    let result = client.token_uri(&token_id);
    assert_eq!(result, uri);

    e.as_contract(&id, || {
        let ttl = e.storage().persistent().get_ttl(&DataKey::TokenUri(token_id));
        assert!(ttl >= TTL_BUMP_AMOUNT - 16, "URI ttl too low after bump: {}", ttl);
    });
}

/// When the URI entry is bumped before expiry, `token_uri` still returns the
/// correct IPFS URI rather than the fallback `base_uri + token_id` string.
#[test]
fn test_token_uri_survives_expiry_window_when_bumped() {
    use crate::TTL_BUMP_AMOUNT;
    use soroban_sdk::testutils::Ledger as _;

    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);

    let artist = Address::generate(&e);
    let uri = String::from_str(&e, "ipfs://obra-survive");
    let token_id = client.mint(&artist, &artist, &uri, &1000u32, &one_recipient(&e, &artist));

    // Advance most of the way through the initial TTL.
    e.ledger().with_mut(|l| l.sequence_number += TTL_BUMP_AMOUNT - 200);
    // Bump via read.
    let result = client.token_uri(&token_id);
    assert_eq!(result, uri);

    // Advance again close to the new expiry.
    e.ledger().with_mut(|l| l.sequence_number += TTL_BUMP_AMOUNT - 200);
    // Still returns the real URI — not the fallback.
    let result = client.token_uri(&token_id);
    assert_eq!(result, uri);
}

/// The `unwrap_or_else(|| Base::token_uri(...))` fallback is only exercised
/// when no URI was stored for the token (genuinely absent), not when the
/// entry expired. After the fix, an expired-but-bumped entry still lives.
#[test]
fn test_token_uri_fallback_only_when_genuinely_absent() {
    use crate::DataKey;

    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);

    let artist = Address::generate(&e);
    let token_id = client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://obra-absent"),
        &1000u32,
        &one_recipient(&e, &artist),
    );

    // The stored URI is present — token_uri returns it.
    assert_eq!(
        client.token_uri(&token_id),
        String::from_str(&e, "ipfs://obra-absent"),
    );

    let id = client.address.clone();
    // Simulate a token that was minted but we manually remove its URI entry
    // from storage to test the fallback path.
    e.as_contract(&id, || {
        e.storage().persistent().remove(&DataKey::TokenUri(token_id));
    });

    // Now the fallback kicks in: base_uri is "" so it returns an empty string.
    assert_eq!(client.token_uri(&token_id), String::from_str(&e, ""));
}

// ================= Property-based: royalty / split / dust =================

use proptest::prelude::*;

prop_compose! {
    /// A valid royalty split: 1..=MAX_RECIPIENTS shares, each >= 1, summing to
    /// exactly 10000. Built by partitioning 10000 at distinct interior cut points,
    /// which guarantees every share is positive and the total is exact.
    fn arb_shares()(n in 1usize..=10usize)
                  (cuts in prop::collection::btree_set(1u32..10_000u32, n - 1))
                  -> std::vec::Vec<u32> {
        let mut shares = std::vec::Vec::new();
        let mut prev = 0u32;
        for c in &cuts {
            shares.push(c - prev);
            prev = *c;
        }
        shares.push(10_000 - prev);
        shares
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(64))]

    /// For any valid royalty (bps in [100,1500]), any valid split, and any sale
    /// price, the payouts:
    ///   - have one entry per recipient,
    ///   - are all non-negative,
    ///   - match `total * share_bps / 10000` for every recipient but the last,
    ///   - sum to exactly `total = sale_price * total_bps / 10000` (the last
    ///     recipient absorbs the rounding dust — no value is created or lost).
    #[test]
    fn prop_royalty_payouts_sum_to_total_with_dust_on_last(
        shares in arb_shares(),
        royalty_bps in 100u32..=1500u32,
        sale_price in 0i128..=1_000_000_000_000_000i128,
    ) {
        let e = Env::default();
        e.mock_all_auths();
        let (client, _admin) = deploy(&e);
        let artist = Address::generate(&e);

        let mut recipients: Vec<RoyaltyRecipient> = Vec::new(&e);
        for s in &shares {
            recipients.push_back(RoyaltyRecipient {
                address: Address::generate(&e),
                share_bps: *s,
            });
        }

        let token_id = client.mint(
            &artist,
            &artist,
            &String::from_str(&e, "ipfs://prop"),
            &royalty_bps,
            &recipients,
        );

        let info = client.get_royalty_info(&token_id, &sale_price);
        // Same order of operations as the contract: multiply, then divide.
        let total = sale_price * royalty_bps as i128 / 10_000;

        prop_assert_eq!(info.len(), shares.len() as u32);

        let n = info.len();
        let mut sum = 0i128;
        for i in 0..n {
            let (_, amount) = info.get(i).unwrap();
            prop_assert!(amount >= 0);
            if i < n - 1 {
                let expected = total * shares[i as usize] as i128 / 10_000;
                prop_assert_eq!(amount, expected);
            }
            sum += amount;
        }
        prop_assert_eq!(sum, total);
    }
}
