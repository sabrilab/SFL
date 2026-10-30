"use client";

// Les défis d'un joueur, sur la face Missions du mode Passe
// (mode-passe-missions.tsx) : le prochain badge de palier de chaque famille,
// devenu fiche de mission (lib/sfl/defis.ts ; Sabri, 30/10 : « quelqu'un est
// à 8 buts : challenge accepté pour atteindre le trophée des 10 buts »).
//
// Toujours là, pour tout le monde (joueur de la SFL, joueur Bola, l'admin) :
// c'est ce qui manquait entre deux dimanches. Les trois plus proches en
// fiches, les autres repliés derrière « Tous les défis ». Les mêmes fiches
// que les missions perso (missions-perso.tsx) : bandeau, nom de code, insigne
// du rang de la prime, l'objectif, où j'en suis, la prime.
//
// Le compte vitrine (compte-vitrine.ts) a tous ses badges au plus haut : il
// n'aurait aucun défi. Il voit donc les siens comme les verrait un joueur,
// sur la vraie saison (sansVitrine).

import { useMemo, useState } from "react";
import { Insigne } from "@/components/sfl/actus/missions";
import { ANTON } from "@/components/sfl/actus/ecran";
import { useSeason } from "@/components/sfl/season-provider";
import { saisonsBolaDe } from "@/lib/sfl/carte-bola";
import { estVitrine, sansVitrine } from "@/lib/sfl/compte-vitrine";
import { defisDe, nomCourt, type Defi } from "@/lib/sfl/defis";
import { quantite, vitrine } from "@/lib/sfl/trophees";
import { cn } from "@/lib/utils";
import "@/components/sfl/actus/missions.css";

/** Au-delà, une jauge continue plutôt que des crans. */
const CRANS_MAX = 12;

function FicheDefi({ d }: { d: Defi }) {
  const { etat } = d;
  const base = etat.def.paliers[d.vise - 2] ?? 0;
  const pas = etat.cible! - base;
  const fait = etat.valeur - base;
  return (
    <article
      aria-label={`Défi ${d.code}, rang ${d.rang}, ${etat.valeur} sur ${etat.cible}`}
      className={cn("fiche dark mx-4 md:mx-0", `fiche--${d.rang}`)}
    >
      <div className="fiche__bandeau">
        <span className="fiche__etiquette">{d.accepte ? "Défi accepté" : "Défi"}</span>
        <span className="fiche__type mono-label text-white/75">
          Badge · {etat.def.unite[0] === "fois" ? `${etat.cible}× ${nomCourt(etat.def.id, etat.def.nom)}` : quantite(etat.def, etat.cible!)}
        </span>
      </div>
      <div className="flex flex-col gap-4 px-[18px] pt-4 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2 pt-1">
            <h3 className="titre-lettrage text-[28px] leading-[0.9] break-words">{d.code}</h3>
            <span className="mono-label fiche__ton leading-none">Rang {d.rang}</span>
          </div>
          <Insigne rang={d.rang} />
        </div>
        <p className="text-[18px] leading-[1.15] font-bold tracking-[-0.3px]">{d.phrase}</p>
        <div className="flex items-end justify-between gap-4">
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            {pas <= CRANS_MAX ? (
              <span className="flex gap-[4px]" aria-hidden>
                {Array.from({ length: pas }, (_, i) => (
                  <span key={i} className={cn("h-[5px] flex-1 rounded-full", i < fait ? "bg-white" : "bg-white/15")} />
                ))}
              </span>
            ) : (
              <span className="h-[5px] overflow-hidden rounded-full bg-white/15" aria-hidden>
                <span className="block h-full rounded-full bg-white" style={{ width: `${(fait / pas) * 100}%` }} />
              </span>
            )}
            <span className="font-mono text-[12px] text-white/55 tabular-nums">
              {etat.valeur}/{etat.cible}
            </span>
          </span>
          <span className="fiche__ton flex shrink-0 items-baseline gap-1">
            <span className="text-[25px] leading-none" style={{ fontFamily: ANTON }}>
              +{d.xp}
            </span>
            <span className="mono-label">XP</span>
          </span>
        </div>
      </div>
    </article>
  );
}

/** Les défis du joueur `nom`, du plus proche au plus loin. */
export function useDefis(nom: string): Defi[] {
  const { saison, bolaCarte } = useSeason();
  return useMemo(() => {
    // Le compte vitrine se lit comme un joueur : la vraie saison, ses vrais compteurs.
    const v = estVitrine(nom);
    const etats = vitrine(v ? sansVitrine(saison) : saison, nom, new Date(), saisonsBolaDe(bolaCarte, nom), v);
    return defisDe(etats);
  }, [saison, bolaCarte, nom]);
}

export function Defis({ nom }: { nom: string }) {
  const defis = useDefis(nom);
  const [tous, setTous] = useState(false);
  if (!defis.length) return null;
  const vus = tous ? defis : defis.slice(0, 3);
  return (
    <section aria-labelledby="titre-defis" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 px-5 md:px-0">
        <span className="mono-label text-white/45">Tes prochains badges</span>
        <h2 id="titre-defis" className="titre-lettrage text-[30px] leading-[0.95]">
          Défis
        </h2>
      </div>
      {vus.map((d) => (
        <FicheDefi key={d.etat.def.id} d={d} />
      ))}
      {defis.length > 3 && (
        <button type="button" onClick={() => setTous((t) => !t)} className="mp-bouton mp-bouton--creux mx-auto">
          {tous ? "Moins de défis" : `Tous les défis · ${defis.length}`}
        </button>
      )}
    </section>
  );
}
