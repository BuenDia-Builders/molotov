extern crate std;

use soroban_sdk::{
    contract, contractimpl, symbol_short, testutils::Address as _, token, vec, Address, Env, Vec,
};

use crate::{
    distribute, DataKey, DistMode, Listing, ListingKind, ListingStatus, MarketError,
    MolotovMarketplace, MolotovMarketplaceClient, RoyaltyRecipient,
};
use proptest::prelude::*;

// ============================== helpers ==============================

/// Total of the amounts in a distribution vector.
fn sum_amounts(v: &Vec<(Address, i128)>) -> i128 {
    let mut s: i128 = 0;
    for entry in v.iter() {
        s += entry.1;
    }
    s
}

/// Sum of the amounts paid to a specific address (0 if it never appears).
fn amount_of(v: &Vec<(Address, i128)>, who: &Address) -> i128 {
    let mut s: i128 = 0;
    for entry in v.iter() {
        if &entry.0 == who {
            s += entry.1;
        }
    }
    s
}

/// Build a primary split (recipients with fresh addresses) from share_bps.
fn recipients_from_shares(e: &Env, shares: &[u32]) -> Vec<RoyaltyRecipient> {
    let mut v: Vec<RoyaltyRecipient> = Vec::new(e);
    for s in shares {
        v.push_back(RoyaltyRecipient {
            address: Address::generate(e),
            share_bps: *s,
        });
    }
    v
}

/// Mirror of the NFT's `get_royalty_info`: total = price*royalty_bps/10000, each
/// recipient gets total*share/10000, the last absorbs the dust. Lets the secondary
/// tests cross-check against the exact vector the NFT would return (P7).
fn royalty_vec(
    e: &Env,
    price: i128,
    royalty_bps: u32,
    shares: &[u32],
) -> (Vec<(Address, i128)>, i128) {
    let total = price * royalty_bps as i128 / 10_000;
    let mut out: Vec<(Address, i128)> = Vec::new(e);
    let n = shares.len();
    let mut distributed: i128 = 0;
    for (i, s) in shares.iter().enumerate() {
        let amount = if i == n - 1 {
            total - distributed
        } else {
            let a = total * (*s as i128) / 10_000;
            distributed += a;
            a
        };
        out.push_back((Address::generate(e), amount));
    }
    (out, total)
}

// ============================== generators ==============================

