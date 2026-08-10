// Icônes de la tab bar — tracés SVG copiés tels quels du design de référence
// (ballon de foot pour le feed, bulle, joueur, sac de la boutique).

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
