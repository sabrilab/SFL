/**
 * L'état partagé de l'app.
 *
 * Volontairement minuscule et sans dépendance : un store externe lu par
 * `useSyncExternalStore`. Les écrans et les feuilles natives sont des routes
 * distinctes — passer par un contexte obligerait à les imbriquer, ce que la
 * présentation en feuille rend inutilement compliqué.
 *
 * Demain : remplacer `lire()`/`ecrire()` par Supabase, l'interface ne bouge pas.
 */
import { useSyncExternalStore } from 'react';

import { MAX_JOUEURS, MIN_JOUEURS, probleme, type Ecusson, type Equipe as EquipeJoueurs } from '@/donnees/equipes';
import {
  feuilleVierge, lignesDepuisButs, type Equipe, type Feuille,
} from '@/donnees/feuille';
import { MOI_ID } from '@/donnees/joueurs';
import { MATCHS_INITIAUX, PHOTOS, type Match } from '@/donnees/matchs';
import { CONVOCATION, STATS_JOUEUR } from '@/donnees/ligue';
import { ecrire, lire } from './persistance';

export type Reponse = 'present' | 'absent' | null;

interface Etat {
  matchs: Match[];
  rejoints: string[];
  reponse: Reponse;
  stats: { cle: string; nom: string; valeur: number }[];
  vitesseGagnee: boolean;
  /** Les feuilles des matchs que l'utilisateur héberge, par id de match. */
  feuilles: Record<string, Feuille>;
  /** L'équipe de l'utilisateur, s'il en a monté une. Une seule pour l'instant. */
  equipe: EquipeJoueurs | null;
  /** Les joueurs ajoutés en amis. */
  amis: string[];
}

// Les matchs créés reviennent avec leur photo d'asset : un identifiant
// d'asset peut changer d'un build à l'autre, on ne fait pas confiance à celui
// qui a été sauvegardé.
const sauve = lire();
const matchsCrees = sauve.matchsCrees.map((m) => ({ ...m, photo: PHOTOS.mien }));

let etat: Etat = {
  matchs: [...matchsCrees, ...MATCHS_INITIAUX],
  rejoints: [],
  reponse: null,
  stats: STATS_JOUEUR,
  vitesseGagnee: false,
  // Les feuilles survivent à la fermeture de l'app : un but marqué reste marqué.
  feuilles: sauve.feuilles,
  equipe: sauve.equipe,
  amis: sauve.amis,
};

const idsCrees = new Set(matchsCrees.map((m) => m.id));

const abonnes = new Set<() => void>();
const publier = () => abonnes.forEach((f) => f());

function poser(suite: Partial<Etat>) {
  etat = { ...etat, ...suite };
  if (suite.feuilles || suite.matchs || 'equipe' in suite || suite.amis) {
    ecrire({
      feuilles: etat.feuilles,
      matchsCrees: etat.matchs.filter((m) => idsCrees.has(m.id)),
      equipe: etat.equipe,
      amis: etat.amis,
    });
  }
  publier();
}

/** Modifie la feuille d'un match et la range. Ne fait rien si elle est validée. */
function surFeuille(matchId: string, f: (feuille: Feuille) => Feuille) {
  const actuelle = etat.feuilles[matchId] ?? feuilleVierge(matchId);
  if (actuelle.statut === 'validee') return;
  poser({ feuilles: { ...etat.feuilles, [matchId]: f(actuelle) } });
}

export function useEtat(): Etat {
  return useSyncExternalStore(
    (f) => { abonnes.add(f); return () => abonnes.delete(f); },
    () => etat,
    () => etat,
  );
}