prop_compose! {
    /// A valid split / royalty partition: 1..=10 shares, each >= 1, summing to
    /// exactly 10000, built from distinct cut points so dust lands on the last.
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

prop_compose! {
    /// `(fee_bps, referral_bps)` with `referral_bps <= fee_bps` (referral is carved
    /// out of the fee). fee up to 10%.
    fn arb_fee_ref()(fee_bps in 0u32..=1000u32)
                   (referral_bps in 0u32..=fee_bps, fee_bps in Just(fee_bps))
                   -> (u32, u32) {
        (fee_bps, referral_bps)
    }
}

prop_compose! {
    /// Like `arb_fee_ref` but guarantees a non-zero, money-moving referral.
    fn arb_fee_ref_active()(fee_bps in 1u32..=1000u32)
                          (referral_bps in 1u32..=fee_bps, fee_bps in Just(fee_bps))
                          -> (u32, u32) {
        (fee_bps, referral_bps)
    }
}

/// Sale price: a mix of tiny values (where integer-division dust is most visible)
/// and large ones.
fn arb_price() -> impl Strategy<Value = i128> {
    prop_oneof![
        1i128..=10i128,
        1i128..=1_000_000_000_000_000i128,
    ]
}

// ============================== properties ==============================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(96))]

    /// P1 — Secondary conservation: sum of all transfers == P, with and without referrer.
    #[test]
    fn p1_secondary_conserves(
        shares in arb_shares(),
        royalty_bps in 100u32..=1500u32,
        price in arb_price(),
        (fee_bps, referral_bps) in arb_fee_ref(),
        with_ref in any::<bool>(),
    ) {
        let e = Env::default();
        let treasury = Address::generate(&e);
        let seller = Address::generate(&e);
        let referrer = if with_ref { Some(Address::generate(&e)) } else { None };
        let (royalties, _r) = royalty_vec(&e, price, royalty_bps, &shares);
        let out = distribute(&e, price, fee_bps, referral_bps, &treasury, &referrer,
            &DistMode::Secondary(seller, royalties)).unwrap();
        prop_assert_eq!(sum_amounts(&out), price);
    }

    /// P2 — Primary conservation: sum of all transfers == P, with and without referrer.
    #[test]
    fn p2_primary_conserves(
        shares in arb_shares(),
        price in arb_price(),
        (fee_bps, referral_bps) in arb_fee_ref(),
        with_ref in any::<bool>(),
    ) {
        let e = Env::default();
        let treasury = Address::generate(&e);
        let referrer = if with_ref { Some(Address::generate(&e)) } else { None };
        let split = recipients_from_shares(&e, &shares);
        let out = distribute(&e, price, fee_bps, referral_bps, &treasury, &referrer,
            &DistMode::Primary(split)).unwrap();
        prop_assert_eq!(sum_amounts(&out), price);
    }

    /// P4 — Treasury gets exactly `fee − referral`, referrer gets exactly `referral`,
    /// and the platform's total take is exactly `fee`.
    #[test]
    fn p4_fee_referral_split(
        shares in arb_shares(),
        price in arb_price(),
        (fee_bps, referral_bps) in arb_fee_ref(),
    ) {
        let e = Env::default();
        let treasury = Address::generate(&e);
        let referrer = Address::generate(&e);
        let split = recipients_from_shares(&e, &shares);
        let fee = price * fee_bps as i128 / 10_000;
        let referral = price * referral_bps as i128 / 10_000;

        let out = distribute(&e, price, fee_bps, referral_bps, &treasury, &Some(referrer.clone()),
            &DistMode::Primary(split)).unwrap();

        // Treasury is the first entry.
        let (t_addr, t_amt) = out.get(0).unwrap();
        prop_assert_eq!(t_addr, treasury.clone());
        prop_assert_eq!(t_amt, fee - referral);
        // Referrer gets exactly `referral`; platform total == fee.
        prop_assert_eq!(amount_of(&out, &referrer), referral);
        prop_assert_eq!(amount_of(&out, &treasury) + amount_of(&out, &referrer), fee);
    }

    /// P5 — Seller cost is invariant to the referral: for fixed P/fee/royalty, the
    /// seller remainder is identical referred or not (referral only re-routes money
    /// inside the fee).
    #[test]
    fn p5_seller_remainder_invariant_to_referral(
        shares in arb_shares(),
        royalty_bps in 100u32..=1500u32,
        price in arb_price(),
        (fee_bps, referral_bps) in arb_fee_ref_active(),
    ) {
        let e = Env::default();
        let treasury = Address::generate(&e);
        let seller = Address::generate(&e);
        let referrer = Address::generate(&e);
        let (royalties, _r) = royalty_vec(&e, price, royalty_bps, &shares);

        let no_ref: Option<Address> = None;
        let out_noref = distribute(&e, price, fee_bps, referral_bps, &treasury, &no_ref,
            &DistMode::Secondary(seller.clone(), royalties.clone())).unwrap();
        let out_ref = distribute(&e, price, fee_bps, referral_bps, &treasury, &Some(referrer),
            &DistMode::Secondary(seller.clone(), royalties)).unwrap();

        prop_assert_eq!(amount_of(&out_noref, &seller), amount_of(&out_ref, &seller));
    }

    /// P6 — Primary split: every non-last wallet gets `distributable*share/10000`,
    /// the last gets `distributable − Σ(others)` (dust on the last, never lost).
    #[test]
    fn p6_primary_last_absorbs_dust(
        shares in arb_shares(),
        price in arb_price(),
        (fee_bps, referral_bps) in arb_fee_ref(),
    ) {
        let e = Env::default();
        let treasury = Address::generate(&e);
        let split = recipients_from_shares(&e, &shares);
        let no_ref: Option<Address> = None;
        let out = distribute(&e, price, fee_bps, referral_bps, &treasury, &no_ref,
            &DistMode::Primary(split)).unwrap();

        let fee = price * fee_bps as i128 / 10_000;
        let distributable = price - fee;
        let n = shares.len() as u32;
        // No referrer ⇒ layout is [treasury, split0..split(n-1)]; split starts at index 1.
        let start = out.len() - n;
        let mut others: i128 = 0;
        for i in 0..n {
            let amount = out.get(start + i).unwrap().1;
            if i < n - 1 {
                let expected = distributable * shares[i as usize] as i128 / 10_000;
                prop_assert_eq!(amount, expected);
                others += amount;
            } else {
                prop_assert_eq!(amount, distributable - others);
            }
        }
    }

    /// P7 — Secondary pays the royalty vector verbatim, and its sum equals the
    /// royalty total the NFT computed (cross-checks the NFT's own dust handling).
    #[test]
    fn p7_pays_exact_royalty_vector(
        shares in arb_shares(),
        royalty_bps in 100u32..=1500u32,
        price in arb_price(),
        (fee_bps, referral_bps) in arb_fee_ref(),
    ) {
        let e = Env::default();
        let treasury = Address::generate(&e);
        let seller = Address::generate(&e);
        let (royalties, total) = royalty_vec(&e, price, royalty_bps, &shares);
        let no_ref: Option<Address> = None;
        let out = distribute(&e, price, fee_bps, referral_bps, &treasury, &no_ref,
            &DistMode::Secondary(seller, royalties.clone())).unwrap();

        // No referrer ⇒ layout is [treasury, royalties..., seller_remainder].
        let r = royalties.len();
        let mut r_sum: i128 = 0;
        for i in 0..r {
            let from_out = out.get(1 + i).unwrap();
            let from_roy = royalties.get(i).unwrap();
            prop_assert_eq!(from_out.0, from_roy.0);
            prop_assert_eq!(from_out.1, from_roy.1);
            r_sum += from_roy.1;
        }
        prop_assert_eq!(r_sum, total);
    }

    /// P8 — Determinism: identical inputs yield identical output vectors.
    #[test]
    fn p8_determinism(
        shares in arb_shares(),
        price in arb_price(),
        (fee_bps, referral_bps) in arb_fee_ref(),
    ) {
        let e = Env::default();
        let treasury = Address::generate(&e);
        let split = recipients_from_shares(&e, &shares);
        let referrer = Some(Address::generate(&e));

        let a = distribute(&e, price, fee_bps, referral_bps, &treasury, &referrer,
            &DistMode::Primary(split.clone())).unwrap();
        let b = distribute(&e, price, fee_bps, referral_bps, &treasury, &referrer,
            &DistMode::Primary(split)).unwrap();

        prop_assert_eq!(a.len(), b.len());
        for i in 0..a.len() {
            prop_assert_eq!(a.get(i).unwrap(), b.get(i).unwrap());
        }
    }

    /// P9 — Valid inputs never underflow: the seller remainder is always >= 0 for
    /// fee/royalty within bounds.
    #[test]
    fn p9_valid_remainder_nonneg(
        shares in arb_shares(),
        royalty_bps in 100u32..=1500u32,
        price in arb_price(),
        (fee_bps, referral_bps) in arb_fee_ref(),
    ) {
        let e = Env::default();
        let treasury = Address::generate(&e);
        let seller = Address::generate(&e);
        let (royalties, _r) = royalty_vec(&e, price, royalty_bps, &shares);
        let no_ref: Option<Address> = None;
        let out = distribute(&e, price, fee_bps, referral_bps, &treasury, &no_ref,
            &DistMode::Secondary(seller.clone(), royalties)).unwrap();
        prop_assert!(amount_of(&out, &seller) >= 0);
    }

    /// P10 — Every individual payout is non-negative (both modes, with/without referrer).
    #[test]
    fn p10_all_payouts_nonneg(
        shares in arb_shares(),
        royalty_bps in 100u32..=1500u32,
        price in arb_price(),
        (fee_bps, referral_bps) in arb_fee_ref(),
        primary in any::<bool>(),
        with_ref in any::<bool>(),
    ) {
        let e = Env::default();
        let treasury = Address::generate(&e);
        let seller = Address::generate(&e);
        let referrer = if with_ref { Some(Address::generate(&e)) } else { None };
        let out = if primary {
            distribute(&e, price, fee_bps, referral_bps, &treasury, &referrer,
                &DistMode::Primary(recipients_from_shares(&e, &shares))).unwrap()
        } else {
            let (royalties, _r) = royalty_vec(&e, price, royalty_bps, &shares);
            distribute(&e, price, fee_bps, referral_bps, &treasury, &referrer,
                &DistMode::Secondary(seller, royalties)).unwrap()
        };
        for entry in out.iter() {
            prop_assert!(entry.1 >= 0);
        }
    }

    /// P12 — Overflow safety: with `P` near `i128::MAX`, `* bps / 10000` returns a
    /// clean error instead of wrapping or panicking.
    #[test]
    fn p12_extreme_price_errors_cleanly(
        price in (i128::MAX / 2 + 1)..=i128::MAX,
        fee_bps in 3u32..=1000u32,
    ) {
        let e = Env::default();
        let treasury = Address::generate(&e);
        let split = vec![&e, RoyaltyRecipient { address: Address::generate(&e), share_bps: 10_000 }];
        let no_ref: Option<Address> = None;
        // price * fee_bps (fee_bps >= 3, price > MAX/2) overflows the checked_mul.
        let r = distribute(&e, price, fee_bps, 0, &treasury, &no_ref, &DistMode::Primary(split));
        prop_assert!(matches!(r, Err(MarketError::MathOverflow)));
    }

    /// P18 — One royalty recipient at full `royalty_bps`: conservation still holds,
    /// recipient gets the full royalty, seller gets `P − fee − royalty`.
    #[test]
    fn p18_single_royalty_recipient_conserves(
        price in arb_price(),
        royalty_bps in 100u32..=1500u32,
        (fee_bps, referral_bps) in arb_fee_ref(),
    ) {
        let e = Env::default();
        let treasury = Address::generate(&e);
        let seller = Address::generate(&e);
        let artist = Address::generate(&e);
        let total = price * royalty_bps as i128 / 10_000;
        let royalties = vec![&e, (artist.clone(), total)];
        let no_ref: Option<Address> = None;
        let out = distribute(&e, price, fee_bps, referral_bps, &treasury, &no_ref,
            &DistMode::Secondary(seller.clone(), royalties)).unwrap();

        let fee = price * fee_bps as i128 / 10_000;
        prop_assert_eq!(sum_amounts(&out), price);
        prop_assert_eq!(amount_of(&out, &artist), total);
        prop_assert_eq!(amount_of(&out, &seller), price - fee - total);
    }
}

