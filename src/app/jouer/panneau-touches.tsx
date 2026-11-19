"use client";

// Le panneau des touches pendant le match (bola-app#32, lot C ; Sabri, 18/11 : « afficher, pour l'instant, à l'écran,
// les touches sur un côté pour qu'on comprenne ce qui puisse être fait »). Une demande explicite de Sabri : ce n'est pas
// du texte d'aide, c'est le nom court de chaque action, à côté de sa touche dessinée.
//
// Tout vient de la table unique, lib/jeu/entrees/touches.js : les lignes dont « panneau » cite la phase, leur nom court
// (court), leur touche dans la colonne de l'appareil (xbox, ps, clavier, pouce), le repère de la charge (charge) et le
// pied du panneau (pied : la tactique, et la touche qui masque le panneau). Rien n'est recopié ici.
//
//   - L'appareil et la phase viennent du match (lib/jeu/match.js, etat.panneau) : la manette de l'équipe (Xbox ou
//     PlayStation), le clavier ou le pouce ; attaque balle au pied, balle libre, défense.
//   - Un modificateur tenu (L1, R1, R2, L2) : chaque touche de face prend sa variante (L1 tenu : ✕ une-deux, ○ piqué, □
//     centre lobé, △ profondeur lobée), le modificateur s'affiche en tête, les autres lignes pâlissent. Les lignes ne
//     bougent pas : seuls les noms changent.
//   - Les touches qui se chargent (○, ✕, □, △ et leurs variantes) portent une petite jauge à droite du nom.
//   - Au pouce : les gestes (toucher, coup sec, glisser, second doigt), dessinés ; pas de charge, pas de variantes.
//
// Placement : en haut à gauche (les Noirs ; à droite pour les Blancs quand deux humains jouent), sous le score en
// portrait, dans le coin en paysage ; jamais dans la zone du pouce (les 45 % du bas : lib/jeu/pouce.js). Noir et blanc,
// Inter, un fond noir translucide. Masquable : Vue / Share à la manette, H au clavier, un toucher sur le panneau ; masqué,
// il ne reste rien à l'écran (un écran propre pour un stream), sauf sur un écran tactile un petit bouton discret qui le
// rouvre. Affiché par défaut ; le choix est gardé dans le navigateur (la page).

import { cn } from "@/lib/utils";
import { TOUCHES, PARTIES, BOUTONS_CLAVIER } from "@/lib/jeu/entrees/touches.js";
import { Boutons } from "./touches";

export type InfoPanneau = {
  e: number;
  appareil: "xbox" | "playstation" | "clavier" | "pouce";
  phase: "attaque" | "libre" | "defense";
  mod: "L1" | "R1" | "R2" | "L2" | null;
  numero: number | null;
};
type Ligne = {
  id: string; partie: string; action: string; xbox: string; ps: string; clavier: string; pouce: string;
  court?: string; panneau?: Record<string, number>; charge?: boolean; pied?: boolean;
};
type Vue = { id: string; touches: string; nom: string; charge: boolean; terne: boolean };

const LIGNES = TOUCHES as Ligne[];
const PARTIES_ = PARTIES as { id: string; titre: string }[];
const CLAVIER = BOUTONS_CLAVIER as Record<string, string>;
const MOD = /^(L1|R1|R2|L2) \+ /;

const colonne = (l: Ligne, a: InfoPanneau["appareil"]) => (a === "xbox" ? l.xbox : a === "playstation" ? l.ps : a === "clavier" ? l.clavier : l.pouce);

/** Le nom du modificateur sur l'appareil, lu dans la table (la première variante qui le porte : « LB + A » → LB). */
function nomModificateur(mod: string, a: InfoPanneau["appareil"]) {
  const v = LIGNES.find((l) => l.ps.startsWith(`${mod} + `));
  if (!v) return mod;
  if (a === "playstation") return mod;
  const xb = v.xbox.split(" ")[0];
  return a === "clavier" ? (CLAVIER[xb] ?? xb) : xb;
}

