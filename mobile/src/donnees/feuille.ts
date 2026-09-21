/**
 * La feuille de match — ce que l'hôte d'un match remplit, et ce sans quoi
 * rien ne remonte : ni les buts, ni les passes, ni les classements.
 *
 * Quatre états, dans l'ordre. On ne revient jamais en arrière une fois la
 * feuille validée : c'est l'acte qui fige les résultats pour tout le monde.
 *
 *   ouvert ──démarrer──▶ en_cours ──terminer──▶ a_valider ──valider──▶ validee
 *
 * Entre « terminer » et « valider », l'hôte peut encore corriger. C'est le
 * délai voulu : on valide à froid, pas dans le vestiaire.
 */
export type StatutMatch = 'ouvert' | 'en_cours' | 'a_valider' | 'validee';
export type Equipe = 'A' | 'B';

export interface LigneFeuille {
  joueurId: string;
  equipe: Equipe;
  buts: number;
  passes: number;
  mvp: boolean;
}

/** Un but, dans l'ordre où il a été marqué. `t` sert à annuler le dernier. */
export interface But {
  t: number;
  equipe: Equipe;
  joueurId: string;
  passeurId?: string;
}

export interface Feuille {
  matchId: string;
  statut: StatutMatch;
  equipes: Record<Equipe, { nom: string }>;
  lignes: LigneFeuille[];
  buts: But[];
  /** Horodatage de la validation, quand elle a eu lieu. */
  valideeLe?: number;
}

export const EQUIPES_PAR_DEFAUT: Feuille['equipes'] = { A: { nom: 'Orange' }, B: { nom: 'Bleu' } };

export function feuilleVierge(matchId: string): Feuille {
  return { matchId, statut: 'ouvert', equipes: EQUIPES_PAR_DEFAUT, lignes: [], buts: [] };
}

/** Le score se déduit toujours des buts : il ne peut pas se désynchroniser. */
export function score(f: Feuille): Record<Equipe, number> {
  return f.buts.reduce(
    (s, b) => { s[b.equipe] += 1; return s; },
    { A: 0, B: 0 } as Record<Equipe, number>,
  );
}

/** Les compteurs par joueur, recalculés depuis la liste des buts. */
export function lignesDepuisButs(lignes: LigneFeuille[], buts: But[]): LigneFeuille[] {
  return lignes.map((l) => ({
    ...l,
    buts: buts.filter((b) => b.joueurId === l.joueurId).length,
    passes: buts.filter((b) => b.passeurId === l.joueurId).length,
  }));
}

export const LIBELLE_STATUT: Record<StatutMatch, string> = {
  ouvert: 'Match ouvert',
  en_cours: 'Match en cours',
  a_valider: 'Feuille à valider',
  validee: 'Feuille validée',
};
