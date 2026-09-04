/**
 * Neutral stand-in for a work whose image is missing or could not be fetched.
 * Deliberately carries no brand mark and no token-ID watermark: a quiet
 * "broken image" glyph reads as an honest empty state, not a decoration.
 * Shared by token-view.tsx, artwork-card.tsx and token-card.tsx so every
 * surface says the same thing the same way.
 */
export function ArtworkPlaceholder({ label }: { label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-full flex-col items-center justify-center gap-4 px-8 py-10 text-center"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-10 w-10 text-white/20"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
        <line x1="2.5" y1="2.5" x2="21.5" y2="21.5" />
      </svg>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--smoke)]">
        {label}
      </span>
    </div>
  );
}
