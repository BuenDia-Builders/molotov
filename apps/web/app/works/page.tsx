import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Discover — Molotov",
  description: "Browse digital artworks with on-chain royalties on Stellar.",
};

type Work = {
  token_id: number;
  title: string;
  artist: string;
  artist_short: string;
  royalty_bps: number;
  price_xlm?: string;
  image?: string;
};

const MOCK_WORKS: Work[] = [
  {
    token_id: 1,
    title: "Paraná River",
    artist: "GABCDE...XYZ001",
    artist_short: "Carolina M.",
    royalty_bps: 1000,
    price_xlm: "50",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80",
  },
  {
    token_id: 2,
    title: "Mendoza Sky, III",
    artist: "GABCDE...XYZ002",
    artist_short: "Tomás P.",
    royalty_bps: 750,
    price_xlm: "90",
    image: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&q=80",
  },
  {
    token_id: 3,
    title: "Route 60 Bus",
    artist: "GABCDE...XYZ003",
    artist_short: "Joaquín R.",
    royalty_bps: 1200,
    price_xlm: "200",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
  },
  {
    token_id: 4,
    title: "Untitled (water series)",
    artist: "GABCDE...XYZ004",
    artist_short: "Renata B.",
    royalty_bps: 1500,
    price_xlm: "75",
    image: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600&q=80",
  },
  {
    token_id: 5,
    title: "Platform 4",
    artist: "GABCDE...XYZ005",
    artist_short: "Inés L.",
    royalty_bps: 500,
    price_xlm: "40",
    image: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=600&q=80",
  },
  {
    token_id: 6,
    title: "Siesta in Salta",
    artist: "GABCDE...XYZ006",
    artist_short: "Lucía V.",
    royalty_bps: 1000,
    price_xlm: "120",
    image: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80",
  },
];

async function getWorks(): Promise<{ works: Work[]; isMock: boolean }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { works: MOCK_WORKS, isMock: true };
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const { data, error } = await db
    .from("tokens")
    .select("token_id, token_uri, artist, royalty_bps")
    .order("token_id", { ascending: false })
    .limit(48);

  if (error || !data?.length) return { works: MOCK_WORKS, isMock: true };

  const works: Work[] = data.map((t) => ({
    token_id: t.token_id,
    title: `Token #${String(t.token_id).padStart(4, "0")}`,
    artist: t.artist,
    artist_short: `${t.artist.slice(0, 4)}…${t.artist.slice(-4)}`,
    royalty_bps: t.royalty_bps,
  }));

  return { works, isMock: false };
}

function WorkCard({ work }: { work: Work }) {
  const royaltyPct = (work.royalty_bps / 100).toFixed(work.royalty_bps % 100 === 0 ? 0 : 1);

  return (
    <Link
      href={`/token/${work.token_id}`}
      className="group flex flex-col border border-white/10 bg-[var(--carbon)] overflow-hidden transition-colors hover:border-[var(--blue)]/40"
    >
      {/* Image / gradient */}
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-[var(--blue-deep)] to-[var(--blue)]">
        {work.image && (
          <Image
            src={work.image}
            alt={work.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        )}
        {/* token number watermark */}
        <span className="absolute bottom-3 right-4 font-[family-name:var(--font-mono)] text-[40px] font-bold text-white/5 leading-none select-none pointer-events-none">
          {String(work.token_id).padStart(2, "0")}
        </span>
        {/* royalty badge */}
        <span className="absolute top-3 right-3 border border-white/20 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.15em] uppercase text-white/60 bg-black/30 backdrop-blur-sm">
          {royaltyPct}% royalty
        </span>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-2">
        <p className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.2em] uppercase text-[var(--blue)] truncate">
          {work.artist_short}
        </p>
        <p className="font-[family-name:var(--font-display)] font-bold text-[var(--offwhite)] text-base leading-tight truncate">
          {work.title}
        </p>
        {work.price_xlm && (
          <p className="font-[family-name:var(--font-mono)] text-sm text-[var(--offwhite)] mt-1">
            {work.price_xlm}{" "}
            <span className="text-[var(--smoke)] text-[11px]">XLM</span>
          </p>
        )}
      </div>
    </Link>
  );
}

export default async function WorksPage() {
  const { works, isMock } = await getWorks();

  return (
    <div className="relative z-10 flex flex-1 flex-col min-h-screen">
      <Nav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-16 md:px-10 md:py-20 lg:px-16">

        {/* Header */}
        <div className="flex items-baseline justify-between border-b border-[var(--ember)] pb-5 mb-10">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.3em] text-[var(--smoke)] uppercase mb-1">
              Molotov
            </p>
            <h1 className="font-[family-name:var(--font-display)] font-black text-[clamp(2rem,5vw,3.5rem)] leading-none text-[var(--offwhite)]">
              Discover
            </h1>
          </div>
          <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.2em] text-[var(--smoke)] uppercase">
            {works.length} works
          </span>
        </div>

        {/* Mock notice */}
        {isMock && (
          <div className="mb-8 border border-[var(--ember)] px-4 py-3">
            <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.15em] uppercase text-[var(--smoke)]">
              Sample works · Connect Supabase to see real on-chain data
            </p>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
          {works.map((work) => (
            <div key={work.token_id} className="bg-[var(--black)]">
              <WorkCard work={work} />
            </div>
          ))}
        </div>

      </main>
      <Footer />
    </div>
  );
}
