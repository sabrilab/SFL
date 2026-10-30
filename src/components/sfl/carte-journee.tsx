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
//
// Chaque match se lit Noirs contre Blancs, comme la feuille de match de la
// Map (lib/sfl/maillots.ts) : le tableau d'affichage le dit, et chaque carte
// porte la note et le nom aux couleurs de son maillot (Sabri, 23/10). La
// couleur du jour de l'admin (Orange, Bleu…) ne s'y montre plus. Chaque
// joueur y porte aussi le maillot de son camp, sa photo repeinte par le code
// (lib/sfl/maillot-des-photos.ts).

import { useState } from "react";
import { CarteDe, MiniCarte } from "@/components/sfl/mini-carte";
import { useSeason } from "@/components/sfl/season-provider";
import type { Journee, MatchPlayerLine, MatchTeam } from "@/lib/sfl/engine";
import { MAILLOTS } from "@/lib/sfl/maillots";
import { PastilleMaillot } from "@/components/sfl/point-maillot";
import { cn } from "@/lib/utils";
import { projeter } from "@/lib/sfl/terrain-vu";
import { placerJournee, VUE_JOURNEE as VUE } from "@/lib/sfl/places-journee";
import { SolTerrain } from "@/components/sfl/matchs/sol-terrain";
import { AuVestiaire } from "@/components/sfl/au-vestiaire";

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

/** La marge autour du terrain et des cartes, dans le cadre. */
const MARGE = 14;

/** Ses buts et ses passes du jour, comme l'étiquette les écrit (« 2B 1P »). */
const chiffres = (l: MatchPlayerLine) => [l.buts > 0 && `${l.buts}B`, l.passes > 0 && `${l.passes}P`].filter(Boolean).join(" ");

/**
 * La largeur d'une étiquette entière, à l'échelle 1 : le prénom en Inter
 * 10,5 px (gras pour le meilleur), les chiffres en Inter 9 px, les
 * marges. Comptée un peu large, lettre par lettre (mesuré dans Chrome le
 * 23/10 : jamais en dessous du vrai) : places-journee.ts s'en sert pour
 * laisser un prénom long prendre la place que ses voisins n'utilisent pas.
 */
