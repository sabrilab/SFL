"use client";

// Le contrat à la une, dans les Actus. Sabri, 27/10 : « Tu mets pas les
// missions. Tu mets juste des missions de rang S. Une fois de temps en temps,
// qu'elles soient acceptées par de bons joueurs, faut vraiment que ce soit
// marketé correctement. » Une seule pièce, jamais une liste : le contrat de
// rang S qu'un bon joueur a signé pour dimanche (la règle :
// lib/sfl/contrat-a-la-une.ts), le vendredi et le samedi (course.tsx). Sans
// bon joueur qui signe un rang S, rien.
//
// Une affiche de rang S de la DA « Lune » (missions.css, lune.css), tirée
// comme une impression de la carte : la rosace guillochée de son dos
// (RosaceBola), les coins de repère, une ligne de microtexte et un numéro de
// série en pied.
//   · celui qui a signé, sa carte en grand dans le halo du rang ; sa place à
//     la Pépite d'Or, son rang à l'XP à vie ;
//   · le contrat : la cible sous l'orbite, l'objectif, la prime et le risque ;
//     après le coup d'envoi, « En jeu », puis le tampon du verdict ;
//   · Suivre, le partage au Vestiaire.
// « Tout voir » mène à toutes les missions de la ligue, dans Ma carte →
// Niveau XP → Les autres (/profil/xp?vue=autres). Rien n'y bouge à
// l'arrivée : les tampons sont déjà encrés, le viseur posé verrouillé.

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, MessageCircle } from "lucide-react";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { RosaceBola } from "@/components/sfl/motif-carte";
import { Nom } from "@/components/sfl/nom";
import { BoutonSuivre } from "@/components/sfl/suivre";
import { useIdentites } from "@/hooks/use-identites";
import { useMissionsDeLaLigue, useXpLigue } from "@/hooks/use-missions";
import { contratALaUne } from "@/lib/sfl/contrat-a-la-une";
import { NOM_DE_CODE, phrase, prenom } from "@/lib/sfl/missions";
import { preparerPiece } from "@/lib/sfl/vestiaire";
import { cn } from "@/lib/utils";
import { etatFiche, etatViseur, onglet, Resultat } from "./contrats-en-jeu";
import { Carte, Champ, Viseur } from "./missions";
import "./missions.css";

const rangTexte = (n: number) => (n === 1 ? "1er" : `${n}e`);

