"use client";

// Le schéma des touches du jeu Bola (bola-app#26, lot 3), ouvert depuis l'écran Manettes (le bouton « Touches », ou
// Vue / Share sur une manette). Les données sont celles de lib/jeu/entrees/touches.js, le seul tableau, que le banc
// vérifie ligne par ligne sur la simulation : rien n'est recopié ici.
//
// En haut, l'appareil (Xbox, PlayStation, Clavier : celui de la manette qui l'a ouvert, sinon Xbox) et la partie
// (Attaque, Gestes, Défense) ; dessous, une ligne par action : ses boutons dessinés (dessins à nous, noir et blanc :
// boutons ronds, gâchettes et bumpers en pastilles, sticks en socle pointillé et tête pleine, fléchés, touches du clavier en cabochons) puis
// le nom de l'action. Les flèches des gestes sont relatives au joueur (↑ devant lui). En paysage, deux colonnes.
// Inter, noir et blanc. Aucun texte d'aide : le nom de chaque action seulement.

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TOUCHES, PARTIES } from "@/lib/jeu/entrees/touches.js";

export type Appareil = "xbox" | "playstation" | "clavier";
type Ligne = { id: string; partie: string; action: string; xbox: string; ps: string; clavier: string; pouce: string };

const LIGNES = TOUCHES as Ligne[];
const PARTIES_ = PARTIES as { id: string; titre: string }[];

const FACE = new Set(["A", "B", "X", "Y", "✕", "○", "□", "△"]);
const EPAULE = new Set(["LB", "RB", "LT", "RT", "L1", "R1", "L2", "R2", "Menu", "Options", "Vue", "Share"]);
const STICK = new Set(["LS", "RS", "R3"]);
const FLECHES = new Set(["↑", "↓", "←", "→", "←/→", "◠", "◡◠"]);
const CLAVIER = /^([A-Z]|Espace|Maj|Échap|flèches)$/;

/** Un bouton de face : rond ; les symboles PlayStation sont dessinés. */
function Face({ k }: { k: string }) {
  const sym =
    k === "✕" ? <path d="M8.6 8.6 L15.4 15.4 M15.4 8.6 L8.6 15.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    : k === "○" ? <circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
    : k === "□" ? <rect x="8.2" y="8.2" width="7.6" height="7.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
    : k === "△" ? <path d="M12 7.6 L16.4 15.4 H7.6 Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    : <text x="12" y="16.2" textAnchor="middle" fontSize="11.5" fontWeight="800" fill="currentColor" fontFamily="var(--font-inter), system-ui, sans-serif">{k}</text>;
  return (
    <svg viewBox="0 0 24 24" className="h-[26px] w-[26px] shrink-0" aria-label={k}>
      <circle cx="12" cy="12" r="10.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {sym}
    </svg>
  );
}

/** Une gâchette, un bumper, Menu ou Vue : une pastille au nom du bouton. */
function Pastille({ k }: { k: string }) {
  const gachette = /^(LT|RT|L2|R2)$/.test(k);
  return (
    <span className={cn("inline-flex h-[24px] min-w-[34px] items-center justify-center border-[1.5px] border-white px-1.5 text-[11px] font-extrabold tracking-[0.04em]", gachette ? "rounded-t-[11px] rounded-b-[4px]" : "rounded-[6px]")}>
      {k}
    </span>
  );
}

/** Un stick : un socle en pointillé et une tête pleine à sa lettre (L, R ; R3 : cliqué), une flèche s'il est poussé. */
function Stick({ k, fleche }: { k: string; fleche?: string }) {
  const rot = fleche === "↓" ? 180 : fleche === "←" ? -90 : fleche === "→" ? 90 : 0;
  const trait = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 34 34" className="h-[30px] w-[30px] shrink-0" aria-label={k}>
      {/* (le socle en pointillé, la tête du stick pleine, à sa lettre : on ne le confond pas avec ○) */}
      <circle cx="17" cy="17" r="11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2.4" />
      <circle cx="17" cy="17" r="5" fill="currentColor" />
      <text x="17" y={k === "R3" ? 19.2 : 19.6} textAnchor="middle" fontSize={k === "R3" ? 5.4 : 7} fontWeight="800" fill="#000" fontFamily="var(--font-inter), system-ui, sans-serif">
        {k === "LS" ? "L" : k === "R3" ? "R3" : "R"}
      </text>
      {(fleche === "↑" || fleche === "↓" || fleche === "←" || fleche === "→") && (
        <g transform={`rotate(${rot} 17 17)`}>
          <path d="M17 10.6 V2.4 M13.8 5.6 L17 2.4 L20.2 5.6" {...trait} />
        </g>
      )}
      {fleche === "←/→" && <path d="M10.6 17 H2.4 M5.6 13.8 L2.4 17 L5.6 20.2 M23.4 17 H31.6 M28.4 13.8 L31.6 17 L28.4 20.2" {...trait} />}
      {/* le quart de cercle : de devant (en haut) vers un côté */}
      {fleche === "◠" && <path d="M17 3 A14 14 0 0 1 31 17 M27.6 14.2 L31 17.6 L33.4 13.6" {...trait} />}
      {/* le demi-cercle : de derrière (en bas), par un côté, jusque devant */}
      {fleche === "◡◠" && <path d="M17 31 A14 14 0 0 1 17 3 M20.2 0.6 L17 3 L20.2 5.6" {...trait} />}
    </svg>
  );
}