/** Ce que montre le panneau pour une phase, un appareil et un modificateur tenu (pur : lu par le banc). */
export function contenuPanneau(phase: InfoPanneau["phase"], appareil: InfoPanneau["appareil"], mod: InfoPanneau["mod"]) {
  const rang = (l: Ligne) => l.panneau?.[phase] ?? 99;
  const dans = LIGNES.filter((l) => l.panneau?.[phase] != null).sort((a, b) => rang(a) - rang(b));
  const variantes = dans.filter((l) => MOD.test(l.ps));
  let base = dans.filter((l) => !MOD.test(l.ps) && !l.pied);
  if (appareil === "pouce") {
    // au pouce : les gestes qui existent, une fois chacun
    const vus = new Set<string>();
    base = base.filter((l) => {
      const g = l.pouce;
      if (!g || g === "—" || g === "automatique" || vus.has(g)) return false;
      vus.add(g);
      return true;
    });
  } else base = base.filter((l) => rang(l) > 0); // (rang 0 : au pouce seulement ; le stick gauche va de soi à la manette)
  const pouce = appareil === "pouce";
  let modActif = false;
  const lignes: Vue[] = base.map((l) => {
    const v = !pouce && mod ? variantes.find((x) => x.ps === `${mod} + ${l.ps}`) : undefined;
    if (v) modActif = true;
    return { id: v?.id ?? l.id, touches: colonne(l, appareil), nom: (v ?? l).court ?? (v ?? l).action, charge: !pouce && !!(v ?? l).charge, terne: false };
  });
  if (modActif) lignes.forEach((x, i) => { x.terne = x.id === base[i].id; });
  const pied: Vue[] = dans
    .filter((l) => l.pied && colonne(l, appareil) !== "—")
    .map((l) => ({ id: l.id, touches: colonne(l, appareil), nom: l.court ?? l.action, charge: false, terne: false }));
  return {
    titre: PARTIES_.find((p) => p.id === phase)?.titre ?? phase,
    mod: modActif && mod ? nomModificateur(mod, appareil) : null,
    lignes,
    pied,
  };
}

