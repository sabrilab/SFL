// Les équipes d'une journée : les Noirs contre les Blancs, match par match.
//
// Sabri, 23/10 : « Quand on va créer des matchs, une journée ou des feuilles
// de match, il faut que tu me permettes de faire des équipes noires contre
// blanches tout le temps. On oublie les couleurs orange, jaune, vert, bleu
// […]. Noir contre blanc, juste match 1 et match 2, c'est ça qui les
// diffère. »
//
// Une équipe garde un nom interne, unique dans sa journée : c'est la clé de
// la saisie (MatchEntry.team) et du moteur. Depuis le 23/10, ce nom dit son
// camp et son match : « Noirs 2 », « Blancs 2 ». Les journées d'avant
// gardent leurs couleurs (Orange, Bleu…), qui ne se montrent plus : dans
// chaque match que forme le moteur (saisie/engine.ts), la première équipe
// joue en noir, la seconde en blanc.
//
// Pur : aucune lecture de base ni d'écran.

import type { Journee } from "../engine";

export type Camp = "Noirs" | "Blancs";

/** Le maillot de chaque camp, pour les pastilles. */
export const MAILLOT: Record<Camp, string> = { Noirs: "#0A0B0D", Blancs: "#F4F3EF" };

/** Les deux équipes du Match n (1 pour le Match 1), les Noirs d'abord. */
export function equipesDuMatch(n: number): [string, string] {
  return [`Noirs ${n}`, `Blancs ${n}`];
}

/** « Blancs 2 » : les Blancs du Match 2 ; null pour une couleur d'avant le 23/10. */
export function lireEquipe(nom: string): { camp: Camp; n: number } | null {
  const m = /^(Noirs|Blancs) (\d+)$/.exec(nom);
  return m ? { camp: m[1] as Camp, n: Number(m[2]) } : null;
}

export interface EquipeDuJour {
  /** Le nom interne (MatchEntry.team). */
  nom: string;
  /** Son camp ; null pour une couleur d'avant le 23/10 sans adversaire ce jour-là. */
  camp: Camp | null;
  /** Son match, 1 pour le Match 1 ; null sans adversaire. */
  match: number | null;
  /** « Noirs » ; « Noirs · Match 2 » un jour à plusieurs matchs. */
  libelle: string;
  /** « Noirs », « Noirs 2 » : pour une cellule étroite. */
  court: string;
}

function equipe(nom: string, camp: Camp, match: number, plusieurs: boolean): EquipeDuJour {
  return {
    nom,
    camp,
    match,
    libelle: plusieurs ? `${camp} · Match ${match}` : camp,
    court: plusieurs ? `${camp} ${match}` : camp,
  };
}

function sansAdversaire(nom: string): EquipeDuJour {
  const lu = lireEquipe(nom);
  return { nom, camp: lu?.camp ?? null, match: null, libelle: lu ? `${lu.camp} · Match ${lu.n}` : nom, court: nom };
}

/**
 * Les équipes d'une journée, match par match (les Noirs, puis les Blancs),
 * puis celles de `noms` qui n'ont pas d'adversaire (toutes absentes en face,
 * ou pas encore appariées).
 */
export function equipesDuJour(journee: Pick<Journee, "matches"> | undefined, noms: string[] = []): EquipeDuJour[] {
  const matches = journee?.matches ?? [];
  const plusieurs = matches.length > 1;
  const out = matches.flatMap((m, i) => [
    equipe(m.teamA.name, "Noirs", i + 1, plusieurs),
    equipe(m.teamB.name, "Blancs", i + 1, plusieurs),
  ]);
  for (const nom of noms) if (!out.some((e) => e.nom === nom)) out.push(sansAdversaire(nom));
  return out;
}

/**
 * Les équipes de dimanche composées sur la convocation : appariées deux à
 * deux dans leur ordre, comme sur la feuille de match (lib/sfl/feuille.ts).
 */
export function equipesDeConvocation(
  teams: { name: string; players: string[] }[]
): (EquipeDuJour & { joueurs: string[] })[] {
  const pleines = teams.filter((t) => t.players.length > 0);
  const nbMatchs = Math.floor(pleines.length / 2);
  return pleines.map((t, i) => ({
    ...(i < nbMatchs * 2
      ? equipe(t.name, i % 2 === 0 ? "Noirs" : "Blancs", Math.floor(i / 2) + 1, nbMatchs > 1)
      : sansAdversaire(t.name)),
    joueurs: t.players,
  }));
}

/**
 * Les deux équipes d'un match de plus dans une journée qui en a déjà
 * `nbMatchs` : leur numéro passe après tous ceux déjà pris, pour qu'aucun
 * nom ne serve deux fois. Ne sert plus qu'à « + Match N » (ajouterMatch).
 */
export function equipesDuMatchSuivant(noms: string[], nbMatchs: number): [string, string] {
  const pris = noms.map((n) => lireEquipe(n)?.n ?? 0);
  return equipesDuMatch(Math.max(nbMatchs, ...pris) + 1);
}

/**
 * Les équipes qu'on peut donner à une ligne de saisie : celles des matchs
 * qui EXISTENT dans sa journée, match par match — ceux que forme le moteur,
 * puis les matchs déclarés encore vides (`declares`, « + Match 3 »). Plus
 * jamais les équipes d'un « match de plus » : c'est ce choix, offert dans
 * chaque sélecteur, qui a fait naître les matchs 5 et 6 de la J3 (28/10).
 * Un match ne naît que par « + Match N ».
 */
export function choixDEquipe(
  journee: Pick<Journee, "matches"> | undefined,
  noms: string[],
  declares: readonly { equipes: [string, string] }[] = []
): EquipeDuJour[] {
  const out = equipesDuJour(journee, noms);
  const plusieurs = (journee?.matches?.length ?? 0) + declares.length > 1;
  let n = journee?.matches?.length ?? 0;
  for (const m of declares) {
    if (out.some((e) => e.nom === m.equipes[0] || e.nom === m.equipes[1])) continue;
    n++;
    out.push(equipe(m.equipes[0], "Noirs", n, plusieurs), equipe(m.equipes[1], "Blancs", n, plusieurs));
  }
  return out;
}
