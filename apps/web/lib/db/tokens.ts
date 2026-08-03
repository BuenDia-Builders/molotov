import { getDb } from "./client";

export type DbToken = {
  token_id: number;
  token_uri: string;
  owner: string;
  artist: string;
  royalty_bps: number;
  recipients_count: number;
  minted_at_ledger: number;
};

export type DbTokenWithOwner = {
  token_id: number;
  token_uri: string;
  owner: string;
  artist: string;
  royalty_bps: number;
  effective_owner: string;
  active_listing_id: string | null;
};

type DbResult<T> = PromiseLike<{ data: T | null; error: { code?: string } | null }>;

/**
 * Runs a tokens query with the `hidden = false` curation filter, retrying
 * without it when the column does not exist yet (Postgres 42703 — the
 * curation migration has not been applied to this database). Deploy order
 * must not matter.
 */
async function withCuration<T>(build: (filterHidden: boolean) => DbResult<T>): Promise<T | null> {
  const { data, error } = await build(true);
  if (!error) return data;
  if (error.code === "42703") {
    const { data: fallback } = await build(false);
    return fallback;
  }
  return null;
}

export async function findTokenById(tokenId: number): Promise<DbToken | null> {
  return withCuration<DbToken>((filterHidden) => {
    let q = getDb()
      .from("tokens")
      .select("token_id, token_uri, owner, artist, royalty_bps, recipients_count, minted_at_ledger")
      .eq("token_id", tokenId);
    if (filterHidden) q = q.eq("hidden", false);
    return q.maybeSingle();
  });
}

export async function getLatestToken(): Promise<Pick<
  DbToken,
  "token_id" | "token_uri" | "artist"
> | null> {
  return withCuration<Pick<DbToken, "token_id" | "token_uri" | "artist">>((filterHidden) => {
    let q = getDb().from("tokens").select("token_id, token_uri, artist");
    if (filterHidden) q = q.eq("hidden", false);
    return q.order("token_id", { ascending: false }).limit(1).maybeSingle();
  });
}

export async function getRecentTokens(
  limit: number,
): Promise<Pick<DbToken, "token_id" | "token_uri" | "artist" | "royalty_bps">[]> {
  const data = await withCuration<
    Pick<DbToken, "token_id" | "token_uri" | "artist" | "royalty_bps">[]
  >((filterHidden) => {
    let q = getDb().from("tokens").select("token_id, token_uri, artist, royalty_bps");
    if (filterHidden) q = q.eq("hidden", false);
    return q.order("token_id", { ascending: false }).limit(limit);
  });
  return data ?? [];
}

export async function getAllTokens(): Promise<
  Pick<DbToken, "token_id" | "token_uri" | "artist">[]
> {
  const data = await withCuration<Pick<DbToken, "token_id" | "token_uri" | "artist">[]>(
    (filterHidden) => {
      let q = getDb().from("tokens").select("token_id, token_uri, artist");
      if (filterHidden) q = q.eq("hidden", false);
      return q.order("token_id", { ascending: false });
    },
  );
  return data ?? [];
}

export async function getTokensByArtist(
  artist: string,
): Promise<Pick<DbToken, "token_id" | "token_uri" | "royalty_bps">[]> {
  const data = await withCuration<Pick<DbToken, "token_id" | "token_uri" | "royalty_bps">[]>(
    (filterHidden) => {
      let q = getDb()
        .from("tokens")
        .select("token_id, token_uri, royalty_bps")
        .eq("artist", artist);
      if (filterHidden) q = q.eq("hidden", false);
      return q.order("token_id", { ascending: false });
    },
  );
  return data ?? [];
}

export async function getTokensOwnedByWallet(wallet: string): Promise<DbTokenWithOwner[]> {
  const { data, error } = await getDb()
    .from("token_effective_owner")
    .select("token_id, token_uri, owner, artist, royalty_bps, effective_owner, active_listing_id")
    .or(`effective_owner.eq.${wallet},artist.eq.${wallet}`)
    .order("token_id", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
