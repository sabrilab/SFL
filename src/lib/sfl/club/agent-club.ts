// Bola Club : l'agent de l'entraîneur. Ce que l'app sait d'une catégorie et
// le dit au modèle (le dossier de l'équipe), et ce qu'elle dit d'elle-même à
// l'entraîneur avant toute question (sa semaine). Pur, sans réseau : la route
// /club/api/agent borne le dossier et pose la question, l'écran
// (components/sfl/club/agent-club.tsx) garde la conversation.
//
// Le dossier (DossierEquipe) : la catégorie et son âge type, ses joueurs
// par leur prénom et l'initiale de leur nom (jamais le nom entier ni la date
// de naissance : l'âge suffit), leurs présences, la croissance et la VMA, la
// blessure en cours et son étape de reprise ; les dernières séances (le
// programme, le ressenti, la remarque de l'entraîneur), les derniers matchs,
// les prochaines séances. Jamais le poids ni l'IMC d'un mineur (décision de
// Bola, 27/11/2026), ni les notes privées, ni rien d'une autre catégorie.
//
// Sa semaine (semaineDe) : des raisons de revenir, toutes vraies et toutes
// positives (demande de Bola, 27/11/2026 : « que l'entraîneur se sente bien
// aidé » et qu'on l'active par tous les leviers, « mais le bien ») : les
// séances tenues, un joueur qui revient de blessure, une victoire, le ressenti
// qui redescend, les réponses des joueurs, les minutes préparées. Jamais un
// reproche ni une comparaison avec un autre entraîneur.

import { exerciceDe } from "./exercices";
import { ageType } from "./proposition";
import { ageLe, categorieDe, estDeLaCategorie, licenceActive, seancePassee } from "./regles";
import { blessureEnCours, croissance, derniereVma, enPoussee, ETAPES_REPRISE, GRAVITES, joursDepuis } from "./suivi";
import type { Club, Membre, Seance } from "./types";

export const SUJETS_CLUB = ["seance", "blessure", "reprise", "physique", "tactique", "groupe", "match", "moral", "autre"] as const;
export type SujetClub = (typeof SUJETS_CLUB)[number];

/** Les cartes de l'agent de l'entraîneur (celles de Bola Agent, sans le panier de courses). */
export const TYPES_CARTE_CLUB = ["programme", "exercice", "debrief", "sante", "bilan"] as const;

export interface JoueurDossier {
  nom: string;
  age: number;
  poste: string;
  /** « 9/11 » : présent ou en retard, sur les entraînements passés où il était convoqué. */
  presences: string;
  croissance?: string;
  vma?: number;
  blessure?: { zone: string; cote: string; gravite: string; depuisJours: number; etape: string; etapeNumero: number; feuVertMedecin: boolean; note: string };
}

export interface SeanceDossier {
  jour: string;
  genre: "match" | "entrainement";
  adversaire?: string;
  score?: string;
  programme?: string[];
  ressenti?: number;
  remarque?: string;
  presents?: number;
}

export interface DossierEquipe {
  entraineur: string;
  club: string;
  categorie: string;
  ageType: number;
  joueurs: JoueurDossier[];
  dernieres: SeanceDossier[];
  prochaines: SeanceDossier[];
  /** Le joueur dont l'entraîneur vient parler (depuis sa fiche), s'il y en a un. */
  focus?: string;
}

/** Les seuls champs que la route garde du dossier envoyé. */
export const CHAMPS_DOSSIER_EQUIPE = ["entraineur", "club", "categorie", "ageType", "joueurs", "dernieres", "prochaines", "focus"] as const satisfies readonly (keyof DossierEquipe)[];

export const nomCourt = (m: Pick<Membre, "prenom" | "nom">) => `${m.prenom} ${m.nom.charAt(0)}.`;

const COTE: Record<string, string> = { droit: "droit", gauche: "gauche", "les deux": "les deux côtés" };

/** Les joueurs de la catégorie, licenciés, dans l'ordre de l'effectif. */
export function joueursDe(club: Club, categorie: string): Membre[] {
  return club.membres.filter((m) => estDeLaCategorie(m, categorie) && licenceActive(club, m.id));
}

