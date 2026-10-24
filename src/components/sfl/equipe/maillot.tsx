// Le maillot d'une équipe de Bola Team, de face, dessiné d'après son
// écusson (lib/sfl/blason.ts). Depuis le 24/10 au soir (Sabri : « un truc
// beaucoup plus abouti […] qui ne fasse pas plat »), un vrai maillot de
// match :
//   · la coupe d'aujourd'hui : épaules tombantes, manches raglan (la couture
//     part du col vers l'aisselle), taille un peu cintrée, bas arrondi ;
//   · le col rond en côte dans la troisième couleur, sa petite encoche en V,
//     l'intérieur du dos qu'on voit par l'encolure ; les poignets de la même
//     couleur ;
//   · le motif de l'écusson coupé à la mesure d'un maillot (rayures fines,
//     cerceaux, bande, écharpe, chevron…) ;
//   · le tissu : le volume du torse (plus sombre sur les flancs, deux
//     panneaux de côté), la lumière en haut à gauche, des plis doux qui
//     partent des aisselles et du bas des flancs, une maille fine quand le
//     maillot est grand, une ombre au sol ;
//   · l'écusson sur le cœur et la marque BOLA en face (son logotype).
// Un liseré gris pour qu'un maillot blanc se voie sur l'app claire. Tout est
// dessiné, sans filtre ni image importée (règles officielles, Q17).

import { useId } from "react";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { blasonParDefaut, contraste, encreSur, melange, type Blason, type Motif } from "@/lib/sfl/blason";
import type { Fond } from "@/lib/sfl/equipes";

const CORPS =
  "M47.5 11.5C42.5 13.6 35.5 16.4 29.5 19.4C23 22.6 17.6 30 13.4 38.6L23.6 48.2C27.4 45.6 31.2 43 34.6 41.2C35.2 52.5 36.8 62 36.6 72C36.4 83 35.6 94 35.8 104.6C51.2 108.6 68.8 108.6 84.2 104.6C84.4 94 83.6 83 83.4 72C83.2 62 84.8 52.5 85.4 41.2C88.8 43 92.6 45.6 96.4 48.2L106.6 38.6C102.4 30 97 22.6 90.5 19.4C84.5 16.4 77.5 13.6 72.5 11.5C69.5 17 65 20 60 20C55 20 50.5 17 47.5 11.5Z";
// Le dos du col, vu par l'encolure.
const DOS = "M47.5 11.5C51 9.8 55.5 9 60 9C64.5 9 69 9.8 72.5 11.5C69.5 17 65 20 60 20C55 20 50.5 17 47.5 11.5Z";
const ENCOLURE = "M47.5 11.5C50.5 17 55 20 60 20C65 20 69.5 17 72.5 11.5";
const ENCOLURE_DOS = "M47.5 11.5C51 9.8 55.5 9 60 9C64.5 9 69 9.8 72.5 11.5";
const POIGNETS = "M13.4 38.6L23.6 48.2L26.2 45.6L16.2 36.2Z M106.6 38.6L96.4 48.2L93.8 45.6L103.8 36.2Z";
const RAGLAN = "M51.2 15.9C46 23 40 32.5 34.6 41.2 M68.8 15.9C74 23 80 32.5 85.4 41.2";
// Les plis : partis des aisselles vers la taille, deux au bas des flancs.
const PLIS = "M37 44.5C41 51 44.5 58 46.4 66 M83 44.5C79 51 75.5 58 73.6 66 M38.6 92C42 96 44.4 99.5 46 103 M81.4 92C78 96 75.6 99.5 74 103";
const PLIS_CLAIRS = "M39.6 43.6C43.6 50.4 47 57.4 48.8 65.2 M80.4 43.6C76.4 50.4 73 57.4 71.2 65.2";
// Les panneaux de côté, de l'aisselle au bas.
const FLANCS = "M34.6 41.2C35.2 52.5 36.8 62 36.6 72C36.4 83 35.6 94 35.8 104.6L40.4 105.4C40 94 40.8 83 41 72C41.2 62 39.6 52.5 38.8 42.6Z M85.4 41.2C84.8 52.5 83.2 62 83.4 72C83.6 83 84.4 94 84.2 104.6L79.6 105.4C80 94 79.2 83 79 72C78.8 62 80.4 52.5 81.2 42.6Z";
// Le logotype BOLA (public/bola/logo-blanc.svg, 1000 × 237), pour la poitrine
// (et pour la couverture d'une équipe, couverture.tsx).
export const BOLA =
  "M150.41,214.268h135.756c37.685,0,77.524-16.92,90.359-56.07,1.089,6.989,3.247,13.767,6.551,20.183,22.256,43.233,88.036,53.704,146.925,23.388,22.217-11.437,40.279-27.046,52.964-44.372l-16.428,56.871h187.534l18.794-31.682h66.27l2.906,31.682h91.654l-27.564-181.823h-116.486l-80.903,127.983h-52.168l42.861-127.983h-80.374l-16.212,56.123c-1.099-6.913-3.248-13.618-6.517-19.968-22.256-43.233-88.036-53.704-146.925-23.389-41.471,21.349-68.464,57.232-73.032,91.69-3.028-8.359-9.347-14.684-17.738-17.911l-7.439-2.861c22.822-7.486,49.416-26.571,49.416-53.124,0-24.206-25.65-30.559-45.101-30.559h-132.212l-72.887,181.823ZM460.577,102.781c15.468-20.581,40.511-27.866,55.936-16.274,15.425,11.593,15.391,37.675-.077,58.255-15.467,20.58-40.511,27.866-55.936,16.273-15.425-11.593-15.391-37.675.076-58.255ZM799.323,141.12l35.058-55.744,3.598,55.744h-38.656ZM261.801,139.198h25.214c4.877,0,8.904,5.1,8.904,10.132,0,10.874-11.926,19.419-18.462,19.419h-27.021l11.364-29.552ZM286.573,75.622h22.203c4.938,0,8.307,4.316,8.307,9.187,0,8.268-9.079,17.02-16.663,17.02h-23.917l10.07-26.207ZM129.373,159.672c0-31.031-25.156-56.187-56.187-56.187s-56.186,25.156-56.186,56.187,25.155,56.186,56.186,56.186c2.52,0,5.001-.166,7.433-.487-16.402-2.773-28.894-17.047-28.894-34.238,0-19.178,15.547-34.725,34.725-34.725s34.725,15.547,34.725,34.725c0,3.507-.52,6.892-1.487,10.084,6.112-8.993,9.684-19.852,9.684-31.545Z";

