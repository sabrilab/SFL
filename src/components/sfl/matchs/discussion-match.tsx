"use client";

// La discussion d'un match ouvert par un joueur, plein écran par-dessus la
// Map (Sabri, 22/10) : ceux du match s'y parlent — « Le match, il est où ? »,
// qui connaît quelqu'un de dispo — et chacun en est prévenu sur son
// téléphone (/api/matchs/discussion).
//
// C'est l'écran du Vestiaire (components/sfl/vestiaire.tsx, Discussion) :
// mêmes bulles, réponses, réactions, vocaux, photos. En haut, le match — où,
// quand, ce qu'il manque — et le retour à la Map ; en tête du fil, les
// cartes de ceux qui jouent, celles des invités en retrait, et une place en
// braise pour chaque joueur qui manque. Les arrivées (« Kader a rejoint le
// match ») sont des lignes du fil, gardées tant qu'elles disent vrai.
//
// S'ouvre depuis les pilules au-dessus de la carte du match, depuis la fiche
// du match, ou depuis une notification (/?match=12&discussion).

import { useCallback, useEffect, useMemo, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { Discussion } from "@/components/sfl/vestiaire";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { arriveesVisibles, salonDuMatch } from "@/lib/sfl/discussion-match";
import { DEMO_DISCUSSION, filDemo } from "@/lib/sfl/discussion-match-demo";
import { aujourdhuiIso, placesLibres, type Partie } from "@/lib/sfl/matchs";
import { jourCourt } from "@/lib/sfl/jour-long";
import type { MessageV } from "@/lib/sfl/vestiaire";

const BRAISE = "#FF8A4C";
/** Au-delà, les places vides ne disent rien de plus que le nombre. */
const PLACES_MAX = 12;

export function DiscussionMatch({ partie, moi, onFermer }: { partie: Partie; moi: string | null; onFermer: () => void }) {
  const salon = useMemo(() => salonDuMatch(partie.id), [partie.id]);
  const manque = placesLibres(partie);

  // Les arrivées encore vraies : de qui est toujours du match.
  const dansLeMatch = useMemo(() => new Set([partie.organisateurId, ...partie.joueurs.map((j) => j.id)]), [partie]);
  const filtre = useCallback((ms: MessageV[]) => arriveesVisibles(ms, dansLeMatch), [dansLeMatch]);

  // Aperçus et développement : la base n'a pas encore la discussion des
  // matchs, un fil d'essai tiré des joueurs du match la remplace.
  const partieCourante = useRef(partie);
  useEffect(() => {
    partieCourante.current = partie;
  }, [partie]);
  const filEssai = useCallback(() => filDemo(partieCourante.current, moi), [moi]);

  // Échap ferme, sur ordinateur.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [onFermer]);

  // Qui joue : l'organisateur d'abord, puis les inscrits ; les invités après, en retrait.
  const orga = partie.joueurs.find((j) => j.id === partie.organisateurId);
  const jouent = [...(orga ? [orga] : []), ...partie.joueurs.filter((j) => j.statut === "inscrit" && j !== orga)];
  const invites = partie.joueurs.filter((j) => j.statut === "invite" && j !== orga);
  const cote = Math.round(254 * FORMAT_CARTE.petite);

  return (
    <Discussion
      salon={salon}
      className="discussion-entre"
      libelleNotifs="Notifications de la discussion du match"
      vide=""
      secours={DEMO_DISCUSSION ? filEssai : undefined}
      filtre={filtre}
      titre={
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onFermer}
            aria-label="Revenir à la Map"
            className="bouton-secondaire flex size-11 shrink-0 items-center justify-center"
          >
            <ChevronLeft className="size-5" strokeWidth={2.4} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[21px] leading-tight font-bold tracking-tight">{partie.lieu}</h1>
            <p className="mt-0.5 truncate text-[12.5px] font-semibold text-foreground/50">
              {jourCourt(partie.jour, aujourdhuiIso())} · {partie.heure} ·{" "}
              {manque > 0 ? <span style={{ color: BRAISE }}>Il manque {manque}</span> : "Complet"}
            </p>
          </div>
        </div>
      }
      tete={
        <div className="flex flex-wrap justify-center gap-2 pt-5 pb-1" aria-label="Les joueurs du match">
          {jouent.map((j) => (
            <CarteDe key={j.id} name={j.name} size={FORMAT_CARTE.petite} />
          ))}
          {invites.map((j) => (
            <span key={j.id} className="opacity-40">
              <CarteDe name={j.name} size={FORMAT_CARTE.petite} />
            </span>
          ))}
          {Array.from({ length: Math.min(manque, PLACES_MAX) }, (_, i) => (
            <span
              key={`vide-${i}`}
              aria-hidden
              className="shrink-0 border-[1.5px] border-dashed"
              style={{ width: cote, height: cote, borderRadius: cote * 0.24, borderColor: `${BRAISE}99`, background: `${BRAISE}14` }}
            />
          ))}
        </div>
      }
    />
  );
}
