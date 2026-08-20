import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { EventContent } from "@/components/event-content";

export const metadata: Metadata = {
  title: "Molotov en el evento",
  description: "Escaneá los QR para conseguir una wallet y entrar a Molotov, en tres pasos.",
};

export default function EventPage() {
  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Nav />
      <EventContent />
      <Footer />
    </div>
  );
}
