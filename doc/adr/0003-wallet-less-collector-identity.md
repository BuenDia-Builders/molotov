# ADR 0003 — Wallet-less collector identity

**Status:** Accepted
**Date:** 2026-10-01

## Context

ADR 0002 decided the identity model for **artists**: royalty recipients are immutable,
so an artist must supply a portable G-address before minting (Option D). That ADR
explicitly scoped buyers out: "Buyers are unaffected: a buyer receives nothing
immutable, so a frictionless buyer path stays open."

Since then, PR #76 shipped an identity-only social login (email / Google via Privy,
`apps/web/providers/privy-provider.tsx`, `embeddedWallets: { createOnLogin: "off" }`).
It creates no keypair and persists no record anywhere in Molotov's own storage —
`useSignedIn()` (`apps/web/hooks/use-signed-in.ts`) reads only Privy's own client-side
session. Today it gates exactly one thing: the "Get Started" onboarding screen
(`apps/web/components/get-started-content.tsx`). It cannot buy, own, or appear as
anything — every write still goes through the single `signTransaction` interface
(`apps/web/providers/wallet-provider.tsx`), which requires a real signer.

The open question this ADR closes: does an email-only collector get any persistent
identity or profile, or does that stay deferred until they connect a wallet?

## Decision

**No persistent identity or profile for an email-only collector. The social login
stays onboarding-only, permanently — not just until someone gets around to building
more.**

1. Email/Google sign-in via Privy continues to create no keypair and no server-side
   record. It is a session signal for gating onboarding UI, nothing else.
2. There is no profile page, handle, or any identity surface for a collector who
   hasn't connected a wallet. `/artist/[slug]`-style resolution stays G-address-only.
3. Any action that requires identity — appearing as a buyer or owner, placing a bid,
   receiving a token — requires a connected wallet first, the same signer path ADR
   0002 already established for artists. Buyers are not constrained to a G-address the
   way royalty recipients are (nothing immutable is at stake for a buyer), so a future
   smart-account signer remains open to them without reopening this decision.
4. No second identity system is introduced to reconcile later. An email session and a
   connected wallet are never merged into one record — there is nothing to merge,
   because the email session never held anything.

This is a decision to keep doing exactly what the code already does, made explicit so
it isn't accidentally reopened as a side effect of some other feature ("let's give
email users a lightweight profile while we're at it").

## What would reopen this

If a real product need emerges for a wallet-less collector to retain state across
visits (saved favorites, a wishlist) that's worth more engineering than `localStorage`
can give, that is a new, narrower decision — not an identity/profile system, and not
in scope here.

## Consequences

- [ ] None — this ratifies current behavior. No code changes implied.
- [ ] Closes the open question from issue #78.
