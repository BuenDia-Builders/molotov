import { describe, expect, it } from "vitest";
import { formatResultError } from "./use-registry";

describe("formatResultError", () => {
  it("returns a string verbatim", () => {
    expect(formatResultError("already readable")).toBe("already readable");
    expect(formatResultError("")).toBe("");
  });

  it("decodes a TransactionResultCode name from an XDR-like object", () => {
    const obj = {
      result: () => ({ switch: () => ({ name: "txFAILED" }) }),
    };
    expect(formatResultError(obj)).toBe("Transaction failed (txFAILED)");
  });

  it("returns fallback for undefined, null, or object without result method", () => {
    expect(formatResultError(undefined)).toBe("Transaction failed");
    expect(formatResultError(null)).toBe("Transaction failed");
    expect(formatResultError({})).toBe("Transaction failed");
    expect(formatResultError({ result: undefined })).toBe("Transaction failed");
  });

  it("does not throw when .result() or .switch() throws", () => {
    const throwsOnResult = {
      result: () => { throw new Error("boom"); },
    };
    const throwsOnSwitch = {
      result: () => ({ switch: () => { throw new Error("bang"); } }),
    };
    expect(() => formatResultError(throwsOnResult)).not.toThrow();
    expect(formatResultError(throwsOnResult)).toBe("Transaction failed");
    expect(() => formatResultError(throwsOnSwitch)).not.toThrow();
    expect(formatResultError(throwsOnSwitch)).toBe("Transaction failed");
  });
});