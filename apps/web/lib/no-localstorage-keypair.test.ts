import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

// Regression guard for ADR 0002 (Option D): the Privy-derived keypair persisted to
// localStorage was removed, not migrated. This fails if any of its fingerprints
// reappear anywhere under apps/web.
//
// The needles are assembled from fragments on purpose, so this test's own source
// does not contain the contiguous strings it searches for.
const FORBIDDEN = ["Keypair" + ".random", "molotov_stellar" + "_kp", "molotov_" + "funded"];

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, ".."); // apps/web
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "coverage", ".turbo"]);
const EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (EXTS.some((e) => full.endsWith(e))) out.push(full);
  }
  return out;
}

describe("no localStorage keypair path (ADR 0002)", () => {
  it("no module under apps/web references the removed keypair path", () => {
    const offenders: string[] = [];
    for (const file of walk(WEB_ROOT)) {
      const src = readFileSync(file, "utf8");
      for (const needle of FORBIDDEN) {
        if (src.includes(needle)) offenders.push(`${file.slice(WEB_ROOT.length + 1)} → ${needle}`);
      }
    }
    expect(offenders, `Removed keypair path resurfaced:\n${offenders.join("\n")}`).toEqual([]);
  });
});
