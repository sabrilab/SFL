"use client";

// La synthèse sur le terrain — le module de tête du récap.
//
// Le demi-terrain (concept de l'équipe type) devient le support unique d'une
// synthèse de la journée à plusieurs modes : équipe type, buteurs, passeurs,
// titres. On change de mode par les onglets mono ; les joueurs sont posés sur
// la pelouse selon leur poste, la pastille sous chaque nom change de sens
// selon l'onglet. En pied, les trois chiffres de la journée.

import { useState } from "react";
import { ovr, type Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

export interface PitchLine {
  name: string;
  buts: number;
  passes: number;
  mvp?: boolean;
  impact?: boolean;
  def?: boolean;
}

type Mode = "type" | "buts" | "passes" | "titres";

const MODES: [Mode, string][] = [
  ["type", "Équipe type"],
  ["buts", "Buteurs"],
  ["passes", "Passeurs"],
  ["titres", "Titres"],
];

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-full bg-secondary text-[12px] font-bold ring-2 ring-background"
      style={{ width: size, height: size }}
    >
      {name[0]}
    </span>
  );
}

/** Rang vertical sur le demi-terrain, selon le poste. */
function pitchRow(poste: string) {
  const p = poste.toUpperCase();
  if (p.startsWith("G")) return 2;
  if (/^(DC|DD|DG|DEF|MDC)/.test(p)) return 1;
  return 0; // attaque et milieux offensifs devant
}

export function PitchSynthese({
  journee,
  lines,
  byName,
  totalButs,
  matchesCount,
  participants,
}: {
  journee: number;
  lines: PitchLine[];
  byName: Map<string, Player>;
  totalButs: number;
  matchesCount: number;
  participants: number;
}) {
  const [mode, setMode] = useState<Mode>("type");

  // Sélection des joueurs à poser sur la pelouse, selon le mode.
  const picked: { name: string; badge: string; hot?: boolean }[] = (() => {
    switch (mode) {
      case "buts":
        return [...lines]
          .filter((l) => l.buts > 0)
          .sort((a, b) => b.buts - a.buts)
          .slice(0, 5)
          .map((l, i) => ({ name: l.name, badge: `${l.buts} B`, hot: i === 0 }));
      case "passes":
        return [...lines]
          .filter((l) => l.passes > 0)
          .sort((a, b) => b.passes - a.passes)
          .slice(0, 5)
          .map((l, i) => ({ name: l.name, badge: `${l.passes} P`, hot: i === 0 }));
      case "titres":
        return lines
          .filter((l) => l.mvp || l.impact || l.def)
          .slice(0, 5)
          .map((l) => ({
            name: l.name,
            badge: l.mvp ? "MVP" : l.impact ? "IMPACT" : "DÉF",
            hot: !!l.mvp,
          }));
      default:
        return [...lines]
          .sort((a, b) => b.buts * 2 + b.passes - (a.buts * 2 + a.passes))
          .slice(0, 5)
          .map((l) => {
            const p = byName.get(l.name);
            return { name: l.name, badge: p ? `${ovr(p.stats)}` : "—" };
          });
    }
  })();

  // Placement par poste (rangées), puis répartition horizontale.
  const rows: { name: string; badge: string; hot?: boolean }[][] = [[], [], []];
  for (const pl of picked) {
    const p = byName.get(pl.name);
    rows[p ? pitchRow(p.poste) : 0].push(pl);
  }

  return (
    <section className="glass overflow-hidden rounded-3xl">
      <div className="p-5 pb-3">
        <p className="mono-label text-primary">Journée {journee} · La synthèse</p>
        {/* Les modes — le terrain reste, le sens change */}
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MODES.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={cn(
                "mono-label shrink-0 rounded-full px-3 py-1.5 transition-colors",
                mode === id ? "bg-foreground text-background" : "glass-soft text-foreground/50"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Le demi-terrain : rond central en haut, surface en bas */}
      <div
        className="relative mx-4 rounded-2xl border border-primary/20"
        style={{
          height: 250,
          background:
            "radial-gradient(120% 90% at 50% 0%, rgba(111,168,255,0.14), transparent 60%), linear-gradient(180deg, rgba(111,168,255,0.05), transparent)",
        }}
      >
        <div className="pointer-events-none absolute -top-10 left-1/2 size-24 -translate-x-1/2 rounded-full border border-primary/25" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-12 w-40 -translate-x-1/2 rounded-t-xl border border-b-0 border-primary/25" />
        {picked.length === 0 && (
          <p className="mono-label absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-foreground/30">
            Rien à afficher ici
          </p>
        )}
        {rows.map((rowPlayers, ri) =>
          rowPlayers.map((pl, i) => (
            <div
              key={`${mode}-${pl.name}`}
              className="absolute flex -translate-x-1/2 flex-col items-center gap-1"
              style={{
                top: 26 + ri * 74,
                left: `${(100 / (rowPlayers.length + 1)) * (i + 1)}%`,
              }}
            >
              <Avatar name={pl.name} size={pl.hot ? 38 : 34} />
              <span className="max-w-[74px] truncate text-[11px] font-bold">{pl.name}</span>
              <span
                className={cn(
                  "mono-label rounded px-1.5 py-px text-[9px]",
                  pl.hot
                    ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(111,168,255,0.5)]"
                    : "bg-primary/80 text-primary-foreground"
                )}
              >
                {pl.badge}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Les trois chiffres de la journée, autour du terrain */}
      <div className="grid grid-cols-3 gap-px p-4 pt-3">
        {(
          [
            [totalButs, "Buts"],
            [matchesCount, matchesCount > 1 ? "Matchs" : "Match"],
            [participants, "Présents"],
          ] as const
        ).map(([v, l]) => (
          <div key={l} className="text-center">
            <div className="text-[22px] leading-none font-extrabold tabular-nums">{v}</div>
            <p className="mono-label mt-1 text-foreground/35">{l}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
