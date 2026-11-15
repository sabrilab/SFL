"use client";

// L'écran « Manettes » du jeu Bola (bola-app#23), avant le match : qui joue quelle équipe.
//
// Deux colonnes, NOIRS à gauche et BLANCS à droite, chacune avec sa pastille ; au milieu, les manettes branchées qui
// ne jouent pas (leur équipe est à l'IA). Chaque manette a l'icône de sa marque (Xbox, PlayStation, ou générique ;
// barrée si elle n'est pas reconnue), pleine quand elle a rejoint une équipe, et son numéro dessous (deux manettes de
// la même marque se distinguent). Sur l'écran d'attente, les manettes vues apparaissent en petit au-dessus de « Jouer »
// (ManettesVues), sans texte. En bas, la seule phrase d'aide du jeu :
// « [A] / [✕] pour rejoindre », avec les boutons des marques présentes. Tout se fait à la manette (A / ✕ rejoindre,
// stick ou croix pour changer de côté, B / ○ revenir au milieu, Menu / Options lancer) ; « Jouer » au doigt lance
// aussi. Deux manettes du même côté : refusé, l'icône a un petit choc. Noir et blanc, Inter ; avec « Réduire les
// animations », les manettes changent de colonne sans glisser et le choc devient un simple clignement.
// (bola-app#26, lot 3) Sous « Jouer », « Touches » ouvre le schéma des touches (./touches.tsx) ; Vue / Share sur une
// manette aussi, aux boutons de sa marque.
//
// L'état vient de lib/jeu/entrees/manettes.js par un abonnement (useSyncExternalStore) : la page ne relit rien.

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

export type PadVu = { cle: string; marque: "xbox" | "playstation" | "generique"; reconnue: boolean; equipe: 0 | 1 | null; choc: number; numero: number };
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

/**
 * La silhouette d'une manette, à la forme de sa marque (dessin à nous, sans logo). Ce qui les distingue se lit à 390 px :
 * Xbox, un corps rond, les sticks décalés (le gauche en haut, le droit en bas) et la croix en bas à gauche ;
 * PlayStation, de longues poignées, les deux sticks côte à côte en bas et un grand pavé tactile plein au milieu.
 */
