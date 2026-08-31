"use client";

// Client component extracted from the /works and /artists Server Component pages.
//
// Why: the i18n hook useI18n() is client-only, but those pages are async Server
// Components. Any visible copy that must switch with the locale toggle has to live
// in a client component. This renders the page header (title + count) so the
// heading and the pluralized count go through apps/web/lib/i18n instead of being
// hardcoded English.
//
// How: receives `variant` ("works" | "artists") and `count`, and pulls the title
// plus the singular/plural labels from the dictionaries. The page stays a Server
// Component and simply renders <BrowsePageHeader ... />.

import { useI18n } from "@/lib/i18n";

export function BrowsePageHeader({
  variant,
  count,
}: {
  variant: "works" | "artists";
  count: number;
}) {
  const { t } = useI18n();

  const title = variant === "works" ? t("nav.discover") : t("nav.artists");
  const singular =
    variant === "works" ? t("landing.trending.piecesSingular") : t("artists.artistSingular");
  const plural =
    variant === "works" ? t("landing.trending.piecesPlural") : t("artists.artistPlural");

  return (
    <div className="flex items-baseline justify-between border-b border-[var(--ember)] pb-5 mb-10">
      <div>
        <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.3em] text-[var(--smoke)] uppercase mb-1">
          Molotov
        </p>
        <h1 className="font-[family-name:var(--font-display)] font-black text-[clamp(2rem,5vw,3.5rem)] leading-none text-[var(--offwhite)]">
          {title}
        </h1>
      </div>
      <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.2em] text-[var(--smoke)] uppercase">
        {count} {count === 1 ? singular : plural}
      </span>
    </div>
  );
}
