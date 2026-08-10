import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import {
  isDbConfigured,
  findArtistByAddress,
  findArtistByHandle,
  getAllTokens,
  getRecentSalesForTokens,
  getTokensByArtist,
  getTokensOwnedByWallet,
} from "@/lib/db";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { ReferralCapture } from "@/components/referral-capture";
import { ArtistProfile, type ProfileWork } from "@/components/artist-profile";
import { fetchIpfs, ipfsToGateway } from "@/lib/ipfs";
import { truncateAddress } from "@/lib/stellar";

const ADDRESS_RE = /^G[A-Z2-7]{55}$/;

/**
 * One slug, two shapes: a Stellar address always resolves; a handle resolves
 * when the team assigned one. The handle URL is canonical — the address form
 * 301s to it so shared links converge.
 */
const resolveProfile = cache(async (slug: string) => {
  if (!isDbConfigured()) return null;
  return ADDRESS_RE.test(slug) ? findArtistByAddress(slug) : findArtistByHandle(slug);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  try {
    const { slug } = await params;
    const artist = await resolveProfile(decodeURIComponent(slug));
    if (!artist || artist.revoked) return { title: "Artista — Molotov" };
    const name = artist.handle ?? truncateAddress(artist.address, 6, 6);
    return {
      title: `${name} — Molotov`,
      description:
        artist.bio ??
        `Obras de ${name} en Molotov, con regalía garantizada por contrato en cada venta.`,
    };
  } catch {
    return { title: "Artista — Molotov" };
  }
}

export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);

  const fromDb = await resolveProfile(slug);
  if (fromDb?.revoked) notFound();

  // objkt-style universal profiles: a valid address that is not a registered
  // artist still gets a page (collectors own things too). Handles only exist
  // for registered artists.
  const registered = Boolean(fromDb);
  const artist =
    fromDb ??
    (ADDRESS_RE.test(slug) ? { address: slug, handle: null, bio: null, revoked: false } : null);
  if (!artist) notFound();

  // Canonical URL: once a handle exists, the address form redirects to it.
  if (ADDRESS_RE.test(slug) && artist.handle) {
    permanentRedirect(`/artist/${artist.handle}`);
  }

  const [created, ownedRows, visible] = await Promise.all([
    getTokensByArtist(artist.address),
    getTokensOwnedByWallet(artist.address),
    getAllTokens(),
  ]);
  const visibleIds = new Set(visible.map((t) => t.token_id));
  // The effective-owner view has no curation column — intersect with the
  // curated set, and keep only what this wallet actually holds.
  const owned = ownedRows.filter(
    (row) => row.effective_owner === artist.address && visibleIds.has(row.token_id),
  );

  const sales = await getRecentSalesForTokens(
    created.map((t) => t.token_id),
    10,
  );

  const hydrated = new Map<number, { image: string | null; title: string | null }>();
  await Promise.all(
    [
      ...created.map((t) => ({ id: t.token_id, uri: t.token_uri })),
      ...owned.map((t) => ({ id: t.token_id, uri: t.token_uri })),
    ]
      .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
      .map(async ({ id, uri }) => {
        let image: string | null = null;
        let title: string | null = null;
        if (uri) {
          try {
            const res = await fetchIpfs(uri, {
              revalidate: 3600,
              signal: AbortSignal.timeout(4000),
            });
            const meta = await res.json();
            if (meta.image) image = ipfsToGateway(meta.image);
            if (meta.name) title = meta.name;
          } catch {
            /* card renders with placeholder */
          }
        }
        hydrated.set(id, { image, title });
      }),
  );

  const toWork = (tokenId: number, royaltyBps: number): ProfileWork => ({
    tokenId,
    royaltyBps,
    image: hydrated.get(tokenId)?.image ?? null,
    title: hydrated.get(tokenId)?.title ?? null,
  });
  const works: ProfileWork[] = created.map((t) => toWork(t.token_id, t.royalty_bps));
  const ownedWorks: ProfileWork[] = owned.map((t) => toWork(t.token_id, t.royalty_bps));

  const path = `/artist/${artist.handle ?? artist.address}`;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--black)]">
      <Nav />
      {/* Landing on a shared profile attributes site-wide: any later buy credits the sharer. */}
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-6 pt-8 md:px-10">
          <Link
            href="/artists"
            className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--smoke)] transition-colors hover:text-[var(--offwhite)]"
          >
            ← Artists
          </Link>
        </div>
        <ArtistProfile
          address={artist.address}
          handle={artist.handle}
          bio={artist.bio}
          registered={registered}
          works={works}
          owned={ownedWorks}
          sales={sales}
          path={path}
        />
      </main>
      <Footer />
    </div>
  );
}