function presences(club: Club, m: Membre, categorie: string): string {
  const passes = club.seances.filter((s) => s.categorie === categorie && s.genre === "entrainement" && seancePassee(s, club.jour) && s.convoques.includes(m.id));
  const la = passes.filter((s) => s.appel[m.id] === "present" || s.appel[m.id] === "retard").length;
  return `${la}/${passes.length}`;
}

function seanceDite(club: Club, s: Seance): SeanceDossier {
  const presents = Object.values(s.appel).filter((e) => e === "present" || e === "retard").length;
  return {
    jour: s.jour,
    genre: s.genre,
    ...(s.genre === "match" ? { adversaire: s.adversaire ?? "", ...(s.score ? { score: `${s.score.nous}-${s.score.eux}` } : {}) } : {}),
    ...(s.programme?.length ? { programme: s.programme.map((l) => `${exerciceDe(club, l.exercice)?.nom ?? l.exercice} (${l.minutes} min)`) } : {}),
    ...(s.bilan ? { ressenti: s.bilan.ressenti, remarque: s.bilan.remarque } : {}),
    ...(presents ? { presents } : {}),
  };
}

export function dossierEquipe(club: Club, staff: string, categorie: string, focus?: string | null): DossierEquipe {
  const cat = categorieDe(club, categorie);
  const age = ageType(cat);
  const joueurs = joueursDe(club, categorie).map((m): JoueurDossier => {
    const b = blessureEnCours(club, m.id);
    const c = croissance(club, m.id);
    const v = derniereVma(club, m.id);
    const a = ageLe(m.naissance, club.jour);
    return {
      nom: nomCourt(m),
      age: a,
      poste: m.poste,
      presences: presences(club, m, categorie),
      ...(c && a < 18 ? { croissance: `${c.cmParMois >= 0 ? "+" : ""}${c.cmParMois} cm/mois${enPoussee(club, m.id) ? " (poussée de croissance)" : ""}` } : {}),
      ...(v?.vma ? { vma: v.vma } : {}),
      ...(b
        ? {
            blessure: {
              zone: b.zone,
              cote: COTE[b.cote],
              gravite: GRAVITES.find((g) => g.id === b.gravite)?.label ?? b.gravite,
              depuisJours: joursDepuis(b.jour, club.jour),
              etape: ETAPES_REPRISE[b.etape]?.nom ?? "",
              etapeNumero: b.etape + 1,
              feuVertMedecin: b.feuVert,
              note: b.note.slice(0, 200),
            },
          }
        : {}),
    };
  });
  const siennes = club.seances.filter((s) => s.categorie === categorie);
  const dernieres = siennes
    .filter((s) => seancePassee(s, club.jour))
    .sort((a, b) => b.jour.localeCompare(a.jour))
    .slice(0, 5)
    .map((s) => seanceDite(club, s));
  const prochaines = siennes
    .filter((s) => !seancePassee(s, club.jour) && s.jour >= club.jour)
    .sort((a, b) => a.jour.localeCompare(b.jour))
    .slice(0, 3)
    .map((s) => seanceDite(club, s));
  const coach = club.staff.find((s) => s.id === staff);
  const f = focus ? club.membres.find((m) => m.id === focus && estDeLaCategorie(m, categorie)) : null;
  return {
    entraineur: coach?.prenom ?? "",
    club: club.nom,
    categorie: cat?.nom ?? categorie,
    ageType: age,
    joueurs,
    dernieres,
    prochaines,
    ...(f ? { focus: nomCourt(f) } : {}),
  };
}

/* --------------------------------- Sa semaine ------------------------------- */

export interface Moment {
  /** Ce qui s'affiche en gros : « 3 », « 4-2 », « +1 ». */
  chiffre: string;
  /** La phrase : « séances tenues cette semaine ». */
  dit: string;
}

const septJoursAvant = (jour: string) => new Date(Date.parse(jour) - 7 * 86_400_000).toISOString().slice(0, 10);

/**
 * Sa semaine, pour les catégories qu'il entraîne : quatre moments au plus,
 * tous vrais et tous bons à entendre. Rien de négatif : un moment qui ne
 * l'est pas (une défaite, un ressenti qui monte) n'est simplement pas dit.
 */
