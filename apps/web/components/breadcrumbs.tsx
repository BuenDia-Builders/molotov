import Link from "next/link";

export type Crumb = { label: string; href?: string };

/**
 * A fixed trail, not browser history — unlike a "← back" link, it's honest
 * about where each step actually goes regardless of how the user arrived
 * (search, a share link, an artist profile, …).
 */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--smoke)]"
    >
      {trail.map((crumb, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden="true" className="text-[var(--smoke)]/40">
              /
            </span>
          )}
          {crumb.href ? (
            <Link href={crumb.href} className="transition-colors hover:text-[var(--offwhite)]">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-[var(--offwhite)]/70">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
