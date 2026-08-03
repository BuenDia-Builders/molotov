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

export async function findTokenById(tokenId: number): Promise<DbToken | null> {
  const { data, error } = await getDb()
    .from("tokens")
    .select("token_id, token_uri, owner, artist, royalty_bps, recipients_count, minted_at_ledger")
    .eq("token_id", tokenId)
    .single();
  if (error) return null;
  return data;
}

export async function getLatestToken(): Promise<Pick<
  DbToken,
  "token_id" | "token_uri" | "artist"
> | null> {
  const { data } = await getDb()
    .from("tokens")
    .select("token_id, token_uri, artist")
    .order("token_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function getRecentTokens(
  limit: number,
): Promise<Pick<DbToken, "token_id" | "token_uri" | "artist" | "royalty_bps">[]> {
  const { data } = await getDb()
    .from("tokens")
    .select("token_id, token_uri, artist, royalty_bps")
    .order("token_id", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getAllTokens(): Promise<
  Pick<DbToken, "token_id" | "token_uri" | "artist">[]
> {
  const { data } = await getDb()
    .from("tokens")
    .select("token_id, token_uri, artist")
    .order("token_id", { ascending: false });
  return data ?? [];
}

export async function getTokensByArtist(
  artist: string,
): Promise<Pick<DbToken, "token_id" | "token_uri" | "royalty_bps">[]> {
  const { data } = await getDb()
    .from("tokens")
    .select("token_id, token_uri, royalty_bps")
    .eq("artist", artist)
    .order("token_id", { ascending: false });
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
