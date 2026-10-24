"use client";

// Admin → Joueurs → Arbitres (Sabri, 24/10). Deux gestes :
//   · faire d'un compte un arbitre (ou le rendre joueur) : il quitte alors
//     toutes les listes de joueurs et voit sa carte d'arbitre ;
//   · désigner l'arbitre de chaque match d'une journée. Les deux équipes du
//     match sont recopiées avec lui : la base s'en sert pour savoir qui peut
//     le noter. Si les équipes d'un match changent, redésigner son arbitre.
// Tout s'écrit en base hors du document de la saison (lib/sfl/arbitres) :
// rien à publier, et une publication n'efface rien.

import { useState } from "react";
import { RechercheJoueur } from "@/components/sfl/admin/recherche-joueur";
import { useSeason } from "@/components/sfl/season-provider";
import { useArbitres } from "@/hooks/use-arbitres";
import { useIdentites } from "@/hooks/use-identites";
import { designerArbitre, poserArbitre } from "@/lib/sfl/arbitres";
import { heuresDeJournee } from "@/lib/sfl/missions";

export function ArbitresAdmin() {
  const { allPlayers, journees, saison } = useSeason();
  const arbitres = useArbitres();
  const identite = useIdentites();
  const [recherche, setRecherche] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const numero = saison.numero ?? 0;

  const q = recherche.trim().toLowerCase();
  const candidats = q
    ? allPlayers
        .filter((p) => !arbitres.estArbitre(p.name))
        .filter((p) => p.name.toLowerCase().includes(q) || identite.nom(p.name).toLowerCase().includes(q))
        .slice(0, 6)
    : [];
  // Les journées qui ont leurs équipes, la plus récente d'abord.
  const avecMatchs = [...journees].filter((jr) => (jr.matches?.length ?? 0) > 0).sort((a, b) => b.j - a.j);

  const faire = async (nom: string, arbitre: boolean) => {
    setMessage(null);
    const e = await poserArbitre(nom, arbitre);
    if (e) setMessage(e);
    else setRecherche("");
  };

  return (
    <section className="overflow-hidden rounded-3xl bg-card">
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-[15px] font-bold tracking-tight">Arbitres</h3>
      </div>

      <div className="flex flex-col gap-2 px-4 pb-3">
        {arbitres.arbitres.length === 0 && <p className="px-1 text-[13px] text-muted-foreground">Aucun arbitre.</p>}
        {arbitres.arbitres.map((nom) => {
          const s = arbitres.stats(nom);
          return (
            <div key={nom} className="flex items-center gap-3 rounded-2xl bg-secondary/40 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{identite.nom(nom)}</span>
                <span className="block text-[11px] text-muted-foreground tabular-nums">
                  {s.matchs} match{s.matchs > 1 ? "s" : ""} · satisfaction {s.satisfaction ?? "–"}
                </span>
              </span>
              <button type="button" onClick={() => faire(nom, false)} className="bouton-secondaire shrink-0 px-3 py-1.5 text-[12px] font-semibold">
                Rendre joueur
              </button>
            </div>
          );
        })}
        <RechercheJoueur
          valeur={recherche}
          onChange={setRecherche}
          resultats={candidats.length}
          placeholder="Faire arbitre…"
          onEntree={() => candidats[0] && faire(candidats[0].name, true)}
        />
        {candidats.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => faire(p.name, true)}
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left active:bg-secondary"
          >
            <span className="truncate text-[14px] font-medium">{identite.nom(p.name)}</span>
            <span className="shrink-0 text-[12px] font-semibold text-muted-foreground">Faire arbitre</span>
          </button>
        ))}
        {message && <p className="px-1 text-[12px] text-muted-foreground">{message}</p>}
      </div>

      {arbitres.arbitres.length > 0 && avecMatchs.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border/60 px-4 py-4">
          {avecMatchs.map((jr) => (
            <div key={jr.j} className="flex flex-col gap-1.5">
              <span className="px-1 text-[13px] font-bold">
                Journée {jr.j} <span className="font-normal text-muted-foreground">· {jr.date}</span>
              </span>
              {jr.matches!.map((m, n) => {
                const equipes = [m.teamA.name, m.teamB.name];
                const actuel = arbitres.duMatch(jr.j, n);
                return (
                  <label key={m.id} className="flex items-center gap-3 rounded-2xl bg-secondary/40 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold">Match {n + 1}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {equipes.join(" – ")}
                      </span>
                    </span>
                    <select
                      value={actuel?.arbitre ?? ""}
                      aria-label={`Arbitre du match ${n + 1}, journée ${jr.j}`}
                      onChange={async (e) => {
                        setMessage(null);
                        // Les notes des joueurs ferment le mardi à minuit qui suit le match (missions-arbitre.ts).
                        const fermeLe = heuresDeJournee(saison, jr.j, new Date())?.finDesNotes ?? null;
                        const err = await designerArbitre(numero, jr.j, n, equipes, e.target.value || null, fermeLe);
                        if (err) setMessage(err);
                      }}
                      className="h-9 max-w-[45%] shrink-0 rounded-full bg-background px-3 text-[13px] font-medium"
                    >
                      <option value="">Pas d&apos;arbitre</option>
                      {arbitres.arbitres.map((nom) => (
                        <option key={nom} value={nom}>
                          {identite.nom(nom)}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
