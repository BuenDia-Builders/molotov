import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    environment: "node",
    // Must cover lib/ too: a test file outside `include` does not fail, it simply
    // never runs — which looks identical to passing. app/**/*.test.tsx was missing
    // until a real component test under app/earnings/ silently never ran.
    include: [
      "app/api/**/*.test.ts",
      "app/**/*.test.tsx",
      "hooks/**/*.test.ts",
      "lib/**/*.test.ts",
      "components/**/*.test.tsx",
    ],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
