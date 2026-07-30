// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MolotovError } from "@/lib/errors";
import { useMint } from "@/hooks/use-mint";
import type { MintParams } from "@/hooks/use-mint";

/* ── hoisted mocks ──────────────────────────────────────────── */

const mockAddress = vi.hoisted(
  () => "GANXCETUVUUILGJPVEZWM7EH66IZM5OICUPMNUWNXKIBRK425MUKZERM",
);

const {
  mockReconcileTransaction,
  mockIsUserRejection,
  mockSignAndSend,
  mockUploadImage,
  mockUploadMetadata,
  mockSignTransaction,
} = vi.hoisted(() => ({
  mockReconcileTransaction: vi.fn(),
  mockIsUserRejection: vi.fn(),
  mockSignAndSend: vi.fn(),
  mockUploadImage: vi.fn(),
  mockUploadMetadata: vi.fn(),
  mockSignTransaction: vi.fn(),
}));

/* ── module mocks ───────────────────────────────────────────── */

vi.mock("@/lib/stellar", () => ({
  RPC_URL: "https://soroban-testnet.stellar.org",
  reconcileTransaction: mockReconcileTransaction,
  isUserRejection: mockIsUserRejection,
}));

vi.mock("@/hooks/use-wallet", () => ({
  useWallet: () => ({
    address: mockAddress,
    signTransaction: mockSignTransaction,
  }),
}));

vi.mock("@/lib/ipfs", () => ({
  uploadImage: mockUploadImage,
  uploadMetadata: mockUploadMetadata,
}));

vi.mock("@molotov/stellar-client/molotov-nft", () => ({
  Client: vi.fn(() => ({
    mint: vi.fn(() => ({
      signAndSend: mockSignAndSend,
    })),
  })),
  networks: {
    testnet: {
      contractId: "testnet-nft-contract-id",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
}));

vi.mock("@stellar/stellar-sdk", () => ({
  scValToNative: vi.fn((scval: { value?: unknown }) => scval.value),
}));

/* ── helpers ────────────────────────────────────────────────── */

const validParams: MintParams = {
  imageFile: new File(["fake"], "art.png", { type: "image/png", lastModified: 0 }),
  title: "Test Artwork",
  description: "A test artwork",
  royaltyBps: 1000,
  royaltyRecipients: [{ address: mockAddress, shareBps: 10000 }],
};

function renderUseMint() {
  let hookResult: ReturnType<typeof useMint>;

  function TestComponent() {
    hookResult = useMint();
    return null;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(React.createElement(TestComponent));
  });

  return {
    get result() {
      return hookResult;
    },
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      document.body.removeChild(container);
    },
  };
}

async function actMint(
  mint: ReturnType<typeof useMint>["mint"],
  params: MintParams,
): Promise<{ tokenId: number; txHash: string }> {
  let result: { tokenId: number; txHash: string };
  await act(async () => {
    result = await mint(params);
  });
  return result!;
}

async function actMintAndCatch(
  mint: ReturnType<typeof useMint>["mint"],
  params: MintParams,
): Promise<unknown> {
  let error: unknown;
  await act(async () => {
    try {
      await mint(params);
    } catch (e) {
      error = e;
    }
  });
  return error;
}

/* ── suite ──────────────────────────────────────────────────── */

