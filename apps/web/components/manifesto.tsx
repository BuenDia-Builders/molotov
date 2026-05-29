"use client";

import { useI18n } from "@/lib/i18n";

export function Manifesto() {
  const { t } = useI18n();

  return (
    <section
      id="manifiesto"
      className="mx-auto max-w-7xl scroll-mt-24 px-6 py-24 md:px-10 md:py-36 lg:px-16"
    >
      <div className="grid gap-10 md:grid-cols-[auto_1fr] md:gap-20">
        <div className="md:pt-2">
          <p className="font-[family-name:var(--font-fraunces)] text-2xl [font-variation-settings:'opsz'_40]">
            {t("manifesto.title")}
          </p>
          <p className="mt-1 font-[family-name:var(--font-geist-mono)] text-[13px] text-[#F5F4ED]/40">
            {t("manifesto.placeDate")}
          </p>
        </div>

        <div className="max-w-2xl space-y-7 font-[family-name:var(--font-fraunces)] text-xl leading-[1.5] tracking-[-0.005em] text-[#F5F4ED]/90 [font-variation-settings:'opsz'_40] md:text-2xl">
          <p>
            {t("manifesto.p1Before")}{" "}
            <em className="italic text-[#0178DE]">{t("manifesto.p1Em")}</em>
            {t("manifesto.p1After")}
          </p>
          <p>{t("manifesto.p2")}</p>
          <p>{t("manifesto.p3")}</p>
          <p>{t("manifesto.p4")}</p>
          <p className="font-[family-name:var(--font-geist-mono)] text-[14px] text-[#F5F4ED]/40 [font-variation-settings:initial]">
            {t("manifesto.signature")}
          </p>
        </div>
      </div>
    </section>
  );
}
