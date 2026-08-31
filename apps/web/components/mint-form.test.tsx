// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { useWalletMock, useMintMock, pushMock } = vi.hoisted(() => ({
  useWalletMock: vi.fn(),
  useMintMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("@/hooks/use-wallet", () => ({
  useWallet: () => useWalletMock(),
}));

vi.mock("@/hooks/use-mint", () => ({
  useMint: () => useMintMock(),
  MAX_EDITIONS: 10,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (k: string) => k,
    locale: "en",
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { MintForm } from "@/components/mint-form";

/** Returns a useMint return value in the idle state (the form renders). */
function mintCtx(over: Record<string, unknown> = {}) {
  return {
    mint: vi.fn(),
    state: "idle" as const,
    errorKind: null,
    progress: null,
    reset: vi.fn(),
    ...over,
  };
}

/** Creates a File whose type or size triggers a validation error. */
function makeFile(name: string, type: string, sizeBytes: number): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

const OVERSIZED = 31 * 1024 * 1024; // 31 MB — just above the 30 MB limit

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  useWalletMock.mockReturnValue({ address: "GCTEST", isConnected: true });
  useMintMock.mockReturnValue(mintCtx());

  // jsdom does not implement the File/Blob object-URL APIs; stub them so tests
  // that accept a valid file (which calls URL.createObjectURL) don't throw.
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ─── ARIA: error paragraph ───────────────────────────────────────────────────

describe("mint-form error ARIA attributes", () => {
  it("renders no error element when no file has been chosen", () => {
    render(<MintForm />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.getElementById("mint-file-error")).toBeNull();
  });

  it("shows an alert with id=mint-file-error when an unsupported file type is dropped", () => {
    render(<MintForm />);

    const input = document.getElementById("mint-file-input") as HTMLInputElement;
    expect(input).not.toBeNull();

    fireEvent.change(input, {
      target: { files: [makeFile("art.bmp", "image/bmp", 1024)] },
    });

    const errorEl = screen.getByRole("alert");
    expect(errorEl).not.toBeNull();
    expect(errorEl.id).toBe("mint-file-error");
    // i18n mock echoes the key
    expect(errorEl.textContent).toBe("mint.errors.unsupportedFormat");
  });

  it("sets aria-live='polite' on the error element", () => {
    render(<MintForm />);

    const input = document.getElementById("mint-file-input") as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile("art.bmp", "image/bmp", 1024)] },
    });

    const errorEl = document.getElementById("mint-file-error");
    expect(errorEl?.getAttribute("aria-live")).toBe("polite");
  });

  it("shows an alert when the file exceeds the size limit", () => {
    render(<MintForm />);

    const input = document.getElementById("mint-file-input") as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile("huge.jpg", "image/jpeg", OVERSIZED)] },
    });

    const errorEl = screen.getByRole("alert");
    expect(errorEl.id).toBe("mint-file-error");
    expect(errorEl.textContent).toBe("mint.errors.tooLarge");
  });

  it("clears the error element after a valid file is chosen", () => {
    render(<MintForm />);

    const input = document.getElementById("mint-file-input") as HTMLInputElement;

    // First trigger an error …
    fireEvent.change(input, {
      target: { files: [makeFile("art.bmp", "image/bmp", 1024)] },
    });
    expect(screen.getByRole("alert")).not.toBeNull();

    // … then replace with a valid file.
    fireEvent.change(input, {
      target: { files: [makeFile("art.jpg", "image/jpeg", 1024)] },
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.getElementById("mint-file-error")).toBeNull();
  });
});

// ─── ARIA: file input describedby ────────────────────────────────────────────

describe("mint-form file input aria-describedby", () => {
  it("file input has no aria-describedby when there is no error", () => {
    render(<MintForm />);

    const input = document.getElementById("mint-file-input") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("file input gains aria-describedby='mint-file-error' when an error is shown", () => {
    render(<MintForm />);

    const input = document.getElementById("mint-file-input") as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile("art.bmp", "image/bmp", 1024)] },
    });

    expect(input.getAttribute("aria-describedby")).toBe("mint-file-error");
  });

  it("aria-describedby is removed after the error is cleared by a valid file", () => {
    render(<MintForm />);

    const input = document.getElementById("mint-file-input") as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [makeFile("art.bmp", "image/bmp", 1024)] },
    });
    expect(input.getAttribute("aria-describedby")).toBe("mint-file-error");

    fireEvent.change(input, {
      target: { files: [makeFile("art.jpg", "image/jpeg", 1024)] },
    });
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("aria-describedby id resolves to the visible error element (referential integrity)", () => {
    render(<MintForm />);

    const input = document.getElementById("mint-file-input") as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile("art.bmp", "image/bmp", 1024)] },
    });

    const describedById = input.getAttribute("aria-describedby");
    expect(describedById).not.toBeNull();

    const referenced = document.getElementById(describedById!);
    expect(referenced).not.toBeNull();
    expect(referenced?.getAttribute("role")).toBe("alert");
  });
});
