// Bola Club : tout ce qui change le club, en fonctions pures (bola-app#14).
// Chacune prend le club et celui qui agit, et rend le club d'après, ou le
// refus à afficher : elle refuse ce que les rôles interdisent (regles.ts,
// droits). L'app de démonstration les applique à l'état gardé sur le
// téléphone (store.ts) ; rien ne part en base.
//
//   · l'admin : créer et renommer une catégorie, ranger le staff, importer
//     une liste (des invitations), changer l'écusson, libérer une licence ;
//   · l'entraîneur, dans ses catégories (et l'admin partout) : déplacer un
//     joueur (vers une autre de ses catégories ; l'admin, vers n'importe
//     laquelle ; jamais dans une catégorie dont il a passé l'âge), changer
//     son poste, le surclasser (dans la catégorie d'âge juste au-dessus),
//     écrire une note privée, créer un match ou un entraînement, convoquer
//     ou retirer un joueur, faire l'appel, saisir les stats et le score (le
//     jour de la séance, pas avant), publier une annonce ;
//   · le joueur (ou son parent) : répondre à sa convocation, tant que la
//     séance n'est pas passée.
// Un joueur qui change de catégorie, perd son surclassement ou sa licence
// sort des convocations à venir où il n'a plus sa place (convocationsTenues).

import type { Blason } from "@/lib/sfl/blason";
import { lireBlason } from "@/lib/sfl/blason";
import { POSTES, type Poste } from "@/lib/sfl/inscription";
import {
  aLAgeDe,
  ageMaxDuNom,
  categorieDe,
  compteLicences,
  droits,
  estDeLaCategorie,
  licenceActive,
  membreDe,
  seanceAVenir,
  seanceOuverte,
  surclassementsPossibles,
} from "./regles";
import type { Categorie, Club, EtatAppel, Licence, LigneStats, Moi, Reponse, Seance } from "./types";

export type Resultat = { ok: true; club: Club } | { ok: false; refus: string };

const refus = (r: string): Resultat => ({ ok: false, refus: r });
const ok = (club: Club): Resultat => ({ ok: true, club });

const PAS_LE_DROIT = "Tu n'as pas la main sur cette catégorie.";
const ADMIN_SEUL = "Seul l'admin du club peut faire ça.";

const nomPropre = (brut: string) => brut.replace(/\s+/g, " ").trim();
const cle = (nom: string) => nomPropre(nom).toLowerCase();

/** Ce qu'un nom de catégorie dit d'elle : son âge limite (« U13 »), son côté (« Féminines »). */
const lueDuNom = (nom: string): Pick<Categorie, "ageMax" | "feminine"> => ({ ageMax: ageMaxDuNom(nom), feminine: /f[ée]minin/i.test(nom) || undefined });

/** Une date « AAAA-MM-JJ » qui existe au calendrier. */
export function dateVraie(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/**
 * Les convocations à venir ne gardent que ceux qui y ont leur place : un
 * licencié actif de la catégorie (la sienne, ou celle où il est surclassé).
 * Les séances passées ne bougent pas : l'histoire reste.
 */
export function convocationsTenues(club: Club): Club {
  const tient = new Map(club.membres.map((m) => [m.id, m]));
  let touche = false;
  const seances = club.seances.map((s) => {
    if (!seanceAVenir(s, club.jour)) return s;
    const convoques = s.convoques.filter((id) => {
      const m = tient.get(id);
      return !!m && estDeLaCategorie(m, s.categorie) && licenceActive(club, id);
    });
    if (convoques.length === s.convoques.length) return s;
    touche = true;
    const garde = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([id]) => convoques.includes(id)));
    return { ...s, convoques, reponses: garde(s.reponses), appel: garde(s.appel), stats: garde(s.stats) };
  });
  return touche ? { ...club, seances } : club;
}

/** Les surclassements qui ne vont plus vers la catégorie juste au-dessus tombent. */
function surclassementsTenus(club: Club): Club {
  const membres = club.membres.map((m) =>
    m.surclasseEn !== null && !surclassementsPossibles(m, club.categories).some((c) => c.id === m.surclasseEn) ? { ...m, surclasseEn: null } : m,
  );
  return membres.some((m, i) => m !== club.membres[i]) ? { ...club, membres } : club;
}

