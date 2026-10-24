// L'écusson d'une équipe du mode Team. Depuis le 24/10 (Sabri : « designer
// un vrai écusson d'équipe et choisir de vraies couleurs »), chaque équipe
// dessine le sien (lib/sfl/blason.ts) : une forme, un motif dans sa
// deuxième couleur, un cerclage et un emblème dans la troisième. Sans
// écusson dessiné, celui des débuts : noir et blanc, les initiales au cœur.
//
// Le soir même, Sabri : « un truc beaucoup plus abouti, qui ne fasse pas
// plat […] comme on est fiers de notre logo de club, de nos maillots ».
// L'écusson est donc frappé comme un insigne de club, en émail et métal :
//   · un cerclage de métal (lib/sfl/blason.ts, metal() : l'or donne de
//     l'or, le blanc et l'argent de l'argent, le noir un chrome noir, les
//     autres un métal anodisé) à biseau, clair en haut à gauche, sombre en
//     bas à droite ;
//   · un champ d'émail, la forme et son motif, bombé (un reflet en haut, plus
//     sombre en bas), où le cerclage pose son ombre ; un guilloché en soleil
//     quand l'écusson est grand ;
//   · l'emblème en relief (equipe/emblemes.ts : les animaux et les figures,
//     taillés en facettes) : son ombre portée, son arête claire, son métal,
//     ses facettes d'ombre et de lumière ;
//   · sous une figure, les initiales sur un ruban de métal, quand on peut
//     les lire (56 px et plus) ; seules, les initiales sont frappées au
//     cœur, en Anton (« les cartes et les écussons gardent leurs lettres »).
// En petit (moins de 40 px : classements, feuilles), le relief se simplifie :
// cerclage plus large, ni ombre portée ni guilloché, pour rester net.
//
// Tout tient dans la même boîte (100 × 106) qu'avant : aucune mise en page
// ne bouge. Ombres et reflets sont dessinés (pas de filtre), pour sortir
// pareil des images partagées. Pas d'image importée (règles officielles, Q17).

import { useId } from "react";
import { blasonParDefaut, contraste, couleurEmbleme, encreSur, metal, type Blason, type Forme, type Motif } from "@/lib/sfl/blason";
import { DESSINS } from "@/components/sfl/equipe/emblemes";
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

// Le guilloché en soleil : 30 rayons fins depuis le cœur de l'écusson.
const SOLEIL = Array.from({ length: 30 }, (_, k) => {
  const a = (k * 12 * Math.PI) / 180;
  const b = ((k * 12 + 5) * Math.PI) / 180;
  const p = (t: number) => `${(50 + 90 * Math.cos(t)).toFixed(1)} ${(50 + 90 * Math.sin(t)).toFixed(1)}`;
  return `M50 50L${p(a)}L${p(b)}Z`;
}).join("");

