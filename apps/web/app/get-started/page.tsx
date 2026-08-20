import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { GetStartedContent } from "@/components/get-started-content";

export const metadata: Metadata = {
  title: "Empezá con Molotov",
  description:
    "Entrá con email o conectá la wallet que ya usás, y mirá el arte digital donde la regalía la garantiza el contrato.",
};

export default function GetStartedPage() {
  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Nav />
      <main className="flex flex-1 flex-col">
        <GetStartedContent />
      </main>
      <Footer />
    </div>
  );
}