function erreurNomCategorie(club: Club, nom: string, sauf?: string): string | null {
  const n = nomPropre(nom);
  if (n.length < 1 || n.length > 20) return "Un nom de 1 à 20 caractères.";
  if (club.categories.some((c) => c.id !== sauf && cle(c.nom) === cle(n))) return "Cette catégorie existe déjà.";
  return null;
}

export function creerCategorie(club: Club, moi: Moi, nom: string): Resultat {
  if (!droits(club, moi).administre) return refus(ADMIN_SEUL);
  const e = erreurNomCategorie(club, nom);
  if (e) return refus(e);
  const n = nomPropre(nom);
  let k = club.categories.length + 1;
  while (club.categories.some((c) => c.id === `cat-${k}`)) k++;
  const ordre = Math.max(0, ...club.categories.map((c) => c.ordre)) + 1;
  return ok({ ...club, categories: [...club.categories, { id: `cat-${k}`, nom: n, ordre, entraineurs: [], ...lueDuNom(n) }] });
}

export function renommerCategorie(club: Club, moi: Moi, id: string, nom: string): Resultat {
  if (!droits(club, moi).administre) return refus(ADMIN_SEUL);
  if (!categorieDe(club, id)) return refus("Catégorie introuvable.");
  const e = erreurNomCategorie(club, nom, id);
  if (e) return refus(e);
  // Le nom dit l'âge et le côté de la catégorie, comme à sa création : « U13 » renommée « U15 » passe à 15 ans.
  const n = nomPropre(nom);
  const renomme = { ...club, categories: club.categories.map((c) => (c.id === id ? { ...c, nom: n, ...lueDuNom(n) } : c)) };
  return ok(convocationsTenues(surclassementsTenus(renomme)));
}

/** Ranger un entraîneur dans une catégorie, ou l'en sortir. */
export function rangerEntraineur(club: Club, moi: Moi, staff: string, categorie: string, dedans: boolean): Resultat {
  if (!droits(club, moi).administre) return refus(ADMIN_SEUL);
  if (!club.staff.some((s) => s.id === staff && s.role === "entraineur")) return refus("Entraîneur introuvable.");
  if (!categorieDe(club, categorie)) return refus("Catégorie introuvable.");
  return ok({
    ...club,
    categories: club.categories.map((c) =>
      c.id !== categorie ? c : { ...c, entraineurs: dedans ? [...new Set([...c.entraineurs, staff])] : c.entraineurs.filter((s) => s !== staff) },
    ),
  });
}

export function deplacerJoueur(club: Club, moi: Moi, id: string, vers: string): Resultat {
  const d = droits(club, moi);
  const m = membreDe(club, id);
  if (!m || !categorieDe(club, vers)) return refus("Introuvable.");
  if (!d.gere(m.categorie) || !d.gere(vers)) return refus(PAS_LE_DROIT);
  if (m.categorie === vers) return ok(club);
  const cible = categorieDe(club, vers)!;
  if (!aLAgeDe(m, cible, club.jour)) return refus(`${m.prenom} a passé l'âge des ${cible.nom}.`);
  const deplace = { ...m, categorie: vers };
  // Son surclassement ne tient que s'il va encore vers la catégorie juste au-dessus.
  const encore = deplace.surclasseEn !== null && surclassementsPossibles(deplace, club.categories).some((c) => c.id === deplace.surclasseEn);
  // Il quitte les convocations à venir de son ancienne catégorie ; son nouvel entraîneur le convoque.
  return ok(convocationsTenues({ ...club, membres: club.membres.map((x) => (x.id === id ? { ...deplace, surclasseEn: encore ? deplace.surclasseEn : null } : x)) }));
}

export function changerPoste(club: Club, moi: Moi, id: string, poste: Poste): Resultat {
  const m = membreDe(club, id);
  if (!m) return refus("Joueur introuvable.");
  if (!droits(club, moi).gereJoueur(m)) return refus(PAS_LE_DROIT);
  if (!POSTES.some((p) => p.id === poste)) return refus("Poste inconnu.");
  return ok({ ...club, membres: club.membres.map((x) => (x.id === id ? { ...x, poste } : x)) });
}

