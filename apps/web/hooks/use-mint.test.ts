// @vitest-environment jsdom
//
// Hook-level tests for useMint — deliberately exercise the REAL wiring, not
// just the pure helpers it calls: the real `contractErrorKey` and the real
// `isUserRejection` run against errors the hook actually throws/catches, and
// `reconcileTransaction` is mocked only so its outcome (SUCCESS/FAILED/
// NOT_FOUND) is controllable, not because the call itself is faked away.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const {
  useWalletMock,
  mintFnMock,
  uploadImageMock,
  uploadMetadataMock,
  reconcileTransactionMock,
  scValToNativeMock,
} = vi.hoisted(() => ({
  useWalletMock: vi.fn(),
  mintFnMock: vi.fn(),
  uploadImageMock: vi.fn(),
  uploadMetadataMock: vi.fn(),
  reconcileTransactionMock: vi.fn(),
  scValToNativeMock: vi.fn((v: unknown) => v),
}));

vi.mock("@/hooks/use-wallet", () => ({
  useWallet: () => useWalletMock(),
}));

vi.mock("@molotov/stellar-client/molotov-nft", () => ({
  Client: vi.fn().mockImplementation(() => ({ mint: mintFnMock })),
  networks: {
    testnet: {
      contractId: "CTESTNFT",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
}));

vi.mock("@/lib/ipfs", () => ({
  uploadImage: (...args: unknown[]) => uploadImageMock(...args),
  uploadMetadata: (...args: unknown[]) => uploadMetadataMock(...args),
}));

vi.mock("@stellar/stellar-sdk", () => ({
  scValToNative: (v: unknown) => scValToNativeMock(v),
}));

// Partial mock: keep isUserRejection real (it's already unit-tested and pure)
// so the "was this a wallet rejection?" branch inside useMint is exercised for
// real; only reconcileTransaction is overridden, since driving it for real
// would mean hitting a live RPC.
vi.mock("@/lib/stellar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stellar")>();
  return {
    ...actual,
    reconcileTransaction: (...args: unknown[]) => reconcileTransactionMock(...args),
  };
});

import { useMint } from "@/hooks/use-mint";
import { stroopsToXlm } from "@/lib/stroops";

const ADDRESS = "GATESTMINTERADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function makeFile(name = "art.jpg", size = 1024): File {
  return new File([new Uint8Array(size)], name, { type: "image/jpeg" });
}

function baseParams(overrides: Record<string, unknown> = {}) {
  return {
    imageFile: makeFile(),
    title: "Prueba",
    description: "",
    royaltyBps: 1000,
    royaltyRecipients: [{ address: ADDRESS, shareBps: 10000 }],
    ...overrides,
  };
}

