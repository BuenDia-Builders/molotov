import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Soroban RPC so reconcileTransaction can be driven without a network.
// Everything else in the SDK (rpc.Api.GetTransactionStatus, xdr, …) is preserved;
// only rpc.Server.getTransaction is controllable.
const { getTransactionMock } = vi.hoisted(() => ({ getTransactionMock: vi.fn() }));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@stellar/stellar-sdk");
  class MockServer {
    getTransaction = getTransactionMock;
  }
  return {
    ...actual,
    rpc: { ...actual.rpc, Server: MockServer },
  };
});

import { isUserRejection, reconcileTransaction } from "./stellar";

describe("isUserRejection", () => {
  // The regression the fix targets: Stellar Wallets Kit's parseError() rejects
  // with a plain { code, message, ext } object, never an Error instance.
  it("recognizes a plain-object rejection from the Stellar Wallets Kit", () => {
    expect(isUserRejection({ code: -4, message: "User rejected the request", ext: {} })).toBe(true);
  });

  it("still recognizes an Error-shaped rejection", () => {
    expect(isUserRejection(new Error("Request was declined by the user"))).toBe(true);
  });

  it("recognizes a bare string rejection", () => {
    expect(isUserRejection("User cancelled the signature")).toBe(true);
  });

  it("returns false for a genuine non-rejection Error", () => {
    expect(isUserRejection(new Error("network timeout while submitting"))).toBe(false);
  });

  it("returns false for a non-rejection plain object", () => {
    expect(isUserRejection({ code: -1, message: "Unhandled error from the wallet", ext: {} })).toBe(
      false,
    );
  });
});

describe("reconcileTransaction", () => {
  beforeEach(() => getTransactionMock.mockReset());

  it("returns SUCCESS (with the return value) when the tx confirmed", async () => {
    const returnValue = { fake: "scval" };
    getTransactionMock.mockResolvedValue({ status: "SUCCESS", returnValue });
    const result = await reconcileTransaction("hash", 3, 0);
    expect(result).toEqual({ status: "SUCCESS", returnValue });
    expect(getTransactionMock).toHaveBeenCalledTimes(1);
  });

  it("returns FAILED when the tx failed on-chain", async () => {
    getTransactionMock.mockResolvedValue({ status: "FAILED" });
    const result = await reconcileTransaction("hash", 3, 0);
    expect(result).toEqual({ status: "FAILED" });
  });

  it("retries past a transient RPC error and then resolves SUCCESS", async () => {
    getTransactionMock
      .mockRejectedValueOnce(new Error("rpc unavailable"))
      .mockResolvedValue({ status: "SUCCESS", returnValue: undefined });
    const result = await reconcileTransaction("hash", 5, 0);
    expect(result.status).toBe("SUCCESS");
    expect(getTransactionMock).toHaveBeenCalledTimes(2); // errored once, then succeeded
  });

  it("returns NOT_FOUND after exhausting the poll window (never confirmed)", async () => {
    getTransactionMock.mockResolvedValue({ status: "NOT_FOUND" });
    const result = await reconcileTransaction("hash", 3, 0);
    expect(result).toEqual({ status: "NOT_FOUND" });
    expect(getTransactionMock).toHaveBeenCalledTimes(3); // polled the full window
  });
});
