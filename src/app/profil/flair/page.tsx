"use client";

// Mon Flair en grand, enfant de Ma carte (ma-carte/rubriques.tsx ; Sabri,
// 30/10 : « on va pouvoir y accéder dans les cartes qui sont disponibles,
// comme ma saison, niveau XP, évolution »). En tête, ce que le Flair m'a
// rapporté cette saison ; la journée en cours, toute entière (Sabri, 31/10 :
// le blessé qui vient voir le match, la tribune : « même s'il ne peut plus
// jouer, il peut quand même participer ») : chaque match et la journée, comme
// sur les feuilles de match (matchs/flair.tsx) ; les meilleurs flairs de la
// saison et ma place ; puis chaque journée où j'ai choisi, saison par saison
// (flair/mon-flair.tsx) ; enfin mes choix de saison, s'il y en a.

import { ANTON } from "@/components/sfl/actus/ecran";
import { FicheFlair, VerdictFlair } from "@/components/sfl/flair/mon-flair";
import { PageRubrique } from "@/components/sfl/ma-carte/rubriques";
import { FlairDeLaJournee } from "@/components/sfl/matchs/flair";
import { cn } from "@/lib/utils";
import { useIdentites } from "@/hooks/use-identites";
import { useMonFlair } from "@/hooks/use-pronos";
import "@/components/sfl/matchs/flair.css";

const NOMBRE = { fontFamily: ANTON, lineHeight: 0.9 } as const;

export default function PageFlair() {
  const mon = useMonFlair();
  const identite = useIdentites();
  if (!mon) return <PageRubrique titre="Le Flair">{null}</PageRubrique>;
  const { journees, saison, xpSaison, enCours, classement, rang } = mon;
  const numero = journees[0]?.saison;
  const cetteSaison = journees.filter((f) => f.saison === numero);
  const justes = cetteSaison.reduce((a, f) => a + f.justes, 0);
  const juges = cetteSaison.reduce((a, f) => a + f.juges, 0);
  // La journée en cours, de l'ouverture à la révélation : on choisit, puis on suit le verdict.
  const ouverte = enCours && enCours.phase !== "fini" ? enCours : null;
  const tete = classement.slice(0, 5);
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

      {ouverte && <FlairDeLaJournee mp={ouverte} />}

      {tete.length > 0 && (
        <section className="flair flex flex-col gap-3.5 p-4" aria-labelledby="flair-meilleurs">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="flair-meilleurs" className="titre-lettrage text-titre-m leading-[0.95]">
              Les meilleurs flairs
            </h3>
            {rang && <span className="mono-label text-white/55">Toi · {rang === 1 ? "1er" : `${rang}e`}</span>}
          </div>
          <ol className="flair__bloc flex flex-col gap-2.5">
            {[...tete, ...(rang && rang > tete.length ? [classement[rang - 1]] : [])].map((r) => {
              const place = classement.indexOf(r) + 1;
              return (
                <li key={r.joueur} className={cn("flex items-center gap-3", r.joueur === enCours?.joueur && "font-bold")}>
                  <span style={{ ...NOMBRE, fontSize: 22 }} className="w-7 shrink-0 tabular-nums text-white/60">
                    {place}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-lecture">{identite.nom(r.joueur)}</span>
                  <span className="font-mono text-legende text-white/55 tabular-nums">
                    {r.justes}/{r.juges}
                  </span>
                  <span className="w-16 shrink-0 text-right font-mono text-legende text-[#9fe0a8] tabular-nums">+{r.xp} XP</span>
                </li>
              );
            })}
          </ol>
        </section>
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
