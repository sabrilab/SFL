// Bola Club : les classements internes d'un club (bola-app#14 : « par
// catégorie : progression, assiduité, buteurs (mois / saison) »), et le tri
// de l'effectif (note, progression, présences, buts).
//
//   · progression : les points de stats pris sur la période, lus dans le
//     journal du moteur des cartes (saison.ts). Les combinées (vitesse,
//     dribble), que le moteur ne donne qu'à la mise à jour, sont comptées le
//     jour du match de cette mise à jour ; celles encore en attente, le jour
//     du dernier match. Sur la saison, c'est la carte en direct moins la
//     carte de départ ;
//   · assiduité : les présences (à l'heure ou en retard) sur les séances
//     passées où le joueur était attendu, matchs et entraînements, en % ;
//   · buteurs : les buts des matchs joués.
// La période : le mois du jour de la démo, ou toute la saison. Les ex æquo
// partagent leur rang (1, 1, 3). Pur.

import { STAT_KEYS } from "@/lib/sfl/engine";
import { seancePassee } from "./regles";
import { cartesDuClub, type CarteClub } from "./saison";
import type { Club, Membre, Seance } from "./types";

export type Periode = "mois" | "saison";
export type ClassementClub = "progression" | "assiduite" | "buteurs";
export type TriEffectif = "note" | "progression" | "presences" | "buts";

const dansLaPeriode = (club: Pick<Club, "jour">, periode: Periode) => (jour: string) =>
  periode === "saison" || jour.slice(0, 7) === club.jour.slice(0, 7);

const somme = (g: Partial<Record<string, number>>) => STAT_KEYS.reduce((s, k) => s + (g[k] ?? 0), 0);

/** Les points pris par un joueur, match par match (les combinées au match de leur mise à jour). */
export function pointsParMatch(carte: CarteClub): { match: Seance; points: number }[] {
  const { ev, matchs } = carte;
  if (!ev) return [];
  const pris = new Map<number, number>();
  for (const d of ev.journal) pris.set(d.j, somme(d.points));
  // Les combinées : ce qu'une mise à jour a donné de plus que les points de ses matchs.
  const majs = [...ev.majs].sort((a, b) => a.apresJ - b.apresJ);
  let avant = 0;
  for (const m of majs) {
    let fenetre = 0;
    for (const [j, p] of pris) if (j > avant && j <= m.apresJ) fenetre += p;
    pris.set(m.apresJ, (pris.get(m.apresJ) ?? 0) + somme(m.gains) - fenetre);
    avant = m.apresJ;
  }
  // Celles encore en attente, au dernier match.
  const dernier = matchs.length;
  let depuis = 0;
  for (const d of ev.journal) if (d.j > avant) depuis += somme(d.points);
  const attente = somme(ev.enAttente) - depuis;
  if (attente > 0 && dernier > 0) pris.set(dernier, (pris.get(dernier) ?? 0) + attente);
  return matchs.map((match, i) => ({ match, points: pris.get(i + 1) ?? 0 }));
}

export function progression(club: Club, id: string, periode: Periode): number {
  const carte = cartesDuClub(club).get(id);
  if (!carte) return 0;
  const dedans = dansLaPeriode(club, periode);
  return pointsParMatch(carte).reduce((s, p) => s + (dedans(p.match.jour) ? p.points : 0), 0);
}

export interface Assiduite {
  presents: number;
  total: number;
  /** En %, arrondi ; null sans séance. */
  pct: number | null;
}

/** Les séances passées où le joueur était attendu, dans l'ordre. */
export function seancesDe(club: Pick<Club, "seances" | "jour">, id: string): Seance[] {
  return club.seances
    .filter((s) => seancePassee(s, club.jour) && s.convoques.includes(id))
    .sort((a, b) => a.jour.localeCompare(b.jour) || a.heure.localeCompare(b.heure) || a.id.localeCompare(b.id));
}

export function assiduite(club: Pick<Club, "seances" | "jour">, id: string, periode: Periode): Assiduite {
  const dedans = dansLaPeriode(club, periode);
  const seances = seancesDe(club, id).filter((s) => dedans(s.jour));
  const presents = seances.filter((s) => (s.appel[id] ?? "absent") !== "absent").length;
  return { presents, total: seances.length, pct: seances.length ? Math.round((presents / seances.length) * 100) : null };
}