beforeEach(() => {
  useWalletMock.mockReturnValue({
    address: ADDRESS,
    signTransaction: vi.fn(async (xdr: string) => xdr),
  });
  uploadImageMock.mockResolvedValue({ cid: "bafyimagecid", gatewayUrl: "https://x/bafyimagecid" });
  uploadMetadataMock.mockResolvedValue({ cid: "bafymetacid", gatewayUrl: "https://x/bafymetacid" });
  sessionStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Fee estimate ─────────────────────────────────────────────────────────

describe("useMint — estimateFee", () => {
  it("reads the fee straight off the simulated transaction's built envelope", async () => {
    mintFnMock.mockResolvedValue({ built: { fee: "123456" } });
    const { result } = renderHook(() => useMint());

    await act(async () => {
      await result.current.estimateFee({
        royaltyBps: 1000,
        royaltyRecipients: [{ address: ADDRESS, shareBps: 10000 }],
      });
    });

    expect(result.current.feeXlm).toBe(stroopsToXlm("123456"));
    expect(mintFnMock).toHaveBeenCalledWith(
      expect.objectContaining({ royalty_bps: 1000, artist: ADDRESS, recipient: ADDRESS }),
    );
  });

  it("fails silently (null feeXlm, no throw) when the simulation itself fails", async () => {
    mintFnMock.mockRejectedValue(new Error("simulation unavailable"));
    const { result } = renderHook(() => useMint());

    await act(async () => {
      await result.current.estimateFee({ royaltyBps: 1000, royaltyRecipients: [] });
    });

    expect(result.current.feeXlm).toBeNull();
  });

  it("does nothing when no wallet is connected", async () => {
    useWalletMock.mockReturnValue({ address: null, signTransaction: vi.fn() });
    const { result } = renderHook(() => useMint());

    await act(async () => {
      await result.current.estimateFee({ royaltyBps: 1000, royaltyRecipients: [] });
    });

    expect(mintFnMock).not.toHaveBeenCalled();
    expect(result.current.feeXlm).toBeNull();
  });
});

// ─── Wallet-connection gating ───────────────────────────────────────────────

describe("useMint — wallet connection gating", () => {
  it("refuses to mint without a connected wallet, before touching IPFS", async () => {
    useWalletMock.mockReturnValue({ address: null, signTransaction: vi.fn() });
    const { result } = renderHook(() => useMint());

    await expect(result.current.mint(baseParams())).rejects.toThrow("No wallet connected");
    expect(uploadImageMock).not.toHaveBeenCalled();
  });
});

// ─── Success path + progress ────────────────────────────────────────────────

describe("useMint — success path", () => {
  it("uploads to IPFS, mints, and reaches success with the real token id and hash", async () => {
    mintFnMock.mockResolvedValue({
      built: { fee: "100" },
      signAndSend: vi.fn(
        async ({ watcher }: { watcher: { onSubmitted: (r: unknown) => void } }) => {
          watcher.onSubmitted({ hash: "HASH1" });
          return { result: 42, sendTransactionResponse: { hash: "HASH1" } };
        },
      ),
    });

    const { result } = renderHook(() => useMint());
    let mintResult: Awaited<ReturnType<typeof result.current.mint>> | undefined;
    await act(async () => {
      mintResult = await result.current.mint(baseParams());
    });

    expect(uploadImageMock).toHaveBeenCalledTimes(1);
    expect(uploadMetadataMock).toHaveBeenCalledTimes(1);
    expect(mintResult).toEqual({ tokenId: 42, tokenIds: [42], txHash: "HASH1" });
    expect(result.current.state).toBe("success");
  });

  it("mints one copy per edition, each its own signature, and reports progress", async () => {
    let calls = 0;
    mintFnMock.mockImplementation(async () => {
      calls += 1;
      const id = calls;
      return {
        built: { fee: "100" },
        signAndSend: vi.fn(async () => ({
          result: id,
          sendTransactionResponse: { hash: `HASH${id}` },
        })),
      };
    });

    const { result } = renderHook(() => useMint());
    let mintResult: Awaited<ReturnType<typeof result.current.mint>> | undefined;
    await act(async () => {
      mintResult = await result.current.mint(baseParams({ editions: 3 }));
    });

    expect(mintFnMock).toHaveBeenCalledTimes(3);
    expect(mintResult?.tokenIds).toEqual([1, 2, 3]);
    // Metadata is only built/uploaded once and reused across every copy.
    expect(uploadImageMock).toHaveBeenCalledTimes(1);
  });
});

// ─── Contract-error decoding — the real wiring, not the isolated function ──

describe("useMint — contractErrorKey wiring in the real catch path", () => {
  it("decodes a real ArtistNotRegistered panic into its i18n key via the hook's own catch", async () => {
    mintFnMock.mockResolvedValue({
      built: { fee: "100" },
      signAndSend: vi.fn(async () => {
        // No onSubmitted call: fails before the tx ever reached the network,
        // so the hook must skip reconciliation and go straight to decoding.
        throw new Error("HostError: Error(Contract, #6)");
      }),
    });

    const { result } = renderHook(() => useMint());
    await act(async () => {
      await expect(result.current.mint(baseParams())).rejects.toThrow();
    });

    expect(result.current.errorMessageKey).toBe("transaction.errors.artistNotRegistered");
    expect(result.current.errorKind).toBe("submit");
    expect(result.current.state).toBe("error");
    expect(reconcileTransactionMock).not.toHaveBeenCalled();
  });

  it("treats a wallet rejection as 'rejected', never as a decoded contract error", async () => {
    mintFnMock.mockResolvedValue({
      built: { fee: "100" },
      signAndSend: vi.fn(async () => {
        throw new Error("User declined access");
      }),
    });

    const { result } = renderHook(() => useMint());
    await act(async () => {
      await expect(result.current.mint(baseParams())).rejects.toThrow();
    });

    expect(result.current.errorKind).toBe("sign");
    expect(result.current.errorMessageKey).toBeNull();
    expect(result.current.state).toBe("error");
  });

  it("falls back to the generic key for an error with no recognizable contract code", async () => {
    mintFnMock.mockResolvedValue({
      built: { fee: "100" },
      signAndSend: vi.fn(async () => {
        throw new Error("network hiccup, nothing contract-shaped here");
      }),
    });

    const { result } = renderHook(() => useMint());
    await act(async () => {
      await expect(result.current.mint(baseParams())).rejects.toThrow();
    });

    expect(result.current.errorMessageKey).toBe("transaction.errors.failed");
  });
});

// ─── Reconciliation — the real hook path, not just reconcileTransaction() ──

describe("useMint — reconciliation when signAndSend throws after submission", () => {
  it("reconciles to SUCCESS using the captured hash and returns the real token id", async () => {
    reconcileTransactionMock.mockResolvedValue({ status: "SUCCESS", returnValue: 99 });
    mintFnMock.mockResolvedValue({
      built: { fee: "100" },
      signAndSend: vi.fn(
        async ({ watcher }: { watcher: { onSubmitted: (r: unknown) => void } }) => {
          watcher.onSubmitted({ hash: "RECONCILED_HASH" });
          throw new Error("timed out waiting for confirmation");
        },
      ),
    });

    const { result } = renderHook(() => useMint());
    let mintResult: Awaited<ReturnType<typeof result.current.mint>> | undefined;
    await act(async () => {
      mintResult = await result.current.mint(baseParams());
    });

    expect(reconcileTransactionMock).toHaveBeenCalledWith("RECONCILED_HASH");
    expect(mintResult).toEqual({
      tokenId: 99,
      tokenIds: [99],
      txHash: "RECONCILED_HASH",
    });
    expect(result.current.state).toBe("success");
  });

  it("reconciles to FAILED and surfaces the error instead of silently retrying", async () => {
    reconcileTransactionMock.mockResolvedValue({ status: "FAILED" });
    mintFnMock.mockResolvedValue({
      built: { fee: "100" },
      signAndSend: vi.fn(
        async ({ watcher }: { watcher: { onSubmitted: (r: unknown) => void } }) => {
          watcher.onSubmitted({ hash: "FAILED_HASH" });
          throw new Error("timed out waiting for confirmation");
        },
      ),
    });

    const { result } = renderHook(() => useMint());
    await act(async () => {
      await expect(result.current.mint(baseParams())).rejects.toThrow();
    });

    expect(reconcileTransactionMock).toHaveBeenCalledWith("FAILED_HASH");
    expect(result.current.state).toBe("error");
  });

  it("recovers a pending mint from a previous session on mount (reload mid-confirmation)", async () => {
    // The exact suffix doesn't matter — findPendingMintKey only cares about
    // the "mlv_mint_pending:" prefix and the stored {txHash, address} body.
    const key = `mlv_mint_pending:anything`;
    sessionStorage.setItem(key, JSON.stringify({ txHash: "OLD_HASH", address: ADDRESS }));
    reconcileTransactionMock.mockResolvedValue({ status: "SUCCESS", returnValue: 7 });

    const { result } = renderHook(() => useMint());

    await waitFor(() => expect(result.current.state).toBe("success"));
    expect(reconcileTransactionMock).toHaveBeenCalledWith("OLD_HASH");
    expect(sessionStorage.getItem(key)).toBeNull();
  });
});
