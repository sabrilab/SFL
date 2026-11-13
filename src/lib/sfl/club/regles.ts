// Bola Club : les règles du produit, en fonctions pures (bola-app#14).
//
//   · les rôles : l'admin du club gère tout (licences, catégories, staff,
//     écusson) ; l'entraîneur lit tout le club et n'écrit que dans ses
//     catégories (convocations, appel, stats, notes privées, poste,
//     surclassement, annonces, déplacer un de ses joueurs) ; le joueur lit le
//     club et sa catégorie, répond à ses convocations ; le parent fait de
//     même pour son enfant mineur ;
//   · les notes privées ne sortent que pour le staff de la catégorie du
//     joueur et l'admin : jamais pour le joueur, ni pour son parent ;
//   · l'accord parental est obligatoire avant d'activer le compte d'un moins
//     de 15 ans ; pas de message privé entre un adulte et un mineur (la
//     règle est posée et testée ; la messagerie du club n'est pas construite) ;
//   · les licences : actives + invitations + accords en attente ≤ total ;
//     une licence libérée redevient libre, le joueur garde son compte, sa
//     carte et son historique (« Bola gratuit ») et sort du club : sans
//     licence active, on ne lit, ne gère ni ne répond plus rien (il reste à
//     chacun sa propre fiche) ;
//   · un joueur ou un parent ne voit des autres que les licenciés actifs de
//     sa catégorie : un compte qui attend l'accord d'un parent ne paraît que
//     devant le staff, le joueur et son parent ;
//   · le surclassement va vers la catégorie d'âge juste au-dessus, du même
//     côté (un U13 en U17, jamais en Seniors) ; on ne déplace pas un joueur
//     dans une catégorie qu'il a passé l'âge de jouer ;
//   · une séance est passée par sa date (un match, par son score) : l'appel
//     et les stats s'ouvrent le jour même, pas avant.
// Les mêmes règles en base, pour ce qui y vit (supabase/schema.sql :
// club_licences_garde, est_du_club, role_club). Ni React ni réseau.

import type { Categorie, Club, Licence, Membre, Moi, Seance } from "./types";

/** L'âge d'un joueur un jour donné (deux dates « AAAA-MM-JJ »). */
export function ageLe(naissance: string, jour: string): number {
  const [a, m, d] = naissance.split("-").map(Number);
  const [a2, m2, d2] = jour.split("-").map(Number);
  return a2 - a - (m2 < m || (m2 === m && d2 < d) ? 1 : 0);
}

export const AGE_ACCORD = 15;
export const MAJORITE = 18;

export const accordParentalRequis = (naissance: string, jour: string) => ageLe(naissance, jour) < AGE_ACCORD;

/** Une licence ne s'active jamais sans l'accord du parent quand il est requis. */
export function peutActiver(m: Pick<Membre, "naissance" | "accordParentalLe">, jour: string): boolean {
  return !accordParentalRequis(m.naissance, jour) || m.accordParentalLe !== null;
}

/** Pas de message privé entre un adulte et un mineur ; `naissance` null : un adulte du staff ou un parent. */
export function peutEcrireEnPrive(a: { naissance: string | null }, b: { naissance: string | null }, jour: string): boolean {
  const mineur = (x: { naissance: string | null }) => x.naissance !== null && ageLe(x.naissance, jour) < MAJORITE;
  return mineur(a) === mineur(b);
}

export interface CompteLicences {
  total: number;
  actives: number;
  invitations: number;
  accords: number;
  /** Ce qui reste à donner ; jamais négatif. */
  libres: number;
}

export function compteLicences(club: Pick<Club, "licences" | "licencesTotal">): CompteLicences {
  const n = (s: Licence["statut"]) => club.licences.filter((l) => l.statut === s).length;
  const actives = n("active");
  const invitations = n("invitee");
  const accords = n("attente_accord");
  return { total: club.licencesTotal, actives, invitations, accords, libres: Math.max(0, club.licencesTotal - actives - invitations - accords) };
}

export const licenceDe = (club: Pick<Club, "licences">, compte: string) => club.licences.find((l) => l.compte === compte) ?? null;
/** Ce compte (un joueur, un staff) porte une licence active du club. */
export const licenceActive = (club: Pick<Club, "licences">, compte: string) => licenceDe(club, compte)?.statut === "active";

export const categorieDe = (club: Pick<Club, "categories">, id: string | null) => club.categories.find((c) => c.id === id) ?? null;
export const membreDe = (club: Pick<Club, "membres">, id: string) => club.membres.find((m) => m.id === id) ?? null;

/** Un joueur est d'une catégorie : la sienne, ou celle où il est surclassé. */
export const estDeLaCategorie = (m: Pick<Membre, "categorie" | "surclasseEn">, categorie: string) =>
  m.categorie === categorie || m.surclasseEn === categorie;

/**
 * Où un joueur peut être surclassé : la catégorie d'âge juste au-dessus de la
 * sienne, du même côté (féminines ou non). Un U13 monte en U17, pas en
 * Seniors ; deux catégories du même âge au-dessus sont proposées toutes deux.
 */
