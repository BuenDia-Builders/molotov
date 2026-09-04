"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

/** One-line pointer to /manifiesto, replacing the full inline section on the home page. */
export function ManifestoTeaser() {
  const { t } = useI18n();

  return (
    <section className="border-t border-black/10 bg-[var(--offwhite)] px-6 py-10 text-center">
      <Link
        href="/manifiesto"
        className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-[var(--black)]/60 underline-offset-4 transition-colors hover:text-[var(--black)] hover:underline"
      >
        {t("nav.manifesto")} ↗
      </Link>
    </section>
  );
}