/** Une touche du clavier : un cabochon. */
function Cabochon({ k }: { k: string }) {
  const large = k.length > 1;
  return (
    <span className={cn("inline-flex h-[25px] items-center justify-center rounded-[5px] border-[1.5px] border-white border-b-[3px] text-[11.5px] font-extrabold", large ? "px-2" : "w-[25px]")}>
      {k === "flèches" ? "← ↑ ↓ →" : k}
    </span>
  );
}

/** Les boutons d'une ligne, dessinés ; les mots de liaison (+, puis, tenu…) en gris, d'un seul tenant. */
export function Boutons({ texte, appareil }: { texte: string; appareil: Appareil }) {
  if (texte === "—") return <span className="text-white/30">—</span>;
  // « RS ↑ » : un stick fléché ; « RS ◠ » : un stick et son quart de cercle ; « J / L » : deux cabochons
  const mots = texte.split(" ");
  const out: React.ReactNode[] = [];
  let gris: string[] = [];
  const vider = (k: number) => {
    if (gris.length) out.push(<span key={`g${k}`} className="whitespace-nowrap text-[12.5px] font-semibold text-white/55">{gris.join(" ")}</span>);
    gris = [];
  };
  for (let i = 0; i < mots.length; i++) {
    const m = mots[i];
    let el: React.ReactNode = null;
    if (m === "+" || m === "/") el = <span key={i} className="text-white/45">{m}</span>;
    else if (appareil === "clavier") { if (CLAVIER.test(m)) el = <Cabochon key={i} k={m} />; }
    else if (FACE.has(m)) el = <Face key={i} k={m} />;
    else if (EPAULE.has(m)) el = <Pastille key={i} k={m} />;
    else if (STICK.has(m)) el = <Stick key={i} k={m} fleche={FLECHES.has(mots[i + 1] ?? "") ? mots[++i] : undefined} />;
    else if (FLECHES.has(m)) el = <Stick key={i} k="RS" fleche={m} />;
    if (el) { vider(i); out.push(el); } else gris.push(m);
  }
  vider(mots.length);
  return <span className="inline-flex flex-wrap items-center justify-end gap-1.5">{out}</span>;
}

function Choix<T extends string>({ valeur, options, onChoix }: { valeur: T; options: { id: T; titre: string }[]; onChoix: (v: T) => void }) {
  return (
    <div className="flex rounded-full border border-white/20 p-[3px]">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={(e) => { e.stopPropagation(); onChoix(o.id); }}
          className={cn("h-8 flex-1 whitespace-nowrap rounded-full px-3 text-[13px] font-bold", valeur === o.id ? "bg-white text-black" : "text-white/70")}
        >
          {o.titre}
        </button>
      ))}
    </div>
  );
}

export function SchemaTouches({ depart, onFermer }: { depart: Appareil; onFermer: () => void }) {
  const [appareil, setAppareil] = useState<Appareil>(depart);
  const [partie, setPartie] = useState("attaque");
  const lignes = LIGNES.filter((l) => l.partie === partie);
  const col = (l: Ligne) => (appareil === "xbox" ? l.xbox : appareil === "playstation" ? l.ps : l.clavier);
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col bg-black font-[family-name:var(--font-inter)] text-white"
      onPointerDown={(e) => e.stopPropagation()}
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 14px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
    >
      <div className="flex items-center gap-3 px-4 landscape:px-[max(16px,env(safe-area-inset-left))]">
        <div className="min-w-0 flex-1">
          <Choix<Appareil> valeur={appareil} onChoix={setAppareil} options={[{ id: "xbox", titre: "Xbox" }, { id: "playstation", titre: "PlayStation" }, { id: "clavier", titre: "Clavier" }]} />
        </div>
        <button
          aria-label="Fermer"
          onClick={(e) => { e.stopPropagation(); onFermer(); }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div className="mt-2.5 px-4 landscape:px-[max(16px,env(safe-area-inset-left))]">
        <Choix valeur={partie} onChoix={setPartie} options={PARTIES_} />
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-4 landscape:px-[max(16px,env(safe-area-inset-left))]">
        <ul className="grid grid-cols-1 gap-x-6 landscape:grid-cols-2">
          {lignes.map((l) => (
            <li key={l.id} className="flex min-h-[46px] items-center justify-between gap-3 border-b border-white/10 py-1.5">
              <span className="text-[14.5px] font-semibold">{l.action}</span>
              <span className="flex justify-end text-white"><Boutons texte={col(l)} appareil={appareil} /></span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
