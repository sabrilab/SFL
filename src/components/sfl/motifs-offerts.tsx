"use client";

// Les motifs des skins offerts (skins-offerts.ts), que dessine motif-carte.tsx
// comme les autres : du SVG dans le repère de la carte (1024 × 1656), étiré
// sur toute la carte, sans image et sans flou (la capture de la 3D le prend
// tel quel).
//   · clous (la pépite) : les clous de Paris des boîtiers de montre en or, un
//     quadrillage à 45° de petites pyramides, chacune avec ses quatre
//     facettes, deux qui prennent la lumière, deux dans l'ombre, et le sillon
//     du burin entre elles ; face et dos ;
//   · palestine : sur la face, les bandes du drapeau le long des deux bords,
//     en gris d'encre (comme « Tes couleurs ») ; au dos, le drapeau hissé à
//     la verticale : la bande noire à gauche, la blanche, la verte, et le
//     triangle rouge qui descend du haut, sa pointe au tiers de la hauteur,
//     juste au-dessus de la lune. Les bandes sont cousues (un filet sombre,
//     une piqûre claire) ; la lune, dans son double cercle, et le logotype
//     Bola sont à l'encre sur la bande blanche (le dos ne dessine pas son
//     logo, dos.logo = false).

import { useId } from "react";
import { LOGO_BOLA } from "@/components/sfl/finitions-carte";
import type { MotifOffert } from "@/components/sfl/skins-offerts";

const W = 1024;
const H = 1656;

type Couleurs = { clair: string; fonce: string };

const f = (n: number) => Math.round(n * 10) / 10;

/* --------------------------------- Clous ---------------------------------- */

// Une pyramide par case, la case de 26 tournée à 45°.
const CLOU = 26;

function Clous({ m, id }: { m: Couleurs; id: string }) {
  const s = CLOU;
  const c = s / 2;
  return (
    <>
      <defs>
        <pattern id={`clous-${id}`} width={s} height={s} patternUnits="userSpaceOnUse" patternTransform={`rotate(45 ${W / 2} ${H / 2})`}>
          <path d={`M0 0L${s} 0L${c} ${c}Z`} fill={m.clair} />
          <path d={`M0 0L0 ${s}L${c} ${c}Z`} fill={m.clair} opacity={0.45} />
          <path d={`M0 ${s}L${s} ${s}L${c} ${c}Z`} fill={m.fonce} />
          <path d={`M${s} 0L${s} ${s}L${c} ${c}Z`} fill={m.fonce} opacity={0.5} />
          <path d={`M0 0L${s} 0L${s} ${s}L0 ${s}Z`} fill="none" stroke={m.fonce} strokeWidth={1.1} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#clous-${id})`} />
    </>
  );
}

/* ------------------------- Palestine : la face ----------------------------- */

// Les bandes le long des deux bords, de l'extérieur vers l'intérieur : 30 de
// large, à 8 du bord (le portrait commence à 41), comme « Tes couleurs ».
const BANDES = { x: 8, l: 30 };

function BandesDesBords({ m, bandes }: { m: Couleurs; bandes: string[] }) {
  const b = BANDES.l / bandes.length;
  const gauche = (i: number) => BANDES.x + i * b;
  const droite = (i: number) => W - BANDES.x - (i + 1) * b;
  const bords = [BANDES.x, BANDES.x + BANDES.l, W - BANDES.x - BANDES.l, W - BANDES.x];
  return (
    <>
      {bandes.map((c, i) => (
        <g key={i}>
          <rect x={f(gauche(i))} y={0} width={f(b)} height={H} fill={c} />
          <rect x={f(droite(i))} y={0} width={f(b)} height={H} fill={c} />
        </g>
      ))}
      <g stroke={m.fonce}>
        {bandes.slice(1).map((_, i) => (
          <g key={i} strokeWidth={0.9}>
            <line x1={f(gauche(i + 1))} y1={0} x2={f(gauche(i + 1))} y2={H} />
            <line x1={f(droite(i))} y1={0} x2={f(droite(i))} y2={H} />
          </g>
        ))}
        {bords.map((x) => (
          <line key={x} x1={x} y1={0} x2={x} y2={H} strokeWidth={1.4} />
        ))}
      </g>
    </>
  );
}

/* -------------------------- Palestine : le dos ----------------------------- */

const TIERS = W / 3;
// La pointe du triangle : au tiers de la longueur du drapeau, ici sa hauteur.
const POINTE = H / 3;
const LUNE = { cx: W / 2, cy: 790, d: 252 };
const LOGOTYPE = { cy: 1250, h: 62 };
const BOITE_SYMBOLE = { x: 17, y: 103.485, c: 112.373 };
const BOITE_LOGOTYPE = { x: 150.41, y: 32.445, l: 783.3, h: 183.7 };
const INK = "#08090b";

