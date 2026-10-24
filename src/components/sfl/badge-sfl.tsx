"use client";

// Le badge SFL d'un joueur (Sabri, 24/10 : « mettre aussi un badge SFL pour
// signifier que cet utilisateur a fait partie de SFL »). À côté de son équipe
// Bola Team, sous son nom, sur son profil et sur Ma carte : le sigle SFL
// (SigleLigue, le seul dessin de la marque) et les saisons où il était dans
// l'effectif : celle en cours et les closes (saison.archives). Rien pour un
// joueur Bola venu par un parrain, qui n'a jamais été dans un effectif.

import { useMemo } from "react";
import { SigleLigue } from "@/components/sfl/choix-ligue";
import { EquipeDuJoueur } from "@/components/sfl/equipe/equipe-du-joueur";
import { useSeason } from "@/components/sfl/season-provider";
import type { Saison } from "@/lib/sfl/saisie/types";
import { cn } from "@/lib/utils";

const memeNom = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Les numéros des saisons où le joueur était dans l'effectif, de la plus ancienne à la plus récente. */
export function saisonsSfl(saison: Saison, nom: string): number[] {
  const dans = (roster: { name: string }[]) => roster.some((r) => memeNom(r.name, nom));
  const closes = (saison.archives ?? []).filter((a) => dans(a.roster)).map((a) => a.numero);
  const enCours = dans(saison.roster) ? [saison.numero ?? 0] : [];
  return [...new Set([...closes, ...enCours])].sort((a, b) => a - b);
}

export function BadgeSfl({ nom, className }: { nom: string; className?: string }) {
  const { saison } = useSeason();
  const saisons = useMemo(() => saisonsSfl(saison, nom), [saison, nom]);
  if (saisons.length === 0) return null;
  return (
    <span
      role="img"
      aria-label={`Joueur SFL, saison${saisons.length > 1 ? "s" : ""} ${saisons.join(", ")}`}
      className={cn("glass flex h-[46px] shrink-0 flex-col items-center justify-center gap-[3px] rounded-full px-4", className)}
    >
      <SigleLigue ligue="sfl" hauteur={15} />
      <span aria-hidden className="mono-label text-[9px] text-foreground/45">
        {saisons.map((n) => `S${n}`).join(" · ")}
      </span>
    </span>
  );
}

/** L'équipe Bola Team et le badge SFL, côte à côte sous le nom du joueur. */
export function AppartenancesJoueur({ nom, className }: { nom: string; className?: string }) {
  return (
    <div className={cn("flex max-w-full flex-wrap items-center justify-center gap-[var(--fib-8)] empty:hidden", className)}>
      <EquipeDuJoueur nom={nom} className="min-w-0" />
      <BadgeSfl nom={nom} />
    </div>
  );
}
