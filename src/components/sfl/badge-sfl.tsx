"use client";

// Le badge SFL d'un joueur (Sabri, 24/10 : « mettre aussi un badge SFL pour
// signifier que cet utilisateur a fait partie de SFL »). À côté de son équipe
// Bola Team, sous son nom, sur son profil et sur Ma carte : le sigle SFL
// (SigleLigue, le seul dessin de la marque) et les saisons où il était dans
// l'effectif : celle en cours et les closes (saison.archives). Rien pour un
// joueur Bola venu par un parrain, qui n'a jamais été dans un effectif.
//
// Entre les deux, sur le profil d'un autre (03/11/2026) : sa carte
// d'entraîneur de Bola Team, s'il entraîne ou a entraîné une équipe, en
// pastille (48 px, l'écusson de son équipe pour signe), qui s'ouvre en grand.
// Sur Ma carte, elle a sa tuile (ma-carte/rubriques.tsx).

import { useMemo } from "react";
import { SigleLigue } from "@/components/sfl/choix-ligue";
import { EquipeDuJoueur } from "@/components/sfl/equipe/equipe-du-joueur";
import { CarteEntraineurDe } from "@/components/sfl/carte-entraineur-de";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { useSeason } from "@/components/sfl/season-provider";
import { useCarteEntraineur } from "@/hooks/use-carte-entraineur";
import { useEquipeDe } from "@/hooks/use-equipes";
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

/** Sa carte d'entraîneur en pastille, s'il entraîne aujourd'hui ou a entraîné (sa carte gardée) ; rien sinon. */
function CarteEntraineurDuJoueur({ nom }: { nom: string }) {
  const carte = useCarteEntraineur({ nom });
  const sienne = useEquipeDe(nom);
  const entraine = sienne?.membre.role === "entraineur";
  if (!carte && !entraine) return null;
  return <CarteEntraineurDe nom={nom} id={carte?.joueur ?? sienne?.membre.id} equipe={entraine ? sienne!.equipe : null} size={FORMAT_CARTE.petite} />;
}

/** L'équipe Bola Team, la carte d'entraîneur et le badge SFL, côte à côte sous le nom du joueur. */
export function AppartenancesJoueur({ nom, className, entraineur = true }: { nom: string; className?: string; entraineur?: boolean }) {
  return (
    <div className={cn("flex max-w-full flex-wrap items-center justify-center gap-[var(--fib-8)] empty:hidden", className)}>
      <EquipeDuJoueur nom={nom} className="min-w-0" />
      {entraineur && <CarteEntraineurDuJoueur nom={nom} />}
      <BadgeSfl nom={nom} />
    </div>
  );
}
