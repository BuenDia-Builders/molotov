"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallet } from "@/hooks/use-wallet";

type PrivyIdentityUser = {
  email?: { address?: string } | null;
  google?: { email?: string } | null;
} | null;

/**
 * Email (or Google email) attached to a Privy session. Identity only — this is
 * not a signing key and must not be treated as a Stellar address.
 */
export function privyIdentityEmail(user: PrivyIdentityUser | undefined): string | null {
  return user?.email?.address ?? user?.google?.email ?? null;
}

/**
 * App-level session: a signing wallet OR identity-only Privy (email / Google).
 * Mint, list and buy still require `useWallet().isConnected` — a collector
 * receives nothing immutable, so email-only is enough to browse
 * (doc/adr/0002, Option D).
 */
export function useSignedIn(): boolean {
  const { isConnected } = useWallet();
  const { authenticated, user } = usePrivy();
  return isConnected || (authenticated && !!privyIdentityEmail(user));
}
