"use client";

// L'écran « Manettes » du jeu Bola (bola-app#23), avant le match : qui joue quelle équipe.
//
// Deux colonnes, NOIRS à gauche et BLANCS à droite, chacune avec sa pastille ; au milieu, les manettes branchées qui
// ne jouent pas (leur équipe est à l'IA). Chaque manette a l'icône de sa marque (Xbox, PlayStation, ou générique ;
// barrée si elle n'est pas reconnue), pleine quand elle a rejoint une équipe. En bas, la seule phrase d'aide du jeu :
// « [A] / [✕] pour rejoindre », avec les boutons des marques présentes. Tout se fait à la manette (A / ✕ rejoindre,
// stick ou croix pour changer de côté, B / ○ revenir au milieu, Menu / Options lancer) ; « Jouer » au doigt lance
// aussi. Deux manettes du même côté : refusé, l'icône a un petit choc. Noir et blanc, Inter ; avec « Réduire les
// animations », les manettes changent de colonne sans glisser et le choc devient un simple clignement.
//
// L'état vient de lib/jeu/entrees/manettes.js par un abonnement (useSyncExternalStore) : la page ne relit rien.

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

export type PadVu = { cle: string; marque: "xbox" | "playstation" | "generique"; reconnue: boolean; equipe: 0 | 1 | null; choc: number };
export type Instantane = { version: number; mode: string; pads: PadVu[] };
export type MagasinManettes = { abonner: (f: () => void) => () => void; instantane: () => Instantane };

/** Le bouton du bas de la manette : A (Xbox et génériques) ou ✕ (PlayStation), blanc sur noir. */
export function BoutonBas({ marque, className }: { marque: PadVu["marque"]; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("inline-block h-[1.35em] w-[1.35em] align-[-0.32em]", className)} aria-label={marque === "playstation" ? "croix" : "A"}>
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      {marque === "playstation" ? (
        <path d="M8 8 L16 16 M16 8 L8 16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      ) : (
        <text x="12" y="16.4" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="currentColor" fontFamily="var(--font-inter), system-ui, sans-serif">
          A
        </text>
      )}
    </svg>
  );
}

