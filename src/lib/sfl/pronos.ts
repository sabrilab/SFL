// Le Flair (les pronos Bola ; Sabri, 24/10 : « faut pas que t'appelles ça
// prono, faut trouver un truc plus stylé », il a choisi « Le Flair ») : deviner ce que le terrain va dire, avant qu'il le dise.
//
// Sabri, 24/10 : « que le joueur puisse pronostiquer des choses dans les
// matchs à venir ou les journées, et que ça puisse lui donner des XP », « qui
// finira meilleur buteur, qui finira meilleure Pépite d'Or ». Deux tables de
// paris, sans argent ni point Pépite (comme les missions : le terrain fait la
// note, l'app fait le niveau) :
//
//   · la journée, dès que ses équipes sont faites et jusqu'au premier coup
//     d'envoi (comme les missions : à 15h, on connaîtrait déjà le match de
//     13h) : Noirs, nul ou Blancs pour chaque match, le meilleur buteur et le
//     meilleur du jour (le plus de points Pépite, titres du vote compris).
//     Sur ton propre match, tu ne peux soutenir que ton camp. Le verdict est
//     définitif à minuit, quand le vote Impact et Défensive se ferme ;
//   · la saison : la Pépite d'Or, le meilleur buteur, le meilleur passeur.
//     Ouverts toute la saison, jugés à sa clôture. Plus on s'y prend tôt, plus
//     ça rapporte : la prime suit le nombre de journées déjà jouées au moment
//     du dernier changement (primeSaison). Changer d'avis garde le choix, pas
//     la prime d'avant.
//
// Une égalité en tête donne raison à tous ceux qui ont choisi l'un des
// premiers. Une journée de pronos rapporte au plus PLAFOND_JOURNEE, autant
// que jouer le dimanche : jamais plus que jouer.
//
// Pur : ni React ni réseau. Les pronos arrivent en paramètres (pronos-store.ts).

import { isHidden } from "./hidden";
import { missionsDeJournee, type DimancheMissions, type LigneXp } from "./missions";
import { computeStandings, entryPP } from "./saisie/engine";
import { journeeJouee } from "./saisie/mutations";
import type { MatchEntry, Saison } from "./saisie/types";

/* ------------------------------- Le barème ------------------------------- */

/** Un sujet de la journée : `match:0` pour le Match 1, le buteur, le meilleur du jour. */
export type SujetJournee = `match:${number}` | "buteur" | "pepite";
/** Un sujet de la saison. */
export type SujetSaison = "pepite" | "buteur" | "passeur";

/** Le numéro de journée des pronos de saison (une journée commence à 1). */
export const J_SAISON = 0;

export const XP_VAINQUEUR = 20;
export const XP_BUTEUR_DU_JOUR = 40;
export const XP_MEILLEUR_DU_JOUR = 40;
/** Une journée de pronos rapporte au plus un dimanche joué (XP_DIMANCHE). */
export const PLAFOND_JOURNEE = 100;

export const PRIME_SAISON_MAX = 300;
export const PRIME_SAISON_MIN = 60;
export const PRIME_SAISON_PAS = 40;

/** La prime d'un prono de saison posé après `jouees` journées jouées : 300, 260, 220… jamais sous 60. */
export const primeSaison = (jouees: number) => Math.max(PRIME_SAISON_MIN, PRIME_SAISON_MAX - PRIME_SAISON_PAS * jouees);

export const SUJETS_SAISON: SujetSaison[] = ["pepite", "buteur", "passeur"];
export const TITRE_SAISON: Record<SujetSaison, string> = {
  pepite: "Pépite d'Or",
  buteur: "Meilleur buteur",
  passeur: "Meilleur passeur",
};

/* ------------------------------- Les types ------------------------------- */

/** Un prono, tel que la base le garde (table pronos). */
export interface Prono {
  saison: number;
  /** La journée ; J_SAISON pour la saison. */
  j: number;
  sujet: string;
  /** Le nom de joueur de la saison de celui qui pronostique. */
  joueur: string;
  /** « noirs », « nul », « blancs », ou un nom de joueur. */
  choix: string;
  /** L'heure de la base, pas celle du téléphone. */
  le: string;
}

export type Camp = "noirs" | "nul" | "blancs";

export interface MatchProno {
  n: number;
  label: string;
  noirs: string[];
  blancs: string[];
}

export interface JourneePronos {
  saison: number;
  j: number;
  date: string;
  coupEnvoi: Date;
  finDuJour: Date;
  joue: boolean;
  matchs: MatchProno[];
  /** Tous les joueurs de la feuille, masqués exclus. */
  joueurs: string[];
  /** Le camp de chacun. */
  camps: DimancheMissions["camps"];
}

export type EtatProno = "juste" | "faux" | "attente";

/* ------------------------------ La journée ------------------------------ */

