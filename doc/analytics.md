# Analytics — PostHog (self-hosted)

Molotov measures the purchase funnel with a **self-hosted PostHog** instance.
Self-hosted is a decision, not a default: events describe wallet behavior on a
marketplace, and that data does not leave our infrastructure. There is no
third-party cloud fallback in the code.

## Configuration

Two public env vars, both required — with either one missing, every call in
`apps/web/lib/analytics.ts` is a silent no-op and the app behaves identically:

| Variable                   | Example                          |
| -------------------------- | -------------------------------- |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://posthog.example.org`    |
| `NEXT_PUBLIC_POSTHOG_KEY`  | project API key of that instance |

Deployment options for the instance itself: PostHog's docker-compose ("hobby")
deploy on any VM is enough at our traffic. Point the env vars at it from
Vercel. Nothing else in the app changes.

`autocapture` is off — only the explicit events below are sent, plus manual
`$pageview` / `$pageleave`. Persistence is `localStorage+cookie`.

## The purchase funnel

Defined in `lib/analytics.ts` (the `AnalyticsEvent` union is the contract):

| Step | Event                | Fired from                       | Properties              |
| ---- | -------------------- | -------------------------------- | ----------------------- |
| 1    | `work_viewed`        | token page mount                 | `tokenId`, `listed`     |
| 2    | `wallet_connected`   | wallet provider, on real connect | `method` (wallet id)    |
| 3    | `purchase_signing`   | buy hook, wallet prompt up       | `listingId`, `referred` |
| 4    | `purchase_confirmed` | buy hook, tx confirmed           | `listingId`, `referred` |

Session restores do **not** fire `wallet_connected` — only a user-initiated
connection counts, so the funnel measures intent, not persistence.

## Growth events (outside the funnel)

| Event                   | Fired from                          | Properties             |
| ----------------------- | ----------------------------------- | ---------------------- |
| `work_shared`           | share button (sheet or clipboard)   | `path`, `withReferral` |
| `purchase_via_referral` | buy hook, confirmed with a referrer | `listingId`            |

`purchase_via_referral` is intentionally redundant with
`purchase_confirmed{referred:true}` — it makes the referral conversion a
first-class series without filter gymnastics on the dashboard.

## Watchpoints

- If referral-attributed volume passes ~30% with few distinct referrers,
  that is farming, not growth — lower `referral_bps` or tighten attribution.
- Funnel drop between `purchase_signing` and `purchase_confirmed` is wallet
  or UX trouble (fees, timeouts), not demand trouble. Read it with the tx
  lifecycle work, not against it.
