import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Manifesto } from "@/components/manifesto";

export default function ManifestoPage() {
  return (
    <div className="relative z-10 flex flex-1 flex-col">
      <Nav />
      <main className="flex flex-1 flex-col justify-center">
        <Manifesto />
      </main>
      <Footer />
    </div>
  );
}
