"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isAnalyticsEnabled, trackPageview } from "@/lib/analytics";

/**
 * Captures $pageview on client-side route changes (posthog-js only captures
 * the initial full load by itself). Renders nothing; mounted once in the
 * root layout. No-op when analytics is not configured.
 */
export function AnalyticsPageview() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname && isAnalyticsEnabled()) trackPageview(pathname);
  }, [pathname]);

  return null;
}
