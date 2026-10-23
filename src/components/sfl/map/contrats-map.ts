// Le filtre Contrats de la Map. Sabri, 23/10 : « est-ce qu'on pourrait faire
// aussi un filtre sur la map où on verrait les contrats qui sont en direct
// sur la map ? ». Le bouton au viseur, en haut à droite, ne laisse sur la Map
// que les cibles du dimanche, chacune dans sa ville (map/joueurs.ts), sous un
// viseur à la couleur du plus haut rang des contrats signés contre elle, sa
// prime à la place de sa note. Pendant le match, le viseur bat ; le verdict
// se pose à mesure que la feuille se remplit, comme sur les affiches des
// Actus (actus/contrats-en-jeu.tsx), qui s'ouvrent quand on touche la cible
// (map/contrats-sur.tsx).
//
// Une cible, c'est celui que vise un contrat signé : le rival d'un duel, les
// joueurs à dépasser. « Couronne » (rester en tête) n'a pas de rival : c'est
// celui qui la signe qui est sous le viseur, comme sur son affiche.

import type { MissionsDeLaLigue } from "@/hooks/use-missions";
import { rangDe, type Engagement, type Rang } from "@/lib/sfl/missions";
import type { ContratPlan, VillePlan } from "./joueurs";

const RANGS: Rang[] = ["S", "A", "B"];
/** Le rayon d'un foyer de cibles, en km : une agglomération. */
const FOYER_KM = 30;

/** Les contrats signés de la journée : les deux côtés des face-à-face, puis les autres. */
export function contratsSignes(lg: MissionsDeLaLigue): Engagement[] {
  return [...lg.faceAFace.flatMap((f) => [f.noirs, f.blancs]), ...lg.contrats];
}

/** Qui est sous le viseur d'un contrat. */
export function ciblesDe(e: Engagement): string[] {
  return e.m.genre === "reste-en-tete" ? [e.joueur] : e.m.cibles;
}

/** Le verdict se lit dès que la feuille le donne, jamais avant le coup d'envoi (comme les affiches). */
const tranche = (e: Engagement, lg: MissionsDeLaLigue) => lg.phase !== "ouvert" && e.verdict.etat !== "en-jeu";

/** Chaque cible du dimanche, et ce que la Map pose sur sa carte. */
export function ciblesDuDimanche(lg: MissionsDeLaLigue): Map<string, ContratPlan> {
  const parCible = new Map<string, Engagement[]>();
  for (const e of contratsSignes(lg))
    for (const nom of ciblesDe(e)) parCible.set(nom, [...(parCible.get(nom) ?? []), e]);
  const direct = lg.phase === "en-jeu" && !lg.d.joue;
  const out = new Map<string, ContratPlan>();
  for (const [nom, es] of parCible) {
    const rang = RANGS.find((r) => es.some((e) => rangDe(e.m) === r)) ?? "B";
    const jugees = es.filter((e) => tranche(e, lg));
    const toutes = jugees.length === es.length;
    const etat: ContratPlan["etat"] = jugees.some((e) => e.verdict.etat === "reussie")
      ? "accompli"
      : toutes && jugees.every((e) => e.verdict.etat === "annulee")
        ? "eteint"
        : toutes
          ? "rate"
          : "verrou";
    out.set(nom, { rang, prime: es.reduce((a, e) => a + e.m.xp, 0), etat, direct: direct && etat === "verrou" });
  }
  return out;
}

/** Les villes de la Map réduites à leurs cibles, chacune avec son contrat ; les plus hauts rangs d'abord. */
export function villesDesCibles(villes: VillePlan[], cibles: Map<string, ContratPlan>): VillePlan[] {
  return villes
    .map((v) => ({
      ...v,
      joueurs: v.joueurs
        .filter((j) => cibles.has(j.name))
        .map((j) => ({ ...j, contrat: cibles.get(j.name) }))
        .sort(
          (a, b) =>
            RANGS.indexOf(a.contrat!.rang) - RANGS.indexOf(b.contrat!.rang) || b.contrat!.prime - a.contrat!.prime
        ),
    }))
    .filter((v) => v.joueurs.length > 0);
}

/** La distance entre deux villes, en km (assez juste à l'échelle d'une région). */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  return Math.hypot(x, (b.lat - a.lat) * r) * 6371;
}

/**
 * Où cadrer en allumant le filtre : la ville qui a le plus de cibles autour
 * d'elle, et ses voisines. Une cible seule à l'autre bout du pays reste sur
 * la Map, hors du cadre : sinon tout le Nord tient en une pile.
 */
export function foyerDesCibles(villes: VillePlan[]): VillePlan[] {
  const poids = (vs: VillePlan[]) => vs.reduce((n, v) => n + v.joueurs.length, 0);
  let foyer: VillePlan[] = [];
  for (const v of villes) {
    const autour = villes.filter((w) => km(v, w) <= FOYER_KM);
    if (poids(autour) > poids(foyer)) foyer = autour;
  }
  return foyer;
}
