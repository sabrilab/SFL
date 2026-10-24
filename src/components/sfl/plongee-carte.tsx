"use client";

// Plonger dans sa carte. Sabri, 24/10 : « appuyer longtemps sur sa carte […]
// On plonge dans sa carte », avec « des générations 6s 2.5 offertes ». Les
// paliers 18 et 19 du Passe Bola (lib/sfl/passe.ts) offrent une séquence de
// 6 s du joueur (Seedance 2.5), jouée par un appui long sur sa carte. Rien
// n'est généré sans l'accord de Sabri : en attendant, la plongée joue la
// photo du joueur dans le thème du palier, marquée « Aperçu » :
//   · « transformation » (18) : l'aura blanche qui respire, les éclairs, les
//     étincelles qui montent (le ki, palier 14 : pas d'or, il reste aux
//     cartes à titre) ;
//   · « ombre » (19) : le noir et blanc dur, une lumière qui découpe la
//     silhouette.
// La vidéo, quand elle existera, prend la place de la photo : muette, jouée
// une fois.
//   · useAppuiLong : l'appui long (450 ms sans bouger de plus de 8 px : un
//     glissé fait tourner la carte 3D, pas plonger), une vibration courte,
//     sans le menu du système ;
//   · Plongee : la carte grandit jusqu'à remplir l'écran, on passe dedans, la
//     séquence joue (sa barre en haut, comme une story), puis on en ressort.
//     Un toucher, Échap ou la fin la referment. Elle se rend dans l'arbre
//     React de la feuille qui l'ouvre (un portail vers body) : la toucher ne
//     ferme pas la feuille (Base UI la compte dedans), et Échap ne ferme
//     qu'elle.
// En mouvement réduit, la séquence arrive en fondu, sans plongée ni éclair ;
// les éclairs ne passent jamais plus d'une fois par seconde (passe-bola.css).

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type ThemePlongee = "transformation" | "ombre";

/** Les gestes d'un appui long, à poser sur l'élément qu'on presse. */
export function useAppuiLong(onAppui: () => void, delai = 450) {
  const rappel = useRef(onAppui);
  const minuteur = useRef<number | null>(null);
  const depart = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    rappel.current = onAppui;
  }, [onAppui]);
  const annule = useCallback(() => {
    if (minuteur.current !== null) window.clearTimeout(minuteur.current);
    minuteur.current = null;
    depart.current = null;
  }, []);
  useEffect(() => annule, [annule]);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      annule();
      depart.current = { x: e.clientX, y: e.clientY };
      minuteur.current = window.setTimeout(() => {
        minuteur.current = null;
        depart.current = null;
        navigator.vibrate?.(12);
        rappel.current();
      }, delai);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = depart.current;
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) annule();
    },
    onPointerUp: annule,
    onPointerCancel: annule,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    style: { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } as React.CSSProperties,
  };
}

// Deux éclairs dans le repère de l'écran (100 × 100, étiré) : un de chaque côté, qui monte.
const ECLAIRS = [
  "M14 92L18 80L11 71L19 60L13 50L20 38L15 27",
  "M86 88L81 77L89 66L82 55L88 44L80 33L86 22",
];

/** Les étincelles de l'aperçu « transformation » : leur place et leur départ, fixes. */
const ETINCELLES = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37 + 11) % 96}%`,
  delai: `${((i * 0.37) % 2.6).toFixed(2)}s`,
  taille: 2 + (i % 3),
}));

export function Plongee({
  carte,
  photo,
  video,
  theme,
  duree = 6,
  onFin,
}: {
  /** La carte d'où l'on part : elle grandit jusqu'à remplir l'écran. */
  carte: ReactNode;
  photo: string | null;
  /** La séquence générée, quand elle existera. */
  video?: string | null;
  theme: ThemePlongee;
  duree?: number;
  onFin: () => void;
}) {
  const [sortie, setSortie] = useState(false);
  const fermer = useCallback(() => setSortie(true), []);
  // La sortie dure 0,3 s (plongee-sortie), puis la plongée disparaît.
  useEffect(() => {
    if (!sortie) return;
    const id = window.setTimeout(onFin, 300);
    return () => window.clearTimeout(id);
  }, [sortie, onFin]);
  // La séquence finie (après les 0,6 s de plongée), on ressort.
  useEffect(() => {
    const id = window.setTimeout(fermer, (duree + 0.6) * 1000);
    return () => window.clearTimeout(id);
  }, [duree, fermer]);
  // Échap ne ferme que la plongée, pas la feuille dessous (son écoute est sur document).
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      fermer();
    };
    window.addEventListener("keydown", touche, true);
    return () => window.removeEventListener("keydown", touche, true);
  }, [fermer]);

  return createPortal(
    <div
      role="dialog"
      aria-modal
      aria-label="Ta séquence"
      className={cn("plongee", `plongee--${theme}`, sortie && "plongee--sortie")}
      style={{ "--duree": `${duree}s` } as React.CSSProperties}
      onClick={fermer}
    >
      <div className="plongee__carte" aria-hidden>
        {carte}
      </div>
      <div className="plongee__media">
        {video ? (
          <video src={video} autoPlay muted playsInline onEnded={fermer} />
        ) : photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="plongee__photo" src={photo} alt="" draggable={false} />
        ) : (
          <div className="plongee__photo" />
        )}
        {!video && theme === "transformation" && (
          <>
            <div className="plongee__aura" />
            <svg className="plongee__eclairs" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {ECLAIRS.map((d) => (
                <g key={d} fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
                  <path d={d} stroke="rgb(255 255 255 / 0.25)" strokeWidth={8} vectorEffect="non-scaling-stroke" />
                  <path d={d} stroke="#ffffff" strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
                </g>
              ))}
            </svg>
            <div className="plongee__etincelles">
              {ETINCELLES.map((e, i) => (
                <i key={i} style={{ left: e.left, animationDelay: e.delai, width: e.taille, height: e.taille }} />
              ))}
            </div>
          </>
        )}
        {!video && theme === "ombre" && <div className="plongee__lumiere" />}
        <div className="plongee__voile" />
        <div className="plongee__temps">
          <span />
        </div>
        {!video && <span className="plongee__legende mono-label">Aperçu · {duree} s</span>}
      </div>
    </div>,
    document.body
  );
}
