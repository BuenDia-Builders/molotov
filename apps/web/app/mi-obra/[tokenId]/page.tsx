"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Client, networks } from "@molotov/stellar-client/molotov-nft";
import { Nav } from "@/components/nav";
import { NFT_CONTRACT_ID, contractExplorerUrl, truncateAddress } from "@/lib/stellar";
import { useI18n } from "@/lib/i18n";

const RPC_URL = "https://soroban-testnet.stellar.org";
// A funded testnet account used only as the source for read-only simulation.
const READ_SOURCE = "GANXCETUVUUILGJPVEZWM7EH66IZM5OICUPMNUWNXKIBRK425MUKZERM";

function ipfsToGateway(uri: string): string {
  return uri.startsWith("ipfs://")
    ? `https://gateway.pinata.cloud/ipfs/${uri.slice("ipfs://".length)}`
    : uri;
}

type Artwork = {
  title: string;
  description: string;
  image: string;
  artist: string;
  royaltyPct: string;
};

export default function MiObraPage() {
  const params = useParams<{ tokenId: string }>();
  const tokenId = Number(params.tokenId);
  const { locale, t } = useI18n();
  const [art, setArt] = useState<Artwork | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    (async () => {
      if (!Number.isInteger(tokenId)) {
        setStatus("error");
        return;
      }
      const client = new Client({
        contractId: networks.testnet.contractId,
        networkPassphrase: networks.testnet.networkPassphrase,
        rpcUrl: RPC_URL,
        publicKey: READ_SOURCE,
      });
      try {
        const [owner, bps, uri] = await Promise.all([
          client.owner_of({ token_id: tokenId }).then((t) => t.result),
          client.royalty_bps({ token_id: tokenId }).then((t) => t.result),
          client.token_uri({ token_id: tokenId }).then((t) => t.result),
        ]);

        let meta: { name?: string; description?: string; image?: string } = {};
        try {
          meta = await fetch(ipfsToGateway(uri)).then((r) => r.json());
        } catch {
          /* metadata unavailable - show what we have from chain */
        }

        setArt({
          title: meta.name ?? t("artwork.untitled"),
          description: meta.description ?? "",
          image: meta.image ? ipfsToGateway(meta.image) : "",
          artist: owner,
          royaltyPct:
            locale === "es"
              ? (Number(bps) / 100).toFixed(1).replace(".", ",")
              : (Number(bps) / 100).toFixed(1),
        });
        setStatus("ready");
      } catch (err) {
        console.error("[mi-obra] read failed", err);
        setStatus("error");
      }
    })();
  }, [locale, t, tokenId]);

  return (
    <div className="relative z-10 flex flex-1 flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16 md:px-10 md:py-24 lg:px-16">
        {status === "loading" && (
          <p className="font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]/60">
            {t("artwork.loading")}
          </p>
        )}

        {status === "error" && (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <p className="font-[family-name:var(--font-fraunces)] text-3xl [font-variation-settings:'opsz'_72]">
              {t("artwork.notFound")}
            </p>
            <Link
              href="/crear"
              className="mt-8 font-[family-name:var(--font-geist-mono)] text-sm text-[#0178DE] underline-offset-4 hover:underline"
            >
              {t("artwork.mintOne")}
            </Link>
          </div>
        )}

        {status === "ready" && art && (
          <>
            <p className="font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.18em] text-[#0178DE]">
              {t("artwork.tokenPrefix")} #{tokenId}
            </p>
            <h1 className="mt-4 max-w-[18ch] font-[family-name:var(--font-fraunces)] text-[clamp(2.25rem,6vw,4.5rem)] font-light leading-[0.98] tracking-[-0.02em] [font-variation-settings:'opsz'_144]">
              {t("artwork.successBefore")}{" "}
              <em className="italic text-[#0178DE]">{t("artwork.successEm")}</em>
              {t("artwork.successAfter")}
            </h1>
            <p className="mt-4 font-[family-name:var(--font-fraunces)] text-2xl text-[#F5F4ED]/80 [font-variation-settings:'opsz'_40]">
              {art.title}
            </p>

            <div className="mt-12 grid gap-10 md:grid-cols-2 md:gap-16">
              <div>
                {art.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={art.image}
                    alt={art.title}
                    className="w-full rounded-lg border border-white/12 object-contain"
                  />
                ) : (
                  <div className="flex aspect-[4/5] items-center justify-center rounded-lg border border-white/12 bg-[#0A0A0B] font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.18em] text-[#F5F4ED]/40">
                    {t("artwork.imageFallback")}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-8">
                <dl className="space-y-5">
                  <div className="flex items-baseline justify-between border-b border-white/12 pb-3">
                    <dt className="text-sm text-[#F5F4ED]/60">{t("artwork.artist")}</dt>
                    <dd className="font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]">
                      {truncateAddress(art.artist, 6, 6)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-white/12 pb-3">
                    <dt className="text-sm text-[#F5F4ED]/60">{t("artwork.royalty")}</dt>
                    <dd className="font-[family-name:var(--font-geist-mono)] text-sm text-[#0178DE]">
                      {art.royaltyPct}%
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-white/12 pb-3">
                    <dt className="text-sm text-[#F5F4ED]/60">{t("artwork.network")}</dt>
                    <dd className="font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]/80">
                      {t("artwork.networkName")}
                    </dd>
                  </div>
                </dl>

                <a
                  href={contractExplorerUrl(NFT_CONTRACT_ID)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center rounded-md bg-[#0178DE] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[#3493E5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4ED]"
                >
                  {t("artwork.certificate")} {t("common.externalArrow")}
                </a>
                <Link
                  href="/crear"
                  className="font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]/70 underline-offset-4 transition-colors hover:text-[#F5F4ED] hover:underline"
                >
                  {t("artwork.mintAnother")}
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
