"use client";

// Les cinématiques de ce qui te regarde (lib/sfl/actus-toi.ts), pour les
// concepts d'Actus (concepts.tsx). Même grammaire que cinematiques.tsx : de
// vraies cartes, des chiffres qui claquent, rien qui tremble.
//   · ton rival      : ta carte face à celle de devant, l'écart qui se compte ;
//   · ta trajectoire : ta courbe de rang qui se trace, dimanche après dimanche ;
//   · ton prochain cap : l'anneau de ton badge le plus proche ;
//   · tes partenaires : tes trois coéquipiers les plus fréquents, leurs bilans ;
//   · les enjeux     : les duels de points du haut du classement.

import { Badge3D } from "@/components/sfl/badge-3d";
import type { Enjeu, Partenaire, PasDeTrajectoire, Voisins } from "@/lib/sfl/actus-toi";
import type { Player } from "@/lib/sfl/engine";
import { metal, NOM_METAL, type EtatTrophee } from "@/lib/sfl/trophees";
import { cn } from "@/lib/utils";
import { Compte, t } from "./ecran";
import { Carte, Etiquette, Gros, LUEUR, NomDe, pl, Reflet, TAILLE, useJoueurs, L, H } from "./cinematiques";

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

/** Ta courbe de rang se trace, un point par dimanche ; le dernier claque. */
export function CineTrajectoire({ pas }: { pas: PasDeTrajectoire[] }) {
  if (pas.length === 0) return null;
  const pire = Math.max(...pas.map((p) => p.rang), 2);
  const W = 100;
  // Le cadre de la courbe fait ~2,5 fois sa hauteur : le dessin garde ses proportions, le trait son épaisseur.
  const Hh = 40;
  const x = (i: number) => (pas.length === 1 ? W / 2 : 6 + (i / (pas.length - 1)) * (W - 12));
  const y = (r: number) => 6 + ((r - 1) / Math.max(1, pire - 1)) * (Hh - 12);
  const d = pas.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(p.rang).toFixed(2)}`).join(" ");
  const fin = pas[pas.length - 1];
  const debut = pas[0];
  const meilleur = Math.min(...pas.map((p) => p.rang));
  return (
    <>
      <Etiquette a={0.1} className="top-[6%] left-[6%]">Ta saison · rang au Pépite d&apos;Or</Etiquette>
      <div className="absolute inset-x-[4%] top-[22%] bottom-[26%]">
        <svg viewBox={`0 0 ${W} ${Hh}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
          {[1, Math.ceil(pire / 2), pire].map((r) => (
            <line key={r} x1="0" x2={W} y1={y(r)} y2={y(r)} stroke="rgba(255,255,255,0.08)" strokeWidth="0.25" />
          ))}
          <path className="a-trace" style={t(0.4, 1.8)} pathLength={1} d={d} fill="none" stroke="#fff" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {pas.map((p, i) => (
          <span
            key={p.j}
            className={cn("a-pop absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full", i === pas.length - 1 ? "size-3.5 bg-white" : "bg-white/60")}
            style={{ ...t(0.4 + (1.8 * i) / Math.max(1, pas.length - 1), 0.4), left: `${x(i)}%`, top: `${(y(p.rang) / Hh) * 100}%` }}
          />
        ))}
        {pas.map((p, i) => (
          <span key={`j${p.j}`} className="a-fondu mono-label absolute -top-5 -translate-x-1/2 text-[8.5px] text-white/35" style={{ ...t(0.3), left: `${x(i)}%` }}>
            J{p.j}
          </span>
        ))}
      </div>
      <div className="absolute inset-x-[6%] bottom-[5%] flex items-end justify-between">
        <span className="flex flex-col">
          <span className="mono-label text-[9px] text-white/45">Aujourd&apos;hui</span>
          <span className="a-claque origin-left" style={t(2.3, 0.5)}>
            <Gros taille={46}>{fin.rang}e</Gros>
          </span>
        </span>
        <span className="a-fondu flex flex-col items-end text-right text-[12px] text-white/55" style={t(2.6)}>
          <span>{debut.rang === fin.rang ? "Même place qu'à J" + debut.j : debut.rang > fin.rang ? `▲ ${debut.rang - fin.rang} depuis J${debut.j}` : `▼ ${fin.rang - debut.rang} depuis J${debut.j}`}</span>
          <span>Meilleur rang : {meilleur}e</span>
        </span>
      </div>
    </>
  );
}

/** L'anneau de ton badge le plus proche se remplit ; ce qu'il manque claque. */
export function CineCap({ cap }: { cap: EtatTrophee }) {
  const prochainPalier = cap.palier + 1;
  const m = metal(prochainPalier) ?? "or";
  const reste = (cap.cible ?? cap.valeur) - cap.valeur;
  return (
    <>
      <Etiquette a={0.1} className="top-[6%] left-[6%]">Ton prochain badge</Etiquette>
      <div className="absolute inset-0 flex items-center gap-[7%] px-[8%]">
        <div className="relative aspect-square w-[44%] shrink-0">
          <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
            <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.4" />
            <circle
              className="a-anneau"
              style={{ ...t(0.4, 1.6), ["--plein" as string]: cap.progression }}
              pathLength={1}
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke={LUEUR[m]}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
          <span className="a-pop absolute inset-0 grid place-items-center" style={t(0.2, 0.6)}>
            <Badge3D badge={{ famille: "palier", id: cap.def.id, palier: prochainPalier }} largeur={92} />
          </span>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="a-fondu text-[15px] font-bold" style={t(0.6)}>
            {cap.def.nom} {NOM_METAL[m].toLowerCase()}
          </span>
          <span className="a-claque mt-2 origin-left" style={t(1.6, 0.5)}>
            <Gros taille={64}>{reste}</Gros>
          </span>
          <span className="a-fondu mono-label mt-1 text-[10px] text-white/60" style={t(2)}>
            {pl(reste, cap.def.unite[0], cap.def.unite[1])} de plus
          </span>
          <span className="a-fondu mt-3 text-[12px] text-white/45 tabular-nums" style={t(2.3)}>
            {cap.valeur} / {cap.cible}
          </span>
        </div>
      </div>
    </>
  );
}

/** Tes trois coéquipiers les plus fréquents, chacun avec son bilan à tes côtés. */
export function CinePartenaires({ liste }: { liste: Partenaire[] }) {
  const joueur = useJoueurs();
  const avec = liste.map((p) => ({ ...p, p: joueur(p.nom) })).filter((x) => x.p) as (Partenaire & { p: Player })[];
  return (
    <>
      <Etiquette a={0.1} className="top-[6%] left-[6%]">Avec qui tu gagnes</Etiquette>
      <div className="absolute inset-x-[4%] top-[16%] bottom-[8%] flex items-end justify-around">
        {avec.map((x, i) => {
          const taux = Math.round((x.victoires / Math.max(1, x.ensemble)) * 100);
          return (
            <div key={x.nom} className="flex flex-col items-center gap-2.5">
              <div className="a-monte" style={t(0.2 + i * 0.18, 0.8)}>
                <Carte p={x.p} size={i === 0 ? TAILLE.moyenne : TAILLE.petite * 1.25} detail={`${x.ensemble} matchs avec toi`} />
              </div>
              <span className="a-claque" style={t(1.4 + i * 0.2, 0.5)}>
                <Gros taille={i === 0 ? 40 : 30}>{taux}%</Gros>
              </span>
              <span className="a-fondu mono-label text-center text-[8.5px] text-white/50" style={t(1.7 + i * 0.2)}>
                {x.victoires} V sur {x.ensemble}
              </span>
            </div>
          );
        })}
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
