"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/** First step of the purchase funnel: a work page was opened. Renders nothing. */
export function WorkViewTracker({ tokenId, listed }: { tokenId: number; listed: boolean }) {
  useEffect(() => {
    track("work_viewed", { tokenId, listed });
  }, [tokenId, listed]);

  return null;
}
