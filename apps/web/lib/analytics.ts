"use client";

/**
 * PostHog wrapper — the only file that talks to posthog-js.
 *
 * Self-hosted by design: events go to OUR instance, never to a third-party
 * cloud by default. Both env vars must be set or every call is a silent
 * no-op, so the app works identically with analytics off (local dev, forks,
 * privacy-minded deployments).
 *
 *   NEXT_PUBLIC_POSTHOG_HOST  e.g. https://posthog.molotov.example
 *   NEXT_PUBLIC_POSTHOG_KEY   the project API key of that instance
 *
 * The funnel and event names are documented in doc/analytics.md. Keep the
 * union below in sync with it — the type is the contract.
 */

import posthog from "posthog-js";

export type AnalyticsEvent =
  /** A work page was opened. First step of the purchase funnel. */
  | "work_viewed"
  /** A wallet finished connecting (any method). */
  | "wallet_connected"
  /** The buyer clicked buy and the wallet prompt is up. */
  | "purchase_signing"
  /** The purchase transaction was confirmed. End of the funnel. */
  | "purchase_confirmed"
  /** A confirmed purchase carried a referrer — the referral got paid. */
  | "purchase_via_referral"
  /** The share button was used (native sheet or clipboard). */
  | "work_shared";

type AnalyticsProps = Record<string, string | number | boolean | null>;

const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "";
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";

let initialized = false;

export function isAnalyticsEnabled(): boolean {
  return Boolean(HOST && KEY && typeof window !== "undefined");
}

function ensureInit(): boolean {
  if (!isAnalyticsEnabled()) return false;
  if (!initialized) {
    posthog.init(KEY, {
      api_host: HOST,
      // AnalyticsPageview captures $pageview manually for the initial load
      // AND client-side route changes; the automatic capture would
      // double-count the first one.
      capture_pageview: false,
      capture_pageleave: true,
      persistence: "localStorage+cookie",
      autocapture: false,
    });
    initialized = true;
  }
  return true;
}

/** Fire-and-forget event capture; never throws, no-op without config. */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  try {
    if (!ensureInit()) return;
    posthog.capture(event, props);
  } catch {
    /* analytics must never break the app */
  }
}

/** Manual $pageview for client-side route changes. */
export function trackPageview(path: string): void {
  try {
    if (!ensureInit()) return;
    posthog.capture("$pageview", { $current_url: window.location.origin + path });
  } catch {
    /* ignore */
  }
}