// ============================== fixed-case properties ==============================

/// P9 — `referral_bps > fee_bps` is rejected (referral cannot exceed the fee).
#[test]
fn p9_rejects_referral_exceeding_fee() {
    let e = Env::default();
    let treasury = Address::generate(&e);
    let referrer = Address::generate(&e);
    let split = vec![&e, RoyaltyRecipient { address: Address::generate(&e), share_bps: 10_000 }];
    let r = distribute(&e, 1_000_000, 100, 101, &treasury, &Some(referrer),
        &DistMode::Primary(split));
    assert!(matches!(r, Err(MarketError::ReferralExceedsFee)));
}

/// P9 — A royalty vector that would push the remainder below zero is rejected, not
/// allowed to underflow.
#[test]
fn p9_rejects_negative_remainder() {
    let e = Env::default();
    let treasury = Address::generate(&e);
    let seller = Address::generate(&e);
    let artist = Address::generate(&e);
    // price 1000, fee 0, but royalties claim 2000 ⇒ remainder = -1000.
    let royalties = vec![&e, (artist, 2000i128)];
    let no_ref: Option<Address> = None;
    let r = distribute(&e, 1000, 0, 0, &treasury, &no_ref,
        &DistMode::Secondary(seller, royalties));
    assert!(matches!(r, Err(MarketError::RemainderNegative)));
}

/// P11 — Exactly 10 split wallets (the cap) is accepted.
#[test]
fn p11_primary_accepts_exactly_max_recipients() {
    let e = Env::default();
    let treasury = Address::generate(&e);
    let mut split: Vec<RoyaltyRecipient> = Vec::new(&e);
    for _ in 0..10 {
        split.push_back(RoyaltyRecipient { address: Address::generate(&e), share_bps: 1000 });
    }
    let no_ref: Option<Address> = None;
    let r = distribute(&e, 1_000_000, 500, 0, &treasury, &no_ref, &DistMode::Primary(split));
    assert!(r.is_ok());
}

/// P11 — 11 split wallets is rejected by the cap (shares still sum to 10000, so the
/// cap is the only reason it can fail).
#[test]
fn p11_primary_rejects_more_than_max_recipients() {
    let e = Env::default();
    let treasury = Address::generate(&e);
    let mut split: Vec<RoyaltyRecipient> = Vec::new(&e);
    for _ in 0..10 {
        split.push_back(RoyaltyRecipient { address: Address::generate(&e), share_bps: 900 });
    }
    split.push_back(RoyaltyRecipient { address: Address::generate(&e), share_bps: 1000 });
    let no_ref: Option<Address> = None;
    let r = distribute(&e, 1_000_000, 500, 0, &treasury, &no_ref, &DistMode::Primary(split));
    assert!(matches!(r, Err(MarketError::TooManySplitRecipients)));
}

/// P17 — `fee_bps = 0` ⇒ `referral_bps` must be 0 (can't carve a referral from a
/// zero fee), and a single-wallet primary split with no referrer pays exactly `P`.
#[test]
fn p17_zero_fee_pays_full_price_and_forbids_referral() {
    let e = Env::default();
    let treasury = Address::generate(&e);
    let wallet = Address::generate(&e);

    // A referral on a zero fee is rejected.
    let referrer = Address::generate(&e);
    let split1 = vec![&e, RoyaltyRecipient { address: wallet.clone(), share_bps: 10_000 }];
    let bad = distribute(&e, 1_000_000, 0, 1, &treasury, &Some(referrer),
        &DistMode::Primary(split1));
    assert!(matches!(bad, Err(MarketError::ReferralExceedsFee)));

    // fee_bps = 0, no referrer, single wallet ⇒ wallet receives exactly P.
    let price = 1_000_000i128;
    let split2 = vec![&e, RoyaltyRecipient { address: wallet.clone(), share_bps: 10_000 }];
    let no_ref: Option<Address> = None;
    let out = distribute(&e, price, 0, 0, &treasury, &no_ref, &DistMode::Primary(split2)).unwrap();
    assert_eq!(amount_of(&out, &treasury), 0);
    assert_eq!(amount_of(&out, &wallet), price);
    assert_eq!(sum_amounts(&out), price);
}

/// The objkt reference example (secondary sale): P = 100, royalty 20% (= 20),
/// fee 5%. Without a referrer the treasury keeps the full 5; with a 2% referrer
/// the referral is carved OUT of the fee, so treasury 3 + referrer 2 = the same 5.
/// The seller's 75 is identical either way. Run with `-- --nocapture` to see it.
#[test]
fn objkt_reference_example() {
    let e = Env::default();
    let treasury = Address::generate(&e);
    let seller = Address::generate(&e);
    let artist = Address::generate(&e);
    let referrer = Address::generate(&e);

    let price = 100i128;
    let fee_bps = 500u32; // 5%
    // Secondary: the NFT's get_royalty_info returns 20% of P = 20 to the artist.
    let royalties = vec![&e, (artist.clone(), 20i128)];

    // --- A) no referrer ---
    let no_ref: Option<Address> = None;
    let a = distribute(&e, price, fee_bps, 0, &treasury, &no_ref,
        &DistMode::Secondary(seller.clone(), royalties.clone())).unwrap();
    std::println!("\nobjkt example, P=100, royalty 20%, fee 5% — NO referrer:");
    std::println!("  treasury = {}", amount_of(&a, &treasury));
    std::println!("  artist   = {}", amount_of(&a, &artist));
    std::println!("  seller   = {}", amount_of(&a, &seller));
    std::println!("  total    = {}", sum_amounts(&a));
    assert_eq!(amount_of(&a, &treasury), 5);
    assert_eq!(amount_of(&a, &artist), 20);
    assert_eq!(amount_of(&a, &seller), 75);
    assert_eq!(amount_of(&a, &referrer), 0);
    assert_eq!(sum_amounts(&a), 100);

    // --- B) 2% referrer (carved out of the 5% fee) ---
    let b = distribute(&e, price, fee_bps, 200, &treasury, &Some(referrer.clone()),
        &DistMode::Secondary(seller.clone(), royalties)).unwrap();
    std::println!("objkt example, P=100, royalty 20%, fee 5% — referrer 2%:");
    std::println!("  treasury = {}", amount_of(&b, &treasury));
    std::println!("  referrer = {}", amount_of(&b, &referrer));
    std::println!("  artist   = {}", amount_of(&b, &artist));
    std::println!("  seller   = {}", amount_of(&b, &seller));
    std::println!("  total    = {}\n", sum_amounts(&b));
    assert_eq!(amount_of(&b, &treasury), 3);
    assert_eq!(amount_of(&b, &referrer), 2);
    assert_eq!(amount_of(&b, &artist), 20);
    assert_eq!(amount_of(&b, &seller), 75);
    assert_eq!(sum_amounts(&b), 100);
}

// ===================== Concrete self-checking cases (stroops) =====================
// 1 XLM = 10^7 stroops. P = 1_000_000_000 stroops = 100 XLM.

/// Secondary sale, 100 XLM, fee 5%, royalty 20%, no referrer.
#[test]
fn concrete_secondary_100xlm_no_referrer() {
    let e = Env::default();
    let treasury = Address::generate(&e);
    let seller = Address::generate(&e);
    let artist = Address::generate(&e);

    let price = 1_000_000_000i128; // 100 XLM
    let royalties = vec![&e, (artist.clone(), 200_000_000i128)]; // 20% of P
    let no_ref: Option<Address> = None;

    let out = distribute(&e, price, 500, 0, &treasury, &no_ref,
        &DistMode::Secondary(seller.clone(), royalties)).unwrap();

    assert_eq!(amount_of(&out, &treasury), 50_000_000);
    assert_eq!(amount_of(&out, &artist), 200_000_000);
    assert_eq!(amount_of(&out, &seller), 750_000_000);
    assert_eq!(sum_amounts(&out), price);
}

