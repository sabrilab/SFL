"use client";

// Les briques des quatre onglets de l'admin (refonte du 24/11/2026, maquette
// v3 validée le 24/11 à 19 h 09). Plus sobres que l'admin d'avant
// (« un peu moins enfantin ») : une seule surface (glass-soft, 16 px), des
// listes façon Réglages d'iOS (le filet part après la marge), le mono-label
// réservé au nom des rubriques, et la vraie carte de l'app partout où un
// prénom paraît (« je veux quand même voir les joueurs »).

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { PlayerCard } from "@/components/sfl/player-card";
import { useSeason } from "@/components/sfl/season-provider";
import { useIdentites } from "@/hooks/use-identites";
import { carteNeutre } from "@/lib/sfl/carte-neutre";
import type { Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

/** La surface des blocs de l'admin : le verre doux de l'app, arrondi de champ. */
export const SURFACE = "glass-soft rounded-champ";

/** Le joueur d'un prénom : sa vraie carte, ou la carte neutre de l'app (75) hors de l'effectif. */
export function useJoueurDe(): (nom: string) => Player {
  const { allPlayers } = useSeason();
  return (nom) => allPlayers.find((p) => p.name.toLowerCase() === nom.toLowerCase()) ?? carteNeutre(nom);
}

/**
 * Un joueur, par sa vraie carte de l'app (sa photo, sa note) : en pastille
 * sous 70 px, au format carte au-delà (PlayerCard décide).
 */
export function Tete({ nom, joueur, cote = 40 }: { nom: string; joueur?: Player; cote?: number }) {
  const de = useJoueurDe();
  return (
    <span className="shrink-0">
      <PlayerCard player={joueur ?? de(nom)} size={cote / 254} />
    </span>
  );
}

/** Des joueurs en rang : la carte, le prénom dessous. */
export function Visages({ noms, cote = 48, colonnes = 4 }: { noms: string[]; cote?: number; colonnes?: number }) {
  const ids = useIdentites();
  return (
    <div className="grid gap-x-2 gap-y-3" style={{ gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))` }}>
      {noms.map((n) => (
        <span key={n} className="flex min-w-0 flex-col items-center gap-1.5">
          <Tete nom={n} cote={cote} />
          <span className="max-w-full truncate text-corps font-medium">{ids.nom(n)}</span>
        </span>
      ))}
    </div>
  );
}

/** Le titre d'un onglet : le lettrage des titres de l'app, sans retour (la barre suffit). */
export function Entete({ titre, droite }: { titre: string; droite?: ReactNode }) {
  return (
    <header className="flex min-h-11 items-center gap-3">
      <h1 className="titre-lettrage min-w-0 flex-1 truncate text-titre-m">{titre}</h1>
      {droite}
    </header>
  );
}

/** Le nom d'une rubrique, au-dessus d'un bloc : le seul usage de mono-label. */
export function Rubrique({ children, droite, plat }: { children: ReactNode; droite?: ReactNode; plat?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", !plat && "px-4")}>
      <span className="mono-label text-encre-3">{children}</span>
      {droite != null && <span className="text-corps text-encre-3 tabular-nums">{droite}</span>}
    </div>
  );
}

export interface LigneProps {
  titre: ReactNode;
  /** La valeur à droite, en gris (un nombre, un état). */
  droite?: ReactNode;
  /** Ce qui précède le texte : la carte d'un joueur, une icône. */
  avant?: ReactNode;
  /** La seconde ligne, en gris ; en encre si `alerte`. */
  sous?: ReactNode;
  alerte?: boolean;
  /** Une adresse de l'app (Link), une adresse hors de l'app (nouvel onglet), ou une action. */
  href?: string;
  externe?: boolean;
  onClick?: () => void;
  /** Le chevron (par défaut dès qu'on peut toucher la ligne). */
  chevron?: ReactNode;
}

/**
 * Une ligne de liste façon Réglages d'iOS. Dans une Liste, le filet part
 * après la marge gauche, à partir de la deuxième ligne (`first:` du parent).
 */
export function Ligne({ titre, droite, avant, sous, alerte, href, externe, onClick, chevron }: LigneProps) {
  const corps = (
    <>
      {avant}
      <span className="ligne-admin__corps flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2 pr-4">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-lecture font-medium">{titre}</span>
          {sous != null && <span className={cn("truncate text-corps", alerte ? "font-medium text-foreground" : "text-encre-2")}>{sous}</span>}
        </span>
        {droite != null && <span className="shrink-0 text-lecture text-encre-3 tabular-nums">{droite}</span>}
        {chevron ?? (href || onClick ? <ChevronRight className="size-4 shrink-0 text-encre-4" /> : null)}
      </span>
    </>
  );
  const classe = "ligne-admin flex w-full items-center gap-3 pl-4 text-left transition-colors active:bg-foreground/[0.04]";
  if (href && externe)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classe}>
        {corps}
      </a>
    );
  if (href)
    return (
      <Link href={href} className={classe}>
        {corps}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={classe}>
        {corps}
      </button>
    );
  return <div className={classe}>{corps}</div>;
}

/** Un bloc de lignes sous le nom de sa rubrique. */
export function Liste({ titre, droite, children, className }: { titre?: ReactNode; droite?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      {titre && <Rubrique droite={droite}>{titre}</Rubrique>}
      <div className={cn(SURFACE, "liste-admin overflow-hidden")}>{children}</div>
    </section>
  );
}

/** Le segmenté clair (sans aplat noir) : la valeur choisie sur fond de page. */
export function SegmenteClair<T extends string>({
  options,
  valeur,
  onChange,
  className,
  label,
}: {
  options: { id: T; libelle: ReactNode }[];
  /** null : rien de choisi encore. */
  valeur: T | null;
  onChange: (v: T) => void;
  className?: string;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex rounded-[10px] bg-secondary p-0.5 text-corps font-medium", className)}>
      {options.map((o) => {
        const choisi = o.id === valeur;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={choisi}
            onClick={() => onChange(o.id)}
            className={cn(
              "min-h-8 flex-1 rounded-[8px] px-3 py-1 text-center whitespace-nowrap tabular-nums transition-colors",
              choisi ? "bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-encre-3"
            )}
          >
            {o.libelle}
          </button>
        );
      })}
    </div>
  );
}

/** La page d'un onglet : la colonne du téléphone, plus large sur ordinateur. */
export function PageAdmin({ children, className, etroite }: { children: ReactNode; className?: string; etroite?: boolean }) {
  return (
    <div className={cn("mx-auto flex w-full max-w-[600px] flex-col px-5 pt-3 lg:px-12 lg:pt-5", etroite ? "lg:max-w-[776px]" : "lg:max-w-[1176px]", className)}>
      {children}
    </div>
  );
}

/** Ce qu'un non-admin voit d'une page de l'admin : un cadenas, rien d'autre. */
export function Reserve() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-5 py-24 text-center">
      <Lock className="size-6 text-muted-foreground" />
      <p className="text-lecture font-semibold">Espace réservé</p>
    </div>
  );
}
