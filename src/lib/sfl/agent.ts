// Bola Agent — le coach personnel du joueur, à côté du Vestiaire (/agent).
//
// Demande de Sabri (19/10/2026) : un agent branché à un modèle de langage qui
// part des stats du joueur, de la meilleure à la pire, pour travailler ses
// points faibles (exercices, programme près de chez lui), fait le débrief
// après le match (« alors, c'était comment ? »), conseille sur la nutrition
// (le panier de courses, ce que ça coûte) et suit la santé et les blessures
// (rééducation, bilan). La montre (Apple Watch, « Bola Watch ») viendra plus
// tard.
//
// Ce module est partagé entre l'écran (components/sfl/agent.tsx) et la route
// serveur (/api/agent, qui parle à Claude) : le dossier du joueur que l'écran
// calcule sur la saison et envoie avec chaque question, la forme des réponses
// (un texte court et des cartes que l'app dessine elle-même) et les limites.
//
// Un accompagnateur avant tout (Sabri, 19/10 au soir) : il discute avec le
// joueur, pose des questions, se souvient. Parfois il pose une carte, que
// l'app met en page elle-même dans sa charte (un programme, un panier, un
// débrief : des listes et des chiffres qu'aucune image n'écrit juste), et
// parfois il fait faire une image pour montrer une zone : du corps (la
// cheville, le muscle à étirer), du terrain (où couvrir), une posture.
//
// Jamais un juge (Sabri, 19/10) : il encourage, tire le joueur vers son
// dépassement et lui propose des options. Ses stats les plus basses sont sa
// marge de progression, pas « sa pire stat » : l'écran le dit ainsi aussi.

import { STAT_KEYS, ovr, type Player, type StatKey } from "./engine";
import { jourMoisDuLibelle } from "./convocation-temps";
import { ficheJoueur } from "./fiche-joueur";
import { RANKINGS } from "./rankings";
import { quantite, vitrine } from "./trophees";
import { journeeJouee } from "./saisie/mutations";
import type { Saison } from "./saisie/types";

/** Questions au coach par joueur sur 24 h glissantes (le crédit est celui de Sabri). */
export const LIMITE_AGENT_JOUR = 30;
/** Images que le coach fait faire par joueur sur 24 h glissantes. */
export const LIMITE_IMAGES_JOUR = 8;
export const BUCKET_AGENT = "agent";
/** Messages de la conversation renvoyés au modèle à chaque question. */
export const HISTORIQUE_MAX = 16;
/** Longueur d'une question. */
export const QUESTION_MAX = 1500;

export const NOMS_STATS: Record<StatKey, string> = {
  VIT: "Vitesse",
  TIR: "Tir",
  PAS: "Passe",
  DRI: "Dribble",
  DEF: "Défense",
  PHY: "Physique",
};

/* ------------------------------- Le dossier ------------------------------ */

export interface DernierMatch {
  j: number;
  date: string;
  resultat: string | null;
  buts: number;
  passes: number;
  mvp: boolean;
  /** Jours écoulés depuis le match (0 = aujourd'hui). */
  ilYa: number;
}

/** Ce que le coach sait du joueur, recalculé sur la saison à chaque question. */
export interface DossierJoueur {
  nom: string;
  poste: string;
  note: number;
  statut: string;
  /** Les six stats de la carte, de la meilleure à la pire. */
  stats: { id: StatKey; nom: string; valeur: number }[];
  saison: { matchs: number; buts: number; passes: number; mvp: number; mur: number; pepite: number };
  synthese: string;
  pointsForts: string[];
  dernierMatch: DernierMatch | null;
  /** Ses derniers dimanches, du plus récent au plus ancien : avec qui, contre qui. */
  matchs: MatchDossier[];
  /** Où il en est face aux autres, classement par classement. */
  classements: PlaceClassement[];
  /** Les badges de palier pas encore atteints, du plus proche au plus loin. */
  objectifs: ObjectifDossier[];
}

