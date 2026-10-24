"use client";

// Mon Niveau XP, sur Ma carte, sous Ma saison (missions, 22/10). Deux
// compteurs à part de la carte : le terrain fait la note et les points
// Pépite ; l'app fait l'XP (lib/sfl/missions.ts) : 100 XP par dimanche joué,
// la prime de chaque mission acceptée et réussie, 150 de plus pour trois sur
// trois ; une mission acceptée puis ratée en reprend la moitié de sa prime.
// Sabri, 24/10 : les XP, la passe et les saisons dans le même design que les
// fiches de contrat, « une interface d'encadrés plus gamifiée, peut-être avec
// un peu plus de couleurs, sans tomber dans l'AI slop ». Tout est en fiches
// noires (actus/missions.css), chacune dans le ton de ce qu'elle compte :
//   · le Niveau XP, à vie (passer du niveau n au suivant coûte 100 × n), dans
//     le ton de mon rang, B, A ou S, d'après ma place au classement de l'XP à
//     vie (rangsDesJoueurs : les 10 % de tête S, les 25 % suivants A) ;
//   · le Passe Bola de la saison (passe-bola.tsx) ;
//   · trois encadrés : les missions accomplies (le vert des missions
//     acceptées), le cadre de la carte et ses crans (l'argent de ses coins :
//     3, 9, 18, 30 missions), les dimanches à trois sur trois (le mauve) ;
//   · le journal, chaque gain dans le ton de ce qui l'a fait gagner : le rang
//     de la mission, le vert des trois sur trois, le rouge d'une mission ratée.
// « Niveau XP » et pas « Niveau » : dans les règles BOLA, le Niveau est déjà
// celui de la carte, de 1 à 50.

import { ANTON } from "@/components/sfl/actus/ecran";
import { Insigne } from "@/components/sfl/actus/missions";
import { PasseBola } from "@/components/sfl/passe-bola";
import { useRangXp, useXp } from "@/hooks/use-missions";
import type { Player } from "@/lib/sfl/engine";
import { CRANS, type BilanXp, type LigneXp, type RangJoueur } from "@/lib/sfl/missions";
import { cn } from "@/lib/utils";
import "./passe-bola.css";

const eme = (n: number) => (n === 1 ? "1re" : `${n}e`);

/** Le niveau à vie, dans le ton de mon rang. */
function Niveau({ b, r }: { b: BilanXp; r: RangJoueur | null }) {
  return (
    <article aria-labelledby="titre-niveau" className={cn("fiche dark", `fiche--${r?.rang ?? "B"}`)}>
      <div className="fiche__bandeau">
        <span className="fiche__etiquette">Niveau XP</span>
        <span className="fiche__type mono-label text-white/75">
          {r && r.xp > 0 ? `${eme(r.place)} sur ${r.sur}` : "Hors classement"}
        </span>
      </div>
      <div className="flex items-center gap-4 px-[18px] pt-4 pb-5">
        <h3
          id="titre-niveau"
          className="min-w-[58px] text-center tabular-nums"
          style={{
            fontFamily: ANTON,
            fontSize: 64,
            lineHeight: 0.85,
            color: "var(--r-texte)",
            textShadow: "0 0 24px rgb(var(--r-lueur) / 0.45)",
          }}
        >
          <span className="sr-only">Niveau </span>
          {b.niveau}
        </h3>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="truncate text-[15px] font-bold">Vers le niveau {b.niveau + 1}</span>
          <div className="passe__barre">
            <span style={{ width: `${Math.min(1, b.dansLeNiveau / Math.max(1, b.pourLeSuivant)) * 100}%` }} />
          </div>
          <span className="font-mono text-[11px] text-white/55 tabular-nums">
            {b.dansLeNiveau} / {b.pourLeSuivant} XP
          </span>
          {r?.suivant && (
            <span className="mono-label text-white/45">
              Rang {r.suivant.rang} : {r.suivant.place === 1 ? "le premier" : `les ${r.suivant.place} premiers`}
            </span>
          )}
        </div>
        {r && <Insigne rang={r.rang} />}
      </div>
    </article>
  );
}

