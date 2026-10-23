"use client";

// Mon Niveau XP, sur Ma carte, sous Ma saison (missions, 22/10). Deux
// compteurs à part de la carte : le terrain fait la note et les points
// Pépite ; l'app fait l'XP (lib/sfl/missions.ts) — 100 XP par dimanche joué,
// la prime de chaque mission acceptée et réussie, 150 de plus pour trois sur
// trois ; une mission acceptée puis ratée en reprend la moitié de sa prime
// (en rouge dans le journal).
//   · le Niveau XP, à vie : passer du niveau n au suivant coûte 100 × n ;
//   · le rang, B, A ou S, d'après la place au classement de l'XP à vie
//     (rangsDesJoueurs) : les 10 % de tête S, les 25 % suivants A ;
//   · le passe de la saison : vingt paliers de 250 XP, remis à zéro à chaque
//     saison, chacun avec sa récompense, qu'on fait défiler. On touche un
//     palier pour essayer sa récompense sur sa propre carte, juste dessous ;
//     un palier atteint une saison reste débloqué pour de bon. Une finition
//     ou un traitement de la photo débloqué se porte ou se retire (profiles.
//     habillage) ; un signe se pose d'office (use-habillage.ts) ;
//   · les missions réussies, à vie, qui font les crans du cadre de la carte
//     (3, 9, 18, 30) ;
//   · les derniers gains, du plus récent.
// « Niveau XP » et pas « Niveau » : dans les règles BOLA, le Niveau est déjà
// celui de la carte, de 1 à 50.

import { useEffect, useRef, useState } from "react";
import { Check, Lock } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { Insigne } from "@/components/sfl/actus/missions";
import type { HabillageCarte } from "@/components/sfl/finitions-carte";
import { PlayerCard } from "@/components/sfl/player-card";
import { Button } from "@/components/ui/button";
import { useChoixHabillage, useHabillage, usePalierMax } from "@/hooks/use-habillage";
import { useRangXp, useXp } from "@/hooks/use-missions";
import type { Player } from "@/lib/sfl/engine";
import { choisirHabillage, type ChoixHabillage } from "@/lib/sfl/habillages-choisis";
import { CRANS, FAMILLES, PALIERS_PASSE, PASSE, XP_PALIER, type Palier, type RangJoueur } from "@/lib/sfl/missions";
import { cn } from "@/lib/utils";

const eme = (n: number) => (n === 1 ? "1re" : `${n}e`);

/** Mon rang, B, A ou S, d'après ma place au classement de l'XP à vie. */
function RangXp({ r }: { r: RangJoueur }) {
  return (
    <div className={cn(`fiche--${r.rang}`, "glass flex items-center gap-4 rounded-[22px] px-4 py-3")}>
      <Insigne rang={r.rang} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="fiche__ton text-[15px] font-bold">Rang {r.rang}</span>
        <span className="font-mono text-[12px] text-foreground/55 tabular-nums">
          {r.xp > 0 ? `${eme(r.place)} sur ${r.sur} en XP à vie` : "Hors classement"}
        </span>
        {r.suivant && (
          <span className="mono-label text-[9px] text-foreground/45">
            Rang {r.suivant.rang} : {r.suivant.place === 1 ? "le premier" : `les ${r.suivant.place} premiers`}
          </span>
        )}
      </div>
    </div>
  );
}

/** Ma carte telle qu'elle serait avec la récompense du palier, en plus de ce que je porte. */
function essai(porte: HabillageCarte, p: Palier): HabillageCarte {
  const h = p.habille;
  if (h?.finition) return { ...porte, finition: h.finition };
  if (h?.traitement) return { ...porte, traitement: h.traitement };
  if (h?.signe) return { ...porte, signes: [...new Set([...(porte.signes ?? []), h.signe])] };
  return porte;
}

