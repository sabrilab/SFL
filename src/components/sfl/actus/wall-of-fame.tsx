"use client";

// Le Wall of Fame, devenu une époque des Actus (Sabri, 24/10 : le mettre
// « dans la section Actu », avec de quoi choisir « le passé ou le présent » ;
// epoques.tsx). C'était une page à part, ouverte depuis Ma carte ; c'est
// maintenant le temps le plus long de l'onglet, à côté de la saison en cours
// et des saisons closes, avec les mêmes gestes :
//   · la Pépite d'Or de toute la carrière : la rangée de cartes des Actus,
//     centrée sur toi ; les autres légendes (buteurs, passeurs, MVP, titres,
//     victoires, matchs) sont dans l'onglet Classement, à côté ;
//   · trois chiffres : les saisons, les journées, les buts ;
//   · les saisons, une carte chacune : le podium du Pépite d'Or en cartes
//     joueurs (le champion φ fois plus grand que ses dauphins), le meilleur
//     buteur, passeur et MVP ; la toucher ouvre la saison dans les Actus ;
//   · ton parcours, saison par saison : rang, victoires, nuls, défaites, et
//     les médailles gagnées.
// La page (course.tsx) pose l'en-tête ; ici, les morceaux. Tout est lu dans
// lib/sfl/palmares.ts.

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { Medaille } from "@/components/sfl/vitrine";
import { Nom } from "@/components/sfl/nom";
import { useSeason } from "@/components/sfl/season-provider";
import { useCollant } from "@/hooks/use-collant";
import type { Player } from "@/lib/sfl/engine";
import { parcours, type Legende, type SaisonPalmares } from "@/lib/sfl/palmares";
import type { Categorie } from "@/lib/sfl/rankings";
import { vitrine } from "@/lib/sfl/trophees";
import { cn } from "@/lib/utils";
import { ANTON } from "./ecran";

// Le podium d'une saison : le champion en carte moyenne, ses dauphins en petite.
const DAUPHIN = FORMAT_CARTE.petite;
const CHAMPION = FORMAT_CARTE.moyenne;

/**
 * Les légendes en catégories (lib/sfl/rankings.ts) : chaque joueur avec sa
 * dernière carte, classé sur ses totaux de carrière. La Pépite d'Or d'abord,
 * seule dans la rangée de cartes ; toutes dans l'onglet Classement.
 */
export function categoriesLegendes(liste: Legende[]): { categories: Categorie[]; joueurs: Player[] } {
  const parNom = new Map(liste.map((l) => [l.player.name, l]));
  const total = (k: "points" | "buts" | "passes" | "mvp" | "titres" | "victoires" | "matchs") => (p: Player) => parNom.get(p.name)?.[k] ?? 0;
  return {
    joueurs: liste.map((l) => l.player),
    categories: [
      { id: "points", label: "Pépite d'Or", unit: "pts", value: total("points"), showAll: true },
      { id: "buts", label: "Buteurs", unit: "buts", value: total("buts") },
      { id: "passes", label: "Passeurs", unit: "pd", value: total("passes") },
      { id: "mvp", label: "MVP", unit: "mvp", value: total("mvp") },
      { id: "titres", label: "Titres", unit: "titres", unites: ["titre", "titres"], value: total("titres") },
      { id: "victoires", label: "Victoires", unit: "victoires", unites: ["victoire", "victoires"], value: total("victoires") },
      { id: "matchs", label: "Matchs", unit: "matchs", unites: ["match", "matchs"], value: total("matchs") },
    ],
  };
}