/// Same sale with a 2% referrer: the referral is carved out of the 5% fee, so
/// treasury 30M + referrer 20M = the same 50M; royalty and seller unchanged.
#[test]
fn concrete_secondary_100xlm_referrer_2pct() {
    let e = Env::default();
    let treasury = Address::generate(&e);
    let seller = Address::generate(&e);
    let artist = Address::generate(&e);
    let referrer = Address::generate(&e);

    let price = 1_000_000_000i128;
    let royalties = vec![&e, (artist.clone(), 200_000_000i128)];

    let out = distribute(&e, price, 500, 200, &treasury, &Some(referrer.clone()),
        &DistMode::Secondary(seller.clone(), royalties)).unwrap();

    assert_eq!(amount_of(&out, &treasury), 30_000_000);
    assert_eq!(amount_of(&out, &referrer), 20_000_000);
    assert_eq!(amount_of(&out, &artist), 200_000_000);
    assert_eq!(amount_of(&out, &seller), 750_000_000);
    assert_eq!(sum_amounts(&out), price);
}

/// Primary split of 3 wallets over a price that does not divide evenly: the first
/// two get the floor of their share, the last absorbs the rounding dust, and the
/// total closes exactly on P.
#[test]
fn concrete_primary_dust_three_wallets() {
    let e = Env::default();
    let treasury = Address::generate(&e);
    let w0 = Address::generate(&e);
    let w1 = Address::generate(&e);
    let w2 = Address::generate(&e);

    let price = 1_000_000_007i128; // not divisible by 10000 → dust
    let split = vec![
        &e,
        RoyaltyRecipient { address: w0.clone(), share_bps: 3333 },
        RoyaltyRecipient { address: w1.clone(), share_bps: 3333 },
        RoyaltyRecipient { address: w2.clone(), share_bps: 3334 },
    ];
    let no_ref: Option<Address> = None;

    // fee_bps = 0 ⇒ distributable = price; isolates the split dust.
    let out = distribute(&e, price, 0, 0, &treasury, &no_ref,
        &DistMode::Primary(split)).unwrap();

    let a0 = amount_of(&out, &w0);
    let a1 = amount_of(&out, &w1);
    let a2 = amount_of(&out, &w2);

    // Floors of the first two shares.
    assert_eq!(a0, 333_300_002);
    assert_eq!(a1, 333_300_002);
    // The last wallet absorbs the remainder (not its naive floor of 333_400_002).
    assert_eq!(a2, 333_400_003);
    assert_eq!(a2, price - a0 - a1);
    assert_eq!(amount_of(&out, &treasury), 0);
    assert_eq!(sum_amounts(&out), price);
}

/// A referrer with a zero referral (referral_bps = 0) must NOT produce a spurious
/// zero-value transfer: the referrer address does not appear in the output, and the
/// treasury keeps the whole fee. (Guards `referral > 0`, not `>= 0`.)
#[test]
fn zero_referral_emits_no_referrer_entry() {
    let e = Env::default();
    let treasury = Address::generate(&e);
    let seller = Address::generate(&e);
    let artist = Address::generate(&e);
    let referrer = Address::generate(&e);

    let price = 1_000_000_000i128;
    let royalties = vec![&e, (artist, 200_000_000i128)];
    let out = distribute(&e, price, 500, 0, &treasury, &Some(referrer.clone()),
        &DistMode::Secondary(seller, royalties)).unwrap();

    let mut referrer_entries = 0u32;
    for entry in out.iter() {
        if entry.0 == referrer {
            referrer_entries += 1;
        }
    }
    assert_eq!(referrer_entries, 0); // no entry at all, not even a zero
    assert_eq!(amount_of(&out, &treasury), 50_000_000); // treasury keeps the full fee
    assert_eq!(sum_amounts(&out), price);
}

/// A zero remainder is valid, not an error: royalty claims the entire post-fee
/// amount, the seller receives exactly 0, and the sale still conserves.
/// (Guards `remainder < 0`, not `<= 0`.)
#[test]
fn zero_remainder_is_accepted() {
    let e = Env::default();
    let treasury = Address::generate(&e);
    let seller = Address::generate(&e);
    let artist = Address::generate(&e);

    // P = 1000, fee 0, royalty = full P ⇒ remainder = 1000 − 0 − 1000 = 0.
    let price = 1000i128;
    let royalties = vec![&e, (artist.clone(), 1000i128)];
    let no_ref: Option<Address> = None;
    let out = distribute(&e, price, 0, 0, &treasury, &no_ref,
        &DistMode::Secondary(seller.clone(), royalties)).unwrap();

    assert_eq!(amount_of(&out, &seller), 0);
    assert_eq!(amount_of(&out, &artist), 1000);
    assert_eq!(sum_amounts(&out), price);
}

// ======================= Contract-level tests (buy) =======================
// A minimal mock NFT (the MockRegistry pattern): tracks ownership and serves a
// royalty for the secondary path. Lets `buy` exercise real escrow-out + royalty
// cross-contract calls without depending on the NFT crate.

#[contract]
pub struct MockNft;

#[contractimpl]
impl MockNft {
    pub fn mint(e: &Env, to: Address, token_id: u32, artist: Address, royalty_bps: u32) {
        e.storage()
            .persistent()
            .set(&(symbol_short!("OWN"), token_id), &to);
        e.storage()
            .persistent()
            .set(&(symbol_short!("ROY"), token_id), &(artist, royalty_bps));
    }
    pub fn owner_of(e: &Env, token_id: u32) -> Address {
        e.storage()
            .persistent()
            .get(&(symbol_short!("OWN"), token_id))
            .unwrap()
    }
    pub fn transfer(e: &Env, from: Address, to: Address, token_id: u32) {
        from.require_auth();
        // Realistic NFT semantics: `from` must currently own the token (panics for
        // a non-owner or a nonexistent token).
        let owner: Address = e
            .storage()
            .persistent()
            .get(&(symbol_short!("OWN"), token_id))
            .unwrap();
        assert_eq!(owner, from);
        e.storage()
            .persistent()
            .set(&(symbol_short!("OWN"), token_id), &to);
    }
    pub fn get_royalty_info(e: &Env, token_id: u32, sale_price: i128) -> Vec<(Address, i128)> {
        let (artist, bps): (Address, u32) = e
            .storage()
            .persistent()
            .get(&(symbol_short!("ROY"), token_id))
            .unwrap();
        let amount = sale_price * bps as i128 / 10_000;
        vec![e, (artist, amount)]
    }
    pub fn royalty_bps(e: &Env, token_id: u32) -> u32 {
        let (_artist, bps): (Address, u32) = e
            .storage()
            .persistent()
            .get(&(symbol_short!("ROY"), token_id))
            .unwrap();
        bps
    }
}

const FUND: i128 = 10_000_000_000; // buyer's SAC balance
const PRICE: i128 = 1_000_000_000; // 100 XLM
const FEE_BPS: u32 = 500; // 5%

