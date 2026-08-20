// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const { useSignedInMock } = vi.hoisted(() => ({
  useSignedInMock: vi.fn(),
}));

vi.mock("@/hooks/use-signed-in", () => ({
  useSignedIn: () => useSignedInMock(),
}));

vi.mock("@/components/login-modal", () => ({
  LoginModal: () => null,
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

import { GetStartedContent } from "@/components/get-started-content";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GetStartedContent", () => {
  it("links to /works when already signed in", () => {
    useSignedInMock.mockReturnValue(true);
    render(<GetStartedContent />);
    expect(screen.queryByText("getStarted.cta")).toBeNull();
    expect(screen.getByText("getStarted.ctaConnected").closest("a")?.getAttribute("href")).toBe(
      "/works",
    );
  });

  it("shows the sign-up button when signed out", () => {
    useSignedInMock.mockReturnValue(false);
    render(<GetStartedContent />);
    expect(screen.getByText("getStarted.cta")).toBeTruthy();
    expect(screen.queryByText("getStarted.ctaConnected")).toBeNull();
  });
});