// Le ruban sous la figure : la bande, ses deux queues repliées derrière, et la
// ligne où courent les initiales.
const RUBAN = {
  bande: "M15 73.5 Q50 81.5 85 73.5 L85 86.5 Q50 94.5 15 86.5 Z",
  queues: "M19 79 L4.5 80.5 L9.5 86.2 L4.5 92 L19 90.5 Z M81 79 L95.5 80.5 L90.5 86.2 L95.5 92 L81 90.5 Z",
  plis: "M15 86.5 L19 90.5 L19 85.6 Z M85 86.5 L81 90.5 L81 85.6 Z",
  ligne: "M17 83.6 Q50 91.6 83 83.6",
};

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
  const m = metal(c3);
  const me = metal(encre);
  const detail = taille >= 40;
  const riche = taille >= 64;
  const n = initiales.length;
  const ruban = b.embleme !== "initiales" && taille >= 56 && n > 0;
  const bord = detail ? 5.2 : 7;
  // L'encre des initiales sur le ruban : creusée dans le métal.
  const surRuban = contraste(c1, m.base) >= 2.2 ? c1 : encreSur(m.base);
  const dessin = b.embleme === "initiales" ? null : DESSINS[b.embleme];
  const relief = (contenu: React.ReactNode) => (
    <>
      {detail && (
        <g transform="translate(0.9 1.7)" fill="#000" opacity={0.42}>
          {contenu}
        </g>
      )}
      <g transform={detail ? "translate(-0.5 -0.6)" : "translate(0.6 0.9)"} fill={detail ? me.reflet : "#000"} opacity={detail ? 1 : 0.35}>
        {contenu}
      </g>
      <g fill={`url(#${id}-e)`}>{contenu}</g>
    </>
  );
  return (
    <svg viewBox="0 0 100 106" width={taille} height={taille * 1.06} className={className} role="img" aria-label={initiales}>
      <defs>
        <clipPath id={`${id}-f`}>
          <path d={forme} />
        </clipPath>
        <linearGradient id={`${id}-m`} gradientUnits="userSpaceOnUse" x1="16" y1="2" x2="84" y2="104">
          <stop offset="0" stopColor={m.reflet} />
          <stop offset="0.24" stopColor={m.clair} />
          <stop offset="0.48" stopColor={m.base} />
          <stop offset="0.6" stopColor={m.sombre} />
          <stop offset="0.76" stopColor={m.clair} />
          <stop offset="1" stopColor={m.sombre} />
        </linearGradient>
        <linearGradient id={`${id}-b`} gradientUnits="userSpaceOnUse" x1="20" y1="4" x2="80" y2="102">
          <stop offset="0" stopColor="#fff" stopOpacity={0.85} />
          <stop offset="0.5" stopColor="#fff" stopOpacity={0.15} />
          <stop offset="1" stopColor="#000" stopOpacity={0.35} />
        </linearGradient>
        <linearGradient id={`${id}-e`} gradientUnits="userSpaceOnUse" x1="30" y1="22" x2="70" y2="86">
          <stop offset="0" stopColor={me.reflet} />
          <stop offset="0.3" stopColor={me.clair} />
          <stop offset="0.62" stopColor={me.base} />
          <stop offset="1" stopColor={me.sombre} />
        </linearGradient>
        <radialGradient id={`${id}-d`} gradientUnits="userSpaceOnUse" cx="40" cy="18" r="70">
          <stop offset="0" stopColor="#fff" stopOpacity={0.3} />
          <stop offset="0.6" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}-v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.5" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.34} />
        </linearGradient>
        {ruban && <path id={`${id}-l`} d={RUBAN.ligne} />}
      </defs>
      {detail && (
        <>
          <path d={forme} transform="translate(0 2.4)" fill="#000" opacity={0.16} />
          <path d={forme} transform="translate(0 1.2)" fill="#000" opacity={0.2} />
        </>
      )}
      <g clipPath={`url(#${id}-f)`}>
        <rect width={100} height={106} fill={c1} />
        <DessinMotif motif={b.motif} couleur={c2} w={100} h={106} />
        {riche && <path d={SOLEIL} fill="#fff" opacity={0.045} />}
        <rect width={100} height={106} fill={`url(#${id}-d)`} />
        <rect width={100} height={106} fill={`url(#${id}-v)`} />
        {detail && (
          <>
            <path d={forme} fill="none" stroke="#000" strokeOpacity={0.14} strokeWidth={2 * (bord + 3.4)} />
            <path d={forme} fill="none" stroke="#000" strokeOpacity={0.22} strokeWidth={2 * (bord + 1.6)} />
          </>
        )}
        <path d={forme} fill="none" stroke={m.sombre} strokeWidth={2 * (bord + 0.7)} />
        <path d={forme} fill="none" stroke={`url(#${id}-m)`} strokeWidth={2 * bord} />
        {detail && <path d={forme} fill="none" stroke={`url(#${id}-b)`} strokeWidth={2.4} />}
      </g>
      <path d={forme} fill="none" stroke={m.sombre} strokeOpacity={0.55} strokeWidth={0.8} />
      {dessin ? (
        <>
          <g transform={ruban ? "translate(50 44.5) scale(0.8) translate(-50 -52)" : undefined}>
            <clipPath id={`${id}-s`}>
              <path d={dessin.d} />
            </clipPath>
            {relief(<path d={dessin.d} />)}
            {detail && <path d={dessin.d} fill="none" stroke={me.sombre} strokeWidth={0.7} strokeLinejoin="round" />}
            <g clipPath={`url(#${id}-s)`}>
              {dessin.facettes?.map((f, i) => (
                <path key={i} d={f.d} fillRule="evenodd" fill={f.ton > 0 ? me.reflet : me.sombre} opacity={f.ton > 0 ? 0.5 : 0.55} />
              ))}
              {dessin.creux && <path d={dessin.creux} fill={me.sombre} fillRule="evenodd" />}
            </g>
          </g>
          {ruban && (
            <g>
              <path d={RUBAN.queues} fill={m.sombre} />
              <path d={RUBAN.plis} fill="#000" opacity={0.45} />
              <path d={RUBAN.bande} transform="translate(0 1.2)" fill="#000" opacity={0.3} />
              <path d={RUBAN.bande} fill={`url(#${id}-m)`} />
              <path d={RUBAN.bande} fill="none" stroke={m.sombre} strokeWidth={0.6} />
              <text
                fill={surRuban}
                fontSize={9.6}
                style={{ fontFamily: "var(--font-anton), Anton, sans-serif", letterSpacing: "0.12em" }}
                textAnchor="middle"
              >
                <textPath href={`#${id}-l`} startOffset="50%">
                  {initiales}
                </textPath>
              </text>
            </g>
          )}
        </>
      ) : (
        relief(
          <text
            x="50"
            y={56}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontFamily: "var(--font-anton), Anton, sans-serif", letterSpacing: "0.01em" }}
            fontSize={n >= 3 ? 38 : n === 2 ? 46 : 54}
          >
            {initiales}
          </text>
        )
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
