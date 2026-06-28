import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { ipfsToGateway } from "@/lib/ipfs";

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

  const [tokensRes, listingsRes] = await Promise.all([
    db
      .from("tokens")
      .select("token_id, token_uri, artist, royalty_bps")
      .order("token_id", { ascending: false })
      .limit(48),
    db.from("listings").select("token_id, price").eq("status", "active"),
  ]);

  if (tokensRes.error || !tokensRes.data?.length) return { works: MOCK_WORKS, isMock: true };

  const priceByToken = new Map<number, string>(
    (listingsRes.data ?? []).map((l) => [
      l.token_id,
      (BigInt(l.price) / BigInt(10_000_000)).toString(),
    ]),
  );

  const works: Work[] = await Promise.all(
    tokensRes.data.map(async (t) => {
      let title = `Token #${String(t.token_id).padStart(4, "0")}`;
      let image: string | undefined;

      try {
        const res = await fetch(ipfsToGateway(t.token_uri), {
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(5000),
        });
        const meta = await res.json();
        if (meta.name) title = meta.name;
        if (meta.image) image = ipfsToGateway(meta.image);
      } catch {
        /* fall through — show placeholder */
      }

      return {
        token_id: t.token_id,
        title,
        artist: t.artist,
        artist_short: `${t.artist.slice(0, 4)}…${t.artist.slice(-4)}`,
        royalty_bps: t.royalty_bps,
        price_xlm: priceByToken.get(t.token_id),
        image,
      };
    }),
  );

  return { works, isMock: false };
}

function WorkCard({ work }: { work: Work }) {
  const royaltyPct = (work.royalty_bps / 100).toFixed(work.royalty_bps % 100 === 0 ? 0 : 1);

  return (
    <Link
      href={`/token/${work.token_id}`}
      className="group flex flex-col bg-[var(--carbon)] overflow-hidden transition-transform duration-300 hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-[var(--blue-deep)] to-[var(--blue)]">
        {work.image && (
          <Image
            src={work.image}
            alt={work.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        )}
        {/* subtle token number watermark */}
        <span className="absolute bottom-3 right-4 font-[family-name:var(--font-mono)] text-[40px] font-bold text-white/4 leading-none select-none pointer-events-none">
          {String(work.token_id).padStart(2, "0")}
        </span>
      </div>

      {/* Caption */}
      <div className="px-5 py-5 flex flex-col gap-1.5">
        <p className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.22em] uppercase text-[var(--smoke)] truncate">
          {work.artist_short}
        </p>
        <p className="font-[family-name:var(--font-display)] font-bold text-[var(--offwhite)] text-[1.05rem] leading-snug truncate">
          {work.title}
        </p>
        <div className="flex items-center justify-between mt-2 pt-2.5 border-t border-white/8">
          <span className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.15em] uppercase text-[var(--smoke)]/60">
            {royaltyPct}% royalty
          </span>
          {work.price_xlm ? (
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)]">
              {work.price_xlm} <span className="text-[var(--smoke)]">XLM</span>
            </span>
          ) : (
            <span className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.12em] text-[var(--smoke)]/35">
              Not listed
            </span>
          )}
        </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 lg:gap-8">
          {works.map((work) => (
            <WorkCard key={work.token_id} work={work} />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
