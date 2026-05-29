"use client";

import { useI18n } from "@/lib/i18n";

// Sample data. Real activity will be indexed from on-chain events once the
// marketplace contract is live. Labeled as muestra so it never reads as a lie.
const ACTIVITY = ["first", "second", "third", "fourth", "fifth", "sixth"] as const;

export function ActivityFeed() {
  const { t } = useI18n();

  return (
    <section id="actividad" className="scroll-mt-24 px-4 py-24 md:px-6 md:py-36">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-[family-name:var(--font-fraunces)] text-3xl tracking-[-0.01em] [font-variation-settings:'opsz'_72] md:text-4xl">
          {t("activity.title")}
        </h2>
        <p className="shrink-0 font-[family-name:var(--font-geist-mono)] text-[12px] uppercase tracking-[0.16em] text-[#F5F4ED]/40">
          {t("activity.sampleData")}
        </p>
      </div>

      <ul className="mt-12 border-t border-white/12">
        {ACTIVITY.map((entry, i) => (
          <li
            key={i}
            className="grid grid-cols-1 gap-2 border-b border-white/12 py-5 md:grid-cols-[7rem_1fr_auto] md:items-baseline md:gap-8"
          >
            <span className="font-[family-name:var(--font-geist-mono)] text-[13px] text-[#F5F4ED]/40">
              {t(`activity.items.${entry}.when`)}
            </span>
            <p className="text-base text-[#F5F4ED]/80">
              <span className="text-[#F5F4ED]">{t(`activity.items.${entry}.seller`)}</span>{" "}
              {t("activity.sold")}{" "}
              <span className="font-[family-name:var(--font-fraunces)] italic [font-variation-settings:'opsz'_24]">
                «{t(`activity.items.${entry}.work`)}»
              </span>{" "}
              {t("activity.to")} {t(`activity.items.${entry}.buyer`)}.
            </p>
            <p className="font-[family-name:var(--font-geist-mono)] text-[13px] text-[#F5F4ED]/60 md:text-right">
              {t("activity.royalty")} {t(`activity.items.${entry}.royaltyPct`)} ·{" "}
              <span className="text-[#0178DE]">{t(`activity.items.${entry}.royaltyXlm`)} XLM</span>{" "}
              {t("activity.arrow")} {t(`activity.items.${entry}.artist`)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
