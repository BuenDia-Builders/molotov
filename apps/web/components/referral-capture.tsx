"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { isValidReferrer, saveReferralAttribution } from "@/lib/referral";

/**
 * Reads `?r=<G...>` from the URL and persists the referral attribution.
 * Renders nothing. Mount inside a <Suspense> boundary (useSearchParams).
 * Pass `tokenId` on a work page; omit it on profile or other pages so the
 * attribution lands on the site-wide fallback.
 */
export function ReferralCapture({ tokenId }: { tokenId?: number }) {
  const searchParams = useSearchParams();
  const referrer = searchParams.get("r");

  useEffect(() => {
    if (referrer && isValidReferrer(referrer)) {
      saveReferralAttribution(referrer, tokenId);
    }
  }, [referrer, tokenId]);

  return null;
}
