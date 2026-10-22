"use client";

// La collection d'une pile de joueurs, par-dessus la Map (Sabri, 22/10 :
// « en collection carousel, un slider sur le côté, et que la map soit limite
// translucide, un peu en liquid glass, pour qu'on voie encore la map
// derrière »).
//
// La Map reste là, floutée sous un verre clair ; les cartes défilent en
// travers, une à la fois au centre (aimantée), les voisines un peu en retrait.
// Toucher la carte du centre ouvre le profil, une voisine vient au centre ;
// toucher le verre ou la croix referme ; « Sur la Map » vole sur la ville.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, X } from "lucide-react";
import { PlayerCard } from "@/components/sfl/player-card";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { useSeason } from "@/components/sfl/season-provider";
import type { VillePlan } from "@/components/sfl/map/joueurs";

const PHI = (1 + Math.sqrt(5)) / 2;
/** La carte du centre : la grande, au nombre d'or au-dessus. */
const TAILLE = FORMAT_CARTE.grande * PHI;
const LARGEUR = 254 * TAILLE;
const ECART = 14;

export function CollectionPile({
  villes,
  onFermer,
  onJoueur,
  onVoir,
  masquee = false,
}: {
  /** Les villes de la pile (une pile peut en fondre plusieurs) ; vide = fermée. */
  villes: VillePlan[];
  onFermer: () => void;
  onJoueur: (name: string) => void;
  onVoir: (v: VillePlan) => void;
  /** Le temps qu'un profil est ouvert par-dessus : cachée, sans perdre sa place. */
  masquee?: boolean;
}) {
  const { players } = useSeason();
  const parNom = useMemo(() => new Map(players.map((p) => [p.name, p])), [players]);
  const joueurs = useMemo(
    () =>
      villes
        .flatMap((v) => v.joueurs)
        .sort((a, b) => b.note - a.note)
        .map((j) => parNom.get(j.name))
        .filter((p) => !!p),
    [villes, parNom]
  );
  const ouverte = villes.length > 0;
  const rail = useRef<HTMLDivElement>(null);
  const [centre, setCentre] = useState(0);
  const [entree, setEntree] = useState(false);

  // À chaque ouverture : la première carte au centre, puis l'entrée.
  useEffect(() => {
    if (!ouverte) return;
    rail.current?.scrollTo({ left: 0 });
    const t = window.setTimeout(() => {
      setCentre(0);
      setEntree(true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      setEntree(false);
    };
  }, [ouverte, villes]);

  // Échap referme.
  useEffect(() => {
    if (!ouverte) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [ouverte, onFermer]);

  function surDefile() {
    const el = rail.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / (LARGEUR + ECART));
    if (i !== centre) {
      setCentre(i);
      navigator.vibrate?.(3);
    }
  }

  function toucher(i: number, name: string) {
    if (i === centre) {
      onJoueur(name);
      return;
    }
    rail.current?.scrollTo({ left: i * (LARGEUR + ECART), behavior: "smooth" });
  }

  if (!ouverte || typeof document === "undefined") return null;
  const nom = villes.length === 1 ? villes[0].ville : villes.map((v) => v.ville).join(" · ");

  // Au-dessus de tout ce qui est posé sur la Map ; le profil d'un joueur la remplace le temps qu'il est ouvert.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={nom}
      className="collection-verre fixed inset-0 z-[1300] flex flex-col"
      data-entree={entree || undefined}
      style={masquee ? { visibility: "hidden" } : undefined}
      onClick={(e) => e.target === e.currentTarget && onFermer()}
    >
      <header
        className="pointer-events-none flex items-start justify-between gap-3 px-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 18px)" }}
      >
        <div className="min-w-0">
          <p className="mono-label text-[#0a0b0d]/55">
            {joueurs.length} joueur{joueurs.length > 1 ? "s" : ""}
          </p>
          <h2 className="truncate text-[30px] leading-[1.05] font-extrabold tracking-tight text-[#0a0b0d]">{nom}</h2>
        </div>
        <button type="button" onClick={onFermer} aria-label="Fermer" className="bouton-givre pointer-events-auto grid size-11 shrink-0 place-items-center">
          <X className="size-[18px]" strokeWidth={2.4} />
        </button>
      </header>

      <div className="flex flex-1 items-center" onClick={(e) => e.target === e.currentTarget && onFermer()}>
        <div
          ref={rail}
          onScroll={surDefile}
          className="flex w-full snap-x snap-mandatory items-center overflow-x-auto py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ gap: ECART, paddingInline: `calc(50% - ${LARGEUR / 2}px)` }}
          onClick={(e) => e.target === e.currentTarget && onFermer()}
        >
          {joueurs.map((p, i) => {
            const loin = Math.min(2, Math.abs(i - centre));
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => toucher(i, p.name)}
                aria-label={p.name}
                className="collection-carte shrink-0 snap-center"
                style={{
                  scale: String(1 - loin * 0.1),
                  opacity: 1 - loin * 0.28,
                  transitionDelay: entree ? "0ms" : `${Math.min(i, 4) * 40}ms`,
                }}
              >
                <PlayerCard player={p} size={TAILLE} />
              </button>
            );
          })}
        </div>
      </div>

      <footer
        className="flex flex-col items-center gap-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
        onClick={(e) => e.target === e.currentTarget && onFermer()}
      >
        {joueurs.length > 1 && (
          <div className="flex items-center gap-1.5" aria-hidden>
            {joueurs.slice(0, 12).map((p, i) => (
              <span
                key={p.name}
                className="h-1.5 rounded-full bg-[#0a0b0d] transition-all duration-300"
                style={{ width: i === Math.min(centre, 11) ? 16 : 6, opacity: i === Math.min(centre, 11) ? 0.85 : 0.22 }}
              />
            ))}
          </div>
        )}
        {villes.length === 1 && (
          <button
            type="button"
            onClick={() => onVoir(villes[0])}
            className="bouton-givre flex h-11 items-center gap-2 px-5 text-[15px] font-semibold"
          >
            <MapPin className="size-4" strokeWidth={2.4} /> Sur la Map
          </button>
        )}
      </footer>
    </div>,
    document.body
  );
}