/** Les pronos d'une journée : ses matchs et sa feuille ; null tant que ses équipes ne sont pas faites. */
export function pronosDeJournee(
  s: Pick<Saison, "journees" | "entries" | "roster"> & Partial<Saison>,
  numero: number,
  j: number,
  reference: Date
): JourneePronos | null {
  const d = missionsDeJournee(s, numero, j, reference);
  if (!d) return null;
  const parMatch = new Map<number, MatchProno>();
  for (const [nom, c] of d.camps) {
    let m = parMatch.get(c.terrain);
    if (!m) parMatch.set(c.terrain, (m = { n: c.terrain, label: c.label, noirs: [], blancs: [] }));
    (c.equipe === "noirs" ? m.noirs : m.blancs).push(nom);
  }
  const matchs = [...parMatch.values()].sort((a, b) => a.n - b.n);
  return {
    saison: d.saison,
    j: d.j,
    date: d.date,
    coupEnvoi: d.coupEnvoi,
    finDuJour: d.finDuJour,
    joue: d.joue,
    matchs,
    joueurs: matchs.flatMap((m) => [...m.noirs, ...m.blancs]),
    camps: d.camps,
  };
}

/** La dernière journée qui a des équipes : celle des pronos en cours. */
export function journeeDesPronos(s: Saison, maintenant: Date): JourneePronos | null {
  const js = [...s.journees].map((m) => m.j).sort((a, b) => b - a);
  for (const j of js) {
    const p = pronosDeJournee(s, s.numero ?? 0, j, maintenant);
    if (p) return p;
  }
  return null;
}

/** Ce qu'un joueur peut choisir sur un match : tout, sauf contre son propre camp. */
export function choixPermis(p: JourneePronos, n: number, joueur: string): Camp[] {
  const c = p.camps.get(joueur);
  if (c && c.terrain === n) return [c.equipe];
  return ["noirs", "nul", "blancs"];
}

const joue = (e: MatchEntry) => e.statut === "Présent" && !e.extraTime;

/** Les premiers d'un compte, égalités comprises ; vide si personne n'a rien. */
function premiers(valeurs: Map<string, number>): string[] {
  let max = 0;
  for (const v of valeurs.values()) max = Math.max(max, v);
  if (max <= 0) return [];
  return [...valeurs].filter(([n, v]) => v === max && !isHidden(n)).map(([n]) => n);
}

/** Les bonnes réponses d'une journée jouée, sur la feuille telle qu'elle est (votes posés). */
export function resultatsDeJournee(
  p: Pick<JourneePronos, "j" | "matchs">,
  entries: MatchEntry[]
): Map<string, string[]> {
  const lignes = entries.filter((e) => e.j === p.j && joue(e));
  const out = new Map<string, string[]>();
  for (const m of p.matchs) {
    const r = lignes.find((e) => m.noirs.includes(e.player) && e.result)?.result;
    if (!r) continue;
    out.set(`match:${m.n}`, [r === "Nul" ? "nul" : r === "Victoire" ? "noirs" : "blancs"]);
  }
  const buts = new Map<string, number>();
  const pp = new Map<string, number>();
  for (const e of lignes) {
    buts.set(e.player, (buts.get(e.player) ?? 0) + e.buts);
    pp.set(e.player, (pp.get(e.player) ?? 0) + entryPP(e));
  }
  if (lignes.some((e) => e.result || e.buts > 0)) {
    out.set("buteur", premiers(buts));
    out.set("pepite", premiers(pp));
  }
  return out;
}

export const xpSujet = (sujet: string) =>
  sujet.startsWith("match:") ? XP_VAINQUEUR : sujet === "buteur" ? XP_BUTEUR_DU_JOUR : XP_MEILLEUR_DU_JOUR;

/** Le prono retenu : posé avant le coup d'envoi, et jamais contre son propre camp. */
export function pronoRetenu(pronos: Prono[], p: JourneePronos, joueur: string, sujet: string): Prono | null {
  const x = pronos.find((r) => r.saison === p.saison && r.j === p.j && r.sujet === sujet && r.joueur === joueur);
  if (!x || new Date(x.le).getTime() > p.coupEnvoi.getTime()) return null;
  if (sujet.startsWith("match:") && !choixPermis(p, Number(sujet.slice(6)), joueur).includes(x.choix as Camp)) return null;
  return x;
}

export function etatDe(x: Prono | null, resultats: Map<string, string[]>): EtatProno {
  const bons = x && resultats.get(x.sujet);
  if (!x || !bons) return "attente";
  return bons.includes(x.choix) ? "juste" : "faux";
}

/* ------------------------------- La saison ------------------------------- */

/** Le coup d'envoi de chaque journée qui a des équipes. */
function coupsDEnvoi(s: Pick<Saison, "journees" | "entries" | "roster">, numero: number, reference: Date): Date[] {
  return s.journees
    .filter((m) => journeeJouee(s as Saison, m.j))
    .map((m) => missionsDeJournee(s, numero, m.j, reference)?.coupEnvoi)
    .filter((d): d is Date => !!d && d.getTime() > 0);
}

/** La prime d'un prono de saison posé à cet instant. */
export function primeAu(s: Pick<Saison, "journees" | "entries" | "roster">, numero: number, le: Date, reference: Date): number {
  return primeSaison(coupsDEnvoi(s, numero, reference).filter((d) => d.getTime() <= le.getTime()).length);
}

