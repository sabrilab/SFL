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
import { CarteDe, MiniCarte } from "@/components/sfl/mini-carte";
import { useSeason } from "@/components/sfl/season-provider";
import type { Journee, MatchPlayerLine, MatchTeam } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";
import { projeter, vue } from "@/lib/sfl/terrain-vu";
import { SolTerrain } from "@/components/sfl/matchs/sol-terrain";
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


/** L'encre de la note sur la couleur d'une équipe : toutes sont claires. */
const onglet = (name: string) => ({ fond: couleur(name), encre: "#0A0A0A" });

/**
 * Les deux tailles du terrain, toutes deux en carte debout (la photo, la
 * note dans l'onglet de l'équipe) : le meilleur de l'équipe n'est qu'un cran
 * au-dessus des autres (×1,15), pas un autre format (Sabri, 19/10 : « mettre
 * en avant, mais ne pas abuser » ; « on préfère le format vertical »).
 */
const PASTILLE = 50 / 254; // 50 × 81 px à l'échelle 1
const VEDETTE = 58 / 254; // 58 × 94 px

/** La ligne d'un poste, du but vers l'avant : 0 gardien … 3 attaque. Sans poste connu : le milieu. */
function ligneDuPoste(poste: string | undefined): number {
  const p = (poste ?? "").split("/")[0].trim().toUpperCase();
  if (p === "G" || p === "GB") return 0;
  if (p === "MDC") return 1.5;
  if (p.startsWith("D") || p === "LAT") return 1;
  if (p === "MOC") return 2.5;
  if (p.startsWith("M")) return 2;
  if (p.startsWith("A") || p === "BU") return 3;
  return 2;
}

/**
 * Les joueurs de champ par ligne, défense → attaque, comme une compo de foot
 * à cinq, six ou sept. Deux lignes qui se suivent n'ont jamais le même
 * nombre de joueurs : chaque carte tombe dans l'intervalle de la ligne de
 * devant et ne cache personne.
 */
const SCHEMAS: Record<number, number[]> = { 1: [1], 2: [2], 3: [2, 1], 4: [1, 2, 1], 5: [2, 1, 2], 6: [3, 2, 1], 7: [2, 3, 2] };
/** La place en largeur (en %) des joueurs d'une ligne, selon leur nombre. */
const LARGEURS: Record<number, number[]> = { 1: [50], 2: [27, 73], 3: [17, 50, 83] };

/**
 * La compo d'une équipe : le gardien près du but s'il y en a un, puis la
 * défense, le milieu et l'attaque, chacun rangé selon son poste. Chaque
 * joueur reçoit sa profondeur (8 le but, 40 la médiane, comme la feuille de
 * match) et sa place en largeur (en %).
 */
function compo(equipe: MatchTeam, poste: (l: MatchPlayerLine) => string | undefined) {
  const tries = [...equipe.players].sort((x, y) => ligneDuPoste(poste(x)) - ligneDuPoste(poste(y)));
  const gardien = tries[0] && ligneDuPoste(poste(tries[0])) === 0 ? tries.shift()! : null;
  const n = tries.length;
  const tiers = Math.ceil(n / 3);
  const schema = SCHEMAS[n] ?? [tiers, Math.ceil((n - tiers) / 2), n - tiers - Math.ceil((n - tiers) / 2)];
  const lignes: MatchPlayerLine[][] = [];
  let i = 0;
  for (const k of schema) {
    if (k > 0) lignes.push(tries.slice(i, i + k));
    i += k;
  }
  const out: { ligne: MatchPlayerLine; profondeur: number; largeur: number }[] = [];
  if (gardien) out.push({ ligne: gardien, profondeur: 5, largeur: 50 });
  const debut = gardien ? 22 : 10;
  lignes.forEach((rang, r) => {
    const profondeur = lignes.length === 1 ? 32 : debut + ((40 - debut) * r) / (lignes.length - 1);
    rang.forEach((ligne, j) => {
      const largeur = LARGEURS[rang.length]?.[j] ?? 12 + (j * 76) / (rang.length - 1);
      out.push({ ligne, profondeur, largeur });
    });
  });
  return out;
}

/**
 * Le point de vue des terrains de la Ligue : plus court que celui de la
 * feuille de match (500 px au lieu de 540) et moins couché (38° au lieu de
 * 56°), pour que les rangs de cartes debout s'étagent au lieu de s'empiler
 * (Sabri, 19/10 : « le terrain est un peu trop grand »).
 */
const VUE = vue(270, 500, 38);

/** La profondeur (8 le but, 40 la médiane) en px depuis la médiane du terrain couché. */
const depuisMediane = (profondeur: number) => 74 + ((40 - profondeur) / 32) * (VUE.h / 2 - 104);

