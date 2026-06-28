import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Artists — Molotov",
  description: "Discover artists publishing their work on Molotov with on-chain royalties.",
};

export default function ArtistsPage() {
  return (
    <div className="relative z-10 flex flex-1 flex-col min-h-screen">
      <Nav />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.3em] text-[var(--smoke)] uppercase mb-4">
          Coming soon
        </p>
        <h1 className="font-[family-name:var(--font-display)] font-black text-[clamp(2.5rem,7vw,5rem)] leading-none text-[var(--offwhite)]">
          Artists
        </h1>
        <p className="mt-6 max-w-md text-center text-[var(--smoke)] text-base leading-relaxed">
          Artist profiles are being built. Check back soon.
        </p>
      </main>
      <Footer />
    </div>
  );
}
