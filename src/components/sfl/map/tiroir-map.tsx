"use client";

// La Map refaite (Sabri, 02/11/2026 : « pas assez lifté, j'aime pas la
// section map […] propose une correction app Y Combinator, Silicon Valley »).
//
// Les grandes apps de carte (Airbnb, Uber, Google Maps, Strava, Snap Map)
// tiennent sur trois pièces, et la Map les prend telles quelles :
//
// 1. En haut, UNE barre (BarreMap) : où l'on regarde (la commune, qui suit le
//    zoom) et ce qu'il s'y passe, en une ligne qui regarde devant (les joueurs
//    autour, les matchs à venir ; plus jamais « Match joué » en titre). La
//    toucher ouvre la Recherche. Dessous, les calques en pastilles
//    (PuceFiltre) : ce que la Map montre se voit et se change d'un toucher,
//    au lieu d'être rangé dans un menu.
// 2. Le plan, au milieu, libre.
// 3. En bas, UN tiroir (TiroirMap) qui monte en trois crans, au pouce ou d'un
//    toucher sur sa poignée : replié (le titre et le geste principal), les
//    matchs (le carrousel), puis tout (les joueurs autour, les terrains libres
//    les plus proches). Le geste principal, « Ouvrir un match », est une
//    seule grande pilule sous le pouce ; il remplace le « + » rond, la carte
//    « Ton match » en pointillé et la pastille du terrain, qui disaient trois
//    fois la même chose.
//
// Sur ordinateur, barre et tiroir se rangent en une colonne à gauche (le plan
// garde la largeur). Les surfaces suivent le thème (bg-background,
// text-foreground) : rien n'est écrit en blanc sur le plan, le mode clair
// tient. Ni or, ni bleu, ni rouge : réservés aux cartes MVP, Défensive,
// Impact ; la braise reste à « Il manque N ».

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { ChevronRight, Search } from "lucide-react";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { nomAffiche } from "@/lib/sfl/identites";
import { lieuDuTerrain, type TerrainPropose } from "@/lib/sfl/terrains";
import { km, type Proche } from "@/hooks/use-joueurs-proches";
import { cn } from "@/lib/utils";

/** Les trois crans du tiroir. */
export type Cran = 0 | 1 | 2;

/** La surface des pièces posées sur le plan : le fond du thème, un peu de verre. */
const SURFACE = "bg-background/[0.94] text-foreground backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.28)] ring-1 ring-foreground/[0.07]";

/** « 650 m », « 4,8 km », « 23 km ». */
export function distanceCourte(d: number): string {
  if (d < 1) return `${Math.max(50, Math.round((d * 1000) / 50) * 50)} m`;
  return d < 10 ? `${d.toFixed(1).replace(".", ",")} km` : `${Math.round(d)} km`;
}

/** La barre du haut : où l'on regarde, et ce qu'il s'y passe. */
export function BarreMap({ titre, resume, droite }: { titre: string; resume: string; droite?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/recherche"
        aria-label={`Rechercher. ${titre}, ${resume}`}
        className={cn("flex h-[54px] min-w-0 flex-1 items-center gap-3 rounded-full pr-5 pl-[18px] transition-transform active:scale-[0.985]", SURFACE)}
      >
        <Search aria-hidden className="size-[19px] shrink-0" strokeWidth={2.4} />
        <span className="flex min-w-0 flex-col">
          <span key={titre} className="barre-map-titre truncate text-[16px] leading-[1.2] font-bold tracking-[-0.3px]">
            {titre}
          </span>
          <span className="truncate text-[12.5px] leading-[1.25] font-medium text-encre-3">{resume}</span>
        </span>
      </Link>
      {droite}
    </div>
  );
}

/** Une pastille de calque : pleine quand elle est allumée (comme l'onglet choisi). */
export function PuceFiltre({
  libelle,
  icone,
  actif,
  compte,
  onChange,
}: {
  libelle: string;
  icone: ReactNode;
  actif: boolean;
  compte?: number;
  onChange: (actif: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={() => {
        navigator.vibrate?.(5);
        onChange(!actif);
      }}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold tracking-[-0.1px] transition-[transform,background-color,color] active:scale-[0.96]",
        actif ? "bg-foreground text-background shadow-[0_4px_12px_rgba(0,0,0,0.25)]" : SURFACE
      )}
    >
      <span aria-hidden className="flex [&_svg]:size-4">
        {icone}
      </span>
      {libelle}
      {compte != null && compte > 0 && <span className={cn("tabular-nums", actif ? "opacity-60" : "text-encre-3")}>{compte}</span>}
    </button>
  );
}

/**
 * Le tiroir du bas. Sa poignée et son titre le font monter ou descendre d'un
 * cran au pouce (glisser de 36 px), ou d'un toucher (replié → matchs → tout →
 * matchs). Son contenu vient de la page ; il ne garde rien lui-même.
 */
