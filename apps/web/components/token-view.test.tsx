// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// i18n echoes the key so assertions land on the copy key (the user-visible text is
// whatever that key resolves to in either dictionary), mirroring the other component
// tests. next/image is reduced to a plain <img> so the failed-load path can be
// driven directly from a test.
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img data-testid="artwork-image" src={src} alt={alt} onError={onError} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/buy-button", () => ({ BuyButton: () => null }));
vi.mock("@/components/share-button", () => ({ ShareButton: () => null }));

import { TokenView, type TokenMeta } from "@/components/token-view";

const meta = (over: Partial<TokenMeta> = {}): TokenMeta => ({
  title: "Untitled",
  imageUrl: "",
  tags: [],
  category: null,
  license: null,
  nsfw: false,
  flashing: false,
  attributes: [],
  ...over,
});

const token = {
  token_id: 7,
  artist: "GARTIST",
  owner: "GOWNER",
  royalty_bps: 1000,
  recipients_count: 1,
};

function renderView(over: Partial<TokenMeta> = {}) {
  render(
    <TokenView token={token} listing={null} priceXlm={null} priceUsd={null} meta={meta(over)} />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TokenView artwork", () => {
  it("shows the neutral empty state when the work has no image", () => {
    renderView({ imageUrl: "" });

    expect(screen.getByText("artwork.imageFallback")).toBeTruthy();
    expect(screen.queryByTestId("artwork-image")).toBeNull();
  });

  it("never renders the brand mark as artwork", () => {
    renderView({ imageUrl: "" });

    const brandImgs = Array.from(document.querySelectorAll("img")).filter((img) =>
      (img.getAttribute("src") ?? "").includes("icon-512"),
    );
    expect(brandImgs.length).toBe(0);
    expect(document.querySelector("img")).toBeNull();
  });

  it("renders the real artwork when an image URL is present", () => {
    renderView({ imageUrl: "https://ipfs.io/ipfs/QmAbC" });

    const img = screen.getByTestId("artwork-image");
    expect(img.getAttribute("src")).toBe("https://ipfs.io/ipfs/QmAbC");
    expect(screen.queryByText("artwork.imageFallback")).toBeNull();
  });

  it("swaps to the empty state when the image fails to load", () => {
    renderView({ imageUrl: "https://ipfs.io/ipfs/QmGone" });

    fireEvent.error(screen.getByTestId("artwork-image"));

    expect(screen.getByText("artwork.imageFallback")).toBeTruthy();
    expect(screen.queryByTestId("artwork-image")).toBeNull();
  });

  it("does not veil an empty frame behind the sensitive-work reveal", () => {
    renderView({ imageUrl: "", nsfw: true });

    expect(screen.queryByText("tokenPage.sensitiveShow")).toBeNull();
    expect(screen.getByText("artwork.imageFallback")).toBeTruthy();
  });

  it("still veils a loaded sensitive work", () => {
    renderView({ imageUrl: "https://ipfs.io/ipfs/QmAbC", nsfw: true });

    expect(screen.getByText("tokenPage.sensitiveShow")).toBeTruthy();
    expect(screen.queryByText("artwork.imageFallback")).toBeNull();
  });
});