function dateCourte(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

/** Une saison dans les Actus : la saison en cours, ou son époque si elle est close. */
export function lienSaison(s: SaisonPalmares) {
  return s.cloturee ? `/saisons/${s.numero}` : "/ligue";
}

/* ------------------------------ Les chiffres ------------------------------ */

export function Compteurs({ saisons, className }: { saisons: SaisonPalmares[]; className?: string }) {
  const journees = saisons.reduce((t, s) => t + s.journees, 0);
  const buts = saisons.reduce((t, s) => t + s.buts, 0);
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {(
        [
          [saisons.length, saisons.length > 1 ? "saisons" : "saison"],
          [journees, journees > 1 ? "journées" : "journée"],
          [buts, buts > 1 ? "buts" : "but"],
        ] as const
      ).map(([v, l]) => (
        <div key={l} className="glass flex flex-col items-center gap-1 rounded-2xl px-3 pt-3 pb-2.5">
          <span className="text-[30px] leading-none tabular-nums" style={{ fontFamily: ANTON }}>
            {v}
          </span>
          <span className="mono-label text-[10px] text-foreground/45">{l}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Une saison ------------------------------ */

/**
 * Le podium d'une saison, ses lauriers et ses chiffres. `titre` remplace le
 * nom de la saison (« Le palmarès », dans l'époque de la saison elle-même) ;
 * sans `lien`, le bas de la carte n'ouvre rien.
 */
export function CarteSaison({ s, titre, lien = true, className }: { s: SaisonPalmares; titre?: string; lien?: boolean; className?: string }) {
  const [premier, deuxieme, troisieme] = [1, 2, 3].map((r) => s.podium.find((p) => p.rank === r) ?? null);
  // Le podium classique : le 2e à gauche, le champion au milieu, le 3e à droite.
  const marches = [
    { p: deuxieme, rang: 2, size: DAUPHIN },
    { p: premier, rang: 1, size: CHAMPION },
    { p: troisieme, rang: 3, size: DAUPHIN },
  ];
  const lauriers = [
    ["Buteur", s.buteur],
    ["Passeur", s.passeur],
    ["MVP", s.mvp],
  ] as const;
  const chiffres = (
    <span className="tabular-nums">
      {s.journees} journée{s.journees > 1 ? "s" : ""} · {s.buts} buts · {s.classement.length} joueurs
    </span>
  );

  return (
    <article className={cn("glass flex flex-col overflow-hidden rounded-[28px]", className)}>
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4">
        <h3 className="text-[17px] font-extrabold tracking-tight">{titre ?? s.nom}</h3>
        <span className="mono-label text-foreground/40">{s.cloturee ? dateCourte(s.cloturee) : "En cours"}</span>
      </div>

      {s.podium.length > 0 ? (
        <div className="flex items-end justify-center gap-3 px-4 pt-4">
          {marches.map(({ p, rang, size }) => (
            <div key={rang} className="flex min-w-0 flex-col items-center gap-1.5">
              {p ? (
                <>
                  <MiniCarte
                    player={p}
                    size={size}
                    detail={`${rang}${rang === 1 ? "er" : "e"} au Pépite d'Or · ${p.pp} pts`}
                    saison={s.cloturee ? s.numero : undefined}
                  />
                  <span className={cn("max-w-[96px] truncate font-semibold", rang === 1 ? "text-[14px]" : "text-[12px] text-foreground/70")}>
                    {p.name}
                  </span>
                  <span className="mono-label text-foreground/40 tabular-nums">
                    {p.pp} pts
                    {/* Les ex aequo : une seule carte, le compte des autres. */}
                    {s.podium.filter((x) => x.rank === rang).length > 1 && ` · +${s.podium.filter((x) => x.rank === rang).length - 1}`}
                  </span>
                </>
              ) : (
                <span style={{ width: 255 * size }} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="px-5 pt-3 text-[13px] text-muted-foreground">Pas encore de points au Pépite d&apos;Or.</p>
      )}

      <div className="flex flex-wrap justify-center gap-1.5 px-4 pt-4">
        {lauriers.map(([quoi, l]) =>
          l ? (
            <span key={quoi} className="inline-flex items-center gap-2 rounded-[16px] border border-foreground/15 bg-foreground/[0.05] py-1 pr-3 pl-1 text-[12px]">
              <MiniCarte player={l.player} size={FORMAT_CARTE.petite} detail={`${quoi} · ${l.n}`} saison={s.cloturee ? s.numero : undefined} />
              <span className="flex flex-col leading-tight">
                <span className="mono-label text-foreground/45">{quoi}</span>
                <span>
                  <span className="font-semibold">
                    <Nom n={l.player.name} />
                  </span>{" "}
                  <span className="text-foreground/50 tabular-nums">{l.n}</span>
                </span>
              </span>
            </span>
          ) : null,
        )}
      </div>

      {lien ? (
        <Link
          href={lienSaison(s)}
          onClick={() => document.getElementById("app-scroll")?.scrollTo({ top: 0 })}
          className="mt-4 flex items-center justify-between border-t border-foreground/10 px-5 py-3 text-[13px] text-foreground/60 transition-colors hover:text-foreground"
        >
          {chiffres}
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <p className="mt-4 border-t border-foreground/10 px-5 py-3 text-[13px] text-foreground/60">{chiffres}</p>
      )}
    </article>
  );
}

/* ------------------------------ Ton parcours ------------------------------ */

function Parcours({ nom, saisons }: { nom: string; saisons: SaisonPalmares[] }) {
  const { saison } = useSeason();
  const etapes = useMemo(() => parcours(saisons, nom), [saisons, nom]);
  const medailles = useMemo(() => vitrine(saison, nom, new Date()).filter((e) => e.palier > 0), [saison, nom]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="mono-label px-1 text-foreground/40">Ton parcours</h2>
      {etapes.length === 0 ? (
        <p className="glass-soft rounded-[24px] px-4 py-4 text-[13px] text-muted-foreground">Ton premier dimanche ouvrira ton parcours.</p>
      ) : (
        <div className="glass overflow-hidden rounded-[24px]">
          {etapes.map(({ saison: s, rang, sur, player, bilan }, i) => {
            const total = bilan.victoires + bilan.nuls + bilan.defaites;
            return (
              <Link
                key={s.numero}
                href={lienSaison(s)}
                onClick={() => document.getElementById("app-scroll")?.scrollTo({ top: 0 })}
                className={cn("flex items-center gap-3.5 px-4 py-3", i > 0 && "border-t border-foreground/[0.08]")}
              >
                <span className="flex w-11 shrink-0 flex-col items-center">
                  <span className="text-[24px] leading-none tabular-nums" style={{ fontFamily: ANTON }}>
                    {rang}
                  </span>
                  <span className="mono-label mt-1 text-[9px] text-foreground/40 tabular-nums">sur {sur}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[14px] font-bold">{s.nom}</span>
                    <span className="shrink-0 text-[12px] text-foreground/50 tabular-nums">
                      {player.buts} B · {player.passes} P · {player.pp} pts
                    </span>
                  </span>
                  {/* Victoires, nuls, défaites : une barre, sans couleur de verdict. */}
                  <span className="flex h-1.5 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
                    {total > 0 && (
                      <>
                        <span className="bg-foreground" style={{ width: `${(bilan.victoires / total) * 100}%` }} />
                        <span className="bg-foreground/40" style={{ width: `${(bilan.nuls / total) * 100}%` }} />
                      </>
                    )}
                  </span>
                  <span className="text-[12px] text-foreground/55 tabular-nums">
                    {bilan.victoires} V · {bilan.nuls} N · {bilan.defaites} D
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-foreground/40" />
              </Link>
            );
          })}
        </div>
      )}

      {medailles.length > 0 && (
        <div className="glass-soft flex gap-3 overflow-x-auto rounded-[24px] px-4 py-3.5 [scrollbar-width:none]">
          {medailles.map((e) => (
            <span key={e.def.id} className="flex w-14 shrink-0 flex-col items-center gap-1.5" title={e.def.nom}>
              <Medaille e={e} diametre={44} />
              <span className="w-full truncate text-center text-[10.5px] text-foreground/55">{e.def.nom}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------ Le mur ------------------------------ */

/**
 * Sous l'en-tête : les saisons, de la plus récente à la plus ancienne, et ton
 * parcours. Sur grand écran, au nombre d'or : les saisons à gauche, ton
 * parcours à droite, qui reste à l'écran s'il y tient.
 */
export function LeMur({ saisons, moi }: { saisons: SaisonPalmares[]; moi: string }) {
  const [colonne, colonneCollante] = useCollant();
  return (
    <div className="flex flex-col gap-7 px-5 md:grid md:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] md:items-start md:gap-[var(--fib-34)] md:px-0">
      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="mono-label px-1 text-foreground/40">Les saisons</h2>
        {saisons.length === 0 ? (
          <p className="glass-soft rounded-[24px] px-4 py-4 text-[13px] text-muted-foreground">La première saison s&apos;écrit dimanche.</p>
        ) : (
          saisons.map((s) => <CarteSaison key={s.numero} s={s} />)
        )}
      </section>
      <div ref={colonne} className={cn("min-w-0", colonneCollante && "md:sticky md:top-[var(--fib-21)]")}>
        {moi && <Parcours nom={moi} saisons={saisons} />}
      </div>
    </div>
  );
}
