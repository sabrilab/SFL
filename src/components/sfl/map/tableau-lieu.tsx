"use client";

// Le tableau de bord de la page d'un lieu (31/10, d'après les écrans de
// navigation que Sabri a épinglés : un grand chiffre et son anneau, une
// frise de points, une série de pastilles). Trois pièces, posées sous le
// carrousel des matchs du lieu (app/map/page.tsx) :
//
//   · Rebours : le temps jusqu'au coup d'envoi en grand (Anton), et dans un
//     anneau qui se remplit sur la semaine, le nombre de joueurs.
//   · FriseDimanche : la journée en étapes, de la convocation aux votes ;
//     les faites allumées, celle d'aujourd'hui cerclée.
//   · SerieDimanches : tes dimanches J1…Jn, cochés quand tu as joué, et ta
//     série d'affilée.
//
// Une seule couleur qui brille : le vert de Bola (jamais l'or, le bleu ni le
// rouge des cartes MVP, Défensive et Impact).

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const ANTON = "var(--font-anton), Anton, sans-serif";
const VERT = "#84D68C";
const SEMAINE = 7 * 24 * 3600_000;

function useMaintenant(): number | null {
  const [t, setT] = useState<number | null>(null);
  useEffect(() => {
    const f = () => setT(Date.now());
    const a = window.setTimeout(f, 0);
    const b = window.setInterval(f, 60_000);
    return () => {
      window.clearTimeout(a);
      window.clearInterval(b);
    };
  }, []);
  return t;
}

/** Le grand chiffre : ce qu'il reste avant le coup d'envoi, et les joueurs dans l'anneau. */
export function Rebours({ debut, joueurs, libelleJoueurs }: { debut: number | null; joueurs: number; libelleJoueurs: string }) {
  const maintenant = useMaintenant();
  if (debut == null || maintenant == null) return null;
  const reste = debut - maintenant;
  if (reste <= 0) return null;
  const heures = reste / 3600_000;
  const [chiffre, unite] = heures < 1 ? [Math.ceil(reste / 60_000), "min"] : heures < 48 ? [Math.ceil(heures), "h"] : [Math.ceil(heures / 24), "j"];
  const plein = Math.min(1, Math.max(0.04, 1 - reste / SEMAINE));
  const r = 30;
  const tour = 2 * Math.PI * r;
  return (
    <section className="flex items-end justify-between rounded-[26px] bg-card px-5 pt-4 pb-6">
      <div>
        <p className="mono-label text-muted-foreground">Coup d&apos;envoi dans</p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="tabular-nums" style={{ font: `76px/0.86 ${ANTON}` }}>
            {chiffre}
          </span>
          <span className="text-[20px] font-semibold text-muted-foreground">{unite}</span>
        </p>
      </div>
      <div className="relative size-[76px] shrink-0" aria-label={`${joueurs} ${libelleJoueurs.toLowerCase()}`}>
        <svg viewBox="0 0 76 76" className="size-full -rotate-90">
          <circle cx="38" cy="38" r={r} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth="5" strokeDasharray="2 4" />
          <circle
            cx="38"
            cy="38"
            r={r}
            fill="none"
            stroke={VERT}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${tour * plein} ${tour}`}
            style={{ filter: `drop-shadow(0 0 5px ${VERT}88)` }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[24px] leading-none font-bold tabular-nums">{joueurs}</span>
        <span className="mono-label absolute inset-x-[-12px] -bottom-4 text-center text-[8.5px] text-muted-foreground">{libelleJoueurs}</span>
      </div>
    </section>
  );
}

export interface Etape {
  nom: string;
  sous?: string;
  faite: boolean;
}

/** La journée en étapes : allumées quand elles sont faites, la prochaine cerclée. */
export function FriseDimanche({ etapes }: { etapes: Etape[] }) {
  const prochaine = etapes.findIndex((e) => !e.faite);
  return (
    <section className="rounded-[26px] bg-card px-5 py-4">
      <ol className="flex flex-col">
        {etapes.map((e, i) => {
          const ici = i === prochaine;
          return (
            <li key={e.nom} className="relative flex min-h-11 items-start gap-4">
              {i < etapes.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-5 bottom-[-4px] left-[9px] border-l-[1.5px] border-dashed"
                  style={{ borderColor: e.faite ? `${VERT}99` : "color-mix(in oklab, currentColor 18%, transparent)" }}
                />
              )}
              <span
                aria-hidden
                className={cn("relative z-[1] mt-0.5 flex size-[20px] shrink-0 items-center justify-center rounded-full", ici && "ring-[1.5px] ring-offset-[3px] ring-offset-card")}
                style={{
                  background: e.faite ? VERT : ici ? "var(--foreground)" : "color-mix(in oklab, currentColor 16%, transparent)",
                  boxShadow: e.faite ? `0 0 10px ${VERT}88` : undefined,
                  ["--tw-ring-color" as string]: "var(--foreground)",
                }}
              >
                {e.faite && <Check className="size-3 text-[#0a0b0d]" strokeWidth={3.4} />}
              </span>
              <span className="min-w-0 pb-3">
                <span className={cn("block text-[15px] leading-5 font-semibold", !e.faite && !ici && "text-muted-foreground")}>{e.nom}</span>
                {e.sous && <span className="mono-label mt-0.5 block text-[9.5px] text-muted-foreground">{e.sous}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Tes dimanches : joué (coché), manqué (vide), à venir (cerclé), et ta série d'affilée. */
export function SerieDimanches({ jours }: { jours: { j: number; joue: boolean | null }[] }) {
  if (!jours.length) return null;
  const passes = jours.filter((d) => d.joue !== null);
  let serie = 0;
  for (let i = passes.length - 1; i >= 0 && passes[i].joue; i--) serie++;
  return (
    <section className="rounded-[26px] bg-card px-5 py-4">
      <div className="flex items-baseline justify-between">
        <p className="mono-label text-muted-foreground">Ta série</p>
        <p className="flex items-baseline gap-1.5">
          <span className="tabular-nums" style={{ font: `30px/1 ${ANTON}` }}>
            {serie}
          </span>
          <span className="mono-label text-muted-foreground">dimanche{serie > 1 ? "s" : ""} d&apos;affilée</span>
        </p>
      </div>
      <ol className="mt-3 flex justify-between gap-1">
        {jours.map((d) => (
          <li key={d.j} className="flex flex-col items-center gap-1.5">
            <span
              className="flex size-[28px] items-center justify-center rounded-full"
              style={
                d.joue
                  ? { background: VERT, boxShadow: `0 0 10px ${VERT}77` }
                  : d.joue === null
                    ? { border: `2px solid ${VERT}` }
                    : { background: "color-mix(in oklab, currentColor 12%, transparent)" }
              }
            >
              {d.joue && <Check className="size-3.5 text-[#0a0b0d]" strokeWidth={3.4} />}
            </span>
            <span className={cn("font-mono text-[10px] font-bold", d.joue === false && "text-muted-foreground")}>J{d.j}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
