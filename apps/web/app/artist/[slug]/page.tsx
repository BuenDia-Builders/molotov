import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import {
  isDbConfigured,
  findArtistByAddress,
  findArtistByHandle,
  getRecentSalesForTokens,
  getTokensByArtist,
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

  const artist = await resolveProfile(slug);
  if (!artist || artist.revoked) notFound();

  // Canonical URL: once a handle exists, the address form redirects to it.
  if (ADDRESS_RE.test(slug) && artist.handle) {
    permanentRedirect(`/artist/${artist.handle}`);
  }

  const tokens = await getTokensByArtist(artist.address);
  const sales = await getRecentSalesForTokens(
    tokens.map((t) => t.token_id),
    10,
  );

  const works: ProfileWork[] = await Promise.all(
    tokens.map(async (token) => {
      let image: string | null = null;
      let title: string | null = null;
      if (token.token_uri) {
        try {
          const res = await fetchIpfs(token.token_uri, {
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
      return { tokenId: token.token_id, royaltyBps: token.royalty_bps, image, title };
    }),
  );

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
          works={works}
          sales={sales}
          path={path}
        />
      </main>
      <Footer />
    </div>
  );
}
