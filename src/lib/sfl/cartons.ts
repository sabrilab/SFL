// Les cartons de la Sunday Five League (Sabri, 01/11/2026, jour de la J4 :
// « à chaque fois que je vais mettre un retard à quelqu'un, donc il y a des
// points malus, mais je veux aussi que cette personne-là reçoive un carton
// […] Au bout de 3 cartons jaunes reçus, donc qui représentent 3 retards, la
// personne elle a un carton rouge et ce carton rouge lui bloque une journée
// […] la prochaine journée […] uniquement pour le côté SFL […] pour la
// journée 4, tous ceux qui ont un retard noté, tu leur envoies un carton
// jaune »).
//
// La règle, et nulle part ailleurs :
//   · un retard noté (MatchEntry.retard, sur une ligne de présent, celle qui
//     coûte déjà −1 point) sur une journée à partir de la J4 de la saison 1
//     (la J4 compte ; rien avant, pas de rétroactivité) — dès la J1 pour les
//     saisons suivantes — vaut un carton jaune. Le malus ne change pas ;
//   · le troisième jaune d'une série vaut aussi un carton rouge : le joueur
//     est suspendu pour la journée suivante (J+1). Il ne peut pas répondre
//     « Je viens » à sa convocation, la composition automatique ne le place
//     pas, l'admin non plus (integrite.ts, I9) — sauf si l'admin lève la
//     suspension (Saison.suspensionsLevees) ;
//   · après le rouge, la série repart de zéro.
//
// Rien n'est compté à la main : tout se relit dans les feuilles de la saison
// publiée (sans les brouillons), si bien qu'un retard corrigé corrige les
// cartons. Un carton a un id stable (« s1-j4-jaune ») : c'est ce que la base
// retient de ceux que le joueur a déjà vus (profiles.cartons_vus), et la clé
// de sa notification, envoyée une fois (/api/cartons/annoncer). Le mode Bola
// n'en a pas. Pur : partagé par l'app et le serveur.

import { estBrouillon } from "./saisie/brouillon";
import { numeroSaison, type Saison, type SuspensionLevee } from "./saisie/types";

export const REGLES_CARTONS = {
  /** La saison où naissent les cartons, et sa première journée qui compte. */
  saison: 1,
  depuis: 4,
  /** Les jaunes d'une série qui font un rouge. */
  jaunesPourUnRouge: 3,
} as const;

export type Couleur = "jaune" | "rouge";

export interface Carton {
  /** Stable, jamais réutilisé : « s1-j4-jaune », « s1-j6-rouge ». */
  id: string;
  joueur: string;
  couleur: Couleur;
  /** La journée du retard (pour un rouge, celle du troisième jaune). */
  j: number;
  /** Jaune : son rang dans la série (1 à 3) ; rouge : 3. */
  rang: number;
  /** Rouge : la journée de la suspension. */
  suspenduPour?: number;
}

export interface Suspension {
  j: number;
  /** Levée par l'admin : le joueur peut jouer. */
  levee: boolean;
}

export interface CartonsDuJoueur {
  joueur: string;
  /** Tous ses cartons de la saison, dans l'ordre (un rouge suit son troisième jaune). */
  cartons: Carton[];
  /** Les jaunes de la série en cours (0 à 2). */
  serie: number;
  suspensions: Suspension[];
}

const cle = (n: string) => n.trim().toLowerCase();

/** La première journée qui compte dans la saison `numero` ; null : aucune. */
export function debutDesCartons(numero: number): number | null {
  if (numero < REGLES_CARTONS.saison) return null;
  return numero === REGLES_CARTONS.saison ? REGLES_CARTONS.depuis : 1;
}

