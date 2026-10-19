"use client";

// La carte-journée — un dimanche tient sur un terrain.
//
// Le match est dessiné : les deux camps, le rond central, les surfaces, et
// chaque joueur avec sa carte Bola, en entier, ses buts et ses passes du jour
// (Sabri, 18/10 : « même dans Matchs, la nouvelle DA », les cartes en petit
// ou en moyen). Une équipe par moitié de terrain, les décisifs devant. Une
// journée qui a compté plusieurs matchs garde UNE carte : les matchs
// deviennent des onglets, le terrain reste.
//
// C'est la vue « Matchs » de la Ligue : on parcourt la saison en regardant des
// terrains, pas des tableaux. Toucher la carte ouvre le récap de la journée.

import { useState } from "react";
import { motion } from "motion/react";
import { CarteDe, FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { useSeason } from "@/components/sfl/season-provider";
import type { Journee, MatchPlayerLine, MatchTeam } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";
import { AuVestiaire } from "@/components/sfl/au-vestiaire";

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

const PHI = (1 + Math.sqrt(5)) / 2;

/** L'encre de la note sur la couleur d'une équipe : toutes sont claires. */
const onglet = (name: string) => ({ fond: couleur(name), encre: "#0A0A0A" });

/**
 * Un joueur sur la feuille : sa vraie carte Bola, son nom en entier, ses
 * buts et ses passes. Le meilleur de son équipe passe au format moyen (la
 * réduite) ; les autres gardent la pastille, la note aux couleurs de l'équipe.
 */
function Joueur({ ligne, equipe, delai, star }: { ligne: MatchPlayerLine; equipe: string; delai: number; star: boolean }) {
  const { allPlayers } = useSeason();
  const cle = ligne.name.trim().toLowerCase();
  const player = allPlayers.find((p) => p.name.toLowerCase() === cle);
  const decisif = ligne.buts > 0 || ligne.passes > 0;
  const size = star ? FORMAT_CARTE.moyenne : FORMAT_CARTE.petite;
  const largeur = 254 * size;
  const teinte = couleur(equipe);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.4, delay: delai, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]"
      // Le nom a sa place, même sous une pastille : rien n'est coupé.
      style={{ width: Math.max(largeur, 64) }}
    >
      <span className="relative" style={{ filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.45))" }}>
        {player ? (
          <MiniCarte player={player} size={size} onglet={onglet(equipe)} detail={ligne.buts || ligne.passes ? `${ligne.buts} B · ${ligne.passes} P` : undefined} />
        ) : (
          <CarteDe name={ligne.name} size={size} />
        )}
      </span>
      {/* Le filet de l'équipe, sous les cartes que la note ne colore pas. */}
      {star && <span className="mt-[5px] h-[3px] rounded-full" style={{ width: largeur / PHI, background: teinte }} />}
      <span
        className="mt-[5px] max-w-full text-center leading-[1.1] font-bold break-words text-white/90"
        style={{ fontSize: star ? 12 : 10 }}
      >
        {ligne.name}
      </span>
      {decisif && (
        // « B » et « P » plutôt que des émojis : lisibles partout, et c'est le
        // vocabulaire déjà employé sur le terrain de la synthèse.
        <span className="mono-label mt-[3px] text-[9px] leading-none text-white/55 tabular-nums">
          {ligne.buts > 0 && `${ligne.buts}B`}
          {ligne.buts > 0 && ligne.passes > 0 && " "}
          {ligne.passes > 0 && `${ligne.passes}P`}
        </span>
      )}
      {ligne.note && <span className="mono-label mt-[3px] text-[8px] leading-none text-white/40">{ligne.note}</span>}
    </motion.div>
  );
}

/**
 * Une moitié de terrain : au fond, près du but, l'équipe en pastilles ;
 * devant, vers la ligne médiane, son meilleur joueur du jour, en plus grand
 * (deux s'ils sont à égalité).
 */
