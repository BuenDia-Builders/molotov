"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallet } from "@/hooks/use-wallet";

/** Email on the Privy user, if they signed in with email or Google. */
export function privyIdentityEmail(user: {
  email?: { address?: string } | null;
  google?: { email?: string } | null;
} | null | undefined): string | null {
  return user?.email?.address ?? user?.google?.email ?? null;
}

/** Connected wallet, or a Privy email/Google session. */
export function useSignedIn(): boolean {
  const { isConnected } = useWallet();
  const { authenticated, user } = usePrivy();
  return isConnected || (authenticated && !!privyIdentityEmail(user));
}
