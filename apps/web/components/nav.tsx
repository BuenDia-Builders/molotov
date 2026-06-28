import Image from "next/image";
import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";

const NAV_LINKS = [
  { href: "/", label: "Discover" },
  { href: "/artists", label: "Artists" },
  { href: "/#how", label: "How it works" },
] as const;

export function Nav() {
  return (
    <header className="sticky top-0 z-30 h-12 border-b border-[var(--ember)] bg-[var(--carbon)]">
      <nav aria-label="Main navigation" className="flex h-full items-center justify-between px-4 md:grid md:grid-cols-3 md:px-0">
        <div className="md:pl-16">
          <Link href="/" className="flex items-center">
            <Image
              src="/brand/logo_sinfondo.png"
              alt="Molotov"
              width={120}
              height={40}
              className="h-8 w-auto"
              priority
            />
          </Link>
        </div>

        <ul className="hidden md:flex items-center justify-center gap-8">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--smoke)] no-underline transition-colors duration-200 hover:text-[var(--offwhite)]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-end md:pr-16">
          <WalletButton />
        </div>
      </nav>
    </header>
  );
}
