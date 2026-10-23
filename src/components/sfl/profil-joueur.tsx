"use client";

// Le profil d'un autre joueur, ouvert depuis la Recherche (Sabri, 19/10 :
// « qu'on puisse voir ce qu'il a fait, ce qu'il a eu, qu'il soit un peu plus
// mis en avant »).
//
// Ordre de lecture, du plus fort au plus fin :
//   1. lui : sa carte en grand, son nom dans le lettrage de la Map, ses
//      abonnés comme sur Instagram (ses abonnés et ses abonnements, « Suivi
//      par Kader, Anis et 3 autres que tu connais » : suivre.tsx), le bouton
//      pour le suivre, et trois chiffres de tête en Anton (son rang au Pépite
//      d'Or, sa note, ses dimanches) ;
//   2. une phrase qui le résume (fiche-joueur.ts, la même que sur la feuille
//      de match) ;
//   3. ses trophées, sur un panneau noir mat sans décor : d'abord les
//      écussons de fin de saison (fin-de-saison.ts), puis les médailles de
//      palier gagnées (trophees.ts), les plus hautes d'abord. Seul le métal
//      sort du noir et blanc. Toucher un trophée ouvre sa feuille : ses
//      marches ou ses podiums, et qui d'autre l'a ;
//   4. ses points forts et ses faits marquants de la saison ;
//   5. ses cartes, saison par saison (la carte de la saison et les cartes
//      spéciales débloquées), et sa courbe : la note de sa carte ou son rang
//      au Pépite d'Or, journée après journée (carriere.ts) ;
//   6. son parcours, saison après saison (palmares.ts, comme le Wall of Fame) ;
//   7. son profil de jeu, sa forme et ses dimanches.
// Sous son nom, « Comparer avec ma carte » ouvre les deux cartes face à face,
// avec le radar des deux profils de jeu superposés (comparer-cartes.tsx).
// Une section sans rien à montrer ne s'affiche pas. Rien n'est stocké : tout
// vient de la saison déjà en mémoire.

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Card3D } from "@/components/sfl/card-3d";
import { CartesCarriere, CourbeCarriere } from "@/components/sfl/carriere-joueur";
import { ComparerCartes } from "@/components/sfl/comparer-cartes";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { PlayerCard } from "@/components/sfl/player-card";
import { useSeason } from "@/components/sfl/season-provider";
import { BoutonSuivre, ReseauJoueur } from "@/components/sfl/suivre";
import { FeuilleBadge, Medaille, NOM_TROPHEE, Trophee } from "@/components/sfl/vitrine";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useGrandEcran } from "@/hooks/use-media-query";
import { useIdentites } from "@/hooks/use-identites";
import { useRangXp, useXp } from "@/hooks/use-missions";
import { cartesDeCarriere, courbeDeCarriere } from "@/lib/sfl/carriere";
import { ovr, rankPlayers, STAT_KEYS, type Player } from "@/lib/sfl/engine";
import { isHidden } from "@/lib/sfl/hidden";
import { ficheJoueur } from "@/lib/sfl/fiche-joueur";
import { finsDeSaison, ordinal, type ClassementId } from "@/lib/sfl/fin-de-saison";
import { POSTES } from "@/lib/sfl/inscription";
import { parcours, saisonsPalmares } from "@/lib/sfl/palmares";
import { metal, NOM_METAL, vitrine, type TropheeId } from "@/lib/sfl/trophees";
import { cn } from "@/lib/utils";

const ANTON = "var(--font-anton), Anton, sans-serif";

type Choix = { famille: "palier"; id: TropheeId } | { famille: "saison"; id: ClassementId } | null;

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="mono-label w-8 shrink-0 text-foreground/40">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
        <span className="block h-full rounded-full bg-foreground/80" style={{ width: `${Math.min(100, value)}%` }} />
      </span>
      <span className="w-7 shrink-0 text-right text-[13px] font-bold tabular-nums">{value}</span>
    </div>
  );
}

/** Un chiffre de tête, sous le nom (Ma carte s'en sert aussi). */
export function Chiffre({ valeur, quoi }: { valeur: string | number; quoi: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-[var(--fib-8)]">
      <span style={{ fontFamily: ANTON, fontSize: 34, lineHeight: 0.9 }} className="tabular-nums">
        {valeur}
      </span>
      <span className="mono-label text-[9px] text-foreground/45">{quoi}</span>
    </div>
  );
}

