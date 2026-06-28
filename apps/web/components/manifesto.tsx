"use client";

import { useI18n } from "@/lib/i18n";

export function Manifesto() {
  const { t } = useI18n();

  return (
    <section
      id="manifesto"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 py-40 md:px-10 md:py-60 lg:px-20"
    >
      <div className="grid gap-14 md:grid-cols-[auto_1fr] md:gap-28">
        <div className="md:pt-2">
          <p className="font-[family-name:var(--font-display)] text-2xl [font-variation-settings:'opsz'_40]">
            {t("manifesto.title")}
          </p>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-[13px] text-[var(--offwhite)]/40">
            {t("manifesto.placeDate")}
          </p>
        </div>

        <div className="max-w-2xl space-y-10 font-[family-name:var(--font-display)] text-xl leading-[1.65] tracking-[-0.005em] text-[var(--offwhite)]/90 [font-variation-settings:'opsz'_40] md:text-2xl">
          <p>
            {t("manifesto.p1Before")}{" "}
            <em className="italic text-[var(--blue)]">{t("manifesto.p1Em")}</em>
            {t("manifesto.p1After")}
          </p>
          <p>{t("manifesto.p2")}</p>
          <p>{t("manifesto.p3")}</p>
          <p>{t("manifesto.p4")}</p>
          <p className="font-[family-name:var(--font-mono)] text-[14px] text-[var(--offwhite)]/40 [font-variation-settings:initial]">
            {t("manifesto.signature")}
          </p>
        </div>
      </div>
    </section>
  );
}