export interface MatchDossier {
  j: number;
  date: string;
  equipe: string | null;
  resultats: string[];
  buts: number;
  passes: number;
  mvp: boolean;
  coequipiers: string[];
  adversaires: string[];
}

export interface PlaceClassement {
  classement: string;
  valeur: number;
  rang: number;
  sur: number;
  /** Le joueur juste devant lui (personne s'il est premier) et l'écart. */
  devant: { nom: string; valeur: number } | null;
}

export interface ObjectifDossier {
  badge: string;
  actuel: string;
  prochainPalier: string;
  manque: number;
}

/** Dimanches gardés dans le dossier, et joueurs cités par équipe. */
const MATCHS_DOSSIER = 5;
const NOMS_PAR_EQUIPE = 7;
const CLASSEMENTS_DOSSIER = ["pp", "ovr", "buts", "passes", "mvp", "def", "presences"];

function sesMatchs(saison: Saison, nom: string, js: number[]): MatchDossier[] {
  return js.slice(0, MATCHS_DOSSIER).map((j) => {
    const du = saison.entries.filter((e) => e.j === j && !e.extraTime && e.statut === "Présent");
    const lui = du.filter((e) => e.player === nom);
    const equipe = lui.find((e) => e.team)?.team ?? null;
    const noms = (f: (team: string | null) => boolean) =>
      [...new Set(du.filter((e) => e.player !== nom && f(e.team)).map((e) => e.player))].slice(0, NOMS_PAR_EQUIPE * 2);
    return {
      j,
      date: saison.journees.find((x) => x.j === j)?.date ?? "",
      equipe,
      resultats: lui.map((e) => e.result).filter((r): r is NonNullable<typeof r> => !!r),
      buts: lui.reduce((a, e) => a + e.buts, 0),
      passes: lui.reduce((a, e) => a + e.passes, 0),
      mvp: lui.some((e) => e.mvp),
      coequipiers: equipe ? noms((t) => t === equipe).slice(0, NOMS_PAR_EQUIPE) : [],
      adversaires: equipe ? noms((t) => !!t && t !== equipe) : [],
    };
  });
}

function sesPlaces(moi: Player, players: Player[]): PlaceClassement[] {
  return RANKINGS.filter((r) => CLASSEMENTS_DOSSIER.includes(r.id)).flatMap((r) => {
    const tries = players.filter((p) => p.matchs > 0 || p.name === moi.name).sort((a, b) => r.value(b) - r.value(a));
    const valeur = r.value(moi);
    if (!tries.length) return [];
    const rang = tries.filter((p) => r.value(p) > valeur).length + 1;
    const devantLui = tries.filter((p) => r.value(p) > valeur).at(-1);
    return [{ classement: r.label, valeur, rang, sur: tries.length, devant: devantLui ? { nom: devantLui.name, valeur: r.value(devantLui) } : null }];
  });
}

function sesObjectifs(saison: Saison, nom: string, maintenant: Date): ObjectifDossier[] {
  return vitrine(saison, nom, maintenant)
    .filter((e) => e.cible != null)
    .sort((a, b) => b.progression - a.progression)
    .slice(0, 5)
    .map((e) => ({
      badge: e.def.nom,
      actuel: quantite(e.def, e.valeur),
      prochainPalier: quantite(e.def, e.cible!),
      manque: e.cible! - e.valeur,
    }));
}

/** Les stats d'une carte, de la meilleure à la pire (à égalité, l'ordre de la carte). */
export function statsTriees(p: Player): DossierJoueur["stats"] {
  return STAT_KEYS.map((id) => ({ id, nom: NOMS_STATS[id], valeur: p.stats[id] })).sort(
    (a, b) => b.valeur - a.valeur || STAT_KEYS.indexOf(a.id) - STAT_KEYS.indexOf(b.id)
  );
}

/** « 12 oct. » → la date la plus proche dans le passé ; null si illisible. */
function lireDate(libelle: string, maintenant: Date): Date | null {
  const jm = jourMoisDuLibelle(libelle);
  if (!jm) return null;
  const d = new Date(maintenant.getFullYear(), jm.mois - 1, jm.jour);
  if (d.getTime() > maintenant.getTime() + 86400_000) d.setFullYear(d.getFullYear() - 1);
  return d;
}

