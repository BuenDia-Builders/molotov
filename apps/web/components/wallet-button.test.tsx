// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// Hooks the component depends on are mocked so each render branch can be driven
// directly. i18n echoes the key, so assertions are on the i18n key (user-visible
// text), never on class names or specific copy.
const { usePrivyMock, useWalletMock, useWalletsMock } = vi.hoisted(() => ({
  usePrivyMock: vi.fn(),
  useWalletMock: vi.fn(),
  useWalletsMock: vi.fn(() => ({ wallets: [] })),
}));

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => usePrivyMock(),
  useWallets: () => useWalletsMock(),
}));

vi.mock("@/hooks/use-wallet", () => ({
  useWallet: () => useWalletMock(),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

import { WalletButton } from "@/components/wallet-button";

function walletCtx(over: Record<string, unknown> = {}) {
  return {
    address: null,
    isConnected: false,
    isConnecting: false,
    connect: vi.fn(),
    prewarm: vi.fn(),
    disconnect: vi.fn(),
    connectViaPrivy: vi.fn(),
    signTransaction: vi.fn(),
    ...over,
  };
}

function privyCtx(over: Record<string, unknown> = {}) {
  return {
    ready: true,
    authenticated: false,
    user: null,
    logout: vi.fn(),
    login: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  // The account panel reads Horizon for a balance; keep it off the network and
  // pending so no state update fires outside act during these render assertions.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("WalletButton render branches", () => {
  it("authenticated via Privy, no wallet: connect-wallet prompt + sign-out, and NO sign-in button", () => {
    useWalletMock.mockReturnValue(walletCtx()); // not connected
    usePrivyMock.mockReturnValue(
      privyCtx({ authenticated: true, user: { google: { email: "artist@example.com" } } }),
    );

    render(<WalletButton />);

    // The anonymous sign-in button is not shown in this state.
    expect(screen.queryByText("nav.signIn")).toBeNull();

    // Identity is shown as the trigger; open it to reveal the prompt + controls.
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("wallet.noWalletHint")).toBeTruthy();
    expect(screen.getByText("wallet.connect")).toBeTruthy();
    expect(screen.getByText("account.signOut")).toBeTruthy();
    expect(screen.queryByText("nav.signIn")).toBeNull();
  });

  it("authenticated via Privy, no wallet: names both wallets and links to them", () => {
    useWalletMock.mockReturnValue(walletCtx());
    usePrivyMock.mockReturnValue(
      privyCtx({ authenticated: true, user: { google: { email: "artist@example.com" } } }),
    );

    render(<WalletButton />);
    fireEvent.click(screen.getByRole("button"));

    // The guidance is what tells a newcomer which app to install at all.
    expect(screen.getByText("wallet.noWalletGuideLead")).toBeTruthy();
    expect(screen.getByText(/wallet\.noWalletGuideDecaf/)).toBeTruthy();
    expect(screen.getByText(/wallet\.noWalletGuideLobstr/)).toBeTruthy();

    // Links must survive a copy rewrite: assert the destinations, not the labels.
    const decaf = screen.getByRole("link", { name: "decaf.so" });
    const lobstr = screen.getByRole("link", { name: "lobstr.co" });
    expect(decaf.getAttribute("href")).toBe("https://www.decaf.so/");
    expect(lobstr.getAttribute("href")).toBe("https://lobstr.co");

    // Opening a wallet site must not hand it a reference back to this tab.
    for (const link of [decaf, lobstr]) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
  });

  it("not authenticated, no wallet: renders the sign-in button", () => {
    useWalletMock.mockReturnValue(walletCtx());
    usePrivyMock.mockReturnValue(privyCtx({ authenticated: false, user: null }));

    render(<WalletButton />);

    expect(screen.getByText("nav.signIn")).toBeTruthy();
    expect(screen.queryByText("wallet.noWalletHint")).toBeNull();
  });

  it.each([
    { label: "with Privy auth", authenticated: true, user: { google: { email: "a@b.com" } } },
    { label: "without Privy auth", authenticated: false, user: null },
  ])(
    "wallet connected via SWK ($label): renders the account panel as before",
    ({ authenticated, user }) => {
      useWalletMock.mockReturnValue(
        walletCtx({
          address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRST",
          isConnected: true,
        }),
      );
      usePrivyMock.mockReturnValue(privyCtx({ authenticated, user }));

      render(<WalletButton />);
      fireEvent.click(screen.getByRole("button")); // open the account menu

      // Account-panel content (unchanged), not the no-wallet prompt or sign-in.
      expect(screen.getByText("account.profile")).toBeTruthy();
      expect(screen.getByText("account.balance")).toBeTruthy();
      expect(screen.getByText("account.signOut")).toBeTruthy();
      expect(screen.queryByText("wallet.noWalletHint")).toBeNull();
      expect(screen.queryByText("nav.signIn")).toBeNull();
    },
  );
});
