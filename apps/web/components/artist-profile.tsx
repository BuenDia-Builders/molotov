"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShareButton } from "@/components/share-button";
import { useI18n } from "@/lib/i18n";
import { truncateAddress, txExplorerUrl } from "@/lib/stellar";
import type { ProfileActivity } from "@/lib/db/activity";

export type ProfileWork = {
  tokenId: number;
  royaltyBps: number;
  image: string | null;
  title: string | null;
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
  activity: ProfileActivity[];
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
  activity,
  path,
}: Props) {
  const { t } = useI18n();
  const displayName = handle ?? truncateAddress(address, 6, 6);
  // Collectors land on what they own; artists on what they made.
  const [tab, setTab] = useState<Tab>(registered || works.length > 0 ? "created" : "owned");

  const tabs: { id: Tab; label: string; count: number | null }[] = [
    { id: "created", label: t("artistProfile.tabCreated"), count: works.length },
    { id: "owned", label: t("artistProfile.tabOwned"), count: owned.length },
    { id: "activity", label: t("artistProfile.tabActivity"), count: activity.length },
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
        {tab === "activity" && <ProfileActivityFeed rows={activity} />}
      </section>
    </div>
  );
}

function ProfileActivityFeed({ rows }: { rows: ProfileActivity[] }) {
  const { t, locale } = useI18n();
  const labels: Record<ProfileActivity["kind"], string> = {
    minted: t("artistProfile.activityMinted"),
    listed: t("artistProfile.activityListed"),
    cancelled: t("artistProfile.activityCancelled"),
    bought: t("artistProfile.activityBought"),
    sold: t("artistProfile.activitySold"),
    sent: t("artistProfile.activitySent"),
    received: t("artistProfile.activityReceived"),
  };

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <p className="max-w-md font-mono text-[11px] leading-relaxed text-[var(--smoke)]">
          {t("artistProfile.activityEmpty")}
        </p>
        <p className="max-w-md font-mono text-[11px] leading-relaxed text-[var(--smoke)]/70">
          {t("artistProfile.activityLag")}
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-[var(--ember)] border-y border-[var(--ember)]">
        {rows.map((event) => (
          <li
            key={`${event.kind}-${event.ledger}-${event.eventIndex}`}
            className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-3"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--blue)]">
              {labels[event.kind]}
            </span>
            <Link
              href={`/token/${event.tokenId}`}
              className="font-mono text-[11px] text-[var(--offwhite)] underline underline-offset-4"
            >
              #{String(event.tokenId).padStart(4, "0")}
            </Link>
            {(event.kind === "listed" || event.kind === "bought" || event.kind === "sold") && (
              <span className="font-mono text-[11px] text-[var(--offwhite)]">
                {t("artistProfile.salePrice")} {event.priceXlm} XLM
              </span>
            )}
            {"royaltyXlm" in event && event.royaltyXlm != null && (
              <span className="font-mono text-[11px] text-[var(--blue)]">
                {t("artistProfile.saleRoyalty")} {event.royaltyXlm} XLM
              </span>
            )}
            {event.closedAt && (
              <span className="font-mono text-[10px] text-[var(--smoke)]">
                {new Date(event.closedAt).toLocaleDateString(locale === "es" ? "es-AR" : "en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
            <a
              href={txExplorerUrl(event.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto font-mono text-[10px] text-[var(--smoke)] underline underline-offset-2"
            >
              {t("artistProfile.saleTx")} →
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 font-mono text-[10px] text-[var(--smoke)]/70">
        {t("artistProfile.activityLag")}
      </p>
    </>
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
