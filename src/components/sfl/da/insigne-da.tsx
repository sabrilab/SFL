"use client";

// L'insigne du rang et le viseur dans les DA à l'essai (lib/sfl/da.ts). La DA
// en ligne (0) garde son hexagone et ses coins de mire (actus/missions.tsx).
//   1. Titre : un sceau guilloché, la lettre au centre, un anneau de
//      microtexte ; le viseur devient les traits de coupe et les mires de
//      repérage de l'imprimeur, la cible d'une feuille qu'on imprime ;
//   2. Lune : le symbole Bola, le croissant, la lettre dans la balle ; le
//      viseur devient l'orbite de la balle autour de la carte ;
//   3. Dossier : un tampon rond, « classé », encré de travers ; le viseur
//      devient la toise et le cadre d'une fiche signalétique ;
//   4. Affiche : la lettre en très grand, en aplat ; le viseur, quatre
//      équerres épaisses.
// Les couleurs viennent du rang (fiche--S, --A, --B : actus/missions.css).

import { useId } from "react";
import type { EtatViseur } from "@/components/sfl/actus/missions";
import { LOGO_BOLA } from "@/components/sfl/finitions-carte";
import type { Da } from "@/lib/sfl/da";
import type { Rang } from "@/lib/sfl/missions";
import { cn } from "@/lib/utils";

const f = (n: number) => Math.round(n * 100) / 100;

/** La rosace du sceau : des cercles ondulés qui se croisent entre r1 et r2 (comme RosaceBola, en petit). */
const ROSACE = (() => {
  const traits: string[] = [];
  const brins = 10;
  for (let i = 0; i < brins; i++) {
    const phase = (i / brins) * Math.PI * 2;
    let d = "";
    for (let k = 0; k <= 96; k++) {
      const t = (k / 96) * Math.PI * 2;
      const r = 23 + 7 * Math.sin(7 * t + phase) * Math.cos(t * 2 + phase / 3);
      d += `${k === 0 ? "M" : "L"}${f(50 + r * Math.cos(t))} ${f(50 + r * Math.sin(t))}`;
    }
    traits.push(d + "Z");
  }
  return traits.join("");
})();

// Le symbole dans sa boîte de 112,373 (finitions-carte.ts, dos-carte.tsx) : le disque
// est centré en (73,186 ; 159,672), la balle en (86,45 ; 181,133), de rayon 34,725.
const S_LUNE = 84 / 112.373;
const LUNE = {
  transform: `translate(${f(50 - 73.186 * S_LUNE)} ${f(50 - 159.672 * S_LUNE)}) scale(${f(S_LUNE)})`,
  balle: { x: f(50 + (86.45 - 73.186) * S_LUNE), y: f(50 + (181.133 - 159.672) * S_LUNE) },
};

