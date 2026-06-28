"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Phase = "show" | "tear" | "fire" | "split" | "done";

// Jagged tear edge — bottom of top half
const TOP_JAGGED =
  "polygon(0% 0%, 100% 0%, 100% 88%, " +
  "96% 96%, 90% 87%, 84% 97%, 78% 87%, " +
  "71% 96%, 65% 87%, 59% 96%, 53% 87%, " +
  "47% 96%, 41% 87%, 35% 96%, 29% 87%, " +
  "23% 96%, 17% 87%, 11% 96%, 5% 87%, 0% 94%)";

// Matching jagged edge — top of bottom half
const BOT_JAGGED =
  "polygon(0% 13%, 5% 6%, 11% 13%, 17% 6%, " +
  "23% 13%, 29% 6%, 35% 13%, 41% 6%, " +
  "47% 13%, 53% 6%, 59% 13%, 65% 6%, " +
  "71% 13%, 78% 6%, 84% 13%, 90% 6%, " +
  "96% 13%, 100% 6%, 100% 100%, 0% 100%)";

const TOP_FLAT = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
const BOT_FLAT = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";

export function PageLoader() {
  const [phase, setPhase] = useState<Phase>("show");

  useEffect(() => {
    if (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem("mlv_intro")) {
      setPhase("done");
      return;
    }

    const t1 = setTimeout(() => setPhase("tear"),  900);   // logo visible
    const t2 = setTimeout(() => setPhase("fire"),  1600);  // crack forms
    const t3 = setTimeout(() => setPhase("split"), 2500);  // fire burns
    const t4 = setTimeout(() => {
      setPhase("done");
      sessionStorage.setItem("mlv_intro", "1");
    }, 3800);                                               // halves fly off + fade

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  if (phase === "done") return null;

  const isJagged = phase === "tear" || phase === "fire" || phase === "split";
  const isSplit  = phase === "split";
  const isFire   = phase === "fire" || phase === "split";

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden"
      aria-hidden
      style={isSplit ? { animation: "loader-fade-out 0.6s ease-in 0.8s forwards" } : undefined}
    >
      {/* Logo — centered over the full overlay */}
      <div
        className="absolute inset-0 z-10 flex items-center justify-center"
        style={{
          transition: "opacity 0.3s ease",
          opacity: isSplit ? 0 : 1,
        }}
      >
        <Image
          src="/brand/logo_sinfondo.png"
          alt=""
          width={72}
          height={72}
          className="h-16 w-16 invert"
          priority
        />
      </div>

      {/* Blue fire — erupts through the crack */}
      {isFire && (
        <>
          {/* Outer glow */}
          <div
            className="absolute z-20"
            style={{
              left: "50%",
              top: "50%",
              width: "90vw",
              height: "280px",
              transform: "translate(-50%, -50%)",
              background:
                "radial-gradient(ellipse 80% 100% at 50% 50%, rgba(21,100,255,0.85) 0%, rgba(74,138,255,0.5) 35%, transparent 70%)",
              filter: "blur(24px)",
              animation: "fire-pulse 0.55s ease-in-out infinite",
            }}
          />
          {/* Core bright line */}
          <div
            className="absolute z-20"
            style={{
              left: "50%",
              top: "50%",
              width: "100vw",
              height: "60px",
              transform: "translate(-50%, -50%)",
              background:
                "radial-gradient(ellipse 100% 100% at 50% 50%, rgba(200,220,255,0.95), rgba(21,100,255,0.7) 40%, transparent 70%)",
              filter: "blur(6px)",
              animation: "fire-core 0.4s ease-in-out infinite",
            }}
          />
        </>
      )}

      {/* Top half */}
      <div
        className="absolute inset-x-0 top-0 bg-[var(--black)]"
        style={{
          height: "54%",
          clipPath: isJagged ? TOP_JAGGED : TOP_FLAT,
          transition: "clip-path 0.3s ease-out, transform 0.9s cubic-bezier(0.55,0,1,0.45)",
          transform: isSplit ? "translateY(-110%)" : "translateY(0)",
        }}
      />

      {/* Bottom half */}
      <div
        className="absolute inset-x-0 bottom-0 bg-[var(--black)]"
        style={{
          height: "54%",
          clipPath: isJagged ? BOT_JAGGED : BOT_FLAT,
          transition: "clip-path 0.3s ease-out, transform 0.9s cubic-bezier(0.55,0,1,0.45)",
          transform: isSplit ? "translateY(110%)" : "translateY(0)",
        }}
      />
    </div>
  );
}