/** La silhouette d'une manette, à la forme de sa marque (dessin à nous, sans logo). */
function IconeManette({ marque, reconnue, pleine }: { marque: PadVu["marque"]; reconnue: boolean; pleine: boolean }) {
  const fond = pleine ? "#fff" : "none";
  const trait = pleine ? "#050505" : "#fff";
  const ps = marque === "playstation";
  return (
    <svg viewBox="0 0 80 52" className="h-[46px] w-[70px]" aria-hidden>
      {ps ? (
        <path
          d="M22 6 H58 C66 6 70 10 72 18 L77 38 C79 46 72 50 66 45 L58 37 H22 L14 45 C8 50 1 46 3 38 L8 18 C10 10 14 6 22 6 Z"
          fill={fond}
          stroke="#fff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M24 7 C30 5 50 5 56 7 C66 9 71 14 74 24 C77 34 78 44 70 46 C64 47 60 40 55 36 H25 C20 40 16 47 10 46 C2 44 3 34 6 24 C9 14 14 9 24 7 Z"
          fill={fond}
          stroke="#fff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      {ps ? (
        <g stroke={trait} strokeWidth="1.6" fill="none">
          <rect x="31" y="10" width="18" height="10" rx="2" />
          <path d="M17 14 V22 M13 18 H21" strokeLinecap="round" />
          <circle cx="63" cy="14.5" r="1.9" />
          <circle cx="63" cy="22" r="1.9" />
          <circle cx="59.2" cy="18.2" r="1.9" />
          <circle cx="66.8" cy="18.2" r="1.9" />
          <circle cx="31" cy="29" r="4.2" />
          <circle cx="49" cy="29" r="4.2" />
        </g>
      ) : (
        <g stroke={trait} strokeWidth="1.6" fill="none">
          <circle cx="21" cy="18" r="4.6" />
          <path d="M31 27 V35 M27 31 H35" strokeLinecap="round" />
          <circle cx="59" cy="13.5" r="1.9" />
          <circle cx="59" cy="22.5" r="1.9" />
          <circle cx="54.5" cy="18" r="1.9" />
          <circle cx="63.5" cy="18" r="1.9" />
          <circle cx="48" cy="30" r="4.2" />
        </g>
      )}
      {!reconnue && <path d="M8 48 L72 4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />}
    </svg>
  );
}

const COLONNE = ["16.67%", "50%", "83.33%"];

export function EcranManettes({ magasin, reduit, onJouer }: { magasin: MagasinManettes; reduit: boolean; onJouer: () => void }) {
  const inst = useSyncExternalStore(magasin.abonner, magasin.instantane, magasin.instantane);
  const pads = inst.pads;
  const marques = Array.from(new Set(pads.filter((p) => p.reconnue).map((p) => (p.marque === "playstation" ? "playstation" : "xbox")))) as PadVu["marque"][];
  if (!marques.length) marques.push("xbox");
  // les manettes d'une même colonne s'empilent
  const rangs = new Map<string, number>();
  const parCol = [0, 0, 0];
  for (const p of pads) {
    const c = p.equipe == null ? 1 : p.equipe === 0 ? 0 : 2;
    rangs.set(p.cle, parCol[c]++);
  }
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-black/85 font-[family-name:var(--font-inter)] text-white" onPointerDown={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-3 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 76px)" }}>
        <div className="flex flex-col items-center gap-2.5">
          <span className="h-4 w-4 rounded-full border-[1.5px] border-white bg-black" />
          <span className="text-[15px] font-extrabold uppercase tracking-[0.2em]">Noirs</span>
        </div>
        <div />
        <div className="flex flex-col items-center gap-2.5">
          <span className="h-4 w-4 rounded-full bg-white" />
          <span className="text-[15px] font-extrabold uppercase tracking-[0.2em]">Blancs</span>
        </div>
      </div>

      <div className="relative mx-4 mt-8 flex-1">
        <div className="absolute inset-y-0 left-1/3 w-px bg-white/10" />
        <div className="absolute inset-y-0 left-2/3 w-px bg-white/10" />
        {pads.map((p) => {
          const c = p.equipe == null ? 1 : p.equipe === 0 ? 0 : 2;
          return (
            <div
              key={p.cle}
              className={cn("absolute -translate-x-1/2", !reduit && "transition-[left] duration-200 ease-out")}
              style={{ left: COLONNE[c], top: `${(rangs.get(p.cle) ?? 0) * 74 + 8}px` }}
            >
              <div key={p.choc} className={cn(p.choc > 0 && (reduit ? "jeu-choc-r" : "jeu-choc"), !p.reconnue && "opacity-50")}>
                <IconeManette marque={p.marque} reconnue={p.reconnue} pleine={p.equipe != null} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-5 px-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)" }}>
        <p className="text-[17px] font-semibold">
          {marques.map((mq, i) => (
            <span key={mq}>
              {i > 0 && <span className="text-white/50"> / </span>}
              <BoutonBas marque={mq} />
            </span>
          ))}{" "}
          pour rejoindre
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onJouer();
          }}
          className="h-14 w-full max-w-[320px] rounded-full bg-white text-[17px] font-bold text-black"
        >
          Jouer
        </button>
      </div>

      <style>{`
        .jeu-choc { animation: jeu-choc .32s cubic-bezier(.3,.7,.4,1) both; }
        @keyframes jeu-choc { 0%,100% { transform: none } 20% { transform: translateX(-7px) } 45% { transform: translateX(6px) } 70% { transform: translateX(-3px) } }
        .jeu-choc-r { animation: jeu-choc-r .3s steps(2, jump-none) both; }
        @keyframes jeu-choc-r { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
      `}</style>
    </div>
  );
}
