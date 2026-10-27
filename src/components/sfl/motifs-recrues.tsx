"use client";

// Les motifs des skins des recrues (skins-recrues.ts), que dessine
// motif-carte.tsx comme les autres : du SVG dans le repère de la carte
// (1024 × 1656), étiré sur toute la carte, sans image, sans flou ni filtre
// (la capture de la 3D le prend tel quel). Noir et blanc seulement ; chaque
// trait doublé de son arête décalée de 3 : gravé, pas imprimé.
//   · recruteur : trois rosaces guillochées concentriques autour de la note ;
//     au dos (papier noir), les mêmes à l'encre blanche autour de la lune ;
//   · filigrane : le nom du joueur en capitales, en rangs décalés, ton sur
//     ton, face et dos ;
//   · fondateur : un guilloché de deux familles de vagues sur toute la carte
//     et une grande rosace sous les stats ; au dos, le guilloché seul (la
//     rosace du dos est déjà là, dos-carte.tsx).

import { useId } from "react";
import type { MotifRecrue } from "@/components/sfl/skins-recrues";

const W = 1024;
const H = 1656;
// La note, sur la face.
const NOTE = { cx: 300, cy: 1300 };

type Couleurs = { clair: string; fonce: string };

const f = (n: number) => Math.round(n * 10) / 10;

/** Une rosace guillochée : des brins ondulés qui se croisent entre r1 et r2, ses deux cercles. */
function rosace(cx: number, cy: number, r1: number, r2: number, brins = 12, lobes = 9): string {
  const moyen = (r1 + r2) / 2;
  const amp = (r2 - r1) / 2;
  const pts = 120;
  let d = "";
  for (let i = 0; i < brins; i++) {
    const phase = (i / brins) * Math.PI * 2;
    for (let k = 0; k <= pts; k++) {
      const t = (k / pts) * Math.PI * 2;
      const r = moyen + amp * Math.sin(lobes * t + phase) * Math.cos(2 * t + phase / 3) * 0.92;
      d += `${k === 0 ? "M" : "L"}${f(cx + r * Math.cos(t))} ${f(cy + r * Math.sin(t))}`;
    }
    d += "Z";
  }
  return d;
}

/** Les vagues du guilloché, une rangée tous les `pas`, deux familles en opposition de phase. */
function vagues(pas: number, amplitude: number, longueurs: readonly number[]): string[] {
  return longueurs.map((l, i) => {
    let d = "";
    for (let y = -pas; y <= H + pas; y += pas) {
      for (let x = 0; x <= W; x += 8) {
        const v = y + amplitude * Math.sin((x / l) * Math.PI * 2 + i * Math.PI);
        d += `${x === 0 ? "M" : "L"}${x} ${f(v)}`;
      }
    }
    return d;
  });
}

const VAGUES = vagues(30, 13, [168, 186]);

/** Un tracé gravé : l'arête décalée de 3, puis le trait. */
function Grave({ d, m, l = 1.6 }: { d: string; m: Couleurs; l?: number }) {
  return (
    <>
      <path d={d} transform="translate(3 3)" fill="none" stroke={m.fonce} strokeWidth={l + 0.6} />
      <path d={d} fill="none" stroke={m.clair} strokeWidth={l} />
    </>
  );
}

function Recruteur({ m, dos }: { m: Couleurs; dos: boolean }) {
  // Au dos (papier noir), l'encre blanche ; les rosaces autour de la lune.
  const c = dos ? { cx: 512, cy: 738 } : NOTE;
  const e = dos ? { clair: "rgba(255,255,255,0.09)", fonce: "rgba(0,0,0,0.5)" } : m;
  const anneaux = dos
    ? [
        [336, 392],
        [412, 468],
      ]
    : [
        [150, 196],
        [214, 262],
        [282, 332],
      ];
  return (
    <>
      {anneaux.map(([r1, r2], i) => (
        <g key={i}>
          <Grave d={rosace(c.cx, c.cy, r1, r2, 12, 9 + i * 2)} m={e} l={1.5} />
          <circle cx={c.cx} cy={c.cy} r={r2 + 9} fill="none" stroke={e.clair} strokeWidth={1.2} />
        </g>
      ))}
    </>
  );
}

function Filigrane({ m, nom, id }: { m: Couleurs; nom: string; id: string }) {
  const mot = (nom || "BOLA").toUpperCase();
  const ligne = Array.from({ length: 8 }, () => mot).join("  ·  ");
  const rangs = Array.from({ length: 16 }, (_, i) => i);
  const texte = (dx: number, dy: number, couleur: string) => (
    <g fill={couleur} transform={`translate(${dx} ${dy})`}>
      {rangs.map((i) => (
        <text
          key={i}
          x={i % 2 ? -260 : -60}
          y={i * 132 - 120}
          fontFamily="Inter, var(--font-sans), system-ui, sans-serif"
          fontWeight={900}
          fontSize={92}
          letterSpacing={-3}
        >
          {ligne}
        </text>
      ))}
    </g>
  );
  return (
    <>
      <defs>
        <clipPath id={`fil-${id}`}>
          <rect width={W} height={H} />
        </clipPath>
      </defs>
      <g clipPath={`url(#fil-${id})`}>
        <g transform={`rotate(-14 ${W / 2} ${H / 2})`}>
          {texte(3, 3, m.fonce)}
          {texte(0, 0, m.clair)}
        </g>
      </g>
    </>
  );
}

function Fondateur({ m, dos }: { m: Couleurs; dos: boolean }) {
  return (
    <>
      {VAGUES.map((d, i) => (
        <Grave key={i} d={d} m={m} l={1.3} />
      ))}
      {!dos && (
        <>
          <Grave d={rosace(512, 1380, 170, 250, 16, 11)} m={{ clair: "rgba(8,9,11,0.1)", fonce: m.fonce }} l={1.4} />
          <circle cx={512} cy={1380} r={262} fill="none" stroke="rgba(8,9,11,0.12)" strokeWidth={1.4} />
          <circle cx={512} cy={1380} r={156} fill="none" stroke="rgba(8,9,11,0.12)" strokeWidth={1.4} />
        </>
      )}
    </>
  );
}

export function MotifRecrueSvg({ motif, dos = false, nom = "" }: { motif: MotifRecrue & Couleurs; dos?: boolean; nom?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const style: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };
  const m = { clair: motif.clair, fonce: motif.fonce };
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={style}>
      {motif.type === "recruteur" ? (
        <Recruteur m={m} dos={dos} />
      ) : motif.type === "filigrane" ? (
        <Filigrane m={m} nom={nom} id={id} />
      ) : (
        <Fondateur m={m} dos={dos} />
      )}
    </svg>
  );
}
