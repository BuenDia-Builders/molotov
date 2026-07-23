import { describe, expect, it } from "vitest";
import { stroopsToXlm, xlmToStroops } from "./stroops";

describe("stroopsToXlm", () => {
  it("formats whole XLM without a decimal point", () => {
    expect(stroopsToXlm("10000000")).toBe("1");
    expect(stroopsToXlm("1000000000")).toBe("100");
  });

  // The bug this replaced truncated with integer division: 1.5 XLM rendered as "1"
  // while the contract charged 1.5 — the buyer paid more than the screen said.
  it("keeps fractional XLM exact, trailing zeros trimmed", () => {
    expect(stroopsToXlm("15000000")).toBe("1.5");
    expect(stroopsToXlm("12345678")).toBe("1.2345678");
    expect(stroopsToXlm("1")).toBe("0.0000001");
    expect(stroopsToXlm("10000001")).toBe("1.0000001");
  });

  // NUMERIC(39,0) exceeds 2^53, so any Number() round-trip would corrupt this.
  it("survives amounts far beyond Number.MAX_SAFE_INTEGER", () => {
    expect(stroopsToXlm("123456789012345678901")).toBe("12345678901234.5678901");
  });

  it("handles zero and negatives", () => {
    expect(stroopsToXlm("0")).toBe("0");
    expect(stroopsToXlm("-15000000")).toBe("-1.5");
    expect(stroopsToXlm(BigInt(-1))).toBe("-0.0000001");
  });
});

describe("xlmToStroops", () => {
  it("converts whole and fractional amounts", () => {
    expect(xlmToStroops(1)).toBe(BigInt(10_000_000));
    expect(xlmToStroops(1.5)).toBe(BigInt(15_000_000));
    expect(xlmToStroops("0.0000001")).toBe(BigInt(1));
    expect(xlmToStroops("100")).toBe(BigInt(1_000_000_000));
  });

  // `Math.round(x * 10_000_000)` is off by a stroop on amounts that look exact in
  // decimal but are not in binary floating point.
  it("is exact where a float multiply drifts", () => {
    expect(xlmToStroops(4.35)).toBe(BigInt(43_500_000));
    expect(xlmToStroops(1.005)).toBe(BigInt(10_050_000));
    expect(xlmToStroops(8.16)).toBe(BigInt(81_600_000));
  });

  it("round-trips with stroopsToXlm", () => {
    for (const amount of ["1", "1.5", "0.0000001", "12345.6789012", "999999"]) {
      expect(stroopsToXlm(xlmToStroops(amount))).toBe(amount);
    }
  });

  it("refuses amounts finer than a stroop instead of truncating money", () => {
    expect(() => xlmToStroops("0.00000001")).toThrow(/finer than 1 stroop/);
  });

  it("refuses non-numeric input", () => {
    expect(() => xlmToStroops("abc")).toThrow(/Not a decimal/);
    expect(() => xlmToStroops("")).toThrow(/Not a decimal/);
  });
});
