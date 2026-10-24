// L'écusson d'une équipe du mode Team. Depuis le 24/10 (Sabri : « designer
// un vrai écusson d'équipe et choisir de vraies couleurs »), chaque équipe
// dessine le sien (lib/sfl/blason.ts) : une forme, un motif dans sa
// deuxième couleur, un liseré et un emblème dans la troisième. Sans
// écusson dessiné, celui des débuts : noir et blanc, les initiales au cœur
// (Inter 800, serrées), cerclé du contraire.
//
// Tout tient dans la même boîte (100 × 106) qu'avant : aucune mise en page
// ne bouge. L'emblème est détouré de la couleur du fond, pour se lire sur
// les rayures comme sur l'uni ; un léger reflet en haut, comme un émail.
// Pas d'image importée (règles officielles, Q17).

import { useId } from "react";
import { blasonParDefaut, couleurEmbleme, type Blason, type Embleme, type Forme, type Motif } from "@/lib/sfl/blason";
import type { Fond } from "@/lib/sfl/equipes";

const ECU = "M50 3 L93 14 V52 C93 79 74 95 50 103 C26 95 7 79 7 52 V14 Z";

/** Les formes, dans la boîte 100 × 106 (centre 50, 53). */
export const FORME_PATH: Record<Forme, string> = {
  ecu: ECU,
  blason: "M7 5 H93 V55 C93 80 74 96 50 103 C26 96 7 80 7 55 Z",
  rond: "M3 53 A47 47 0 1 0 97 53 A47 47 0 1 0 3 53 Z",
  pointe: "M17 4 H83 L94 15 V58 L50 103 L6 58 V15 Z",
  ovale: "M9 53 A41 49 0 1 0 91 53 A41 49 0 1 0 9 53 Z",
};

/** Le motif, dans la deuxième couleur, sur une boîte w × h (l'écusson ou le maillot). */
export function DessinMotif({ motif, couleur, w, h, decalage = 0 }: { motif: Motif; couleur: string; w: number; h: number; decalage?: number }) {
  switch (motif) {
    case "uni":
      return null;
    case "parti":
      return <rect x={w / 2} y={0} width={w / 2} height={h} fill={couleur} />;
    case "coupe":
      return <rect x={0} y={h / 2 + decalage} width={w} height={h} fill={couleur} />;
    case "tranche":
      return <polygon points={`${w},0 ${w},${h} 0,${h}`} fill={couleur} />;
    case "rayures": {
      const l = w / 7;
      return (
        <g fill={couleur}>
          {[1, 3, 5].map((i) => (
            <rect key={i} x={i * l} y={0} width={l} height={h} />
          ))}
        </g>
      );
    }
    case "bande":
      return <rect x={w * 0.35} y={0} width={w * 0.3} height={h} fill={couleur} />;
    case "echarpe":
      return <line x1={0} y1={0} x2={w} y2={h} stroke={couleur} strokeWidth={w * 0.24} />;
    case "chevron":
      return (
        <polyline
          points={`0,${h * 0.53 + decalage} ${w / 2},${h * 0.87 + decalage} ${w},${h * 0.53 + decalage}`}
          fill="none"
          stroke={couleur}
          strokeWidth={w * 0.16}
          strokeLinejoin="miter"
        />
      );
    case "cercle": {
      const l = h / 7;
      return (
        <g fill={couleur}>
          {[1, 3, 5].map((i) => (
            <rect key={i} x={0} y={i * l} width={w} height={l} />
          ))}
        </g>
      );
    }
  }
}

// L'étoile à cinq branches, centrée (50, 52).
const ETOILE = Array.from({ length: 10 }, (_, k) => {
  const r = k % 2 === 0 ? 21 : 8.8;
  const a = ((-90 + k * 36) * Math.PI) / 180;
  return `${(50 + r * Math.cos(a)).toFixed(2)},${(52 + r * Math.sin(a)).toFixed(2)}`;
}).join(" ");

// Le pentagone du ballon et ses coutures.
const PENTA = Array.from({ length: 5 }, (_, k) => {
  const a = ((-90 + k * 72) * Math.PI) / 180;
  return [50 + 7.5 * Math.cos(a), 52 + 7.5 * Math.sin(a), 50 + 19 * Math.cos(a), 52 + 19 * Math.sin(a)];
});

