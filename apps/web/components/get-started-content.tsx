"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LoginModal } from "@/components/login-modal";
import { useI18n } from "@/lib/i18n";
import { useWallet } from "@/hooks/use-wallet";

const FAQ_KEYS = [
  ["getStarted.faq.q1", "getStarted.faq.a1"],
  ["getStarted.faq.q2", "getStarted.faq.a2"],
  ["getStarted.faq.q3", "getStarted.faq.a3"],
  ["getStarted.faq.q4", "getStarted.faq.a4"],
] as const;

/**
 * The onboarding landing "Empezar" points to: one promise, one button that
 * opens the sign-in (social creates a wallet on the spot), four questions.
 * The background is only Molotov's blue flames over black.
 */
export function GetStartedContent() {
  const { t } = useI18n();
  const { isConnected } = useWallet();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div className="relative flex min-h-[calc(100vh-3rem)] flex-col overflow-hidden bg-[var(--black)]">
      {/* ── Blue flames ── */}
      <div aria-hidden className="absolute inset-0">
        <div
          className="flame-blob"
          style={{
            left: "8%",
            bottom: "-12%",
            width: "34vw",
            height: "44vh",
            background: "radial-gradient(ellipse at center, #1564FF 0%, transparent 70%)",
            animationDelay: "0s",
          }}
        />
        <div
          className="flame-blob"
          style={{
            left: "38%",
            bottom: "-18%",
            width: "40vw",
            height: "56vh",
            background: "radial-gradient(ellipse at center, #0D3FA8 0%, transparent 70%)",
            animationDelay: "1.6s",
          }}
        />
        <div
          className="flame-blob"
          style={{
            right: "6%",
            bottom: "-10%",
            width: "30vw",
            height: "42vh",
            background: "radial-gradient(ellipse at center, #4A8AFF 0%, transparent 70%)",
            animationDelay: "3.1s",
          }}
        />
        <div
          className="flame-blob"
          style={{
            left: "22%",
            bottom: "-6%",
            width: "18vw",
            height: "26vh",
            background: "radial-gradient(ellipse at center, #4A8AFF 0%, transparent 65%)",
            animationDelay: "4.4s",
          }}
        />
        <div
          className="flame-blob"
          style={{
            right: "26%",
            bottom: "-14%",
            width: "24vw",
            height: "36vh",
            background: "radial-gradient(ellipse at center, #1564FF 0%, transparent 70%)",
            animationDelay: "2.2s",
          }}
        />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-6 pb-24 pt-20 text-center md:pt-28">
        <Image
          src="/brand/logo_sinfondo.png"
          alt=""
          width={64}
          height={64}
          className="logo-flame h-16 w-16"
          priority
        />
        <h1 className="mt-8 font-[family-name:var(--font-display)] text-[clamp(2rem,6vw,3.4rem)] font-bold leading-tight text-[var(--offwhite)]">
          {t("getStarted.title")}
        </h1>
        {/* Already signed in? The FAQ stays useful; the sign-up button doesn't. */}
        {isConnected ? (
          <Link
            href="/works"
            className="mt-10 inline-flex h-12 items-center bg-[var(--blue)] px-10 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-white transition-colors hover:bg-[var(--blue-light)]"
          >
            {t("getStarted.ctaConnected")}
          </Link>
        ) : (
          <button
            onClick={() => setLoginOpen(true)}
            className="mt-10 inline-flex h-12 items-center bg-[var(--blue)] px-10 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-white transition-colors hover:bg-[var(--blue-light)]"
          >
            {t("getStarted.cta")}
          </button>
        )}

        {/* ── FAQ ── */}
        <div className="mt-24 w-full text-left">
          {FAQ_KEYS.map(([q, a]) => (
            <details key={q} className="group border-b border-white/10 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--offwhite)] [&::-webkit-details-marker]:hidden">
                {t(q)}
                <span className="text-[var(--smoke)] transition-transform group-open:rotate-180">
                  ⌄
                </span>
              </summary>
              <p className="mt-4 max-w-prose text-[14px] leading-relaxed text-[var(--offwhite)]/70">
                {t(a)}
              </p>
            </details>
          ))}
        </div>
      </div>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
