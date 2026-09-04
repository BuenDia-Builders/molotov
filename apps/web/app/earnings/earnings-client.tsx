"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { WalletButton } from "@/components/wallet-button";
import { useWallet } from "@/hooks/use-wallet";
import { useI18n } from "@/lib/i18n";
import { truncateAddress, txExplorerUrl } from "@/lib/stellar";
import type { ArtistEarnings, EarningEvent, TokenEarnings } from "@/lib/db/sales";

const MONO = "font-[family-name:var(--font-mono)]";
const LABEL = `${MONO} text-[10px] uppercase tracking-[0.3em] text-[var(--smoke)]`;

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

/** The headline: resale royalty. The one number no other marketplace can show. */
function RoyaltyHero({ data }: { data: ArtistEarnings }) {
  const { t } = useI18n();
  const hasRoyalties = data.royaltySalesCount > 0;

  return (
    <div className="border border-white/12 bg-[var(--carbon)] p-8 md:p-10">
      <p className={LABEL}>{t("earnings.royaltyLabel")}</p>

      <p
        className={`${MONO} mt-4 text-[clamp(2.5rem,8vw,4.5rem)] leading-none font-bold text-[var(--offwhite)]`}
      >
        {data.royaltyXlm} <span className="text-[0.4em] text-[var(--smoke)]">XLM</span>
      </p>

      {hasRoyalties ? (
        <>
          <p className={`${MONO} mt-4 text-[11px] text-[var(--ash)]`}>
            {fill(t("earnings.royaltyFromSales"), {
              sales: data.royaltySalesCount,
              tokens: data.royaltyTokensCount,
            })}
          </p>
          <p className={`${MONO} mt-2 text-[11px] text-[var(--smoke)]`}>
            {t("earnings.royaltyCaption")}
          </p>
        </>
      ) : (
        /* The most common state, and the one that must not look broken: a zero here
           is not a failure, it is a mechanism that has not fired yet. Explain it. */
        <>
          <p className={`${MONO} mt-4 text-[11px] text-[var(--ash)]`}>
            {t("earnings.royaltyNone")}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--smoke)]">
            {t("earnings.royaltyNoneExplain")}
          </p>
        </>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  caption,
  outlined = false,
  note,
}: {
  label: string;
  value: string;
  caption?: string;
  /** Outlined = a projection, not money received. Never styled like earned income. */
  outlined?: boolean;
  note?: string;
}) {
  return (
    <div
      className={
        outlined
          ? "border border-dashed border-white/20 p-6"
          : "border border-white/12 bg-[var(--carbon)] p-6"
      }
    >
      <p className={LABEL}>{label}</p>
      <p className={`${MONO} mt-3 text-2xl font-bold text-[var(--offwhite)]`}>
        {value} <span className="text-sm text-[var(--smoke)]">XLM</span>
      </p>
      {caption && <p className={`${MONO} mt-2 text-[10px] text-[var(--smoke)]`}>{caption}</p>}
      {note && <p className={`${MONO} mt-1 text-[10px] text-[var(--smoke)]/70`}>{note}</p>}
    </div>
  );
}

