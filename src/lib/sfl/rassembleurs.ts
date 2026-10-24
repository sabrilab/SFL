// « Qui ramène du monde » (Admin → Activité) : les joueurs dont un geste fait
// venir ou revenir les autres. Sabri, 24/10 : « avoir une espèce de schéma
// de compréhension sur les personnalités qui font ramener les gens ».
//
// Un lien va d'un joueur (celui qui ramène) à un autre (celui qui vient), par
// un canal, et dit ce qui s'est passé :
//   · revenu : une notification née de son geste (un message ou une réaction
//     au Vestiaire, dans un match ou une équipe, une invitation, un suivi,
//     une félicitation) est partie quand l'autre n'avait pas ouvert l'app
//     depuis au moins une heure, et il l'a rouverte dans les deux heures.
//     Plusieurs notifications avant un même retour : une seule compte, celle
//     qu'il a touchée, sinon la dernière ;
//   · venu : un filleul, venu par son lien ou son code (parrainage) ;
//   · signé : il a signé dans une Bola Team, sur son invitation ;
//   · inscrit : il a pris part à un match que l'autre a ouvert.
// Les notifications de l'app elle-même (annonces, divisions, missions, rappel
// de la veille) comptent à part, pour comparer.
//
// La source d'une notification : la colonne push_envois.de depuis le 24/10 ;
// avant, sourceDevinee la retrouve dans le geste qui l'a déclenchée, quand
// l'admin peut le lire : le message ou la réaction du Vestiaire, le suivi, la
// félicitation, l'organisateur du match, l'auteur de l'invitation d'équipe,
// la signature. Les discussions de match et d'équipe sont privées : leurs
// notifications d'avant restent sans source, et la page le dit.
//
// Module pur : la page lit, ce module relie.

import { estDeLApp, type EnvoiRepere } from "@/lib/sfl/reperes";

export type CanalLien = "vestiaire" | "match" | "equipe" | "suivi" | "felicitation" | "parrainage";

/** Dans l'ordre du schéma, autour de celui qui ramène. */
export const CANAUX_LIEN: { id: CanalLien; label: string }[] = [
  { id: "vestiaire", label: "Vestiaire" },
  { id: "match", label: "Matchs" },
  { id: "equipe", label: "Bola Team" },
  { id: "suivi", label: "Suivis" },
  { id: "felicitation", label: "Félicitations" },
  { id: "parrainage", label: "Parrainage" },
];

/** Le canal d'une notification entre joueurs ; null pour celles de l'app. */
export function canalDuMotif(motif: string): CanalLien | null {
  if (estDeLApp(motif)) return null;
  if (motif.startsWith("vestiaire-")) return "vestiaire";
  if (motif.startsWith("match-")) return "match";
  if (motif.startsWith("equipe-")) return "equipe";
  if (motif === "suivi" || motif === "suivi-retour") return "suivi";
  if (motif === "felicitation") return "felicitation";
  return null;
}

export type GenreLien = "revenu" | "venu" | "signe" | "inscrit";

export interface Lien {
  /** Celui qui ramène. */
  de: string;
  /** Celui qui vient. */
  a: string;
  canal: CanalLien;
  genre: GenreLien;
  /** Son retour, son inscription, sa signature (ms). */
  at: number;
}

/** Une notification, avec le joueur dont elle vient : lu en base, déduit, ou null (l'app, ou on ne sait pas). */
export interface EnvoiLien extends EnvoiRepere {
  de: string | null;
}

/* --------------------------- la source, déduite --------------------------- */

/** Ce qu'il faut pour retrouver la source d'une notification d'avant le 24/10. Des noms partout. */
export interface Indices {
  /** Identifiant → nom : les ref « joueur:<id> » des suivis. */
  noms: ReadonlyMap<string, string>;
  /** Les messages du Vestiaire. */
  vestiaire: { auteur: string; at: number }[];
  /** Les réactions aux messages du Vestiaire : qui a réagi, au message de qui. */
  reactions: { de: string; auteur: string; at: number }[];
  felicitations: { de: string; a: string; exploit: string }[];
  /** Un match → celui qui l'a ouvert. */
  organisateurs: ReadonlyMap<number, string>;
  /** Les lignes des équipes : qui a invité chacun, et quand il a signé. */
  equipes: { equipe: number; joueur: string; invitePar: string | null; signe: number | null }[];
}

/** Un message part, sa notification suit : au plus 5 minutes après (la route refuse au-delà). */
const SUIT = 5 * 60_000;
/** Une signature, l'avertissement de l'équipe : dans les 10 minutes. */
const SUIT_SIGNATURE = 10 * 60_000;
/** L'horloge du serveur et celle de la base peuvent différer de quelques secondes. */
const MARGE = 10_000;

