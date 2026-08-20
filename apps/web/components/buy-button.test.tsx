// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

// Hooks the component depends on are mocked so each render branch can be driven
// directly. i18n echoes the key, so assertions are on the i18n key (user-visible
// text), never on class names or specific copy.
const { useWalletMock, useBuyMock, pushMock } = vi.hoisted(() => ({
  useWalletMock: vi.fn(),
  useBuyMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("@/hooks/use-wallet", () => ({
  useWallet: () => useWalletMock(),
}));

vi.mock("@/hooks/use-buy", () => ({
  useBuy: () => useBuyMock(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

vi.mock("@/lib/referral", () => ({
  getReferralAttribution: vi.fn(() => null),
  clearReferralAttribution: vi.fn(),
}));

import { BuyButton } from "@/components/buy-button";

function buyCtx(over: Record<string, unknown> = {}) {
  return {
    buy: vi.fn(),
    state: "idle" as const,
    errorKey: null,
    txHash: null,
    reset: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  useWalletMock.mockReturnValue({ isConnected: true });
  vi.useFakeTimers();
});

afterEach(() => {
  // Restored unconditionally, even if an assertion above throws, so a fake
  // clock never leaks into the next test.
  vi.useRealTimers();
  cleanup();
  vi.clearAllMocks();
});

describe("BuyButton success state", () => {
  it("renders the confirmed state persistently, with the tx link, and never redirects", () => {
    useBuyMock.mockReturnValue(buyCtx({ state: "success", txHash: "abc123" }));

    render(<BuyButton listingId={1n} priceXlm="10" tokenId={7} />);

    expect(screen.getByText("buy.confirmed")).toBeTruthy();
    expect(screen.getByText("buy.confirmedDetail")).toBeTruthy();
    expect(screen.getByText("buy.confirmedDelay")).toBeTruthy();

    const expectedHref = "https://stellar.expert/explorer/testnet/tx/abc123";
    expect(
      (screen.getByText("buy.viewTx") as HTMLAnchorElement).closest("a")?.getAttribute("href"),
    ).toBe(expectedHref);
    expect(
      (screen.getByText("buy.viewCollection") as HTMLAnchorElement)
        .closest("a")
        ?.getAttribute("href"),
    ).toBe("/my-work");

    // No automatic redirect: advance well past the old 2s timer and assert
    // the confirmed block — heading, detail copy, and tx link — is still
    // fully on screen, with no navigation triggered. Wrapped in act() because
    // next/link's own effects (prefetch scheduling) react to the fake clock too.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByText("buy.confirmed")).toBeTruthy();
    expect(screen.getByText("buy.confirmedDetail")).toBeTruthy();
    expect(screen.getByText("buy.confirmedDelay")).toBeTruthy();
    expect(
      (screen.getByText("buy.viewTx") as HTMLAnchorElement).closest("a")?.getAttribute("href"),
    ).toBe(expectedHref);
  });

  it("omits the tx link when no txHash is available yet, but keeps the collection link", () => {
    useBuyMock.mockReturnValue(buyCtx({ state: "success", txHash: null }));

    render(<BuyButton listingId={1n} priceXlm="10" tokenId={7} />);

    expect(screen.getByText("buy.confirmed")).toBeTruthy();
    expect(screen.queryByText("buy.viewTx")).toBeNull();
    expect(
      (screen.getByText("buy.viewCollection") as HTMLAnchorElement)
        .closest("a")
        ?.getAttribute("href"),
    ).toBe("/my-work");
    expect(pushMock).not.toHaveBeenCalled();
  });
});
