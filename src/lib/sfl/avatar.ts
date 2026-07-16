// Config de l'avatar paramétrique : chaque choix de l'éditeur est une clé
// fermée, la géométrie 3D est pilotée par les morph targets du GLB
// (public/models/avatar-base.glb) et par des réglages matériaux/échelle.

export type Taille = "petit" | "moyen" | "grand";
export type Corpulence = "fine" | "moyenne" | "forte";
export type Tete = "ronde" | "carree" | "allongee";
export type Peau = "claire" | "medium" | "foncee";
export type Cheveux = "ras" | "court" | "crete";

export interface AvatarConfig {
  taille: Taille;
  corpulence: Corpulence;
  tete: Tete;
  peau: Peau;
  cheveux: Cheveux;
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  taille: "moyen",
  corpulence: "moyenne",
  tete: "ronde",
  peau: "medium",
  cheveux: "court",
};

export const AVATAR_STORAGE_KEY = "sfl-avatar-config";

// Échelle appliquée au modèle entier (le GLB fait ~1,84 m).
export const TAILLE_SCALE: Record<Taille, number> = {
  petit: 0.90,
  moyen: 1.0,
  grand: 1.09,
};

// Teintes appliquées au matériau "Skin" du GLB.
export const PEAU_HEX: Record<Peau, string> = {
  claire: "#f1c9a5",
  medium: "#c98850",
  foncee: "#7a4b28",
};

// Influences des morph targets exportés par Blender.
// Toutes les clés sont toujours renvoyées pour remettre à zéro les autres.
export function corpulenceMorphs(c: Corpulence): Record<string, number> {
  return {
    Mince: c === "fine" ? 1 : 0,
    Costaud: c === "forte" ? 1 : 0,
  };
}

export function teteMorphs(t: Tete): Record<string, number> {
  return {
    TeteCarree: t === "carree" ? 1 : 0,
    TeteLongue: t === "allongee" ? 1 : 0,
  };
}

// Nom de l'objet 3D de coupe de cheveux à afficher dans le GLB.
export const CHEVEUX_MESH: Record<Cheveux, string> = {
  ras: "CheveuxRas",
  court: "CheveuxCourt",
  crete: "CheveuxCrete",
};

// Libellés pour l'éditeur.
export const TAILLE_OPTIONS: { value: Taille; label: string }[] = [
  { value: "petit", label: "Petit" },
  { value: "moyen", label: "Moyen" },
  { value: "grand", label: "Grand" },
];

export const CORPULENCE_OPTIONS: { value: Corpulence; label: string }[] = [
  { value: "fine", label: "Fine" },
  { value: "moyenne", label: "Moyenne" },
  { value: "forte", label: "Forte" },
];

export const TETE_OPTIONS: { value: Tete; label: string }[] = [
  { value: "ronde", label: "Ronde" },
  { value: "carree", label: "Carrée" },
  { value: "allongee", label: "Allongée" },
];

export const PEAU_OPTIONS: { value: Peau; label: string }[] = [
  { value: "claire", label: "Claire" },
  { value: "medium", label: "Médium" },
  { value: "foncee", label: "Foncée" },
];

export const CHEVEUX_OPTIONS: { value: Cheveux; label: string }[] = [
  { value: "ras", label: "Ras" },
  { value: "court", label: "Court" },
  { value: "crete", label: "Crête" },
];