/** Les premiers de la saison sur chaque sujet. */
export function resultatsDeSaison(s: Saison): Map<SujetSaison, string[]> {
  const joueurs = computeStandings(s).filter((p) => !isHidden(p.name));
  const de = (f: (p: (typeof joueurs)[number]) => number) => premiers(new Map(joueurs.map((p) => [p.name, f(p)])));
  return new Map<SujetSaison, string[]>([
    ["pepite", de((p) => p.pp)],
    ["buteur", de((p) => p.buts)],
    ["passeur", de((p) => p.passes)],
  ]);
}

/* -------------------------------- Le journal ------------------------------ */

type SaisonLue = Pick<Saison, "journees" | "entries" | "roster"> & Partial<Saison>;

/**
 * Les lignes d'XP des pronos d'une saison : une par journée finie (ses pronos
 * justes, plafonnés), une par prono de saison juste une fois la saison close.
 */
export function lignesPronos(
  lue: SaisonLue,
  numero: number,
  close: boolean,
  pronos: Prono[],
  maintenant: Date,
  reference: Date
): { joueur: string; ligne: LigneXp }[] {
  const out: { joueur: string; ligne: LigneXp }[] = [];
  const miens = pronos.filter((x) => x.saison === numero);
  if (!miens.length) return out;
  const js = [...new Set(miens.filter((x) => x.j !== J_SAISON).map((x) => x.j))].sort((a, b) => a - b);
  for (const j of js) {
    const p = pronosDeJournee(lue, numero, j, reference);
    if (!p || !p.joue || (!close && maintenant.getTime() < p.finDuJour.getTime())) continue;
    const res = resultatsDeJournee(p, lue.entries);
    const parJoueur = new Map<string, { justes: number; total: number; xp: number }>();
    for (const x of miens.filter((r) => r.j === j)) {
      const retenu = pronoRetenu(miens, p, x.joueur, x.sujet);
      const etat = etatDe(retenu, res);
      if (etat === "attente") continue;
      const b = parJoueur.get(x.joueur) ?? { justes: 0, total: 0, xp: 0 };
      b.total++;
      if (etat === "juste") {
        b.justes++;
        b.xp += xpSujet(x.sujet);
      }
      parJoueur.set(x.joueur, b);
    }
    for (const [joueur, b] of parJoueur) {
      if (!b.justes) continue;
      out.push({
        joueur,
        ligne: { saison: numero, j, date: p.date, quoi: `Flair, ${b.justes} sur ${b.total}`, xp: Math.min(b.xp, PLAFOND_JOURNEE) },
      });
    }
  }
  if (close) {
    const res = resultatsDeSaison(lue as Saison);
    const derniere = [...lue.journees].sort((a, b) => b.j - a.j)[0];
    for (const x of miens.filter((r) => r.j === J_SAISON)) {
      const sujet = x.sujet as SujetSaison;
      if (!res.get(sujet)?.includes(x.choix)) continue;
      out.push({
        joueur: x.joueur,
        ligne: {
          saison: numero,
          j: derniere?.j ?? 0,
          date: derniere?.date ?? "",
          quoi: `Flair de la saison : ${TITRE_SAISON[sujet] ?? sujet}`,
          xp: primeAu(lue, numero, new Date(x.le), reference),
        },
      });
    }
  }
  return out;
}

/* ---------------------------- Ce que pense la ligue ---------------------------- */

/** La part de la ligue derrière chaque choix d'un sujet : [choix, nombre][], du plus suivi au moins suivi. */
export function partsDe(pronos: Prono[], saison: number, j: number, sujet: string): [string, number][] {
  const n = new Map<string, number>();
  for (const x of pronos) if (x.saison === saison && x.j === j && x.sujet === sujet) n.set(x.choix, (n.get(x.choix) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1]);
}

/**
 * Ajoute au journal d'XP (missions.ts, journalXp) les pronos de toutes les
 * saisons : les archives, closes, puis la saison en cours. À part du journal
 * pour ne pas faire de missions.ts un importateur de ce fichier.
 */
export function ajouterPronos(
  journal: Map<string, { lignes: LigneXp[]; reussies: number }>,
  s: Saison,
  pronos: Prono[],
  maintenant: Date
): void {
  if (!pronos.length) return;
  const saisons = [
    ...[...(s.archives ?? [])].map((a) => ({ numero: a.numero, lue: a as SaisonLue, close: true, reference: new Date(a.cloturee) })),
    { numero: s.numero ?? 0, lue: s as SaisonLue, close: false, reference: maintenant },
  ];
  for (const sa of saisons) {
    for (const { joueur, ligne } of lignesPronos(sa.lue, sa.numero, sa.close, pronos, maintenant, sa.reference)) {
      let x = journal.get(joueur);
      if (!x) journal.set(joueur, (x = { lignes: [], reussies: 0 }));
      x.lignes.push(ligne);
    }
  }
}
