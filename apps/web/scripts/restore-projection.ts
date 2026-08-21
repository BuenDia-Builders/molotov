/**
 * Restores a snapshot written by snapshot-projection.ts into a Postgres database.
 *
 * Inserts rows in FK order (artists, tokens, listings, sales, token_transfers).
 * Idempotent: `sales` and `token_transfers` dedupe on their existing
 * `(ledger, tx_hash, event_index)` UNIQUE constraint; the other three dedupe on
 * their primary key. Running this twice against the same target is safe.
 *
 * This shells out to `psql` rather than adding a Postgres client dependency —
 * the only requirement is `psql` on PATH and a `DATABASE_URL` pointing at a
 * direct Postgres connection (not the PostgREST API).
 *
 * Usage:
 *   DATABASE_URL=postgres://... node_modules/.pnpm/node_modules/.bin/tsx \
 *     apps/web/scripts/restore-projection.ts backups/projection-<timestamp>.json
 */

import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { execFileSync } from "child_process";
import { resolve } from "path";

const TABLES = ["artists", "tokens", "listings", "sales", "token_transfers"] as const;

const NATURAL_KEY: Record<(typeof TABLES)[number], string> = {
  artists: "(address)",
  tokens: "(token_id)",
  listings: "(listing_id)",
  sales: "(ledger, tx_hash, event_index)",
  token_transfers: "(ledger, tx_hash, event_index)",
};

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildInsert(table: string, rows: Record<string, unknown>[]): string | null {
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0]);
  const values = rows
    .map((row) => `  (${columns.map((c) => sqlLiteral(row[c])).join(", ")})`)
    .join(",\n");
  return (
    `INSERT INTO ${table} (${columns.join(", ")})\nVALUES\n${values}\n` +
    `ON CONFLICT ${NATURAL_KEY[table as keyof typeof NATURAL_KEY]} DO NOTHING;`
  );
}

function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: restore-projection.ts <snapshot-file.json>");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL must be set to a direct Postgres connection");

  const snapshot = JSON.parse(readFileSync(resolve(file), "utf-8")) as {
    tables: Record<string, Record<string, unknown>[]>;
  };

  const statements: string[] = [];
  for (const table of TABLES) {
    const rows = snapshot.tables[table] ?? [];
    const insert = buildInsert(table, rows);
    if (insert) statements.push(insert);
    console.log(`  ${table.padEnd(16)} ${rows.length} rows`);
  }

  const sqlFile = resolve(`/tmp/restore-projection-${Date.now()}.sql`);
  writeFileSync(sqlFile, statements.join("\n\n"));
  try {
    execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlFile], {
      stdio: "inherit",
    });
  } finally {
    unlinkSync(sqlFile);
  }

  console.log("\n  restore complete");
}

main();
