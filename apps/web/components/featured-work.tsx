import Image from "next/image";
import Link from "next/link";
import { isDbConfigured, getRecentTokens, getActivePricesByTokenId } from "@/lib/db";
import { fetchIpfs, ipfsToGateway } from "@/lib/ipfs";

type Work = {
  token_id: number;
  title: string;
  artist_short: string;
  royalty_bps: number;
  price_xlm?: string;
  image?: string;
};

async function getRecentWorks(): Promise<Work[]> {
  if (!isDbConfigured()) return [];
  try {
    const [tokens, priceByToken] = await Promise.all([
      getRecentTokens(3),
      getActivePricesByTokenId(),
    ]);
    if (!tokens.length) return [];

    return Promise.all(
      tokens.map(async (t) => {
        let title = `Token #${String(t.token_id).padStart(4, "0")}`;
        let image: string | undefined;
        try {
          const res = await fetchIpfs(t.token_uri, { signal: AbortSignal.timeout(5000) });
          const meta = await res.json();
          if (meta.name) title = meta.name;
          if (meta.image) image = ipfsToGateway(meta.image);
        } catch {
          /* fall through */
        }
        return {
          token_id: t.token_id,
          title,
          artist_short: `${t.artist.slice(0, 4)}…${t.artist.slice(-4)}`,
          royalty_bps: t.royalty_bps,
          price_xlm: priceByToken.get(t.token_id),
          image,
        };
      }),
    );
  } catch {
    return [];
  }
}

function WorkCard({ work, slot }: { work?: Work; slot: number }) {
  const royaltyPct = work ? (work.royalty_bps / 100).toFixed(0) : null;
  const barWidth = royaltyPct ? `${Math.min(Number(royaltyPct), 100)}%` : "0%";

  const inner = (
    <article className="flex flex-col bg-[var(--black)] h-full">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2">
        <span
          className={`font-[family-name:var(--font-mono)] text-[9px] tracking-[0.25em] ${work ? "text-[var(--blue)]" : "text-[var(--offwhite)]/20"}`}
        >
          #{String(work?.token_id ?? slot).padStart(3, "0")}
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.2em] text-[var(--offwhite)]/20">
          STELLAR · MOLOTOV
        </span>
      </div>

      {/* Image area — fixed frame, contained artwork: any aspect ratio
          renders in full (no crop, no distortion, no layout shift). */}
      <div className="relative aspect-[4/5] border-b border-dashed border-white/10 overflow-hidden bg-[var(--carbon)]">
        {work?.image ? (
          <div className="absolute inset-0 p-5 flex items-center justify-center">
            <Image
              src={work.image}
              alt={work.title}
              fill
              className="object-contain transition-transform duration-700 group-hover:scale-105"
              sizes="(max-width: 1024px) 50vw, 33vw"
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--offwhite)]/20">
              {work ? "No image" : "Available"}
            </span>
          </div>
        )}
        {work?.price_xlm && (
          <span className="absolute right-3 top-3 border border-white/15 bg-black/40 backdrop-blur-sm px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-wider text-[var(--offwhite)]/70">
            {work.price_xlm} XLM
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={`font-[family-name:var(--font-display)] text-base leading-tight truncate [font-variation-settings:'opsz'_18] ${work ? "text-[var(--offwhite)]" : "text-[var(--offwhite)]/25"}`}
          >
            {work?.title ?? "Untitled"}
          </p>
        </div>
        <p
          className={`mt-1 text-xs truncate ${work ? "text-[var(--offwhite)]/50" : "text-[var(--offwhite)]/20"}`}
        >
          {work?.artist_short ?? "—"}
        </p>

        {/* Stats */}
        <div className="mt-4 space-y-2 border-t border-white/8 pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.2em] text-[var(--offwhite)]/30">
              Royalty
            </span>
            <div className="flex items-center gap-2">
              <div className="relative h-px w-16 bg-white/10">
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--blue)]"
                  style={{ width: barWidth }}
                />
              </div>
              <span
                className={`font-[family-name:var(--font-mono)] text-[9px] ${work ? "text-[var(--blue)]" : "text-[var(--offwhite)]/20"}`}
              >
                {royaltyPct ? `${royaltyPct}%` : "—%"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.2em] text-[var(--offwhite)]/20">
              Network
            </span>
            <span className="font-[family-name:var(--font-mono)] text-[9px] text-[var(--offwhite)]/20">
              Stellar Testnet
            </span>
          </div>
        </div>
      </div>
    </article>
  );

  if (!work) return inner;

  return (
    <Link
      href={`/token/${work.token_id}`}
      className="group block h-full hover:opacity-90 transition-opacity"
    >
      {inner}
    </Link>
  );
}

export async function FeaturedWork() {
  const works = await getRecentWorks();

  // Fill up to 3 slots
  const slots = [works[0], works[1], works[2]];

  return (
    <section className="bg-[var(--offwhite)]">
      <div className="mx-auto max-w-7xl px-6 py-36 md:px-10 md:py-52 lg:px-20">
        {/* Header — shifted right */}
        <div className="ml-auto max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl leading-tight tracking-[-0.01em] text-[var(--black)] [font-variation-settings:'opsz'_72] md:text-5xl">
            Recent <em className="italic text-[var(--blue)]">works</em>
          </h2>
          <p className="mt-8 max-w-md text-base leading-[1.75] text-[var(--black)]/60">
            Every piece minted on Molotov lives on Stellar with on-chain royalties — forever
            enforced, no middlemen.
          </p>
        </div>

        {/* Card grid */}
        <div className="mt-20 grid grid-cols-1 gap-px bg-black/8 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((work, i) => (
            <WorkCard key={work?.token_id ?? i} work={work} slot={i + 1} />
          ))}
        </div>

        <div className="mt-16 flex items-center gap-6">
          <Link
            href="/works"
            className="inline-flex h-12 items-center justify-center bg-[var(--black)] px-7 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--offwhite)] transition-colors hover:bg-[var(--blue)]"
          >
            View all works
          </Link>
          <Link
            href="/create"
            className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--black)]/40 underline-offset-4 hover:text-[var(--black)] hover:underline transition-colors"
          >
            Mint yours →
          </Link>
        </div>
      </div>
    </section>
  );
}
