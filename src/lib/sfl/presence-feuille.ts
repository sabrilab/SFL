// La feuille de match compte comme une inscription.
//
// Quand l'admin ouvre la journée du dimanche et y pose des joueurs (Admin →
// Feuille, ou un remplaçant en direct), ces joueurs viennent : ils doivent
// apparaître dans « qui vient », compter dans « N participants déjà », et se
// voir eux-mêmes « Tu y es » — même s'ils n'ont jamais touché « Je viens »,
// et même s'ils avaient répondu « Pas dispo » avant que l'admin ne les mette.
// La feuille est la parole de l'admin : elle passe devant la réponse.
//
// Pur : aucune lecture de base ni d'écran, pour pouvoir le vérifier seul.

import type { Saison } from "@/lib/sfl/saisie/types";

/** « 18 octobre », « 18 oct. » → « 18 oct » : de quoi comparer deux dates écrites autrement. */
export function jourMois(label: string): string | null {
  const m = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .match(/(\d{1,2})\s*([a-z]{3})/);
  return m ? `${Number(m[1])} ${m[2]}` : null;
}

/** Le numéro de la journée ouverte pour ce dimanche-là, ou null. */
export function journeeDuJour(saison: Pick<Saison, "journees">, dateLabel: string): number | null {
  const cle = jourMois(dateLabel);
  if (!cle) return null;
  return saison.journees.find((m) => jourMois(m.date) === cle)?.j ?? null;
}

export interface Feuille {
  /** Les joueurs qui comptent, dans l'ordre de la feuille. */
  noms: string[];
  /** Vrai dès que l'admin a mis au moins un joueur dans une équipe. */
  equipes: boolean;
}

/**
 * Les joueurs posés sur la feuille d'une journée. Tant qu'aucune équipe n'est
 * faite, tous comptent ; dès qu'il y a des équipes, seuls ceux qui en ont une
 * sont des participants — un joueur resté sans équipe ne joue pas.
 */
export function joueursDeLaFeuille(saison: Pick<Saison, "entries">, j: number | null): Feuille {
  if (j == null) return { noms: [], equipes: false };
  const lignes = saison.entries.filter((e) => e.j === j && e.statut === "Présent");
  const equipes = lignes.some((e) => !!e.team);
  const noms: string[] = [];
  for (const e of lignes) {
    if ((!equipes || e.team) && !noms.includes(e.player)) noms.push(e.player);
  }
  return { noms, equipes };
}

export interface Reponses {
  presents: string[];
  absents: string[];
  sansReponse: string[];
}

/**
 * Les réponses à la convocation, complétées par la feuille : ceux qui ont dit
 * « Je viens » d'abord, puis ceux que l'admin a ajoutés. Un joueur de la
 * feuille quitte « Absents » et « Sans réponse ». Une fois les équipes
 * faites, la feuille seule fait foi : qui n'a pas d'équipe ne participe pas,
 * même s'il avait dit « Je viens ».
 */
export function avecLaFeuille<T extends Reponses>(r: T, feuille: Feuille, masque: (nom: string) => boolean): T {
  const sur = new Set(feuille.noms.filter((n) => !masque(n)));
  const gardes = feuille.equipes ? r.presents.filter((n) => sur.has(n)) : r.presents;
  const ajoutes = [...sur].filter((n) => !gardes.includes(n));
  if (!ajoutes.length && gardes.length === r.presents.length) return r;
  return {
    ...r,
    presents: [...gardes, ...ajoutes],
    absents: r.absents.filter((n) => !sur.has(n)),
    sansReponse: r.sansReponse.filter((n) => !sur.has(n)),
  };
}

/**
 * Les remplaçants : ceux qui ont dit « Je viens » et qui ne sont dans aucune
 * équipe, pour qu'ils ne disparaissent pas de la liste (incident de la J4).
 * Les équipes de la feuille d'abord, dès qu'il y en a ; sinon celles de la
 * convocation, si `teams` est donné (null tant qu'elles ne se montrent pas).
 * Sans équipes, personne n'est remplaçant : tout le monde vient.
 */
export function remplacantsDe(
  presents: string[],
  saison: Pick<Saison, "entries">,
  j: number | null,
  teams: { players: string[] }[] | null,
  masque: (nom: string) => boolean
): string[] {
  const feuille = joueursDeLaFeuille(saison, j);
  const dedans = feuille.equipes ? new Set(feuille.noms) : teams?.length ? new Set(teams.flatMap((t) => t.players)) : null;
  if (!dedans) return [];
  return [...new Set(presents)].filter((n) => !masque(n) && !dedans.has(n));
}