function Encadre({ ton, chiffre, titre, sous }: { ton: string; chiffre: React.ReactNode; titre: string; sous?: string }) {
  return (
    <div className={cn("xp__encadre", ton)}>
      <span className="xp__chiffre tabular-nums">{chiffre}</span>
      <span className="text-[12px] leading-[1.2] font-semibold">{titre}</span>
      {sous && <span className="font-mono text-[10.5px] leading-tight text-white/50 tabular-nums">{sous}</span>}
    </div>
  );
}

/** Le ton d'un gain : le rang de sa mission, le vert des trois sur trois ; une perte, le rouge. */
const tonDe = (l: LigneXp) => (l.xp < 0 ? "ton--rouge" : l.parfait ? "ton--vert" : l.mission ? `fiche--${l.mission.rang}` : "");

export function NiveauXp({ saison, player }: { saison: number; player: Player }) {
  const b = useXp(player.name);
  const r = useRangXp(player.name);
  if (!b) return null;
  const crans = CRANS.filter((c) => b.reussies >= c).length;
  const versCran = CRANS.find((c) => b.reussies < c);
  const parfaits = b.lignes.filter((l) => l.parfait).length;

  return (
    <section aria-labelledby="niveau-xp" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 id="niveau-xp" className="mono-label text-muted-foreground">
          Niveau XP
        </h2>
        <span className="font-mono text-[12px] font-bold text-foreground/45 tabular-nums">
          {b.total.toLocaleString("fr-FR")} XP à vie
        </span>
      </div>

      <Niveau b={b} r={r} />

      <PasseBola player={player} saison={saison} b={b} rang={r?.rang ?? "B"} />

      <div className="grid grid-cols-3 gap-2">
        <Encadre
          ton="ton--vert"
          chiffre={b.reussies}
          titre={b.reussies > 1 ? "Missions accomplies" : "Mission accomplie"}
        />
        <Encadre
          ton="fiche--B"
          chiffre={
            <span className="flex h-[27px] items-center gap-1" aria-label={`${crans} crans sur 4`}>
              {CRANS.map((c, i) => (
                <span key={c} className={cn("xp__cran", i < crans && "xp__cran--on")} />
              ))}
            </span>
          }
          titre="Cadre de ta carte"
          sous={versCran ? `${b.reussies} / ${versCran}` : "Complet"}
        />
        <Encadre ton="fiche--A" chiffre={parfaits} titre={parfaits > 1 ? "Dimanches à 3 sur 3" : "Dimanche à 3 sur 3"} />
      </div>

      {b.lignes.length > 0 && (
        <div className="fiche dark">
          <div className="fiche__bandeau">
            <span className="fiche__etiquette">Journal</span>
            <span className="fiche__type mono-label text-white/75">{b.saison.toLocaleString("fr-FR")} XP cette saison</span>
          </div>
          {b.lignes.slice(0, 5).map((l, i) => (
            <div
              key={`${l.saison}-${l.j}-${l.quoi}-${i}`}
              className={cn("flex items-center gap-3 px-[18px] py-3", i > 0 && "border-t border-white/8", tonDe(l))}
            >
              <span className="w-[44px] shrink-0 font-mono text-[11px] text-white/45">
                {l.saison === saison ? `J${l.j}` : `S${l.saison} J${l.j}`}
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{l.quoi}</span>
              {l.mission && l.xp > 0 && <span className="passe__rang shrink-0">{l.mission.rang}</span>}
              <span className={cn("font-mono text-[13px] font-bold tabular-nums", tonDe(l) && "xp__gain")}>
                {l.xp < 0 ? `−${-l.xp}` : `+${l.xp}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