/** Le plus récent de `liste` juste avant `t` (dans `fenetre`), qui passe `ok`. */
function justeAvant<T extends { at: number }>(liste: T[], t: number, fenetre: number, ok: (x: T) => boolean): T | null {
  let meilleur: T | null = null;
  for (const x of liste)
    if (x.at <= t + MARGE && x.at >= t - fenetre && ok(x) && (!meilleur || x.at > meilleur.at)) meilleur = x;
  return meilleur;
}

/** « match:12 » → ["match", "12"] ; « exploit:0-3-mvp-Kader » → ["exploit", "0-3-mvp-Kader"]. */
function decouperRef(ref: string | null): [string, string] {
  const i = (ref ?? "").indexOf(":");
  return i < 0 ? ["", ""] : [ref!.slice(0, i), ref!.slice(i + 1)];
}

/** Le joueur dont vient une notification d'avant la colonne de, quand on peut le retrouver. */
export function sourceDevinee(e: EnvoiRepere, ind: Indices): string | null {
  const m = e.motif;
  const [quoi, cle] = decouperRef(e.ref);
  if (m === "suivi" || m === "suivi-retour") return quoi === "joueur" ? (ind.noms.get(cle) ?? null) : null;
  if (m === "felicitation")
    return quoi === "exploit" ? (ind.felicitations.find((f) => f.a === e.a && f.exploit === cle)?.de ?? null) : null;
  if (m === "vestiaire-reaction")
    return justeAvant(ind.reactions, e.envoyee, SUIT, (r) => r.auteur === e.a && r.de !== e.a)?.de ?? null;
  if (m.startsWith("vestiaire-")) return justeAvant(ind.vestiaire, e.envoyee, SUIT, (x) => x.auteur !== e.a)?.auteur ?? null;
  const id = Number(cle);
  if (quoi === "match" && (m === "match-invitation" || m === "match-modifie" || m === "match-annule"))
    return ind.organisateurs.get(id) ?? null;
  if (quoi === "equipe" && (m === "equipe-invitation" || m === "equipe-relance"))
    return ind.equipes.find((l) => l.equipe === id && l.joueur === e.a)?.invitePar ?? null;
  if (quoi === "equipe" && (m === "equipe-signature" || m === "equipe-active")) {
    const signatures = ind.equipes.flatMap((l) => (l.equipe === id && l.signe !== null ? [{ joueur: l.joueur, at: l.signe }] : []));
    return justeAvant(signatures, e.envoyee, SUIT_SIGNATURE, (s) => s.joueur !== e.a)?.joueur ?? null;
  }
  // Les discussions de match et d'équipe : privées, même pour l'admin.
  return null;
}

/* -------------------------------- les liens ------------------------------- */

/** Absent depuis au moins une heure quand elle part… */
const ABSENT = 3600_000;
/** … et revenu dans les deux heures. */
const RETOUR = 2 * 3600_000;

export interface Rassembleur {
  nom: string;
  /** Les joueurs distincts qu'il a fait venir ou revenir sur la période. */
  joueurs: number;
  /** Les retours dus à ses notifications. */
  retours: number;
  /** Ses notifications parties sur la période, vers le public regardé. */
  envoyees: number;
  /** Du plus ancien au plus récent. */
  liens: Lien[];
}

export interface AnalyseLiens {
  /** Ceux qui ramènent le plus de joueurs d'abord. */
  rassembleurs: Rassembleur[];
  /** L'app elle-même, pour comparer. */
  app: { retours: number; joueurs: number; envoyees: number };
  /** Les retours après une notification d'un joueur qu'on ne sait pas nommer. */
  sansSource: number;
}

/** L'indice du premier instant de `ts` (trié) strictement après `t`. */
function premierApres(ts: number[], t: number): number {
  let bas = 0;
  let haut = ts.length;
  while (bas < haut) {
    const m = (bas + haut) >> 1;
    if (ts[m] <= t) bas = m + 1;
    else haut = m;
  }
  return bas;
}