struct Ctx {
    e: Env,
    mkt: Address,
    nft: Address,
    sac: Address,
    treasury: Address,
    seller: Address,
    buyer: Address,
    artist: Address,
}

/// Env + a deployed marketplace, mock NFT, and an allowlisted, funded SAC.
fn setup() -> Ctx {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let treasury = Address::generate(&e);
    let seller = Address::generate(&e);
    let buyer = Address::generate(&e);
    let artist = Address::generate(&e);

    let nft = e.register(MockNft, ());
    let sac = e.register_stellar_asset_contract_v2(admin.clone()).address();
    let mkt = e.register(MolotovMarketplace, (admin.clone(), FEE_BPS, treasury.clone()));

    token::StellarAssetClient::new(&e, &sac).mint(&buyer, &FUND);
    MolotovMarketplaceClient::new(&e, &mkt).set_allowed_currency(&sac, &true);

    Ctx { e, mkt, nft, sac, treasury, seller, buyer, artist }
}

/// Mint a token escrowed to the marketplace and seed a FixedPrice listing #0.
fn seed_listing(c: &Ctx, royalty_bps: u32, primary_split: Option<Vec<RoyaltyRecipient>>, referral_bps: u32, kind: ListingKind, currency: &Address) {
    MockNftClient::new(&c.e, &c.nft).mint(&c.mkt, &0u32, &c.artist, &royalty_bps);
    let listing = Listing {
        seller: c.seller.clone(),
        nft: c.nft.clone(),
        token_id: 0,
        price: PRICE,
        currency: currency.clone(),
        kind,
        primary_split,
        referral_bps,
        editions_total: 1,
        editions_sold: 0,
        ends_at: 0,
        status: ListingStatus::Active,
    };
    let e = &c.e;
    let mkt = c.mkt.clone();
    e.as_contract(&mkt, || {
        e.storage().persistent().set(&DataKey::Listing(0u64), &listing);
    });
}

fn bal(c: &Ctx, who: &Address) -> i128 {
    token::TokenClient::new(&c.e, &c.sac).balance(who)
}

/// P3 — Secondary sale: distribution matches `distribute`, conserves to the
/// stroop, and the marketplace keeps zero residual (no fund custody, NFT delivered).
#[test]
fn p3_secondary_buy_conserves_zero_residual() {
    let c = setup();
    seed_listing(&c, 2000, None, 200, ListingKind::FixedPrice, &c.sac);

    let no_ref: Option<Address> = None;
    MolotovMarketplaceClient::new(&c.e, &c.mkt).buy(&c.buyer, &0u64, &no_ref);

    assert_eq!(bal(&c, &c.treasury), 50_000_000); // fee 5%, no referrer
    assert_eq!(bal(&c, &c.artist), 200_000_000); // royalty 20%
    assert_eq!(bal(&c, &c.seller), 750_000_000); // remainder
    assert_eq!(bal(&c, &c.buyer), FUND - PRICE); // buyer paid exactly P
    assert_eq!(bal(&c, &c.mkt), 0); // residual zero
    assert_eq!(MockNftClient::new(&c.e, &c.nft).owner_of(&0u32), c.buyer);
}

/// P3 — Primary sale: split across two wallets after fee, conserves, zero residual.
#[test]
fn p3_primary_buy_conserves_zero_residual() {
    let c = setup();
    let w0 = Address::generate(&c.e);
    let w1 = Address::generate(&c.e);
    let split = vec![
        &c.e,
        RoyaltyRecipient { address: w0.clone(), share_bps: 6000 },
        RoyaltyRecipient { address: w1.clone(), share_bps: 4000 },
    ];
    seed_listing(&c, 1000, Some(split), 0, ListingKind::FixedPrice, &c.sac);

    let no_ref: Option<Address> = None;
    MolotovMarketplaceClient::new(&c.e, &c.mkt).buy(&c.buyer, &0u64, &no_ref);

    // distributable = P - fee = 950M; 60/40 split.
    assert_eq!(bal(&c, &c.treasury), 50_000_000);
    assert_eq!(bal(&c, &w0), 570_000_000);
    assert_eq!(bal(&c, &w1), 380_000_000);
    assert_eq!(bal(&c, &c.buyer), FUND - PRICE);
    assert_eq!(bal(&c, &c.mkt), 0);
    assert_eq!(MockNftClient::new(&c.e, &c.nft).owner_of(&0u32), c.buyer);
}

/// Referred secondary sale (objkt example on-chain): the 2% referral is carved out
/// of the 5% fee → treasury 30M + referrer 20M; royalty and seller unchanged.
#[test]
fn secondary_buy_with_referrer_splits_fee() {
    let c = setup();
    let referrer = Address::generate(&c.e);
    seed_listing(&c, 2000, None, 200, ListingKind::FixedPrice, &c.sac);

    MolotovMarketplaceClient::new(&c.e, &c.mkt).buy(&c.buyer, &0u64, &Some(referrer.clone()));

    assert_eq!(bal(&c, &c.treasury), 30_000_000);
    assert_eq!(bal(&c, &referrer), 20_000_000);
    assert_eq!(bal(&c, &c.artist), 200_000_000);
    assert_eq!(bal(&c, &c.seller), 750_000_000);
    assert_eq!(bal(&c, &c.buyer), FUND - PRICE);
    assert_eq!(bal(&c, &c.mkt), 0);
}

/// P13 — Checks-effects-interactions: the listing is Sold before any transfer, so a
/// second buy on the same listing fails (a re-entrant buy can't double-spend it).
#[test]
fn p13_second_buy_fails() {
    let c = setup();
    seed_listing(&c, 2000, None, 0, ListingKind::FixedPrice, &c.sac);
    let client = MolotovMarketplaceClient::new(&c.e, &c.mkt);
    let no_ref: Option<Address> = None;

    client.buy(&c.buyer, &0u64, &no_ref); // first succeeds
    let second = client.try_buy(&c.buyer, &0u64, &no_ref);
    assert!(second.is_err()); // listing no longer Active
}

/// P14 — Settling in a non-allowlisted currency is rejected.
#[test]
fn p14_disallowed_currency_rejected() {
    let c = setup();
    // A second SAC that is NOT allowlisted.
    let other = c.e.register_stellar_asset_contract_v2(Address::generate(&c.e)).address();
    token::StellarAssetClient::new(&c.e, &other).mint(&c.buyer, &FUND);
    seed_listing(&c, 2000, None, 0, ListingKind::FixedPrice, &other);

    let no_ref: Option<Address> = None;
    let r = MolotovMarketplaceClient::new(&c.e, &c.mkt).try_buy(&c.buyer, &0u64, &no_ref);
    assert!(r.is_err());
}

/// P15 — Self-referral (referrer == buyer): the referral is zeroed, the treasury
/// keeps the full fee, and the sale still goes through.
#[test]
fn p15_self_referral_buyer_zeroes_referral() {
    let c = setup();
    seed_listing(&c, 2000, None, 200, ListingKind::FixedPrice, &c.sac);

    MolotovMarketplaceClient::new(&c.e, &c.mkt).buy(&c.buyer, &0u64, &Some(c.buyer.clone()));

    assert_eq!(bal(&c, &c.treasury), 50_000_000); // FULL fee, not 30M
    assert_eq!(bal(&c, &c.buyer), FUND - PRICE); // no referral rebate to the buyer
    assert_eq!(bal(&c, &c.artist), 200_000_000);
    assert_eq!(bal(&c, &c.seller), 750_000_000);
    assert_eq!(bal(&c, &c.mkt), 0);
    assert_eq!(MockNftClient::new(&c.e, &c.nft).owner_of(&0u32), c.buyer); // sale completed
}

