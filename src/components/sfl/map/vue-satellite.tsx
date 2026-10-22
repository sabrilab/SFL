// La vue aérienne d'un terrain : les tuiles satellite d'Esri assemblées en un
// SVG (stade.ts, mosaiqueSatellite). Le SVG recadre comme `object-cover` :
// la photo remplit sa boîte quelle que soit sa taille (la carte du carrousel,
// la fiche du match). Les tuiles débordent d'un demi-pixel sur leurs
// voisines, sinon un fil clair passe entre elles une fois l'image réduite.

import { useMemo } from "react";
import { mosaiqueSatellite } from "./stade";

export function VueSatellite({
  lat,
  lng,
  demi,
  rapport,
  hauteur,
  titre,
  className,
}: {
  lat: number;
  lng: number;
  /** La demi-hauteur couverte, en degrés de latitude. */
  demi: number;
  /** Largeur / hauteur de ce qu'on veut voir. */
  rapport: number;
  /** La hauteur affichée, en px : elle choisit le zoom des tuiles. */
  hauteur: number;
  /** Ce que dit l'image ; sans titre, elle est décorative. */
  titre?: string;
  className?: string;
}) {
  const { boite, tuiles } = useMemo(() => mosaiqueSatellite(lat, lng, { demi, rapport, hauteur }), [lat, lng, demi, rapport, hauteur]);
  return (
    <svg
      viewBox={boite.map((n) => n.toFixed(1)).join(" ")}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role={titre ? "img" : undefined}
      aria-label={titre}
      aria-hidden={titre ? undefined : true}
    >
      {tuiles.map((t) => (
        <image key={t.url} href={t.url} x={t.x} y={t.y} width={256.5} height={256.5} />
      ))}
    </svg>
  );
}
