"use client";

// Les missions perso d'un joueur Bola, sur la face Missions du mode Passe
// (mode-passe-missions.tsx), à la place des Missions Bola du dimanche qu'il
// n'a pas (lib/sfl/missions-perso.ts ; Sabri, 28/10/2026 : « des missions
// personnelles marqué 3 buts etc »).
//
// Les cinq fiches de contrat des Missions Bola (actus/missions.tsx,
// missions.css), resserrées : le bandeau, le nom de code et l'insigne du
// rang, l'objectif, la prime, où j'en suis cette semaine, puis le tampon une
// fois réussie. Rien à accepter ni à passer : elles ne coûtent rien. Une
// mission qui passe à « réussie » pendant que l'écran est ouvert fait vibrer.

import { useEffect, useMemo, useRef } from "react";
import { Insigne, Tampon } from "@/components/sfl/actus/missions";
import { ANTON } from "@/components/sfl/actus/ecran";
import { useSeason } from "@/components/sfl/season-provider";
import { useMaintenant } from "@/hooks/use-missions";
import { tic } from "@/lib/sfl/haptique";
import { aujourdhuiParis, missionsPerso, rangPerso, semaineDe, type ProgresPerso } from "@/lib/sfl/missions-perso";
import { jourCourt } from "@/lib/sfl/carte-bola";
import { cn } from "@/lib/utils";
import "@/components/sfl/actus/missions.css";

function FichePerso({ p }: { p: ProgresPerso }) {
  const rang = rangPerso(p.m);
  return (
    <article
      aria-label={`Mission ${p.m.code}, rang ${rang}${p.faite ? ", réussie" : `, ${p.progres} sur ${p.m.objectif}`}`}
      className={cn("fiche dark mx-4 md:mx-0", `fiche--${rang}`, p.faite && "fiche--reussie")}
    >
      <div className="fiche__bandeau">
        <span className="fiche__etiquette">Mission perso</span>
        <span className="fiche__type mono-label text-white/75">Cette semaine</span>
      </div>
      <div className="flex flex-col gap-4 px-[18px] pt-4 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2 pt-1">
            <h3 className="titre-lettrage text-titre-l leading-[0.9] break-words">{p.m.code}</h3>
            <span className="mono-label fiche__ton leading-none">Rang {rang}</span>
          </div>
          <Insigne rang={rang} />
        </div>
        <p className="text-titre-fort leading-[1.15] font-bold tracking-[-0.3px]">{p.m.phrase}</p>
        <div className="flex items-end justify-between gap-4">
          {p.faite ? (
            <Tampon>Accomplie · +{p.m.xp} XP</Tampon>
          ) : (
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="flex gap-[4px]" aria-hidden>
                {Array.from({ length: p.m.objectif }, (_, i) => (
                  <span key={i} className={cn("h-[5px] flex-1 rounded-full", i < p.progres ? "bg-white" : "bg-white/15")} />
                ))}
              </span>
              <span className="font-mono text-petit text-white/55 tabular-nums">
                {p.progres}/{p.m.objectif}
              </span>
            </span>
          )}
          <span className="fiche__ton flex shrink-0 items-baseline gap-1">
            <span className="text-titre-g leading-none" style={{ fontFamily: ANTON }}>
              +{p.m.xp}
            </span>
            <span className="mono-label">XP</span>
          </span>
        </div>
      </div>
    </article>
  );
}

/** Les cinq missions perso de la semaine. */
export function MissionsPerso() {
  const { bolaCarte } = useSeason();
  const maintenant = useMaintenant();
  const bilan = useMemo(() => missionsPerso(bolaCarte?.valides ?? [], maintenant), [bolaCarte, maintenant]);
  const faites = bilan.semaine.filter((p) => p.faite).map((p) => p.m.genre).join(",");
  const avant = useRef<string | null>(null);
  useEffect(() => {
    // Une mission réussie pendant que l'écran est ouvert : un tic (pas à l'ouverture).
    if (avant.current !== null && faites.length > avant.current.length) tic([10, 40, 18]);
    avant.current = faites;
  }, [faites]);
  const lundi = semaineDe(aujourdhuiParis(maintenant));
  return (
    <section aria-labelledby="titre-missions-perso" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 px-5 md:px-0">
        <span className="mono-label text-white/45">Semaine du {jourCourt(lundi)}</span>
        <h2 id="titre-missions-perso" className="titre-lettrage text-titre-l leading-[0.95]">
          Missions perso
        </h2>
      </div>
      {bilan.semaine.map((p) => (
        <FichePerso key={p.m.genre} p={p} />
      ))}
    </section>
  );
}
