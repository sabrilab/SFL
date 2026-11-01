// Les saisons du Passe Bola (Sabri, 30/10/2026 : « des passes d'XP, mais que
// ce soit comme des saisons, un peu comme dans les jeux Fortnite, Call of
// Duty […] que l'XP donne accès à des actifs au sein de Bola qui ne sont
// disponibles que pendant cette saison-là »).
//
// Une saison a ses dates (heure de Paris) et ses paliers (passe.ts). L'XP du
// Passe se compte dans la saison où elle est gagnée : le Passe repart de 0 à
// chaque saison ; le Niveau XP, lui, reste à vie. Ce qu'un palier a donné
// reste à soi pour de bon, la saison finie (debloquesDe).
//
// Ses choix, le 30/10 :
//   · le mot « Saison » et un nom : la Saison Givre, 8 semaines, à partir du
//     lundi 9 novembre ; avant, le Passe l'annonce par sa devise, « Dès que
//     c'est l'hiver » ;
//   · le Passe d'avant devient la Saison 1, la saison en cours jusque-là ;
//   · les thèmes suivants (Nuit, Remontada, Béton, Pays, Ombre) ne se
//     montrent pas avant leur début : ils se débloquent (« ça a débloqué ») ;
//     « on décide de la suite » : ils ne sont pas ici tant qu'il ne les a pas
//     tranchés. Pas d'Halloween, de Nouvel An ni de Noël.
// Sans saison suivante, la dernière commencée continue.
//
// Pur : ni React ni réseau.

import { jourMoisDuLibelle } from "./convocation-temps";
import type { LigneXp } from "./missions";
import { PASSE_GIVRE, PASSE_SAISON_1, type PalierPasse } from "./passe";

export interface SaisonPasse {
  id: string;
  /** « Saison 1 », « Saison Givre ». */
  nom: string;
  /** Ce qu'elle dit avant de commencer. */
  devise?: string;
  /** Son premier jour, à minuit à Paris ; null : depuis toujours. */
  debut: string | null;
  /** Son dernier jour (compris). */
  fin: string | null;
  paliers: readonly PalierPasse[];
}

export const SAISONS_PASSE: readonly SaisonPasse[] = [
  { id: "s1", nom: "Saison 1", debut: null, fin: "2026-11-08", paliers: PASSE_SAISON_1 },
  {
    id: "givre",
    nom: "Saison Givre",
    devise: "Dès que c'est l'hiver",
    debut: "2026-11-09",
    fin: "2027-01-03",
    paliers: PASSE_GIVRE,
  },
];

/** L'heure qu'il est à Paris, en « AAAA-MM-JJ ». */
export function jourParis(t: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
}

/** La saison du Passe d'un jour « AAAA-MM-JJ » : celle qui le contient, sinon la dernière commencée. */
export function saisonPasseDuJour(jour: string): SaisonPasse {
  let s = SAISONS_PASSE[0];
  for (const x of SAISONS_PASSE) if (!x.debut || x.debut <= jour) s = x;
  return s;
}

export const saisonPasseA = (t: Date): SaisonPasse => saisonPasseDuJour(jourParis(t));

/** La saison qui commence après celle de `t`, si elle est connue. */
export function saisonPasseSuivante(t: Date): SaisonPasse | null {
  const i = SAISONS_PASSE.indexOf(saisonPasseA(t));
  return SAISONS_PASSE[i + 1] ?? null;
}

/** Les saisons déjà commencées : les seules qui se montrent. */
export function saisonsPasseOuvertes(t: Date): readonly SaisonPasse[] {
  const jour = jourParis(t);
  return SAISONS_PASSE.filter((s) => !s.debut || s.debut <= jour);
}

const deux = (n: number) => String(n).padStart(2, "0");

/**
 * Le jour d'une ligne d'XP, « AAAA-MM-JJ » : sa date (« 1 nov. »,
 * « 22 oct. · 19h30 ») prise dans l'année qui la met au plus près de `ref`
 * sans la pousser à plus d'un mois après lui. null si elle n'a pas de date.
 */
export function jourDeLigne(l: Pick<LigneXp, "date">, ref: Date): string | null {
  const jm = jourMoisDuLibelle(l.date ?? "");
  if (!jm) return null;
  const [a, m] = jourParis(ref).split("-").map(Number);
  const annee = jm.mois > m + 1 ? a - 1 : a;
  return `${annee}-${deux(jm.mois)}-${deux(jm.jour)}`;
}

/** La saison du Passe où une ligne d'XP compte : celle de son jour, sinon celle de `ref`. */
export function saisonPasseDeLigne(l: Pick<LigneXp, "date">, ref: Date): SaisonPasse {
  const jour = jourDeLigne(l, ref);
  return jour ? saisonPasseDuJour(jour) : saisonPasseA(ref);
}
