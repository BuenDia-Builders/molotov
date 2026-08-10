"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export type SaleCard = {
  tokenId: number;
  title: string;
  image: string | null;
  priceXlm: string;
  royaltyXlm: string;
  closedAt: string | null;
  txHash: string;
};

/** Real sales only. At testnet scale that is a short, true list — by design. */
export function RecentSales({ sales }: { sales: SaleCard[] }) {
  const { t, locale } = useI18n();

  return (
    <section className="bg-[var(--black)] px-6 py-16 md:px-12 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-baseline justify-between border-b border-white/10 pb-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--offwhite)] md:text-2xl">
            {t("landing.sales.title")}
          </h2>
        </div>

        {sales.length === 0 ? (
          <p className="max-w-md font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-[var(--smoke)]">
            {t("landing.sales.empty")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {sales.map((sale) => (
              <div key={sale.txHash} className="flex flex-col bg-[var(--carbon)]">
                <Link href={`/token/${sale.tokenId}`} className="relative block aspect-square">
                  {sale.image ? (
                    <Image
                      src={sale.image}
                      alt={sale.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, 16vw"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-[var(--blue-deep)] to-[var(--blue)]" />
                  )}
                </Link>
                <div className="flex flex-col gap-1 px-3 py-2.5">
                  <Link
                    href={`/token/${sale.tokenId}`}
                    className="truncate font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)] hover:underline"
                  >
                    {sale.title}
                  </Link>
                  <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--offwhite)]">
                    {sale.priceXlm} XLM
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[9px] text-[var(--blue-light)]">
                    {t("landing.sales.royalty")}: {sale.royaltyXlm} XLM
                  </span>
                  <div className="flex items-center justify-between">
                    {sale.closedAt && (
                      <span className="font-[family-name:var(--font-mono)] text-[9px] text-[var(--smoke)]">
                        {new Date(sale.closedAt).toLocaleDateString(
                          locale === "es" ? "es-AR" : "en-US",
                          { day: "numeric", month: "short" },
                        )}
                      </span>
                    )}
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${sale.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-[family-name:var(--font-mono)] text-[9px] text-[var(--smoke)] hover:text-[var(--offwhite)]"
                    >
                      tx ↗
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