/** Surclasser un joueur (`vers` null : plus de surclassement) : seulement vers une catégorie plus âgée. */
export function surclasser(club: Club, moi: Moi, id: string, vers: string | null): Resultat {
  const m = membreDe(club, id);
  if (!m) return refus("Joueur introuvable.");
  if (!droits(club, moi).gere(m.categorie)) return refus(PAS_LE_DROIT);
  if (vers !== null && !surclassementsPossibles(m, club.categories).some((c) => c.id === vers)) return refus("Le surclassement va vers la catégorie juste au-dessus.");
  return ok(convocationsTenues({ ...club, membres: club.membres.map((x) => (x.id === id ? { ...x, surclasseEn: vers } : x)) }));
}

export function ajouterNote(club: Club, moi: Moi, id: string, texte: string): Resultat {
  const m = membreDe(club, id);
  if (!m) return refus("Joueur introuvable.");
  if (!droits(club, moi).litNotes(m)) return refus(PAS_LE_DROIT);
  const t = texte.trim();
  if (!t) return refus("Une note vide ne s'ajoute pas.");
  if (t.length > 500) return refus("500 caractères au plus.");
  const n = club.notes.length + 1;
  return ok({ ...club, notes: [...club.notes, { id: `n-${n}-${club.jour}`, membre: id, auteur: moi.id, jour: club.jour, texte: t }] });
}

const seanceDe = (club: Club, id: string) => club.seances.find((s) => s.id === id) ?? null;
const avecSeance = (club: Club, s: Seance): Club => ({ ...club, seances: club.seances.map((x) => (x.id === s.id ? s : x)) });

/** Répondre à une convocation : le joueur lui-même, ou son parent. */
export function repondreConvocation(club: Club, moi: Moi, seance: string, reponse: Reponse): Resultat {
  const s = seanceDe(club, seance);
  const d = droits(club, moi);
  if (!s) return refus("Séance introuvable.");
  if (!d.joueur || !d.repond(d.joueur)) return refus("Seul le joueur, ou son parent, répond à sa convocation.");
  if (!s.convoques.includes(d.joueur.id)) return refus("Tu n'es pas convoqué.");
  if (s.genre === "match" && s.score !== null) return refus("Le match est joué.");
  if (s.jour < club.jour) return refus("La séance est passée.");
  return ok(avecSeance(club, { ...s, reponses: { ...s.reponses, [d.joueur.id]: reponse } }));
}

export interface NouvelleSeance {
  genre: Seance["genre"];
  categorie: string;
  /** « 2026-11-21 ». */
  jour: string;
  /** « 14h00 ». */
  heure: string;
  lieu: string;
  /** Un match : l'adversaire. */
  adversaire?: string;
}

/** Créer un match ou un entraînement : tous les licenciés actifs de la catégorie y sont convoqués, l'entraîneur retire qui il veut. */
export function creerSeance(club: Club, moi: Moi, n: NouvelleSeance): Resultat {
  if (!categorieDe(club, n.categorie)) return refus("Catégorie introuvable.");
  if (!droits(club, moi).gere(n.categorie)) return refus(PAS_LE_DROIT);
  if (n.genre !== "match" && n.genre !== "entrainement") return refus("Un match, ou un entraînement.");
  if (!dateVraie(n.jour)) return refus("Une date.");
  if (n.jour < club.jour) return refus("Une date à venir.");
  if (!/^([01]\d|2[0-3])h[0-5]\d$/.test(n.heure)) return refus("Une heure.");
  const lieu = nomPropre(n.lieu);
  if (lieu.length < 1 || lieu.length > 60) return refus("Un lieu de 1 à 60 caractères.");
  const adversaire = nomPropre(n.adversaire ?? "");
  if (n.genre === "match" && (adversaire.length < 1 || adversaire.length > 40)) return refus("Un adversaire de 1 à 40 caractères.");
  let k = 1;
  while (club.seances.some((s) => s.id === `${n.categorie}-n${k}`)) k++;
  const convoques = club.membres.filter((m) => estDeLaCategorie(m, n.categorie) && licenceActive(club, m.id)).map((m) => m.id);
  const seance: Seance = {
    id: `${n.categorie}-n${k}`,
    genre: n.genre,
    categorie: n.categorie,
    jour: n.jour,
    heure: n.heure,
    lieu,
    ...(n.genre === "match" ? { adversaire } : {}),
    score: null,
    convoques,
    reponses: {},
    appel: {},
    stats: {},
  };
  return ok({ ...club, seances: [...club.seances, seance] });
}

