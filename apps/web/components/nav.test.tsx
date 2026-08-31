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
  it("hides the start link when signed in", () => {
    useSignedInMock.mockReturnValue(true);
    render(<Nav />);
    expect(screen.queryByText("nav.start")).toBeNull();
  });

  it("shows the start link when signed out", () => {
    useSignedInMock.mockReturnValue(false);
    render(<Nav />);
    expect(screen.getByText("nav.start").closest("a")?.getAttribute("href")).toBe("/get-started");
  });

  it("surfaces the primary nav quick links with the right targets", () => {
    useSignedInMock.mockReturnValue(false);
    render(<Nav />);
    const artists = screen.getByRole("link", { name: "nav.artists" });
    expect(artists.getAttribute("href")).toBe("/artists");
    const manifesto = screen.getByRole("link", { name: "nav.manifesto" });
    expect(manifesto.getAttribute("href")).toBe("/#manifesto");
  });
});
