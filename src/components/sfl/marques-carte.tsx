"use client";

// Les marques de la carte joueur, partagées par la face (bola-card.tsx), la
// carte photo (carte-photo.tsx) et le dos (dos-carte.tsx) :
//   · le sigle SFL de la ligue, à la couleur de l'encre (le masque de
//     SigleLigue, choix-ligue.tsx), en bout de ligne de série ;
//   · et ce que les éditions d'époque reprennent de leur temps
//     (finitions-carte.ts, `Epoque`) : le sigle souligné de sa barre, comme
//     le logo de la saison 0 ; le cadre de métal et son filet des cartes
//     Boost ; le losange au ballon, qui pointait sous chaque carte ;
//     l'emblème du coin (couronne, flamme, bouclier).
// Rien que du CSS et du SVG sans filtre : la 3D (card-3d.tsx) photographie
// la carte telle quelle, aussi sur iPhone.

import { useId } from "react";
import { Crown, Flame, ShieldCheck } from "lucide-react";
import { RAYON_CARTE, type Epoque } from "@/components/sfl/finitions-carte";

const W = 1024;
const H = 1656;
/** Le filet intérieur des cartes Boost : à 6 du bord d'une carte de 254, × 1024 ÷ 254. */
const FILET = 24;

/** Le sigle SFL, à la couleur voulue. */
export function SigleSfl({ hauteur, couleur }: { hauteur: number; couleur: string }) {
  return (
    <span
      role="img"
      aria-label="SFL"
      style={{
        display: "inline-block",
        height: hauteur,
        width: (hauteur * 735) / 237,
        background: couleur,
        mask: "url(/bola/sfl.svg) center / contain no-repeat",
        WebkitMask: "url(/bola/sfl.svg) center / contain no-repeat",
      }}
    />
  );
}

/** Le sigle de la saison 0 : SFL, souligné de sa barre (orange sur la carte de saison). */
export function SigleSouligne({ hauteur, epoque }: { hauteur: number; epoque: Epoque }) {
  const largeur = (hauteur * 735) / 237;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: hauteur * 0.16 }}>
      <SigleSfl hauteur={hauteur} couleur={epoque.sigle} />
      <span style={{ width: largeur * 0.62, height: hauteur * 0.19, borderRadius: hauteur * 0.1, background: epoque.barre }} />
    </span>
  );
}

/** Le cadre de la carte d'époque, dans son métal, et le filet intérieur des cartes Boost (repère 1024 × 1656). */
export function BordEpoque({ epoque }: { epoque: Epoque }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { couleurs, epaisseur: e } = epoque.bord;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <defs>
        {/* Du haut à gauche au bas à droite, comme le dégradé à 160° des cartes d'alors. */}
        <linearGradient id={`bord-${id}`} x1="0" y1="0" x2="0.36" y2="1">
          {couleurs.map((c, i) => (
            <stop key={i} offset={couleurs.length > 1 ? i / (couleurs.length - 1) : 0} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <rect
        x={e / 2}
        y={e / 2}
        width={W - e}
        height={H - e}
        rx={RAYON_CARTE - e / 2}
        fill="none"
        stroke={`url(#bord-${id})`}
        strokeWidth={e}
      />
      {epoque.filet && (
        <rect
          x={FILET}
          y={FILET}
          width={W - FILET * 2}
          height={H - FILET * 2}
          rx={RAYON_CARTE - FILET}
          fill="none"
          stroke={epoque.filet}
          strokeWidth={3}
        />
      )}
    </svg>
  );
}

/** Le losange au ballon de la saison 0, à la place de la puce : `cote`, sa hauteur à l'écran. */
export function LosangeBallon({ cote, epoque }: { cote: number; epoque: Epoque }) {
  const { fond, trait, ballon } = epoque.losange;
  return (
    <svg aria-hidden width={cote} height={cote} viewBox="0 0 100 100" style={{ display: "block" }}>
      <path d="M50 5 L95 50 L50 95 L5 50 Z" fill={fond} stroke={trait} strokeWidth={4} strokeLinejoin="round" />
      {/* Le ballon des cartes d'alors (24 × 24), centré et à 1,8 fois. */}
      <g transform="translate(28.4 28.4) scale(1.8)">
        <circle cx="12" cy="12" r="10.5" fill={fond} stroke={ballon} strokeWidth="1.6" />
        <polygon points="12,7.4 16.2,10.4 14.6,15.2 9.4,15.2 7.8,10.4" fill={ballon} />
        <g stroke={ballon} strokeWidth="1.2">
          <line x1="12" y1="7.4" x2="12" y2="2.6" />
          <line x1="16.2" y1="10.4" x2="20.6" y2="8.6" />
          <line x1="14.6" y1="15.2" x2="17.6" y2="19.4" />
          <line x1="9.4" y1="15.2" x2="6.4" y2="19.4" />
          <line x1="7.8" y1="10.4" x2="3.4" y2="8.6" />
        </g>
      </g>
    </svg>
  );
}

const EMBLEMES = { couronne: Crown, flamme: Flame, bouclier: ShieldCheck } as const;

/**
 * L'emblème du coin des cartes Boost de la saison 0 — la couronne du MVP, la
 * flamme d'Impact, le bouclier de la Défensive —, sur un rond du fond de la
 * carte cerclé de son métal, pour se lire sur toutes les photos.
 */
export function EmblemeEpoque({ cote, epoque }: { cote: number; epoque: Epoque }) {
  if (!epoque.embleme) return null;
  const Embleme = EMBLEMES[epoque.embleme];
  const { fond, trait } = epoque.losange;
  return (
    <span
      aria-hidden
      style={{
        display: "grid",
        placeItems: "center",
        width: cote,
        height: cote,
        borderRadius: "50%",
        background: fond,
        boxShadow: `inset 0 0 0 ${Math.max(1, cote * 0.035)}px ${trait}, 0 ${cote * 0.05}px ${cote * 0.18}px rgba(0,0,0,0.35)`,
      }}
    >
      <Embleme
        width={cote * 0.56}
        height={cote * 0.56}
        strokeWidth={2.2}
        color={epoque.accent}
        fill={epoque.embleme === "couronne" ? epoque.accent : "none"}
        style={{ display: "block" }}
      />
    </span>
  );
}