/** Porter ou retirer une récompense débloquée ; sinon, où elle en est. */
function Porter({ p, ouvert, porte, choix, nom }: { p: Palier; ouvert: boolean; porte: HabillageCarte; choix: ChoixHabillage; nom: string }) {
  const h = p.habille;
  if (!ouvert) return <span className="mono-label text-[9px] text-foreground/45">Au palier {p.n}</span>;
  if (h?.finition || h?.traitement) {
    const portee = h.finition ? porte.finition === h.finition : porte.traitement === h.traitement;
    const suivant: ChoixHabillage = h.finition
      ? { ...choix, finition: portee ? "-" : h.finition }
      : { ...choix, traitement: portee || !h.traitement ? "-" : h.traitement };
    return (
      <Button variant={portee ? "destructive" : "or"} onClick={() => void choisirHabillage(nom, suivant)}>
        {portee ? "Retirer" : "Porter"}
      </Button>
    );
  }
  return <span className="mono-label text-[9px] text-foreground/45">{h?.signe ? "Sur ta carte" : "Débloqué"}</span>;
}

function Barre({ part }: { part: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
      <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.max(0, Math.min(1, part)) * 100}%` }} />
    </div>
  );
}

export function NiveauXp({ saison, player }: { saison: number; player: Player }) {
  const b = useXp(player.name);
  const rangXp = useRangXp(player.name);
  const palierMax = usePalierMax(player.name);
  const porte = useHabillage(player.name);
  const choix = useChoixHabillage(player.name);
  const [choisi, setChoisi] = useState<number | null>(null);
  const rangee = useRef<HTMLDivElement>(null);
  const palier = b?.palier ?? 0;
  // Le passe s'ouvre sur le dernier palier atteint, pas sur le premier.
  useEffect(() => {
    const r = rangee.current;
    const el = r?.children[Math.max(0, Math.min(PALIERS_PASSE - 1, palier) - 1)] as HTMLElement | undefined;
    if (r && el) r.scrollLeft += el.getBoundingClientRect().left - r.getBoundingClientRect().left - 16;
  }, [palier]);
  if (!b) return null;
  const prochain = Math.min(PALIERS_PASSE, b.palier + 1);
  // L'essai s'ouvre sur le prochain palier : ce que je peux gagner.
  const vu = PASSE.find((p) => p.n === (choisi ?? prochain)) ?? PASSE[0];
  const crans = CRANS.filter((c) => b.reussies >= c).length;
  const versCran = CRANS.find((c) => b.reussies < c);

  return (
    <section aria-labelledby="niveau-xp" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h2 id="niveau-xp" className="mono-label text-muted-foreground">
          Niveau XP
        </h2>
        <span className="font-mono text-[12px] font-bold text-foreground/45">{b.total} XP à vie</span>
      </div>

      <div className="glass flex items-center gap-4 rounded-[22px] px-4 py-[var(--fib-13)]">
        <span className="w-[58px] text-center tabular-nums" style={{ fontFamily: ANTON, fontSize: 58, lineHeight: 0.85 }}>
          {b.niveau}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[15px] font-bold">Vers le niveau {b.niveau + 1}</span>
            <span className="font-mono text-[12px] text-foreground/55 tabular-nums">
              {b.dansLeNiveau} / {b.pourLeSuivant}
            </span>
          </div>
          <Barre part={b.dansLeNiveau / b.pourLeSuivant} />
        </div>
      </div>

      {rangXp && <RangXp r={rangXp} />}

      <div className="glass flex flex-col gap-3 overflow-hidden rounded-[22px] py-[var(--fib-13)]">
        <div className="flex flex-col gap-2 px-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="mono-label text-muted-foreground">Passe · saison {saison}</span>
            <span className="font-mono text-[12px] font-bold tabular-nums">
              {b.palier} / {PALIERS_PASSE}
            </span>
          </div>
          {b.palier < PALIERS_PASSE && (
            <>
              <Barre part={b.versPalier / XP_PALIER} />
              <span className="mono-label text-[9px] text-foreground/45">
                Palier {prochain} à {b.manquePalier} XP
              </span>
            </>
          )}
        </div>
        <div ref={rangee} className="flex snap-x scroll-px-4 gap-2 overflow-x-auto scroll-smooth px-4 py-1 [scrollbar-width:none]">
          {PASSE.map((p) => {
            const atteint = p.n <= b.palier;
            // Débloqué une saison d'avant : acquis, même si la saison en cours n'y est pas.
            const acquis = !atteint && p.n <= palierMax;
            const suivant = p.n === prochain && !atteint;
            return (
              <button
                key={p.n}
                type="button"
                aria-pressed={p.n === vu.n}
                onClick={() => setChoisi(p.n)}
                className={cn(
                  "flex h-[112px] w-[96px] shrink-0 snap-start flex-col justify-between rounded-2xl p-2.5 text-left outline-offset-2",
                  atteint
                    ? "bg-foreground text-background"
                    : acquis || suivant
                      ? "bg-secondary ring-1 ring-foreground/40"
                      : "bg-secondary/60",
                  p.n === vu.n && "outline-2 outline-foreground"
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="tabular-nums" style={{ fontFamily: ANTON, fontSize: 24, lineHeight: 0.9 }}>
                    {p.n}
                  </span>
                  {atteint || acquis ? (
                    <Check className="size-4" strokeWidth={3} />
                  ) : (
                    <Lock className="size-3.5 text-foreground/35" strokeWidth={2.5} />
                  )}
                </span>
                <span className="flex flex-col gap-1">
                  <span
                    className={cn("text-[12.5px] leading-[1.15] font-bold", !atteint && !acquis && !suivant && "text-foreground/55")}
                  >
                    {p.recompense}
                  </span>
                  <span className={cn("mono-label text-[8.5px]", atteint ? "text-background/55" : "text-foreground/40")}>
                    {FAMILLES[p.famille]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* L'essai : ma carte avec la récompense du palier touché. */}
        <div className="flex items-center gap-4 border-t border-white/8 px-4 pt-[var(--fib-13)]">
          <div className="shrink-0">
            <PlayerCard player={player} size={0.7} habillage={essai(porte, vu)} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <span className="mono-label text-[9px] text-foreground/45">
              Palier {vu.n} · {FAMILLES[vu.famille]}
            </span>
            <span className="text-[17px] leading-[1.15] font-bold">{vu.recompense}</span>
            <Porter p={vu} ouvert={vu.n <= palierMax} porte={porte} choix={choix} nom={player.name} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1.5 rounded-2xl bg-secondary px-3 pt-3 pb-2.5">
          <span className="text-[26px] leading-none font-black tracking-[-1px] italic tabular-nums">{b.reussies}</span>
          <span className="text-[12px] font-semibold">{b.reussies > 1 ? "Missions accomplies" : "Mission accomplie"}</span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-2xl bg-secondary px-3 pt-3 pb-2.5">
          <span className="flex h-[26px] items-center gap-1">
            {CRANS.map((c, i) => (
              <span key={c} className={cn("h-[18px] w-[7px] rounded-[2px]", i < crans ? "bg-foreground" : "bg-foreground/15")} />
            ))}
          </span>
          <span className="text-[12px] font-semibold">Cadre de ta carte</span>
          <span className="font-mono text-[10.5px] leading-tight text-muted-foreground">
            {versCran ? `${b.reussies} / ${versCran}` : "Complet"}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-2xl bg-secondary px-3 pt-3 pb-2.5">
          <span className="text-[26px] leading-none font-black tracking-[-1px] italic tabular-nums">{b.saison}</span>
          <span className="text-[12px] font-semibold">XP cette saison</span>
        </div>
      </div>

      {b.lignes.length > 0 && (
        <div className="glass flex flex-col overflow-hidden rounded-[22px]">
          {b.lignes.slice(0, 4).map((l, i) => (
            <div
              key={`${l.saison}-${l.j}-${l.quoi}`}
              className={cn("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-contraste/8")}
            >
              <span className="w-[44px] shrink-0 font-mono text-[11px] text-foreground/45">
                {l.saison === saison ? `J${l.j}` : `S${l.saison} J${l.j}`}
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{l.quoi}</span>
              <span className={cn("font-mono text-[13px] font-bold tabular-nums", l.xp < 0 && "text-[#c8352b] dark:text-[#ff9b9d]")}>
                {l.xp < 0 ? `−${-l.xp}` : `+${l.xp}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
