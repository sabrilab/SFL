// Les repères d'Admin → Activité : ce que l'app a fait, jour par jour, posé
// sous les courbes de croissance. Sabri, 24/10 : « quand on voit la
// croissance, voir rapidement les actions qui ont été faites à ce moment-là
// de la part de l'application, pour qu'on comprenne encore la relation entre
// les choses ».
//
// Trois familles, une ligne chacune sous la courbe :
//   · terrain : les journées de la ligue (toutes les saisons) et les matchs
//     ouverts par les joueurs, le jour où ils se jouent ;
//   · notif : chaque notification que l'app envoie d'elle-même ou que l'admin
//     envoie à toute la ligue (annonce, divisions, outsider, missions,
//     rappel de la veille), une par envoi ; et, jour par jour, le compte des
//     notifications entre joueurs (Vestiaire, matchs, équipes, suivis,
//     félicitations) ;
//   · appli : chaque mise en ligne (lib/sfl/mises-en-ligne.ts).
// Puis, pour le jour qu'on touche, l'écart à un jour ordinaire, et les pics
// de la période : les jours où la courbe a sauté, avec ce qui les entoure.
//
// Module pur : la page lit, ce module range.

import { defMotif } from "@/lib/sfl/motifs-notif";
import { jourMoisDuLibelle } from "@/lib/sfl/convocation-temps";
import { sujetEtDetail, type MiseEnLigne } from "@/lib/sfl/mises-en-ligne";
import { debutJour, type MetriqueId, type PointJour } from "@/lib/sfl/retention";
import { numeroSaison, type JourneeMeta, type MatchEntry, type Saison } from "@/lib/sfl/saisie/types";

export type FamilleRepere = "terrain" | "notif" | "appli";

export interface Repere {
  famille: FamilleRepere;
  /** Instant (ms) : le coup d'envoi d'un match, le premier envoi d'une notification, la publication. */
  at: number;
  titre: string;
  detail: string | null;
  /** Ce qui compte le plus : une journée de la ligue, une notification à toute la ligue. */
  fort: boolean;
  /** Une mise en ligne : sa PR. */
  pr?: number | null;
  /** Un compte pour toute la journée (les notifications entre joueurs) : pas d'heure. */
  parJour?: boolean;
}

/* ------------------------------ notifications ----------------------------- */

/** Une notification envoyée (push_envois), lue pour les repères. */
export interface EnvoiRepere {
  /** À qui. */
  a: string;
  motif: string;
  ref: string | null;
  envoyee: number;
  ouverte: number | null;
}

/**
 * Les notifications que l'app envoie d'elle-même, ou l'admin à toute la
 * ligue : un repère par envoi. Les autres partent du geste d'un joueur (il
 * écrit, suit, félicite, invite) : comptées par jour, et rendues à leur
 * auteur dans « Qui ramène du monde » (lib/sfl/rassembleurs.ts).
 */
const DE_L_APP = new Set(["annonce", "divisions", "outsider", "missions", "match-veille"]);
export const estDeLApp = (motif: string) => DE_L_APP.has(motif);

/** Un envoi de l'app : ses notifications parties en moins de LOT les unes des autres. */
const LOT = 30 * 60 * 1000;

/** Les notifications entre joueurs, par genre, dans l'ordre du détail. */
const GENRES: { label: string; test: (motif: string) => boolean }[] = [
  { label: "Vestiaire", test: (m) => m.startsWith("vestiaire-") },
  { label: "matchs", test: (m) => m.startsWith("match-") },
  { label: "Bola Team", test: (m) => m.startsWith("equipe-") },
  { label: "suivis", test: (m) => m === "suivi" || m === "suivi-retour" },
  { label: "félicitations", test: (m) => m === "felicitation" },
];

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/**
 * Les notifications, en repères. `garde` : le public regardé (les joueurs
 * prévenus qui comptent). Un envoi que seuls des admins ont reçu est un
 * essai (Admin → Notifications, « m'envoyer un essai ») : pas un repère.
 */