export function InsigneDa({ rang, da }: { rang: Rang; da: Exclude<Da, 0> }) {
  const id = useId().replace(/:/g, "");
  if (da === 1)
    return (
      <span className="insigne-da insigne-da--1" aria-hidden>
        <svg viewBox="0 0 100 100">
          <defs>
            <path id={`${id}a`} d="M50 50m-38.5 0a38.5 38.5 0 1 1 77 0a38.5 38.5 0 1 1 -77 0" />
          </defs>
          <g fill="none" stroke="currentColor">
            <circle cx="50" cy="50" r="48" strokeWidth="1.6" />
            <circle cx="50" cy="50" r="45" strokeWidth="0.6" />
            <circle cx="50" cy="50" r="33" strokeWidth="0.8" />
            <path d={ROSACE} strokeWidth="0.45" opacity="0.7" />
          </g>
          <text className="insigne-da__micro" fill="currentColor">
            <textPath href={`#${id}a`} textLength="241" lengthAdjust="spacing">
              {`RANG ${rang} · BOLA · CONTRAT · RANG ${rang} · BOLA · CONTRAT ·`}
            </textPath>
          </text>
          <circle cx="50" cy="50" r="16.5" fill="#070708" stroke="currentColor" strokeWidth="1.2" />
          <text x="50" y="50" dy="0.36em" textAnchor="middle" className="insigne-da__lettre">
            {rang}
          </text>
        </svg>
      </span>
    );
  if (da === 2)
    return (
      <span className="insigne-da insigne-da--2" aria-hidden>
        <svg viewBox="0 0 100 100">
          <defs>
            <linearGradient id={`${id}g`} x1="0" y1="0" x2="0.7" y2="1">
              <stop offset="0" style={{ stopColor: "rgb(var(--r-feu))" }} />
              <stop offset="0.55" style={{ stopColor: "rgb(var(--r-lueur))" }} />
              <stop offset="1" style={{ stopColor: "var(--r-sombre)" }} />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="none" stroke="rgb(var(--r-lueur) / 0.35)" strokeWidth="0.8" strokeDasharray="1 3" />
          <path d={LOGO_BOLA.symbole} transform={LUNE.transform} fill={`url(#${id}g)`} />
          <text x={LUNE.balle.x} y={LUNE.balle.y} dy="0.36em" textAnchor="middle" className="insigne-da__lettre">
            {rang}
          </text>
        </svg>
      </span>
    );
  if (da === 3)
    return (
      <span className="insigne-da insigne-da--3" aria-hidden>
        <svg viewBox="0 0 100 100">
          <defs>
            <path id={`${id}a`} d="M50 50m-35 0a35 35 0 1 1 70 0a35 35 0 1 1 -70 0" />
            <filter id={`${id}f`} x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
              <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 2.1" />
              <feComposite in="SourceGraphic" operator="in" />
            </filter>
          </defs>
          <g transform="rotate(-11 50 50)" filter={`url(#${id}f)`}>
            <g fill="none" stroke="currentColor">
              <circle cx="50" cy="50" r="46" strokeWidth="3" />
              <circle cx="50" cy="50" r="41.5" strokeWidth="1" />
              <circle cx="50" cy="50" r="27" strokeWidth="1.2" />
            </g>
            <text className="insigne-da__micro insigne-da__micro--3" fill="currentColor">
              <textPath href={`#${id}a`} textLength="214" lengthAdjust="spacing">
                {`CLASSÉ · RANG ${rang} · CLASSÉ · RANG ${rang} ·`}
              </textPath>
            </text>
            <text x="50" y="50" dy="0.36em" textAnchor="middle" className="insigne-da__lettre" fill="currentColor">
              {rang}
            </text>
          </g>
        </svg>
      </span>
    );
  return (
    <span className="insigne-da insigne-da--4" aria-hidden>
      <span className="insigne-da__rang">Rang</span>
      <span className="insigne-da__grand">{rang}</span>
    </span>
  );
}

/** Le viseur d'une DA à l'essai : les états et leurs couleurs restent ceux de fiche__viseur. */
export function ViseurDa({ etat, petit, da }: { etat: EtatViseur; petit?: boolean; da: Exclude<Da, 0> }) {
  const classes = cn("fiche__viseur", `fiche__viseur--${etat}`, petit && "fiche__viseur--petit", `viseur-da viseur-da--${da}`);
  if (da === 1)
    return (
      <span key={etat} className={classes} aria-hidden>
        {["hg", "hd", "bg", "bd"].map((c) => (
          <i key={c} className={`v-coupe v-coupe--${c}`} />
        ))}
        <i className="v-mire v-mire--h" />
        <i className="v-mire v-mire--b" />
      </span>
    );
  if (da === 2)
    return (
      <span key={etat} className={classes} aria-hidden>
        <i className="v-orbite" />
        <i className="v-balle" />
      </span>
    );
  if (da === 3)
    return (
      <span key={etat} className={classes} aria-hidden>
        <i className="v-cadre" />
        <i className="v-toise v-toise--g" />
        <i className="v-toise v-toise--b" />
      </span>
    );
  return (
    <span key={etat} className={classes} aria-hidden>
      {["hg", "hd", "bg", "bd"].map((c) => (
        <i key={c} className={`v-equerre v-equerre--${c}`} />
      ))}
    </span>
  );
}