describe("useMint", () => {
  let harness: ReturnType<typeof renderUseMint>;

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    harness = renderUseMint();
  });

  afterEach(() => {
    harness.cleanup();
  });

  /* ── happy path ──────────────────────────────────────────── */

  it("returns tokenId and txHash on a successful mint", async () => {
    mockUploadImage.mockResolvedValue({ cid: "ipfs-cid-image" });
    mockUploadMetadata.mockResolvedValue({ cid: "ipfs-cid-meta" });
    mockSignAndSend.mockImplementation(async (opts?: { watcher?: { onSubmitted?: (r: { hash?: string }) => void } }) => {
      opts?.watcher?.onSubmitted?.({ hash: "tx-hash-abc" });
      return { result: "42", sendTransactionResponse: { hash: "tx-hash-abc" } };
    });

    const { tokenId, txHash } = await actMint(harness.result.mint, validParams);

    expect(tokenId).toBe(42);
    expect(txHash).toBe("tx-hash-abc");
    expect(harness.result.state).toBe("success");
    expect(harness.result.errorKind).toBeNull();
    expect(mockReconcileTransaction).not.toHaveBeenCalled();
  });

  it("uses an existing draft to skip IPFS re-upload", async () => {
    const key = `mlv_mint_draft:art.png:4:0:Test Artwork`;
    sessionStorage.setItem(key, "ipfs://existing-draft");
    mockSignAndSend.mockImplementation(async (opts) => {
      opts?.watcher?.onSubmitted?.({ hash: "tx-draft" });
      return { result: "7", sendTransactionResponse: { hash: "tx-draft" } };
    });

    await actMint(harness.result.mint, validParams);

    expect(mockUploadImage).not.toHaveBeenCalled();
    expect(mockUploadMetadata).not.toHaveBeenCalled();
    expect(harness.result.state).toBe("success");
  });

  /* ── rejection ───────────────────────────────────────────── */

  it("reports a user rejection as errorKind=sign", async () => {
    mockUploadImage.mockResolvedValue({ cid: "ipfs-cid" });
    mockUploadMetadata.mockResolvedValue({ cid: "ipfs-cid" });
    mockSignAndSend.mockRejectedValue(new Error("User rejected the request"));
    mockIsUserRejection.mockReturnValue(true);

    const error = await actMintAndCatch(harness.result.mint, validParams);

    expect(error).toBeInstanceOf(MolotovError);
    expect((error as MolotovError).appError.kind).toBe("user_rejected");
    expect(harness.result.state).toBe("error");
    expect(harness.result.errorKind).toBe("sign");
    expect(mockReconcileTransaction).not.toHaveBeenCalled();
  });

  it("clears the pending marker on user rejection", async () => {
    mockUploadImage.mockResolvedValue({ cid: "ipfs-cid" });
    mockUploadMetadata.mockResolvedValue({ cid: "ipfs-cid" });
    mockSignAndSend.mockRejectedValue(new Error("User rejected the request"));
    mockIsUserRejection.mockReturnValue(true);

    await actMintAndCatch(harness.result.mint, validParams);

    const pendingKey = `mlv_mint_pending:mlv_mint_draft:art.png:4:0:Test Artwork`;
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
  });

  /* ── failure without submission ──────────────────────────── */

  it("reports a submit error without reconciling when no hash was captured", async () => {
    mockUploadImage.mockResolvedValue({ cid: "ipfs-cid" });
    mockUploadMetadata.mockResolvedValue({ cid: "ipfs-cid" });
    mockSignAndSend.mockRejectedValue(new Error("RPC unreachable"));
    mockIsUserRejection.mockReturnValue(false);

    const error = await actMintAndCatch(harness.result.mint, validParams);

    expect(error).toBeInstanceOf(MolotovError);
    expect((error as MolotovError).appError.kind).toBe("submit_failed");
    expect(harness.result.state).toBe("error");
    expect(harness.result.errorKind).toBe("submit");
    expect(mockReconcileTransaction).not.toHaveBeenCalled();
  });

  /* ── failure after submit ────────────────────────────────── */

  it("reconciles and succeeds when signAndSend throws but tx landed", async () => {
    mockUploadImage.mockResolvedValue({ cid: "ipfs-cid" });
    mockUploadMetadata.mockResolvedValue({ cid: "ipfs-cid" });
    mockSignAndSend.mockImplementation(async (opts) => {
      opts?.watcher?.onSubmitted?.({ hash: "reconciled-hash" });
      throw new Error("Timeout waiting for confirmation");
    });
    mockIsUserRejection.mockReturnValue(false);
    mockReconcileTransaction.mockResolvedValue({
      status: "SUCCESS",
      returnValue: { type: "scvU32", value: 99 },
    });

    const { tokenId, txHash } = await actMint(harness.result.mint, validParams);

    expect(tokenId).toBe(99);
    expect(txHash).toBe("reconciled-hash");
    expect(harness.result.state).toBe("success");
    expect(mockReconcileTransaction).toHaveBeenCalledOnce();
    expect(mockReconcileTransaction).toHaveBeenCalledWith("reconciled-hash");
  });

  it("reconciles and reports error when tx failed on-chain", async () => {
    mockUploadImage.mockResolvedValue({ cid: "ipfs-cid" });
    mockUploadMetadata.mockResolvedValue({ cid: "ipfs-cid" });
    mockSignAndSend.mockImplementation(async (opts) => {
      opts?.watcher?.onSubmitted?.({ hash: "failed-hash" });
      throw new Error("RPC error");
    });
    mockIsUserRejection.mockReturnValue(false);
    mockReconcileTransaction.mockResolvedValue({ status: "FAILED" });

    const error = await actMintAndCatch(harness.result.mint, validParams);

    expect(error).toBeInstanceOf(MolotovError);
    expect(harness.result.state).toBe("error");
    expect(harness.result.errorKind).toBe("submit");
    expect(mockReconcileTransaction).toHaveBeenCalledWith("failed-hash");
  });

  it("reconciles and reports error when tx is NOT_FOUND, leaving a pending entry", async () => {
    mockUploadImage.mockResolvedValue({ cid: "ipfs-cid" });
    mockUploadMetadata.mockResolvedValue({ cid: "ipfs-cid" });
    mockSignAndSend.mockImplementation(async (opts) => {
      opts?.watcher?.onSubmitted?.({ hash: "notfound-hash" });
      throw new Error("SDK timeout");
    });
    mockIsUserRejection.mockReturnValue(false);
    mockReconcileTransaction.mockResolvedValue({ status: "NOT_FOUND" });

    const error = await actMintAndCatch(harness.result.mint, validParams);

    expect(error).toBeInstanceOf(MolotovError);
    expect(harness.result.state).toBe("error");
    expect(harness.result.errorKind).toBe("submit");

    const pendingKey = `mlv_mint_pending:mlv_mint_draft:art.png:4:0:Test Artwork`;
    const pendingRaw = sessionStorage.getItem(pendingKey);
    expect(pendingRaw).not.toBeNull();
    const pending = JSON.parse(pendingRaw!);
    expect(pending.txHash).toBe("notfound-hash");
    expect(pending.address).toBe(mockAddress);
  });

  /* ── upload error ────────────────────────────────────────── */

  it("reports an IPFS upload error without calling signAndSend", async () => {
    mockUploadImage.mockRejectedValue(new Error("Pinata down"));

    const error = await actMintAndCatch(harness.result.mint, validParams);

    expect(error).toBeInstanceOf(MolotovError);
    expect(harness.result.state).toBe("error");
    expect(harness.result.errorKind).toBe("upload");
    expect(mockSignAndSend).not.toHaveBeenCalled();
  });
});
