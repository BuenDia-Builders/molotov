"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Client, networks } from "@molotov/stellar-client/molotov-nft";
import { Nav } from "@/components/nav";
import {
  NFT_CONTRACT_ID,
  MARKETPLACE_CONTRACT_ID,
  RPC_URL,
  contractExplorerUrl,
  truncateAddress,
  READ_SOURCE,
} from "@/lib/stellar";
import { ipfsToGateway } from "@/lib/ipfs";
import { useI18n } from "@/lib/i18n";
import { useWallet } from "@/hooks/use-wallet";
import { useList } from "@/hooks/use-list";
import { useCancel } from "@/hooks/use-cancel";
import { WalletButton } from "@/components/wallet-button";

type Phase = "chain" | "ipfs" | "ready" | "error";

type Artwork = {
  title: string;
  description: string;
  image: string;
  artist: string;
  royaltyPct: string;
};

export default function MyWorkPage() {
  const params = useParams<{ tokenId: string }>();
  const tokenId = Number(params.tokenId);
  const { locale, t } = useI18n();
  const { address, isConnected } = useWallet();
  const { list, state: listState, errorKind: listError, listingId, reset: resetList } = useList();
  const { cancel, state: cancelState, errorKind: cancelError, reset: resetCancel } = useCancel();
  const [priceXlm, setPriceXlm] = useState("");
  const [art, setArt] = useState<Artwork | null>(null);
  const [activeListing, setActiveListing] = useState<{ listingId: bigint; seller: string } | null>(
    null,
  );
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
          title: meta.name ?? t("artwork.untitled"),
          description: meta.description ?? "",
          image: meta.image ? ipfsToGateway(meta.image) : "",
          artist: owner,
          royaltyPct:
            locale === "es"
              ? (Number(bps) / 100).toFixed(1).replace(".", ",")
              : (Number(bps) / 100).toFixed(1),
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
  }, [locale, t, tokenId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveListing(null);
  }, [tokenId]);

  useEffect(() => {
    if (!art || art.artist !== MARKETPLACE_CONTRACT_ID) return;
    fetch(`/api/tokens/${tokenId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.listing?.listing_id && d.listing?.seller) {
          setActiveListing({
            listingId: BigInt(d.listing.listing_id),
            seller: d.listing.seller,
          });
        }
      })
      .catch(() => {});
  }, [art, tokenId]);

  const isLoading = phase === "chain" || phase === "ipfs";

  return (
    <div className="relative z-10 flex flex-1 flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16 md:px-10 md:py-24 lg:px-16">
        {isLoading && !art && (
          <div className="flex flex-col gap-4">
            <p className="font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.18em] text-[#F5F4ED]/60">
              {phase === "chain" ? t("artwork.loadingChain") : t("artwork.loadingIpfs")}
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
                  {t("artwork.timeoutTitle")}
                </p>
                <p className="mt-3 font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]/60">
                  {t("artwork.timeoutBody")}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-8 inline-flex h-12 items-center justify-center rounded-md bg-[#0178DE] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[#3493E5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4ED]"
                >
                  {t("artwork.reload")}
                </button>
              </>
            ) : (
              <>
                <p className="font-[family-name:var(--font-fraunces)] text-3xl [font-variation-settings:'opsz'_72]">
                  {t("artwork.notFound")}
                </p>
                <Link
                  href="/create"
                  className="mt-8 font-[family-name:var(--font-geist-mono)] text-sm text-[#0178DE] underline-offset-4 hover:underline"
                >
                  {t("artwork.mintOne")}
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

                {/* Listing form */}
                <div className="mt-2 border-t border-white/12 pt-6">
                  <p className="mb-4 font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.18em] text-[#F5F4ED]/50">
                    List for sale
                  </p>

                  {/* Token is in escrow at the marketplace — already listed */}
                  {art.artist === MARKETPLACE_CONTRACT_ID && (
                    <div className="flex flex-col gap-3">
                      <p className="font-[family-name:var(--font-geist-mono)] text-[12px] text-[#0178DE]">
                        This work is currently listed for sale.
                      </p>
                      <Link
                        href={`/token/${tokenId}`}
                        className="font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]/70 underline-offset-4 hover:underline"
                      >
                        View listing →
                      </Link>

                      {/* Cancel listing — only visible to the seller */}
                      {activeListing && isConnected && address === activeListing.seller && (
                        <div className="mt-2 border-t border-white/8 pt-4">
                          {cancelState === "idle" && (
                            <button
                              onClick={async () => {
                                try {
                                  await cancel({ listingId: activeListing.listingId });
                                } catch {
                                  // error state handled by hook
                                }
                              }}
                              className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.15em] text-[#F5F4ED]/50 underline-offset-4 hover:text-[#F5F4ED] hover:underline transition-colors"
                            >
                              Cancel listing
                            </button>
                          )}

                          {cancelState === "cancelling" && (
                            <div className="flex flex-col gap-2">
                              <p className="font-[family-name:var(--font-geist-mono)] text-[12px] text-[#F5F4ED]/60">
                                Cancelling… sign in your wallet
                              </p>
                              <div className="relative h-0.5 w-full overflow-hidden bg-white/12">
                                <span className="progress-fill" />
                              </div>
                            </div>
                          )}

                          {cancelState === "success" && (
                            <p className="font-[family-name:var(--font-geist-mono)] text-[12px] text-[#F5F4ED]/60">
                              Listing cancelled — refresh to update status.
                            </p>
                          )}

                          {cancelState === "error" && (
                            <div className="flex flex-col gap-2">
                              <p className="font-[family-name:var(--font-geist-mono)] text-[12px] text-red-400">
                                {cancelError === "rejected"
                                  ? "Transaction rejected."
                                  : "Cancel failed — please try again."}
                              </p>
                              <button
                                onClick={resetCancel}
                                className="font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]/70 underline-offset-4 hover:underline"
                              >
                                Try again
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Not the owner — can't list */}
                  {art.artist !== MARKETPLACE_CONTRACT_ID &&
                    isConnected &&
                    address !== art.artist && (
                      <p className="font-[family-name:var(--font-geist-mono)] text-[12px] text-[#F5F4ED]/40">
                        Connect the wallet that owns this token to list it.
                      </p>
                    )}

                  {!isConnected && <WalletButton />}

                  {isConnected && address === art.artist && listState === "idle" && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          step="any"
                          placeholder="Price in XLM"
                          value={priceXlm}
                          onChange={(e) => setPriceXlm(e.target.value)}
                          className="h-12 flex-1 border border-white/20 bg-transparent px-4 font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED] placeholder:text-[#F5F4ED]/30 focus:border-[#0178DE] focus:outline-none"
                        />
                        <span className="font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]/50">
                          XLM
                        </span>
                      </div>
                      <button
                        disabled={!priceXlm || Number(priceXlm) <= 0}
                        onClick={async () => {
                          try {
                            await list({ tokenId, priceXlm: Number(priceXlm) });
                          } catch {
                            // error state handled by hook
                          }
                        }}
                        className="h-12 bg-[#F5F4ED] px-6 text-[15px] font-medium text-[#0A0A0A] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        List for sale
                      </button>
                    </div>
                  )}

                  {(listState === "approving" || listState === "listing") && (
                    <div className="flex flex-col gap-2">
                      <p className="font-[family-name:var(--font-geist-mono)] text-[12px] text-[#F5F4ED]/60">
                        {listState === "approving"
                          ? "Step 1/2 — Approve marketplace… sign in your wallet"
                          : "Step 2/2 — Creating listing… sign in your wallet"}
                      </p>
                      <div className="relative h-0.5 w-full overflow-hidden bg-white/12">
                        <span className="progress-fill" />
                      </div>
                    </div>
                  )}

                  {listState === "success" && (
                    <div className="flex flex-col gap-3">
                      <p className="font-[family-name:var(--font-geist-mono)] text-[12px] text-[#0178DE]">
                        Listed — listing #{listingId?.toString()}
                      </p>
                      <Link
                        href="/works"
                        className="font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]/70 underline-offset-4 hover:underline"
                      >
                        View in marketplace →
                      </Link>
                    </div>
                  )}

                  {listState === "error" && (
                    <div className="flex flex-col gap-3">
                      <p className="font-[family-name:var(--font-geist-mono)] text-[12px] text-red-400">
                        {listError === "approve_rejected"
                          ? "You rejected the approval — try again when ready."
                          : listError === "approve"
                            ? "Approval failed — transaction not confirmed."
                            : "Listing failed — transaction not confirmed."}
                      </p>
                      <button
                        onClick={resetList}
                        className="font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]/70 underline-offset-4 hover:underline"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>

                <Link
                  href="/create"
                  className="font-[family-name:var(--font-geist-mono)] text-sm text-[#F5F4ED]/70 underline-offset-4 transition-colors hover:text-[#F5F4ED] hover:underline"
                >
                  {t("artwork.mintAnother")}
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