export function ProfilJoueur({ player, rank }: { player: Player; rank: number }) {
  const { saison, journees, allPlayers } = useSeason();
  const grand = useGrandEcran();
  const identite = useIdentites();
  const [choix, setChoix] = useState<Choix>(null);
  const [compare, setCompare] = useState(false);
  const { me } = useMyPlayer();
  const moi = me && me !== player.name ? allPlayers.find((p) => p.name === me) : undefined;
  // Les rangs de la comparaison : le classement public, plus soi-même s'on est masqué.
  const rangs = useMemo(
    () => new Map(rankPlayers(allPlayers.filter((p) => p.matchs > 0 && (!isHidden(p.name) || p.name === me))).map((p) => [p.name, p.rank])),
    [allPlayers, me]
  );
  const cartes = useMemo(() => cartesDeCarriere(saison, player.name), [saison, player.name]);
  const courbe = useMemo(() => courbeDeCarriere(saison, player.name), [saison, player.name]);

  const fiche = useMemo(() => ficheJoueur(saison, player, allPlayers), [saison, player, allPlayers]);
  const ecussons = useMemo(
    () =>
      finsDeSaison(saison, player.name, allPlayers)
        .filter((e) => e.meilleur)
        .sort((a, b) => a.meilleur!.rang - b.meilleur!.rang),
    [saison, player.name, allPlayers]
  );
  const medailles = useMemo(
    () =>
      vitrine(saison, player.name, new Date())
        .filter((e) => e.palier > 0)
        .sort((a, b) => b.palier - a.palier || b.valeur - a.valeur),
    [saison, player.name]
  );
  const etapes = useMemo(() => parcours(saisonsPalmares(saison), player.name), [saison, player.name]);

  const mine = useMemo(
    () =>
      saison.entries
        .filter((e) => e.player === player.name && !e.extraTime && e.statut === "Présent")
        .sort((a, b) => a.j - b.j),
    [saison.entries, player.name]
  );
  // Un dimanche peut compter plusieurs matchs : on compte les dimanches.
  const dimanches = new Set(mine.map((e) => e.j)).size;
  const forme = mine
    .filter((e) => e.result)
    .slice(-5)
    .map((e) => (e.result === "Victoire" ? "V" : e.result === "Nul" ? "N" : "D"));
  const dates = new Map(journees.map((j) => [j.j, j.date]));
  const poste = POSTES.find((p) => p.id === player.poste)?.label ?? player.poste;
  const trophees = ecussons.reduce((n, e) => n + e.podiums.length, 0) + medailles.length;
  const xp = useXp(player.name);
  const rangXp = useRangXp(player.name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="grille-or grid grid-cols-1 gap-[var(--fib-21)]"
    >
      {/* 1. Lui */}
      <div className="colonne-fixe flex min-w-0 flex-col items-center gap-[var(--fib-21)]">
        <Card3D
          cacheKey={`recherche-${player.name}`}
          mode="simple"
          size={grand ? 1.05 : 0.8}
          render={(s) => <PlayerCard player={player} size={s} />}
        />
        <div className="flex w-full flex-col items-center gap-[var(--fib-8)] text-center">
          <h2 className="titre-lettrage text-[34px] leading-[0.95] break-words">
            {identite.nom(player.name)}
          </h2>
          <p className="font-mono text-[12px] text-foreground/45">
            {identite.pseudo(player.name)} · {poste.toLowerCase()}
            {xp && ` · niveau XP ${xp.niveau}`}
            {rangXp && ` · rang ${rangXp.rang}`}
          </p>
          <ReseauJoueur nom={player.name} className="mt-[var(--fib-8)]" />
          <BoutonSuivre nom={player.name} className="mt-[var(--fib-8)]" />
        </div>
        <div className="flex w-full items-stretch divide-x divide-foreground/10 border-y border-foreground/10 py-[var(--fib-13)]">
          <Chiffre valeur={ordinal(rank)} quoi="Pépite d'Or" />
          <Chiffre valeur={ovr(player.stats)} quoi="Général" />
          <Chiffre valeur={dimanches} quoi={dimanches > 1 ? "Dimanches" : "Dimanche"} />
        </div>
        <p className="w-full text-[19px] leading-[1.25] font-bold tracking-[-0.4px]">{fiche.synthese}</p>
        {moi && (
          <button
            type="button"
            onClick={() => setCompare(true)}
            className="bouton-principal bouton--or flex h-12 w-full items-center justify-center text-[15px] font-semibold"
          >
            Comparer avec ma carte
          </button>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-[var(--fib-21)]">
        {/* 3. Ses trophées : noir mat, seul le métal sort du noir et blanc */}
        {trophees > 0 && (
          <section
            aria-labelledby="trophees"
            className="flex flex-col gap-[var(--fib-21)] rounded-[21px] border border-white/[0.08] bg-[#0a0a0b] p-[var(--fib-21)] text-white"
          >
            <div className="flex items-baseline justify-between">
              <h3 id="trophees" className="text-[19px] font-extrabold tracking-tight">
                Trophées
              </h3>
              <span className="font-mono text-[12px] font-bold text-white/45 tabular-nums">{trophees}</span>
            </div>

            {ecussons.length > 0 && (
              <div className="flex flex-col gap-[var(--fib-13)]">
                {ecussons.map((e) => (
                  <button
                    key={e.def.id}
                    type="button"
                    onClick={() => setChoix({ famille: "saison", id: e.def.id })}
                    className="flex items-center gap-[var(--fib-13)] text-left transition-transform active:scale-[0.98] motion-reduce:transition-none"
                  >
                    <Trophee id={e.def.id} rang={e.meilleur!.rang} taille={84} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-[17px] font-extrabold">{NOM_TROPHEE[e.def.id]}</span>
                      <span className="font-mono text-[11px] text-white/55">
                        {e.podiums.map((p) => `${ordinal(p.rang)} · ${p.saison}`).join("  ·  ")}
                      </span>
                    </span>
                    {e.podiums.length > 1 && (
                      <span style={{ fontFamily: ANTON, fontSize: 34, lineHeight: 0.9 }} className="shrink-0 tabular-nums">
                        ×{e.podiums.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {ecussons.length > 0 && medailles.length > 0 && <span aria-hidden className="h-px w-full bg-white/10" />}

            {medailles.length > 0 && (
              <div className="grid grid-cols-4 gap-x-1 gap-y-[var(--fib-21)] sm:grid-cols-5">
                {medailles.map((e) => (
                  <button
                    key={e.def.id}
                    type="button"
                    onClick={() => setChoix({ famille: "palier", id: e.def.id })}
                    className="flex flex-col items-center gap-1.5 text-center transition-transform active:scale-95 motion-reduce:transition-none"
                  >
                    <Medaille e={e} diametre={52} />
                    <span className="w-full text-[12px] leading-tight font-bold">{e.def.nom}</span>
                    <span className="font-mono text-[12px] font-bold tabular-nums">{e.valeur}</span>
                    <span className="text-[11px] font-semibold text-white/55">{NOM_METAL[metal(e.palier)!]}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 5. Ses cartes, saison par saison, et sa courbe */}
        {cartes.length > 0 && <CartesCarriere saisons={cartes} />}
        <CourbeCarriere points={courbe} />

        {/* 4. Sa saison : points forts et faits marquants */}
        {fiche.forts.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {fiche.forts.map((f) => (
              <div key={f.rang} className="flex flex-col gap-1.5 rounded-2xl bg-secondary px-3 pt-3 pb-2.5">
                <span className="text-[26px] leading-none font-black tracking-[-1px] italic tabular-nums">{f.chiffre}</span>
                <span className="text-[12px] font-semibold">{f.quoi}</span>
                <span className="font-mono text-[10.5px] leading-tight text-muted-foreground">{f.rang}</span>
              </div>
            ))}
          </div>
        )}

        {fiche.faits.length > 0 && (
          <section className="flex flex-col gap-2.5 px-1">
            <h3 className="mono-label text-muted-foreground">Faits marquants</h3>
            {fiche.faits.map((f) => (
              <div key={f.quand + f.quoi} className="flex items-baseline gap-3">
                <span className="w-[34px] shrink-0 font-mono text-[11px] font-bold text-muted-foreground">{f.quand}</span>
                <span className="text-[15px] font-semibold">{f.quoi}</span>
              </div>
            ))}
          </section>
        )}

        {/* 6. Son parcours, saison après saison */}
        {etapes.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h3 className="mono-label px-1 text-muted-foreground">Parcours</h3>
            <div className="glass overflow-hidden rounded-[22px]">
              {etapes.map((e, i) => (
                <div
                  key={e.saison.numero}
                  className={cn("flex items-center gap-[var(--fib-13)] px-4 py-3", i < etapes.length - 1 && "border-b border-white/8")}
                >
                  <span style={{ fontFamily: ANTON, fontSize: 30, lineHeight: 0.9 }} className="w-[58px] shrink-0 tabular-nums">
                    {ordinal(e.rang)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">
                      {e.saison.nom}
                      {!e.saison.cloturee && <span className="font-normal text-foreground/45"> · en cours</span>}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-foreground/45">
                      sur {e.sur} · {e.bilan.victoires}V {e.bilan.nuls}N {e.bilan.defaites}D
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-mono text-[12px] text-foreground/70 tabular-nums">
                    {e.player.buts} b · {e.player.passes} p
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 7. Son jeu */}
        <section className="glass flex flex-col gap-2.5 rounded-[26px] px-[18px] py-[17px]">
          <p className="mono-label text-foreground/40">Profil de jeu</p>
          {STAT_KEYS.map((k) => (
            <StatBar key={k} label={k} value={player.stats[k]} />
          ))}
        </section>

        {forme.length > 0 && (
          <div className="glass-soft flex items-center justify-between rounded-[20px] px-4 py-3">
            <span className="mono-label text-foreground/40">Forme · 5 derniers</span>
            <span className="flex gap-1.5">
              {forme.map((r, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[11px] font-bold",
                    r === "V" ? "bg-primary text-primary-foreground" : r === "N" ? "bg-white/12 text-foreground/70" : "bg-white/6 text-foreground/35"
                  )}
                >
                  {r}
                </span>
              ))}
            </span>
          </div>
        )}

        {mine.length > 0 && (
          <section>
            <h3 className="mono-label mb-2.5 px-1 text-muted-foreground">Dimanche par dimanche</h3>
            <div className="glass overflow-hidden rounded-[22px]">
              {mine.map((e, i) => (
                <div
                  key={e.j}
                  className={cn("flex items-center gap-3 px-4 py-2.5 text-[13px]", i < mine.length - 1 && "border-b border-white/8")}
                >
                  <span className="mono-label w-7 shrink-0 text-foreground/40">J{e.j}</span>
                  <span className="min-w-0 flex-1 truncate text-foreground/45">{dates.get(e.j) ?? ""}</span>
                  <span className="shrink-0 tabular-nums text-foreground/70">
                    {e.buts}⚽ {e.passes}🅰
                  </span>
                  <span
                    className={cn(
                      "w-5 shrink-0 text-right font-bold",
                      e.result === "Victoire" ? "text-primary" : e.result === "Nul" ? "text-foreground/50" : "text-foreground/30"
                    )}
                  >
                    {e.result ? e.result[0] : "–"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <Sheet open={!!choix} onOpenChange={(o) => !o && setChoix(null)}>
        <SheetContent side="bottom" className="mx-auto max-h-[90vh] w-full overflow-y-auto rounded-t-[28px] px-5 pt-6 pb-8 sm:max-w-md">
          {choix && <FeuilleBadge nom={player.name} badge={choix} />}
        </SheetContent>
      </Sheet>

      <Sheet open={compare} onOpenChange={setCompare}>
        <SheetContent side="bottom" className="mx-auto max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] px-5 pt-6 pb-8 sm:max-w-md">
          <SheetTitle className="sr-only">Comparer avec ma carte</SheetTitle>
          <SheetDescription className="sr-only">Ta carte et celle de {identite.nom(player.name)}, face à face.</SheetDescription>
          {compare && moi && <ComparerCartes moi={moi} lui={player} rangs={rangs} />}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
