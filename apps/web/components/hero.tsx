import { createClient } from "@supabase/supabase-js";
import { HeroContent, type FeaturedWork } from "./hero-content";

const MOCK_FEATURED: FeaturedWork = {
  token_id: 1,
  title: "Paraná River",
  artist_short: "Carolina M.",
  royalty_bps: 1000,
  price_xlm: "50",
  image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&q=85",
};

async function getFeatured(): Promise<FeaturedWork> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return MOCK_FEATURED;
  }
  try {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    const { data } = await db
      .from("tokens")
      .select("token_id, artist, royalty_bps")
      .order("token_id", { ascending: false })
      .limit(1)
      .single();
    if (!data) return MOCK_FEATURED;
    return {
      token_id: data.token_id,
      title: `Token #${String(data.token_id).padStart(4, "0")}`,
      artist_short: `${data.artist.slice(0, 4)}…${data.artist.slice(-4)}`,
      royalty_bps: data.royalty_bps,
    };
  } catch {
    return MOCK_FEATURED;
  }
}

export async function Hero() {
  const work = await getFeatured();
  return <HeroContent work={work} />;
}
