// Définitions des classements — partagées entre l'accueil (aperçu) et la
// page Stats (classement complet).

import { ovr, type Player } from "./engine";

export interface RankingDef {
  id: string;
  label: string;
  unit: string;
  desc: string;
  value: (p: Player) => number;
  showAll?: boolean; // afficher aussi les joueurs à 0
}

export const RANKINGS: RankingDef[] = [
  { id: "pp", label: "Pépite d'Or", unit: "pts", desc: "Points Pépite de la saison", value: (p) => p.pp, showAll: true },
  { id: "ovr", label: "OVR", unit: "ovr", desc: "Note générale de la carte", value: (p) => ovr(p.stats), showAll: true },
  { id: "buts", label: "Buteurs", unit: "buts", desc: "Meilleurs buteurs de la saison", value: (p) => p.buts },
  { id: "passes", label: "Passeurs", unit: "pd", desc: "Meilleurs passeurs décisifs", value: (p) => p.passes },
  { id: "mvp", label: "MVP", unit: "mvp", desc: "Titres de MVP du match", value: (p) => p.mvp },
  { id: "impact", label: "Impact", unit: "imp", desc: "Titres de Joueur Impact", value: (p) => p.impact },
  { id: "def", label: "Défenseurs", unit: "déf", desc: "Titres de meilleur défenseur", value: (p) => p.def },
  { id: "presences", label: "Présences", unit: "m", desc: "Matchs joués cette saison", value: (p) => p.matchs, showAll: true },
  { id: "discipline", label: "Discipline", unit: "abs", desc: "Absences injustifiées et suspensions", value: (p) => p.absInj ?? 0 },
];
