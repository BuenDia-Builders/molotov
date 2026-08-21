// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// i18n echoes the key, so assertions are on the i18n key (user-visible text),
// never on class names or specific copy.
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "es" }),
}));

import { EventContent } from "@/components/event-content";

afterEach(() => {
  cleanup();
});

describe("EventContent", () => {
  it("renders both QR codes as committed static images, not runtime-generated", () => {
    render(<EventContent />);

    const wallet = screen.getByAltText("event.qrWalletAlt") as HTMLImageElement;
    const molotov = screen.getByAltText("event.qrMolotovAlt") as HTMLImageElement;

    expect(wallet.src).toContain("qr-wallet.png");
    expect(molotov.src).toContain("qr-molotov.png");
  });

  it("renders the three-step guide in order", () => {
    render(<EventContent />);

    const steps = [
      "event.steps.step1Title",
      "event.steps.step2Title",
      "event.steps.step3Title",
    ].map((key) => screen.getByText(key));

    expect(steps).toHaveLength(3);
  });
});