export const actions = {
  /** Rejoindre ou quitter un match — la place se libère vraiment. */
  basculerMatch(id: string) {
    const dedans = etat.rejoints.includes(id);
    poser({
      rejoints: dedans ? etat.rejoints.filter((x) => x !== id) : [...etat.rejoints, id],
      matchs: etat.matchs.map((m) =>
        m.id === id ? { ...m, pris: m.pris + (dedans ? -1 : 1) } : m),
    });
    return !dedans;
  },

  /** Ouvrir son propre match : on en devient l'hôte, et on y est inscrit. */
  ouvrirMatch(champs: { lieu: string; titre: string; heure: string; niveau: string }) {
    const id = String(Date.now());
    const jour = champs.titre === 'Ce soir' ? 'jour'
      : champs.titre === 'Samedi' || champs.titre === 'Dimanche' ? 'weekend' : 'semaine';
    const neuf: Match = {
      id, titre: champs.titre, heure: champs.heure, jour,
      lieu: champs.lieu || 'Terrain sans nom', loin: '400 m',
      places: 10, pris: 1, niveau: champs.niveau, sfl: false,
      photo: PHOTOS.mien, x: 44 + Math.random() * 14, y: 46 + Math.random() * 10,
      hote: 'Toi', init: 'TOI', hoteNote: 'Ton premier match organisé',
      prix: 'Gratuit', prixNote: 'terrain libre', seuls: 0, gens: [],
    };
    const feuille = feuilleVierge(id);
    feuille.lignes = [{ joueurId: MOI_ID, equipe: 'A', buts: 0, passes: 0, mvp: false }];
    idsCrees.add(id);
    poser({
      matchs: [neuf, ...etat.matchs],
      rejoints: [...etat.rejoints, id],
      feuilles: { ...etat.feuilles, [id]: feuille },
    });
    return id;
  },

  /* ── Les amis ── */

  /** Ajoute ou retire un ami. Renvoie true s'il est ami après l'action. */
  basculerAmi(joueurId: string): boolean {
    if (joueurId === MOI_ID) return false;
    const dedans = etat.amis.includes(joueurId);
    poser({ amis: dedans ? etat.amis.filter((a) => a !== joueurId) : [...etat.amis, joueurId] });
    return !dedans;
  },

  /* ── L'équipe ── */

  /**
   * Monte l'équipe. Refuse en dessous de cinq et au-dessus de sept : la règle
   * vit ici, l'écran ne fait que l'expliquer. Renvoie le problème, ou null.
   */
  creerEquipe(champs: { nom: string; ecusson: Ecusson; joueurs: string[] }): string | null {
    const joueurs = [MOI_ID, ...champs.joueurs.filter((j) => j !== MOI_ID)];
    const souci = probleme(champs.nom, joueurs);
    if (souci) return souci;
    poser({ equipe: { id: 'moi', nom: champs.nom.trim(), ecusson: champs.ecusson, joueurs, creeLe: Date.now() } });
    return null;
  },

  modifierEquipe(champs: Partial<Pick<EquipeJoueurs, 'nom' | 'ecusson'>>): string | null {
    if (!etat.equipe) return "Tu n'as pas encore d'équipe.";
    const nom = champs.nom ?? etat.equipe.nom;
    const souci = probleme(nom, etat.equipe.joueurs);
    if (souci) return souci;
    poser({ equipe: { ...etat.equipe, nom: nom.trim(), ecusson: champs.ecusson ?? etat.equipe.ecusson } });
    return null;
  },

  /** Ajoute ou retire un joueur, dans les bornes 5–7. Le capitaine ne part pas. */
  basculerJoueurEquipe(joueurId: string): string | null {
    const e = etat.equipe;
    if (!e) return "Tu n'as pas encore d'équipe.";
    if (joueurId === MOI_ID) return 'Le capitaine reste dans son équipe.';
    const dedans = e.joueurs.includes(joueurId);
    if (dedans && e.joueurs.length <= MIN_JOUEURS) return `Une équipe garde au moins ${MIN_JOUEURS} joueurs.`;
    if (!dedans && e.joueurs.length >= MAX_JOUEURS) return `Pas plus de ${MAX_JOUEURS} joueurs.`;
    poser({ equipe: { ...e, joueurs: dedans ? e.joueurs.filter((j) => j !== joueurId) : [...e.joueurs, joueurId] } });
    return null;
  },

  dissoudreEquipe() {
    poser({ equipe: null });
  },

  /** Inscrit toute l'équipe sur la feuille d'un match qu'on héberge, côté A. */
  inscrireEquipeSurMatch(matchId: string) {
    const e = etat.equipe;
    if (!e) return;
    surFeuille(matchId, (f) => {
      const deja = new Set(f.lignes.map((l) => l.joueurId));
      const ajouts = e.joueurs.filter((j) => !deja.has(j))
        .map((joueurId) => ({ joueurId, equipe: 'A' as Equipe, buts: 0, passes: 0, mvp: false }));
      return { ...f, equipes: { ...f.equipes, A: { nom: e.nom } }, lignes: [...f.lignes, ...ajouts] };
    });
  },

  /* ── La feuille de match, côté hôte ── */

  /** Ajoute un joueur de la ligue au match, ou l'en retire. */
  basculerPresent(matchId: string, joueurId: string) {
    surFeuille(matchId, (f) => {
      const present = f.lignes.some((l) => l.joueurId === joueurId);
      if (present) {
        return { ...f, lignes: f.lignes.filter((l) => l.joueurId !== joueurId),
          buts: f.buts.filter((b) => b.joueurId !== joueurId)
            .map((b) => (b.passeurId === joueurId ? { ...b, passeurId: undefined } : b)) };
      }
      // On équilibre : le nouveau va dans l'équipe la moins nombreuse.
      const nA = f.lignes.filter((l) => l.equipe === 'A').length;
      const nB = f.lignes.length - nA;
      const equipe: Equipe = nA <= nB ? 'A' : 'B';
      return { ...f, lignes: [...f.lignes, { joueurId, equipe, buts: 0, passes: 0, mvp: false }] };
    });
  },

  /** Change un joueur d'équipe. */
  changerEquipe(matchId: string, joueurId: string) {
    surFeuille(matchId, (f) => ({
      ...f,
      lignes: f.lignes.map((l) => l.joueurId === joueurId ? { ...l, equipe: l.equipe === 'A' ? 'B' : 'A' } : l),
    }));
  },

  demarrerMatch(matchId: string) {
    surFeuille(matchId, (f) => (f.statut === 'ouvert' ? { ...f, statut: 'en_cours' } : f));
  },

  /** Un but, à l'instant où il est marqué. Le score et les compteurs suivent. */
  marquerBut(matchId: string, joueurId: string, passeurId?: string) {
    surFeuille(matchId, (f) => {
      const ligne = f.lignes.find((l) => l.joueurId === joueurId);
      if (!ligne) return f;
      const buts = [...f.buts, { t: Date.now(), equipe: ligne.equipe, joueurId, passeurId }];
      return { ...f, buts, lignes: lignesDepuisButs(f.lignes, buts) };
    });
  },

  /** Attribue (ou retire) la passe du dernier but. */
  passeurDuDernierBut(matchId: string, passeurId?: string) {
    surFeuille(matchId, (f) => {
      if (!f.buts.length) return f;
      const buts = f.buts.map((b, i) => (i === f.buts.length - 1 ? { ...b, passeurId } : b));
      return { ...f, buts, lignes: lignesDepuisButs(f.lignes, buts) };
    });
  },

  annulerDernierBut(matchId: string) {
    surFeuille(matchId, (f) => {
      const buts = f.buts.slice(0, -1);
      return { ...f, buts, lignes: lignesDepuisButs(f.lignes, buts) };
    });
  },

  basculerMvp(matchId: string, joueurId: string) {
    surFeuille(matchId, (f) => ({
      ...f,
      // Un seul homme du match.
      lignes: f.lignes.map((l) => ({ ...l, mvp: l.joueurId === joueurId ? !l.mvp : false })),
    }));
  },

  /** Fin du match : la feuille passe « à valider ». On peut encore corriger. */
  terminerMatch(matchId: string) {
    surFeuille(matchId, (f) => (f.statut === 'en_cours' ? { ...f, statut: 'a_valider' } : f));
  },

  /** L'acte qui fige tout. Après ça, plus aucune modification n'est acceptée. */
  validerFeuille(matchId: string) {
    surFeuille(matchId, (f) =>
      f.statut === 'a_valider' ? { ...f, statut: 'validee', valideeLe: Date.now() } : f);
  },

  /** Répondre à la convocation de la journée — retoucher annule la réponse. */
  repondre(r: Exclude<Reponse, null>) {
    poser({ reponse: etat.reponse === r ? null : r });
  },

  /** Le test de réflexes ne fait gagner son point qu'une fois. */
  gagnerVitesse() {
    if (etat.vitesseGagnee) return false;
    poser({
      vitesseGagnee: true,
      stats: etat.stats.map((s) =>
        s.cle === 'VIT' ? { ...s, valeur: Math.min(99, s.valeur + 1) } : s),
    });
    return true;
  },
};

/** Les matchs hébergés par l'utilisateur dont la feuille attend encore une action. */
export function feuillesEnAttente(e: Etat): { match: Match; feuille: Feuille }[] {
  return Object.values(e.feuilles)
    .filter((f) => f.statut === 'en_cours' || f.statut === 'a_valider')
    .map((f) => ({ feuille: f, match: e.matchs.find((m) => m.id === f.matchId) }))
    .filter((x): x is { match: Match; feuille: Feuille } => !!x.match);
}

export function compteConvocation(reponse: Reponse) {
  const presents = CONVOCATION.presents.length + (reponse === 'present' ? 1 : 0);
  const absents = CONVOCATION.absents.length + (reponse === 'absent' ? 1 : 0);
  return { presents, absents, sansReponse: Math.max(0, CONVOCATION.total - presents - absents) };
}