export function surclassementsPossibles(m: Pick<Membre, "categorie">, categories: readonly Categorie[]): Categorie[] {
  const sienne = categories.find((c) => c.id === m.categorie);
  if (!sienne || sienne.ageMax === null) return [];
  const age = sienne.ageMax;
  const plusAgees = categories.filter((c) => c.id !== sienne.id && !!c.feminine === !!sienne.feminine && (c.ageMax === null || c.ageMax > age));
  const suivante = Math.min(...plusAgees.map((c) => c.ageMax ?? Infinity));
  return plusAgees.filter((c) => (c.ageMax ?? Infinity) === suivante).sort((a, b) => a.ordre - b.ordre);
}

/** Un joueur a l'âge d'une catégorie : elle n'a pas de limite, ou il ne l'a pas dépassée. */
export const aLAgeDe = (m: Pick<Membre, "naissance">, c: Pick<Categorie, "ageMax">, jour: string) => c.ageMax === null || ageLe(m.naissance, jour) <= c.ageMax;

/** L'âge limite que dit un nom de catégorie : « U13 » → 13 ; sinon aucune. */
export function ageMaxDuNom(nom: string): number | null {
  const m = /^\s*U\s?(\d{1,2})\b/i.exec(nom);
  return m ? Number(m[1]) : null;
}

export interface Droits {
  /** Il porte une licence active (lui, ou l'enfant du parent) : sans elle, il n'est plus du club. */
  actif: boolean;
  /** Tout le club : licences, catégories, staff, écusson. */
  administre: boolean;
  /** Les catégories qu'il lit (effectif, classements, actus). */
  lit: (categorie: string) => boolean;
  /** Les catégories où il écrit : convocation, appel, stats, annonce. */
  gere: (categorie: string) => boolean;
  /** Ce joueur est des siens : poste, surclassement, déplacement, sa fiche d'entraîneur. */
  gereJoueur: (m: Membre) => boolean;
  /** Les notes privées de ce joueur. */
  litNotes: (m: Membre) => boolean;
  /** L'évolution et les présences de ce joueur : son staff, lui-même, son parent. */
  voitFiche: (m: Membre) => boolean;
  /** Ce joueur paraît devant lui (effectif, classements, carte) : lui-même toujours ; le staff voit tout licencié (actif, ou en attente d'accord) ; un joueur ou un parent, les licenciés actifs de sa catégorie. Une licence rendue : plus personne. */
  voitJoueur: (m: Membre) => boolean;
  /** Répondre à une convocation pour ce joueur : lui-même, ou son parent. */
  repond: (m: Membre) => boolean;
  /** Celui pour qui il répond (le joueur, ou l'enfant du parent) ; null pour le staff. */
  joueur: Membre | null;
}

/** Qui voit et fait quoi (le tableau des rôles de la demande). */
export function droits(club: Club, moi: Moi): Droits {
  const enfant = moi.role === "parent" ? (club.parents.find((p) => p.id === moi.id)?.enfant ?? null) : null;
  const joueur = moi.role === "joueur" ? membreDe(club, moi.id) : enfant ? membreDe(club, enfant) : null;
  // La licence qui fait de lui un membre : la sienne, ou celle de l'enfant d'un parent.
  const actif = licenceActive(club, joueur ? joueur.id : moi.id);
  const admin = actif && moi.role === "admin" && club.staff.some((s) => s.id === moi.id && s.role === "admin");
  const entraineur = actif && moi.role === "entraineur" && club.staff.some((s) => s.id === moi.id && s.role === "entraineur");
  const staff = admin || entraineur;
  const gere = (categorie: string) =>
    admin || (entraineur && !!categorieDe(club, categorie)?.entraineurs.includes(moi.id));
  const gereJoueur = (m: Membre) => gere(m.categorie) || (m.surclasseEn !== null && gere(m.surclasseEn));
  const lit = (categorie: string) => staff || (actif && !!joueur && estDeLaCategorie(joueur, categorie));
  const voitFiche = (m: Membre) => gereJoueur(m) || joueur?.id === m.id;
  return {
    actif,
    administre: admin,
    lit,
    gere,
    gereJoueur,
    litNotes: gereJoueur,
    voitFiche,
    voitJoueur: (m) => {
      if (joueur?.id === m.id) return true;
      const statut = licenceDe(club, m.id)?.statut;
      if (staff) return statut === "active" || statut === "attente_accord";
      return statut === "active" && (lit(m.categorie) || (m.surclasseEn !== null && lit(m.surclasseEn)));
    },
    repond: (m) => actif && joueur?.id === m.id,
    joueur,
  };
}

/**
 * Une séance est passée : un match, quand son score est saisi ; un
 * entraînement, le lendemain de sa date. Toucher l'appel d'une séance ne la
 * fait pas passer.
 */
export function seancePassee(s: Seance, jour: string): boolean {
  return s.genre === "match" ? s.score !== null : s.jour < jour;
}

/** L'appel et les stats d'une séance s'ouvrent le jour même, pas avant. */
export const seanceOuverte = (s: Pick<Seance, "jour">, jour: string) => s.jour <= jour;

/** Une séance à venir : on y convoque encore, on y répond encore. */
export const seanceAVenir = (s: Seance, jour: string) => !seancePassee(s, jour) && s.jour >= jour;

/** Les réponses à une convocation : présents, absents, sans réponse. */
export function compteReponses(s: Pick<Seance, "convoques" | "reponses">) {
  let presents = 0;
  let absents = 0;
  for (const id of s.convoques) {
    if (s.reponses[id] === "present") presents++;
    else if (s.reponses[id] === "absent") absents++;
  }
  return { presents, absents, sansReponse: s.convoques.length - presents - absents };
}