function Drapeau({ bandes, triangle, id }: { bandes: string[]; triangle: string; id: string }) {
  const sLune = LUNE.d / BOITE_SYMBOLE.c;
  const sLogo = LOGOTYPE.h / BOITE_LOGOTYPE.h;
  const tri = `M0 0L${W} 0L${f(W / 2)} ${f(POINTE)}Z`;
  const coutures = [TIERS, 2 * TIERS];
  return (
    <>
      {bandes.map((c, i) => (
        <rect key={i} x={f(i * TIERS)} y={0} width={f(TIERS + 0.5)} height={H} fill={c} />
      ))}
      {/* Le tissu : la lumière passe un peu sur le haut, la trame à peine. */}
      <rect width={W} height={H} fill={`url(#pal-tissu-${id})`} />
      <path d={tri} fill={triangle} />
      {/* Les coutures : un filet sombre, puis une piqûre claire de chaque côté. */}
      <g fill="none">
        {coutures.map((x) => (
          <g key={x}>
            <line x1={f(x)} y1={0} x2={f(x)} y2={H} stroke="rgba(0,0,0,0.38)" strokeWidth={1.6} />
            <line x1={f(x - 7)} y1={0} x2={f(x - 7)} y2={H} stroke="rgba(255,255,255,0.22)" strokeWidth={1.2} strokeDasharray="7 6" />
            <line x1={f(x + 7)} y1={0} x2={f(x + 7)} y2={H} stroke="rgba(0,0,0,0.2)" strokeWidth={1.2} strokeDasharray="7 6" />
          </g>
        ))}
        <path d={`M0 0L${f(W / 2)} ${f(POINTE)}L${W} 0`} stroke="rgba(0,0,0,0.4)" strokeWidth={1.6} strokeLinejoin="round" />
        <path
          d={`M0 9L${f(W / 2)} ${f(POINTE - 11)}L${W} 9`}
          stroke="rgba(255,255,255,0.24)"
          strokeWidth={1.2}
          strokeDasharray="7 6"
          strokeLinejoin="round"
        />
      </g>
      {/* La lune dans son double cercle, puis le logotype, à l'encre sur la bande blanche. */}
      <g fill="none" stroke={INK}>
        <circle cx={LUNE.cx} cy={LUNE.cy} r={LUNE.d / 2 + 22} strokeWidth={2.4} opacity={0.5} />
        <circle cx={LUNE.cx} cy={LUNE.cy} r={LUNE.d / 2 + 32} strokeWidth={1} opacity={0.35} />
      </g>
      <path
        d={LOGO_BOLA.symbole}
        fill={INK}
        fillRule="evenodd"
        transform={`translate(${f(LUNE.cx - (BOITE_SYMBOLE.x + BOITE_SYMBOLE.c / 2) * sLune)} ${f(LUNE.cy - (BOITE_SYMBOLE.y + BOITE_SYMBOLE.c / 2) * sLune)}) scale(${sLune})`}
      />
      <path
        d={LOGO_BOLA.logotype}
        fill={INK}
        fillRule="evenodd"
        transform={`translate(${f(W / 2 - (BOITE_LOGOTYPE.x + BOITE_LOGOTYPE.l / 2) * sLogo)} ${f(LOGOTYPE.cy - (BOITE_LOGOTYPE.y + BOITE_LOGOTYPE.h / 2) * sLogo)}) scale(${sLogo})`}
      />
    </>
  );
}

/* --------------------------------- Le motif -------------------------------- */

export function MotifOffertSvg({ motif, dos = false }: { motif: MotifOffert & Couleurs; dos?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const style: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };
  const m = { clair: motif.clair, fonce: motif.fonce };
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={style}>
      {motif.type === "clous" ? (
        <Clous m={m} id={id} />
      ) : dos ? (
        <>
          <defs>
            <linearGradient id={`pal-tissu-${id}`} x1={0} y1={0} x2={0} y2={1}>
              <stop offset={0} stopColor="#ffffff" stopOpacity={0.08} />
              <stop offset={0.45} stopColor="#ffffff" stopOpacity={0} />
              <stop offset={1} stopColor="#000000" stopOpacity={0.12} />
            </linearGradient>
          </defs>
          <Drapeau bandes={motif.bandes} triangle={motif.triangle} id={id} />
        </>
      ) : (
        <BandesDesBords m={m} bandes={motif.encre} />
      )}
    </svg>
  );
}
