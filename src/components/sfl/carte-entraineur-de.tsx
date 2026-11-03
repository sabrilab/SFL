"use client";

// La carte d'entraîneur d'une personne (lot B2, 03/11/2026), comme CarteDe
// (mini-carte.tsx) pour un joueur : lue en base (use-carte-entraineur.ts, la
// carte que le serveur garde ; 75 partout tant qu'il n'a rien posé), avec la
// photo du studio, l'écusson de son équipe (celle qu'il entraîne, sinon la
// dernière), au format voulu (FORMAT_CARTE : 78 px sur le banc et la page de
// l'équipe, 48 px dans les pastilles de son équipe). La toucher l'ouvre en
// grand (card-viewer.tsx), comme la carte d'un joueur ; `inerte` dans une
// ligne déjà cliquable (le banc ouvre sa fiche).
//
// Jamais de bord en tirets autour : dans l'app, des tirets autour d'une
// pastille disent « invité » ; l'écusson en haut à droite dit
// « entraîneur ».

import { prechaufferCarte } from "@/components/sfl/card-3d";
import { useCardViewer } from "@/components/sfl/card-viewer";
import { CarteEntraineur } from "@/components/sfl/carte-entraineur";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { statsDe, useCarteEntraineur } from "@/hooks/use-carte-entraineur";
import { useEquipes } from "@/hooks/use-equipes";
import { useIdentites } from "@/hooks/use-identites";
import { usePhotoPerso } from "@/hooks/use-player-photo";
import { noteEntraineur, type EquipeEntraineur } from "@/lib/sfl/entraineur";
import type { Equipe } from "@/lib/sfl/equipes";
import { cn } from "@/lib/utils";

const memeNom = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** L'équipe telle que la carte la montre : son nom (sous le sien) et son écusson. */
export const equipeDeLaCarte = (e: Pick<Equipe, "nom" | "initiales" | "fond" | "blason">): EquipeEntraineur => ({
  nom: e.nom,
  initiales: e.initiales,
  fond: e.fond,
  blason: e.blason,
});

/** Les données de la carte d'entraîneur d'une personne : ses trois, son équipe, sa photo, son nom affiché. */
export function useFaceEntraineur(nom: string, id?: string | null, equipe?: Equipe | null) {
  const carte = useCarteEntraineur({ id, nom });
  const { equipes } = useEquipes();
  const photo = usePhotoPerso(nom);
  const identite = useIdentites();
  // Son équipe : celle que la page connaît, sinon celle qu'il entraîne, sinon la dernière gardée avec sa carte.
  const sienne =
    equipe ??
    equipes.find((e) => e.membres.some((m) => m.role === "entraineur" && m.statut === "membre" && memeNom(m.name, nom))) ??
    equipes.find((e) => e.id === carte?.equipeId) ??
    null;
  const stats = statsDe(carte);
  return {
    stats,
    note: noteEntraineur(stats),
    rencontres: carte?.rencontres ?? 0,
    equipe: sienne,
    props: {
      nom,
      affiche: identite.nom(nom),
      pseudo: identite.pseudo(nom),
      equipe: sienne ? equipeDeLaCarte(sienne) : null,
      photo,
      stats,
    },
  };
}

export function CarteEntraineurDe({
  nom,
  id,
  equipe,
  size = FORMAT_CARTE.moyenne,
  inerte = false,
  className,
}: {
  /** Son nom de saison. */
  nom: string;
  /** Son identifiant (la carte gardée), s'il est connu. */
  id?: string | null;
  /** Son équipe, quand la page la connaît déjà. */
  equipe?: Equipe | null;
  size?: number;
  /** Sans bouton : dans une ligne déjà cliquable, la carte n'est qu'une image. */
  inerte?: boolean;
  className?: string;
}) {
  const { open } = useCardViewer();
  const f = useFaceEntraineur(nom, id, equipe);
  const carte = <CarteEntraineur {...f.props} size={size} />;
  if (inerte) return <span className={cn("flex shrink-0", className)}>{carte}</span>;
  const { RES, PRES, COH } = f.stats;
  return (
    <button
      type="button"
      onPointerDown={(e) => prechaufferCarte(e.currentTarget)}
      onClick={(e) => {
        e.stopPropagation();
        open({
          // La note et les trois dans la clé : la 3D se refait quand la carte monte.
          cacheKey: `entraineur-${nom}-${RES}-${PRES}-${COH}-${f.equipe?.id ?? "x"}`,
          mode: "simple",
          title: f.props.affiche,
          subtitle: f.equipe ? `Entraîneur · ${f.equipe.nom}` : "Entraîneur",
          render: (s) => <CarteEntraineur {...f.props} size={s} />,
        });
      }}
      aria-label={`Voir la carte d'entraîneur de ${f.props.affiche}`}
      className={cn("relative flex shrink-0 transition-transform active:scale-95", className)}
    >
      {carte}
    </button>
  );
}
