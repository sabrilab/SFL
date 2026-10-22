// Icônes de la tab bar — tracés SVG copiés tels quels du design de référence
// (ballon de foot pour le feed, bulle, joueur, sac de la boutique), plus
// l'épingle de la Map.

interface IconProps {
  stroke: string;
}

export function BallIcon({ stroke }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.4l3.1 2.3-1.2 3.7h-3.8l-1.2-3.7z" />
      <path d="M12 3v4.4M20.4 9.6l-4.5.1M18.1 19.4l-2.7-3.5M5.9 19.4l2.7-3.5M3.6 9.6l4.5.1" />
    </svg>
  );
}

export function BubbleIcon({ stroke }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 11.5c0 4.1-3.8 7.4-8.5 7.4-1 0-2-.15-2.9-.42L4.2 20.3l1.3-3.3C4.1 15.5 3.5 13.6 3.5 11.5 3.5 7.4 7.3 4.1 12 4.1s8.5 3.3 8.5 7.4z" />
    </svg>
  );
}

export function PersonIcon({ stroke }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8.1" r="3.7" />
      <path d="M4.9 20.4c0-3.6 3.2-6 7.1-6s7.1 2.4 7.1 6" />
    </svg>
  );
}

export function BagIcon({ stroke }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.4 8.2h13.2l-1 12.1H6.4z" />
      <path d="M9.1 8.2V6.5a2.9 2.9 0 0 1 5.8 0v1.7" />
    </svg>
  );
}


/* ── La barre d'onglets iOS 26 : symboles au trait, pleins quand choisis ── */
// Dessinés d'après les SF Symbols de l'app iPhone : mappin, person.text.rectangle,
// trophy. currentColor : la barre décide de l'encre (noire sur verre clair).

interface SymboleProps {
  plein?: boolean;
}

const symbole = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function MapIcon({ plein }: SymboleProps) {
  return (
    <svg {...symbole} fill="none">
      <path
        d="M12 21.2s-6.6-5.8-6.6-10.6a6.6 6.6 0 0 1 13.2 0c0 4.8-6.6 10.6-6.6 10.6z"
        fill={plein ? "currentColor" : "none"}
      />
      <circle cx="12" cy="10.5" r="2.4" fill={plein ? "var(--tabbar-trou)" : "none"} stroke={plein ? "none" : "currentColor"} />
    </svg>
  );
}

export function CarteIcon({ plein }: SymboleProps) {
  return (
    <svg {...symbole} fill="none">
      <rect x="2.6" y="5" width="18.8" height="14" rx="3.2" fill={plein ? "currentColor" : "none"} />
      <g stroke={plein ? "var(--tabbar-trou)" : "currentColor"} fill="none">
        <circle cx="8.6" cy="10.4" r="1.9" fill={plein ? "var(--tabbar-trou)" : "none"} />
        <path d="M5.6 15.6c.5-1.6 1.6-2.4 3-2.4s2.5.8 3 2.4" />
        <path d="M14.4 10h3.6M14.4 13.4h3.6" />
      </g>
    </svg>
  );
}

export function TropheeIcon({ plein }: SymboleProps) {
  return (
    <svg {...symbole} fill="none">
      <path d="M7.4 4h9.2v5.2a4.6 4.6 0 0 1-9.2 0z" fill={plein ? "currentColor" : "none"} />
      <path d="M7.4 6H4.6v1.4a3 3 0 0 0 3 3M16.6 6h2.8v1.4a3 3 0 0 1-3 3" />
      <path d="M12 13.8v3.4M8.6 20.2h6.8M9.6 20.2c0-1.7 1-3 2.4-3s2.4 1.3 2.4 3" fill={plein ? "currentColor" : "none"} />
    </svg>
  );
}

/** Les Actus (play.rectangle.on.rectangle) : une image du fil et sa lecture, une autre derrière. */
export function ActusIcon({ plein }: SymboleProps) {
  return (
    <svg {...symbole} fill="none">
      <path d="M6.2 4.2h11.6" />
      <rect x="3.4" y="7.2" width="17.2" height="12.6" rx="3" fill={plein ? "currentColor" : "none"} />
      <path d="M10.4 10.6v5.8l4.9-2.9z" fill={plein ? "var(--tabbar-trou)" : "currentColor"} stroke={plein ? "var(--tabbar-trou)" : "currentColor"} strokeWidth={1.2} />
    </svg>
  );
}

export function RechercheIcon({ plein }: SymboleProps) {
  return (
    <svg {...symbole} width={24} height={24} fill="none" strokeWidth={plein ? 2.4 : 1.9}>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="M15.6 15.6l4.6 4.6" />
    </svg>
  );
}

/** La bulle du Vestiaire (bubble.left.and.bubble.right) : deux bulles, la
 *  sienne devant celle d'un pote. Pleine quand on y est. */
export function VestiaireIcon({ plein }: SymboleProps) {
  return (
    <svg {...symbole} fill="none">
      <path
        d="M16.9 8.2c2.5.5 4.3 2.4 4.3 4.7 0 1.2-.5 2.3-1.3 3.1l.6 2.6-2.6-1.2c-.6.2-1.3.3-2 .3-1.6 0-3-.5-4-1.4"
        fill="none"
      />
      <path
        d="M10.2 4.4c3.7 0 6.6 2.4 6.6 5.4s-2.9 5.4-6.6 5.4c-.8 0-1.6-.1-2.3-.3l-3.4 1.6.8-3.1C4.2 12.4 3.6 11.2 3.6 9.8c0-3 2.9-5.4 6.6-5.4z"
        fill={plein ? "currentColor" : "none"}
      />
    </svg>
  );
}
