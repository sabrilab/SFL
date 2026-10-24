"use client";

// La couverture de la page d'une équipe (/bola-team/[id]). Sabri, 24/10 :
// « un profil d'équipe qui peut accueillir une couverture faite justement en
// IA aussi, avec les joueurs présents de cette équipe, leur maillot et leur
// blason ».
//
// Deux couvertures :
//   · celle que le capitaine (ou le vice) a créée avec le studio
//     (fiche-couverture.tsx, /api/equipes/couverture) : la photo de
//     l'équipe dans son maillot, rangée dans le bucket « couvertures » ;
//   · avant elle, la couverture dessinée : le haut du maillot de l'équipe en
//     plein cadre, comme une photo de produit serrée sur la poitrine. Le
//     tissu dans la principale, le motif dans la secondaire, le col en côte
//     et son encoche dans la troisième, les coutures raglan, les plis, la
//     lumière d'un projecteur en haut à gauche ; brodés dessus, la marque
//     BOLA et l'écusson, aux places du maillot (maillot.tsx). Tout se
//     dessine, sans filtre ni image importée ; la même pour toutes les
//     tailles (le cadre la coupe au centre, preserveAspectRatio slice).

import { useId, useState } from "react";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { BOLA } from "@/components/sfl/equipe/maillot";
import { blasonParDefaut, contraste, encreSur, melange, type Blason, type Motif } from "@/lib/sfl/blason";
import { urlCouverture, type Equipe, type Fond } from "@/lib/sfl/equipes";
import { cn } from "@/lib/utils";

// Le dessin se fait dans un cadre de 1600 × 900 (16:9).
const DOS = "M612 0H988C966 86 900 140 800 144C700 140 634 86 612 0Z";
const COL = "M606 0C630 92 700 152 800 156C900 152 970 92 994 0";
const ENCOCHE = "M772 150L800 196L828 150";
const RAGLAN = "M640 60C560 230 450 470 330 900 M960 60C1040 230 1150 470 1270 900";
const PLIS =
  "M300 520C380 640 430 760 450 900 M1300 520C1220 640 1170 760 1150 900 M180 140C260 300 300 420 330 560 M1420 140C1340 300 1300 420 1270 560";
const PLIS_CLAIRS = "M360 500C430 620 480 740 500 900 M1240 500C1170 620 1120 740 1100 900";

/** Le motif de l'écusson, à la mesure de la couverture (le col au milieu en haut). */
function MotifCouverture({ motif, couleur }: { motif: Motif; couleur: string }) {
  switch (motif) {
    case "uni":
      return null;
    case "parti":
      return <rect x={800} y={0} width={800} height={900} fill={couleur} />;
    case "coupe":
      return <rect x={0} y={470} width={1600} height={430} fill={couleur} />;
    case "tranche":
      return <polygon points="1600,40 1600,900 0,900 0,860" fill={couleur} />;
    case "rayures": {
      const l = 112;
      return (
        <g fill={couleur}>
          {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => (
            <rect key={k} x={800 - l / 2 + k * 2 * l} y={0} width={l} height={900} />
          ))}
        </g>
      );
    }
    case "bande":
      return <rect x={668} y={0} width={264} height={900} fill={couleur} />;
    case "echarpe":
      return <line x1={240} y1={-80} x2={1360} y2={980} stroke={couleur} strokeWidth={260} />;
    case "chevron":
      return <polyline points="-160,110 800,650 1760,110" fill="none" stroke={couleur} strokeWidth={160} strokeLinejoin="miter" />;
    case "cercle": {
      const l = 900 / 7;
      return (
        <g fill={couleur}>
          {[1, 3, 5].map((i) => (
            <rect key={i} x={0} y={i * l} width={1600} height={l} />
          ))}
        </g>
      );
    }
  }
}

