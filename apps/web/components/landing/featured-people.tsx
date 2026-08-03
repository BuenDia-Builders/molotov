"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { truncateAddress } from "@/lib/stellar";
import type { FeaturedCreator, TopCollector } from "@/lib/db/landing";

type Props = {
  creators: FeaturedCreator[];
  collectors: TopCollector[];
};

/** Two honest leaderboards: who makes, who collects. Real rows only. */
export function FeaturedPeople({ creators, collectors }: Props) {
  const { t } = useI18n();

  if (creators.length === 0 && collectors.length === 0) return null;

  return (
    <section className="bg-[var(--offwhite)] px-6 py-16 md:px-12 md:py-20">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-14 md:grid-cols-2">
        {/* Creators */}
        <div>
          <div className="mb-6 flex items-baseline justify-between border-b border-black/10 pb-4">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--black)]">
              {t("landing.people.creatorsTitle")}
            </h2>
            <Link
              href="/artists"
              className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--black)]/50 underline-offset-4 hover:text-[var(--black)] hover:underline"
            >
              {t("landing.people.viewArtists")} ↗
            </Link>
          </div>
          {creators.length === 0 ? (
            <p className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--black)]/45">
              {t("landing.people.empty")}
            </p>
          ) : (
            <ol className="flex flex-col">
              {creators.map((c, i) => (
                <li key={c.address}>
                  <Link
                    href={`/artist/${c.handle ?? c.address}`}
                    className="group flex items-baseline gap-4 border-b border-black/5 py-3"
                  >
                    <span className="w-6 font-[family-name:var(--font-mono)] text-[11px] text-[var(--black)]/35">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-[family-name:var(--font-mono)] text-[13px] text-[var(--black)] group-hover:underline">
                      {c.handle ?? truncateAddress(c.address, 6, 6)}
                    </span>
                    <span className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] text-[var(--black)]/45">
                      {c.works}{" "}
                      {c.works === 1
                        ? t("landing.trending.piecesSingular")
                        : t("landing.trending.piecesPlural")}
                    </span>
                    {c.volumeXlm !== "0" && (
                      <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] text-[var(--blue)]">
                        {c.volumeXlm} XLM {t("landing.people.soldLabel")}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Collectors */}
        <div>
          <div className="mb-6 flex items-baseline justify-between border-b border-black/10 pb-4">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--black)]">
              {t("landing.people.collectorsTitle")}
            </h2>
          </div>
          {collectors.length === 0 ? (
            <p className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--black)]/45">
              {t("landing.people.empty")}
            </p>
          ) : (
            <ol className="flex flex-col">
              {collectors.map((c, i) => (
                <li
                  key={c.address}
                  className="flex items-baseline gap-4 border-b border-black/5 py-3"
                >
                  <span className="w-6 font-[family-name:var(--font-mono)] text-[11px] text-[var(--black)]/35">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-[family-name:var(--font-mono)] text-[13px] text-[var(--black)]">
                    {truncateAddress(c.address, 6, 6)}
                  </span>
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] text-[var(--black)]/45">
                    {c.purchases}{" "}
                    {c.purchases === 1
                      ? t("landing.people.purchasesSingular")
                      : t("landing.people.purchasesPlural")}
                  </span>
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] text-[var(--blue)]">
                    {c.spentXlm} XLM {t("landing.people.collectedLabel")}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
