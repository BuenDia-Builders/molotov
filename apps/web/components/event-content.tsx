"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n";

const QR_CARDS = [
  {
    src: "/event/qr-wallet.png",
    labelKey: "event.qrWalletLabel",
    captionKey: "event.qrWalletCaption",
    altKey: "event.qrWalletAlt",
  },
  {
    src: "/event/qr-molotov.png",
    labelKey: "event.qrMolotovLabel",
    captionKey: "event.qrMolotovCaption",
    altKey: "event.qrMolotovAlt",
  },
] as const;

const STEP_KEYS = [
  ["event.steps.step1Title", "event.steps.step1Body"],
  ["event.steps.step2Title", "event.steps.step2Body"],
  ["event.steps.step3Title", "event.steps.step3Body"],
] as const;

/**
 * Static, printable-at-an-event page: two QR codes (wallet + Molotov) and a
 * three-step guide. No wallet connection, no runtime QR generation — just
 * something a newcomer can scan from their phone with nobody around to ask.
 */
export function EventContent() {
  const { t } = useI18n();

  return (
    <main className="flex flex-1 flex-col bg-[var(--offwhite)]">
      <section className="mx-auto w-full max-w-3xl px-6 pb-10 pt-14 text-center md:pt-20">
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.4em] text-[var(--black)]/35">
          {t("event.pageLabel")}
        </p>
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-[clamp(2rem,6vw,3.2rem)] font-bold leading-tight text-[var(--black)]">
          {t("event.title")}
        </h1>
        <p className="mx-auto mt-5 max-w-prose text-base leading-relaxed text-[var(--black)]/60">
          {t("event.intro")}
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-3xl gap-6 px-6 pb-16 sm:grid-cols-2">
        {QR_CARDS.map((card) => (
          <div
            key={card.src}
            className="flex flex-col items-center bg-[var(--black)] px-6 py-8 text-center"
          >
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-[var(--offwhite)]/70">
              {t(card.labelKey)}
            </p>
            <Image
              src={card.src}
              alt={t(card.altKey)}
              width={240}
              height={240}
              className="mt-6 h-auto w-full max-w-[240px] bg-[var(--offwhite)]"
            />
            <p className="mt-6 max-w-[26ch] text-[13px] leading-relaxed text-[var(--offwhite)]/60">
              {t(card.captionKey)}
            </p>
          </div>
        ))}
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 pb-24">
        <ol className="space-y-8">
          {STEP_KEYS.map(([titleKey, bodyKey], index) => (
            <li key={titleKey} className="flex gap-5 border-t border-black/10 pt-8">
              <span className="font-[family-name:var(--font-mono)] text-sm text-[var(--black)]/30">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--black)]">
                  {t(titleKey)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--black)]/60">{t(bodyKey)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