function PerTokenTable({ rows }: { rows: TokenEarnings[] }) {
  const { t } = useI18n();
  const sold = rows.filter((r) => r.salesCount > 0);

  if (!sold.length) {
    return <p className={`${LABEL} py-12 text-center`}>{t("earnings.perTokenEmpty")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-[var(--ember)]">
            {[
              t("earnings.colWork"),
              t("earnings.colSales"),
              t("earnings.colPrimary"),
              t("earnings.colRoyalty"),
              t("earnings.colTotal"),
              t("earnings.colStatus"),
            ].map((h, i) => (
              <th key={h} className={`${LABEL} py-3 ${i === 0 ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sold.map((row) => (
            <tr key={row.tokenId} className="border-b border-white/8">
              <td className={`${MONO} py-4 text-left text-sm text-[var(--offwhite)]`}>
                <a href={`/token/${row.tokenId}`} className="underline underline-offset-2">
                  #{row.tokenId}
                </a>
                <span className="ml-2 text-[10px] text-[var(--smoke)]">
                  {(row.royaltyBps / 100).toFixed(1)}%
                </span>
              </td>
              <td className={`${MONO} py-4 text-right text-sm text-[var(--ash)]`}>
                {row.salesCount}
              </td>
              <td className={`${MONO} py-4 text-right text-sm text-[var(--ash)]`}>
                {row.primaryXlm}
              </td>
              <td className={`${MONO} py-4 text-right text-sm`}>
                {row.recipientsCount > 1 ? (
                  /* Per-recipient amounts are not in the event stream — show the
                     badge rather than a number we cannot stand behind. */
                  <span className="border border-white/20 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-[var(--smoke)]">
                    {t("earnings.sharedBadge")}
                  </span>
                ) : (
                  <span className="text-[var(--offwhite)]">{row.royaltyXlm}</span>
                )}
              </td>
              <td className={`${MONO} py-4 text-right text-sm font-bold text-[var(--offwhite)]`}>
                {row.totalXlm}
              </td>
              <td className={`${MONO} py-4 text-right text-[10px] text-[var(--smoke)]`}>
                {row.listedForXlm
                  ? `${t("earnings.statusListed")} · ${row.listedForXlm}`
                  : t("earnings.statusNotListed")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityRow({ event }: { event: EarningEvent }) {
  const { t } = useI18n();
  const isRoyalty = event.kind === "royalty";

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/8 py-4">
      <span
        className={`${MONO} border px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] ${
          isRoyalty
            ? "border-[var(--blue)] text-[var(--blue-light)]"
            : "border-white/20 text-[var(--smoke)]"
        }`}
      >
        {isRoyalty ? t("earnings.badgeRoyalty") : t("earnings.badgePrimary")}
      </span>

      <a
        href={`/token/${event.tokenId}`}
        className={`${MONO} text-sm text-[var(--offwhite)] underline underline-offset-2`}
      >
        #{event.tokenId}
      </a>

      <span className={`${MONO} text-[10px] text-[var(--smoke)]`}>
        {truncateAddress(event.seller)} → {truncateAddress(event.buyer)}
      </span>

      <span className={`${MONO} ml-auto text-[10px] text-[var(--smoke)]`}>
        {t("earnings.price")} {event.priceXlm}
      </span>

      <span className={`${MONO} text-sm font-bold text-[var(--offwhite)]`}>
        +{event.earnedXlm} <span className="text-[10px] text-[var(--smoke)]">XLM</span>
      </span>

      <a
        href={txExplorerUrl(event.txHash)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${MONO} text-[10px] text-[var(--smoke)] hover:text-[var(--offwhite)]`}
      >
        {t("earnings.viewTx")} ↗
      </a>
    </li>
  );
}

export function EarningsClient() {
  const { t } = useI18n();
  const { address, isConnected } = useWallet();
  const [data, setData] = useState<ArtistEarnings | null>(null);
  const [loading, setLoading] = useState(false);
  // A flag, not a translated string: the message is resolved at render so it
  // follows a language switch instead of freezing the locale it failed in.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) return;

    let active = true;
    (async () => {
      try {
        setLoading(true);
        setFailed(false);
        const res = await fetch(`/api/earnings/mine?wallet=${encodeURIComponent(address)}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const json: ArtistEarnings = await res.json();
        if (active) setData(json);
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      setData(null);
      setLoading(false);
      setFailed(false);
    };
  }, [address, isConnected]);

  return (
    <div className="relative z-10 flex flex-1 flex-col min-h-screen bg-black text-[var(--offwhite)]">
      <Nav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16 md:px-10 md:py-24 lg:px-16">
        <div className="mb-8 flex items-baseline justify-between border-b border-[var(--ember)] pb-4">
          <h1 className="font-[family-name:var(--font-display)] text-[40px] font-bold uppercase tracking-tight text-[var(--offwhite)]">
            {t("earnings.title")}
          </h1>
        </div>

        {!isConnected || !address ? (
          <div className="flex flex-col items-center justify-center py-32">
            <p className={`${LABEL} mb-4 text-center`}>{t("earnings.connectWallet")}</p>
            <WalletButton />
          </div>
        ) : loading ? (
          <div className="flex flex-col gap-4">
            <div className="h-52 animate-pulse bg-[var(--ember)]" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse bg-[var(--ember)]" />
              ))}
            </div>
          </div>
        ) : failed ? (
          <div className="flex flex-col items-center justify-center py-32">
            <p className={`${MONO} mb-3 text-[10px] uppercase tracking-[0.3em] text-red-500`}>
              {t("earnings.loadError")}
            </p>
            <p className={`${LABEL} mb-6 text-center`}>{t("earnings.loadErrorHint")}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[var(--blue)] px-8 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:opacity-80"
            >
              {t("artwork.reload")}
            </button>
          </div>
        ) : !data ? null : data.mintedCount === 0 ? (
          /* First day: zeroed tiles would read as failure. Show the promise instead. */
          <div className="flex flex-col items-center justify-center py-32">
            <p className={`${LABEL} mb-4 text-center`}>{t("earnings.noWorksTitle")}</p>
            <p className="mb-8 max-w-md text-center text-sm leading-relaxed text-[var(--smoke)]">
              {t("earnings.noWorksBody")}
            </p>
            <a
              href="/create"
              className="bg-[var(--blue)] px-8 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:opacity-80"
            >
              {t("earnings.noWorksCta")}
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            <RoyaltyHero data={data} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile
                label={t("earnings.primaryLabel")}
                value={data.primaryXlm}
                caption={`${data.primarySalesCount} ${t("earnings.primaryCaption")}`}
              />
              <StatTile label={t("earnings.totalLabel")} value={data.totalXlm} />
              <StatTile
                label={t("earnings.listedLabel")}
                value={data.listedXlm}
                caption={t("earnings.listedCaption")}
                note={t("earnings.listedNotIncome")}
                outlined
              />
            </div>

            {data.sharedRoyalty && (
              <div className="border border-white/12 p-6">
                <p className={LABEL}>{t("earnings.sharedTitle")}</p>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--smoke)]">
                  {fill(t("earnings.sharedBody"), {
                    sales: data.sharedRoyalty.salesCount,
                    recipients: data.sharedRoyalty.recipients,
                    amount: data.sharedRoyalty.totalXlm,
                  })}
                </p>
              </div>
            )}

            {/* Minted but nothing sold yet: the tiles above are honest zeros, and
                "listed right now" may already be non-zero. Say what happens next. */}
            {data.activity.length === 0 && (
              <div className="border border-white/12 p-6">
                <p className={LABEL}>{t("earnings.noSalesTitle")}</p>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--smoke)]">
                  {t("earnings.noSalesBody")}
                </p>
              </div>
            )}

            <section>
              <h2 className={`${LABEL} mb-4 border-b border-[var(--ember)] pb-3`}>
                {t("earnings.perTokenTitle")}
              </h2>
              <PerTokenTable rows={data.perToken} />
            </section>

            {data.activity.length > 0 && (
              <section>
                <h2 className={`${LABEL} mb-4 border-b border-[var(--ember)] pb-3`}>
                  {t("earnings.activityTitle")}
                </h2>
                <ul>
                  {data.activity.map((event) => (
                    <ActivityRow key={`${event.ledger}-${event.eventIndex}`} event={event} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
