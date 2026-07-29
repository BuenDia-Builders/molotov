import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { reconcileTransaction } from "@/lib/stellar";

const { mockGetTransaction } = vi.hoisted(() => ({
  mockGetTransaction: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", () => ({
  rpc: {
    Server: vi.fn(() => ({
      getTransaction: mockGetTransaction,
    })),
    Api: {
      GetTransactionStatus: {
        SUCCESS: "SUCCESS",
        FAILED: "FAILED",
      },
    },
  },
  xdr: {
    ScVal: class ScValMock {},
  },
}));

describe("reconcileTransaction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetTransaction.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns SUCCESS with returnValue on the first attempt", async () => {
    const returnValue = { type: "scvU32", value: 42 };
    mockGetTransaction.mockResolvedValue({
      status: "SUCCESS",
      returnValue,
    });

    const result = await reconcileTransaction("tx-hash-1");

    expect(result).toEqual({ status: "SUCCESS", returnValue });
    expect(mockGetTransaction).toHaveBeenCalledTimes(1);
    expect(mockGetTransaction).toHaveBeenCalledWith("tx-hash-1");
  });

  it("returns SUCCESS after several NOT_FOUND retries", async () => {
    const returnValue = { type: "scvU32", value: 7 };
    mockGetTransaction
      .mockResolvedValueOnce({ status: "NOT_FOUND" })
      .mockResolvedValueOnce({ status: "NOT_FOUND" })
      .mockResolvedValue({ status: "SUCCESS", returnValue });

    const promise = reconcileTransaction("tx-hash-2", 10, 500);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ status: "SUCCESS", returnValue });
    expect(mockGetTransaction).toHaveBeenCalledTimes(3);
  });

  it("returns FAILED as soon as the RPC responds", async () => {
    mockGetTransaction.mockResolvedValue({ status: "FAILED" });

    const result = await reconcileTransaction("tx-hash-3");

    expect(result).toEqual({ status: "FAILED" });
    expect(mockGetTransaction).toHaveBeenCalledTimes(1);
  });

  it("returns NOT_FOUND after exhausting all retries", async () => {
    const maxRetries = 20;
    mockGetTransaction.mockResolvedValue({ status: "NOT_FOUND" });

    const promise = reconcileTransaction("tx-hash-4", maxRetries, 100);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ status: "NOT_FOUND" });
    expect(mockGetTransaction).toHaveBeenCalledTimes(maxRetries);
  });

  it("only includes returnValue on SUCCESS, never on FAILED or NOT_FOUND", async () => {
    mockGetTransaction.mockResolvedValueOnce({ status: "FAILED" });

    const failed = await reconcileTransaction("tx-hash-5", 3, 500);
    expect(failed).toEqual({ status: "FAILED" });
    expect(failed).not.toHaveProperty("returnValue");

    mockGetTransaction.mockReset();
    mockGetTransaction.mockResolvedValue({ status: "NOT_FOUND" });

    const promise = reconcileTransaction("tx-hash-6", 3, 500);
    await vi.runAllTimersAsync();
    const notFound = await promise;
    expect(notFound).toEqual({ status: "NOT_FOUND" });
    expect(notFound).not.toHaveProperty("returnValue");
  });
});
