"use client";

// La carte-journée — un dimanche tient sur un terrain.
//
// Le match est dessiné : les deux camps, le rond central, les surfaces, et
// chaque joueur en bulle à sa place, avec ses buts et ses passes du jour. Une
// journée qui a compté plusieurs matchs garde UNE carte : les matchs
// deviennent des onglets, le terrain reste.
//
// C'est la vue « Matchs » de la Ligue : on parcourt la saison en regardant des
// terrains, pas des tableaux. Toucher la carte ouvre le récap de la journée.

import { useState } from "react";
import { motion } from "motion/react";
import type { Journee, MatchTeam } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

const TEAM_COLORS: Record<string, string> = {
  Orange: "#F9CB9C",
  Bleu: "#8FB6F5",
  Vert: "#9FD49B",
  Jaune: "#F2DC8B",
  Rouge: "#F09A96",
  Gris: "#C9C9C9",
  "Équipe A": "#F9CB9C",
  "Équipe B": "#8FB6F5",
};

const couleur = (name: string) => TEAM_COLORS[name] ?? "#B9B9B9";

/**
 * Place les joueurs d'une équipe sur sa moitié de terrain. Le premier reste
 * au fond, les autres montent en quinconce : ça n'a pas la prétention d'être
 * une composition, seulement de se lire comme une équipe.
 */
function positions(n: number, gauche: boolean): { x: number; y: number }[] {
  if (n === 0) return [];
  // Assez rentré pour que le nom sous la bulle ne soit pas rogné par le bord.
  const fond = gauche ? 14 : 86;
  const proche = gauche ? 30 : 70;
  const loin = gauche ? 43 : 57;
  const out: { x: number; y: number }[] = [{ x: fond, y: 50 }];
  const restants = n - 1;
  for (let i = 0; i < restants; i++) {
    const colonne = i % 2 === 0 ? proche : loin;
    const rang = Math.floor(i / 2);
    const parColonne = Math.ceil(restants / 2);
    const y = parColonne <= 1 ? 50 : 18 + (rang * 64) / Math.max(1, parColonne - 1);
    out.push({ x: colonne, y });
  }
  return out;
}

function Bulle({
  nom,
  buts,
  passes,
  teinte,
  x,
  y,
  delai,
}: {
  nom: string;
  buts: number;
  passes: number;
  teinte: string;
  x: number;
  y: number;
  delai: number;
}) {
  const decisif = buts > 0 || passes > 0;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.35, delay: delai, ease: [0.22, 1, 0.36, 1] }}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[3px]"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span
        className="flex items-center justify-center rounded-full text-[11px] font-black text-[#0A0A0A]"
        style={{
          width: decisif ? 26 : 22,
          height: decisif ? 26 : 22,
          background: teinte,
          boxShadow: decisif ? `0 0 12px ${teinte}66` : "none",
        }}
      >
        {nom[0]}
      </span>
      <span className="max-w-[58px] truncate text-[9.5px] leading-none font-bold text-white/85">
        {nom}
      </span>
      {decisif && (
        // « B » et « P » plutôt que des émojis : lisibles partout, et c'est le
        // vocabulaire déjà employé sur le terrain de la synthèse.
        <span className="mono-label text-[8px] leading-none text-white/55">
          {buts > 0 && `${buts}B`}
          {buts > 0 && passes > 0 && " "}
          {passes > 0 && `${passes}P`}
        </span>
      )}
    </motion.div>
  );
}

