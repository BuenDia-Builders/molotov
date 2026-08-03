import { getDb } from "./client";

export type DbArtist = {
  address: string;
  registered_at_ledger: number;
  revoked: boolean;
};

export type DbArtistProfile = {
  address: string;
  revoked: boolean;
  /** Vanity slug, team-curated. Null until assigned. */
  handle: string | null;
  bio: string | null;
};

const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export function isValidHandle(value: string): boolean {
  return HANDLE_RE.test(value);
}

/** True when the error is Postgres 42703 (column does not exist) — the
 *  profile migration has not been applied to this database yet. */
function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === "42703";
}

async function findProfile(
  column: "address" | "handle",
  value: string,
): Promise<DbArtistProfile | null> {
  const db = getDb();
  const { data, error } = await db
    .from("artists")
    .select("address, revoked, handle, bio")
    .eq(column, value)
    .maybeSingle();

  if (!error) return (data as DbArtistProfile | null) ?? null;

  // Pre-migration fallback: no handle/bio columns. Handle lookups can only
  // miss; address lookups still resolve so no artist page 404s.
  if (isMissingColumn(error)) {
    if (column === "handle") return null;
    const { data: bare } = await db
      .from("artists")
      .select("address, revoked")
      .eq("address", value)
      .maybeSingle();
    return bare ? { ...bare, handle: null, bio: null } : null;
  }

  throw error;
}

export async function findArtistByAddress(address: string): Promise<DbArtistProfile | null> {
  return findProfile("address", address);
}

export async function findArtistByHandle(handle: string): Promise<DbArtistProfile | null> {
  const normalized = handle.toLowerCase();
  if (!isValidHandle(normalized)) return null;
  return findProfile("handle", normalized);
}

/** Handles for a set of addresses — for linking lists (browse, /artists). */
export async function getHandlesByAddress(addresses: string[]): Promise<Map<string, string>> {
  if (!addresses.length) return new Map();
  const { data, error } = await getDb()
    .from("artists")
    .select("address, handle")
    .in("address", addresses)
    .not("handle", "is", null);
  if (error) return new Map(); // pre-migration or transient — links fall back to addresses
  return new Map((data as { address: string; handle: string }[]).map((a) => [a.address, a.handle]));
}

export async function getActiveArtistAddresses(): Promise<string[]> {
  const { data } = await getDb().from("artists").select("address").eq("revoked", false);
  return (data ?? []).map((a) => a.address);
}

export async function getActiveArtistsOrdered(): Promise<
  Pick<DbArtist, "address" | "registered_at_ledger">[]
> {
  const { data } = await getDb()
    .from("artists")
    .select("address, registered_at_ledger")
    .eq("revoked", false)
    .order("registered_at_ledger", { ascending: false });
  return data ?? [];
}