export function reperesNotifs(
  envois: EnvoiRepere[],
  garde: (nom: string) => boolean,
  admins: ReadonlySet<string>
): Repere[] {
  const out: Repere[] = [];
  const tries = [...envois].sort((x, y) => x.envoyee - y.envoyee);

  // 1. Les envois de l'app, lot par lot.
  const lots = new Map<string, EnvoiRepere[][]>();
  for (const e of tries) {
    if (!estDeLApp(e.motif)) continue;
    const cle = `${e.motif}|${e.ref ?? ""}`;
    const suite = lots.get(cle) ?? [];
    const dernier = suite.at(-1);
    if (dernier && e.envoyee - dernier.at(-1)!.envoyee <= LOT) dernier.push(e);
    else suite.push([e]);
    lots.set(cle, suite);
  }
  for (const suite of lots.values()) {
    for (const lot of suite) {
      if (lot.every((e) => admins.has(e.a))) continue;
      const vus = lot.filter((e) => garde(e.a));
      if (vus.length === 0) continue;
      const joueurs = new Set(vus.map((e) => e.a));
      const touchee = new Set(vus.filter((e) => e.ouverte !== null).map((e) => e.a)).size;
      const motif = lot[0].motif;
      out.push({
        famille: "notif",
        at: lot[0].envoyee,
        titre: defMotif(motif).label,
        detail: [
          pluriel(joueurs.size, "joueur prévenu", "joueurs prévenus"),
          touchee > 0 ? `${touchee} l'${touchee > 1 ? "ont" : "a"} touchée` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        fort: motif !== "match-veille",
      });
    }
  }

  // 2. Entre joueurs : un compte par jour.
  const parJour = new Map<number, EnvoiRepere[]>();
  for (const e of tries) {
    if (estDeLApp(e.motif) || !garde(e.a)) continue;
    const j = debutJour(e.envoyee);
    const liste = parJour.get(j) ?? [];
    liste.push(e);
    parJour.set(j, liste);
  }
  for (const liste of parJour.values()) {
    const genres = GENRES.map((g) => ({ label: g.label, n: liste.filter((e) => g.test(e.motif)).length }))
      .filter((g) => g.n > 0)
      .sort((x, y) => y.n - x.n);
    out.push({
      famille: "notif",
      at: liste[0].envoyee,
      titre: "Entre joueurs",
      detail: `${pluriel(liste.length, "notification", "notifications")}${
        genres.length ? ` : ${genres.map((g) => `${g.label} ${g.n}`).join(", ")}` : ""
      }`,
      fort: false,
      parJour: true,
    });
  }
  return out;
}

/* --------------------------------- terrain -------------------------------- */

/** « 12h30 » → [12, 30] ; illisible : le coup d'envoi habituel. */
function heureDe(libelle: string | undefined): [number, number] {
  const m = /(\d{1,2})\s*h\s*(\d{2})?/i.exec(libelle ?? "");
  return m ? [Number(m[1]), Number(m[2] ?? 0)] : [13, 0];
}

/**
 * L'instant d'une journée, d'après son libellé (« 11 oct. ») : l'année est
 * celle de `maintenant`, ou la précédente quand la date tomberait loin
 * devant (une saison de juin relue en janvier).
 */
export function instantJournee(j: Pick<JourneeMeta, "date" | "heure">, maintenant: number): number | null {
  const jm = jourMoisDuLibelle(j.date);
  if (!jm) return null;
  const [h, min] = heureDe(j.heure);
  const annee = new Date(maintenant).getFullYear();
  const t = new Date(annee, jm.mois - 1, jm.jour, h, min).getTime();
  return t - maintenant > 120 * 24 * 3600 * 1000 ? new Date(annee - 1, jm.mois - 1, jm.jour, h, min).getTime() : t;
}

/** Les journées de toutes les saisons, la saison en cours comprise. */
export function reperesJournees(saison: Saison, maintenant: number): Repere[] {
  const saisons = [
    ...(saison.archives ?? []).map((a) => ({ nom: a.nom, journees: a.journees, entries: a.entries })),
    { nom: `Saison ${numeroSaison(saison)}`, journees: saison.journees, entries: saison.entries },
  ];
  const out: Repere[] = [];
  for (const s of saisons) {
    for (const j of s.journees) {
      const at = instantJournee(j, maintenant);
      if (at === null) continue;
      const presents = new Set(s.entries.filter((e: MatchEntry) => e.j === j.j && e.statut === "Présent").map((e) => e.player));
      out.push({
        famille: "terrain",
        at,
        titre: `J${j.j} · ${s.nom}`,
        detail: presents.size > 0 ? pluriel(presents.size, "joueur sur la feuille", "joueurs sur la feuille") : null,
        fort: true,
      });
    }
  }
  return out;
}

/** Un match ouvert par un joueur (table matchs). */
export interface MatchRepere {
  organisateur: string;
  /** AAAA-MM-JJ. */
  jour: string;
  heure: string;
  lieu: string;
  /** Les inscrits, l'organisateur compris. */
  joueurs: number;
}

export function reperesMatchs(matchs: MatchRepere[]): Repere[] {
  return matchs.flatMap((m) => {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(m.jour);
    if (!d) return [];
    const [h, min] = heureDe(m.heure);
    return [
      {
        famille: "terrain" as const,
        at: new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), h, min).getTime(),
        titre: `Match de ${m.organisateur}`,
        detail: [pluriel(m.joueurs, "joueur", "joueurs"), m.lieu].filter(Boolean).join(" · "),
        fort: false,
      },
    ];
  });
}

