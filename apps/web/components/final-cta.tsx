"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export function FinalCta() {
  const { t } = useI18n();

  return (
    <section id="create" className="bg-[var(--black)] scroll-mt-24">
      <div className="mx-auto max-w-7xl px-6 py-40 md:px-10 md:py-64 lg:px-20">
        <h2 className="max-w-[16ch] font-[family-name:var(--font-display)] text-[clamp(2.5rem,9vw,8rem)] font-light leading-[0.95] tracking-[-0.02em] [font-variation-settings:'opsz'_144]">
          {t("finalCta.title")}
        </h2>

        <div className="mt-16 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link
            href="/create"
            className="inline-flex h-12 items-center justify-center bg-[var(--blue)] px-7 text-[15px] font-medium text-white transition-colors hover:bg-[var(--blue-light)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--offwhite)]"
          >
            {t("common.mintFirst")}
          </Link>
          <Link
            href="/works"
            className="inline-flex h-12 items-center px-2 font-[family-name:var(--font-mono)] text-[14px] text-[var(--offwhite)]/70 underline-offset-4 transition-colors hover:text-[var(--offwhite)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)]"
          >
            {t("common.collectorsSeeWorks")}
          </Link>
        </div>
      </div>
    </section>
  );
}
