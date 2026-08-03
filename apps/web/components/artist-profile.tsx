"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShareButton } from "@/components/share-button";
import { useI18n } from "@/lib/i18n";
import { truncateAddress } from "@/lib/stellar";

export type ProfileWork = {
  tokenId: number;
  royaltyBps: number;
  image: string | null;
  title: string | null;
};

export type ProfileSale = {
  tokenId: number;
  txHash: string;
  closedAt: string | null;
  priceXlm: string;
  royaltyXlm: string;
};

type Tab = "created" | "owned" | "activity";

type Props = {
  address: string;
  /** Team-curated vanity handle; display name falls back to the address. */
  handle: string | null;
  bio: string | null;
  /** False for collector wallets — every valid address gets a profile. */
  registered: boolean;
  works: ProfileWork[];
  owned: ProfileWork[];
  sales: ProfileSale[];
  /** Canonical path of this profile, for the share link. */
  path: string;
};

export function ArtistProfile({
  address,
  handle,
  bio,
  registered,
  works,
  owned,
  sales,
  path,
}: Props) {
  const { t, locale } = useI18n();
  const displayName = handle ?? truncateAddress(address, 6, 6);
  // Collectors land on what they own; artists on what they made.
  const [tab, setTab] = useState<Tab>(registered || works.length > 0 ? "created" : "owned");

  const tabs: { id: Tab; label: string; count: number | null }[] = [
    { id: "created", label: t("artistProfile.tabCreated"), count: works.length },
    { id: "owned", label: t("artistProfile.tabOwned"), count: owned.length },
    { id: "activity", label: t("artistProfile.tabActivity"), count: sales.length },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-14 md:px-10 md:py-20">
      {/* ── Header ── */}
      <header className="border-b border-[var(--ember)] pb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--smoke)]">
          {registered ? t("artistProfile.kicker") : t("artistProfile.kickerCollector")}
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-none tracking-[-0.02em] text-[var(--offwhite)]">
          {displayName}
        </h1>
        {handle && (
          <p className="mt-2 font-mono text-[11px] text-[var(--smoke)]">
            {truncateAddress(address, 6, 6)}
          </p>
        )}
        {registered && (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--blue)]">
            {t("artistProfile.registered")}
          </p>
        )}
        {bio && (
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-[var(--offwhite)]/80">
            {bio}
          </p>
        )}
        <div className="mt-7">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--smoke)]">
            {t("artistProfile.shareTitle")}
          </p>
          <ShareButton path={path} />
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="mt-8 flex gap-1 border-b border-[var(--ember)]">
        {tabs.map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`min-h-11 px-4 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
              tab === id
                ? "border-b-2 border-[var(--blue)] text-[var(--offwhite)]"
                : "text-[var(--smoke)] hover:text-[var(--offwhite)]"
            }`}
          >
            {label}
            {count !== null && count > 0 && (
              <span className="ml-2 text-[var(--smoke)]">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <section className="mt-8">
        {tab === "created" && (
          <WorksGrid
            works={works}
            empty={t("artistProfile.worksEmpty")}
            badge={t("artistProfile.royaltyBadge")}
          />
        )}
        {tab === "owned" && (
          <WorksGrid
            works={owned}
            empty={t("artistProfile.ownedEmpty")}
            badge={t("artistProfile.royaltyBadge")}
          />
        )}
        {tab === "activity" &&
          (sales.length === 0 ? (
            <p className="max-w-md font-mono text-[11px] leading-relaxed text-[var(--smoke)]">
              {t("artistProfile.salesEmpty")}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--ember)] border-y border-[var(--ember)]">
              {sales.map((sale) => (
                <li
                  key={sale.txHash}
                  className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-3"
                >
                  <Link
                    href={`/token/${sale.tokenId}`}
                    className="font-mono text-[11px] text-[var(--offwhite)] underline-offset-4 hover:underline"
                  >
                    #{String(sale.tokenId).padStart(4, "0")}
                  </Link>
                  <span className="font-mono text-[11px] text-[var(--offwhite)]">
                    {t("artistProfile.salePrice")} {sale.priceXlm} XLM
                  </span>
                  <span className="font-mono text-[11px] text-[var(--blue)]">
                    {t("artistProfile.saleRoyalty")} {sale.royaltyXlm} XLM
                  </span>
                  {sale.closedAt && (
                    <span className="font-mono text-[10px] text-[var(--smoke)]">
                      {new Date(sale.closedAt).toLocaleDateString(
                        locale === "es" ? "es-AR" : "en-US",
                        { day: "numeric", month: "short", year: "numeric" },
                      )}
                    </span>
                  )}
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${sale.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto font-mono text-[10px] text-[var(--smoke)] underline-offset-2 hover:underline"
                  >
                    {t("artistProfile.saleTx")} →
                  </a>
                </li>
              ))}
            </ul>
          ))}
      </section>
    </div>
  );
}

function WorksGrid({
  works,
  empty,
  badge,
}: {
  works: ProfileWork[];
  empty: string;
  badge: string;
}) {
  if (works.length === 0) {
    return <p className="font-mono text-[11px] text-[var(--smoke)]">{empty}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {works.map((work) => (
        <Link
          key={work.tokenId}
          href={`/token/${work.tokenId}`}
          className="group flex flex-col bg-[var(--carbon)] transition-transform duration-300 hover:-translate-y-0.5"
        >
          <div className="relative aspect-square overflow-hidden">
            {work.image ? (
              <Image
                src={work.image}
                alt={work.title ?? `#${work.tokenId}`}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                sizes="(max-width: 640px) 50vw, 25vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--blue-deep)] to-[var(--blue)]" />
            )}
          </div>
          <div className="flex items-baseline justify-between gap-2 px-3 py-2.5">
            <span className="truncate font-mono text-[11px] text-[var(--offwhite)]">
              {work.title ?? `#${work.tokenId}`}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-[var(--blue)]">
              {(work.royaltyBps / 100).toFixed(0)}% {badge}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
