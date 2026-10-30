"use client";

// Ma note, en tête de la page Évolution (/profil/evolution) : la carte qui
// évolue (lib/sfl/saisie/evolution.ts, Sabri 26/10). Ce que j'y lis :
//   · ma note officielle, et ce que j'ai déjà gagné depuis la dernière mise à
//     jour, en attente (« +1 ») ; quand tombe la prochaine (« après la J4,
//     dans 2 journées ») ;
//   · mes six stats, chacune avec sa jauge : les crans versés sur ceux qu'il
//     faut pour +1 ; ma série de présence (trois dimanches de suite) ;
//   · mes dimanches, du plus récent : ce qui a versé des crans, ce qui a fait
//     prendre un point ; et les mises à jour passées ;
//   · « Comment ma note monte » : le barème, replié. Pas pour un joueur
//     Bola (hors de la SFL) : il parle des titres Impact et Défensive et
//     des votes du dimanche, qu'il n'a pas (28/10/2026).
// Un joueur Bola (28/10/2026, lib/sfl/carte-bola.ts) lit la même page sur
// ses matchs validés : sa carte bouge à chaque match, sans « en attente » ni
// mise à jour officielle ; son journal date chaque match au lieu de « J4 ».
// Le but : que chacun puisse refaire le calcul, et donc croire sa note.
// Noir et blanc, en currentColor et en opacités (clair comme sombre) ; les
// chiffres en Anton, les étiquettes en Inter capitales.

import { useMemo } from "react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { useJoueurBola, useMyPlayer } from "@/components/sfl/player-provider";
import { useHorsSfl } from "@/hooks/use-hors-sfl";
import { useSeason } from "@/components/sfl/season-provider";
import { ovr, STAT_KEYS, type StatKey, type Stats } from "@/lib/sfl/engine";
import { CRANS, JOURNEES_PAR_MAJ, SERIE, VOIX_MIN, type EvolutionJoueur } from "@/lib/sfl/saisie/evolution";
import { cn } from "@/lib/utils";

const NOMS: Record<StatKey, string> = {
  VIT: "Vitesse",
  TIR: "Tir",
  PAS: "Passe",
  DRI: "Dribble",
  DEF: "Défense",
  PHY: "Physique",
};

const NOMBRE = { fontFamily: ANTON, lineHeight: 0.9 } as const;

const plus = (stats: Stats, attente: Partial<Record<StatKey, number>>): Stats => {
  const s = { ...stats };
  for (const k of STAT_KEYS) s[k] += attente[k] ?? 0;
  return s;
};

const listeGains = (g: Partial<Record<StatKey, number>>) =>
  STAT_KEYS.filter((k) => g[k])
    .map((k) => `${k} +${g[k]}`)
    .join(" · ");

/** La jauge d'une stat : un trait par cran à verser, pleins ceux déjà versés. */
function Jauge({ crans, taille }: { crans: number; taille: number }) {
  if (taille === 0) return <span className="mono-label text-[9px] text-foreground/45">Max</span>;
  return (
    <span className="flex gap-[3px]" aria-hidden>
      {Array.from({ length: taille }, (_, i) => (
        <span key={i} className={cn("h-[5px] flex-1 rounded-full", i < crans ? "bg-foreground" : "bg-foreground/12")} />
      ))}
    </span>
  );
}

function Stat({ k, ev }: { k: StatKey; ev: EvolutionJoueur }) {
  const j = ev.jauges[k];
  const attente = ev.enAttente[k] ?? 0;
  return (
    <div
      className="flex flex-col gap-2 rounded-2xl bg-foreground/[0.05] p-3"
      aria-label={`${NOMS[k]} ${ev.officielles[k]}${attente ? `, +${attente} en attente` : ""}${j.taille ? `, jauge ${j.crans} sur ${j.taille}` : ""}`}
    >
      <span className="mono-label text-[10px] text-foreground/55">{k}</span>
      <span className="flex items-baseline gap-1.5">
        <span style={{ ...NOMBRE, fontSize: 30 }} className="tabular-nums">
          {ev.officielles[k]}
        </span>
        {attente > 0 && (
          <span className="font-mono text-[12px] font-bold text-foreground/50 tabular-nums">+{attente}</span>
        )}
      </span>
      <Jauge crans={j.crans} taille={j.taille} />
      {j.taille > 0 && (
        <span className="font-mono text-[10px] text-foreground/45 tabular-nums">
          {j.crans}/{j.taille}
        </span>
      )}
    </div>
  );
}

