"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { truncateAddress } from "@/lib/stellar";

type Result = { address: string; handle: string | null };

/**
 * Artist search for the nav. Debounced against /api/search/artists; a purely
 * numeric query jumps straight to that token. Results link to profiles.
 */
export function SearchBox({ variant = "bar" }: { variant?: "bar" | "block" }) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    const timer = setTimeout(async () => {
      if (q.length < 2) {
        setResults(null);
        setOpen(false);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/search/artists?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        setResults(json.results ?? []);
        setOpen(true);
      } catch {
        /* aborted or offline — keep whatever is shown */
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    if (/^#?\d+$/.test(q)) {
      router.push(`/token/${q.replace("#", "")}`);
      setOpen(false);
      return;
    }
    if (results && results.length > 0) {
      const first = results[0];
      router.push(`/artist/${first.handle ?? first.address}`);
      setOpen(false);
    }
  };

  const wide = variant === "block";

  return (
    <div ref={rootRef} className={`relative ${wide ? "w-full" : "w-full max-w-sm"}`}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results && setOpen(true)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={t("nav.searchPlaceholder")}
        aria-label={t("nav.searchLabel")}
        className="h-9 w-full border border-black/15 bg-white/60 px-3 font-[family-name:var(--font-mono)] text-[11px] text-[var(--black)] placeholder:text-[var(--black)]/35 focus:border-[var(--blue)] focus-ring"
      />
      {open && results && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 border border-black/10 bg-[var(--offwhite)] shadow-md">
          {results.length === 0 ? (
            <p className="px-3 py-3 font-[family-name:var(--font-mono)] text-[10px] text-[var(--black)]/50">
              {t("nav.searchNoResults")}
            </p>
          ) : (
            results.map((r) => (
              <button
                key={r.address}
                className="flex w-full min-h-10 items-center justify-between gap-3 px-3 text-left hover:bg-black/5"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  router.push(`/artist/${r.handle ?? r.address}`);
                }}
              >
                <span className="truncate font-[family-name:var(--font-mono)] text-[11px] text-[var(--black)]">
                  {r.handle ?? truncateAddress(r.address, 6, 6)}
                </span>
                {r.handle && (
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-[9px] text-[var(--black)]/40">
                    {truncateAddress(r.address, 4, 4)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
