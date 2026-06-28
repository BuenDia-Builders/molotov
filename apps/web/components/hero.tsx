import { isDbConfigured, getLatestToken } from "@/lib/db";
import { ipfsToGateway } from "@/lib/ipfs";
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
  if (!isDbConfigured()) return MOCK_FEATURED;
  try {
    const data = await getLatestToken();
    if (!data) return MOCK_FEATURED;

    let title = `Token #${String(data.token_id).padStart(4, "0")}`;
    let image: string | undefined;
    if (data.token_uri) {
      try {
        const res = await fetch(ipfsToGateway(data.token_uri), {
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(5000),
        });
        const meta = await res.json();
        if (meta.name) title = meta.name;
        if (meta.image) image = ipfsToGateway(meta.image);
      } catch {
        /* fall through */
      }
    }

    return {
      token_id: data.token_id,
      title,
      artist_short: `${data.artist.slice(0, 4)}…${data.artist.slice(-4)}`,
      royalty_bps: 1000,
      image,
    };
  } catch {
    return MOCK_FEATURED;
  }
}

export async function Hero() {
  const work = await getFeatured();
  return <HeroContent work={work} />;
}
