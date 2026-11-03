// Les puces des titres d'un match, posées sur une carte : dorée pour le MVP,
// rouge pour le joueur Impact, bleue pour la Défensive (Ilyes, 02/11/2026).
// Une puce par titre, dans l'ordre MVP, Impact, Défensive ; rien quand le
// joueur n'a pas de titre. Aucun texte : le nom de chaque puce est pour les
// lecteurs d'écran seulement.
//
// Rondes et nettes, avec un liseré fin (blanc, puis un filet sombre) qui les
// détache d'une carte claire comme d'une carte sombre. Leurs couleurs sont
// celles des cartes à titre (tokens.css, --titre-*). Le même composant sur
// tous les terrains ; quels titres porter : lib/sfl/puces-titres.ts, lus par
// hooks/use-titres-du-jour.ts.
//
// Elles se posent en absolu sur le coin haut gauche de la carte (le haut à
// droite et le haut au centre sont déjà pris ailleurs : badges, croix,
// étiquettes de titres) et ne changent donc aucune mise en page. En arabe
// aussi, de gauche à droite (dir="ltr") : la carte garde sa mise en page, et
// ses puces leur ordre.

import type { CSSProperties } from "react";
import type { BoostType } from "@/lib/sfl/engine";
import { NOM_PUCE } from "@/lib/sfl/puces-titres";
import { cn } from "@/lib/utils";

const COULEUR: Record<BoostType, string> = {
  mvp: "var(--titre-mvp)",
  impact: "var(--titre-impact)",
  def: "var(--titre-def)",
};

/** Le diamètre d'une puce à l'écran, en px. */
const DIAMETRE = 8;

export function PucesTitres({
  titres,
  echelle = 1,
  coin = true,
  className,
  style,
}: {
  titres: readonly BoostType[];
  /**
   * L'échelle de ce qui la contient (une carte au fond d'un terrain en
   * perspective, réduite à 0,7) : la puce garde à peu près sa taille à l'écran.
   */
  echelle?: number;
  /** Posée sur le coin haut gauche de son parent (relative) ; false : dans le flux. */
  coin?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  if (!titres.length) return null;
  const d = Math.min(13, Math.max(6, DIAMETRE / (echelle || 1)));
  return (
    <span
      // Toujours de gauche à droite, même en arabe : les puces se lisent dans
      // l'ordre MVP, Impact, Défensive, sur une carte qui garde sa mise en page.
      dir="ltr"
      className={cn(
        "pointer-events-none flex items-center",
        coin && "absolute z-[1]",
        className,
      )}
      // Sur le coin, un peu au dehors : la puce déborde de la carte sans en couvrir la note.
      style={{ gap: d * 0.3, ...(coin ? { top: -d * 0.4, left: -d * 0.4 } : {}), ...style }}
    >
      {titres.map((t) => (
        <span
          key={t}
          role="img"
          aria-label={NOM_PUCE[t]}
          className="block shrink-0 rounded-full"
          style={{
            width: d,
            height: d,
            background: COULEUR[t],
            boxShadow: `0 0 0 ${Math.max(1, d * 0.16)}px rgba(255,255,255,0.92), 0 0 0 ${Math.max(1.5, d * 0.16 + 0.75)}px rgba(0,0,0,0.22)`,
          }}
        />
      ))}
    </span>
  );
}