function largeurEtiquette(prenom: string, stats: string, gras: boolean): number {
  const em = (c: string) =>
    /[iljIîï.'’]/.test(c) ? 0.3 : /[frt1 ]/.test(c) ? 0.4 : /[mwMW]/.test(c) ? 1 : /[A-ZÀ-Þ]/.test(c) ? 0.76 : 0.63;
  const nom = [...prenom].reduce((s, c) => s + em(c), 0) * 10.5 * (gras ? 1.04 : 1);
  return 14 + nom + (stats ? 5 + stats.length * 5.4 : 0) + 2;
}

/**
 * Le terrain du match en légère perspective, comme la feuille de match de la
 * Map (lib/sfl/terrain-vu.ts) : le terrain couché avec son ombre sous chaque
 * carte, les cartes debout, plus petites au fond. Une équipe par moitié, son
 * gardien au but s'il en a un, puis deux rangs rangés selon les postes, la
 * défense et l'attaque, posés par places-journee.ts pour qu'aucune carte ne
 * cache la carte ou le prénom d'une autre. Le meilleur du jour de chaque
 * équipe (buts et passes), un seul, à peine plus grand, son nom en gras.
 */
function Terrain({ a, b }: { a: MatchTeam; b: MatchTeam }) {
  const { allPlayers } = useSeason();
  const trouver = (l: MatchPlayerLine) => allPlayers.find((p) => p.name.toLowerCase() === l.name.trim().toLowerCase());
  const poids = (p: MatchPlayerLine) => p.buts * 2 + p.passes;
  // Chaque équipe du but vers l'avant : le gardien d'abord, s'il est déclaré à ce poste.
  const ranger = (eq: MatchTeam) => {
    const tries = [...eq.players].sort((x, y) => ligneDuPoste(trouver(x)?.poste) - ligneDuPoste(trouver(y)?.poste));
    const meilleur = [...tries].sort((x, y) => poids(y) - poids(x))[0];
    const vedette = meilleur && poids(meilleur) > 0 ? tries.indexOf(meilleur) : -1;
    return {
      tries,
      nombre: tries.length,
      gardien: !!tries[0] && ligneDuPoste(trouver(tries[0])?.poste) === 0,
      vedette,
      etiquettes: tries.map((l, i) => largeurEtiquette(l.name.split(" ")[0], chiffres(l), i === vedette)),
    };
  };
  const equipes = [ranger(a), ranger(b)] as const;
  // Les Noirs (la première équipe du match) au fond, les Blancs devant.
  const maillots = [MAILLOTS.Noirs, MAILLOTS.Blancs] as const;
  const disposition = placerJournee(equipes[0], equipes[1]);
  // Du fond vers l'avant : celle de devant passe par-dessus celle de derrière.
  const places = disposition.places
    .map((p) => ({
      ...p,
      ligne: equipes[p.equipe].tries[p.i],
      maillot: maillots[p.equipe],
      star: p.i === equipes[p.equipe].vedette,
      voulue: equipes[p.equipe].etiquettes[p.i],
    }))
    .sort((x, y) => x.v - y.v);
  const { l, h } = VUE;
  const centre = projeter(l / 2, h / 2, 0, VUE);
  const logo = { l: 46 * centre.k, h: projeter(l / 2, h / 2 + 23, 0, VUE).y - projeter(l / 2, h / 2 - 23, 0, VUE).y };
  // Le cadre épouse ce qu'il montre : du haut de la carte la plus haute
  // (ou du bord du fond) jusqu'à l'épaisseur du bord avant.
  const { haut, bas } = disposition;
  const decalage = MARGE - haut;

  return (
    <div
      className="relative w-full overflow-hidden rounded-[22px] bg-[radial-gradient(120%_80%_at_50%_0%,#ffffff_0%,#e6e8e3_70%)] dark:bg-[radial-gradient(120%_80%_at_50%_0%,#22252a_0%,#111214_70%)]"
      style={{ height: bas - haut + MARGE * 2 }}
    >
      <div className="absolute inset-x-0" style={{ top: decalage, height: bas + MARGE }}>
        <SolTerrain ombres={places} rayon={30} vue={VUE} gazon="vert" />
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
        {places.map(({ ligne, maillot, star, x, y, k, taille, etiquette, voulue }) => {
          const player = trouver(ligne);
          // Une étiquette qui ne tient pas entière se resserre un peu (lettres et marges), comme sur iPhone, avant que le prénom s'abrège.
          const serre = Math.min(1, Math.max(0.86, etiquette / voulue));
          return (
            <div key={ligne.name} className="absolute size-0" style={{ left: `calc(50% + ${x}px)`, top: y }}>
              <div
                className="absolute bottom-0 left-0 flex flex-col items-center"
                style={{ transformOrigin: "50% 100%", transform: `translateX(-50%) scale(${k})` }}
              >
                {player ? (
                  <MiniCarte
                    player={player}
                    size={taille}
                    onglet={{ fond: maillot.fond, encre: maillot.encre }}
                    maillot={maillot.nom}
                    vertical
                    detail={ligne.buts || ligne.passes ? `${ligne.buts} B · ${ligne.passes} P` : undefined}
                  />
                ) : (
                  <CarteDe name={ligne.name} size={taille} />
                )}
                <span
                  className="mt-[4px] flex items-center gap-[0.48em] whitespace-nowrap rounded-full px-[0.667em] py-[2px] leading-[12.6px] shadow-[inset_0_0_0_1px_rgba(128,128,128,0.45)]"
                  style={{ background: maillot.fond, color: maillot.encre, fontWeight: star ? 800 : 600, maxWidth: etiquette, fontSize: 10.5 * serre }}
                >
                  <span className="min-w-0 truncate">{ligne.name.split(" ")[0]}</span>
                  {chiffres(ligne) && (
                    <span className="shrink-0 font-mono text-[0.857em] font-semibold opacity-60 tabular-nums">{chiffres(ligne)}</span>
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
                "mono-label shrink-0 px-2.5 py-1",
                i === index ? "bouton-principal" : "bouton-secondaire text-foreground/55"
              )}
            >
              M{i + 1} · {m.teamA.score}–{m.teamB.score}
            </button>
          ))}
        </div>
      )}

      {/* Le tableau d'affichage : les Noirs à gauche (au fond du terrain), les Blancs à droite (devant). */}
      <div className="flex items-center justify-between gap-3 px-4 pb-2.5">
        <span className="flex min-w-0 flex-1">
          <PastilleMaillot camp="Noirs" className="text-[13px]" />
        </span>
        <span className="shrink-0 text-[22px] leading-none font-extrabold tracking-tight tabular-nums">
          {match.teamA.score}<span className="mx-1 text-foreground/25">–</span>{match.teamB.score}
        </span>
        <span className="flex min-w-0 flex-1 justify-end">
          <PastilleMaillot camp="Blancs" className="text-[13px]" />
        </span>
      </div>

      <div className="px-4">
        <Terrain a={match.teamA} b={match.teamB} />
      </div>

      <div className="mx-4 mt-3 mb-4 flex gap-2">
        {onOuvrir && (
          <button
            onClick={onOuvrir}
            className="bouton-principal flex-1 py-3 text-center text-[14px] font-bold"
          >
            Ouvrir le récap
          </button>
        )}
        <AuVestiaire piece={{ type: "feuille", j: journee.j }} className={onOuvrir ? "" : "flex-1"} />
      </div>
    </section>
  );
}
