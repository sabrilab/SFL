"use client";

// Le détail des points d'un joueur, journée par journée.
//
// Quand quelqu'un dit « je devrais avoir 77 points, pas 68 », il n'existait
// aucun moyen de savoir d'où venait l'écart : le classement donnait un
// total, et rien ne le décomposait. Il fallait relire le classeur ligne à
// ligne. Cet écran répond à la question en dix secondes.
//
// Il montre surtout ce qui manque : une journée où le joueur n'a AUCUNE
// ligne apparaît en clair, avec « aucune ligne ». C'est là que se cachent
// presque toujours les points disparus — pas dans le barème.

import { useMemo, useState } from "react";
import { Search, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { entryPP } from "@/lib/sfl/saisie/engine";
import type { MatchEntry, Saison } from "@/lib/sfl/saisie/types";

/** Le détail lisible d'une ligne : « présence 1, victoire 2, buts 3 ». */
function decomposer(e: MatchEntry): string {
  if (e.extraTime) return `Xtratime · bonus ${e.pepiteBonus ?? 0}`;
  const bouts: string[] = [];
  if (e.statut !== "Présent") {
    bouts.push(e.statut);
    if (e.statut === "Absence injustifiée") bouts.push("−2");
    if (e.pepiteBonus) bouts.push(`bonus ${e.pepiteBonus}`);
    return bouts.join(" · ");
  }
  bouts.push("présence 1");
  if (e.result === "Victoire") bouts.push(e.sflTime ? "victoire SFL 3" : "victoire 2");
  else if (e.result === "Nul") bouts.push("nul 1");
  else if (e.result === "Défaite") bouts.push("défaite 0");
  else bouts.push("résultat manquant");
  if (e.buts) bouts.push(`buts ${e.buts}`);
  if (e.passes) bouts.push(`passes ${e.passes}`);
  if (e.cleanSheet) bouts.push("clean sheet 3");
  if (e.mvp) bouts.push("MVP 2");
  if (e.impact) bouts.push("impact 1");
  if (e.def) bouts.push("défensif 1");
  if (e.retard) bouts.push("retard −1");
  const arr = Math.floor((e.arrets ?? 0) / 2);
  const int = Math.floor((e.interceptions ?? 0) / 2);
  if (arr) bouts.push(`arrêts +${arr}`);
  if (int) bouts.push(`interceptions +${int}`);
  if (e.pepiteBonus) bouts.push(`bonus ${e.pepiteBonus}`);
  return bouts.join(" · ");
}

export function DetailPoints({ saison }: { saison: Saison }) {
  const [recherche, setRecherche] = useState("");
  const [joueur, setJoueur] = useState<string | null>(null);

  const noms = useMemo(
    () =>
      saison.roster
        .map((r) => r.name)
        .filter((n) => n.toLowerCase().includes(recherche.trim().toLowerCase()))
        .slice(0, 8),
    [saison.roster, recherche]
  );

  const detail = useMemo(() => {
    if (!joueur) return null;
    const lignes = saison.entries.filter((e) => e.player === joueur);
    const journees = [...saison.journees].sort((a, b) => a.j - b.j);
    const rangs = journees.map((meta) => {
      const desJ = lignes.filter((e) => e.j === meta.j);
      return {
        j: meta.j,
        date: meta.date,
        lignes: desJ.map((e) => ({ pp: e.extraTime ? (e.pepiteBonus ?? 0) : entryPP(e), texte: decomposer(e) })),
      };
    });
    const total = rangs.reduce((s, r) => s + r.lignes.reduce((t, l) => t + l.pp, 0), 0);
    const absentes = rangs.filter((r) => r.lignes.length === 0).map((r) => r.j);
    return { rangs, total, absentes };
  }, [joueur, saison]);

  return (
    <div className="glass rounded-3xl p-4">
      <h2 className="text-[16px] font-bold tracking-tight">D&apos;où viennent les points</h2>
      <p className="mt-1 text-[12.5px] leading-snug text-foreground/45">
        Le total d&apos;un joueur, décomposé journée par journée. Une journée sans ligne est
        signalée : c&apos;est presque toujours là que se cachent les points manquants.
      </p>

      <label className="glass-soft mt-3 flex items-center gap-2 rounded-full px-3.5 py-2.5">
        <Search className="size-4 shrink-0 text-foreground/35" />
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Un joueur…"
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-foreground/30"
        />
      </label>

      {recherche.trim() !== "" && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {noms.map((n) => (
            <button
              key={n}
              onClick={() => {
                setJoueur(n);
                setRecherche("");
              }}
              className="glass-soft rounded-full px-3 py-1.5 text-[13px] font-semibold text-foreground/70"
            >
              {n}
            </button>
          ))}
          {noms.length === 0 && (
            <p className="px-1 text-[13px] text-foreground/35">Aucun joueur de ce nom.</p>
          )}
        </div>
      )}

      {detail && joueur && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-2.5">
            <span className="text-[15px] font-bold tracking-tight">{joueur}</span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[22px] font-extrabold tabular-nums">{detail.total}</span>
              <span className="mono-label text-foreground/35">PP</span>
            </span>
          </div>

          {detail.absentes.length > 0 && (
            <p className="mt-2.5 flex items-start gap-1.5 rounded-2xl bg-amber-500/10 px-3 py-2 text-[12.5px] leading-snug text-amber-300">
              <AlertCircle className="mt-[2px] size-3.5 shrink-0" />
              <span>
                Aucune ligne en {detail.absentes.map((j) => `J${j}`).join(", ")}.{" "}
                {detail.absentes.length > 1
                  ? "S'il a joué ces journées, ses points"
                  : "S'il a joué cette journée, ses points"}{" "}
                de présence, de résultat, de buts et de passes manquent au classement.
              </span>
            </p>
          )}

          <div className="mt-2.5 flex flex-col">
            {detail.rangs.map((r) => {
              const ppJ = r.lignes.reduce((t, l) => t + l.pp, 0);
              const vide = r.lignes.length === 0;
              return (
                <div
                  key={r.j}
                  className={cn(
                    "flex gap-3 border-b border-white/6 py-2.5 last:border-0",
                    vide && "opacity-45"
                  )}
                >
                  <span className="mono-label w-14 shrink-0 pt-0.5 text-foreground/40">
                    J{r.j}
                  </span>
                  <span className="min-w-0 flex-1">
                    {vide ? (
                      <span className="text-[13px] text-amber-300/80">aucune ligne</span>
                    ) : (
                      r.lignes.map((l, i) => (
                        <span key={i} className="block text-[12.5px] leading-snug text-foreground/60">
                          {l.texte}
                        </span>
                      ))
                    )}
                    <span className="mono-label mt-0.5 block text-foreground/25">{r.date}</span>
                  </span>
                  <span
                    className={cn(
                      "w-9 shrink-0 text-right text-[15px] font-bold tabular-nums",
                      vide && "text-foreground/25"
                    )}
                  >
                    {vide ? "—" : ppJ}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