export function ContratALaUne({ className }: { className?: string }) {
  const router = useRouter();
  const id = useIdentites();
  const lg = useMissionsDeLaLigue();
  const xp = useXpLigue();
  const une = useMemo(() => {
    if (!lg) return null;
    const tous = [...lg.contrats, ...lg.faceAFace.flatMap((f) => [f.noirs, f.blancs])];
    return contratALaUne(tous, lg.d.avant, (n) => xp?.rangs.get(n)?.rang ?? null);
  }, [lg, xp]);
  if (!lg || !une) return null;

  const { e, place, sur, rangS } = une;
  const toi = e.joueur === lg.moi;
  const qui = prenom(id.nom(e.joueur));
  const tete = e.m.genre === "reste-en-tete";
  const cible = tete ? e.joueur : (e.m.cibles[0] ?? e.joueur);
  const autres = tete ? 0 : e.m.cibles.length - 1;
  const objectif = phrase(e.m, id.nom);
  const titre = toi ? "Tu signes un rang S" : `${qui} signe un rang S`;
  const serie = `S${lg.d.saison}·J${lg.d.j}·${String(e.m.xp).padStart(3, "0")}`;
  const micro = `sfl · contrat · rang s · ${NOM_DE_CODE[e.m.genre].toLowerCase()} · j${lg.d.j} · `;

  const partager = () => {
    preparerPiece({
      type: "ligue",
      titre: `${qui} signe un rang S`,
      j: lg.d.j,
      lignes: [
        { n: e.joueur, v: `${NOM_DE_CODE[e.m.genre]} · +${e.m.xp} XP` },
        { l: "Contrat", v: phrase(e.m, id.nom) },
        ...(place != null ? [{ l: "Pépite d'Or", v: `${rangTexte(place)} sur ${sur}` }] : []),
      ],
    });
    router.push("/vestiaire");
  };

  return (
    <section aria-labelledby="titre-contrat-une" className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-1.5 px-5 md:px-0">
        <div className="flex items-center justify-between gap-3">
          <span className="mono-label truncate text-encre-3">J{lg.d.j} · À la une</span>
          <Link
            href="/profil/xp?vue=autres"
            className="bouton-discret flex shrink-0 items-center gap-0.5 py-1.5 pr-1 pl-2.5 text-ligne font-semibold"
          >
            Tout voir · {lg.total}
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <h2 id="titre-contrat-une" className="titre-lettrage text-titre-l leading-[0.95] break-words">
          {titre}
        </h2>
      </div>

      <article
        aria-label={`Contrat ${NOM_DE_CODE[e.m.genre]}, rang S, signé par ${id.nom(e.joueur)}`}
        className={cn("fiche fiche--S fiche--une dark mx-4 md:mx-0", etatFiche(e, lg))}
      >
        <svg aria-hidden viewBox="-170 -170 340 340" className="une__rosace">
          <RosaceBola cx={0} cy={0} r1={74} r2={128} couleur="currentColor" epaisseur={0.6} />
        </svg>
        <span aria-hidden className="une__coins" />
        <div className="fiche__bandeau">
          <span className="fiche__etiquette">Rang S</span>
          <span className="fiche__type mono-label truncate text-white/75">{NOM_DE_CODE[e.m.genre]}</span>
        </div>

        <div className="flex flex-col gap-5 px-[18px] pt-5 pb-4">
          <div className="flex items-center gap-6">
            <div className="outsider__heros shrink-0">
              <Carte nom={e.joueur} size={FORMAT_CARTE.grande} onglet={onglet(lg, e.joueur)} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <dl className="flex flex-col gap-4">
                <Champ label="Signé par" grand>
                  {toi ? "Toi" : <Nom n={e.joueur} />}
                </Champ>
                {place != null && (
                  <Champ label="Pépite d'Or">
                    {rangTexte(place)} sur {sur}
                  </Champ>
                )}
                {rangS && (
                  <Champ label="XP à vie">
                    <span className="fiche__ton">Rang S</span>
                  </Champ>
                )}
              </dl>
              <div className="flex items-center gap-1">
                <BoutonSuivre nom={e.joueur} petit />
                <button
                  type="button"
                  aria-label="Partager au Vestiaire"
                  onClick={partager}
                  className="grid size-9 shrink-0 place-items-center rounded-full text-white/60 transition-transform active:scale-90"
                >
                  <MessageCircle className="size-[18px]" strokeWidth={1.8} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5 border-t border-white/10 pt-5">
            {!tete && (
              <div className="relative shrink-0">
                <div className={cn(etatViseur(e, lg) === "rate" && "fiche__carte--ratee")}>
                  <Carte nom={cible} size={FORMAT_CARTE.moyenne} onglet={onglet(lg, cible)} />
                </div>
                <Viseur etat={etatViseur(e, lg)} petit />
                {autres > 0 && <span className="affiche__plus mono-label">+{autres}</span>}
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <span className="mono-label fiche__ton">{tete ? "Défend la 1re place" : "La cible"}</span>
              <p className="titre-lettrage text-titre-m leading-[0.98] break-words">{objectif}</p>
              <Resultat e={e} lg={lg} />
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-white/10 pt-3">
            <span aria-hidden className="une__micro">
              {micro.repeat(4)}
            </span>
            <span className="mono-label shrink-0 text-white/45 tabular-nums">Nº {serie}</span>
          </div>
        </div>
      </article>
    </section>
  );
}
