// Les badges de palier d'un joueur, gagnés au fil des dimanches sur toute sa
// carrière SFL (saisons archivées comprises). Quatre paliers pour tous, dans
// le même ordre : bronze, argent, or, puis rouge et or. Une médaille pas
// encore gagnée montre déjà le chemin jusqu'au bronze. Calculé à partir de la
// saison, rien n'est stocké.
//
// Sept badges, sur deux lignes dans Ma carte (Sabri, 22/10) : buts, passes,
// matchs, victoires, puis MVP, Le Mur, Impact. Ancienneté, série et cage
// inviolée ont été retirées (la cage reviendra, réservée aux gardiens et aux
// meilleurs défenseurs).
//
// Les classements de fin de saison (1er, 2e, 3e), plus rares, vivent à part :
// voir fin-de-saison.ts.

import { journeeJouee, saisonDepuisArchive } from "./saisie/mutations";
import type { Saison } from "./saisie/types";
import { estVitrine } from "./compte-vitrine";

export type TropheeId =
  | "matchs"
  | "buts"
  | "passes"
  | "mvp"
  | "mur"
  | "impact"
  | "victoires";

export interface DefTrophee {
  id: TropheeId;
  nom: string;
  /** L'inscription gravée, en minuscules, comme sur l'app. */
  inscription: string;
  /** Les seuils des paliers I, II, III… */
  paliers: number[];
  /** « 3 buts » : l'unité, au singulier et au pluriel. */
  unite: [string, string];
}

export const TROPHEES: DefTrophee[] = [
  { id: "buts", nom: "Buts", inscription: "des buts marqués.", paliers: [5, 10, 25, 50], unite: ["but", "buts"] },
  { id: "passes", nom: "Passes", inscription: "des passes décisives.", paliers: [5, 10, 25, 50], unite: ["passe", "passes"] },
  { id: "matchs", nom: "Matchs", inscription: "des dimanches sur le terrain.", paliers: [5, 10, 25, 50], unite: ["match", "matchs"] },
  { id: "victoires", nom: "Victoires", inscription: "des matchs gagnés.", paliers: [5, 10, 25, 50], unite: ["victoire", "victoires"] },
  { id: "mvp", nom: "MVP du match", inscription: "meilleur joueur du match.", paliers: [1, 3, 5, 10], unite: ["fois", "fois"] },
  { id: "mur", nom: "Le Mur", inscription: "meilleur défenseur du match.", paliers: [1, 3, 5, 10], unite: ["fois", "fois"] },
  { id: "impact", nom: "Impact", inscription: "le joueur qui change le match.", paliers: [1, 3, 5, 10], unite: ["fois", "fois"] },
];

/** Les quatre paliers, du plus courant au plus rare. */
export type Metal = "bronze" | "argent" | "or" | "legende";
export const METAUX: Metal[] = ["bronze", "argent", "or", "legende"];
export const NOM_METAL: Record<Metal, string> = { bronze: "Bronze", argent: "Argent", or: "Or", legende: "Rouge et or" };

/** Le métal d'un palier (1 = bronze… 4 = rouge et or) ; null avant le premier. */
export function metal(palier: number): Metal | null {
  return palier > 0 ? METAUX[Math.min(palier, METAUX.length) - 1] : null;
}

export interface EtatTrophee {
  def: DefTrophee;
  valeur: number;
  /** 0 = verrouillé ; 1… = palier atteint. */
  palier: number;
  /** La prochaine cible, null au palier maximal. */
  cible: number | null;
  /** De 0 à 1, vers la prochaine cible. */
  progression: number;
}

/** « I », « II »… jusqu'à « V ». */
export function romain(n: number): string {
  return ["", "I", "II", "III", "IV", "V"][Math.max(0, Math.min(5, n))];
}

export function quantite(def: DefTrophee, n: number): string {
  return `${n} ${n > 1 ? def.unite[1] : def.unite[0]}`;
}

type Compteurs = Record<TropheeId, number>;

const MOIS = ["jan", "fev", "mar", "avr", "mai", "juin", "juil", "aou", "sep", "oct", "nov", "dec"];

/**
 * La date d'une journée (« 11 oct. ») est-elle passée ? Un dimanche joué
 * compte dès le lendemain, même si l'admin n'a pas encore saisi les actions :
 * les présents ont joué, leur match leur revient.
 */