/** Le motif de l'écusson, à la mesure d'un maillot (torse de 34 à 86, du col à 108). */
function MotifMaillot({ motif, couleur }: { motif: Motif; couleur: string }) {
  switch (motif) {
    case "uni":
      return null;
    case "parti":
      return <rect x={60} y={0} width={60} height={120} fill={couleur} />;
    case "coupe":
      return <rect x={0} y={63} width={120} height={60} fill={couleur} />;
    case "tranche":
      return <polygon points="120,6 120,120 0,120 0,112" fill={couleur} />;
    case "rayures": {
      // Sept bandes sur le torse, les mêmes jusqu'au bout des manches.
      const l = 52 / 7;
      return (
        <g fill={couleur}>
          {[-5, -3, -1, 1, 3, 5, 7, 9].map((i) => (
            <rect key={i} x={34 + i * l} y={0} width={l} height={120} />
          ))}
        </g>
      );
    }
    case "bande":
      return <rect x={50} y={0} width={20} height={120} fill={couleur} />;
    case "echarpe":
      return <line x1={26} y1={14} x2={94} y2={110} stroke={couleur} strokeWidth={17} />;
    case "chevron":
      return <polyline points="22,30 60,58 98,30" fill="none" stroke={couleur} strokeWidth={11} strokeLinejoin="miter" />;
    case "cercle": {
      const l = 88 / 7;
      return (
        <g fill={couleur}>
          {[1, 3, 5].map((i) => (
            <rect key={i} x={0} y={20 + i * l} width={120} height={l} />
          ))}
        </g>
      );
    }
  }
}

