"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export function AboutContent() {
  const { t } = useI18n();

  return (
    <main className="flex flex-1 flex-col">

      {/* Header — offwhite */}
      <section className="bg-[var(--offwhite)]">
        <div className="mx-auto max-w-7xl px-6 pb-0 pt-10 md:px-10 md:pt-14 lg:px-20">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.4em] text-[var(--black)]/35">
            MOLOTOV
          </p>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-[var(--black)]/20">
            {t("about.pageDate")}
          </p>
          <h1 className="mt-10 font-[family-name:var(--font-display)] text-[clamp(2.5rem,8vw,7rem)] font-light leading-[0.92] tracking-[-0.025em] text-[var(--black)] [font-variation-settings:'opsz'_96]">
            {t("about.pageLabel")}
          </h1>
        </div>
      </section>

      {/* What we are — dark card on offwhite */}
      <section className="bg-[var(--offwhite)]">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-28 lg:px-20">
          <div className="bg-[var(--black)] px-8 py-14 md:px-16 md:py-20 lg:px-24 lg:py-28">
            <p className="mb-10 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--offwhite)]/30">
              {t("about.whatWeAreLabel")}
            </p>
            <p className="mx-auto max-w-3xl text-center font-[family-name:var(--font-display)] text-[clamp(1.4rem,3.5vw,2.8rem)] font-light leading-[1.25] tracking-[-0.01em] text-[var(--offwhite)] [font-variation-settings:'opsz'_72]">
              {t("about.whatWeAre")}
            </p>
          </div>
        </div>
      </section>

      {/* What we do — offwhite */}
      <section className="bg-[var(--offwhite)]">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-32 lg:px-20">
          <div className="grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-24">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-[var(--black)]/40 lg:pt-2">
              {t("about.whatWeDoLabel")}
            </p>
            <div className="space-y-8">
              <p className="font-[family-name:var(--font-display)] text-xl leading-[1.65] text-[var(--black)] [font-variation-settings:'opsz'_24] md:text-2xl">
                {t("about.whatWeDo1")}
              </p>
              <p className="text-base leading-[1.8] text-[var(--black)]/55">
                {t("about.whatWeDo2")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What we believe — dark */}
      <section className="bg-[var(--black)]">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-32 lg:px-20">
          <div className="grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-24">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-[var(--offwhite)]/30 lg:pt-2">
              {t("about.whatWeBelieveLabel")}
            </p>
            <div className="space-y-8 font-[family-name:var(--font-display)] text-xl leading-[1.65] [font-variation-settings:'opsz'_24] md:text-2xl">
              <p className="text-[var(--offwhite)]/70">{t("about.whatWeBelieve1")}</p>
              <p className="text-[var(--offwhite)]/70">{t("about.whatWeBelieve2")}</p>
              <p className="text-[var(--blue)]">{t("about.whatWeBelieve3")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* The creators — offwhite, links to /team */}
      <section className="bg-[var(--offwhite)]">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-32 lg:px-20">

          <div className="mb-14 flex items-baseline justify-between gap-4">
            <div>
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-[var(--black)]/40">
                {t("about.teamLabel")}
              </p>
              <p className="mt-4 max-w-lg text-base leading-[1.75] text-[var(--black)]/55">
                {t("about.teamBody")}
              </p>
            </div>
            <Link
              href="/team"
              className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-[var(--black)]/35 transition-colors hover:text-[var(--black)]"
            >
              {t("about.teamPageLabel")} ↗
            </Link>
          </div>

          <div className="grid gap-px bg-black/10 sm:grid-cols-2">

            <article className="bg-[var(--offwhite)] p-8 md:p-12">
              <p className="mb-8 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--black)]/25">
                01
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-light text-[var(--black)] [font-variation-settings:'opsz'_32] md:text-3xl">
                {t("about.janiaName")}
              </p>
              <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-[var(--black)]/40">
                {t("about.janiaRole")}
              </p>
              <a
                href="https://www.linkedin.com/in/jania-m%C3%BCller/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-block border-b border-[var(--blue)] pb-0.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-[var(--blue)] transition-opacity hover:opacity-70"
              >
                {t("about.linkedinArrow")}
              </a>
            </article>

            <article className="bg-[var(--offwhite)] p-8 md:p-12">
              <p className="mb-8 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--black)]/25">
                02
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-light text-[var(--black)] [font-variation-settings:'opsz'_32] md:text-3xl">
                {t("about.elisaName")}
              </p>
              <p className="mt-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-[var(--black)]/40">
                {t("about.elisaRole")}
              </p>
              <a
                href="https://www.linkedin.com/in/arayamariaelisa/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-block border-b border-[var(--blue)] pb-0.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-[var(--blue)] transition-opacity hover:opacity-70"
              >
                {t("about.linkedinArrow")}
              </a>
            </article>

          </div>
        </div>
      </section>

    </main>
  );
}
