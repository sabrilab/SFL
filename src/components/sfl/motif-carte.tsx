"use client";

// Les motifs gravés des matières de carte (finitions-carte.ts), en SVG dans
// le repère de la carte (1024 × 1656), étirés sur toute la carte : ils
// restent nets à toutes les tailles et passent tels quels dans la capture de
// la 3D (html-to-image), sans image à charger. Chaque trait est doublé d'une
// ombre décalée de 3 : gravé, pas imprimé.
//   · rayons : la gloire du MVP, des pointes qui partent du portrait ;
//   · ondes : l'onde de choc d'Impact, des cercles de plus en plus espacés ;
//   · alvéoles : la cotte de mailles de la Défensive, en hexagones ;
//   · étoiles : le ciel de la finition nuit, tiré de la graine du joueur ;
//     les étincelles seulement au dos (sur la face, elles tombaient sur le
//     texte) ;
//   · guilloché : les bandes de l'onyx, deux familles de vagues en
//     opposition de phase et de longueurs d'onde voisines, qui
//     s'entrelacent en chaînes puis se rejoignent (une moire, comme sur le
//     revers d'un smoking).
// Et la rosace guillochée du dos (RosaceBola), comme sur un billet.

import { Fragment, useId } from "react";
import type { Motif } from "@/components/sfl/finitions-carte";

const W = 1024;
const H = 1656;
const R_LOIN = 2400;

const f = (n: number) => Math.round(n * 10) / 10;

/** Les pointes des rayons : n triangles fins autour de (cx, cy). */
function rayons(cx: number, cy: number, n: number, part: number, decalage: number): string {
  const pas = (Math.PI * 2) / n;
  let d = "";
  for (let i = 0; i < n; i++) {
    const a0 = i * pas + decalage;
    const a1 = a0 + pas * part;
    d += `M${f(cx)} ${f(cy)}L${f(cx + R_LOIN * Math.cos(a0))} ${f(cy + R_LOIN * Math.sin(a0))}L${f(cx + R_LOIN * Math.cos(a1))} ${f(cy + R_LOIN * Math.sin(a1))}Z`;
  }
  return d;
}

/** Les rayons des ondes : serrées près du centre, de plus en plus espacées. */
function rayonsOndes(): number[] {
  const r: number[] = [];
  for (let k = 0; ; k++) {
    const v = 46 + 30 * k + 1.1 * k * k;
    if (v > 1900) break;
    r.push(v);
  }
  return r;
}

// Le guilloché de l'onyx : le pas entre deux vagues, leur amplitude, et les
// deux longueurs d'onde (leur écart fait la moire, d'une chaîne à l'autre).
const GUILLOCHE = { pas: 30, amplitude: 13, longueurs: [168, 186] } as const;

/**
 * Une famille de vagues, pour une tuile d'une longueur d'onde de large et
 * d'un pas de haut : la vague de la tuile, qui déborde un peu à gauche et à
 * droite pour que le trait ne s'arrête pas net au raccord.
 */
function vagues(longueur: number, phase: number): string {
  const { pas, amplitude } = GUILLOCHE;
  const n = 28;
  let d = "";
  for (let i = -3; i <= n + 3; i++) {
    const x = (i / n) * longueur;
    const y = pas / 2 + amplitude * Math.sin((2 * Math.PI * x) / longueur + phase);
    d += `${i === -3 ? "M" : "L"}${f(x)} ${f(y)}`;
  }
  return d;
}