export function Maillot({
  initiales,
  fond,
  blason,
  taille = 120,
  className,
}: {
  initiales: string;
  fond: Fond;
  blason?: Blason | null;
  taille?: number;
  className?: string;
}) {
  const id = `ml-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const b = blason ?? blasonParDefaut(fond);
  const [c1, c2, c3] = b.couleurs;
  const grand = taille >= 96;
  // La marque, dans la troisième couleur quand elle se lit sur le fond, sinon
  // dans l'encre ; cernée quand le motif passe dessous dans une couleur proche.
  const marque = contraste(c3, c1) >= 1.8 ? c3 : encreSur(c1);
  return (
    <svg viewBox="0 0 120 120" width={taille} height={taille} className={className} role="img" aria-label={`Maillot ${initiales}`}>
      <defs>
        <clipPath id={`${id}-c`}>
          <path d={CORPS} />
        </clipPath>
        <radialGradient id={`${id}-s`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity={0.38} />
          <stop offset="1" stopColor="#000" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}-v`} gradientUnits="userSpaceOnUse" x1="34" y1="0" x2="86" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity={0.34} />
          <stop offset="0.2" stopColor="#000" stopOpacity={0.06} />
          <stop offset="0.36" stopColor="#fff" stopOpacity={0.07} />
          <stop offset="0.6" stopColor="#000" stopOpacity={0} />
          <stop offset="0.82" stopColor="#000" stopOpacity={0.1} />
          <stop offset="1" stopColor="#000" stopOpacity={0.38} />
        </linearGradient>
        <linearGradient id={`${id}-h`} gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="110">
          <stop offset="0" stopColor="#fff" stopOpacity={0.12} />
          <stop offset="0.3" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.8" stopColor="#000" stopOpacity={0.04} />
          <stop offset="1" stopColor="#000" stopOpacity={0.22} />
        </linearGradient>
        <linearGradient id={`${id}-m`} gradientUnits="userSpaceOnUse" x1="12" y1="32" x2="35" y2="46">
          <stop offset="0" stopColor="#000" stopOpacity={0.05} />
          <stop offset="1" stopColor="#000" stopOpacity={0.3} />
        </linearGradient>
        <linearGradient id={`${id}-n`} gradientUnits="userSpaceOnUse" x1="108" y1="32" x2="85" y2="46">
          <stop offset="0" stopColor="#000" stopOpacity={0.1} />
          <stop offset="1" stopColor="#000" stopOpacity={0.36} />
        </linearGradient>
        {grand && (
          <pattern id={`${id}-t`} width="1.6" height="1.6" patternUnits="userSpaceOnUse">
            <circle cx="0.8" cy="0.8" r="0.32" fill="#000" opacity={0.11} />
          </pattern>
        )}
      </defs>
      <ellipse cx={60} cy={111.5} rx={32} ry={4} fill={`url(#${id}-s)`} />
      <path d={DOS} fill={melange(c1, "#000000", 0.45)} />
      <path d={ENCOLURE_DOS} fill="none" stroke={melange(c3, "#000000", 0.25)} strokeWidth={2.6} />
      <g clipPath={`url(#${id}-c)`}>
        <rect width={120} height={120} fill={c1} />
        <MotifMaillot motif={b.motif} couleur={c2} />
        {grand && <rect width={120} height={120} fill={`url(#${id}-t)`} />}
        <rect x={30} width={60} height={120} fill={`url(#${id}-v)`} />
        <rect width={120} height={120} fill={`url(#${id}-h)`} />
        <path d="M0 0H35V60H0Z" fill={`url(#${id}-m)`} />
        <path d="M85 0H120V60H85Z" fill={`url(#${id}-n)`} />
        <path d={FLANCS} fill="#000" opacity={0.09} />
        <path d={PLIS} fill="none" stroke="#000" strokeOpacity={0.04} strokeWidth={6.5} strokeLinecap="round" />
        <path d={PLIS} fill="none" stroke="#000" strokeOpacity={0.045} strokeWidth={2.6} strokeLinecap="round" />
        <path d={PLIS_CLAIRS} fill="none" stroke="#fff" strokeOpacity={0.06} strokeWidth={3} strokeLinecap="round" />
        <path d={RAGLAN} fill="none" stroke="#000" strokeOpacity={0.22} strokeWidth={0.7} />
        <path d={RAGLAN} transform="translate(0.6 0.3)" fill="none" stroke="#fff" strokeOpacity={0.12} strokeWidth={0.5} />
        <path d={POIGNETS} fill={c3} />
        <path d={POIGNETS} fill="none" stroke="#000" strokeOpacity={0.18} strokeWidth={0.6} />
      </g>
      <path d={ENCOLURE} fill="none" stroke={c3} strokeWidth={3.2} strokeLinecap="round" />
      <path d={ENCOLURE} transform="translate(0 1.5)" fill="none" stroke="#000" strokeOpacity={0.14} strokeWidth={1} strokeLinecap="round" />
      <path d="M57.6 19.7L60 24.2L62.4 19.7" fill="none" stroke={c3} strokeWidth={1.3} strokeLinejoin="round" />
      <path d={CORPS} fill="none" stroke="rgba(128,128,128,0.55)" strokeWidth={1} strokeLinejoin="round" />
      <path
        d={BOLA}
        transform="translate(37.6 29.6) scale(0.0165)"
        fill={marque}
        fillRule="evenodd"
        {...(b.motif !== "uni" && contraste(marque, c2) < 1.8 ? { stroke: encreSur(marque), strokeOpacity: 0.55, strokeWidth: 26, paintOrder: "stroke" as const } : {})}
      />
      <g transform="translate(66.4 25.4)">
        <Ecusson initiales={initiales} fond={fond} blason={b} taille={14} />
      </g>
    </svg>
  );
}