function Icone({ embleme, couleur, fond }: { embleme: Exclude<Embleme, "initiales">; couleur: string; fond: string }) {
  const detoure = { stroke: fond, strokeWidth: 2.4, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };
  switch (embleme) {
    case "etoile":
      return <polygon points={ETOILE} fill={couleur} {...detoure} />;
    case "ballon":
      return (
        <g>
          <circle cx={50} cy={52} r={19.5} fill={couleur} stroke={fond} strokeWidth={2.4} />
          <polygon points={PENTA.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")} fill={fond} />
          {PENTA.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={fond} strokeWidth={2.2} strokeLinecap="round" />
          ))}
        </g>
      );
    case "couronne":
      return (
        <g fill={couleur} {...detoure}>
          <path d="M29 63 L27 39 L39 50 L50 34 L61 50 L73 39 L71 63 Z" />
          <rect x={29} y={66} width={42} height={6} rx={1.5} />
        </g>
      );
    case "eclair":
      return <path d="M57 28 L35 58 H48 L42 78 L66 45 H53 Z" fill={couleur} {...detoure} />;
  }
}

export function Ecusson({
  initiales,
  fond,
  blason,
  taille = 48,
  className,
}: {
  initiales: string;
  fond: Fond;
  blason?: Blason | null;
  taille?: number;
  className?: string;
}) {
  const id = `ec-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const b = blason ?? blasonParDefaut(fond);
  const [c1, c2, c3] = b.couleurs;
  const forme = FORME_PATH[b.forme];
  const encre = couleurEmbleme(b);
  const n = initiales.length;
  // Sous une icône, les initiales, quand l'écusson est assez grand pour qu'on les lise.
  const sousIcone = b.embleme !== "initiales" && taille >= 56 && n > 0;
  const detoure = b.motif === "uni" ? {} : { stroke: c1, strokeWidth: 2.6, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 100 106" width={taille} height={taille * 1.06} className={className} role="img" aria-label={initiales}>
      <defs>
        <clipPath id={`${id}-f`}>
          <path d={forme} />
        </clipPath>
        <linearGradient id={`${id}-r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.22} />
          <stop offset="0.45" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}-f)`}>
        <rect width={100} height={106} fill={c1} />
        <DessinMotif motif={b.motif} couleur={c2} w={100} h={106} />
        <rect width={100} height={106} fill={`url(#${id}-r)`} />
      </g>
      <path d={forme} fill="none" stroke={c3} strokeWidth={4} strokeLinejoin="round" />
      <path
        d={forme}
        fill="none"
        stroke={c3}
        strokeWidth={1.2 / 0.84}
        opacity={0.45}
        transform="translate(50 53) scale(0.84) translate(-50 -53)"
      />
      {b.embleme === "initiales" ? (
        <text
          x="50"
          y="58"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={encre}
          {...detoure}
          style={{ fontFamily: "var(--font-sans), Inter, sans-serif", fontWeight: 800, letterSpacing: "-0.04em" }}
          fontSize={n >= 3 ? 30 : n === 2 ? 38 : 46}
        >
          {initiales}
        </text>
      ) : (
        <>
          <g transform={sousIcone ? "translate(50 46) scale(0.86) translate(-50 -52)" : undefined}>
            <Icone embleme={b.embleme} couleur={encre} fond={c1} />
          </g>
          {sousIcone && (
            <text
              x="50"
              y="82"
              textAnchor="middle"
              dominantBaseline="middle"
              fill={encre}
              {...detoure}
              style={{ fontFamily: "var(--font-sans), Inter, sans-serif", fontWeight: 800, letterSpacing: "0.06em" }}
              fontSize={12}
            >
              {initiales}
            </text>
          )}
        </>
      )}
    </svg>
  );
}

/** La place d'une équipe qu'on n'a pas encore : le blason en pointillé. */
export function EcussonVide({ taille = 48, className }: { taille?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 106" width={taille} height={taille * 1.06} className={className} aria-hidden>
      <path d={ECU} fill="none" stroke="currentColor" strokeWidth={2.5} strokeDasharray="7 6" strokeLinejoin="round" />
    </svg>
  );
}
