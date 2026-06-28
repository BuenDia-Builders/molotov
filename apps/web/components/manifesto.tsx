"use client";

import { useI18n } from "@/lib/i18n";

export function Manifesto() {
  const { t } = useI18n();

  return (
    <section id="manifesto" className="bg-[var(--offwhite)] scroll-mt-24">
      <div className="mx-auto max-w-7xl px-6 py-40 md:px-10 md:py-60 lg:px-20">

        {/* Label — small, left, dark */}
        <div className="mb-16 md:mb-20">
          <p className="font-[family-name:var(--font-display)] text-xl text-[var(--black)] [font-variation-settings:'opsz'_40]">
            {t("manifesto.title")}
          </p>
          <p className="mt-2 font-[family-name:var(--font-mono)] text-[13px] text-[var(--black)]/40">
            {t("manifesto.placeDate")}
          </p>
        </div>

        {/* Dark card — full width, like El Gato y La Caja */}
        <div className="bg-[var(--black)] px-8 py-14 md:px-16 md:py-20 lg:px-24 lg:py-28">
          <div className="mx-auto max-w-2xl space-y-10 font-[family-name:var(--font-display)] text-xl leading-[1.65] tracking-[-0.005em] text-[var(--offwhite)]/90 [font-variation-settings:'opsz'_40] md:text-2xl">
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

      </div>
    </section>
  );
}
