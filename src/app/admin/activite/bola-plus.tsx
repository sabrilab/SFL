"use client";

// Analytics → 4. Revenu → Bola Plus : le compteur de la précommande (Sabri,
// 12/11/2026 ; lib/sfl/bola-plus.ts). Les joueurs qui ont touché « Je suis
// intéressé » sur leur page Bola Plus : combien, par formule (mensuel,
// annuel, sans formule), et la liste du plus récent au plus ancien, avec la
// date. Aucun paiement : c'est un intérêt, pas une vente.
//
// La source : la table bola_plus_interets, que l'admin seul lit en entier
// (RLS). Tout l'historique, tous les comptes : ni la période ni le public du
// haut de la page ne s'appliquent, comme pour le parrainage. Tant que la
// table n'est pas en base (un aperçu avant la mise en ligne), la section le
// dit sans alarmer ; dans un aperçu, l'essai fait sur ce téléphone s'ajoute
// à ce que la base rend (bola-plus-store.ts).

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { compter, NOM_FORMULE, type CompteInterets } from "@/lib/sfl/bola-plus";
import { BOLA_PLUS_EVENT, lireInteresses, type EchecLecture } from "@/lib/sfl/bola-plus-store";
import { Section } from "./cadre";

const MESSAGE: Record<EchecLecture, string> = {
  "sans-table": "Bola Plus arrive avec la prochaine mise en ligne.",
  autre: "Les intéressés n'ont pas pu être lus.",
};

/** « 12 nov. » */
const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

function Tuile({ label, valeur }: { label: string; valeur: number }) {
  return (
    <div className="glass-soft rounded-2xl px-3.5 py-3">
      <p className="mono-label text-micro text-encre-3">{label}</p>
      <p className="mt-1.5 text-titre-g leading-none font-extrabold tabular-nums">{valeur}</p>
    </div>
  );
}

export function BolaPlusStats() {
  const nom = useSession()?.name ?? null;
  const [lu, setLu] = useState<CompteInterets | EchecLecture | null>(null);

  useEffect(() => {
    let annule = false;
    const lire = () =>
      void lireInteresses(nom).then(({ lignes, echec }) => {
        if (!annule) setLu(echec ?? compter(lignes));
      });
    lire();
    // Mon propre toucher (un essai sur ce téléphone, ou le vrai) : le compteur suit.
    window.addEventListener(BOLA_PLUS_EVENT, lire);
    return () => {
      annule = true;
      window.removeEventListener(BOLA_PLUS_EVENT, lire);
    };
  }, [nom]);

  return (
    <Section id="bola-plus" titre="Bola Plus" sous="Les joueurs qui ont touché « Je suis intéressé ». Aucun paiement.">
      {lu === null ? (
        <p className="text-corps text-encre-3">Lecture…</p>
      ) : typeof lu === "string" ? (
        <p className="text-corps text-encre-3">{MESSAGE[lu]}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Tuile label="Intéressés" valeur={lu.total} />
            <Tuile label="Mensuel" valeur={lu.mensuel} />
            <Tuile label="Annuel" valeur={lu.annuel} />
          </div>
          {lu.sansFormule > 0 && <p className="mt-2.5 text-corps text-encre-3">{lu.sansFormule} sans formule</p>}
          {lu.total === 0 ? (
            <p className="mt-4 text-corps text-encre-3">Personne pour l&apos;instant.</p>
          ) : (
            <div className="mt-4 flex flex-col">
              {lu.lignes.map((l) => (
                <div key={`${l.nom}-${l.le}`} className="flex items-center gap-3 border-t border-foreground/8 py-2.5 first:border-t-0">
                  <span className="min-w-0 flex-1 truncate text-ligne font-semibold">{l.nom}</span>
                  <span className={l.formule ? "text-corps font-medium text-encre-2" : "text-corps text-encre-3"}>
                    {l.formule ? NOM_FORMULE[l.formule] : "Sans formule"}
                  </span>
                  <span className="w-[58px] shrink-0 text-right text-legende text-encre-3 tabular-nums">{jour(l.le)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Section>
  );
}
