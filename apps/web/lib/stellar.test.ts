import { describe, expect, it } from "vitest";
import { isUserRejection } from "./stellar";

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
