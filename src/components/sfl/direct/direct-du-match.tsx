"use client";

// La feuille en direct d'un match, sous son terrain (la page du lieu, Map) :
//   · personne ne la tient encore, et c'est MON match, aujourd'hui, d'une
//     journée publiée : « Prendre la feuille » — le premier qui touche la
//     tient (la base départage deux téléphones) ;
//   · quelqu'un la tient : le score et la minute en direct, « Feuille ·
//     Ilyes », et la feuille s'ouvre en lecture pour toute la ligue ; la
//     mienne s'ouvre pour compter ;
//   · scellée : le score final, et la feuille en lecture ; pour un joueur
//     du match, « Voter » tant que le vote du jour est ouvert (jusqu'à la fin
//     du vote, revelation.ts : il s'ouvre dès que la feuille du match est
//     remplie, votes.ts).
// Rien pour un match qui n'a pas de feuille et que je ne joue pas.

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useSeason } from "@/components/sfl/season-provider";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useFeuillesDirect, type FeuillesDirect } from "@/hooks/use-feuilles-direct";
import { droitDePrendre, etatDeLaFeuille, joueursDuMatch, MOTS_DU_REFUS, peutPrendre, scoreDeLaFeuille, type Equipes } from "@/lib/sfl/feuille-direct";
import { voteOuvertA } from "@/lib/sfl/revelation";
import { journeeAvecVote } from "@/lib/sfl/votes";
import { haptique } from "@/lib/sfl/haptique";
import { cn } from "@/lib/utils";
import { FeuilleDuMatch, PastilleDirect, TableauDAffichage } from "./feuille-du-match";

export function DirectDuMatch({
  j,
  equipes,
  label,
  direct: deLaPage,
}: {
  j: number;
  equipes: Equipes;
  label: string;
  /** Les feuilles de la journée, quand la page les suit déjà (un seul abonnement). */
  direct?: FeuillesDirect;
}) {
  const { saisonLue, journeesDirect: journees } = useSeason();
  const { me } = useMyPlayer();
  const lues = useFeuillesDirect(deLaPage ? null : j);
  const direct = deLaPage ?? lues;
  const [ouverte, setOuverte] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const feuille = direct.feuilleDe(equipes);
  const etat = etatDeLaFeuille(feuille, direct.monId);
  const droit = droitDePrendre(saisonLue, j, equipes, me, new Date());
  // Libre et à moi de la prendre (une feuille rouverte puis libérée aussi) ;
  // une feuille libérée se suit encore en lecture par toute la ligue.
  const prenable = peutPrendre(feuille, droit);

  if (!direct.pret) return null;

  const sheet = <FeuilleDuMatch open={ouverte} onOpenChange={setOuverte} saison={saisonLue} j={j} equipes={equipes} label={label} direct={direct} />;

  if (prenable) {
    return (
      <>
        <button
          type="button"
          disabled={envoi}
          onClick={async () => {
            setEnvoi(true);
            const r = await direct.prendre(equipes);
            setEnvoi(false);
            if (r.ok) {
              haptique.sceau();
              setOuverte(true);
              return;
            }
            haptique.refus();
            toast(r.refus === "tenue" && r.feuille?.preneur_nom ? `Feuille · ${r.feuille.preneur_nom}` : MOTS_DU_REFUS[r.refus]);
          }}
          className="bouton-principal h-14 w-full text-lecture font-semibold disabled:opacity-60"
        >
          Prendre la feuille
        </button>
        {sheet}
      </>
    );
  }

  if (!feuille) return null;
  const score = scoreDeLaFeuille(saisonLue, j, equipes, feuille.compteurs);
  // Le vote du soir, pour qui a joué ce match.
  const jn = journees.find((x) => x.j === j);
  const { noirs, blancs } = joueursDuMatch(saisonLue, j, equipes);
  const voter = etat === "scellee" && !!jn && journeeAvecVote(jn) && voteOuvertA(saisonLue, j, new Date()) && [...noirs, ...blancs].includes(me);
  return (
    <>
      <div className="glass flex flex-col gap-3 rounded-[22px] px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <PastilleDirect feuille={feuille} />
          <span className="mono-label text-encre-3">{label}</span>
        </div>
        <TableauDAffichage score={score} grand={false} />
        <div className="flex items-center justify-between gap-2">
          <span className="mono-label min-w-0 truncate text-encre-3">Feuille · {feuille.preneur_nom ?? "libre"}</span>
          <span className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                haptique.choix();
                setOuverte(true);
              }}
              className={cn("h-10 shrink-0 px-4 text-ligne font-semibold", etat === "mienne" ? "bouton-principal" : "bouton-secondaire")}
            >
              {etat === "mienne" ? "Ma feuille" : etat === "scellee" ? "Voir" : "Suivre"}
            </button>
            {voter && (
              <Link href="/ligue" onClick={() => haptique.choix()} className="bouton-principal flex h-10 shrink-0 items-center px-4 text-ligne font-semibold">
                Voter
              </Link>
            )}
          </span>
        </div>
      </div>
      {sheet}
    </>
  );
}
