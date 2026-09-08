// @vitest-environment jsdom
//
// Hook-level tests for useBuy — same standard as use-mint.test.ts: the real
// `contractErrorKey` and `isUserRejection` run against errors the hook
// actually throws/catches; only reconcileTransaction is mocked (to control
// SUCCESS/FAILED/NOT_FOUND deterministically without a live RPC call).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const { useWalletMock, buyFnMock, reconcileTransactionMock, trackMock } = vi.hoisted(() => ({
  useWalletMock: vi.fn(),
  buyFnMock: vi.fn(),
  reconcileTransactionMock: vi.fn(),
  trackMock: vi.fn(),
}));

vi.mock("@/hooks/use-wallet", () => ({
  useWallet: () => useWalletMock(),
}));

vi.mock("@molotov/stellar-client/molotov-marketplace", () => ({
  Client: vi.fn().mockImplementation(() => ({ buy: buyFnMock })),
  networks: {
    testnet: {
      contractId: "CTESTMARKET",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
}));

vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

// Partial mock, same reasoning as use-mint.test.ts: isUserRejection stays real.
vi.mock("@/lib/stellar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stellar")>();
  return {
    ...actual,
    reconcileTransaction: (...args: unknown[]) => reconcileTransactionMock(...args),
  };
});

import { useBuy } from "@/hooks/use-buy";
import { stroopsToXlm } from "@/lib/stroops";

const ADDRESS = "GATESTBUYERADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const SELLER = "GATESTSELLERADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

