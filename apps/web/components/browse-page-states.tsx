"use client";

// Client component for the localized error/empty states of /works and /artists.
//
// Why: those pages are async Server Components and useI18n() is client-only, so
// the "could not load" and empty-state copy (which must switch with the locale
// toggle) cannot live inline in the page. This component holds that copy.
//
// How: receives `status` ("error" | "empty") and `variant` ("works" | "artists").
// The page renders <BrowsePageStates status="error" variant="works" /> and so on.
// Class names match the original page markup; only the strings moved into t() calls.

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export function BrowsePageStates({
  status,
  variant,
}: {
  status: "error" | "empty";
  variant: "works" | "artists";
}) {
  const { t } = useI18n();

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.3em] uppercase text-red-500">
          {variant === "works" ? t("works.loadError") : t("artists.loadError")}
        </p>
        <p className="mt-3 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.2em] uppercase text-[var(--smoke)]">
          {t("errors.dataUnavailable")}
        </p>
      </div>
    );
  }

  if (variant === "works") {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.3em] uppercase text-[var(--smoke)]">
          {t("myWork.noWorks")}
        </p>
        <a
          href="/create"
          className="mt-5 font-[family-name:var(--font-mono)] text-[10px] tracking-[0.2em] uppercase text-[var(--offwhite)] underline-offset-4 hover:underline"
        >
          {t("works.uploadFirst")} →
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--smoke)] mb-6">
        {t("artists.noArtistsRegistered")}
      </p>
      <Link
        href="/create"
        className="inline-flex h-12 items-center justify-center bg-[var(--blue)] px-8 font-[family-family:var(--font-mono)] text-[10px] uppercase tracking-widest text-white transition-opacity hover:opacity-80"
      >
        {t("artists.beTheFirstMint")}
      </Link>
    </div>
  );
}
