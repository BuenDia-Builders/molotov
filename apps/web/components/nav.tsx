'use client';

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";

const LINKS = [
  { href: "#como-cobras", label: "Cómo cobrás" },
  { href: "#actividad", label: "Actividad" },
  { href: "#manifiesto", label: "Manifiesto" },
  { href: "#contrato", label: "Contrato" },
];

export function Nav() {
  const [isOpen, setIsOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Manage Body Scroll Lock & Escape Key Global Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        hamburgerRef.current?.focus();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      
      // Auto-focus the close button inside the drawer on open for screen readers
      const focusableElements = drawerRef.current?.querySelectorAll('a, button');
      if (focusableElements && focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus();
      }
    } else {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus Trap Algorithm keeping Tab configurations locked within the active overlay frame
  const handleTabTrap = (e: React.KeyboardEvent) => {
    if (!drawerRef.current) return;
    const focusableElements = drawerRef.current.querySelectorAll('a, button');
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  };

  return (
    <>
      {/* 1. Main Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-white/12 bg-black/70 backdrop-blur-md">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10 lg:px-16">
          <Link
            href="/"
            className="flex items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0178DE]"
            aria-label="Molotov, inicio"
          >
            <Image
              src="/brand/logo-wordmark-dark.png"
              alt="Molotov"
              width={820}
              height={612}
              priority
              className="h-10 w-auto md:h-11"
            />
          </Link>

          <ul className="hidden items-center gap-8 md:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="font-[family-name:var(--font-geist-mono)] text-[13px] tracking-wide text-[#F5F4ED]/60 underline-offset-4 transition-colors hover:text-[#F5F4ED] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0178DE]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4">
            <WalletButton />

            {/* Accessible Hamburger Menu Button: Visible solely under md layout boundaries (< 768px) */}
            <button
              ref={hamburgerRef}
              onClick={() => setIsOpen(!isOpen)}
              className="flex h-11 w-11 items-center justify-center rounded-md border border-white/20 bg-transparent text-[#F5F4ED] md:hidden focus-visible:outline-2 focus-visible:outline-[#0178DE]"
              aria-label="Abrir menú"
              aria-expanded={isOpen}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </nav>
      </header>

      {/* 2. Full Screen Overlay Drawer Portal Layer (Completely pulled outside header tags to break sticky context restrictions) */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] md:hidden">
          {/* Dimmed solid black background backdrop overlay */}
          <div 
            className="absolute inset-0 bg-black/90 backdrop-blur-md" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Drawer Body Container Panel */}
          <div
            ref={drawerRef}
            onKeyDown={handleTabTrap}
            className="absolute inset-y-0 right-0 w-full max-w-sm bg-[#050505] p-6 border-l border-white/12 flex flex-col transform transition-all duration-200 motion-reduce:transition-none ease-in-out shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            {/* Drawer Close Actions Bar */}
            <div className="flex items-center justify-between mb-8 border-b border-white/12 pb-4">
              <span className="font-[family-name:var(--font-geist-mono)] text-[13px] uppercase tracking-wider text-[#F5F4ED]/40">Menú</span>
              <button
                onClick={() => {
                  setIsOpen(false);
                  hamburgerRef.current?.focus();
                }}
                className="flex h-11 w-11 items-center justify-center rounded-md border border-white/12 text-[#F5F4ED] hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[#0178DE]"
                aria-label="Cerrar menú"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navigational links stack with Fraunces typography font styling & generous touch parameters */}
            <div className="flex flex-col space-y-2">
              {LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="font-fraunces text-2xl py-4 text-[#F5F4ED] hover:text-[#F5F4ED]/80 border-b border-white/5 transition-colors focus-visible:outline-2 focus-visible:outline-[#0178DE] focus-visible:outline-offset-2 rounded-sm"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}