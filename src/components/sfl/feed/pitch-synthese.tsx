"use client";

// La synthèse sur le terrain — le module de tête du récap.
//
// Le demi-terrain (concept de l'équipe type) devient le support unique d'une
// synthèse de la journée à plusieurs modes : équipe type, buteurs, passeurs,
// titres. On change de mode par les onglets mono ; les joueurs sont posés sur
// la pelouse selon leur poste, la pastille sous chaque nom change de sens
// selon l'onglet. En pied, les trois chiffres de la journée.
// Rien ne se chevauche (Sabri, 23/10) : trois joueurs au plus par rangée, et
// d'une rangée à la suivante, de quoi poser une carte, son nom et sa pastille
// sans que la carte de devant ne cache la pastille de derrière.
// Dans chaque mode, une carte à titre porte ses puces sur son coin, or MVP,
// rouge Impact, bleu Défensive (Ilyes, 02/11/2026, puces-titres.tsx), lues
// au seul point de lecture (hooks/use-titres-du-jour.ts) : rien tant que le
// titre n'est pas attribué, rien sur une carte d'extra time.

import { useState } from "react";
import { ovr, type Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";
import { CarteDe } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { PucesTitres } from "@/components/sfl/puces-titres";
import { useTitresDuJour } from "@/hooks/use-titres-du-jour";

export interface PitchLine {
  name: string;
  buts: number;
  passes: number;
  mvp?: boolean;
  impact?: boolean;
  def?: boolean;
  /** Venu en extra time : sa carte ne porte pas de puce (ses titres sont sur celle de son match). */
  extraTime?: boolean;
}

type Mode = "type" | "buts" | "passes" | "titres";

const MODES: [Mode, string][] = [
  ["type", "Équipe type"],
  ["buts", "Buteurs"],
  ["passes", "Passeurs"],
  ["titres", "Titres"],
];

/** La pastille du mode « Titres » : le titre en entier s'il est seul, sinon chacun en court (« IMP·DÉF »). */
const LONG = { mvp: "MVP", impact: "IMPACT", def: "DÉF" } as const;
const COURT = { mvp: "MVP", impact: "IMP", def: "DÉF" } as const;

/** Le joueur, en petite carte (la pastille de la hiérarchie des cartes). */
function Avatar({ name }: { name: string; size?: number }) {
  return <CarteDe name={name} />;
}

/** Un joueur posé (sa carte, son nom, sa pastille) et l'écart d'une rangée à la suivante, en px. */
const BLOC = 90;
const RANGEE = BLOC + 8;
const HAUT = 26;
/** La place en largeur (en %) des joueurs d'une rangée, selon leur nombre. */
const LARGEURS: Record<number, number[]> = { 1: [50], 2: [30, 70], 3: [18, 50, 82] };

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
  // Les titres du jour une fois attribués (le seul point de lecture) : les
  // puces de chaque carte, quel que soit le mode, et le mode « Titres ».
  const titresDuJour = useTitresDuJour(journee);

  // Sélection des joueurs à poser sur la pelouse, selon le mode.
  const picked: { name: string; badge: string; hot?: boolean; extraTime?: boolean }[] = (() => {
    switch (mode) {
      case "buts":
        return [...lines]
          .filter((l) => l.buts > 0)
          .sort((a, b) => b.buts - a.buts)
          .slice(0, 5)
          .map((l, i) => ({ name: l.name, badge: `${l.buts} B`, hot: i === 0, extraTime: l.extraTime }));
      case "passes":
        return [...lines]
          .filter((l) => l.passes > 0)
          .sort((a, b) => b.passes - a.passes)
          .slice(0, 5)
          .map((l, i) => ({ name: l.name, badge: `${l.passes} P`, hot: i === 0, extraTime: l.extraTime }));
      case "titres":
        // Cinq cartes au plus : les MVP d'abord, puis ceux qui ont le plus de
        // titres (un même joueur peut être MVP, Impact et Mur), dans l'ordre de
        // la feuille à égalité. La pastille les dit tous, dans l'ordre des puces.
        return lines
          .filter((l) => !l.extraTime)
          .map((l) => ({ l, t: titresDuJour(l.name) }))
          .filter(({ t }) => t.length > 0)
          .sort((a, b) => Number(b.t.includes("mvp")) - Number(a.t.includes("mvp")) || b.t.length - a.t.length)
          .slice(0, 5)
          .map(({ l, t }) => ({
            name: l.name,
            badge: t.length > 1 ? t.map((x) => COURT[x]).join("·") : LONG[t[0]],
            hot: t.includes("mvp"),
          }));
      default:
        return [...lines]
          .sort((a, b) => b.buts * 2 + b.passes - (a.buts * 2 + a.passes))
          .slice(0, 5)
          .map((l) => {
            const p = byName.get(l.name);
            return { name: l.name, badge: p ? `${ovr(p.stats)}` : "—", extraTime: l.extraTime };
          });
    }
  })();


  // Placement par poste (l'attaque près du rond central, le gardien devant
  // sa surface), puis répartition horizontale : une rangée de plus de trois
  // se dédouble, une rangée vide disparaît.
  const parPoste: typeof picked[] = [[], [], []];
  for (const pl of picked) {
    const p = byName.get(pl.name);
    parPoste[p ? pitchRow(p.poste) : 0].push(pl);
  }
  const rows = parPoste.flatMap((r) => {
    if (r.length > 3) return [r.slice(0, Math.ceil(r.length / 2)), r.slice(Math.ceil(r.length / 2))];
    return r.length ? [r] : [];
  });

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
                "mono-label shrink-0 px-3 py-1.5",
                mode === id ? "bouton-principal" : "bouton-secondaire text-foreground/55"
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
          height: Math.max(250, HAUT + (rows.length - 1) * RANGEE + BLOC + 14),
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
                top: HAUT + ri * RANGEE,
                left: `${LARGEURS[rowPlayers.length][i]}%`,
              }}
            >
              <div className="relative flex">
                <Avatar name={pl.name} size={pl.hot ? 38 : 34} />
                <PucesTitres titres={pl.extraTime ? [] : titresDuJour(pl.name)} />
              </div>
              <span className="max-w-[74px] truncate text-[11px] font-bold"><Nom n={pl.name} /></span>
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
