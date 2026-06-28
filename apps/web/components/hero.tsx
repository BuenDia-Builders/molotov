import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type FeaturedWork = {
  token_id: number;
  title: string;
  artist_short: string;
  royalty_bps: number;
  price_xlm?: string;
  image?: string;
};

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
  const royaltyPct = (work.royalty_bps / 100).toFixed(work.royalty_bps % 100 === 0 ? 0 : 1);

  return (
    <section className="relative flex flex-col md:flex-row md:min-h-screen bg-[var(--carbon)]">

      {/* Left column — text */}
      <div className="w-full md:w-1/2 px-6 pt-16 pb-10 md:pt-32 md:pb-24 md:pl-16 md:pr-12 flex flex-col justify-center">
        <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.3em] text-[var(--smoke)] uppercase">
          Molotov · Open beta · Buenos Aires
        </span>
        <div className="w-16 h-px bg-[var(--ember)] mb-6 mt-4" />
        <h1 className="font-[family-name:var(--font-display)] font-black text-[clamp(2.4rem,5.5vw,5rem)] leading-[0.92] text-[var(--offwhite)]">
          Your work pays you every time it changes hands.
        </h1>
        <p className="font-[family-name:var(--font-body)] text-base text-[var(--smoke)] mt-5 leading-relaxed max-w-sm">
          Molotov writes the royalty into the contract when you mint. On every resale, you get paid before the sale closes. Not a promise — code.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/works"
            className="inline-block bg-[var(--blue)] text-white font-[family-name:var(--font-mono)] text-[10px] tracking-widest uppercase px-7 py-3 transition-opacity hover:opacity-80"
          >
            Explore works
          </Link>
          <Link
            href="/create"
            className="inline-block border border-[var(--ember)] text-[var(--offwhite)] font-[family-name:var(--font-mono)] text-[10px] tracking-widest uppercase px-7 py-3 transition-colors hover:border-[var(--offwhite)]"
          >
            Mint yours →
          </Link>
        </div>
      </div>

      {/* Right column — featured work */}
      <div className="w-full md:w-1/2 h-[70vw] md:h-auto md:min-h-screen overflow-hidden relative bg-gradient-to-br from-[var(--blue-deep)] to-[var(--blue)]">
        {work.image && (
          <Image
            src={work.image}
            alt={work.title}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        )}

        {/* Bottom gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Top-right: link to all works */}
        <Link
          href="/works"
          className="absolute top-4 right-4 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.2em] uppercase text-white/60 hover:text-white transition-colors"
        >
          All works ↗
        </Link>

        {/* Bottom: work info */}
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.25em] uppercase text-[var(--blue)] mb-1 truncate">
                #{String(work.token_id).padStart(4, "0")} · {work.artist_short}
              </p>
              <p className="font-[family-name:var(--font-display)] font-black text-xl md:text-[clamp(1.5rem,3vw,2.5rem)] leading-none text-white truncate">
                {work.title}
              </p>
            </div>
            <div className="text-right shrink-0">
              {work.price_xlm && (
                <p className="font-[family-name:var(--font-mono)] text-lg md:text-xl font-bold text-white leading-none">
                  {work.price_xlm} <span className="text-white/50 text-sm">XLM</span>
                </p>
              )}
              <p className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.2em] uppercase text-[var(--blue)] mt-1">
                {royaltyPct}% royalty
              </p>
            </div>
          </div>
          <Link
            href={`/token/${work.token_id}`}
            className="mt-4 inline-block bg-white text-black font-[family-name:var(--font-mono)] font-bold text-[10px] tracking-widest uppercase px-5 py-2.5 transition-opacity hover:opacity-80"
          >
            View work →
          </Link>
        </div>
      </div>

    </section>
  );
}