function Moitie({ equipe, haut, delai }: { equipe: MatchTeam; haut: boolean; delai: number }) {
  const poids = (p: MatchPlayerLine) => p.buts * 2 + p.passes;
  const ordre = [...equipe.players].sort((x, y) => poids(y) - poids(x));
  const top = poids(ordre[0] ?? { name: "", buts: 0, passes: 0 });
  const devant = top > 0 ? ordre.filter((p) => poids(p) === top).slice(0, 2) : [];
  const fond = ordre.filter((p) => !devant.includes(p));
  const rangee = (lignes: MatchPlayerLine[], d: number, star: boolean) =>
    lignes.length > 0 && (
      <div className="flex flex-wrap items-start justify-center gap-x-[5px] gap-y-[var(--fib-13)]">
        {lignes.map((l, i) => (
          <Joueur key={l.name} ligne={l} equipe={equipe.name} delai={d + i * 0.05} star={star} />
        ))}
      </div>
    );
  return (
    <div className={cn("relative flex gap-[var(--fib-13)] px-[var(--fib-8)]", haut ? "flex-col pt-[var(--fib-34)] pb-[var(--fib-21)]" : "flex-col-reverse pt-[var(--fib-21)] pb-[var(--fib-34)]")}>
      {rangee(fond, delai, false)}
      {rangee(devant, delai + 0.1, true)}
    </div>
  );
}

/**
 * Le terrain, vu d'en haut et debout : une équipe par moitié, chacun avec sa
 * carte. Tondu en bandes, tracé à la craie.
 */
function Terrain({ a, b }: { a: MatchTeam; b: MatchTeam }) {
  return (
    <div
      className="relative overflow-hidden rounded-[18px] border border-white/10"
      style={{
        background:
          "repeating-linear-gradient(180deg, #17331f 0 34px, #143019 34px 68px)",
        boxShadow: "inset 0 0 60px rgba(0,0,0,0.55)",
      }}
    >
      {/* Le tracé */}
      <div aria-hidden className="pointer-events-none absolute inset-[var(--fib-8)] rounded-[12px] border border-white/30" />
      <span aria-hidden className="pointer-events-none absolute inset-x-[var(--fib-8)] top-1/2 h-px -translate-y-1/2 bg-white/30" />
      <span aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-[89px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
      <span aria-hidden className="pointer-events-none absolute top-[var(--fib-8)] left-1/2 h-[34px] w-[38%] -translate-x-1/2 rounded-b-[6px] border border-t-0 border-white/30" />
      <span aria-hidden className="pointer-events-none absolute bottom-[var(--fib-8)] left-1/2 h-[34px] w-[38%] -translate-x-1/2 rounded-t-[6px] border border-b-0 border-white/30" />

      <Moitie equipe={a} haut delai={0} />
      <Moitie equipe={b} haut={false} delai={0.15} />
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
          <span className="text-[13px] leading-tight font-bold break-words">{match.teamA.name}</span>
        </span>
        <span className="shrink-0 text-[22px] leading-none font-extrabold tracking-tight tabular-nums">
          {match.teamA.score}<span className="mx-1 text-foreground/25">–</span>{match.teamB.score}
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
          <span className="text-right text-[13px] leading-tight font-bold break-words">{match.teamB.name}</span>
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: couleur(match.teamB.name) }}
          />
        </span>
      </div>

      <div className="px-4">
        <Terrain a={match.teamA} b={match.teamB} />
      </div>

      <div className="mx-4 mt-3 mb-4 flex gap-2">
        {onOuvrir && (
          <button
            onClick={onOuvrir}
            className="flex-1 rounded-full bg-foreground py-3 text-center text-[14px] font-bold text-background transition-transform active:scale-[0.98]"
          >
            Ouvrir le récap
          </button>
        )}
        <AuVestiaire piece={{ type: "feuille", j: journee.j }} className={onOuvrir ? "" : "flex-1"} />
      </div>
    </section>
  );
}