export function buts(club: Pick<Club, "seances" | "jour">, id: string, periode: Periode): number {
  const dedans = dansLaPeriode(club, periode);
  return club.seances.reduce((s, x) => s + (x.genre === "match" && x.score !== null && dedans(x.jour) ? (x.stats[id]?.buts ?? 0) : 0), 0);
}

export interface LigneClassee {
  membre: Membre;
  valeur: number;
  /** « +4 », « 94 % », « 9 ». */
  libelle: string;
  /** Les ex æquo partagent leur rang. */
  rang: number;
}

/** Range par valeur décroissante (à égalité : le nom), et donne les rangs, ex æquo compris. */
export function ranger(lignes: { membre: Membre; valeur: number; libelle: string }[]): LigneClassee[] {
  const tri = [...lignes].sort(
    (a, b) => b.valeur - a.valeur || a.membre.nom.localeCompare(b.membre.nom, "fr") || a.membre.prenom.localeCompare(b.membre.prenom, "fr"),
  );
  const out: LigneClassee[] = [];
  tri.forEach((l, i) => out.push({ ...l, rang: i > 0 && tri[i - 1].valeur === l.valeur ? out[i - 1].rang : i + 1 }));
  return out;
}

const signe = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Un classement interne : les joueurs donnés, sur la période. Sans séance (assiduité) ou sans but, un joueur n'y est pas. */
export function classementClub(club: Club, membres: readonly Membre[], classement: ClassementClub, periode: Periode): LigneClassee[] {
  if (classement === "progression")
    return ranger(membres.map((membre) => ({ membre, valeur: progression(club, membre.id, periode) })).map((l) => ({ ...l, libelle: signe(l.valeur) })));
  if (classement === "assiduite")
    return ranger(
      membres
        .map((membre) => ({ membre, a: assiduite(club, membre.id, periode) }))
        .filter((l) => l.a.pct !== null)
        .map((l) => ({ membre: l.membre, valeur: l.a.pct!, libelle: `${l.a.pct} %` })),
    );
  return ranger(
    membres
      .map((membre) => ({ membre, valeur: buts(club, membre.id, periode) }))
      .filter((l) => l.valeur > 0)
      .map((l) => ({ ...l, libelle: String(l.valeur) })),
  );
}

/** L'effectif trié : la note de la carte officielle, la progression du mois, les présences ou les buts de la saison. */
export function trierEffectif(club: Club, membres: readonly Membre[], tri: TriEffectif): LigneClassee[] {
  const cartes = cartesDuClub(club);
  if (tri === "note") return ranger(membres.map((membre) => ({ membre, valeur: cartes.get(membre.id)?.note ?? 0 })).map((l) => ({ ...l, libelle: String(l.valeur) })));
  if (tri === "progression")
    return ranger(membres.map((membre) => ({ membre, valeur: progression(club, membre.id, "mois") })).map((l) => ({ ...l, libelle: signe(l.valeur) })));
  if (tri === "presences")
    return ranger(
      membres.map((membre) => {
        const a = assiduite(club, membre.id, "saison");
        return { membre, valeur: a.pct ?? -1, libelle: a.pct === null ? "—" : `${a.pct} %` };
      }),
    );
  return ranger(membres.map((membre) => ({ membre, valeur: buts(club, membre.id, "saison") })).map((l) => ({ ...l, libelle: String(l.valeur) })));
}

/** Les quatre lignes de postes du filtre de l'effectif. */
export const LIGNES_POSTES = [
  { id: "gardiens", label: "Gardiens", postes: ["G"] },
  { id: "defenseurs", label: "Défenseurs", postes: ["DG", "DC", "DD"] },
  { id: "milieux", label: "Milieux", postes: ["MDC", "MC"] },
  { id: "attaquants", label: "Attaquants", postes: ["AG", "AT", "AD"] },
] as const;
export type LignePoste = (typeof LIGNES_POSTES)[number]["id"];