export function dossierJoueur(saison: Saison, moi: Player, players: Player[], maintenant = new Date()): DossierJoueur {
  const fiche = ficheJoueur(saison, moi, players);
  const lignes = saison.entries.filter(
    (e) => e.player === moi.name && !e.extraTime && e.statut === "Présent" && journeeJouee(saison, e.j)
  );
  const jouees = [...new Set(lignes.map((e) => e.j))].sort((a, b) => b - a);
  const dernierJ = jouees[0] ?? 0;
  let dernierMatch: DernierMatch | null = null;
  if (dernierJ) {
    const ce = lignes.filter((e) => e.j === dernierJ);
    const meta = saison.journees.find((x) => x.j === dernierJ);
    const quand = meta ? lireDate(meta.date, maintenant) : null;
    dernierMatch = {
      j: dernierJ,
      date: meta?.date ?? "",
      resultat: ce.map((e) => e.result).filter(Boolean).join(", ") || null,
      buts: ce.reduce((a, e) => a + e.buts, 0),
      passes: ce.reduce((a, e) => a + e.passes, 0),
      mvp: ce.some((e) => e.mvp),
      ilYa: quand ? Math.max(0, Math.floor((maintenant.getTime() - quand.getTime()) / 86400_000)) : 99,
    };
  }
  return {
    nom: moi.name,
    poste: moi.poste,
    note: ovr(moi.stats),
    statut: moi.statut,
    stats: statsTriees(moi),
    saison: { matchs: moi.matchs, buts: moi.buts, passes: moi.passes, mvp: moi.mvp, mur: moi.def, pepite: moi.pp },
    synthese: fiche.synthese,
    pointsForts: fiche.forts.map((f) => `${f.chiffre} ${f.quoi} (${f.rang})`),
    dernierMatch,
    matchs: sesMatchs(saison, moi.name, jouees),
    classements: sesPlaces(moi, players),
    objectifs: sesObjectifs(saison, moi.name, maintenant),
  };
}

/** Le dernier match est-il assez frais pour que le coach demande comment ça s'est passé ? */
export const debriefFrais = (d: DossierJoueur) => !!d.dernierMatch && d.dernierMatch.ilYa <= 3;

/** La question d'ouverture du coach, après un match. */
export function questionDebrief(m: DernierMatch): string {
  const res = m.resultat ? m.resultat.toLowerCase() : null;
  const faits = [
    res,
    m.buts ? `${m.buts} but${m.buts > 1 ? "s" : ""}` : null,
    m.passes ? `${m.passes} passe${m.passes > 1 ? "s" : ""}` : null,
    m.mvp ? "MVP" : null,
  ].filter(Boolean);
  return `J${m.j}${faits.length ? ` : ${faits.join(", ")}` : ""}. Alors, c'était comment ?`;
}

/* ------------------------------ Les réponses ----------------------------- */

/**
 * De quoi parle un échange, d'après le coach lui-même. Seul ce mot est gardé
 * pour les stats de l'admin (agent_sujets), jamais ce qui s'est dit.
 */
export const SUJETS = ["debrief", "progression", "tactique", "physique", "nutrition", "sante", "recuperation", "mental", "ligue", "autre"] as const;
export type Sujet = (typeof SUJETS)[number];

export const LIBELLE_SUJET: Record<Sujet, string> = {
  debrief: "Débrief de match",
  progression: "Progression, exercices",
  tactique: "Tactique, placement",
  physique: "Forme physique",
  nutrition: "Nutrition, courses",
  sante: "Douleurs, blessures",
  recuperation: "Récupération",
  mental: "Mental, confiance",
  ligue: "Classements, objectifs",
  autre: "Autre",
};

/** Les raccourcis sous la fiche (et la question d'ouverture après un match). */
export const RACCOURCIS = ["progression", "debrief", "courses", "douleur"] as const;
export type Raccourci = (typeof RACCOURCIS)[number];