/** Le haut d'une carte debout et de son nom, à l'échelle 1 : la carte (1 × φ) et l'étiquette. */
const hauteurCarte = (size: number) => 254 * size * PHI + 24;
/** La marge autour du terrain et des cartes, dans le cadre. */
const MARGE = 14;
const PHI = (1 + Math.sqrt(5)) / 2;

/**
 * Le terrain du match en légère perspective, comme la feuille de match de la
 * Map (lib/sfl/terrain-vu.ts) : le terrain couché avec son ombre sous chaque
 * carte, les cartes debout, plus petites au fond. Une équipe par moitié,
 * chacune en vraie compo ; le meilleur du jour de chaque équipe (buts et
 * passes), un seul, à peine plus grand, son nom en gras.
 */
function Terrain({ a, b }: { a: MatchTeam; b: MatchTeam }) {
  const { allPlayers } = useSeason();
  const trouver = (l: MatchPlayerLine) => allPlayers.find((p) => p.name.toLowerCase() === l.name.trim().toLowerCase());
  const poids = (p: MatchPlayerLine) => p.buts * 2 + p.passes;
  const vedette = (eq: MatchTeam) => {
    const m = [...eq.players].sort((x, y) => poids(y) - poids(x))[0];
    return m && poids(m) > 0 ? m : null;
  };
  const { l, h } = VUE;
  const places = (
    [
      [a, -1],
      [b, 1],
    ] as const
  )
    .flatMap(([eq, sens]) => {
      const star = vedette(eq);
      return compo(eq, (x) => trouver(x)?.poste).map(({ ligne, profondeur, largeur }) => {
        const u = (largeur / 100) * l;
        const v = h / 2 + sens * depuisMediane(profondeur);
        return { ligne, equipe: eq.name, star: ligne === star, u, v, ...projeter(u, v, 0, VUE) };
      });
    })
    .sort((x, y) => x.v - y.v);
  const centre = projeter(l / 2, h / 2, 0, VUE);
  const logo = { l: 46 * centre.k, h: projeter(l / 2, h / 2 + 23, 0, VUE).y - projeter(l / 2, h / 2 - 23, 0, VUE).y };
  // Le cadre épouse ce qu'il montre : du haut de la carte la plus haute
  // (ou du bord du fond) jusqu'à l'épaisseur du bord avant.
  const haut = Math.min(
    projeter(0, 0, 0, VUE).y,
    ...places.map(({ y, k, star }) => y - hauteurCarte(star ? VEDETTE : PASTILLE) * k),
  );
  const bas = projeter(l / 2, h, -14, VUE).y;
  const decalage = MARGE - haut;

  return (
    <div
      className="relative w-full overflow-hidden rounded-[22px] bg-[radial-gradient(120%_80%_at_50%_0%,#22252a_0%,#111214_70%)]"
      style={{ height: bas - haut + MARGE * 2 }}
    >
      <div className="absolute inset-x-0" style={{ top: decalage, height: bas + MARGE }}>
        <SolTerrain ombres={places} rayon={30} vue={VUE} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/bola/symbole-blanc.svg"
          alt=""
          aria-hidden
          className="absolute"
          style={{
            left: `calc(50% - ${logo.l / 2}px)`,
            top: centre.y - logo.l / 2,
            width: logo.l,
            height: logo.l,
            transform: `scaleY(${logo.h / logo.l})`,
            opacity: 0.85,
          }}
        />
        {places.map(({ ligne, equipe, star, x, y, k }) => {
          const player = trouver(ligne);
          const size = star ? VEDETTE : PASTILLE;
          const teinte = couleur(equipe);
          return (
            <div key={ligne.name} className="absolute size-0" style={{ left: `calc(50% + ${x}px)`, top: y }}>
              <div
                className="absolute bottom-0 left-0 flex flex-col items-center"
                style={{ transformOrigin: "50% 100%", transform: `translateX(-50%) scale(${k})` }}
              >
                {player ? (
                  <MiniCarte player={player} size={size} onglet={onglet(equipe)} vertical detail={ligne.buts || ligne.passes ? `${ligne.buts} B · ${ligne.passes} P` : undefined} />
                ) : (
                  <CarteDe name={ligne.name} size={size} />
                )}
                <span
                  className="mt-[4px] flex items-center gap-[5px] whitespace-nowrap rounded-full px-[7px] py-[2px] text-[10.5px] leading-[1.2] shadow-[inset_0_0_0_1px_rgba(128,128,128,0.45)]"
                  style={{ background: teinte, color: "#0A0A0A", fontWeight: star ? 800 : 600 }}
                >
                  {ligne.name.split(" ")[0]}
                  {(ligne.buts > 0 || ligne.passes > 0) && (
                    <span className="font-mono text-[9px] font-semibold opacity-60 tabular-nums">
                      {ligne.buts > 0 && `${ligne.buts}B`}
                      {ligne.buts > 0 && ligne.passes > 0 && " "}
                      {ligne.passes > 0 && `${ligne.passes}P`}
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
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
