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

/** Les joueurs posés sur la feuille d'une journée, dans l'ordre de la feuille. */
export function joueursDeLaFeuille(saison: Pick<Saison, "entries">, j: number | null): string[] {
  if (j == null) return [];
  const noms: string[] = [];
  for (const e of saison.entries) {
    if (e.j === j && e.statut === "Présent" && !noms.includes(e.player)) noms.push(e.player);
  }
  return noms;
}

export interface Reponses {
  presents: string[];
  absents: string[];
  sansReponse: string[];
}

/**
 * Les réponses à la convocation, complétées par la feuille : ceux qui ont dit
 * « Je viens » d'abord, puis ceux que l'admin a ajoutés. Un joueur de la
 * feuille quitte « Absents » et « Sans réponse ».
 */
export function avecLaFeuille<T extends Reponses>(r: T, feuille: string[], masque: (nom: string) => boolean): T {
  const ajoutes = feuille.filter((n) => !masque(n) && !r.presents.includes(n));
  if (!ajoutes.length) return r;
  const dessus = new Set(ajoutes);
  return {
    ...r,
    presents: [...r.presents, ...ajoutes],
    absents: r.absents.filter((n) => !dessus.has(n)),
    sansReponse: r.sansReponse.filter((n) => !dessus.has(n)),
  };
}
