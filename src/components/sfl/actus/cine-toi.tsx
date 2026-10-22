"use client";

// Les cinématiques de ce qui te regarde (lib/sfl/actus-toi.ts), pour les
// fil de la course (course.tsx). Même grammaire que cinematiques.tsx : de
// vraies cartes, des chiffres qui claquent, rien qui tremble.
//   · ton rival      : ta carte face à celle de devant, l'écart qui se compte ;
//   · les enjeux     : les duels de points du haut du classement.

import type { Enjeu, Voisins } from "@/lib/sfl/actus-toi";
import { cn } from "@/lib/utils";
import { Compte, t } from "./ecran";
import { Carte, Etiquette, Gros, NomDe, pl, Reflet, TAILLE, useJoueurs, L, H } from "./cinematiques";

/** Ta carte à gauche, celle de devant à droite : elles glissent l'une vers l'autre, l'écart se compte entre elles. */
export function CineRival({ v }: { v: Voisins }) {
  const joueur = useJoueurs();
  const moi = joueur(v.moi.name);
  const lui = v.devant ? joueur(v.devant.name) : null;
  const ecart = v.devant ? v.devant.pp - v.moi.pp : 0;
  if (!moi) return null;
  return (
    <>
      <Etiquette a={0.1} className="top-[5%] left-[6%]">{lui ? "Ton rival" : "Tu mènes"}</Etiquette>
      <div className="absolute inset-x-[5%] top-[14%] flex items-start justify-between">
        <div className="a-glisse-g flex flex-col items-center gap-2" style={t(0.2, 0.8)}>
          <div className="relative">
            <Carte p={moi} size={TAILLE.moyenne} detail={`${v.moi.rank}e · ${v.moi.pp} pts`} />
            <Reflet a={1.2} largeur={L(TAILLE.moyenne)} hauteur={H(TAILLE.moyenne)} />
          </div>
          <span className="mono-label text-[9px] text-white/55">Toi · {v.moi.rank}e</span>
        </div>
        {lui && v.devant && (
          <div className="a-glisse-d flex flex-col items-center gap-2" style={t(0.35, 0.8)}>
            <Carte p={lui} size={TAILLE.moyenne} detail={`${v.devant.rank}e · ${v.devant.pp} pts`} />
            <span className="mono-label text-[9px] text-white/55">
              <NomDe n={lui.name} /> · {v.devant.rank}e
            </span>
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-[8%] flex flex-col items-center">
        {lui ? (
          <>
            <span className="a-claque" style={t(1.3, 0.5)}>
              <Gros taille={72}>
                <Compte n={ecart} a={1.3} du={0.8} />
              </Gros>
            </span>
            <span className="a-fondu mono-label mt-1 text-[10px] text-white/60" style={t(1.8)}>
              {pl(ecart, "point", "points")} entre vous · {ecart + 1} pour passer devant
            </span>
          </>
        ) : (
          <span className="a-claque" style={t(1.1, 0.5)}>
            <Gros taille={64}>1er</Gros>
          </span>
        )}
        {v.derriere && (
          <span className="a-fondu mt-3 text-[12.5px] text-white/45" style={t(2.2)}>
            <NomDe n={v.derriere.name} /> est à {v.moi.pp - v.derriere.pp} derrière toi
          </span>
        )}
      </div>
    </>
  );
}

/** Les places qui se jouent : chaque duel en deux petites cartes et l'écart entre elles. */
export function CineEnjeux({ liste, moi }: { liste: Enjeu[]; moi: string }) {
  const joueur = useJoueurs();
  const duels = liste.slice(0, 3);
  return (
    <>
      <Etiquette a={0.1} className="top-[5%] left-[6%]">Ce qui se joue dimanche</Etiquette>
      <div className="absolute inset-x-[5%] top-[13%] bottom-[5%] flex flex-col justify-around">
        {duels.map((d, i) => {
          const a = joueur(d.haut.name);
          const b = joueur(d.bas.name);
          if (!a || !b) return null;
          const toi = d.haut.name === moi || d.bas.name === moi;
          return (
            <div key={d.haut.name + d.bas.name} className={cn("flex items-center gap-3 rounded-2xl px-2 py-1.5", toi && "bg-white/10")}>
              <span className="w-6 text-right text-[12px] font-bold text-white/45 tabular-nums">{d.haut.rank}</span>
              <div className="a-glisse-g" style={t(0.2 + i * 0.2, 0.6)}>
                <Carte p={a} size={TAILLE.petite} />
              </div>
              <span className="a-claque flex-1 text-center" style={t(0.9 + i * 0.2, 0.5)}>
                <Gros taille={30}>{d.ecart}</Gros>
                <span className="mono-label block text-[8px] text-white/45">{pl(d.ecart, "pt", "pts")}</span>
              </span>
              <div className="a-glisse-d" style={t(0.3 + i * 0.2, 0.6)}>
                <Carte p={b} size={TAILLE.petite} />
              </div>
              <span className="w-6 text-[12px] font-bold text-white/45 tabular-nums">{d.bas.rank}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