export function MaNote() {
  const { player } = useMyPlayer();
  const { evolution, bolaCarte } = useSeason();
  const joueurBola = useJoueurBola();
  const horsSfl = useHorsSfl();
  const ev = joueurBola ? (bolaCarte?.ev ?? undefined) : evolution.actif ? evolution.joueurs.get(player.name) : undefined;
  const cal = evolution.calendrier;
  const enDirect = useMemo(() => (ev ? plus(ev.officielles, ev.enAttente) : null), [ev]);
  if (!evolution.actif && !joueurBola) return null;

  const note = ovr(player.stats);
  const gagne = enDirect ? ovr(enDirect) - note : 0;
  const prochaine =
    cal.prochaineApresJ != null
      ? `après la J${cal.prochaineApresJ}`
      : `dans ${cal.avantProchaine} ${cal.avantProchaine > 1 ? "journées" : "journée"}`;
  const reste = cal.prochaineApresJ != null ? `dans ${cal.avantProchaine} ${cal.avantProchaine > 1 ? "journées" : "journée"}` : null;

  return (
    <section aria-label="Ma note" className="flex flex-col gap-[var(--fib-21)]">
      <div className="flex items-end justify-between gap-4 border-b border-foreground/10 pb-[var(--fib-13)]">
        <div className="flex items-baseline gap-2">
          <span style={{ ...NOMBRE, fontSize: 64 }} className="tabular-nums">
            {note}
          </span>
          {gagne > 0 && (
            <span style={{ ...NOMBRE, fontSize: 28 }} className="text-foreground/40 tabular-nums">
              +{gagne}
            </span>
          )}
        </div>
        {!joueurBola && (
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="mono-label text-[10px] text-foreground/55">Mise à jour officielle</span>
            <span className="text-[15px] font-semibold">{prochaine}</span>
            {reste && <span className="font-mono text-[11px] text-foreground/45">{reste}</span>}
          </div>
        )}
      </div>

      {ev ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {STAT_KEYS.map((k) => (
              <Stat key={k} k={k} ev={ev} />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="mono-label text-[10px] text-foreground/55">{joueurBola ? "Série" : "Série de présence"}</span>
            <span className="flex items-center gap-1.5" aria-label={`${joueurBola ? "Série" : "Série de présence"} : ${ev.serie} sur ${SERIE}`}>
              {Array.from({ length: SERIE }, (_, i) => (
                <span key={i} className={cn("size-2.5 rounded-full", i < ev.serie ? "bg-foreground" : "bg-foreground/15")} />
              ))}
            </span>
          </div>

          <Journal ev={ev} bola={joueurBola} />
        </>
      ) : (
        <p className="text-[15px] text-foreground/60">
          {joueurBola ? "Ta note bouge dès ton premier match validé." : "Ta note bougera dès ton premier dimanche joué."}
        </p>
      )}

      {!joueurBola && !horsSfl && <Bareme />}
    </section>
  );
}

/** Mes dimanches et mes mises à jour, mêlés, du plus récent au plus ancien. */
function Journal({ ev, bola }: { ev: EvolutionJoueur; bola?: boolean }) {
  type Ligne = { j: number; ordre: number; node: React.ReactNode };
  const lignes: Ligne[] = [];
  for (const m of ev.majs) {
    lignes.push({
      j: m.apresJ,
      ordre: 1,
      node: (
        <li key={`maj-${m.apresJ}`} className="flex items-center justify-between gap-3 rounded-2xl bg-foreground py-3 pr-4 pl-4 text-background">
          <span className="flex flex-col gap-0.5">
            <span className="mono-label text-[10px] opacity-60">Mise à jour · après J{m.apresJ}</span>
            <span className="text-[13px] font-semibold">{listeGains(m.gains)}</span>
          </span>
          <span style={{ ...NOMBRE, fontSize: 30 }} className="tabular-nums">
            {ovr(m.stats)}
          </span>
        </li>
      ),
    });
  }
  for (const d of ev.journal) {
    lignes.push({
      j: d.j,
      ordre: 0,
      node: (
        <li key={`j-${d.j}`} className="flex flex-col gap-1.5 border-b border-foreground/10 py-3 last:border-0">
          <span className="flex items-baseline justify-between gap-3">
            {bola ? (
              <span className="text-[14px] font-semibold">{d.date}</span>
            ) : (
              <span className="text-[14px] font-semibold">
                J{d.j}
                {d.date && <span className="ml-2 font-mono text-[11px] font-normal text-foreground/45">{d.date}</span>}
              </span>
            )}
            {Object.keys(d.points).length > 0 && (
              <span className="font-mono text-[12px] font-bold tabular-nums">{listeGains(d.points)}</span>
            )}
          </span>
          {d.faits.length > 0 ? (
            <span className="flex flex-wrap gap-1.5">
              {d.faits.map((f, i) => (
                <span key={i} className="rounded-full bg-foreground/[0.07] px-2.5 py-1 font-mono text-[11px] text-foreground/70">
                  {f.raison} → {f.stat} {f.crans > 1 ? `${f.crans} crans` : "1 cran"}
                </span>
              ))}
            </span>
          ) : (
            <span className="font-mono text-[11px] text-foreground/45">aucun cran</span>
          )}
        </li>
      ),
    });
  }
  if (!lignes.length) return null;
  lignes.sort((a, b) => b.j - a.j || b.ordre - a.ordre);
  return (
    <div className="flex flex-col gap-2">
      <h2 className="mono-label text-[10px] text-foreground/55">{bola ? "Mes matchs" : "Mes dimanches"}</h2>
      <ul className="flex flex-col gap-1">{lignes.map((l) => l.node)}</ul>
    </div>
  );
}

function Bareme() {
  const lignes: [string, string][] = [
    ["Tir", `${CRANS.but} cran par but`],
    ["Passe", `${CRANS.passe} cran par passe décisive`],
    ["Défense", `${CRANS.defensive} crans par titre Défensive, 1 cran pour 2 interceptions ou 2 arrêts`],
    ["Physique", `${CRANS.serie} crans pour ${SERIE} dimanches de suite, sans retard`],
    ["Dribble", `${CRANS.impact} crans par titre Impact`],
    ["MVP", `${CRANS.mvp} crans sur tes deux meilleures stats`],
    ["Vitesse", "+1 quand tir et passe prennent un point dans la même mise à jour"],
    ["Dribble", "+1 quand défense et physique prennent un point dans la même mise à jour"],
  ];
  return (
    <details className="group rounded-2xl bg-foreground/[0.05] px-4 py-3">
      <summary className="cursor-pointer list-none text-[14px] font-semibold marker:hidden">
        Comment ma note monte
        <span className="float-right text-foreground/45 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <ul className="mt-3 flex flex-col gap-2 text-[13px] leading-snug">
        {lignes.map(([quoi, comment], i) => (
          <li key={i} className="flex gap-3">
            <span className="mono-label w-[74px] shrink-0 pt-[2px] text-[10px] text-foreground/55">{quoi}</span>
            <span>{comment}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] leading-snug text-foreground/60">
        {`Une jauge pleine donne +1. Elle grandit avec la stat\u00a0: 2 crans sous 80, 3 jusqu’à 84, 5 jusqu’à 89, 8 jusqu’à 94, 12 au-delà. La carte officielle change toutes les ${JOURNEES_PAR_MAJ} journées jouées\u00a0; une note ne descend jamais. Un titre voté compte à partir de ${VOIX_MIN}\u00a0voix\u00a0; l’extra time ne compte pas.`}
      </p>
    </details>
  );
}
