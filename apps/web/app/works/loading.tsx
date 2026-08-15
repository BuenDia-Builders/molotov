import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

// Route-level loading skeleton (Suspense fallback) so Discover does not pop in
// abruptly. Matches the my-work skeleton language: animate-pulse on bg-[var(--ember)].
export default function Loading() {
  return (
    <div className="relative z-10 flex flex-1 flex-col min-h-screen">
      <Nav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-16 md:px-10 md:py-20 lg:px-16">
        <div className="flex items-baseline justify-between border-b border-[var(--ember)] pb-5 mb-10">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.3em] text-[var(--smoke)] uppercase mb-1">
              Molotov
            </p>
            <h1 className="font-[family-name:var(--font-display)] font-black text-[clamp(2rem,5vw,3.5rem)] leading-none text-[var(--offwhite)]">
              Discover
            </h1>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 lg:gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col bg-[var(--carbon)] overflow-hidden">
              <div className="aspect-[4/5] bg-[var(--ember)] animate-pulse" />
              <div className="px-5 py-5 flex flex-col gap-2">
                <div className="h-2 w-1/3 bg-[var(--ember)] animate-pulse" />
                <div className="h-3 w-2/3 bg-[var(--ember)] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
