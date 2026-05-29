"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Client, networks } from "@molotov/stellar-client/molotov-nft";
import { Nav } from "@/components/nav";
import {
  NFT_CONTRACT_ID,
  contractExplorerUrl,
  truncateAddress,
} from "@/lib/stellar";

const RPC_URL = "https://soroban-testnet.stellar.org";
// A funded testnet account used only as the source for read-only simulation.
const READ_SOURCE = "GANXCETUVUUILGJPVEZWM7EH66IZM5OICUPMNUWNXKIBRK425MUKZERM";

function ipfsToGateway(uri: string): string {
  return uri.startsWith("ipfs://")
    ? `https://gateway.pinata.cloud/ipfs/${uri.slice("ipfs://".length)}`
    : uri;
}

type Phase = "chain" | "ipfs" | "ready" | "error";

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
  const [art, setArt] = useState<Artwork | null>(null);
  const [phase, setPhase] = useState<Phase>("chain");
  // timedOut state drives the error-screen copy; timedOutRef gives the async
  // IIFE a non-stale mutable flag to check without closure capture issues.
  const [timedOut, setTimedOut] = useState(false);
  const timedOutRef = useRef(false);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    timedOutRef.current = false;

    const timer = setTimeout(() => {
      if (!cancelled.current) {
        timedOutRef.current = true;
        setTimedOut(true);
        setPhase("error");
      }
    }, 10_000);

    (async () => {
      // Reset display state for this tokenId — inside the IIFE so they are
      // not synchronous top-level effect-body setState calls.
      setPhase("chain");
      setTimedOut(false);
      setArt(null);

      if (!Number.isInteger(tokenId)) {
        clearTimeout(timer);
        if (!cancelled.current) setPhase("error");
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

        if (cancelled.current || timedOutRef.current) return;
        setPhase("ipfs");

        let meta: { name?: string; description?: string; image?: string } = {};
        try {
          meta = await fetch(ipfsToGateway(uri)).then((r) => r.json());
        } catch {
          /* metadata unavailable — show what we have from chain */
        }

        if (cancelled.current || timedOutRef.current) return;
        clearTimeout(timer);
        setArt({
          title: meta.name ?? "Obra sin título",
          description: meta.description ?? "",
          image: meta.image ? ipfsToGateway(meta.image) : "",
          artist: owner,
          royaltyPct: (Number(bps) / 100).toFixed(1).replace(".", ","),
        });
        // Defer "ready" by one paint so React commits the art with opacity-0
        // first, giving the CSS transition an initial frame to animate from.
        requestAnimationFrame(() => {
          if (!cancelled.current) setPhase("ready");
        });
      } catch (err) {
        if (cancelled.current) return;
        clearTimeout(timer);
        console.error("[mi-obra] read failed", err);
        setPhase("error");
      }
    })();

    return () => {
      cancelled.current = true;
      clearTimeout(timer);
    };
  }, [tokenId]);

  const isLoading = phase === "chain" || phase === "ipfs";

  return (
    <div className="relative z-10 flex flex-1 flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16 md:px-10 md:py-24 lg:px-16">

        {isLoading && !art && (
          <div className="flex flex-col gap-4">
            <p className="font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.18em] text-[#F5F4ED]/60">
              {phase === "chain" ? "Leyendo on-chain…" : "Bajando de IPFS…"}
            </p>
            <div className="relative h-0.5 w-48 overflow-hidden bg-white/12 opacity-50">
              <span className="progress-fill" />
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            {timedOut ? (
              <>
                <p className="font-[family-name:var(--font-fraunces)] text-3xl [font-variation-settings:'opsz'_72]">
                  Esto está tardando más de lo normal.
                </p>
                <p className="mt-3 font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]/60">
                  Recargá la página.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-8 inline-flex h-10 items-center rounded-md bg-[#0178DE] px-5 font-[family-name:var(--font-geist-mono)] text-sm text-white transition-colors hover:bg-[#3493E5]"
                >
                  Recargar
                </button>
              </>
            ) : (
              <>
                <p className="font-[family-name:var(--font-fraunces)] text-3xl [font-variation-settings:'opsz'_72]">
                  No encontramos esa obra.
                </p>
                <Link
                  href="/crear"
                  className="mt-8 font-[family-name:var(--font-geist-mono)] text-sm text-[#0178DE] underline-offset-4 hover:underline"
                >
                  Mintear una obra
                </Link>
              </>
            )}
          </div>
        )}

        {art && (
          <div
            className={`transition-opacity duration-200 motion-reduce:transition-none ${
              phase === "ready" ? "opacity-100" : "opacity-0"
            }`}
          >
            <p className="font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.18em] text-[#0178DE]">
              Token #{tokenId}
            </p>
            <h1 className="mt-4 max-w-[18ch] font-[family-name:var(--font-fraunces)] text-[clamp(2.25rem,6vw,4.5rem)] font-light leading-[0.98] tracking-[-0.02em] [font-variation-settings:'opsz'_144]">
              ¡Tu obra está en <em className="italic text-[#0178DE]">blockchain</em>!
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
                    Imagen en IPFS
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-8">
                <dl className="space-y-5">
                  <div className="flex items-baseline justify-between border-b border-white/12 pb-3">
                    <dt className="text-sm text-[#F5F4ED]/60">Artista</dt>
                    <dd className="font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]">
                      {truncateAddress(art.artist, 6, 6)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-white/12 pb-3">
                    <dt className="text-sm text-[#F5F4ED]/60">Royalty</dt>
                    <dd className="font-[family-name:var(--font-geist-mono)] text-sm text-[#0178DE]">
                      {art.royaltyPct}%
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-white/12 pb-3">
                    <dt className="text-sm text-[#F5F4ED]/60">Red</dt>
                    <dd className="font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]/80">
                      Stellar testnet
                    </dd>
                  </div>
                </dl>

                <a
                  href={contractExplorerUrl(NFT_CONTRACT_ID)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center rounded-md bg-[#0178DE] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[#3493E5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4ED]"
                >
                  Ver certificado de autenticidad ↗
                </a>
                <Link
                  href="/crear"
                  className="font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]/70 underline-offset-4 transition-colors hover:text-[#F5F4ED] hover:underline"
                >
                  Mintear otra obra
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