/// P15 — Self-referral (referrer == seller): likewise zeroed; the seller gets only
/// its remainder, the treasury the full fee.
#[test]
fn p15_self_referral_seller_zeroes_referral() {
    let c = setup();
    seed_listing(&c, 2000, None, 200, ListingKind::FixedPrice, &c.sac);

    MolotovMarketplaceClient::new(&c.e, &c.mkt).buy(&c.buyer, &0u64, &Some(c.seller.clone()));

    assert_eq!(bal(&c, &c.treasury), 50_000_000); // full fee
    assert_eq!(bal(&c, &c.seller), 750_000_000); // remainder only, no referral
    assert_eq!(bal(&c, &c.artist), 200_000_000);
    assert_eq!(bal(&c, &c.mkt), 0);
}

/// P16 — `Auction` listings are reserved: `buy` panics `NotImplemented`.
#[test]
fn p16_auction_buy_not_implemented() {
    let c = setup();
    seed_listing(&c, 2000, None, 0, ListingKind::Auction, &c.sac);
    let no_ref: Option<Address> = None;
    let r = MolotovMarketplaceClient::new(&c.e, &c.mkt).try_buy(&c.buyer, &0u64, &no_ref);
    assert!(r.is_err());
}

/// The `Sold` event carries the exact figures the indexer needs. With a 2%
/// referrer on a 5% fee / 20% royalty sale: royalty_paid 200M, referral_paid 20M,
/// fee_paid 50M (treasury 30M + referral 20M). Asserting the event guards the
/// event-field derivation in `buy`.
#[test]
fn sold_event_fields() {
    use soroban_sdk::{testutils::Events as _, Event as _};
    use crate::Sold;

    let c = setup();
    let referrer = Address::generate(&c.e);
    seed_listing(&c, 2000, None, 200, ListingKind::FixedPrice, &c.sac);
    MolotovMarketplaceClient::new(&c.e, &c.mkt).buy(&c.buyer, &0u64, &Some(referrer.clone()));

    let expected = Sold {
        listing_id: 0,
        token_id: 0,
        buyer: c.buyer.clone(),
        seller: c.seller.clone(),
        price: PRICE,
        currency: c.sac.clone(),
        royalty_paid: 200_000_000,
        referral_paid: 20_000_000,
        fee_paid: 50_000_000,
    }
    .to_xdr(&c.e, &c.mkt);

    let mkt_events = c.e.events().all().filter_by_contract(&c.mkt);
    assert_eq!(mkt_events, std::vec![expected]);
}

// ======================= list / cancel / open-edition =======================

use crate::{ListingCancelled, ListingCreated};

fn mkt_client(c: &Ctx) -> MolotovMarketplaceClient<'_> {
    MolotovMarketplaceClient::new(&c.e, &c.mkt)
}
fn nft_owner(c: &Ctx, token_id: u32) -> Address {
    MockNftClient::new(&c.e, &c.nft).owner_of(&token_id)
}

/// `list` (FixedPrice, secondary): escrows the token, persists Active, and emits
/// ListingCreated with the full listing.
#[test]
fn list_fixedprice_escrows_and_emits() {
    use soroban_sdk::{testutils::Events as _, Event as _};
    let c = setup();
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &0u32, &c.artist, &2000u32);
    let no_split: Option<Vec<RoyaltyRecipient>> = None;

    let id = mkt_client(&c).list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &200u32,
    );

    assert_eq!(id, 0);

    // Assert the event right after `list` — events() reflects the latest invocation.
    let expected = ListingCreated {
        listing_id: 0,
        seller: c.seller.clone(),
        nft: c.nft.clone(),
        token_id: 0,
        price: PRICE,
        currency: c.sac.clone(),
        kind: ListingKind::FixedPrice,
        editions_total: 1,
        ends_at: 0,
        referral_bps: 200,
        primary_split: None,
    }
    .to_xdr(&c.e, &c.mkt);
    let evs = c.e.events().all().filter_by_contract(&c.mkt);
    assert_eq!(evs, std::vec![expected]);

    assert_eq!(nft_owner(&c, 0), c.mkt); // escrowed into the contract
}

/// End-to-end: list then buy conserves and leaves zero residual.
#[test]
fn list_then_buy_conserves() {
    let c = setup();
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &0u32, &c.artist, &2000u32);
    let no_split: Option<Vec<RoyaltyRecipient>> = None;
    let id = mkt_client(&c).list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &0u32,
    );
    let no_ref: Option<Address> = None;
    mkt_client(&c).buy(&c.buyer, &id, &no_ref);

    assert_eq!(bal(&c, &c.treasury), 50_000_000);
    assert_eq!(bal(&c, &c.artist), 200_000_000);
    assert_eq!(bal(&c, &c.seller), 750_000_000);
    assert_eq!(bal(&c, &c.mkt), 0);
    assert_eq!(nft_owner(&c, 0), c.buyer);
}

#[test]
fn list_rejects_referral_exceeding_fee() {
    let c = setup();
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &0u32, &c.artist, &2000u32);
    let no_split: Option<Vec<RoyaltyRecipient>> = None;
    let r = mkt_client(&c).try_list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &600u32, // > fee 500
    );
    assert!(r.is_err());
}

#[test]
fn list_rejects_fee_plus_royalty_too_high() {
    let c = setup();
    // royalty 9600 + fee 500 = 10100 > 10000.
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &0u32, &c.artist, &9600u32);
    let no_split: Option<Vec<RoyaltyRecipient>> = None;
    let r = mkt_client(&c).try_list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &0u32,
    );
    assert!(r.is_err());
}

#[test]
fn list_rejects_disallowed_currency() {
    let c = setup();
    let other = c.e.register_stellar_asset_contract_v2(Address::generate(&c.e)).address();
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &0u32, &c.artist, &2000u32);
    let no_split: Option<Vec<RoyaltyRecipient>> = None;
    let r = mkt_client(&c).try_list(
        &c.seller, &c.nft, &0u32, &PRICE, &other,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &0u32,
    );
    assert!(r.is_err());
}

#[test]
fn list_rejects_bad_editions() {
    let c = setup();
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &0u32, &c.artist, &2000u32);
    let no_split: Option<Vec<RoyaltyRecipient>> = None;
    // FixedPrice must be exactly 1 edition.
    let r = mkt_client(&c).try_list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &2u32, &0u64, &no_split, &0u32,
    );
    assert!(r.is_err());
}

/// `cancel` returns the escrowed NFT to the seller, flips status (a later buy
/// fails), emits ListingCancelled, and keeps zero residual.
#[test]
fn cancel_returns_nft_and_emits() {
    use soroban_sdk::{testutils::Events as _, Event as _};
    let c = setup();
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &0u32, &c.artist, &2000u32);
    let no_split: Option<Vec<RoyaltyRecipient>> = None;
    let id = mkt_client(&c).list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &0u32,
    );
    assert_eq!(nft_owner(&c, 0), c.mkt);

    mkt_client(&c).cancel(&c.seller, &id);

    // Assert the event right after `cancel` (events() = latest invocation).
    let expected = ListingCancelled { listing_id: 0, seller: c.seller.clone() }
        .to_xdr(&c.e, &c.mkt);
    let evs = c.e.events().all().filter_by_contract(&c.mkt);
    assert_eq!(evs, std::vec![expected]);

    assert_eq!(nft_owner(&c, 0), c.seller); // returned from escrow
    assert_eq!(bal(&c, &c.mkt), 0); // residual zero

    // A cancelled listing can't be bought.
    let no_ref: Option<Address> = None;
    assert!(mkt_client(&c).try_buy(&c.buyer, &id, &no_ref).is_err());
}