/** Convoquer un joueur à une séance à venir, ou l'en retirer : un licencié actif de la catégorie (ou surclassé chez elle). */
export function convoquer(club: Club, moi: Moi, seance: string, joueur: string, dedans: boolean): Resultat {
  const s = seanceDe(club, seance);
  if (!s) return refus("Séance introuvable.");
  if (!droits(club, moi).gere(s.categorie)) return refus(PAS_LE_DROIT);
  if (!seanceAVenir(s, club.jour)) return refus("La séance est passée.");
  const m = membreDe(club, joueur);
  if (!m || !estDeLaCategorie(m, s.categorie)) return refus("Ce joueur n'est pas de la catégorie.");
  if (dedans === s.convoques.includes(joueur)) return ok(club);
  if (!dedans) {
    const sans = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([id]) => id !== joueur));
    return ok(avecSeance(club, { ...s, convoques: s.convoques.filter((id) => id !== joueur), reponses: sans(s.reponses), appel: sans(s.appel), stats: sans(s.stats) }));
  }
  if (!licenceActive(club, joueur)) return refus("Sa licence n'est pas active.");
  return ok(avecSeance(club, { ...s, convoques: [...s.convoques, joueur] }));
}

export function faireAppel(club: Club, moi: Moi, seance: string, joueur: string, etat: EtatAppel): Resultat {
  const s = seanceDe(club, seance);
  if (!s) return refus("Séance introuvable.");
  if (!droits(club, moi).gere(s.categorie)) return refus(PAS_LE_DROIT);
  if (!seanceOuverte(s, club.jour)) return refus("L'appel se fait le jour de la séance.");
  if (!s.convoques.includes(joueur)) return refus("Ce joueur n'est pas convoqué.");
  // Un absent n'a ni but ni passe.
  const stats = { ...s.stats };
  if (etat === "absent") delete stats[joueur];
  return ok(avecSeance(club, { ...s, appel: { ...s.appel, [joueur]: etat }, stats }));
}

const borne = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(Number.isFinite(n) ? n : 0)));

/**
 * La saisie rapide d'un match : le score et, pour chaque présent, ses buts et
 * ses passes. Les convoqués sans appel sont comptés présents. Les buts des
 * joueurs ne dépassent pas ceux de l'équipe, ni les passes les buts.
 */
export function saisirStats(club: Club, moi: Moi, seance: string, score: { nous: number; eux: number }, stats: Record<string, LigneStats>): Resultat {
  const s = seanceDe(club, seance);
  if (!s) return refus("Séance introuvable.");
  if (s.genre !== "match") return refus("Les stats se saisissent sur un match.");
  if (!droits(club, moi).gere(s.categorie)) return refus(PAS_LE_DROIT);
  if (!seanceOuverte(s, club.jour)) return refus("Le match n'est pas encore joué.");
  const appel = { ...s.appel };
  for (const id of s.convoques) appel[id] ??= "present";
  const propres: Record<string, LigneStats> = {};
  for (const id of s.convoques) {
    const l = stats[id];
    if (!l || appel[id] === "absent") continue;
    const ligne = { buts: borne(l.buts, 20), passes: borne(l.passes, 20) };
    if (ligne.buts || ligne.passes) propres[id] = ligne;
  }
  const final = { nous: borne(score.nous, 40), eux: borne(score.eux, 40) };
  const buts = Object.values(propres).reduce((n, l) => n + l.buts, 0);
  const passes = Object.values(propres).reduce((n, l) => n + l.passes, 0);
  if (buts > final.nous) return refus(`${buts} buts saisis pour ${final.nous} au score.`);
  if (passes > final.nous) return refus("Plus de passes décisives que de buts.");
  return ok(avecSeance(club, { ...s, score: final, appel, stats: propres }));
}

