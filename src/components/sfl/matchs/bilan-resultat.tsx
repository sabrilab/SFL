"use client";

// Où en est la confirmation du résultat d'un match Bola (28/10/2026,
// lib/sfl/confirmation-resultat.ts), sous son score : dans la fiche du
// match, dans Bola (mes derniers matchs) et dans la feuille de
// l'organisateur.
//   · tout le monde : l'état en mono (« En attente · 3/4 », les
//     confirmations vers le seuil ; « Contesté », « Validé », « Non
//     validé ») et, à droite, la suite : « validé demain à 0h46 » si
//     personne n'a infirmé, sinon l'heure limite ; l'organisateur lit « à
//     corriger avant… » tant que sa fenêtre de correction est ouverte
//     (issueResultat) ;
//   · un joueur de la feuille qui n'a pas répondu : « Voir le résultat »,
//     qui ouvre l'écran (resultat-a-confirmer.tsx) ; une fois répondu, son
//     sceau ;
//   · l'organisateur : chaque joueur, ✓, ✕ ou ·, et le motif sous un ✕, en
//     direct (match_confirmations, realtime).
// Rien pour un match saisi avant le 28/10 : il compte tel quel.

import { useEffect, useState } from "react";
import { ouvrirResultat } from "@/components/sfl/invitation-carte";
import { Nom } from "@/components/sfl/nom";
import { ReponseScellee } from "@/components/sfl/reponse-scellee";
import {
  issueResultat,
  libelleEtat,
  reponseOuverte,
  type BilanFeuille,
  type ReponseDuJoueur,
} from "@/lib/sfl/confirmation-resultat";
import { bilansFeuilles, reponsesDuMatch } from "@/lib/sfl/matchs";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export type Bilan = BilanFeuille & { reponses?: ReponseDuJoueur[] | null };

/** Le bilan d'un match, relu à chaque réponse. `demo` : un bilan donné, rien n'est lu. */
export function useBilan(
  matchId: number,
  organise: boolean,
  demo?: Bilan | null,
): Bilan | null {
  const [lu, setLu] = useState<Bilan | null>(null);
  useEffect(() => {
    if (demo !== undefined || matchId <= 0) return;
    let fini = false;
    const lire = async () => {
      const b = organise
        ? await reponsesDuMatch(matchId)
        : ((await bilansFeuilles([matchId])).get(matchId) ?? null);
      if (!fini) setLu(b as Bilan | null);
    };
    void lire();
    const sb = supabase();
    let canal: ReturnType<typeof sb.channel> | null = null;
    try {
      canal = sb
        .channel(
          `resultat-${matchId}-${Math.random().toString(36).slice(2, 8)}`,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "match_confirmations",
            filter: `match_id=eq.${matchId}`,
          },
          () => void lire(),
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "matchs",
            filter: `id=eq.${matchId}`,
          },
          () => void lire(),
        )
        .subscribe();
    } catch {}
    const voir = () => document.visibilityState === "visible" && void lire();
    document.addEventListener("visibilitychange", voir);
    return () => {
      fini = true;
      document.removeEventListener("visibilitychange", voir);
      if (canal) sb.removeChannel(canal);
    };
  }, [matchId, organise, demo]);
  return demo !== undefined ? demo : lu;
}

export function BilanResultat({
  matchId,
  organise = false,
  demo,
  className,
}: {
  matchId: number;
  /** L'organisateur voit chaque réponse. */
  organise?: boolean;
  demo?: Bilan | null;
  className?: string;
}) {
  const b = useBilan(matchId, organise, demo);
  if (!b || !b.requise || !b.etat) return null;
  const ouverte = reponseOuverte(b);
  const suite = issueResultat(b, organise);
  const aRepondre = b.destinataire && !b.mienne && ouverte;
  const reponses = organise ? (b.reponses ?? []) : [];
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={cn(
            "mono-label",
            b.etat === "compte" ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {libelleEtat(b.etat, b.c, b.n)}
        </span>
        {suite && (
          <span className="mono-label text-right text-muted-foreground">
            {suite}
          </span>
        )}
      </div>
      {aRepondre && (
        <button
          type="button"
          onClick={() => ouvrirResultat(matchId)}
          className="bouton-principal flex h-12 items-center justify-center text-[15px] font-semibold"
        >
          Voir le résultat
        </button>
      )}
      {b.mienne && (
        <ReponseScellee
          mine={b.mienne === "confirme" ? "present" : "absent"}
          scelles={{ present: "Confirmé", absent: "Infirmé" }}
          taille="sm"
          onRepondre={async () => "figee"}
        />
      )}
      {reponses.length > 0 && (
        <ul className="flex flex-col">
          {reponses.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-0.5 border-t border-contraste/[0.06] py-2 first:border-t-0"
            >
              <span className="flex items-center gap-3">
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[14.5px] font-semibold",
                    !r.reponse && "text-muted-foreground",
                  )}
                >
                  <Nom n={r.name} />
                </span>
                <span
                  aria-label={
                    r.reponse === "confirme"
                      ? "Confirmé"
                      : r.reponse === "infirme"
                        ? "Infirmé"
                        : "Sans réponse"
                  }
                  className={cn(
                    "w-5 text-center font-mono text-[15px] font-bold",
                    !r.reponse && "text-muted-foreground",
                  )}
                >
                  {r.reponse === "confirme"
                    ? "✓"
                    : r.reponse === "infirme"
                      ? "✕"
                      : "·"}
                </span>
              </span>
              {r.reponse === "infirme" && r.motif && (
                <span className="text-[13px] leading-snug text-muted-foreground">
                  « {r.motif} »
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
