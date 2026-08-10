"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

/**
 * objkt-style "Crear" panel: illustrated cards instead of a bare link. Only
 * what exists gets a live card — collections are visibly "Pronto", not a
 * dead end pretending to work.
 */
export function CreateMenu() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative hidden sm:block">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex min-h-11 items-center font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] transition-colors ${
          open ? "text-[var(--black)]" : "text-[var(--black)]/60 hover:text-[var(--black)]"
        }`}
      >
        {t("nav.create")}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-1/2 z-50 mt-3 w-[560px] max-w-[92vw] -translate-x-1/2 border border-white/12 bg-[var(--black)] p-5 shadow-xl"
        >
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <p className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--offwhite)]">
              {t("nav.create")}
            </p>
            <p className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--smoke)]">
              {t("nav.createMenu.tagline")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* ── Upload a work — live ── */}
            <Link
              href="/create"
              onClick={() => setOpen(false)}
              className="group border border-white/10 transition-colors hover:border-[var(--blue)]"
            >
              <WorkArt />
              <div className="p-4">
                <p className="font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--offwhite)]">
                  {t("nav.createMenu.workTitle")}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--offwhite)]/60">
                  {t("nav.createMenu.workBody")}
                </p>
              </div>
            </Link>

            {/* ── Collections — honestly not yet ── */}
            <div className="relative cursor-default border border-white/10 opacity-70">
              <span className="absolute right-3 top-3 z-10 bg-[var(--blue)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-[0.2em] text-white">
                {t("nav.createMenu.soon")}
              </span>
              <CollectionArt />
              <div className="p-4">
                <p className="font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--offwhite)]">
                  {t("nav.createMenu.collectionTitle")}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--offwhite)]/60">
                  {t("nav.createMenu.collectionBody")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Brand SVGs — Molotov blues on carbon, one motif per card ─────────────── */

/** A single work: the frame, and the flame it carries. */
function WorkArt() {
  return (
    <svg viewBox="0 0 280 120" className="block h-28 w-full bg-[var(--carbon)]" aria-hidden>
      <rect x="92" y="14" width="96" height="92" fill="none" stroke="#1564FF" strokeWidth="2" />
      <rect x="104" y="26" width="72" height="68" fill="#0D3FA8" opacity="0.35" />
      {/* flame */}
      <path
        d="M140 44 C 133 56, 128 62, 128 72 C 128 82, 133 88, 140 88 C 147 88, 152 82, 152 72 C 152 66, 149 60, 146 56 C 146 62, 143 64, 141 64 C 143 58, 142 50, 140 44 Z"
        fill="#4A8AFF"
      />
      <path
        d="M140 58 C 136 64, 134 68, 134 73 C 134 79, 137 83, 140 83 C 143 83, 146 79, 146 73 C 146 69, 143 63, 140 58 Z"
        fill="#F5F4ED"
        opacity="0.9"
      />
      {/* royalty ticks flowing back */}
      <g stroke="#1564FF" strokeWidth="2" opacity="0.7">
        <line x1="36" y1="60" x2="56" y2="60" />
        <line x1="64" y1="60" x2="76" y2="60" />
        <line x1="204" y1="60" x2="224" y2="60" />
        <line x1="232" y1="60" x2="244" y2="60" />
      </g>
    </svg>
  );
}

/** A collection: works standing together, one lit. */
function CollectionArt() {
  return (
    <svg viewBox="0 0 280 120" className="block h-28 w-full bg-[var(--carbon)]" aria-hidden>
      <g fill="none" strokeWidth="2">
        <rect x="52" y="30" width="52" height="64" stroke="#1A3060" />
        <rect x="114" y="20" width="52" height="74" stroke="#1564FF" />
        <rect x="176" y="30" width="52" height="64" stroke="#1A3060" />
      </g>
      <rect x="60" y="38" width="36" height="48" fill="#0D3FA8" opacity="0.25" />
      <rect x="184" y="38" width="36" height="48" fill="#0D3FA8" opacity="0.25" />
      {/* the lit one */}
      <path
        d="M140 40 C 135 49, 131 54, 131 62 C 131 70, 135 75, 140 75 C 145 75, 149 70, 149 62 C 149 57, 146 51, 143 48 C 143 53, 141 55, 139 55 C 141 50, 141 45, 140 40 Z"
        fill="#4A8AFF"
      />
      <rect x="122" y="28" width="36" height="58" fill="#1564FF" opacity="0.15" />
    </svg>
  );
}