#[test]
fn cancel_only_seller() {
    let c = setup();
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &0u32, &c.artist, &2000u32);
    let no_split: Option<Vec<RoyaltyRecipient>> = None;
    let id = mkt_client(&c).list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &0u32,
    );
    let stranger = Address::generate(&c.e);
    assert!(mkt_client(&c).try_cancel(&stranger, &id).is_err());
}

#[test]
fn cancel_only_active() {
    let c = setup();
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &0u32, &c.artist, &2000u32);
    let no_split: Option<Vec<RoyaltyRecipient>> = None;
    let id = mkt_client(&c).list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &0u32,
    );
    let no_ref: Option<Address> = None;
    mkt_client(&c).buy(&c.buyer, &id, &no_ref); // now Sold
    assert!(mkt_client(&c).try_cancel(&c.seller, &id).is_err());
}

/// Open edition: 3 pre-minted contiguous tokens sold from inventory. Each buy
/// conserves and hands the next token; the listing closes after the last edition.
#[test]
fn open_edition_sell_through() {
    let c = setup();
    // Pre-mint 3 contiguous tokens (0,1,2) to the seller.
    for tid in 0u32..3 {
        MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &tid, &c.artist, &1000u32);
    }
    // Primary split: 100% to the artist.
    let split = vec![&c.e, RoyaltyRecipient { address: c.artist.clone(), share_bps: 10_000 }];
    let id = mkt_client(&c).list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::OpenEdition, &3u32, &0u64, &Some(split), &0u32,
    );
    assert_eq!(nft_owner(&c, 0), c.mkt);
    assert_eq!(nft_owner(&c, 2), c.mkt);

    let no_ref: Option<Address> = None;
    let client = mkt_client(&c);
    client.buy(&c.buyer, &id, &no_ref); // edition 0
    client.buy(&c.buyer, &id, &no_ref); // edition 1
    client.buy(&c.buyer, &id, &no_ref); // edition 2 → closes

    // Each edition delivered to the buyer.
    assert_eq!(nft_owner(&c, 0), c.buyer);
    assert_eq!(nft_owner(&c, 1), c.buyer);
    assert_eq!(nft_owner(&c, 2), c.buyer);
    // Conservation across 3 sales: distributable 950M each → artist, 50M fee each.
    assert_eq!(bal(&c, &c.treasury), 150_000_000);
    assert_eq!(bal(&c, &c.artist), 2_850_000_000);
    assert_eq!(bal(&c, &c.buyer), FUND - 3 * PRICE);
    assert_eq!(bal(&c, &c.mkt), 0);
    // Inventory exhausted → further buys fail.
    assert!(client.try_buy(&c.buyer, &id, &no_ref).is_err());
}

/// Cancelling a partially-sold open edition returns only the unsold tokens.
#[test]
fn open_edition_cancel_returns_unsold() {
    let c = setup();
    for tid in 0u32..3 {
        MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &tid, &c.artist, &1000u32);
    }
    let split = vec![&c.e, RoyaltyRecipient { address: c.artist.clone(), share_bps: 10_000 }];
    let id = mkt_client(&c).list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::OpenEdition, &3u32, &0u64, &Some(split), &0u32,
    );
    let no_ref: Option<Address> = None;
    mkt_client(&c).buy(&c.buyer, &id, &no_ref); // sells edition 0

    mkt_client(&c).cancel(&c.seller, &id);

    assert_eq!(nft_owner(&c, 0), c.buyer); // sold, stays with buyer
    assert_eq!(nft_owner(&c, 1), c.seller); // unsold, returned
    assert_eq!(nft_owner(&c, 2), c.seller); // unsold, returned
    assert_eq!(bal(&c, &c.mkt), 0);
}

/// Boundary: `referral_bps == fee_bps` is allowed (referral can take the whole fee).
#[test]
fn list_allows_referral_equal_to_fee() {
    let c = setup();
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &0u32, &c.artist, &2000u32);
    let no_split: Option<Vec<RoyaltyRecipient>> = None;
    let id = mkt_client(&c).list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &FEE_BPS, // referral == fee
    );
    assert_eq!(id, 0);
}

/// Boundary: `fee_bps + royalty_bps == 10000` is allowed (remainder exactly 0).
#[test]
fn list_allows_fee_plus_royalty_equal_10000() {
    let c = setup();
    // fee 500 + royalty 9500 = 10000.
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &0u32, &c.artist, &9500u32);
    let no_split: Option<Vec<RoyaltyRecipient>> = None;
    let id = mkt_client(&c).list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &0u32,
    );
    assert_eq!(id, 0);
}

/// Listing ids are sequential: a second listing gets id 1, not a reused 0.
#[test]
fn list_ids_increment() {
    let c = setup();
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &0u32, &c.artist, &2000u32);
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &1u32, &c.artist, &2000u32);
    let no_split: Option<Vec<RoyaltyRecipient>> = None;
    let id0 = mkt_client(&c).list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &0u32,
    );
    let id1 = mkt_client(&c).list(
        &c.seller, &c.nft, &1u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &0u32,
    );
    assert_eq!(id0, 0);
    assert_eq!(id1, 1);
}

// ============================ open-edition expiry ============================

/// List an open edition of `editions` tokens (pre-minted to the seller) with the
/// given `ends_at`, 100% primary split to the artist. Returns the listing id.
fn list_oe(c: &Ctx, editions: u32, ends_at: u64) -> u64 {
    for tid in 0..editions {
        MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &tid, &c.artist, &1000u32);
    }
    let split = vec![&c.e, RoyaltyRecipient { address: c.artist.clone(), share_bps: 10_000 }];
    mkt_client(c).list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::OpenEdition, &editions, &ends_at, &Some(split), &0u32,
    )
}

/// Before the window closes, an OE buy succeeds.
#[test]
fn oe_buy_before_expiry_ok() {
    use soroban_sdk::testutils::Ledger as _;
    let c = setup();
    let id = list_oe(&c, 3, 1000);
    c.e.ledger().with_mut(|l| l.timestamp = 500);
    let no_ref: Option<Address> = None;
    mkt_client(&c).buy(&c.buyer, &id, &no_ref);
    assert_eq!(nft_owner(&c, 0), c.buyer);
}

/// At exactly `ends_at` the listing is NOT yet expired (strict `>`).
#[test]
fn oe_buy_at_expiry_boundary_ok() {
    use soroban_sdk::testutils::Ledger as _;
    let c = setup();
    let id = list_oe(&c, 3, 1000);
    c.e.ledger().with_mut(|l| l.timestamp = 1000);
    let no_ref: Option<Address> = None;
    mkt_client(&c).buy(&c.buyer, &id, &no_ref);
    assert_eq!(nft_owner(&c, 0), c.buyer);
}

/// Past `ends_at`, OE buys fail.
#[test]
fn oe_buy_after_expiry_fails() {
    use soroban_sdk::testutils::Ledger as _;
    let c = setup();
    let id = list_oe(&c, 3, 1000);
    c.e.ledger().with_mut(|l| l.timestamp = 1001);
    let no_ref: Option<Address> = None;
    assert!(mkt_client(&c).try_buy(&c.buyer, &id, &no_ref).is_err());
}

