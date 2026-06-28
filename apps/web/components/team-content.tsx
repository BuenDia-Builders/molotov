"use client";

import { useI18n } from "@/lib/i18n";

export function TeamContent() {
  const { t } = useI18n();

  return (
    <main className="flex flex-1 flex-col">

      {/* Header — offwhite */}
      <section className="bg-[var(--offwhite)]">
        <div className="mx-auto max-w-7xl px-6 pt-10 pb-16 md:px-10 md:pt-14 md:pb-28 lg:px-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.4em] text-[var(--black)]/35">
            MOLOTOV
          </p>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-[var(--black)]/20">
            {t("about.pageDate")}
          </p>
          <h1 className="mt-10 font-[family-name:var(--font-display)] text-[clamp(2.5rem,8vw,7rem)] font-light leading-[0.92] tracking-[-0.025em] text-[var(--black)] [font-variation-settings:'opsz'_96]">
            {t("about.teamPageLabel")}
          </h1>
          <p className="mt-8 max-w-lg text-base leading-[1.75] text-[var(--black)]/55">
            {t("about.teamBody")}
          </p>
        </div>
      </section>

      {/* Creator 01 — dark */}
      <section className="bg-[var(--black)]">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-28 lg:px-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-24 lg:items-start">

            <div>
              <p className="mb-8 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--offwhite)]/25">
                01
              </p>
              <p className="font-[family-name:var(--font-display)] text-[clamp(2rem,5vw,4rem)] font-light leading-[0.95] tracking-[-0.02em] text-[var(--offwhite)] [font-variation-settings:'opsz'_72]">
                {t("about.janiaName")}
              </p>
              <p className="mt-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-[var(--offwhite)]/40">
                {t("about.janiaRole")}
              </p>
              <a
                href="https://www.linkedin.com/in/jania-m%C3%BCller/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-10 inline-block border-b border-[var(--blue)] pb-0.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-[var(--blue)] transition-opacity hover:opacity-70"
              >
                {t("about.linkedinArrow")}
              </a>
            </div>

            <div className="flex aspect-square items-center justify-center border border-dashed border-white/15">
              <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--offwhite)]/20">
                {t("about.janiaName")}
              </span>
            </div>

          </div>
        </div>
      </section>

      {/* Creator 02 — offwhite */}
      <section className="bg-[var(--offwhite)]">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-28 lg:px-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-24 lg:items-start">

            <div className="flex aspect-square items-center justify-center border border-dashed border-black/15 order-last lg:order-first">
              <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--black)]/20">
                {t("about.elisaName")}
              </span>
            </div>

            <div>
              <p className="mb-8 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--black)]/25">
                02
              </p>
              <p className="font-[family-name:var(--font-display)] text-[clamp(2rem,5vw,4rem)] font-light leading-[0.95] tracking-[-0.02em] text-[var(--black)] [font-variation-settings:'opsz'_72]">
                {t("about.elisaName")}
              </p>
              <p className="mt-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-[var(--black)]/40">
                {t("about.elisaRole")}
              </p>
              <a
                href="https://www.linkedin.com/in/arayamariaelisa/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-10 inline-block border-b border-[var(--blue)] pb-0.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-[var(--blue)] transition-opacity hover:opacity-70"
              >
                {t("about.linkedinArrow")}
              </a>
            </div>

          </div>
        </div>
      </section>

    </main>
  );
}