/* ------------------------------ mises en ligne ---------------------------- */

export function reperesMisesEnLigne(liste: MiseEnLigne[]): Repere[] {
  return liste.map((m) => {
    const { sujet, detail } = sujetEtDetail(m.titre);
    return { famille: "appli", at: m.le, titre: sujet, detail, fort: false, pr: m.pr };
  });
}

/* --------------------------------- par jour ------------------------------- */

const RANG: Record<FamilleRepere, number> = { terrain: 0, notif: 1, appli: 2 };

/** Les repères de chaque jour (minuit local), les plus forts d'abord, puis par famille et par heure. */
export function reperesParJour(reperes: Repere[]): Map<number, Repere[]> {
  const m = new Map<number, Repere[]>();
  for (const r of reperes) {
    const j = debutJour(r.at);
    const liste = m.get(j) ?? [];
    liste.push(r);
    m.set(j, liste);
  }
  for (const liste of m.values())
    liste.sort((x, y) => Number(y.fort) - Number(x.fort) || RANG[x.famille] - RANG[y.famille] || x.at - y.at);
  return m;
}

/** Ce qu'un jour montre sous la courbe : une marque par famille. */
export interface Marques {
  /** 2 : une journée de la ligue ; 1 : un match ouvert par un joueur. */
  terrain: 0 | 1 | 2;
  /** 2 : une notification à toute la ligue ; 1 : seulement entre joueurs. */
  notif: 0 | 1 | 2;
  /** Le nombre de mises en ligne. */
  appli: number;
  /** « J2 », sur le trait de la journée. */
  journee: string | null;
}

export function marquesDuJour(liste: Repere[] | undefined): Marques | null {
  if (!liste?.length) return null;
  const journee = liste.find((r) => r.famille === "terrain" && r.fort);
  const notifs = liste.filter((r) => r.famille === "notif");
  return {
    terrain: journee ? 2 : liste.some((r) => r.famille === "terrain") ? 1 : 0,
    notif: notifs.some((r) => r.fort) ? 2 : notifs.length ? 1 : 0,
    appli: liste.filter((r) => r.famille === "appli").length,
    journee: journee ? journee.titre.split(" · ")[0] : null,
  };
}

/* ------------------------- l'écart à un jour ordinaire -------------------- */

/** Les mesures qui se comptent jour par jour ; les deux autres (7 jours glissants, cumul) se lisent en variation. */
const FLUX = new Set<MetriqueId>(["actifs", "nouveaux", "sessions", "minutes"]);

export interface Ecart {
  valeur: number;
  /** La médiane des 7 jours d'avant (mesures du jour) ; null sans assez d'historique. */
  ordinaire: number | null;
  /** valeur / ordinaire, quand l'ordinaire n'est pas nul. */
  fois: number | null;
  /** Pour les actifs sur 7 jours et le cumul : l'écart avec la veille. */
  variation: number | null;
}

function mediane(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function ecartDuJour(serie: PointJour[], i: number, m: MetriqueId): Ecart {
  const valeur = serie[i]?.[m] ?? 0;
  if (!FLUX.has(m)) {
    return { valeur, ordinaire: null, fois: null, variation: i > 0 ? valeur - serie[i - 1][m] : null };
  }
  const avant = serie.slice(Math.max(0, i - 7), i).map((p) => p[m]);
  if (avant.length < 3) return { valeur, ordinaire: null, fois: null, variation: null };
  const ordinaire = mediane(avant);
  return { valeur, ordinaire, fois: ordinaire > 0 ? valeur / ordinaire : null, variation: null };
}

/**
 * Les pics de la fenêtre [debut, fin de la série] : les jours qui dépassent
 * le plus un jour ordinaire (au moins 1,5 fois, et de 2 au moins), ou, en
 * actifs sur 7 jours et en cumul, qui ont le plus monté d'un coup. Du plus
 * fort au plus faible.
 */
export function pics(serie: PointJour[], debut: number, m: MetriqueId, n = 3): number[] {
  const candidats: { i: number; score: number }[] = [];
  for (let i = Math.max(1, debut); i < serie.length; i++) {
    const e = ecartDuJour(serie, i, m);
    if (FLUX.has(m)) {
      if (e.ordinaire === null) continue;
      const score = e.valeur - e.ordinaire;
      if (score >= 2 && (e.fois === null ? e.valeur >= 3 : e.fois >= 1.5)) candidats.push({ i, score });
    } else if (e.variation !== null && e.variation >= 2) {
      candidats.push({ i, score: e.variation });
    }
  }
  return candidats
    .sort((a, b) => b.score - a.score || b.i - a.i)
    .slice(0, n)
    .map((c) => c.i);
}
