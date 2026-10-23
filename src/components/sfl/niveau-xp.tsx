"use client";

// Mon Niveau XP, sur Ma carte, sous Ma saison (missions, 22/10). Deux
// compteurs à part de la carte : le terrain fait la note et les points
// Pépite ; l'app fait l'XP (lib/sfl/missions.ts) — 100 XP par dimanche joué,
// la prime de chaque mission acceptée et réussie, 150 de plus pour trois sur
// trois ; une mission acceptée puis ratée en reprend la moitié de sa prime
// (en rouge dans le journal).
//   · le Niveau XP, à vie : passer du niveau n au suivant coûte 100 × n ;
//   · le passe de la saison : vingt paliers de 250 XP, remis à zéro à chaque
//     saison, chacun avec sa récompense, qu'on fait défiler ;
//   · les missions réussies, à vie, qui font les crans du cadre de la carte
//     (3, 9, 18, 30) ;
//   · les derniers gains, du plus récent.
// « Niveau XP » et pas « Niveau » : dans les règles BOLA, le Niveau est déjà
// celui de la carte, de 1 à 50.

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { useXp } from "@/hooks/use-missions";
import { CRANS, FAMILLES, PALIERS_PASSE, PASSE, XP_PALIER } from "@/lib/sfl/missions";
import { cn } from "@/lib/utils";

function Barre({ part }: { part: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
      <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.max(0, Math.min(1, part)) * 100}%` }} />
    </div>
  );
}

export function NiveauXp({ saison }: { saison: number }) {
  const b = useXp();
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
        <div ref={rangee} className="flex snap-x scroll-px-4 gap-2 overflow-x-auto scroll-smooth px-4 pb-1 [scrollbar-width:none]">
          {PASSE.map((p) => {
            const atteint = p.n <= b.palier;
            const suivant = p.n === prochain && !atteint;
            return (
              <div
                key={p.n}
                className={cn(
                  "flex h-[112px] w-[96px] shrink-0 snap-start flex-col justify-between rounded-2xl p-2.5",
                  atteint ? "bg-foreground text-background" : suivant ? "bg-secondary ring-1 ring-foreground/40" : "bg-secondary/60"
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="tabular-nums" style={{ fontFamily: ANTON, fontSize: 24, lineHeight: 0.9 }}>
                    {p.n}
                  </span>
                  {atteint && <Check className="size-4" strokeWidth={3} />}
                </span>
                <span className="flex flex-col gap-1">
                  <span className={cn("text-[12.5px] leading-[1.15] font-bold", !atteint && !suivant && "text-foreground/55")}>
                    {p.recompense}
                  </span>
                  <span className={cn("mono-label text-[8.5px]", atteint ? "text-background/55" : "text-foreground/40")}>
                    {FAMILLES[p.famille]}
                  </span>
                </span>
              </div>
            );
          })}
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
