"use client";

// L'attente de la photo officielle (photo-studio.tsx). Faire une photo de
// studio prend plusieurs dizaines de secondes chez fal.ai, un filtre une
// dizaine : au lieu d'un rond qui tourne, le joueur assiste à sa séance. Son
// visage, flou et en noir et blanc, s'approche dans un viseur ; une lumière
// balaie le cadre et un flash part de temps en temps ; une légende dit où en
// est la séance, et une barre avance. Demande de Sabri du 19/10/2026 :
// « l'utilisateur peut être frustré et s'impatiente ».
//
// La barre ne connaît pas la vraie durée : elle suit 1 − e^(−t/τ), vite au
// début, puis de plus en plus lentement, sans jamais toucher le bout avant
// que la photo arrive. Pendant l'attente, l'écran reste allumé (Wake Lock),
// sinon iOS met l'app en veille et la demande se perd.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Les légendes de la séance, dans l'ordre. */
export const SEANCE_STUDIO = [
  "On installe le studio",
  "Réglage des lumières",
  "Le maillot Bola",
  "Prise de vue",
  "Retouche",
  "Derniers détails",
];

/** Avancement estimé (0 à 1) après t secondes, pour une attente typique de τ. */
function avancement(t: number, tau: number): number {
  return 1 - Math.exp(-t / tau);
}

/** Les secondes écoulées depuis l'apparition, rafraîchies quatre fois par seconde. */
function useSecondes(): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const debut = performance.now();
    const id = window.setInterval(() => setT((performance.now() - debut) / 1000), 250);
    return () => window.clearInterval(id);
  }, []);
  return t;
}

/** Garde l'écran allumé tant que le composant est là (quand le navigateur le permet). */
function useEcranAllume() {
  useEffect(() => {
    let verrou: WakeLockSentinel | null = null;
    let fini = false;
    async function prendre() {
      try {
        const v = await navigator.wakeLock?.request("screen");
        if (fini) void v?.release();
        else verrou = v ?? null;
      } catch {
        // Refusé (économie d'énergie) : tant pis.
      }
    }
    // Le verrou tombe quand l'app passe en arrière-plan : on le reprend au retour.
    function retour() {
      if (document.visibilityState === "visible") void prendre();
    }
    void prendre();
    document.addEventListener("visibilitychange", retour);
    return () => {
      fini = true;
      document.removeEventListener("visibilitychange", retour);
      void verrou?.release();
    };
  }, []);
}

/** La barre et la légende, en bas du cadre. */
function Progression({ legendes, p }: { legendes: string[]; p: number }) {
  // Une légende par tranche ; la dernière reste jusqu'au bout.
  const i = Math.min(legendes.length - 1, Math.floor(p * legendes.length * 1.08));
  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-6 pt-14 pb-9">
      <p key={i} className="studio-legende text-lecture font-semibold tracking-tight text-white" aria-live="polite">
        {legendes[i]}
      </p>
      <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full rounded-full bg-white transition-[width] duration-300 ease-out"
          style={{ width: `${Math.round(Math.min(0.96, p) * 1000) / 10}%` }}
        />
      </div>
    </div>
  );
}

/** Les quatre coins du viseur, qui se resserrent à chaque flash. */
function Viseur() {
  const coin = "absolute size-6 border-white/85";
  return (
    <div aria-hidden className="studio-viseur pointer-events-none absolute inset-[14px]">
      <span className={cn(coin, "top-0 left-0 rounded-tl-[10px] border-t-2 border-l-2")} />
      <span className={cn(coin, "top-0 right-0 rounded-tr-[10px] border-t-2 border-r-2")} />
      <span className={cn(coin, "bottom-0 left-0 rounded-bl-[10px] border-b-2 border-l-2")} />
      <span className={cn(coin, "right-0 bottom-0 rounded-br-[10px] border-r-2 border-b-2")} />
    </div>
  );
}

/** La lumière qui balaie le cadre, et le flash. */
function Lumieres() {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="studio-balayage absolute inset-y-[-20%] left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      </div>
      <div aria-hidden className="studio-flash pointer-events-none absolute inset-0 bg-white" />
    </>
  );
}

/**
 * La séance de la photo de studio : le visage (le premier selfie) dans le
 * viseur. À poser à la place exacte où la photo apparaîtra.
 */
export function AttenteStudio({ visage }: { visage: string }) {
  useEcranAllume();
  const p = avancement(useSecondes(), 14);
  return (
    <div
      className="relative aspect-square w-full overflow-hidden rounded-[22px] bg-[#0d0d0f]"
      role="status"
      aria-label="Photo officielle en cours"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={visage}
        alt=""
        className="studio-approche absolute inset-0 size-full object-cover opacity-60 transition-[filter] duration-500"
        // Le visage se « développe » : de plus en plus net à mesure que la séance avance.
        style={{ filter: `grayscale(1) blur(${(2 + 12 * (1 - p)).toFixed(1)}px)` }}
      />
      <Lumieres />
      <Viseur />
      <Progression legendes={SEANCE_STUDIO} p={p} />
    </div>
  );
}

/**
 * Un filtre en cours, par-dessus la photo de studio (qui reste en dessous,
 * voilée) : même lumière, même barre, plus courte.
 */
export function AttenteFiltre({ legendes }: { legendes: string[] }) {
  useEcranAllume();
  const p = avancement(useSecondes(), 5);
  return (
    <div className="absolute inset-0 bg-black/35 backdrop-blur-[6px]" role="status" aria-label="Filtre en cours">
      <Lumieres />
      <Viseur />
      <Progression legendes={legendes} p={p} />
    </div>
  );
}
