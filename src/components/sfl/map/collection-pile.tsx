"use client";

// La collection d'une pile de joueurs, dans la pop-up du bas (Sabri, 22/10 :
// « en collection carousel, un slider sur le côté, et que la map soit limite
// translucide, un peu en liquid glass » ; puis « faut que ça reste dans la
// pop-up du bas », « qu'on puisse filtrer et les voir […] en plus petit, ou
// en rendant grand écran. En fait, c'est comme un classeur »).
//
// Une pop-up de verre clair : la Map reste visible au-dessus, floutée
// derrière le verre. Deux façons de voir :
// – le slider : une carte au centre (aimantée), les voisines en retrait ;
//   toucher celle du centre ouvre le profil, une voisine vient au centre ;
// – le classeur : la pop-up monte presque en plein écran, les cartes en
//   petites (cartes photo), trois par rangée.
// Les filtres par ligne (attaque, milieu, défense, gardiens) servent aux deux.
// Toucher la Map, la croix ou Échap referme ; « Sur la Map » vole sur la ville.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GalleryHorizontal, LayoutGrid, MapPin, X } from "lucide-react";
import { PlayerCard } from "@/components/sfl/player-card";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { useSeason } from "@/components/sfl/season-provider";
import type { VillePlan } from "@/components/sfl/map/joueurs";
import type { Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

const PHI = (1 + Math.sqrt(5)) / 2;
/** La carte du centre : assez grande pour la carte classique (≥ 170 px), la pop-up laisse voir la Map. */
const TAILLE = FORMAT_CARTE.grande * Math.sqrt(PHI) * 1.08;
const LARGEUR = 254 * TAILLE;
const ECART = 14;

/** Les lignes, du premier poste d'un joueur (« MC/AT » → milieu). */
const LIGNES = [
  { id: "A", label: "Attaque" },
  { id: "M", label: "Milieu" },
  { id: "D", label: "Défense" },
  { id: "G", label: "Gardiens" },
] as const;
type Ligne = (typeof LIGNES)[number]["id"];
const ligneDe = (p: Player): Ligne | null => {
  const c = (p.poste ?? "").trim().toUpperCase().charAt(0);
  return c === "A" || c === "M" || c === "D" || c === "G" ? c : null;
};

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
  const tous = useMemo(
    () =>
      villes
        .flatMap((v) => v.joueurs)
        .sort((a, b) => b.note - a.note)
        .map((j) => parNom.get(j.name))
        .filter((p) => !!p),
    [villes, parNom]
  );
  const [ligne, setLigne] = useState<Ligne | null>(null);
  const [classeur, setClasseur] = useState(false);
  const lignes = useMemo(() => LIGNES.filter((l) => tous.some((p) => ligneDe(p) === l.id)), [tous]);
  const joueurs = useMemo(() => (ligne ? tous.filter((p) => ligneDe(p) === ligne) : tous), [tous, ligne]);
  const ouverte = villes.length > 0;
  const rail = useRef<HTMLDivElement>(null);
  const [centre, setCentre] = useState(0);
  const [entree, setEntree] = useState(false);

  // À chaque ouverture : tous les joueurs, en slider, la première carte au centre, puis l'entrée.
  useEffect(() => {
    if (!ouverte) return;
    const t = window.setTimeout(() => {
      setLigne(null);
      setClasseur(false);
      setCentre(0);
      rail.current?.scrollTo({ left: 0 });
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

  function filtrer(l: Ligne | null) {
    navigator.vibrate?.(4);
    setLigne(l);
    setCentre(0);
    rail.current?.scrollTo({ left: 0 });
  }

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
  const haut = "calc(100dvh - env(safe-area-inset-top, 0px) - 24px)";

  // Au-dessus de tout ce qui est posé sur la Map ; le profil d'un joueur la remplace le temps qu'il est ouvert.
  return createPortal(
    <div
      className="collection-fond fixed inset-0 z-[1300] flex flex-col justify-end"
      data-entree={entree || undefined}
      style={masquee ? { visibility: "hidden" } : undefined}
      onClick={(e) => e.target === e.currentTarget && onFermer()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={nom}
        className="collection-verre flex flex-col rounded-t-[28px]"
        style={{
          height: classeur ? haut : undefined,
          maxHeight: haut,
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
        }}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-[#0a0b0d]/20" aria-hidden />
        <header className="flex shrink-0 items-start justify-between gap-3 px-5 pt-3">
          <div className="min-w-0">
            <p className="mono-label text-[#0a0b0d]/55">
              {joueurs.length} joueur{joueurs.length > 1 ? "s" : ""}
            </p>
            <h2 className="truncate text-[26px] leading-[1.1] font-bold tracking-tight text-[#0a0b0d]">{nom}</h2>
          </div>
          <div className="flex shrink-0 gap-2">
            {tous.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  navigator.vibrate?.(6);
                  setClasseur((c) => !c);
                  setCentre(0);
                }}
                aria-label={classeur ? "Voir en slider" : "Voir en classeur"}
                aria-pressed={classeur}
                className="bouton-givre grid size-10 place-items-center"
              >
                {classeur ? <GalleryHorizontal className="size-4" strokeWidth={2.4} /> : <LayoutGrid className="size-4" strokeWidth={2.4} />}
              </button>
            )}
            <button type="button" onClick={onFermer} aria-label="Fermer" className="bouton-givre grid size-10 place-items-center">
              <X className="size-4" strokeWidth={2.4} />
            </button>
          </div>
        </header>

        {lignes.length > 1 && (
          <div className="flex shrink-0 gap-2 overflow-x-auto px-5 pt-3 [scrollbar-width:none]">
            {[{ id: null, label: "Tous" }, ...lignes].map((f) => {
              const actif = ligne === f.id;
              const n = f.id ? tous.filter((p) => ligneDe(p) === f.id).length : tous.length;
              return (
                <button
                  key={f.label}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => filtrer(f.id)}
                  className={cn(
                    "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold transition-colors",
                    actif ? "bg-[#0a0b0d] text-white" : "bg-white/55 text-[#0a0b0d]"
                  )}
                >
                  {f.label} <span className="font-mono text-[11px] opacity-60">{n}</span>
                </button>
              );
            })}
          </div>
        )}

        {classeur ? (
          <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-x-2.5 gap-y-3 overflow-y-auto px-5 pt-4 pb-2">
            {joueurs.map((p) => (
              <button key={p.name} type="button" onClick={() => onJoueur(p.name)} aria-label={p.name} className="collection-carte min-w-0">
                <ClasseurCarte p={p} />
              </button>
            ))}
          </div>
        ) : (
          <div
            ref={rail}
            onScroll={surDefile}
            className="flex w-full shrink-0 snap-x snap-mandatory items-center overflow-x-auto pt-3 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ gap: ECART, paddingInline: `calc(50% - ${LARGEUR / 2}px)` }}
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
        )}

        <footer className="flex shrink-0 items-center justify-between gap-3 px-5 pt-2">
          <div className="flex min-w-0 items-center gap-1.5" aria-hidden>
            {!classeur &&
              joueurs.length > 1 &&
              joueurs.slice(0, 12).map((p, i) => (
                <span
                  key={p.name}
                  className="h-1.5 rounded-full bg-[#0a0b0d] transition-all duration-300"
                  style={{ width: i === Math.min(centre, 11) ? 16 : 6, opacity: i === Math.min(centre, 11) ? 0.85 : 0.22 }}
                />
              ))}
          </div>
          {villes.length === 1 && (
            <button
              type="button"
              onClick={() => onVoir(villes[0])}
              className="bouton-givre flex h-10 shrink-0 items-center gap-2 px-4 text-[14px] font-semibold"
            >
              <MapPin className="size-4" strokeWidth={2.4} /> Sur la Map
            </button>
          )}
        </footer>
      </section>
    </div>,
    document.body
  );
}

/** Une petite carte du classeur, à la largeur de sa colonne. */
function ClasseurCarte({ p }: { p: Player }) {
  const ref = useRef<HTMLDivElement>(null);
  const [taille, setTaille] = useState(FORMAT_CARTE.grande * 0.8);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTaille(e.contentRect.width / 254));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="w-full">
      <PlayerCard player={p} size={taille} />
    </div>
  );
}
