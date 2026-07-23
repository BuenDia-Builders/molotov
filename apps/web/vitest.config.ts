import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Must cover lib/ too: a test file outside `include` does not fail, it simply
    // never runs — which looks identical to passing.
    include: ["app/api/**/*.test.ts", "lib/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
