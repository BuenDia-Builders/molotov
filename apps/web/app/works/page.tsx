import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { fetchIpfs, ipfsToGateway } from "@/lib/ipfs";
import { isDbConfigured, getRecentTokens, getActivePricesByTokenId } from "@/lib/db";

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

type WorksResult = { status: "ok"; works: Work[] } | { status: "empty" } | { status: "error" };

async function getWorks(): Promise<WorksResult> {
  if (!isDbConfigured()) return { status: "error" };

  let tokens: Awaited<ReturnType<typeof getRecentTokens>>;
  let priceByToken: Awaited<ReturnType<typeof getActivePricesByTokenId>>;
  try {
    [tokens, priceByToken] = await Promise.all([getRecentTokens(48), getActivePricesByTokenId()]);
  } catch {
    return { status: "error" };
  }

  if (!tokens.length) return { status: "empty" };

  const works: Work[] = await Promise.all(
    tokens.map(async (t) => {
      let title = `Token #${String(t.token_id).padStart(4, "0")}`;
      let image: string | undefined;

      try {
        const res = await fetchIpfs(t.token_uri, { signal: AbortSignal.timeout(5000) });
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

  return { status: "ok", works };
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
  const result = await getWorks();

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
          {result.status === "ok" && (
            <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.2em] text-[var(--smoke)] uppercase">
              {result.works.length} works
            </span>
          )}
        </div>

        {result.status === "error" && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.3em] uppercase text-red-500">
              Could not load works
            </p>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.2em] uppercase text-[var(--smoke)]">
              On-chain data is unavailable right now.
            </p>
          </div>
        )}

        {result.status === "empty" && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.3em] uppercase text-[var(--smoke)]">
              No works yet
            </p>
            <a
              href="/create"
              className="mt-5 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.2em] uppercase text-[var(--offwhite)] underline-offset-4 hover:underline"
            >
              Upload the first work →
            </a>
          </div>
        )}

        {result.status === "ok" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 lg:gap-8">
            {result.works.map((work) => (
              <WorkCard key={work.token_id} work={work} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