/// `ends_at == 0` means no expiry — a far-future timestamp still buys.
#[test]
fn oe_no_expiry_when_ends_at_zero() {
    use soroban_sdk::testutils::Ledger as _;
    let c = setup();
    let id = list_oe(&c, 3, 0);
    c.e.ledger().with_mut(|l| l.timestamp = 1_000_000_000);
    let no_ref: Option<Address> = None;
    mkt_client(&c).buy(&c.buyer, &id, &no_ref);
    assert_eq!(nft_owner(&c, 0), c.buyer);
}

/// After expiry the seller reclaims the unsold inventory via the existing `cancel`.
#[test]
fn oe_cancel_after_expiry_returns_unsold() {
    use soroban_sdk::testutils::Ledger as _;
    let c = setup();
    let id = list_oe(&c, 3, 1000);
    let no_ref: Option<Address> = None;

    c.e.ledger().with_mut(|l| l.timestamp = 500);
    mkt_client(&c).buy(&c.buyer, &id, &no_ref); // edition 0 sells

    c.e.ledger().with_mut(|l| l.timestamp = 2000);
    assert!(mkt_client(&c).try_buy(&c.buyer, &id, &no_ref).is_err()); // expired

    mkt_client(&c).cancel(&c.seller, &id); // reclaim unsold
    assert_eq!(nft_owner(&c, 0), c.buyer); // sold
    assert_eq!(nft_owner(&c, 1), c.seller); // returned
    assert_eq!(nft_owner(&c, 2), c.seller); // returned
    assert_eq!(bal(&c, &c.mkt), 0);
}

// ============================ privileged auth gates ============================

/// Only the owner can allowlist a currency (no auth mocked → the gate panics).
#[test]
#[should_panic]
fn set_allowed_currency_requires_owner_auth() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let treasury = Address::generate(&e);
    let mkt = e.register(MolotovMarketplace, (admin, FEE_BPS, treasury));
    let sac = Address::generate(&e);
    MolotovMarketplaceClient::new(&e, &mkt).set_allowed_currency(&sac, &true);
}

/// Only the owner can upgrade the contract (no auth mocked → the gate panics).
#[test]
#[should_panic]
fn upgrade_requires_owner_auth() {
    use soroban_sdk::BytesN;
    let e = Env::default();
    let admin = Address::generate(&e);
    let treasury = Address::generate(&e);
    let mkt = e.register(MolotovMarketplace, (admin, FEE_BPS, treasury));
    let dummy = BytesN::from_array(&e, &[0u8; 32]);
    MolotovMarketplaceClient::new(&e, &mkt).upgrade(&dummy);
}

/// The constructor stores fee and treasury (and the owner — exercised by `setup`
/// calling the owner-gated `set_allowed_currency` successfully).
#[test]
fn constructor_sets_fee_and_treasury() {
    let c = setup();
    let client = mkt_client(&c);
    assert_eq!(client.fee_bps(), FEE_BPS);
    assert_eq!(client.treasury(), c.treasury);
}

// ================= AllowedCurrency TTL bump on list/buy =================

/// `list` bumps the AllowedCurrency entry TTL on every successful read.
#[test]
fn test_list_bumps_allowed_currency_ttl() {
    use crate::{DataKey, TTL_BUMP_AMOUNT};
    use soroban_sdk::testutils::storage::Persistent as _;
    use soroban_sdk::testutils::Ledger as _;

    let c = setup();
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &0u32, &c.artist, &2000u32);

    // Advance close to expiry so the bump is measurable.
    c.e.ledger().with_mut(|l| l.sequence_number += TTL_BUMP_AMOUNT - 100);

    let no_split: Option<Vec<RoyaltyRecipient>> = None;
    mkt_client(&c).list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &0u32,
    );

    c.e.as_contract(&c.mkt, || {
        let ttl = c.e.storage().persistent().get_ttl(&DataKey::AllowedCurrency(c.sac.clone()));
        assert!(ttl >= TTL_BUMP_AMOUNT - 16, "AllowedCurrency ttl too low after list: {}", ttl);
    });
}

/// `buy` bumps the AllowedCurrency entry TTL on every successful read.
#[test]
fn test_buy_bumps_allowed_currency_ttl() {
    use crate::{DataKey, TTL_BUMP_AMOUNT};
    use soroban_sdk::testutils::storage::Persistent as _;
    use soroban_sdk::testutils::Ledger as _;

    let c = setup();
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &0u32, &c.artist, &2000u32);
    let no_split: Option<Vec<RoyaltyRecipient>> = None;
    let id = mkt_client(&c).list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &0u32,
    );

    // Advance close to expiry.
    c.e.ledger().with_mut(|l| l.sequence_number += TTL_BUMP_AMOUNT - 100);

    let no_ref: Option<Address> = None;
    mkt_client(&c).buy(&c.buyer, &id, &no_ref);

    c.e.as_contract(&c.mkt, || {
        let ttl = c.e.storage().persistent().get_ttl(&DataKey::AllowedCurrency(c.sac.clone()));
        assert!(ttl >= TTL_BUMP_AMOUNT - 16, "AllowedCurrency ttl too low after buy: {}", ttl);
    });
}

/// The marketplace survives a 30-day gap when list/buy keep the entry bumped.
#[test]
fn test_marketplace_survives_30_day_gap() {
    use crate::TTL_BUMP_AMOUNT;
    use soroban_sdk::testutils::Ledger as _;

    let c = setup();
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &0u32, &c.artist, &2000u32);
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &1u32, &c.artist, &2000u32);

    let no_split: Option<Vec<RoyaltyRecipient>> = None;

    // Advance most of the way through the initial TTL.
    c.e.ledger().with_mut(|l| l.sequence_number += TTL_BUMP_AMOUNT - 200);
    // Bump via list.
    let id = mkt_client(&c).list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &0u32,
    );

    // Advance again close to the new expiry.
    c.e.ledger().with_mut(|l| l.sequence_number += TTL_BUMP_AMOUNT - 200);
    // Second list should still succeed.
    mkt_client(&c).list(
        &c.seller, &c.nft, &1u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &0u32,
    );

    // Buy on the first listing should also succeed.
    let no_ref: Option<Address> = None;
    mkt_client(&c).buy(&c.buyer, &id, &no_ref);
    assert_eq!(nft_owner(&c, 0), c.buyer);
    assert_eq!(bal(&c, &c.treasury), 50_000_000);
}

/// Without the entry, an absent AllowedCurrency blocks the listing.
/// (Removing the entry simulates expiry, since the test env does not GC on TTL.)
#[test]
fn test_expired_entry_blocks_correctly() {
    use crate::DataKey;

    let c = setup();
    MockNftClient::new(&c.e, &c.nft).mint(&c.seller, &0u32, &c.artist, &2000u32);

    // Remove the AllowedCurrency entry to simulate TTL expiry.
    c.e.as_contract(&c.mkt, || {
        c.e.storage().persistent().remove(&DataKey::AllowedCurrency(c.sac.clone()));
    });

    let no_split: Option<Vec<RoyaltyRecipient>> = None;
    let r = mkt_client(&c).try_list(
        &c.seller, &c.nft, &0u32, &PRICE, &c.sac,
        &ListingKind::FixedPrice, &1u32, &0u64, &no_split, &0u32,
    );
    assert!(r.is_err());
}
