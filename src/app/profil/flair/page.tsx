"use client";

// Mon Flair en grand, enfant de Ma carte (ma-carte/rubriques.tsx ; Sabri,
// 30/10 : « on va pouvoir y accéder dans les cartes qui sont disponibles,
// comme ma saison, niveau XP, évolution »). En tête, ce que le Flair m'a
// rapporté cette saison ; la journée en cours, si elle est ouverte, avec le
// chemin vers sa feuille de match (on choisit là, matchs/flair.tsx) ; puis
// chaque journée où j'ai choisi, saison par saison (flair/mon-flair.tsx) ;
// enfin mes choix de saison, s'il y en a.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { FicheFlair, VerdictFlair } from "@/components/sfl/flair/mon-flair";
import { PageRubrique } from "@/components/sfl/ma-carte/rubriques";
import { FermeDans } from "@/components/sfl/matchs/flair";
import { useIdentites } from "@/hooks/use-identites";
import { useMonFlair } from "@/hooks/use-pronos";
import "@/components/sfl/matchs/flair.css";

const NOMBRE = { fontFamily: ANTON, lineHeight: 0.9 } as const;

export default function PageFlair() {
  const mon = useMonFlair();
  const identite = useIdentites();
  if (!mon) return <PageRubrique titre="Le Flair">{null}</PageRubrique>;
  const { journees, saison, xpSaison, enCours } = mon;
  const numero = journees[0]?.saison;
  const cetteSaison = journees.filter((f) => f.saison === numero);
  const justes = cetteSaison.reduce((a, f) => a + f.justes, 0);
  const juges = cetteSaison.reduce((a, f) => a + f.juges, 0);
  const ouverte = enCours?.phase === "ouvert" ? enCours : null;
  const posesOuverte = ouverte ? [...ouverte.sujets.values()].filter((v) => v.choix).length : 0;
  const saisons = [...new Set(journees.map((f) => f.saison))];
  return (
    <PageRubrique titre="Le Flair">
      {journees.length > 0 && (
        <div className="flex items-end gap-6 px-1">
          <span className="flex flex-col gap-1.5">
            <span style={{ ...NOMBRE, fontSize: 46 }} className="tabular-nums">
              +{xpSaison}
            </span>
            <span className="mono-label text-micro text-encre-3">XP cette saison</span>
          </span>
          {juges > 0 && (
            <span className="flex flex-col gap-1.5">
              <span style={{ ...NOMBRE, fontSize: 46 }} className="tabular-nums">
                {justes}
                <span className="text-encre-4">/{juges}</span>
              </span>
              <span className="mono-label text-micro text-encre-3">Vu juste</span>
            </span>
          )}
          <span className="ml-auto flex flex-col items-end gap-1.5">
            <span style={{ ...NOMBRE, fontSize: 46 }} className="tabular-nums">
              {cetteSaison.length}
            </span>
            <span className="mono-label text-micro text-encre-3">{cetteSaison.length > 1 ? "Journées" : "Journée"}</span>
          </span>
        </div>
      )}

      {ouverte && (
        <Link href="/" className="flair flex items-center gap-3 p-4 transition-transform active:scale-[0.98]">
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="titre-lettrage text-titre-m leading-[0.95]">J{ouverte.p.j} ouverte</span>
            <FermeDans fin={ouverte.p.coupEnvoi} />
          </span>
          <span className="flex shrink-0 items-center gap-1 text-ligne font-semibold">
            {posesOuverte > 0 ? `${posesOuverte} choix · Feuille de match` : "Feuille de match"}
            <ChevronRight className="size-4" />
          </span>
        </Link>
      )}

      {saisons.map((n) => (
        <section key={n} className="flex flex-col gap-3">
          {saisons.length > 1 && <h2 className="mono-label px-1 text-encre-3">Saison {n}</h2>}
          {journees
            .filter((f) => f.saison === n && !(ouverte && f.j === ouverte.p.j && f.saison === ouverte.p.saison))
            .map((f) => (
              <FicheFlair key={`${f.saison}-${f.j}`} f={f} titre={`Journée ${f.j}`} />
            ))}
        </section>
      ))}

      {saison.length > 0 && (
        <section className="flair flex flex-col gap-3.5 p-4">
          <h3 className="titre-lettrage text-titre-m leading-[0.95]">La saison</h3>
          <div className="flair__bloc flex flex-col gap-3">
            {saison.map((c) => (
              <div key={`${c.numero}-${c.sujet}`} className="flex items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="mono-label text-white/55">
                    {c.titre} · Saison {c.numero}
                  </span>
                  <span className="truncate text-titre leading-tight font-bold">{identite.nom(c.choix)}</span>
                </span>
                <span className="shrink-0 text-right">
                  {c.etat === "attente" ? (
                    <span className="mono-label text-white/50">+{c.prime} XP · à la clôture</span>
                  ) : (
                    <VerdictFlair etat={c.etat} xp={c.prime} />
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {journees.length === 0 && !ouverte && saison.length === 0 && (
        <p className="px-1 text-lecture text-encre-3">Aucun choix pour l&apos;instant.</p>
      )}
    </PageRubrique>
  );
}
