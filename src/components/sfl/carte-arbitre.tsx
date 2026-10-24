"use client";

// La carte d'un arbitre (Sabri, 24/10 : « une carte d'arbitre […] et des
// stats associées : le nombre de matchs arbitrés. […] chaque joueur du match
// puisse mettre une note de satisfaction à l'arbitre, et ça apparaît sur sa
// carte au lieu de son score de joueur »).
//
// La carte Bola elle-même (bola-card.tsx), dans le tissu noir de la tenue
// (finitions-carte.ts, matière « arbitre ») : sa photo du studio comme tout
// le monde, l'étiquette ARBITRE, et à la place de la note de joueur sa
// satisfaction, la moyenne des notes des joueurs sur 5, ×20 (lib/sfl/arbitres
// ; « – » tant qu'il n'en a pas). À la place des six stats, ses chiffres :
//   · mat : les matchs arbitrés (ceux des journées déjà jouées) ;
//   · avis : les notes reçues ;
//   · top : la part de 5 sur 5 ;
//   · der : la satisfaction de son dernier match noté.
// Ni badge, ni habillage : ce n'est pas une carte de joueur.

import { BolaCard } from "./bola-card";
import { usePhotoPerso } from "@/hooks/use-player-photo";
import { useIdentites } from "@/hooks/use-identites";
import { useArbitres } from "@/hooks/use-arbitres";

const ou = (v: number | null, suffixe = "") => (v == null ? "–" : `${v}${suffixe}`);

export function CarteArbitre({ nom, size = 1 }: { nom: string; size?: number }) {
  const photo = usePhotoPerso(nom);
  const identite = useIdentites();
  const s = useArbitres().stats(nom);
  return (
    <BolaCard
      edition="arbitre"
      name={nom}
      affiche={identite.nom(nom)}
      username={identite.pseudo(nom)}
      position="arbitre"
      overall={0}
      stats={{ VIT: 0, TIR: 0, PAS: 0, DRI: 0, DEF: 0, PHY: 0 }}
      size={size}
      photo={photo}
      arbitre={{
        note: ou(s.satisfaction),
        stats: [
          ["mat", s.matchs],
          ["avis", s.avis],
          ["top", ou(s.top, "%")],
          ["der", ou(s.dernier)],
        ],
      }}
    />
  );
}