beforeEach(() => {
  useWalletMock.mockReturnValue({
    address: ADDRESS,
    signTransaction: vi.fn(async (xdr: string) => xdr),
  });
  sessionStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Fee estimate ─────────────────────────────────────────────────────────

describe("useBuy — estimateFee", () => {
  it("reads the fee straight off the simulated transaction's built envelope", async () => {
    buyFnMock.mockResolvedValue({ built: { fee: "54321" } });
    const { result } = renderHook(() => useBuy());

    await act(async () => {
      await result.current.estimateFee(7n);
    });

    expect(result.current.feeXlm).toBe(stroopsToXlm("54321"));
    expect(buyFnMock).toHaveBeenCalledWith(
      expect.objectContaining({ buyer: ADDRESS, listing_id: 7n, referrer: undefined }),
    );
  });

  it("fails silently when the simulation itself fails", async () => {
    buyFnMock.mockRejectedValue(new Error("simulation unavailable"));
    const { result } = renderHook(() => useBuy());

    await act(async () => {
      await result.current.estimateFee(7n);
    });

    expect(result.current.feeXlm).toBeNull();
  });

  it("does nothing without a connected wallet", async () => {
    useWalletMock.mockReturnValue({ address: null, signTransaction: vi.fn() });
    const { result } = renderHook(() => useBuy());

    await act(async () => {
      await result.current.estimateFee(7n);
    });

    expect(buyFnMock).not.toHaveBeenCalled();
  });
});

// ─── Wallet-connection gating ───────────────────────────────────────────────

describe("useBuy — wallet connection gating", () => {
  it("refuses to buy without a connected wallet", async () => {
    useWalletMock.mockReturnValue({ address: null, signTransaction: vi.fn() });
    const { result } = renderHook(() => useBuy());

    await expect(result.current.buy({ listingId: 1n })).rejects.toThrow("No wallet connected");
    expect(buyFnMock).not.toHaveBeenCalled();
  });
});

// ─── Success path ────────────────────────────────────────────────────────

describe("useBuy — success path", () => {
  it("buys and reaches success with the real tx hash", async () => {
    buyFnMock.mockResolvedValue({
      built: { fee: "100" },
      signAndSend: vi.fn(
        async ({ watcher }: { watcher: { onSubmitted: (r: unknown) => void } }) => {
          watcher.onSubmitted({ hash: "BUY_HASH" });
          return { sendTransactionResponse: { hash: "BUY_HASH" } };
        },
      ),
    });

    const { result } = renderHook(() => useBuy());
    let buyResult: Awaited<ReturnType<typeof result.current.buy>> | undefined;
    await act(async () => {
      buyResult = await result.current.buy({ listingId: 5n });
    });

    expect(buyResult).toEqual({ txHash: "BUY_HASH" });
    expect(result.current.state).toBe("success");
    expect(result.current.txHash).toBe("BUY_HASH");
    expect(trackMock).toHaveBeenCalledWith(
      "purchase_confirmed",
      expect.objectContaining({ listingId: "5" }),
    );
  });

  it("drops a self-referral before it ever reaches the contract call", async () => {
    buyFnMock.mockResolvedValue({
      built: { fee: "100" },
      signAndSend: vi.fn(async () => ({ sendTransactionResponse: { hash: "H" } })),
    });
    const { result } = renderHook(() => useBuy());

    await act(async () => {
      await result.current.buy({ listingId: 1n, referrer: ADDRESS });
    });

    expect(buyFnMock).toHaveBeenCalledWith(expect.objectContaining({ referrer: undefined }));
    expect(trackMock).not.toHaveBeenCalledWith("purchase_via_referral", expect.anything());
  });

  it("keeps a real referrer and tracks the referred purchase", async () => {
    buyFnMock.mockResolvedValue({
      built: { fee: "100" },
      signAndSend: vi.fn(async () => ({ sendTransactionResponse: { hash: "H" } })),
    });
    const { result } = renderHook(() => useBuy());

    await act(async () => {
      await result.current.buy({ listingId: 1n, referrer: SELLER });
    });

    expect(buyFnMock).toHaveBeenCalledWith(expect.objectContaining({ referrer: SELLER }));
    expect(trackMock).toHaveBeenCalledWith(
      "purchase_via_referral",
      expect.objectContaining({ listingId: "1" }),
    );
  });
});

// ─── Contract-error decoding — the real wiring ─────────────────────────────

describe("useBuy — contractErrorKey wiring in the real catch path", () => {
  it("decodes a real ListingNotActive panic via the hook's own catch", async () => {
    buyFnMock.mockResolvedValue({
      built: { fee: "100" },
      signAndSend: vi.fn(async () => {
        throw new Error("HostError: Error(Contract, #11)");
      }),
    });

    const { result } = renderHook(() => useBuy());
    await act(async () => {
      await expect(result.current.buy({ listingId: 3n })).rejects.toThrow();
    });

    expect(result.current.errorKey).toBe("transaction.errors.listingNotActive");
    expect(result.current.state).toBe("error");
    expect(reconcileTransactionMock).not.toHaveBeenCalled();
  });

  it("treats a wallet rejection as 'rejected', never as a decoded contract error", async () => {
    buyFnMock.mockResolvedValue({
      built: { fee: "100" },
      signAndSend: vi.fn(async () => {
        throw new Error("Request denied by user");
      }),
    });

    const { result } = renderHook(() => useBuy());
    await act(async () => {
      await expect(result.current.buy({ listingId: 3n })).rejects.toThrow();
    });

    expect(result.current.errorKey).toBe("transaction.errors.rejected");
  });
});

// ─── Reconciliation — the real hook path ───────────────────────────────────

describe("useBuy — reconciliation when signAndSend throws after submission", () => {
  it("reconciles to SUCCESS using the captured hash", async () => {
    reconcileTransactionMock.mockResolvedValue({ status: "SUCCESS" });
    buyFnMock.mockResolvedValue({
      built: { fee: "100" },
      signAndSend: vi.fn(
        async ({ watcher }: { watcher: { onSubmitted: (r: unknown) => void } }) => {
          watcher.onSubmitted({ hash: "RECONCILED_BUY_HASH" });
          throw new Error("timed out waiting for confirmation");
        },
      ),
    });

    const { result } = renderHook(() => useBuy());
    let buyResult: Awaited<ReturnType<typeof result.current.buy>> | undefined;
    await act(async () => {
      buyResult = await result.current.buy({ listingId: 9n });
    });

    expect(reconcileTransactionMock).toHaveBeenCalledWith("RECONCILED_BUY_HASH");
    expect(buyResult).toEqual({ txHash: "RECONCILED_BUY_HASH" });
    expect(result.current.state).toBe("success");
  });

  it("reconciles to FAILED and surfaces the error", async () => {
    reconcileTransactionMock.mockResolvedValue({ status: "FAILED" });
    buyFnMock.mockResolvedValue({
      built: { fee: "100" },
      signAndSend: vi.fn(
        async ({ watcher }: { watcher: { onSubmitted: (r: unknown) => void } }) => {
          watcher.onSubmitted({ hash: "FAILED_BUY_HASH" });
          throw new Error("timed out waiting for confirmation");
        },
      ),
    });

    const { result } = renderHook(() => useBuy());
    await act(async () => {
      await expect(result.current.buy({ listingId: 9n })).rejects.toThrow();
    });

    expect(reconcileTransactionMock).toHaveBeenCalledWith("FAILED_BUY_HASH");
    expect(result.current.state).toBe("error");
  });

  it("recovers a pending buy from a previous session on mount (reload mid-confirmation)", async () => {
    const key = `mlv_buy_pending:anything`;
    sessionStorage.setItem(key, JSON.stringify({ txHash: "OLD_BUY_HASH", address: ADDRESS }));
    reconcileTransactionMock.mockResolvedValue({ status: "SUCCESS" });

    const { result } = renderHook(() => useBuy());

    await waitFor(() => expect(result.current.state).toBe("success"));
    expect(reconcileTransactionMock).toHaveBeenCalledWith("OLD_BUY_HASH");
    expect(result.current.txHash).toBe("OLD_BUY_HASH");
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it("leaves the pending marker and returns to idle on NOT_FOUND (still unknown)", async () => {
    const key = `mlv_buy_pending:anything`;
    sessionStorage.setItem(key, JSON.stringify({ txHash: "UNKNOWN_HASH", address: ADDRESS }));
    reconcileTransactionMock.mockResolvedValue({ status: "NOT_FOUND" });

    const { result } = renderHook(() => useBuy());

    await waitFor(() => expect(reconcileTransactionMock).toHaveBeenCalledWith("UNKNOWN_HASH"));
    await waitFor(() => expect(result.current.state).toBe("idle"));
    // Still unresolved — the marker stays so a later mount can try again.
    expect(sessionStorage.getItem(key)).not.toBeNull();
  });
});
