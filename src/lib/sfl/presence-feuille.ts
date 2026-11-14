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
 * Les équipes de la feuille d'une journée, au format de la convocation
 * (Sabri, 14/11/2026, veille de la J6 : « J'ai rajouté [Souley] à la main,
 * donc rajoute-le aussi dans les compositions d'équipe »). Dès que l'admin a
 * posé des équipes sur la feuille, ce sont elles qu'on montre sous « Les
 * équipes de dimanche », et plus celles de la convocation, faites avant :
 * un joueur ajouté à la main y entre, un joueur retiré en sort. Match par
 * match (les Noirs puis les Blancs, journees[].matchsDuJour d'abord), les
 * joueurs dans l'ordre de la feuille ; ni ligne vitrine, ni Xtratime.
 * null tant que la feuille n'a pas d'équipe.
 */
export function equipesDeLaFeuille(
  saison: Pick<Saison, "entries"> & { journees?: Saison["journees"] },
  j: number | null
): { name: string; players: string[] }[] | null {
  if (j == null) return null;
  const parEquipe = new Map<string, string[]>();
  for (const e of saison.entries) {
    if (e.j !== j || e.statut !== "Présent" || !e.team || e.vitrine || e.extraTime) continue;
    const l = parEquipe.get(e.team) ?? [];
    if (!l.includes(e.player)) l.push(e.player);
    parEquipe.set(e.team, l);
  }
  if (!parEquipe.size) return null;
  const ordre: string[] = [];
  const meta = saison.journees?.find((m) => m.j === j);
  for (const m of meta?.matchsDuJour ?? []) for (const t of m.equipes) if (parEquipe.has(t) && !ordre.includes(t)) ordre.push(t);
  // Le reste : par numéro de match, les Noirs avant les Blancs.
  const rang = (t: string) => {
    const x = /^(Noirs|Blancs) (\d+)$/.exec(t);
    return x ? Number(x[2]) * 2 + (x[1] === "Noirs" ? 0 : 1) : Number.MAX_SAFE_INTEGER;
  };
  const reste = [...parEquipe.keys()].filter((t) => !ordre.includes(t)).sort((a, b) => rang(a) - rang(b));
  return [...ordre, ...reste].map((name) => ({ name, players: parEquipe.get(name)! }));
}

/**
 * Les remplaçants : ceux qui ont dit « Je viens » et qui ne sont dans aucune
 * équipe, pour qu'ils ne disparaissent pas de la liste (incident de la J4).
 * Les équipes de la feuille d'abord, dès qu'il y en a ; sinon celles de la
 * convocation, si `teams` est donné (null tant qu'elles ne se montrent pas).
 * Sans équipes, personne n'est remplaçant : tout le monde vient.
 *
 * Dès que la feuille a ses équipes, un joueur que l'admin en a retiré
 * (Sabri, 14/11/2026 : « ces gens que je retire, tu les mets en
 * remplaçant ») y passe aussi : un joueur des équipes de la convocation, ou
 * une ligne de la feuille restée sans équipe (Présent ou Suspendu, jamais
 * une absence). Un remplaçant ne prend pas la
 * feuille du match (feuille-direct.ts : seuls les joueurs d'une équipe).
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
  const retires = feuille.equipes
    ? [
        ...(teams ?? []).flatMap((t) => t.players),
        ...saison.entries
          .filter((e) => e.j === j && !e.team && !e.vitrine && !e.extraTime && (e.statut === "Présent" || e.statut === "Suspendu"))
          .map((e) => e.player),
      ]
    : [];
  return [...new Set([...presents, ...retires])].filter((n) => !masque(n) && !dedans.has(n));
}