export function semaineDe(club: Club, staff: string): Moment[] {
  const cats = club.categories.filter((c) => c.entraineurs.includes(staff)).map((c) => c.id);
  const depuis = septJoursAvant(club.jour);
  const siennes = club.seances.filter((s) => cats.includes(s.categorie));
  const recentes = siennes.filter((s) => s.jour > depuis && s.jour <= club.jour && seancePassee(s, club.jour));
  const moments: Moment[] = [];
  const tenues = recentes.filter((s) => s.genre === "entrainement" && Object.keys(s.appel).length > 0);
  if (tenues.length) {
    const appels = tenues.flatMap((s) => Object.values(s.appel));
    const la = appels.filter((e) => e !== "absent").length;
    moments.push({ chiffre: `${Math.round((la / Math.max(1, appels.length)) * 100)} %`, dit: `de présence sur ${tenues.length === 1 ? "ta séance" : `tes ${tenues.length} séances`} de la semaine` });
  }
  const victoires = recentes.filter((s) => s.genre === "match" && s.score && s.score.nous > s.score.eux);
  for (const v of victoires.slice(0, 1))
    moments.push({ chiffre: `${v.score!.nous}-${v.score!.eux}`, dit: `${categorieDe(club, v.categorie)?.nom} contre ${v.adversaire ?? "l'adversaire"} : bravo` });
  const revenus = club.blessures.filter((b) => {
    const m = club.membres.find((x) => x.id === b.membre);
    return m && cats.some((c) => estDeLaCategorie(m, c)) && !b.retour && b.etape >= 4;
  });
  for (const b of revenus.slice(0, 1)) {
    const m = club.membres.find((x) => x.id === b.membre)!;
    moments.push({ chiffre: "✓", dit: `${m.prenom} a repris l'entraînement complet après sa blessure` });
  }
  // Le ressenti qui redescend : la dernière séance moins dure que celle d'avant, dans une catégorie.
  for (const c of cats) {
    const bilans = siennes
      .filter((s) => s.categorie === c && s.bilan)
      .sort((a, b) => b.jour.localeCompare(a.jour))
      .slice(0, 2);
    if (bilans.length === 2 && bilans[0].bilan!.ressenti < bilans[1].bilan!.ressenti) {
      moments.push({ chiffre: `${bilans[0].bilan!.ressenti}/10`, dit: `ressenti des ${categorieDe(club, c)?.nom}, moins dur que la fois d'avant` });
      break;
    }
  }
  const reponses = siennes.filter((s) => !seancePassee(s, club.jour) && s.jour >= club.jour).reduce((n, s) => n + Object.keys(s.reponses).length, 0);
  if (reponses) moments.push({ chiffre: String(reponses), dit: `réponse${reponses > 1 ? "s" : ""} de tes joueurs à tes convocations` });
  const minutes = siennes.reduce((n, s) => n + (s.programme ?? []).reduce((k, l) => k + l.minutes, 0), 0);
  if (minutes) moments.push({ chiffre: String(minutes), dit: "minutes de séances préparées cette saison" });
  return moments.slice(0, 4);
}

/** La première phrase de l'agent, avant toute question : un bonjour, sa semaine en une ligne, puis une question sur lui. */
export function ouvertureDe(club: Club, staff: string, focus?: string | null): string {
  const prenom = club.staff.find((s) => s.id === staff)?.prenom ?? "";
  const f = focus ? club.membres.find((m) => m.id === focus) : null;
  if (f) {
    const b = blessureEnCours(club, f.id);
    return b
      ? `On parle de ${f.prenom} ? Il en est à l'étape « ${ETAPES_REPRISE[b.etape].nom} ». Comment il se sent en ce moment ?`
      : `On parle de ${f.prenom} ? Dis-moi ce que tu as remarqué.`;
  }
  const n = semaineDe(club, staff).length;
  return `Salut ${prenom}. ${n ? "Belle semaine, tu as vu tes chiffres au-dessus." : "Content de te voir."} Et toi, comment tu te sens avant le week-end ?`;
}
