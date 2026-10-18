"use client";

// Le badge en verre, posé en haut à droite du portrait de la carte (choix de
// Sabri, 17/10 : « le coin, à droite », « plus de maturité, moins joué,
// des effets de transparence et de verre »).
//
// Un vrai verre dépoli : sous le badge, on redessine le portrait lui-même,
// flouté, un peu grossi (la loupe du verre) et éclairci, découpé à la forme
// du badge. On n'utilise pas backdrop-filter : la carte 3D (card-3d.tsx) est
// photographiée par html-to-image, qui ne sait pas le rendre ; ce calque-là
// passe tel quel dans la photo.
//
// Par-dessus : le verre teinté du métal (or, argent, bronze ; rouge et or
// au dernier palier), un bord de métal épais, un filet intérieur blanc et un
// reflet en haut. Reconnaissable d'un coup d'œil, même à 20 px (demande de
// Sabri, 18/10) : la forme dit la famille, le métal le niveau, l'emblème ce
// que le badge récompense (les mêmes que dans la vitrine) :
//   · l'écusson (fin de saison) porte l'emblème du classement et, sur sa
//     pointe, une pastille de métal avec le rang en chiffre ;
//   · le disque (palier) porte l'emblème, et le palier en points blancs sur
//     le bas du bord (un point au bronze… quatre au rouge et or).

import { useId, type ReactNode } from "react";
import { EMBLEMES, EMBLEMES_SAISON } from "@/components/sfl/emblemes";
import type { BadgeCarte } from "@/lib/sfl/badge-carte";
import { CLASSEMENTS, ordinal, type ClassementId } from "@/lib/sfl/fin-de-saison";
import { metal, NOM_METAL, TROPHEES, type Metal, type TropheeId } from "@/lib/sfl/trophees";

const ANTON = "var(--font-anton), Anton, sans-serif";

/** Le liseré de chaque métal : un dégradé à deux éclats, comme un métal poli. */
const LISERE: Record<Metal, [string, string, string, string]> = {
  bronze: ["#f0c09a", "#8f4f22", "#e2a77c", "#6a3815"],
  argent: ["#ffffff", "#8f959d", "#e9ebee", "#6d737b"],
  or: ["#f7e3a6", "#b8862b", "#f3d48a", "#8a6416"],
  legende: ["#f7e3a6", "#b8862b", "#f3d48a", "#8a6416"],
};

/** La teinte prise par le verre : à peine colorée, sauf le rouge et or. */
const TEINTE: Record<Metal, string> = {
  bronze: "rgba(176,106,53,0.34)",
  argent: "rgba(190,196,204,0.3)",
  or: "rgba(226,177,60,0.38)",
  legende: "rgba(150,20,20,0.62)",
};

const RANG_METAL: Record<number, Metal> = { 1: "or", 2: "argent", 3: "bronze" };


// L'écusson, dans un repère 100 × 112.
const ECU = "50,1 99,12 99,56 92,78 76,96 50,111 24,96 8,78 1,56 1,12";
const ECU_FILET = "50,8 92,17.5 92,55 86,74 72,89.5 50,103 28,89.5 14,74 8,55 8,17.5";
const ECU_REFLET = "50,1 99,12 99,38 1,52 1,12";
const ECU_CLIP = "polygon(50% 0.9%, 99% 10.7%, 99% 50%, 92% 69.6%, 76% 85.7%, 50% 99.1%, 24% 85.7%, 8% 69.6%, 1% 50%, 1% 10.7%)";

/** Le nom du badge, en toutes lettres (lecteur d'écran, feuille de choix). */
export function nomBadge(b: BadgeCarte): string {
  if (b.famille === "saison") return `${CLASSEMENTS.find((c) => c.id === b.id)!.nom}, ${ordinal(b.rang)}`;
  const m = metal(b.palier)!;
  return `${TROPHEES.find((t) => t.id === b.id)!.nom}, ${NOM_METAL[m]}`;
}

export function metalBadge(b: BadgeCarte): Metal {
  return b.famille === "saison" ? RANG_METAL[b.rang] : metal(b.palier)!;
}