/** Un générateur pseudo-aléatoire stable (xorshift). */
function alea(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

/** Une étincelle à quatre branches, centrée en (x, y). */
function etincelle(x: number, y: number, r: number): string {
  const e = r * 0.16;
  return `M${f(x)} ${f(y - r)}Q${f(x + e)} ${f(y - e)} ${f(x + r)} ${f(y)}Q${f(x + e)} ${f(y + e)} ${f(x)} ${f(y + r)}Q${f(x - e)} ${f(y + e)} ${f(x - r)} ${f(y)}Q${f(x - e)} ${f(y - e)} ${f(x)} ${f(y - r)}Z`;
}

export function MotifCarte({
  motif,
  graine = 1,
  centre,
  eclats = true,
}: {
  motif: Motif & { clair: string; fonce: string };
  /** Les étoiles : le ciel propre à chaque joueur. */
  graine?: number;
  /** Le centre des rayons et des ondes, s'il change (le dos : la rosace). */
  centre?: { cx: number; cy: number };
  /** Les étincelles du ciel (le dos) ; sur la face, seulement les points. */
  eclats?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const style: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };

  if (motif.type === "rayons") {
    const { cx, cy } = centre ?? motif;
    const pas = (Math.PI * 2) / motif.n;
    return (
      <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={style}>
        <path d={rayons(cx, cy, motif.n, 0.34, pas * 0.5)} fill={motif.fonce} />
        <path d={rayons(cx, cy, motif.n, 0.4, 0)} fill={motif.clair} />
      </svg>
    );
  }

  if (motif.type === "ondes") {
    const { cx, cy } = centre ?? motif;
    const r = rayonsOndes();
    return (
      <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={style}>
        <g fill="none">
          {r.map((v, i) => (
            <circle key={`o${i}`} cx={cx} cy={cy + 3} r={v} stroke={motif.fonce} strokeWidth={2.6 + i * 0.06} />
          ))}
          {r.map((v, i) => (
            <circle key={`c${i}`} cx={cx} cy={cy} r={v} stroke={motif.clair} strokeWidth={2.2 + i * 0.05} />
          ))}
        </g>
      </svg>
    );
  }

  if (motif.type === "alveoles") {
    // Des hexagones à pointe en haut : une tuile de √3·c × 3c, répétée.
    const c = motif.cote;
    const lw = Math.sqrt(3) * c;
    const lh = 3 * c;
    const hex = (x: number, y: number) =>
      `M${f(x)} ${f(y - c)}L${f(x + lw / 2)} ${f(y - c / 2)}L${f(x + lw / 2)} ${f(y + c / 2)}L${f(x)} ${f(y + c)}L${f(x - lw / 2)} ${f(y + c / 2)}L${f(x - lw / 2)} ${f(y - c / 2)}Z`;
    const tuile = hex(lw / 2, c) + hex(0, c * 2.5) + hex(lw, c * 2.5);
    return (
      <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={style}>
        <defs>
          <pattern id={`alv-o-${id}`} width={lw} height={lh} patternUnits="userSpaceOnUse" x={W / 2 - lw / 2} y={2}>
            <path d={tuile} fill="none" stroke={motif.fonce} strokeWidth={3.2} strokeLinejoin="round" />
          </pattern>
          <pattern id={`alv-c-${id}`} width={lw} height={lh} patternUnits="userSpaceOnUse" x={W / 2 - lw / 2} y={0}>
            <path d={tuile} fill="none" stroke={motif.clair} strokeWidth={2.2} strokeLinejoin="round" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill={`url(#alv-o-${id})`} />
        <rect width={W} height={H} fill={`url(#alv-c-${id})`} />
      </svg>
    );
  }

  if (motif.type === "guilloche") {
    // Chaque famille dans sa tuile : l'ombre décalée de 3, puis le trait clair.
    const familles = GUILLOCHE.longueurs.map((l, i) => ({ l, d: vagues(l, i * Math.PI), cle: `gu${i}-${id}` }));
    return (
      <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={style}>
        <defs>
          {familles.map((v) => (
            <Fragment key={v.cle}>
              <pattern id={`${v.cle}o`} width={v.l} height={GUILLOCHE.pas} patternUnits="userSpaceOnUse" x={W / 2} y={3}>
                <path d={v.d} fill="none" stroke={motif.fonce} strokeWidth={2.6} />
              </pattern>
              <pattern id={`${v.cle}c`} width={v.l} height={GUILLOCHE.pas} patternUnits="userSpaceOnUse" x={W / 2} y={0}>
                <path d={v.d} fill="none" stroke={motif.clair} strokeWidth={1.9} />
              </pattern>
            </Fragment>
          ))}
        </defs>
        {familles.map((v) => (
          <rect key={`${v.cle}o`} width={W} height={H} fill={`url(#${v.cle}o)`} />
        ))}
        {familles.map((v) => (
          <rect key={`${v.cle}c`} width={W} height={H} fill={`url(#${v.cle}c)`} />
        ))}
      </svg>
    );
  }

  // Les étoiles : des points de toutes tailles, quelques étincelles.
  const rnd = alea(graine);
  const points: { x: number; y: number; r: number; a: number }[] = [];
  for (let i = 0; i < 150; i++) {
    const t = rnd();
    points.push({ x: rnd() * W, y: rnd() * H, r: 1.4 + t * t * t * 4.2, a: 0.25 + rnd() * 0.75 });
  }
  const etincelles = Array.from({ length: 5 }, () => etincelle(70 + rnd() * (W - 140), 70 + rnd() * (H - 140), 14 + rnd() * 16)).join("");
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={style}>
      {points.map((p, i) => (
        <circle key={i} cx={f(p.x)} cy={f(p.y)} r={f(p.r)} fill={p.r > 3.4 ? motif.clair : motif.fonce} opacity={f(p.a)} />
      ))}
      {eclats && <path d={etincelles} fill={motif.clair} />}
    </svg>
  );
}

/**
 * La rosace guillochée du dos : deux familles de cercles ondulés qui se
 * croisent autour de (cx, cy), entre les rayons r1 et r2.
 */
export function RosaceBola({
  cx,
  cy,
  r1,
  r2,
  couleur,
  epaisseur = 1.6,
}: {
  cx: number;
  cy: number;
  r1: number;
  r2: number;
  couleur: string;
  epaisseur?: number;
}) {
  const traits: string[] = [];
  const brins = 14;
  const lobes = 9;
  const pts = 144;
  for (let i = 0; i < brins; i++) {
    const phase = (i / brins) * Math.PI * 2;
    const moyen = (r1 + r2) / 2;
    const amp = (r2 - r1) / 2;
    let d = "";
    for (let k = 0; k <= pts; k++) {
      const t = (k / pts) * Math.PI * 2;
      const r = moyen + amp * Math.sin(lobes * t + phase) * Math.cos(t * 2 + phase / 3) * 0.92;
      d += `${k === 0 ? "M" : "L"}${f(cx + r * Math.cos(t))} ${f(cy + r * Math.sin(t))}`;
    }
    traits.push(d + "Z");
  }
  return (
    <g fill="none" stroke={couleur} strokeWidth={epaisseur}>
      {traits.map((d, i) => (
        <path key={i} d={d} />
      ))}
      <circle cx={cx} cy={cy} r={r1 - 14} strokeWidth={epaisseur * 1.4} />
      <circle cx={cx} cy={cy} r={r2 + 14} strokeWidth={epaisseur * 1.4} />
      <circle cx={cx} cy={cy} r={r2 + 26} strokeWidth={epaisseur * 0.8} />
    </g>
  );
}
