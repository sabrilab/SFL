"use client";

// La troisième face du mode Passe : les missions des autres. Sabri, 27/10 :
// « On veut pas voir les missions de tout le monde [dans les Actus]. Il faut
// que ça soit accessible dans l'onglet Ma carte, dans les niveaux XP, pour
// qu'on puisse voir les missions et les missions des gens. » Les Missions
// (mode-passe-missions.tsx) sont les miennes ; ici, toute la ligue :
//   · l'outsider de l'arc 1, « La journée de Miken », sa quête et ses
//     chapitres (actus/outsider.tsx) ; la notification du samedi y mène
//     (/profil/xp?vue=autres#outsider) ;
//   · les Contrats en jeu : toutes les missions acceptées du dimanche,
//     face-à-face, rangs S, A et B, défi et ligue (actus/contrats-en-jeu.tsx).
//     La base les montre à toute la ligue, jamais un « passer » (Sabri, 23/10).
// Les Actus n'en gardent qu'une pièce, le contrat à la une
// (actus/contrat-a-la-une.tsx). /ligue/contrats renvoie ici.

import { ContratsEnJeu } from "@/components/sfl/actus/contrats-en-jeu";
import { RubriqueOutsider } from "@/components/sfl/actus/outsider";
import { useMissionsDeLaLigue } from "@/hooks/use-missions";

/** La face Les autres du mode Passe : elle défile, le reste du mode reste en place. */
export function VueAutres() {
  const lg = useMissionsDeLaLigue();
  return (
    <div className="mp-missions">
      <RubriqueOutsider colonne />
      {lg && lg.total > 0 ? (
        <ContratsEnJeu colonne />
      ) : (
        <section className="flex flex-col gap-1.5 px-5">
          <span className="mono-label text-white/45">{lg ? `J${lg.d.j} · Toute la ligue` : "Toute la ligue"}</span>
          <h2 className="titre-lettrage text-[30px] leading-[0.95]">Contrats en jeu</h2>
          <p className="text-[14px] font-semibold text-white/55">Personne n&apos;a encore signé.</p>
        </section>
      )}
    </div>
  );
}