/** Les cartons de toute la saison, joueur par joueur (clé : le nom sans casse). */
export function cartonsDeLaSaison(saison: Saison): Map<string, CartonsDuJoueur> {
  const numero = numeroSaison(saison);
  const depuis = debutDesCartons(numero);
  const out = new Map<string, CartonsDuJoueur>();
  if (depuis == null) return out;
  // Ce que la ligue voit : jamais une journée en brouillon.
  const publiees = new Set(saison.journees.filter((m) => !estBrouillon(m)).map((m) => m.j));
  // Un retard par joueur et par journée au plus (sa ligne de présent).
  const retards = new Map<string, { joueur: string; js: Set<number> }>();
  for (const e of saison.entries) {
    if (!e.retard || e.statut !== "Présent" || e.extraTime || e.vitrine) continue;
    if (e.j < depuis || !publiees.has(e.j)) continue;
    const k = cle(e.player);
    const r = retards.get(k) ?? { joueur: e.player, js: new Set<number>() };
    r.js.add(e.j);
    retards.set(k, r);
  }
  const levees = saison.suspensionsLevees ?? [];
  for (const [k, { joueur, js }] of retards) {
    const cartons: Carton[] = [];
    const suspensions: Suspension[] = [];
    let serie = 0;
    for (const j of [...js].sort((a, b) => a - b)) {
      serie += 1;
      cartons.push({ id: `s${numero}-j${j}-jaune`, joueur, couleur: "jaune", j, rang: serie });
      if (serie === REGLES_CARTONS.jaunesPourUnRouge) {
        const pour = j + 1;
        cartons.push({ id: `s${numero}-j${j}-rouge`, joueur, couleur: "rouge", j, rang: serie, suspenduPour: pour });
        suspensions.push({ j: pour, levee: levees.some((l) => cle(l.joueur) === k && l.j === pour) });
        serie = 0;
      }
    }
    out.set(k, { joueur, cartons, serie, suspensions });
  }
  return out;
}

/** Les cartons d'un joueur (rien : aucun carton, série à zéro). */
export function cartonsDe(saison: Saison, joueur: string): CartonsDuJoueur {
  return cartonsDeLaSaison(saison).get(cle(joueur)) ?? { joueur, cartons: [], serie: 0, suspensions: [] };
}

/** La suspension d'un joueur pour la journée `j`, levée ou non ; null s'il n'en a pas. */
export function suspensionPour(saison: Saison, joueur: string, j: number): Suspension | null {
  return cartonsDe(saison, joueur).suspensions.find((s) => s.j === j) ?? null;
}

/** Suspendu pour la journée `j`, et la suspension n'est pas levée. */
export function suspenduPour(saison: Saison, joueur: string, j: number): boolean {
  const s = suspensionPour(saison, joueur, j);
  return !!s && !s.levee;
}

/** Les suspendus de la journée `j` (noms sans casse), suspensions levées exclues. */
export function suspendusPour(saison: Saison, j: number): Set<string> {
  const out = new Set<string>();
  for (const [k, c] of cartonsDeLaSaison(saison)) if (c.suspensions.some((s) => s.j === j && !s.levee)) out.add(k);
  return out;
}

/** `noms` sans les suspendus de la journée `j` (la composition, les « Je viens »). */
export function sansSuspendus<T extends string>(saison: Saison, j: number, noms: readonly T[]): T[] {
  const s = suspendusPour(saison, j);
  return s.size ? noms.filter((n) => !s.has(cle(n))) : [...noms];
}

/** L'admin lève la suspension de `joueur` pour la J`j` : il peut jouer. */
export function leverSuspension(saison: Saison, joueur: string, j: number, par: string, le: Date): Saison {
  const levees = (saison.suspensionsLevees ?? []).filter((l) => !(cle(l.joueur) === cle(joueur) && l.j === j));
  const levee: SuspensionLevee = { joueur, j, par, le: le.toISOString() };
  return { ...saison, suspensionsLevees: [...levees, levee] };
}

/** La suspension revient (l'admin s'était trompé). */
export function retablirSuspension(saison: Saison, joueur: string, j: number): Saison {
  const levees = (saison.suspensionsLevees ?? []).filter((l) => !(cle(l.joueur) === cle(joueur) && l.j === j));
  if (levees.length === (saison.suspensionsLevees ?? []).length) return saison;
  const { suspensionsLevees: _avant, ...reste } = saison;
  void _avant;
  return levees.length ? { ...reste, suspensionsLevees: levees } : reste;
}

/** Les cartons pas encore vus, dans l'ordre où ils ont été donnés. */
export function cartonsAMontrer(cartons: readonly Carton[], vus: ReadonlySet<string>): Carton[] {
  return cartons.filter((c) => !vus.has(c.id));
}

/** « Carton jaune » · « Retard · J4 · 1/3 » ; « Carton rouge » · « Suspendu pour la J5 ». */
export function texteCarton(c: Carton): { titre: string; ligne: string } {
  if (c.couleur === "rouge") return { titre: "Carton rouge", ligne: `Suspendu pour la J${c.suspenduPour}` };
  return { titre: "Carton jaune", ligne: `Retard · J${c.j} · ${c.rang}/${REGLES_CARTONS.jaunesPourUnRouge}` };
}

/** La clé de la notification d'un carton (annonces_envois) : une fois par carton. */
export function cleNotifCarton(c: Carton): string {
  return `carton-${c.id}`;
}
