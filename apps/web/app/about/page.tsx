import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { AboutContent } from "@/components/about-content";

export default function AboutPage() {
  return (
    <div className="relative z-10 flex flex-1 flex-col">
      <Nav />
      <AboutContent />
      <Footer />
    </div>
  );
}
