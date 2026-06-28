import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { TeamContent } from "@/components/team-content";

export default function TeamPage() {
  return (
    <div className="relative z-10 flex flex-1 flex-col">
      <Nav />
      <TeamContent />
      <Footer />
    </div>
  );
}
