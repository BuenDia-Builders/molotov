import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TokenCard } from "./TokenCard";

describe("TokenCard", () => {
  const baseProps = {
    tokenId: 42,
    tokenUri: "ipfs://QmTest123/image.png",
    owner: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    artist: "GBBDZ3Z2Z2Z2Z2Z2Z2Z2Z2Z2Z2Z2Z2Z2Z2Z2Z2Z2Z2Z2Z2Z2Z2Z2Z",
    royaltyBps: 1000,
  };

  it("renders NFT image with resolved IPFS gateway URL", () => {
    render(<TokenCard {...baseProps} />);
    const img = screen.getByAltText("Token #42");
    expect(img).toBeInTheDocument();
    // Next.js Image renders as img with src
    expect(img.tagName.toLowerCase()).toBe("img");
  });

  it("displays zero-padded token ID", () => {
    render(<TokenCard {...baseProps} />);
    expect(screen.getByText("#0042")).toBeInTheDocument();
  });

  it("displays royalty badge as percentage", () => {
    render(<TokenCard {...baseProps} />);
    expect(screen.getByText("10% royalty")).toBeInTheDocument();
  });

  it("truncates artist address", () => {
    render(<TokenCard {...baseProps} />);
    expect(screen.getByText("GBBD…2Z2Z")).toBeInTheDocument();
  });

  it("does not render price or Buy CTA when price is undefined", () => {
    render(<TokenCard {...baseProps} />);
    expect(screen.queryByText(/XLM/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /buy/i })).not.toBeInTheDocument();
  });

  it("renders price in XLM and Buy CTA when price is provided", () => {
    render(<TokenCard {...baseProps} price="500000000" />); // 50 XLM in stroops
    expect(screen.getByText("50 XLM")).toBeInTheDocument();
    const buyLink = screen.getByRole("link", { name: /buy/i });
    expect(buyLink).toHaveAttribute("href", "/token/42");
  });

  it("resolves HTTP URIs without transformation", () => {
    render(<TokenCard {...baseProps} tokenUri="https://example.com/image.png" />);
    const img = screen.getByAltText("Token #42");
    expect(img).toBeInTheDocument();
  });

  it("handles short addresses without truncation", () => {
    render(<TokenCard {...baseProps} artist="GABC" />);
    expect(screen.getByText("GABC")).toBeInTheDocument();
  });

  it("pads token IDs less than 4 digits", () => {
    render(<TokenCard {...baseProps} tokenId={7} />);
    expect(screen.getByText("#0007")).toBeInTheDocument();
  });

  it("handles token IDs at exactly 4 digits", () => {
    render(<TokenCard {...baseProps} tokenId={9999} />);
    expect(screen.getByText("#9999")).toBeInTheDocument();
  });
});