// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// i18n echoes the key so assertions read on the user-visible key, mirroring the
// other component tests.
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

// next/image is mocked to a plain <img> so the failure path (onError) can be
// triggered directly from a test.
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

vi.mock("@/components/buy-button", () => ({
  BuyButton: () => null,
}));

vi.mock("@/components/share-button", () => ({
  ShareButton: () => null,
}));

import { TokenView } from "@/components/token-view";

const baseMeta = {
  title: "",
  imageUrl: "",
  tags: [] as string[],
  category: null,
  license: null,
  nsfw: false,
  flashing: false,
  attributes: [] as Array<{ trait_type: string; value: string }>,
};

const baseToken = {
  token_id: 1,
  artist: "GARTIST",
  owner: "GOWNER",
  royalty_bps: 1000,
  recipients_count: 1,
};

function renderView(overrides: { imageUrl?: string } = {}) {
  render(
    <TokenView
      token={baseToken}
      listing={null}
      priceXlm={null}
      meta={{ ...baseMeta, ...overrides }}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TokenView artwork fallback", () => {
  it("shows the neutral no-image state (never the brand icon) when metadata has no image", () => {
    renderView({ imageUrl: "" });

    expect(screen.getByText("artwork.imageFallback")).toBeTruthy();
    expect(screen.queryByTestId("artwork-image")).toBeNull();
  });

  it("renders the artwork image when an image URL is present", () => {
    renderView({ imageUrl: "https://ipfs.io/ipfs/abc" });

    const img = screen.getByTestId("artwork-image");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("https://ipfs.io/ipfs/abc");
    expect(screen.queryByText("artwork.imageFallback")).toBeNull();
  });

  it("falls back to the neutral state when the image fails to load", () => {
    renderView({ imageUrl: "https://ipfs.io/ipfs/broken" });

    fireEvent.error(screen.getByTestId("artwork-image"));

    expect(screen.getByText("artwork.imageFallback")).toBeTruthy();
    expect(screen.queryByTestId("artwork-image")).toBeNull();
  });
});
