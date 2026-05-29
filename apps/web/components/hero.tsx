"use client";

import Link from "next/link";
import { ContractEvidence } from "@/components/contract-evidence";
import { useI18n } from "@/lib/i18n";

export function Hero() {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden pt-20 pb-16 md:pt-28 lg:pt-36">
      {/* Eyebrow — aligned to the page rail. Directed at one audience: artists. */}
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <p className="flex items-center gap-2.5 font-[family-name:var(--font-geist-mono)] text-[13px] uppercase tracking-[0.18em] text-[#F5F4ED]/60">
          <span
            aria-hidden
            className="inline-block size-1.5 rounded-full bg-[#0178DE] animate-breathe"
          />
          {t("hero.eyebrow")}
        </p>
      </div>

      {/* The h1 breaks the rail: shifted right and bleeding toward the edge. */}
      <div className="px-6 md:px-10 lg:px-16">
        <h1 className="mt-8 font-[family-name:var(--font-fraunces)] text-[clamp(2.75rem,9vw,8.5rem)] font-light leading-[0.95] tracking-[-0.02em] [font-variation-settings:'opsz'_144] md:ml-auto md:max-w-[82%] md:text-right lg:max-w-[70%] lg:-mr-[2vw]">
          {t("hero.titleBeforeEm")}{" "}
          <em className="font-normal italic text-[#0178DE]">{t("hero.titleEm")}</em>{" "}
          {t("hero.titleAfterEm")}
        </h1>
      </div>

      <div className="mx-auto mt-12 grid max-w-7xl gap-10 px-6 md:mt-16 md:grid-cols-[1fr_auto] md:items-end md:px-10 lg:px-16">
        {/* Left: information — body copy with its trust signal underneath. */}
        <div className="flex flex-col items-start gap-6">
          <p className="max-w-xl text-base leading-relaxed text-[#F5F4ED]/70 md:text-lg">
            {t("hero.body")}
          </p>
          {/* Soft trust badge: it backs the paragraph, not the CTA. */}
          <div id="contrato" className="scroll-mt-24">
            <ContractEvidence />
          </div>
        </div>

        {/* Right: action — primary CTA with the secondary path below. */}
        <div className="flex flex-col gap-3 sm:flex-row md:flex-col md:items-end">
          <Link
            href="/crear"
            className="inline-flex h-12 items-center justify-center rounded-md bg-[#0178DE] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[#3493E5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5F4ED]"
          >
            {t("common.mintFirst")}
          </Link>
          <a
            href="#actividad"
            className="inline-flex h-12 items-center justify-center px-2 font-[family-name:var(--font-geist-mono)] text-[14px] text-[#F5F4ED]/70 underline-offset-4 transition-colors hover:text-[#F5F4ED] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0178DE]"
          >
            {t("common.collectorsSeeWorks")}
          </a>
        </div>
      </div>
    </section>
  );
}
