"use client";

// Sous la courbe de croissance : ce que l'app a fait le jour qu'on touche, et
// les pics de la période. Sabri, 24/10 : « quand on voit la croissance, voir
// rapidement les actions qui ont été faites à ce moment-là de la part de
// l'application, pour qu'on comprenne encore la relation entre les choses ».
//
//   · Pics : les jours de la période où la courbe a sauté (lib/sfl/reperes.ts,
//     pics), un toucher les choisit sur la courbe ;
//   · CeJourLa : le jour choisi, sa valeur et l'écart à un jour ordinaire,
//     puis chacun de ses repères, avec la marque qu'il porte sous la courbe
//     (./graphiques.tsx) : une journée de la ligue (●), un match ouvert par
//     un joueur (○), une notification à toute la ligue (◆), les
//     notifications entre joueurs (·), une mise en ligne (■).

import { useState } from "react";
import type { Ecart, Repere } from "@/lib/sfl/reperes";
import { jjmm, milliers, type MetriqueId } from "@/lib/sfl/retention";
import { cn } from "@/lib/utils";

/** La marque d'un repère : la même que sous la courbe. */
function Marque({ r }: { r: Repere }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="mt-[4px] shrink-0 text-foreground">
      {r.famille === "terrain" &&
        (r.fort ? (
          <circle cx="5" cy="5" r="3.5" fill="currentColor" />
        ) : (
          <circle cx="5" cy="5" r="2.8" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.3" />
        ))}
      {r.famille === "notif" &&
        (r.fort ? (
          <rect x="2.2" y="2.2" width="5.6" height="5.6" transform="rotate(45 5 5)" fill="currentColor" />
        ) : (
          <circle cx="5" cy="5" r="1.9" fill="currentColor" fillOpacity="0.5" />
        ))}
      {r.famille === "appli" && <rect x="2.5" y="2.5" width="5" height="5" rx="1" fill="currentColor" fillOpacity="0.7" />}
    </svg>
  );
}

const virgule = (x: number) => x.toFixed(1).replace(".", ",");

/** Ce que compte chaque mesure, après le nombre (les minutes se disent seules). */
const MOTS: Record<MetriqueId, string> = {
  hebdo: "actifs sur 7 jours",
  actifs: "joueurs actifs",
  nouveaux: "nouveaux joueurs",
  cumul: "joueurs au total",
  sessions: "sessions",
  minutes: "",
};

/** « 3,1 fois un jour ordinaire (10) », « +5 sur la veille ». */
function phraseEcart(e: Ecart, format: (v: number) => string): string | null {
  if (e.variation !== null)
    return e.variation === 0 ? "comme la veille" : `${e.variation > 0 ? "+" : "−"}${milliers(Math.abs(e.variation))} sur la veille`;
  if (e.ordinaire === null) return null;
  if (e.fois === null) return `un jour ordinaire : ${format(0)}`;
  const ordinaire = `un jour ordinaire (${format(e.ordinaire)})`;
  if (e.fois > 1.25) return `${virgule(e.fois)} fois ${ordinaire}`;
  if (e.fois < 0.8) return `moins qu'${ordinaire}`;
  return `comme ${ordinaire}`;
}

/** L'étiquette d'un pic : « ×3,1 », « +5 ». */
function etiquettePic(e: Ecart): string {
  if (e.fois !== null) return `×${virgule(e.fois)}`;
  if (e.variation !== null) return `+${milliers(e.variation)}`;
  return milliers(e.valeur);
}

export function Pics({
  pics,
  actif,
  onChoisir,
}: {
  /** Leur rang sur la courbe, leur jour, leur écart. */
  pics: { i: number; t: number; ecart: Ecart }[];
  actif: number;
  onChoisir: (i: number) => void;
}) {
  if (pics.length === 0) return null;
  return (
    <div className="mb-3 flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
      <span className="mono-label shrink-0 text-micro text-encre-3">Pics</span>
      {pics.map((p) => (
        <button
          key={p.t}
          onClick={() => onChoisir(p.i)}
          className={cn(
            "shrink-0 px-2.5 py-1 text-petit font-semibold tabular-nums",
            actif === p.i ? "bouton-principal" : "bouton-secondaire text-encre-2"
          )}
        >
          {jjmm(p.t)} · {etiquettePic(p.ecart)}
        </button>
      ))}
    </div>
  );
}

/** Au-delà, « et N autres » : un jour d'août a vu dix mises en ligne. */
const VISIBLES = 6;

export function CeJourLa({
  t,
  aujourdhui,
  reperes,
  ecart,
  metrique,
  format,
}: {
  /** Minuit du jour choisi. */
  t: number;
  aujourdhui: boolean;
  reperes: Repere[];
  ecart: Ecart;
  metrique: MetriqueId;
  format: (v: number) => string;
}) {
  const [tout, setTout] = useState(false);
  const visibles = tout ? reperes : reperes.slice(0, VISIBLES);
  const valeur = MOTS[metrique] ? `${format(ecart.valeur)} ${MOTS[metrique]}` : format(ecart.valeur);
  const phrase = phraseEcart(ecart, format);
  const heure = (at: number) => new Date(at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div>
      <p className="mono-label text-micro text-encre-3">
        {aujourdhui ? "Aujourd'hui · " : ""}
        {new Date(t).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
      </p>
      <p className="mt-1 text-corps leading-snug">
        <span className="font-bold tabular-nums">{valeur}</span>
        {phrase && <span className="text-encre-3 tabular-nums"> · {phrase}</span>}
      </p>
      {reperes.length === 0 ? (
        <p className="mt-2 text-petit text-encre-3">Ni match, ni notification de l&apos;app, ni mise en ligne ce jour-là.</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {visibles.map((r, k) => (
            <li key={`${r.famille}${r.at}${k}`} className="flex gap-2.5 border-t border-foreground/6 py-2 first:border-0">
              <Marque r={r} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-corps leading-snug font-semibold">{r.titre}</span>
                  {!r.parJour && (
                    <span className="mono-label shrink-0 text-micro text-encre-3 tabular-nums">{heure(r.at)}</span>
                  )}
                </div>
                {(r.detail || r.pr) && (
                  <p className="mt-0.5 text-petit leading-snug text-encre-3">
                    {r.detail}
                    {r.pr ? <span className="text-encre-4 tabular-nums">{r.detail ? " · " : ""}#{r.pr}</span> : null}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {reperes.length > VISIBLES && (
        <button onClick={() => setTout((v) => !v)} className="mono-label mt-1 text-micro text-encre-3">
          {tout ? "Moins" : `Et ${reperes.length - VISIBLES} autres`}
        </button>
      )}
    </div>
  );
}
