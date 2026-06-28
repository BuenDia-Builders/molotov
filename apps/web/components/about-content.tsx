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

      {/* What we believe — dark, Team ↗ bottom right */}
      <section className="bg-[var(--black)]">
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-32 lg:px-20">
          <div className="grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-24">
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-[var(--offwhite)]/30 lg:pt-2">
              {t("about.whatWeBelieveLabel")}
            </p>
            <div>
              <div className="space-y-8 font-[family-name:var(--font-display)] text-xl leading-[1.65] [font-variation-settings:'opsz'_24] md:text-2xl">
                <p className="text-[var(--offwhite)]/70">{t("about.whatWeBelieve1")}</p>
                <p className="text-[var(--offwhite)]/70">{t("about.whatWeBelieve2")}</p>
                <p className="text-[var(--blue)]">{t("about.whatWeBelieve3")}</p>
              </div>
              <div className="mt-14 flex justify-end">
                <Link
                  href="/team"
                  className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-[var(--offwhite)]/35 transition-colors hover:text-[var(--offwhite)]"
                >
                  {t("nav.team")} ↗
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