export const LIBELLE_RACCOURCI: Record<Raccourci | "debrief-auto", string> = {
  progression: "Faire monter une stat",
  debrief: "Débrief",
  courses: "Mes courses",
  douleur: "J'ai mal",
  "debrief-auto": "Question d'après-match",
};


export const TYPES_CARTE = ["programme", "exercice", "debrief", "panier", "sante", "bilan"] as const;
export type TypeCarte = (typeof TYPES_CARTE)[number];

export const LIBELLE_CARTE: Record<TypeCarte, string> = {
  programme: "Programme",
  exercice: "Exercice",
  debrief: "Débrief",
  panier: "Panier",
  sante: "Santé",
  bilan: "Bilan",
};

export interface LigneCarte {
  /** « Fentes sautées », « Ce qui a marché », « Riz complet 1 kg ». */
  label: string;
  /** La consigne ou la précision, une phrase au plus ; « » si rien. */
  detail: string;
  /** « 3 × 12 », « 2,40 € », « 2×/jour » ; « » si rien. */
  valeur: string;
}

export interface CarteCoach {
  type: TypeCarte;
  titre: string;
  /** « 3 séances · 45 min », « Total ≈ 38 € » ; « » si rien. */
  sousTitre: string;
  /** La stat travaillée, si la carte en vise une ; « » sinon. */
  cible: StatKey | "";
  lignes: LigneCarte[];
}

/** Une image que le coach fait faire pour montrer une zone (le corps, le terrain, une posture). */
export interface ImageCoach {
  /** Le fichier dans le bucket privé « agent » (conversation gardée). */
  chemin?: string;
  /** Ou l'image elle-même, en data URL (aperçus, sans stockage). */
  url?: string;
  legende: string;
}

export interface ReponseCoach {
  texte: string;
  cartes: CarteCoach[];
  image: ImageCoach | null;
}

/** Un message de la conversation, tel que l'écran l'affiche et le garde. */
export interface MessageAgent {
  id: string;
  role: "joueur" | "coach";
  texte: string;
  cartes: CarteCoach[];
  image?: ImageCoach | null;
  at: number;
}

const estTexte = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;

/** Une carte reçue (du modèle, ou relue en base), vérifiée champ par champ. */
export function lireCarte(v: unknown): CarteCoach | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  if (!TYPES_CARTE.includes(c.type as TypeCarte) || !estTexte(c.titre, 200)) return null;
  const cible = (STAT_KEYS as readonly string[]).includes(c.cible as string) ? (c.cible as StatKey) : "";
  const lignes = Array.isArray(c.lignes)
    ? c.lignes
        .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
        .map((l) => ({
          label: String(l.label ?? "").slice(0, 200),
          detail: String(l.detail ?? "").slice(0, 600),
          valeur: String(l.valeur ?? "").slice(0, 60),
        }))
        .filter((l) => l.label)
        .slice(0, 20)
    : [];
  return { type: c.type as TypeCarte, titre: c.titre, sousTitre: estTexte(c.sousTitre, 200) ? c.sousTitre : "", cible, lignes };
}

export function lireCartes(v: unknown): CarteCoach[] {
  return Array.isArray(v) ? v.map(lireCarte).filter((c): c is CarteCoach => !!c).slice(0, 4) : [];
}

/** Une image relue (réponse de la route ou ligne en base), vérifiée. */
export function lireImage(v: unknown): ImageCoach | null {
  if (!v || typeof v !== "object") return null;
  const i = v as Record<string, unknown>;
  const chemin = typeof i.chemin === "string" && /^[0-9a-f-]{36}\/[\w.-]+$/.test(i.chemin) ? i.chemin : undefined;
  const url = typeof i.url === "string" && i.url.startsWith("data:image/") ? i.url : undefined;
  if (!chemin && !url) return null;
  return { chemin, url, legende: typeof i.legende === "string" ? i.legende.slice(0, 200) : "" };
}