export function publierAnnonce(club: Club, moi: Moi, categorie: string | null, texte: string): Resultat {
  const d = droits(club, moi);
  if (categorie === null ? !d.administre : !d.gere(categorie)) return refus(categorie === null ? ADMIN_SEUL : PAS_LE_DROIT);
  if (categorie !== null && !categorieDe(club, categorie)) return refus("Catégorie introuvable.");
  const t = texte.trim();
  if (!t) return refus("Une annonce vide ne se publie pas.");
  if (t.length > 400) return refus("400 caractères au plus.");
  return ok({ ...club, annonces: [...club.annonces, { id: `a-${club.annonces.length + 1}-${club.jour}`, categorie, auteur: moi.id, jour: club.jour, texte: t }] });
}

export interface LigneImportee {
  nom: string;
  /** null : pas de date sur la ligne, ou une date qui n'existe pas (dateIllisible la garde telle qu'écrite). */
  naissance: string | null;
  categorie: string | null;
  dateIllisible?: string;
}

/** Lit une liste collée, une ligne par licencié : « Prénom Nom, 12/03/2014, U13 » (la date et la catégorie sont facultatives). */
export function lireListe(club: Pick<Club, "categories">, texte: string): LigneImportee[] {
  return texte
    .split(/\r?\n/)
    .map((l) => l.split(/[,;\t]/).map((x) => x.trim()))
    .filter((c) => c[0])
    .map((c) => {
      const date = c.slice(1).find((x) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(x));
      const cat = c.slice(1).find((x) => club.categories.some((k) => cle(k.nom) === cle(x)));
      const [d, m, a] = (date ?? "").split("/");
      const iso = date ? `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : null;
      const vraie = iso !== null && dateVraie(iso);
      return {
        nom: nomPropre(c[0]).slice(0, 60),
        naissance: vraie ? iso : null,
        categorie: cat ? club.categories.find((k) => cle(k.nom) === cle(cat))!.id : null,
        ...(date && !vraie ? { dateIllisible: date } : {}),
      };
    });
}

/** Importer une liste : une invitation par ligne, tant qu'il reste des licences libres. */
export function importerListe(club: Club, moi: Moi, texte: string): Resultat {
  if (!droits(club, moi).administre) return refus(ADMIN_SEUL);
  const lignes = lireListe(club, texte);
  if (!lignes.length) return refus("Aucun nom dans la liste.");
  const libres = compteLicences(club).libres;
  if (lignes.length > libres) return refus(`${lignes.length} noms pour ${libres} ${libres > 1 ? "licences libres" : "licence libre"}.`);
  // Une date de naissance qui n'existe pas, ou pas encore : la liste est à corriger, rien n'est importé.
  const fausse = lignes.find((l) => l.dateIllisible || (l.naissance !== null && (l.naissance > club.jour || l.naissance < "1900-01-01")));
  if (fausse) return refus(`Date de naissance à corriger : ${fausse.nom}.`);
  const pris = new Set(club.licences.map((l) => l.id));
  let k = club.licences.length;
  const invitations = lignes.map((l): Licence => {
    do k++;
    while (pris.has(`l-imp-${k}`));
    pris.add(`l-imp-${k}`);
    return { id: `l-imp-${k}`, statut: "invitee", compte: null, invite: { nom: l.nom, categorie: l.categorie } };
  });
  return ok({ ...club, licences: [...club.licences, ...invitations] });
}

export function changerBlason(club: Club, moi: Moi, blason: Blason): Resultat {
  if (!droits(club, moi).administre) return refus(ADMIN_SEUL);
  const b = lireBlason(blason);
  if (!b) return refus("Écusson illisible.");
  return ok({ ...club, blason: b });
}

/**
 * Libérer la licence d'un compte : elle redevient libre. Le joueur garde son
 * compte, sa carte et son historique (« Bola gratuit ») : sa ligne reste
 * dans le club de démonstration, sans licence, hors de l'effectif, des
 * classements et des convocations à venir.
 */
export function libererLicence(club: Club, moi: Moi, compte: string): Resultat {
  if (!droits(club, moi).administre) return refus(ADMIN_SEUL);
  if (compte === moi.id) return refus("Tu ne libères pas ta propre licence.");
  if (!club.licences.some((l) => l.compte === compte)) return refus("Ce compte n'a pas de licence.");
  // Il sort du club : plus de convocation à venir pour lui (regles.ts : sans licence active, il ne lit ni ne gère plus rien).
  return ok(convocationsTenues({ ...club, licences: club.licences.filter((l) => l.compte !== compte) }));
}
