"use client";

// Ouverture d'une journée — le rideau noir plein écran, façon générique :
// le libellé mono, le numéro qui arrive du flou, la date, la ligne blanche
// qui se déploie. Au moment où l'écran est couvert, `onReveal` remplace le
// récap derrière ; le rideau se dissipe ensuite et `onDone` le démonte.
// GSAP orchestre la timeline ; prefers-reduced-motion saute tout.

import { useEffect, useRef } from "react";
import gsap from "gsap";

export function JourneeOpening({
  j,
  date,
  onReveal,
  onDone,
}: {
  j: number;
  date: string;
  onReveal: () => void;
  onDone: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Le parent fournit des callbacks stables (useCallback []) : la timeline
  // ne se monte donc qu'une fois par ouverture.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onReveal();
      onDone();
      return;
    }
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.fromTo(ref.current, { opacity: 0 }, { opacity: 1, duration: 0.16, ease: "power1.out" })
        .fromTo(
          ".jo-label",
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.32, ease: "power2.out" }
        )
        .fromTo(
          ".jo-num",
          { scale: 0.55, opacity: 0, filter: "blur(22px)" },
          { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.5, ease: "power3.out" },
          "-=0.15"
        )
        .fromTo(".jo-date", { opacity: 0 }, { opacity: 1, duration: 0.3 }, "-=0.2")
        .fromTo(
          ".jo-line",
          { scaleX: 0 },
          { scaleX: 1, duration: 0.42, ease: "power2.inOut" },
          "-=0.18"
        )
        .call(onReveal)
        .to(ref.current, { opacity: 0, duration: 0.4, ease: "power1.inOut", delay: 0.35 })
        .call(onDone);
    }, ref);
    return () => ctx.revert();
  }, [onReveal, onDone]);

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4"
      style={{ background: "#070707", opacity: 0 }}
      aria-hidden
    >
      <p className="jo-label mono-label text-primary">SFL · Ouverture de la journée</p>
      <div className="jo-num text-[96px] leading-none font-extrabold tracking-tight">J{j}</div>
      <p className="jo-date text-[13px] text-foreground/40">{date}</p>
      <div className="jo-line h-[2px] w-40 rounded-full bg-foreground" />
    </div>
  );
}
