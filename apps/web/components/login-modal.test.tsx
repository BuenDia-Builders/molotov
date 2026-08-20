// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

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

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

import { LoginModal } from "@/components/login-modal";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LoginModal", () => {
  it("email login does not connect a wallet", () => {
    const login = vi.fn();
    const connect = vi.fn();
    const onClose = vi.fn();
    useWalletMock.mockReturnValue({ connect });
    usePrivyMock.mockReturnValue({ login, authenticated: false });

    render(<LoginModal open onClose={onClose} />);

    fireEvent.click(screen.getByText("auth.email"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith({ loginMethods: ["email"] });
    expect(connect).not.toHaveBeenCalled();
  });

  it("does not call login if already authenticated", () => {
    const login = vi.fn();
    useWalletMock.mockReturnValue({ connect: vi.fn() });
    usePrivyMock.mockReturnValue({ login, authenticated: true });

    render(<LoginModal open onClose={() => {}} />);
    fireEvent.click(screen.getByText("auth.email"));

    expect(login).not.toHaveBeenCalled();
  });
});