export function IconeManette({ marque, reconnue, pleine, petite = false }: { marque: PadVu["marque"]; reconnue: boolean; pleine: boolean; petite?: boolean }) {
  const fond = pleine ? "#fff" : "none";
  const trait = pleine ? "#050505" : "#fff";
  const ps = marque === "playstation";
  return (
    <svg viewBox="0 0 80 52" className={petite ? "h-[24px] w-[37px]" : "h-[46px] w-[70px]"} aria-hidden>
      {ps ? (
        <path
          d="M20 5 H60 C67 5 71 9 73 16 L78 40 C80 49 72 52 66 46 L58 37 H22 L14 46 C8 52 0 49 2 40 L7 16 C9 9 13 5 20 5 Z"
          fill={fond}
          stroke="#fff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M23 8 C30 5 50 5 57 8 C67 11 72 16 75 26 C77 35 77 43 69 44 C63 45 60 40 55 37 H25 C20 40 17 45 11 44 C3 43 3 35 5 26 C8 16 13 11 23 8 Z"
          fill={fond}
          stroke="#fff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      {ps ? (
        <g stroke={trait} strokeWidth="1.6" fill="none">
          <rect x="29" y="9" width="22" height="12" rx="2.5" fill={trait} fillOpacity={pleine ? 0.9 : 0.85} />
          <path d="M16 12 V21 M11.5 16.5 H20.5" strokeLinecap="round" strokeWidth="2.2" />
          <circle cx="64" cy="12.5" r="2" />
          <circle cx="64" cy="21" r="2" />
          <circle cx="59.8" cy="16.8" r="2" />
          <circle cx="68.2" cy="16.8" r="2" />
          <circle cx="31" cy="30" r="4.4" />
          <circle cx="49" cy="30" r="4.4" />
        </g>
      ) : (
        <g stroke={trait} strokeWidth="1.6" fill="none">
          <circle cx="21" cy="19" r="5" />
          <path d="M30 26 V35 M25.5 30.5 H34.5" strokeLinecap="round" strokeWidth="2.2" />
          <circle cx="59" cy="13" r="2" />
          <circle cx="59" cy="22.4" r="2" />
          <circle cx="54.3" cy="17.7" r="2" />
          <circle cx="63.7" cy="17.7" r="2" />
          <circle cx="49" cy="30.5" r="4.6" />
        </g>
      )}
      {!reconnue && <path d="M8 48 L72 4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />}
    </svg>
  );
}

/** Le numéro de la manette (son index dans le navigateur), pour distinguer deux manettes de la même marque. */
function Numero({ n }: { n: number }) {
  return <span className="mt-1 block text-center text-[12px] font-bold tabular-nums text-white/70">{n}</span>;
}

/**
 * Sur l'écran d'attente : les manettes vues (reconnues), en petit, au-dessus de « Jouer ». Brancher une manette se voit
 * tout de suite ; aucun texte.
 */
export function ManettesVues({ magasin }: { magasin: MagasinManettes }) {
  const inst = useSyncExternalStore(magasin.abonner, magasin.instantane, magasin.instantane);
  const pads = inst.pads.filter((p) => p.reconnue);
  if (!pads.length) return null;
  return (
    <div className="flex items-end gap-3" aria-hidden>
      {pads.map((p) => (
        <div key={p.cle} className="flex flex-col items-center">
          <IconeManette marque={p.marque} reconnue pleine={false} petite />
          <Numero n={p.numero} />
        </div>
      ))}
    </div>
  );
}

const COLONNE = ["16.67%", "50%", "83.33%"];

export function EcranManettes({ magasin, reduit, onJouer, onTouches }: { magasin: MagasinManettes; reduit: boolean; onJouer: () => void; onTouches: () => void }) {
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
      <div className="salon-haut grid grid-cols-3 px-4">
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

      <div className="salon-milieu relative mx-4 mt-8 flex-1">
        <div className="absolute inset-y-0 left-1/3 w-px bg-white/10" />
        <div className="absolute inset-y-0 left-2/3 w-px bg-white/10" />
        {pads.map((p) => {
          const c = p.equipe == null ? 1 : p.equipe === 0 ? 0 : 2;
          return (
            <div
              key={p.cle}
              className={cn("absolute -translate-x-1/2", !reduit && "transition-[left] duration-200 ease-out")}
              style={{ left: COLONNE[c], top: `calc(${rangs.get(p.cle) ?? 0} * var(--salon-pas, 74px) + 8px)` }}
            >
              <div key={p.choc} className={cn(p.choc > 0 && (reduit ? "jeu-choc-r" : "jeu-choc"), !p.reconnue && "opacity-50")}>
                <IconeManette marque={p.marque} reconnue={p.reconnue} pleine={p.equipe != null} />
                <Numero n={p.numero} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="salon-bas flex flex-col items-center gap-5 px-6">
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
          className="salon-jouer h-14 w-full max-w-[320px] rounded-full bg-white text-[17px] font-bold text-black"
        >
          Jouer
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTouches();
          }}
          className="-mt-1 h-10 px-5 text-[14px] font-semibold uppercase tracking-[0.18em] text-white/70"
        >
          Touches
        </button>
      </div>

      <style>{`
        .jeu-choc { animation: jeu-choc .32s cubic-bezier(.3,.7,.4,1) both; }
        @keyframes jeu-choc { 0%,100% { transform: none } 20% { transform: translateX(-7px) } 45% { transform: translateX(6px) } 70% { transform: translateX(-3px) } }
        .jeu-choc-r { animation: jeu-choc-r .3s steps(2, jump-none) both; }
        @keyframes jeu-choc-r { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
        .salon-haut { padding-top: calc(env(safe-area-inset-top) + 76px); }
        .salon-bas { padding-bottom: calc(env(safe-area-inset-bottom) + 28px); }
        /* (correctifs #26) téléphone en largeur (844×390) : moins de marges, sinon les manettes du milieu tombaient
           sur « A / ✕ pour rejoindre » */
        @media (max-height: 500px) {
          .salon-haut { padding-top: calc(env(safe-area-inset-top) + 14px); }
          .salon-milieu { margin-top: 10px; --salon-pas: 58px; }
          .salon-bas { gap: 8px; padding-bottom: calc(env(safe-area-inset-bottom) + 10px); }
          .salon-jouer { height: 44px; }
        }
      `}</style>
    </div>
  );
}
