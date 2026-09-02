import Link from "next/link";
import { Suspense, cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isDbConfigured, findTokenById, findActiveListingByToken, stroopsToXlm } from "@/lib/db";
import { Nav } from "@/components/nav";
import { ReferralCapture } from "@/components/referral-capture";
import { TokenView, type TokenMeta } from "@/components/token-view";
import { WorkViewTracker } from "@/components/work-view-tracker";
import { fetchIpfs, ipfsToGateway } from "@/lib/ipfs";
import { truncateAddress } from "@/lib/stellar";
import { getXlmUsdRate, formatUsdEstimate } from "@/lib/price";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}): Promise<Metadata> {
  const fallback: Metadata = { title: "Obra — Molotov" };
  try {
    const { tokenId } = await params;
    const id = Number(tokenId);
    if (isNaN(id)) return fallback;

    const data = await getTokenData(id);
    if (!data || "error" in data) return fallback;

    const { token, listing, meta } = data;
    const displayTitle = meta.title || `Obra #${token.token_id}`;
    const artist = truncateAddress(token.artist);
    const royaltyPct = (token.royalty_bps / 100).toFixed(0);
    const description = listing
      ? `${artist} · ${stroopsToXlm(listing.price)} XLM · ${royaltyPct}% de regalía para quien la creó, en cada venta en Molotov.`
      : `${artist} · ${royaltyPct}% de regalía para quien la creó, en cada venta en Molotov.`;

    return {
      title: `${displayTitle} — Molotov`,
      description,
      openGraph: {
        title: `${displayTitle} — Molotov`,
        description,
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title: `${displayTitle} — Molotov`,
        description,
      },
    };
  } catch {
    return fallback;
  }
}

// cache(): generateMetadata and the page render both need this — one fetch per request.
const getTokenData = cache(async (tokenId: number) => {
  if (!isDbConfigured()) return { error: true as const };

  const [token, listing] = await Promise.all([
    findTokenById(tokenId),
    findActiveListingByToken(tokenId),
  ]);

  if (!token) return null;

  const meta: TokenMeta = {
    title: "",
    imageUrl: "",
    tags: [],
    category: null,
    license: null,
    nsfw: false,
    flashing: false,
    attributes: [],
  };
  if (token.token_uri) {
    try {
      const res = await fetchIpfs(token.token_uri, { revalidate: 3600 });
      const raw = await res.json();
      if (raw.image) meta.imageUrl = ipfsToGateway(raw.image);
      if (raw.name) meta.title = raw.name;
      if (Array.isArray(raw.tags))
        meta.tags = raw.tags.filter((x: unknown) => typeof x === "string");
      if (typeof raw.category === "string") meta.category = raw.category;
      if (typeof raw.license === "string") meta.license = raw.license;
      meta.nsfw = raw.contentRating === "mature";
      meta.flashing = Boolean(
        raw.accessibility?.hazards?.includes && raw.accessibility.hazards.includes("flashing"),
      );
      if (Array.isArray(raw.attributes)) {
        meta.attributes = raw.attributes.filter(
          (a: unknown): a is { trait_type: string; value: string } =>
            typeof (a as { trait_type?: unknown })?.trait_type === "string" &&
            typeof (a as { value?: unknown })?.value === "string",
        );
      }
    } catch {
      /* fall through to placeholder */
    }
  }

  return { token, listing, meta };
});

export default async function TokenPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await params;
  const id = Number(tokenId);
  if (isNaN(id)) notFound();

  const data = await getTokenData(id);
  if (!data) notFound();

  if ("error" in data) {
    return (
      <div className="min-h-screen bg-[var(--black)]">
        <Nav />
        <div className="flex flex-col items-center justify-center px-8 py-40 text-center">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-red-500">
            Could not load this work
          </p>
          <p className="mt-3 font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--smoke)]">
            On-chain data is unavailable right now.
          </p>
          <Link
            href="/works"
            className="mt-6 font-mono text-[10px] tracking-[0.2em] uppercase text-[var(--offwhite)] underline-offset-4 hover:underline"
          >
            ← Discover
          </Link>
        </div>
      </div>
    );
  }

  const { token, listing, meta } = data;
  const priceXlm = listing ? stroopsToXlm(listing.price) : null;
  const priceUsd = priceXlm ? formatUsdEstimate(priceXlm, await getXlmUsdRate()) : null;

  return (
    <div className="min-h-screen bg-[var(--black)]">
      <Nav />
      <Suspense fallback={null}>
        <ReferralCapture tokenId={id} />
      </Suspense>
      <WorkViewTracker tokenId={id} listed={Boolean(listing)} />
      <TokenView
        token={{
          token_id: token.token_id,
          artist: token.artist,
          owner: token.owner,
          royalty_bps: token.royalty_bps,
          recipients_count: token.recipients_count,
        }}
        listing={
          listing
            ? {
                listing_id: listing.listing_id,
                kind: listing.kind,
                editions_total: listing.editions_total,
                editions_sold: listing.editions_sold,
              }
            : null
        }
        priceXlm={priceXlm}
        priceUsd={priceUsd}
        meta={meta}
      />
    </div>
  );
}