export function TiroirMap({
  cran,
  onCran,
  titre,
  sousTitre,
  droite,
  matchs,
  plus,
  action,
}: {
  cran: Cran;
  onCran: (c: Cran) => void;
  titre: string;
  sousTitre?: string | null;
  /** À droite du titre (le retour sur soi). */
  droite?: ReactNode;
  /** Le carrousel des matchs (cran 1 et 2). */
  matchs: ReactNode;
  /** Ce qui ne se montre qu'au cran 2. */
  plus: ReactNode;
  /** Le geste principal, toujours là. */
  action: ReactNode;
}) {
  const depart = useRef<{ y: number; bouge: boolean } | null>(null);
  const changer = (c: Cran) => {
    if (c === cran) return;
    navigator.vibrate?.(5);
    onCran(c);
  };
  const poignee = {
    onPointerDown: (e: React.PointerEvent) => {
      depart.current = { y: e.clientY, bouge: false };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = depart.current;
      if (!d || d.bouge) return;
      const dy = e.clientY - d.y;
      if (Math.abs(dy) < 36) return;
      d.bouge = true;
      changer((dy < 0 ? Math.min(2, cran + 1) : Math.max(0, cran - 1)) as Cran);
    },
    onPointerUp: () => {
      const d = depart.current;
      depart.current = null;
      if (d && !d.bouge) changer(cran === 0 ? 1 : cran === 1 ? 2 : 1);
    },
    onPointerCancel: () => {
      depart.current = null;
    },
  };
  return (
    <section
      aria-label={titre}
      className={cn("tiroir-map pointer-events-auto mx-2 flex flex-col overflow-hidden rounded-[30px] lg:mx-0", SURFACE)}
      data-cran={cran}
    >
      <div
        {...poignee}
        role="button"
        tabIndex={0}
        aria-expanded={cran > 0}
        aria-label={cran === 2 ? "Réduire" : "Voir plus"}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            changer(cran === 2 ? 1 : ((cran + 1) as Cran));
          }
        }}
        className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2 select-none active:cursor-grabbing"
      >
        <span aria-hidden className="h-[5px] w-10 rounded-full bg-foreground/20" />
        <div className="flex w-full items-center gap-3 px-5 pt-2.5 pb-1">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[21px] leading-[1.15] font-extrabold tracking-[-0.5px]">{titre}</h2>
            {sousTitre && <p className="truncate text-[13px] font-medium text-encre-3">{sousTitre}</p>}
          </div>
          {droite && (
            // Le bouton à droite ne fait pas glisser le tiroir.
            <div onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} className="shrink-0">
              {droite}
            </div>
          )}
        </div>
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.2,0.85,0.25,1)] motion-reduce:transition-none",
          cran > 0 ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"
        )}
        aria-hidden={cran === 0}
      >
        <div className="min-h-0 overflow-hidden">{matchs}</div>
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.2,0.85,0.25,1)] motion-reduce:transition-none",
          cran === 2 ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"
        )}
        aria-hidden={cran !== 2}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="max-h-[38dvh] overflow-y-auto overscroll-contain [scrollbar-width:none]">{plus}</div>
        </div>
      </div>
      <div className="shrink-0 px-3 pt-2 pb-3">{action}</div>
    </section>
  );
}

/** Un titre de rangée dans le tiroir. */
function TitreRangee({ children, droite }: { children: ReactNode; droite?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between px-5 pt-3 pb-2">
      <h3 className="text-[15px] font-bold tracking-[-0.2px]">{children}</h3>
      {droite}
    </div>
  );
}

/** Les joueurs autour : leurs cartes en petit, du plus près au plus loin ; toucher ouvre le profil. */
export function JoueursAutour({ proches, onJoueur, tous }: { proches: Proche[]; onJoueur: (nom: string) => void; tous: () => void }) {
  if (!proches.length) return null;
  return (
    <div>
      <TitreRangee
        droite={
          <button type="button" onClick={tous} className="flex min-h-9 items-center gap-0.5 text-[13px] font-semibold text-encre-2">
            Tous <ChevronRight aria-hidden className="size-4" />
          </button>
        }
      >
        Joueurs autour
      </TitreRangee>
      <div className="flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {proches.map(({ p, d }) => (
          // La carte s'ouvre en grand d'elle-même (MiniCarte) ; le nom ouvre le profil.
          <div key={p.name} className="flex w-[78px] shrink-0 flex-col items-center gap-1">
            <MiniCarte player={p} size={FORMAT_CARTE.petite} cle={`autour-${p.name}`} />
            <button type="button" onClick={() => onJoueur(p.name)} className="flex w-full flex-col items-center">
              <span className="w-full truncate text-center text-[12.5px] font-semibold">{nomAffiche(p.name)}</span>
              <span className="text-[11.5px] text-encre-3 tabular-nums">{d < 1 ? "ta ville" : distanceCourte(d)}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Les terrains libres les plus proches, en rangées : toucher ouvre sa fiche (« Ouvrir un match ici »). */
export function TerrainsAutour({
  terrains,
  pres,
  onTerrain,
}: {
  terrains: TerrainPropose[];
  pres: { lat: number; lng: number };
  onTerrain: (id: string) => void;
}) {
  const liste = terrains
    .map((t) => ({ t, d: km(pres, t) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 5);
  if (!liste.length) return null;
  return (
    <div className="pb-1">
      <TitreRangee>Terrains libres</TitreRangee>
      <ul className="flex flex-col px-2">
        {liste.map(({ t, d }) => {
          const formats = [...new Set(t.formats.filter((f) => f > 0))].sort((a, b) => a - b);
          const details = [formats.length ? `à ${formats.join(", ")}` : null, t.eclaire ? "éclairé" : null, t.libre ? "accès libre" : null].filter(Boolean).join(" · ");
          return (
            <li key={t.id}>
              <button type="button" onClick={() => onTerrain(t.id)} className="flex min-h-[56px] w-full items-center gap-3 rounded-[18px] px-3 text-left active:bg-foreground/[0.06]">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-foreground/[0.07]">
                  <IconeTerrainSimple />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14.5px] font-semibold tracking-[-0.2px]">{lieuDuTerrain(t)}</span>
                  {details && <span className="truncate text-[12.5px] text-encre-3">{details}</span>}
                </span>
                <span className="shrink-0 text-[13px] font-semibold text-encre-2 tabular-nums">{distanceCourte(d)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IconeTerrainSimple() {
  return (
    <svg viewBox="0 0 24 24" className="size-[19px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round">
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M12 5.5v13" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M3 9.5h2.6v5H3M21 9.5h-2.6v5H21" />
    </svg>
  );
}
