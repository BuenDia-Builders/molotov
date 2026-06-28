import { getDb } from "./client";

export type DbArtist = {
  address: string;
  registered_at_ledger: number;
  revoked: boolean;
};

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
