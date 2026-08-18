// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const { useSignedInMock } = vi.hoisted(() => ({
  useSignedInMock: vi.fn(),
}));

vi.mock("@/hooks/use-signed-in", () => ({
  useSignedIn: () => useSignedInMock(),
}));

vi.mock("@/components/wallet-button", () => ({
  WalletButton: () => <div>wallet</div>,
}));

vi.mock("@/components/search-box", () => ({
  SearchBox: () => null,
}));

vi.mock("@/components/create-menu", () => ({
  CreateMenu: () => null,
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

import { Nav } from "@/components/nav";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Nav", () => {
  it("hides Empezar once signed in without a wallet — collectors can browse", () => {
    useSignedInMock.mockReturnValue(true);
    render(<Nav />);
    expect(screen.queryByText("nav.start")).toBeNull();
  });

  it("shows Empezar when signed out", () => {
    useSignedInMock.mockReturnValue(false);
    render(<Nav />);
    expect(screen.getByText("nav.start").closest("a")?.getAttribute("href")).toBe("/get-started");
  });
});
