"use client";

// La « une » — le journal du dimanche soir.
//
// Après la synthèse sur le terrain, la journée se lit comme la première page
// d'un quotidien : un bandeau de titre, une manchette tirée du fait le plus
// marquant, les cartes gagnées en guise de photos, puis le palmarès de tout le
// monde en colonnes serrées.
//
// Rien n'est inventé : la manchette se déduit des chiffres (le joueur le plus
// décisif, le score, le record éventuel). Deux lectures de la même journée
// donnent le même titre.

import { motion } from "motion/react";
import { BoostCard } from "@/components/sfl/boost-card";
import { Card3D } from "@/components/sfl/card-3d";
import type { BoostCardData } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

export interface UneLine {
  player: string;
  team: string | null;
  buts: number;
  passes: number;
  pp: number;
  mvp?: boolean;
  impact?: boolean;
  def?: boolean;
  result?: string | null;
}

const TITRES: Record<string, string> = {
  mvp: "MVP",
  impact: "Impact",
  def: "Défensive",
};

/** La manchette : le fait le plus marquant, formulé sans jamais l'inventer. */
function manchette(lines: UneLine[], totalButs: number, record: boolean) {
  const best = [...lines].sort((a, b) => b.buts * 2 + b.passes - (a.buts * 2 + a.passes))[0];
  if (!best) return { titre: "Dimanche blanc", chapeau: "Aucune feuille de match ce jour-là." };

  const nom = best.player.toUpperCase();
  if (record) {
    return {
      titre: `${totalButs} BUTS, ET UN RECORD`,
      chapeau: `Jamais un dimanche n'avait tant marqué. ${best.player} termine la journée avec ${best.buts} but${best.buts > 1 ? "s" : ""} et ${best.passes} passe${best.passes > 1 ? "s" : ""}.`,
    };
  }
  if (best.buts >= 5) {
    // « Personne n'a fait mieux » n'est écrit que si c'est vrai : le meilleur
    // au barème buts+passes n'est pas forcément le meilleur buteur.
    const meilleurButeur = Math.max(...lines.map((l) => l.buts));
    const seul = lines.filter((l) => l.buts === meilleurButeur).length === 1;
    return {
      titre: `${nom} EN FEU`,
      chapeau:
        best.buts === meilleurButeur && seul
          ? `${best.buts} buts dans la journée, et personne n'a fait mieux.`
          : `${best.buts} buts dans la journée, ${best.passes} passe${best.passes > 1 ? "s" : ""} en prime.`,
    };
  }
  if (best.passes > best.buts) {
    return {
      titre: `${nom} DISTRIBUE`,
      chapeau: `${best.passes} passe${best.passes > 1 ? "s" : ""} décisive${best.passes > 1 ? "s" : ""} : la journée est passée par lui avant d'aller au fond.`,
    };
  }
  return {
    titre: `${nom} FAIT LA LOI`,
    chapeau: `${best.buts} but${best.buts > 1 ? "s" : ""}, ${best.passes} passe${best.passes > 1 ? "s" : ""}, ${best.pp} points Pépite. La journée porte sa signature.`,
  };
}

function Filet({ epais = false }: { epais?: boolean }) {
  return (
    <span
      className="block w-full"
      style={{
        height: epais ? 3 : 1,
        background: epais
          ? "linear-gradient(90deg, rgba(255,255,255,0.55), rgba(255,255,255,0.18))"
          : "rgba(255,255,255,0.14)",
      }}
    />
  );
}

export function LaUne({
  journee,
  date,
  lines,
  boosts,
  totalButs,
  record,
}: {
  journee: number;
  date: string;
  lines: UneLine[];
  boosts: BoostCardData[];
  totalButs: number;
  record: boolean;
}) {
  if (lines.length === 0) return null;

  const { titre, chapeau } = manchette(lines, totalButs, record);
  const classees = [...lines].sort((a, b) => b.pp - a.pp);

  return (
    <section className="glass overflow-hidden rounded-3xl">
      {/* Le bandeau de titre */}
      <div className="px-5 pt-5 pb-3">
        <Filet epais />
        <div className="flex items-baseline justify-between gap-2 py-2.5">
          <span className="mono-label text-foreground/35">Édition du dimanche</span>
          <span className="mono-label text-foreground/35">{date}</span>
        </div>
        <h2
          className="text-center leading-[0.86] font-black tracking-[-0.02em] uppercase"
          style={{ fontFamily: "var(--font-anton)", fontSize: 40 }}
        >
          La Gazette
        </h2>
        <p className="mono-label mt-1.5 text-center text-foreground/40">
          Sunday Five League · Journée {journee}
        </p>
        <div className="mt-2.5">
          <Filet epais />
        </div>
      </div>

      {/* La manchette */}
      <div className="px-5 pb-4">
        <h3
          className="leading-[0.94] font-black tracking-[-0.015em] uppercase"
          style={{ fontFamily: "var(--font-anton)", fontSize: 30 }}
        >
          {titre}
        </h3>
        <p className="mt-2 text-[13.5px] leading-[1.5] text-foreground/55">{chapeau}</p>
      </div>

      {/* Les cartes gagnées — les « photos » de la une */}
      {boosts.length > 0 && (
        <>
          <div className="px-5">
            <Filet />
            <p className="mono-label py-2.5 text-primary">
              Les cartes de la journée · {boosts.length}
            </p>
          </div>
          <div className="-mx-0 flex gap-4 overflow-x-auto px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {boosts.map((c, i) => (
              <motion.figure
                key={`${c.type}-${c.player}`}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="flex shrink-0 flex-col items-center gap-2"
              >
                <Card3D
                  cacheKey={`une-${journee}-${c.type}-${c.player}`}
                  mode="rare"
                  size={0.52}
                  render={(s) => <BoostCard card={c} size={s} />}
                />
                <figcaption className="max-w-[130px] text-center">
                  <span className="mono-label block text-primary">{TITRES[c.type] ?? c.type}</span>
                  <span className="mt-0.5 block truncate text-[12.5px] font-bold">{c.player}</span>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </>
      )}

      {/* Le palmarès — tout le monde, en colonnes de journal */}
      <div className="px-5 pb-5">
        <Filet />
        <p className="mono-label py-2.5 text-foreground/35">
          Le dimanche de tout le monde · {classees.length} joueurs
        </p>
        <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
          {classees.map((l, i) => (
            <div
              key={l.player}
              className={cn(
                "flex items-baseline gap-2 border-b border-white/6 py-[7px] text-[12.5px]",
                i === 0 && "border-b-white/14"
              )}
            >
              <span
                className={cn(
                  "w-[18px] shrink-0 text-right tabular-nums",
                  i === 0 ? "font-bold text-primary" : "text-foreground/25"
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {l.player}
                {(l.mvp || l.impact || l.def) && (
                  <span className="mono-label ml-1.5 text-[8px] text-primary">
                    {l.mvp ? "MVP" : l.impact ? "IMP" : "DÉF"}
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-foreground/40">
                {l.buts}·{l.passes}
              </span>
              <span className="w-[26px] shrink-0 text-right font-bold tabular-nums">{l.pp}</span>
            </div>
          ))}
        </div>
        <p className="mono-label mt-3 text-center text-foreground/25">
          Buts · Passes · Points Pépite — Respect, passion, solidarité
        </p>
      </div>
    </section>
  );
}