export function BadgeVerre({
  badge,
  largeur,
  left,
  top,
  cote,
  fond,
}: {
  badge: BadgeCarte;
  /** Largeur du badge, en px à l'écran. */
  largeur: number;
  /** Position du badge dans le portrait, en px. */
  left: number;
  top: number;
  /** Côté du portrait, en px. */
  cote: number;
  /** Le portrait à redessiner sous le verre. */
  fond?: ReactNode;
}) {
  const gid = useId();
  const m = metalBadge(badge);
  const [a, b, c, d] = LISERE[m];
  const ecusson = badge.famille === "saison";
  const w = largeur;
  const h = ecusson ? (w * 112) / 100 : w;
  const encre = m === "legende" ? "#f7e3a6" : "#0b0c0e";
  const Embleme = ecusson ? EMBLEMES_SAISON[badge.id as ClassementId] : EMBLEMES[badge.id as TropheeId];
  // La loupe : le portrait grossi de 6 % autour du centre du badge.
  const cx = left + w / 2;
  const cy = top + h / 2;

  return (
    <div
      role="img"
      aria-label={`Badge : ${nomBadge(badge)}`}
      style={{
        position: "absolute",
        left,
        top,
        width: w,
        height: h,
        filter: `drop-shadow(0 ${w * 0.05}px ${w * 0.09}px rgba(0,0,0,0.28))`,
      }}
    >
      {/* Le verre dépoli */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          clipPath: ecusson ? ECU_CLIP : undefined,
          borderRadius: ecusson ? undefined : "50%",
        }}
      >
        {fond && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: -left,
              top: -top,
              width: cote,
              height: cote,
              transform: "scale(1.06)",
              transformOrigin: `${cx}px ${cy}px`,
              filter: `blur(${w * 0.075}px) saturate(1.5) brightness(1.08)`,
            }}
          >
            {fond}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(165deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.14) 55%, rgba(255,255,255,0.3) 100%), ${TEINTE[m]}`,
          }}
        />
      </div>

      {/* Le liseré de métal, le filet, le reflet */}
      <svg
        aria-hidden
        width={w}
        height={h}
        viewBox={ecusson ? "0 0 100 112" : "0 0 100 100"}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>
          <linearGradient id={`${gid}m`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={a} />
            <stop offset="0.45" stopColor={b} />
            <stop offset="0.7" stopColor={c} />
            <stop offset="1" stopColor={d} />
          </linearGradient>
          <linearGradient id={`${gid}r`} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
            <stop offset="0.4" stopColor="#fff" stopOpacity="0.06" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${gid}s`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#7ad7ff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#c9b6ff" stopOpacity="0.22" />
            <stop offset="1" stopColor="#ffd9a8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ecusson ? (
          <>
            <polygon points={ECU} fill={`url(#${gid}s)`} />
            <polygon points={ECU_REFLET} fill={`url(#${gid}r)`} />
            <polygon points={ECU_FILET} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={1.2} />
            <polygon points={ECU} fill="none" stroke={`url(#${gid}m)`} strokeWidth={7} strokeLinejoin="round" />
            {/* Le rang : une pastille de métal sur la pointe */}
            <circle cx={50} cy={93} r={23} fill={`url(#${gid}m)`} stroke="#fff" strokeOpacity={0.75} strokeWidth={1.4} />
          </>
        ) : (
          <>
            <circle cx={50} cy={50} r={49} fill={`url(#${gid}s)`} />
            <path d="M7 36 A 45 45 0 0 1 71 7 L 50 50 Z" fill={`url(#${gid}r)`} />
            <circle cx={50} cy={50} r={40} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={1.2} />
            <circle cx={50} cy={50} r={46} fill="none" stroke={`url(#${gid}m)`} strokeWidth={8} />
            {/* Le palier : autant de points blancs sur le bas du bord */}
            {Array.from({ length: badge.palier }, (_, i) => {
              const t = ((90 + (i - (badge.palier - 1) / 2) * 24) * Math.PI) / 180;
              return <circle key={i} cx={50 + 46 * Math.cos(t)} cy={50 + 46 * Math.sin(t)} r={4.6} fill="#fff" stroke="#0b0c0e" strokeOpacity={0.5} strokeWidth={1} />;
            })}
          </>
        )}
      </svg>

      {/* Ce que récompense le badge : son emblème, d'un trait franc */}
      <Embleme
        aria-hidden
        strokeWidth={2.6}
        style={{
          position: "absolute",
          left: w * (ecusson ? 0.25 : 0.22),
          top: ecusson ? h * 0.14 : w * 0.22,
          width: w * (ecusson ? 0.5 : 0.56),
          height: w * (ecusson ? 0.5 : 0.56),
          color: encre,
        }}
      />
      {ecusson && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: (h * 93) / 112 - w * 0.15,
            height: w * 0.3,
            display: "grid",
            placeItems: "center",
            fontFamily: ANTON,
            fontSize: w * 0.34,
            lineHeight: 1,
            color: m === "legende" ? "#f7e3a6" : "#0b0c0e",
          }}
        >
          {badge.rang}
        </div>
      )}
    </div>
  );
}