export function analyserLiens({
  envois,
  instants,
  autres,
  depuis,
  garde,
}: {
  envois: EnvoiLien[];
  /** Les instants de chaque joueur dans le journal d'usage, triés, toute l'histoire. */
  instants: ReadonlyMap<string, number[]>;
  /** Les liens hors notifications (venu, signé, inscrit). */
  autres: Lien[];
  /** Le début de la période (ms). */
  depuis: number;
  /** Le public regardé : ceux qui viennent et qu'on compte. */
  garde: (nom: string) => boolean;
}): AnalyseLiens {
  // 1. Chaque notification de la période : est-il revenu juste après ?
  const parRetour = new Map<string, { a: string; r: number; envois: EnvoiLien[] }>();
  const envoyees = new Map<string, number>();
  let envoyeesApp = 0;
  for (const e of envois) {
    if (e.envoyee < depuis || !garde(e.a)) continue;
    if (estDeLApp(e.motif)) envoyeesApp++;
    else if (e.de) envoyees.set(e.de, (envoyees.get(e.de) ?? 0) + 1);
    const ts = instants.get(e.a);
    if (!ts?.length) continue;
    const k = premierApres(ts, e.envoyee);
    if (k > 0 && e.envoyee - ts[k - 1] < ABSENT) continue;
    const r = ts[k];
    if (r === undefined || r - e.envoyee > RETOUR) continue;
    const cle = `${e.a}|${r}`;
    const g = parRetour.get(cle) ?? { a: e.a, r, envois: [] };
    g.envois.push(e);
    parRetour.set(cle, g);
  }

  // 2. Un retour, une notification : celle qu'il a touchée, sinon la dernière.
  const retours: Lien[] = [];
  const app = { retours: 0, joueurs: new Set<string>() };
  let sansSource = 0;
  for (const g of parRetour.values()) {
    const touchees = g.envois.filter((e) => e.ouverte !== null);
    const e = (touchees.length ? touchees : g.envois).reduce((x, y) => (y.envoyee > x.envoyee ? y : x));
    const canal = canalDuMotif(e.motif);
    if (estDeLApp(e.motif)) {
      app.retours++;
      app.joueurs.add(g.a);
    } else if (canal && e.de && e.de !== g.a) retours.push({ de: e.de, a: g.a, canal, genre: "revenu", at: g.r });
    else sansSource++;
  }

  // 3. Par joueur qui ramène.
  const par = new Map<string, Lien[]>();
  for (const l of [...retours, ...autres.filter((l) => l.at >= depuis && l.de !== l.a && garde(l.a))]) {
    const liste = par.get(l.de) ?? [];
    liste.push(l);
    par.set(l.de, liste);
  }
  const rassembleurs = [...par].map(([nom, liens]) => ({
    nom,
    joueurs: new Set(liens.map((l) => l.a)).size,
    retours: liens.filter((l) => l.genre === "revenu").length,
    envoyees: envoyees.get(nom) ?? 0,
    liens: liens.sort((x, y) => x.at - y.at),
  }));
  rassembleurs.sort(
    (x, y) =>
      y.joueurs - x.joueurs || y.retours - x.retours || y.liens.length - x.liens.length || x.nom.localeCompare(y.nom, "fr")
  );
  return { rassembleurs, app: { retours: app.retours, joueurs: app.joueurs.size, envoyees: envoyeesApp }, sansSource };
}

/* ------------------------------- l'entourage ------------------------------ */

/** Un joueur autour de celui qui ramène, sur le schéma. */
export interface Proche {
  nom: string;
  /** Combien de fois il est venu ou revenu par lui. */
  fois: number;
  /** Le canal qui l'a amené le plus souvent. */
  canal: CanalLien;
  /** Venu pour la première fois par lui : son filleul. */
  nouveau: boolean;
}

const RANG_CANAL = new Map(CANAUX_LIEN.map((c, i) => [c.id, i]));

/** Les joueurs qu'il a fait venir ou revenir, rangés par canal (l'ordre du schéma), les plus fidèles d'abord. */
export function entourage(r: Rassembleur): Proche[] {
  const par = new Map<string, Lien[]>();
  for (const l of r.liens) par.set(l.a, [...(par.get(l.a) ?? []), l]);
  return [...par]
    .map(([nom, liens]) => {
      const compte = new Map<CanalLien, number>();
      for (const l of liens) compte.set(l.canal, (compte.get(l.canal) ?? 0) + 1);
      const canal = [...compte].sort((x, y) => y[1] - x[1] || RANG_CANAL.get(x[0])! - RANG_CANAL.get(y[0])!)[0][0];
      return { nom, fois: liens.length, canal, nouveau: liens.some((l) => l.genre === "venu") };
    })
    .sort((x, y) => RANG_CANAL.get(x.canal)! - RANG_CANAL.get(y.canal)! || y.fois - x.fois || x.nom.localeCompare(y.nom, "fr"));
}

/** Ses liens, canal par canal, dans l'ordre du schéma : « Vestiaire 8 · Suivis 2 ». */
export function parCanal(r: Rassembleur): { canal: CanalLien; label: string; n: number }[] {
  return CANAUX_LIEN.map((c) => ({ canal: c.id, label: c.label, n: r.liens.filter((l) => l.canal === c.id).length })).filter(
    (c) => c.n > 0
  );
}