/** La jauge des touches qui se chargent : trois barres qui montent. */
function Charge() {
  return (
    <svg viewBox="0 0 12 10" className="ml-auto h-[9px] w-[11px] shrink-0 text-white/55" aria-label="se charge">
      <rect x="0.5" y="6.5" width="2.4" height="3" rx="0.5" fill="currentColor" />
      <rect x="4.8" y="4" width="2.4" height="5.5" rx="0.5" fill="currentColor" />
      <rect x="9.1" y="1" width="2.4" height="8.5" rx="0.5" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

/** Un geste du pouce, dessiné : le doigt (rond plein) ; toucher : un anneau autour ; coup sec : une flèche épaisse et
 *  deux traits de vitesse ; glisser : une trace en pointillé (loin : pleine, deux pointes) ; deux doigts : un second rond. */
function GestePouce({ texte }: { texte: string }) {
  const trait = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const deux = /2e doigt|deux doigts/.test(texte);
  const touche = /toucher/.test(texte);
  const sec = /coup sec/.test(texte);
  const loin = /loin/.test(texte);
  const glisse = /glisser/.test(texte) || (deux && !touche);
  const x = deux ? 13 : 7;
  return (
    <svg viewBox="0 0 30 20" className="h-[18px] w-[27px] shrink-0" aria-label={texte}>
      {deux && <circle cx="4.5" cy="10" r="2.8" fill="currentColor" opacity="0.6" />}
      <circle cx={x} cy="10" r={touche ? 2.8 : 3.4} fill="currentColor" />
      {touche && <circle cx={x} cy="10" r="6" {...trait} strokeWidth={1.1} />}
      {sec && <path d={`M${x + 5} 10 H27 M23 6.2 L27 10 L23 13.8 M${x + 6} 5.5 H${x + 10} M${x + 6} 14.5 H${x + 10}`} {...trait} strokeWidth={1.8} />}
      {glisse && !loin && <path d={`M${x + 5} 10 H24 M21 7 L24 10 L21 13`} {...trait} strokeDasharray={deux ? undefined : "2 2.2"} />}
      {loin && <path d={`M${x + 5} 10 H28 M21 6.5 L24.5 10 L21 13.5 M24.5 6.5 L28 10 L24.5 13.5`} {...trait} />}
    </svg>
  );
}

/** Les rangées, dans une grille (touche, nom, jauge) : les noms s'alignent quelle que soit la largeur des touches. */
function Rangees({ vues, appareil, className }: { vues: Vue[]; appareil: InfoPanneau["appareil"]; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-[auto_auto_auto] items-center gap-x-2 gap-y-[3px]", className)}>
      {vues.map((v) => (
        // (une touche faite de trois boutons ou plus, « LB RB RT », « I J K L » : la rangée prend toute la largeur, son nom
        // juste après, pour ne pas élargir la colonne des touches de tout le panneau)
        v.touches.split(" ").filter((m) => m !== "+" && m !== "/").length >= 3 ? (
          <li key={v.id} className={cn("col-span-3 flex min-h-[21px] items-center gap-2", v.terne && "opacity-40")}>
            {appareil === "pouce" ? <GestePouce texte={v.touches} /> : <Boutons texte={v.touches} appareil={appareil} petit />}
            <span className="whitespace-nowrap text-[11.5px] font-semibold leading-none">{v.nom}</span>
          </li>
        ) : (
        <li key={v.id} className={cn("contents", v.terne && "[&>*]:opacity-40")}>
          <span className="flex min-h-[21px] items-center">
            {appareil === "pouce" ? <GestePouce texte={v.touches} /> : <Boutons texte={v.touches} appareil={appareil} petit />}
          </span>
          <span className="whitespace-nowrap text-[11.5px] font-semibold leading-none">{v.nom}</span>
          <span className="flex w-[11px] justify-end">{v.charge && <Charge />}</span>
        </li>
        )
      ))}
    </ul>
  );
}

function Panneau({ info, onBasculer }: { info: InfoPanneau; onBasculer: () => void }) {
  const c = contenuPanneau(info.phase, info.appareil, info.mod);
  return (
    <div
      role="button"
      aria-label="Masquer les touches"
      onPointerDown={(e) => {
        e.stopPropagation();
        onBasculer();
      }}
      className={cn(
        "jeu-panneau pointer-events-auto absolute rounded-[12px] bg-black/50 px-2.5 pb-2 pt-1.5 text-white font-[family-name:var(--font-inter)]",
        // en portrait : sous le score et le libellé de la tactique, sur les tribunes (deux colonnes, peu de hauteur) ; en
        // paysage : dans le coin, une colonne, au-dessus de la zone du pouce
        "top-[calc(env(safe-area-inset-top)+84px)] landscape:top-[calc(env(safe-area-inset-top)+10px)]",
        info.e === 0 ? "left-[max(10px,env(safe-area-inset-left))]" : "right-[max(10px,env(safe-area-inset-right))]",
      )}
    >
      <div className="mb-1 flex h-[17px] items-center gap-1.5">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", info.e === 0 ? "border border-white/80 bg-black" : "bg-white")} />
        {info.numero != null && <span className="text-[10px] font-bold tabular-nums text-white/70">{info.numero}</span>}
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">{c.titre}</span>
        {c.mod && (
          <span className="flex items-center gap-1 text-white">
            <Boutons texte={c.mod} appareil={info.appareil === "pouce" ? "xbox" : info.appareil} petit />
            <span className="text-[10px] text-white/50">+</span>
          </span>
        )}
        {/* en portrait, le pied (tactique, masquer) tient dans l'en-tête */}
        {c.pied.length > 0 && (
          <span className="ml-auto hidden items-center gap-2 pl-3 text-white/70 portrait:flex">
            {c.pied.map((v) => (
              <span key={v.id} className="flex items-center gap-1">
                {info.appareil === "pouce" ? <GestePouce texte={v.touches} /> : <Boutons texte={v.touches} appareil={info.appareil} petit />}
                <span className="text-[10.5px] font-semibold">{v.nom}</span>
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="flex gap-x-4 portrait:flex-row landscape:flex-col">
        {/* en portrait, deux colonnes ; en paysage, une */}
        <Rangees vues={c.lignes.slice(0, Math.ceil(c.lignes.length / 2))} appareil={info.appareil} className="landscape:hidden" />
        <Rangees vues={c.lignes.slice(Math.ceil(c.lignes.length / 2))} appareil={info.appareil} className="landscape:hidden" />
        <Rangees vues={c.lignes} appareil={info.appareil} className="portrait:hidden" />
      </div>
      {/* (en paysage, au pouce, pas de pied : le panneau lui-même se touche pour se masquer, et il doit finir au-dessus de la
          zone du pouce, les 45 % du bas) */}
      {c.pied.length > 0 && info.appareil !== "pouce" && <Rangees vues={c.pied} appareil={info.appareil} className="mt-1.5 border-t border-white/15 pt-1.5 portrait:hidden" />}
    </div>
  );
}

/** Les panneaux (un par équipe humaine), ou, masqués sur un écran tactile, le petit bouton qui les rouvre. */
export function PanneauTouches({ infos, cache, tactile, onBasculer }: { infos: InfoPanneau[]; cache: boolean; tactile: boolean; onBasculer: () => void }) {
  if (!infos.length) return null;
  if (cache) {
    if (!tactile || !infos.some((i) => i.appareil === "pouce")) return null;
    return (
      <button
        aria-label="Les touches"
        onPointerDown={(e) => {
          e.stopPropagation();
          onBasculer();
        }}
        className="pointer-events-auto absolute left-[max(10px,env(safe-area-inset-left))] top-[calc(env(safe-area-inset-top)+94px)] flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white/65 landscape:top-[calc(env(safe-area-inset-top)+10px)]"
      >
        {/* les quatre touches de face, en losange */}
        <svg viewBox="0 0 20 20" className="h-4 w-4">
          {[[10, 4], [16, 10], [10, 16], [4, 10]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.4" fill="none" stroke="currentColor" strokeWidth="1.4" />)}
        </svg>
      </button>
    );
  }
  return (
    <>
      {infos.map((i) => <Panneau key={i.e} info={i} onBasculer={onBasculer} />)}
    </>
  );
}