function datePassee(label: string, maintenant: Date): boolean {
  const m = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/(\d{1,2})\s*([a-z]+)/);
  if (!m) return false;
  const mois = MOIS.findIndex((p) => m[2].startsWith(p.length === 4 ? p : p.slice(0, 3)));
  if (mois < 0) return false;
  let annee = maintenant.getFullYear();
  if (maintenant.getMonth() === 0 && mois === 11) annee -= 1;
  // Le soir même compte aussi : 18h passées, le match est joué.
  const fin = new Date(annee, mois, Number(m[1]), 18);
  return fin.getTime() <= maintenant.getTime();
}

/** Une saison, vue d'un joueur. */
function compter(s: Saison, nom: string, c: Compteurs, maintenant?: Date) {
  const passee = (j: number) => {
    if (journeeJouee(s, j)) return true;
    if (!maintenant) return false;
    const meta = s.journees.find((m) => m.j === j);
    return !!meta && datePassee(meta.date, maintenant);
  };
  const lignes = s.entries.filter((e) => e.player === nom && !e.extraTime);
  const presentes = new Set(lignes.filter((e) => e.statut === "Présent" && passee(e.j)).map((e) => e.j));
  if (!presentes.size) return;

  c.matchs += presentes.size;
  for (const e of lignes) {
    if (!presentes.has(e.j)) continue;
    c.buts += e.buts;
    c.passes += e.passes;
    if (e.result === "Victoire") c.victoires += 1;
    if (e.mvp) c.mvp += 1;
    if (e.def) c.mur += 1;
    if (e.impact) c.impact += 1;
  }
}

/** La vitrine d'un joueur : toutes les médailles, gagnées ou en chemin. */
export function vitrine(saison: Saison, nom: string, maintenant?: Date, enPlus: readonly Saison[] = []): EtatTrophee[] {
  const c = Object.fromEntries(TROPHEES.map((t) => [t.id, 0])) as Compteurs;
  for (const a of saison.archives ?? []) compter(saisonDepuisArchive(a), nom, c);
  compter(saison, nom, c, maintenant);
  // Ses matchs Bola validés (carte-bola.ts, saisonBola), sur son seul
  // téléphone : buts, passes, matchs, victoires et MVP y comptent aussi
  // (choix par défaut, 28/10) ; la saison SFL, elle, n'en reçoit rien.
  for (const s of enPlus) compter(s, nom, c);

  return TROPHEES.map((def) => {
    // Le compte vitrine a tout, au plus haut palier (compte-vitrine.ts).
    const valeur = estVitrine(nom) ? Math.max(c[def.id], def.paliers[def.paliers.length - 1]) : c[def.id];
    const palier = def.paliers.filter((p) => valeur >= p).length;
    const cible = def.paliers[palier] ?? null;
    const base = palier ? def.paliers[palier - 1] : 0;
    const progression = cible == null ? 1 : Math.max(0, Math.min(1, (valeur - base) / (cible - base)));
    return { def, valeur, palier, cible, progression };
  });
}

/** Le badge le plus proche : ce qui donne envie de revenir dimanche. */
export function prochain(etats: EtatTrophee[]): EtatTrophee | null {
  return (
    etats
      .filter((e) => e.cible != null)
      .sort((a, b) => b.progression - a.progression || a.cible! - a.valeur - (b.cible! - b.valeur))[0] ?? null
  );
}

/** La clé de chaque palier gagné (« buts:2 ») — pour annoncer les nouveaux. */
export function clesGagnees(etats: EtatTrophee[]): string[] {
  return etats.flatMap((e) => Array.from({ length: e.palier }, (_, i) => `${e.def.id}:${i + 1}`));
}

/**
 * Qui d'autre a un badge de palier : chaque joueur de la liste qui a atteint
 * au moins `palierMin`, avec son propre palier, du plus haut au plus bas.
 */
export function detenteurs(
  saison: Saison,
  id: TropheeId,
  noms: string[],
  palierMin = 1,
  maintenant?: Date
): { nom: string; palier: number; valeur: number }[] {
  return noms
    .map((nom) => {
      const e = vitrine(saison, nom, maintenant).find((x) => x.def.id === id)!;
      return { nom, palier: e.palier, valeur: e.valeur };
    })
    .filter((d) => d.palier >= Math.max(1, palierMin))
    .sort((a, b) => b.palier - a.palier || b.valeur - a.valeur || a.nom.localeCompare(b.nom));
}
