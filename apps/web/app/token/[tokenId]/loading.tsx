import { Nav } from "@/components/nav";

// Route-level loading skeleton (Suspense fallback) for a work's detail page, so it
// does not pop in abruptly. Matches the my-work skeleton: animate-pulse on bg-[var(--ember)].
export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--black)]">
      <Nav />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-6 py-16 md:grid-cols-2 md:px-10 md:py-20">
        <div className="aspect-[4/5] w-full bg-[var(--ember)] animate-pulse" />
        <div className="flex flex-col gap-4">
          <div className="h-2 w-1/3 bg-[var(--ember)] animate-pulse" />
          <div className="h-9 w-2/3 bg-[var(--ember)] animate-pulse" />
          <div className="h-3 w-1/2 bg-[var(--ember)] animate-pulse" />
          <div className="mt-6 h-12 w-full bg-[var(--ember)] animate-pulse" />
          <div className="h-3 w-2/5 bg-[var(--ember)] animate-pulse" />
        </div>
      </div>
    </div>
  );
}
