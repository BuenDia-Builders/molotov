// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";

const { usePrivyMock, useWalletMock } = vi.hoisted(() => ({
  usePrivyMock: vi.fn(),
  useWalletMock: vi.fn(),
}));

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => usePrivyMock(),
}));

vi.mock("@/hooks/use-wallet", () => ({
  useWallet: () => useWalletMock(),
}));

import { privyIdentityEmail, useSignedIn } from "@/hooks/use-signed-in";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("privyIdentityEmail", () => {
  it("prefers the email address, then Google, and never invents a key", () => {
    expect(privyIdentityEmail({ email: { address: "collector@example.com" } })).toBe(
      "collector@example.com",
    );
    expect(privyIdentityEmail({ google: { email: "a@b.com" } })).toBe("a@b.com");
    expect(
      privyIdentityEmail({
        email: { address: "collector@example.com" },
        google: { email: "a@b.com" },
      }),
    ).toBe("collector@example.com");
    expect(privyIdentityEmail(null)).toBe(null);
    expect(privyIdentityEmail(undefined)).toBe(null);
  });
});

describe("useSignedIn", () => {
  it("is true with a connected wallet", () => {
    useWalletMock.mockReturnValue({ isConnected: true });
    usePrivyMock.mockReturnValue({ authenticated: false, user: null });
    expect(renderHook(() => useSignedIn()).result.current).toBe(true);
  });

  it("is true with email identity and no wallet — collectors can browse", () => {
    useWalletMock.mockReturnValue({ isConnected: false });
    usePrivyMock.mockReturnValue({
      authenticated: true,
      user: { email: { address: "collector@example.com" } },
    });
    expect(renderHook(() => useSignedIn()).result.current).toBe(true);
  });

  it("is true with Google identity and no wallet", () => {
    useWalletMock.mockReturnValue({ isConnected: false });
    usePrivyMock.mockReturnValue({
      authenticated: true,
      user: { google: { email: "a@b.com" } },
    });
    expect(renderHook(() => useSignedIn()).result.current).toBe(true);
  });

  it("is false when neither wallet nor Privy identity is present", () => {
    useWalletMock.mockReturnValue({ isConnected: false });
    usePrivyMock.mockReturnValue({ authenticated: false, user: null });
    expect(renderHook(() => useSignedIn()).result.current).toBe(false);
  });
});