export function CouvertureDessinee({
  initiales,
  fond,
  blason,
  className,
}: {
  initiales: string;
  fond: Fond;
  blason?: Blason | null;
  className?: string;
}) {
  const id = `cv-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const b = blason ?? blasonParDefaut(fond);
  const [c1, c2, c3] = b.couleurs;
  const marque = contraste(c3, c1) >= 1.8 ? c3 : encreSur(c1);
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <defs>
        <radialGradient id={`${id}-l`} gradientUnits="userSpaceOnUse" cx="420" cy="-140" r="1300">
          <stop offset="0" stopColor="#fff" stopOpacity={0.22} />
          <stop offset="0.5" stopColor="#fff" stopOpacity={0.05} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}-h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity={0} />
          <stop offset="0.55" stopColor="#000" stopOpacity={0.08} />
          <stop offset="1" stopColor="#000" stopOpacity={0.42} />
        </linearGradient>
        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity={0.42} />
          <stop offset="0.15" stopColor="#000" stopOpacity={0.06} />
          <stop offset="0.5" stopColor="#000" stopOpacity={0} />
          <stop offset="0.85" stopColor="#000" stopOpacity={0.08} />
          <stop offset="1" stopColor="#000" stopOpacity={0.46} />
        </linearGradient>
      </defs>
      <rect width={1600} height={900} fill={c1} />
      <MotifCouverture motif={b.motif} couleur={c2} />
      <path d={PLIS} fill="none" stroke="#000" strokeOpacity={0.06} strokeWidth={120} strokeLinecap="round" />
      <path d={PLIS} fill="none" stroke="#000" strokeOpacity={0.05} strokeWidth={40} strokeLinecap="round" />
      <path d={PLIS_CLAIRS} fill="none" stroke="#fff" strokeOpacity={0.06} strokeWidth={50} strokeLinecap="round" />
      <path d={RAGLAN} fill="none" stroke="#000" strokeOpacity={0.24} strokeWidth={5} />
      <path d={RAGLAN} transform="translate(6 3)" fill="none" stroke="#fff" strokeOpacity={0.12} strokeWidth={4} />
      <rect width={1600} height={900} fill={`url(#${id}-f)`} />
      <rect width={1600} height={900} fill={`url(#${id}-h)`} />
      <rect width={1600} height={900} fill={`url(#${id}-l)`} />
      <path d={DOS} fill={melange(c1, "#000000", 0.5)} />
      <path d={COL} fill="none" stroke={c3} strokeWidth={32} strokeLinecap="round" />
      <path d={COL} transform="translate(0 -7)" fill="none" stroke="#fff" strokeOpacity={0.14} strokeWidth={6} strokeLinecap="round" />
      <path d={COL} transform="translate(0 19)" fill="none" stroke="#000" strokeOpacity={0.16} strokeWidth={8} strokeLinecap="round" />
      <path d={ENCOCHE} fill="none" stroke={c3} strokeWidth={12} strokeLinejoin="round" />
      <path d={BOLA} transform="translate(578 304) scale(0.19)" fill="#000" fillOpacity={0.28} fillRule="evenodd" />
      <path
        d={BOLA}
        transform="translate(575 300) scale(0.19)"
        fill={marque}
        fillRule="evenodd"
        {...(b.motif !== "uni" && contraste(marque, c2) < 1.8 ? { stroke: encreSur(marque), strokeOpacity: 0.55, strokeWidth: 26, paintOrder: "stroke" as const } : {})}
      />
      <g transform="translate(872 236)">
        <Ecusson initiales={initiales} fond={fond} blason={b} taille={120} />
      </g>
    </svg>
  );
}

/** La couverture d'une équipe : celle qu'elle a posée, sinon la couverture dessinée. */
export function CouvertureEquipe({
  equipe,
  className,
  children,
}: {
  equipe: Pick<Equipe, "id" | "initiales" | "fond" | "blason" | "couvertureLe">;
  className?: string;
  children?: React.ReactNode;
}) {
  const url = urlCouverture(equipe);
  // Une image qui ne charge pas (effacée, hors ligne) : la couverture dessinée.
  const [ratee, setRatee] = useState<string | null>(null);
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {url && ratee !== url ? (
        // eslint-disable-next-line @next/next/no-img-element -- la couverture (Storage), versionnée par sa date de pose
        <img src={url} alt="" className="absolute inset-0 size-full object-cover" onError={() => setRatee(url)} />
      ) : (
        <CouvertureDessinee initiales={equipe.initiales} fond={equipe.fond} blason={equipe.blason} className="absolute inset-0 size-full" />
      )}
      {children}
    </div>
  );
}
