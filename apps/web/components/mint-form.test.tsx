// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { useWalletMock, useMintMock, pushMock, tMock } = vi.hoisted(() => ({
  useWalletMock: vi.fn(),
  useMintMock: vi.fn(),
  pushMock: vi.fn(),
  // Defaults to echoing the key, which is what most tests below rely on
  // (asserting literal key text). The "pre-submit summary" suite further
  // down overrides this to do a real lookup against the actual en.ts
  // dictionary, since that's the only way to test that {pct}/{wallet}
  // actually get substituted with real values.
  tMock: vi.fn((k: string) => k),
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
    t: tMock,
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
    errorMessageKey: null,
    progress: null,
    feeXlm: null,
    estimateFee: vi.fn(),
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
  tMock.mockImplementation((k: string) => k);

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

// ─── Pre-submit summary: real substitution, not an echoed key ────────────────
//
// Ground-truth audit gap: this block existed, was verified live once by hand,
// but had zero automated coverage. The rest of this file's `t` mock just
// echoes the key back, which can't prove {pct}/{wallet} actually get
// substituted — so this suite points `t` at the real en.ts dictionary
// instead, and asserts the exact rendered sentences an artist would read.

import { en } from "@/lib/i18n/en";
import { truncateAddress } from "@/lib/stellar";

function readPath(key: string): string {
  const value = key.split(".").reduce<unknown>((node, part) => {
    return typeof node === "object" && node !== null
      ? (node as Record<string, unknown>)[part]
      : undefined;
  }, en);
  if (typeof value !== "string") throw new Error(`Missing i18n key in en.ts: ${key}`);
  return value;
}

const WALLET = "GATESTWALLETAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("mint-form pre-submit summary — real copy, not an echoed key", () => {
  beforeEach(() => {
    tMock.mockImplementation(readPath);
    useWalletMock.mockReturnValue({ address: WALLET, isConnected: true });
  });

  function fillValidForm() {
    render(<MintForm />);
    const input = document.getElementById("mint-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("art.jpg", "image/jpeg", 1024)] } });
    const title = document.getElementById("title") as HTMLInputElement;
    fireEvent.change(title, { target: { value: "Prueba" } });
  }

  it("does not render the summary before the form is valid (no file/title yet)", () => {
    render(<MintForm />);
    expect(screen.queryByText("Before you confirm")).toBeNull();
  });

  it("shows the connected wallet as the royalty destination, truncated, once the form is valid", () => {
    fillValidForm();

    expect(screen.getByText("Before you confirm")).toBeTruthy();
    // Default royalty is 10% (mint-form.tsx's initial state) — the real
    // dictionary template with {pct} substituted, not the raw key.
    expect(screen.getByText("Royalty: 10.0%, fixed forever.")).toBeTruthy();
    expect(screen.getByText(`Goes to: ${truncateAddress(WALLET, 6, 6)}`)).toBeTruthy();
  });

  it("shows the estimated fee only once one is available, never a stale or placeholder number", () => {
    useMintMock.mockReturnValue(mintCtx({ feeXlm: null }));
    fillValidForm();
    expect(screen.queryByText(/Estimated network fee/)).toBeNull();

    cleanup();
    useMintMock.mockReturnValue(mintCtx({ feeXlm: "0.0123456" }));
    fillValidForm();
    expect(screen.getByText("Estimated network fee: ~0.0123456 XLM")).toBeTruthy();
  });

  it("multiplies the fee note by edition count when minting more than one copy", () => {
    useMintMock.mockReturnValue(mintCtx({ feeXlm: "0.0100000" }));
    fillValidForm();
    const editionsSlider = document.getElementById("editions") as HTMLInputElement;
    fireEvent.change(editionsSlider, { target: { value: "3" } });

    expect(screen.getByText("Estimated network fee: ~0.0100000 XLM × 3")).toBeTruthy();
  });

  it("always states the action is irreversible, in plain language, right before the submit button", () => {
    fillValidForm();
    expect(
      screen.getByText(
        "Tapping “Upload work” records this on Stellar. It can't be undone or edited afterwards.",
      ),
    ).toBeTruthy();
  });

  it("recomputes the royalty sentence when the artist moves the royalty slider", () => {
    fillValidForm();
    const slider = document.getElementById("royalty") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "5" } });

    expect(screen.getByText("Royalty: 5.0%, fixed forever.")).toBeTruthy();
    expect(screen.queryByText("Royalty: 10.0%, fixed forever.")).toBeNull();
  });
});