function Terrain({ a, b }: { a: MatchTeam; b: MatchTeam }) {
  const posA = positions(a.players.length, true);
  const posB = positions(b.players.length, false);
  return (
    <div
      className="relative overflow-hidden rounded-[18px] border border-white/10"
      style={{
        aspectRatio: "16 / 10",
        background:
          "radial-gradient(90% 120% at 50% 50%, rgba(111,168,255,0.10), transparent 70%), linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012))",
      }}
    >
      {/* Le tracé */}
      <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/12" />
      <span className="pointer-events-none absolute top-1/2 left-1/2 size-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12" />
      <span className="pointer-events-none absolute top-1/2 left-0 h-[46%] w-[13%] -translate-y-1/2 rounded-r-md border border-l-0 border-white/12" />
      <span className="pointer-events-none absolute top-1/2 right-0 h-[46%] w-[13%] -translate-y-1/2 rounded-l-md border border-r-0 border-white/12" />

      {a.players.map((p, i) => (
        <Bulle
          key={`a-${p.name}`}
          nom={p.name}
          buts={p.buts}
          passes={p.passes}
          teinte={couleur(a.name)}
          x={posA[i]?.x ?? 20}
          y={posA[i]?.y ?? 50}
          delai={i * 0.05}
        />
      ))}
      {b.players.map((p, i) => (
        <Bulle
          key={`b-${p.name}`}
          nom={p.name}
          buts={p.buts}
          passes={p.passes}
          teinte={couleur(b.name)}
          x={posB[i]?.x ?? 80}
          y={posB[i]?.y ?? 50}
          delai={0.1 + i * 0.05}
        />
      ))}
    </div>
  );
}

export function CarteJournee({
  journee,
  onOuvrir,
}: {
  journee: Journee;
  onOuvrir?: () => void;
}) {
  const matches = journee.matches ?? [];
  const [index, setIndex] = useState(0);
  const match = matches[Math.min(index, matches.length - 1)];

  if (!match) {
    return (
      <section className="glass rounded-3xl px-5 py-8 text-center">
        <p className="mono-label text-primary">Journée {journee.j}</p>
        <p className="mt-2 text-[13px] text-foreground/40">
          {journee.date} · feuille de match pas encore renseignée
        </p>
      </section>
    );
  }

  const total = matches.reduce((s, m) => s + m.teamA.score + m.teamB.score, 0);

  return (
    <section className="glass overflow-hidden rounded-3xl">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <p className="mono-label text-primary">Journée {journee.j}</p>
          <p className="mt-1 text-[19px] leading-none font-extrabold tracking-tight">
            {journee.date}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[13px] font-bold tabular-nums text-foreground/70">
            {total} but{total > 1 ? "s" : ""}
          </div>
          <p className="mono-label mt-1 text-foreground/35">
            {matches.length} match{matches.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Les matchs de la journée — le terrain, lui, ne bouge pas */}
      {matches.length > 1 && (
        <div className="flex gap-1.5 px-4 pb-2.5">
          {matches.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setIndex(i)}
              className={cn(
                "mono-label shrink-0 rounded-full px-2.5 py-1 transition-colors",
                i === index ? "bg-foreground text-background" : "glass-soft text-foreground/45"
              )}
            >
              M{i + 1} · {m.teamA.score}–{m.teamB.score}
            </button>
          ))}
        </div>
      )}

      {/* Le tableau d'affichage */}
      <div className="flex items-center justify-between gap-3 px-4 pb-2.5">
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: couleur(match.teamA.name) }}
          />
          <span className="truncate text-[13px] font-bold">{match.teamA.name}</span>
        </span>
        <span className="shrink-0 text-[22px] leading-none font-extrabold tracking-tight tabular-nums">
          {match.teamA.score}<span className="mx-1 text-foreground/25">–</span>{match.teamB.score}
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
          <span className="truncate text-[13px] font-bold">{match.teamB.name}</span>
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: couleur(match.teamB.name) }}
          />
        </span>
      </div>

      <div className="px-4">
        <Terrain a={match.teamA} b={match.teamB} />
      </div>

      {onOuvrir && (
        <button
          onClick={onOuvrir}
          className="mt-3 mb-4 mr-4 ml-4 block w-[calc(100%-2rem)] rounded-full bg-foreground py-3 text-center text-[14px] font-bold text-background transition-transform active:scale-[0.98]"
        >
          Ouvrir le récap
        </button>
      )}
    </section>
  );
}
