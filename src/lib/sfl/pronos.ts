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
//     Sabri, 31/10 : « pour chaque match qui se joue dans une journée SFL, on
//     puisse déterminer avec le flair le meilleur buteur, le meilleur passeur
//     et le MVP du match », « le meilleur passeur du jour », « des choix en
//     fonction des matchs, pas juste qui va gagner ». Chaque match a donc, en
//     plus du vainqueur, son MVP, son buteur, son passeur, son écart (serré,
//     net, large) et son duel (les deux rivaux du contrat, missions.ts : qui
//     finit devant l'autre en points du jour) ; la journée a son passeur.
//     Et pour celui qui ne joue pas (blessé, absent, en tribune : « même s'il
//     ne peut plus jouer, il peut quand même participer »), le plafond monte
//     à PLAFOND_TRIBUNE : toujours moins qu'un dimanche joué, Flair compris ;
//   · la saison : la Pépite d'Or, le meilleur buteur, le meilleur passeur.
//     Ouverts toute la saison, jugés à sa clôture. Plus on s'y prend tôt, plus
//     ça rapporte : la prime suit le nombre de journées déjà jouées au moment
//     du dernier changement (primeSaison). Changer d'avis garde le choix, pas
//     la prime d'avant.
//
// Une égalité en tête donne raison à tous ceux qui ont choisi l'un des
// premiers. Une journée de pronos rapporte au plus PLAFOND_JOURNEE, autant
// que jouer le dimanche : jamais plus que jouer ; PLAFOND_TRIBUNE pour qui
// n'est pas sur la feuille.
//
// Pur : ni React ni réseau. Les pronos arrivent en paramètres (pronos-store.ts).

import { isHidden } from "./hidden";
import { missionsDeJournee, type DimancheMissions, type LigneXp } from "./missions";
import { entryPP } from "./saisie/engine";
import { classables, standingsJusqua } from "./rangs";
import { journeeJouee } from "./saisie/mutations";
import type { MatchEntry, Saison } from "./saisie/types";

/* ------------------------------- Le barème ------------------------------- */

/** Les sujets d'un match : `match:0` (qui gagne le Match 1), `mvp:0`, `buteur:0`… */
export const SUJETS_MATCH = ["match", "ecart", "duel", "mvp", "buteur", "passeur"] as const;
export type GenreMatch = (typeof SUJETS_MATCH)[number];
/** Un sujet de la journée : ceux de chaque match, puis le meilleur, le buteur et le passeur du jour. */
export type SujetJournee = `${GenreMatch}:${number}` | "pepite" | "buteur" | "passeur";
export const SUJETS_JOUR = ["pepite", "buteur", "passeur"] as const;
/** Un sujet de la saison. */
export type SujetSaison = "pepite" | "buteur" | "passeur";

/** Le numéro de journée des pronos de saison (une journée commence à 1). */
export const J_SAISON = 0;

export const XP_VAINQUEUR = 20;
export const XP_BUTEUR_DU_JOUR = 40;
export const XP_MEILLEUR_DU_JOUR = 40;
export const XP_PASSEUR_DU_JOUR = 40;
/** Ce que rapporte chaque sujet d'un match. */
export const XP_MATCH: Record<GenreMatch, number> = { match: XP_VAINQUEUR, ecart: 15, duel: 15, mvp: 20, buteur: 15, passeur: 15 };
/** Une journée de pronos rapporte au plus un dimanche joué (XP_DIMANCHE). */
export const PLAFOND_JOURNEE = 100;
/** Pour qui n'est pas sur la feuille : le Flair est son dimanche (100 XP joué + 100 de Flair restent devant). */
export const PLAFOND_TRIBUNE = 150;

/** L'écart d'un match, buts d'écart au coup de sifflet : serré (0 ou 1), net (2 ou 3), large (4 et plus). */
export type Ecart = "serre" | "net" | "large";
export const ECARTS: Ecart[] = ["serre", "net", "large"];
export const NOM_ECART: Record<Ecart, string> = { serre: "Serré", net: "Net", large: "Large" };
export const DETAIL_ECART: Record<Ecart, string> = { serre: "0-1 but", net: "2-3 buts", large: "4 et +" };
export const ecartDe = (d: number): Ecart => (Math.abs(d) <= 1 ? "serre" : Math.abs(d) <= 3 ? "net" : "large");

/** Le genre et le match d'un sujet : `mvp:1` → ["mvp", 1] ; un sujet du jour → [sujet, null]. */
export function lireSujet(sujet: string): [string, number | null] {
  const i = sujet.indexOf(":");
  return i < 0 ? [sujet, null] : [sujet.slice(0, i), Number(sujet.slice(i + 1))];
}

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
  /** Le duel du match (le premier contrat de rivaux, missions.ts) : [noirs, blancs] ; null sans duel. */
  duel: [string, string] | null;
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
    if (!m) {
      const duel = d.duels.find((x) => x.terrain === c.terrain);
      parMatch.set(c.terrain, (m = { n: c.terrain, label: c.label, noirs: [], blancs: [], duel: duel ? [duel.noirs, duel.blancs] : null }));
    }
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

/** Ce qu'un joueur peut choisir sur le duel d'un match : l'un ou l'autre, ou lui-même s'il en est. */
export function duelPermis(p: JourneePronos, n: number, joueur: string): string[] {
  const d = p.matchs.find((m) => m.n === n)?.duel;
  if (!d) return [];
  return d.includes(joueur) ? [joueur] : [...d];
}

/** Le choix est-il permis sur ce sujet ? (Les noms de joueurs se vérifient à la lecture.) */
export function permis(p: JourneePronos, sujet: string, joueur: string, choix: string): boolean {
  const [genre, n] = lireSujet(sujet);
  if (n == null) return (SUJETS_JOUR as readonly string[]).includes(genre);
  if (!p.matchs.some((m) => m.n === n)) return false;
  if (genre === "match") return choixPermis(p, n, joueur).includes(choix as Camp);
  if (genre === "ecart") return (ECARTS as string[]).includes(choix);
  if (genre === "duel") return duelPermis(p, n, joueur).includes(choix);
  return (SUJETS_MATCH as readonly string[]).includes(genre);
}

/** Le plafond d'XP d'une journée pour ce joueur : celui de la feuille, ou de la tribune. */
export const plafondDe = (p: Pick<JourneePronos, "camps">, joueur: string) => (p.camps.has(joueur) ? PLAFOND_JOURNEE : PLAFOND_TRIBUNE);

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
  const duJour = entries.filter((e) => e.j === p.j);
  const lignes = duJour.filter(joue);
  const out = new Map<string, string[]>();
  const somme = (ls: MatchEntry[], f: (e: MatchEntry) => number) => {
    const m = new Map<string, number>();
    for (const e of ls) m.set(e.player, (m.get(e.player) ?? 0) + f(e));
    return m;
  };
  for (const m of p.matchs) {
    const ici = new Set([...m.noirs, ...m.blancs]);
    const dans = lignes.filter((e) => ici.has(e.player));
    const r = dans.find((e) => m.noirs.includes(e.player) && e.result)?.result;
    if (r) {
      out.set(`match:${m.n}`, [r === "Nul" ? "nul" : r === "Victoire" ? "noirs" : "blancs"]);
      // Le score, comme le moteur : les buts de l'équipe du jour et ses buts non attribués.
      const equipe = (noms: string[]) => duJour.find((e) => noms.includes(e.player) && e.team)?.team ?? null;
      const score = (t: string | null) =>
        t ? duJour.filter((e) => e.team === t && e.statut === "Présent").reduce((a, e) => a + e.buts + (e.teamScoreBonus ?? 0), 0) : 0;
      out.set(`ecart:${m.n}`, [ecartDe(score(equipe(m.noirs)) - score(equipe(m.blancs)))]);
    }
    if (!dans.some((e) => e.result || e.buts > 0)) continue;
    out.set(`buteur:${m.n}`, premiers(somme(dans, (e) => e.buts)));
    out.set(`passeur:${m.n}`, premiers(somme(dans, (e) => e.passes)));
    const mvp = dans.filter((e) => e.mvp && !isHidden(e.player)).map((e) => e.player);
    if (mvp.length) out.set(`mvp:${m.n}`, [...new Set(mvp)]);
    if (m.duel) {
      const pp = somme(dans, entryPP);
      const [a, b] = m.duel.map((x) => pp.get(x) ?? 0);
      // À égalité, le duel donne raison aux deux.
      out.set(`duel:${m.n}`, a === b ? [...m.duel] : [a > b ? m.duel[0] : m.duel[1]]);
    }
  }
  if (lignes.some((e) => e.result || e.buts > 0)) {
    out.set("buteur", premiers(somme(lignes, (e) => e.buts)));
    out.set("passeur", premiers(somme(lignes, (e) => e.passes)));
    out.set("pepite", premiers(somme(lignes, entryPP)));
  }
  return out;
}

export const xpSujet = (sujet: string) => {
  const [genre, n] = lireSujet(sujet);
  if (n != null) return XP_MATCH[genre as GenreMatch] ?? 0;
  return genre === "buteur" ? XP_BUTEUR_DU_JOUR : genre === "passeur" ? XP_PASSEUR_DU_JOUR : XP_MEILLEUR_DU_JOUR;
};

/** Le prono retenu : posé avant le coup d'envoi, et jamais contre son propre camp. */
export function pronoRetenu(pronos: Prono[], p: JourneePronos, joueur: string, sujet: string): Prono | null {
  const x = pronos.find((r) => r.saison === p.saison && r.j === p.j && r.sujet === sujet && r.joueur === joueur);
  if (!x || new Date(x.le).getTime() > p.coupEnvoi.getTime()) return null;
  if (!permis(p, sujet, joueur, x.choix)) return null;
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
  // La règle du classement (rangs.ts) : journées jouées, masqués retirés.
  const joueurs = classables(standingsJusqua(s));
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
        ligne: { saison: numero, j, date: p.date, quoi: `Flair, ${b.justes} sur ${b.total}`, xp: Math.min(b.xp, plafondDe(p, joueur)) },
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

/* ---------------------------- Les meilleurs flairs ---------------------------- */

export interface RangFlair {
  joueur: string;
  justes: number;
  juges: number;
  xp: number;
  /** Les matchs où il a vu juste au moins une fois sur un sujet du match. */
  matchs: number;
}

/**
 * Le classement du Flair d'une saison (Sabri, 31/10 : « que ce soit visible
 * pour les joueurs ») : les choix justes, jugés journée finie, à égalité
 * l'XP, puis le moins de choix jugés (le plus juste).
 */
export function classementFlair(lue: SaisonLue, numero: number, close: boolean, pronos: Prono[], maintenant: Date, reference: Date): RangFlair[] {
  const miens = pronos.filter((x) => x.saison === numero && x.j !== J_SAISON);
  const par = new Map<string, RangFlair & { vus: Set<string> }>();
  for (const j of [...new Set(miens.map((x) => x.j))]) {
    const p = pronosDeJournee(lue, numero, j, reference);
    if (!p || !p.joue || (!close && maintenant.getTime() < p.finDuJour.getTime())) continue;
    const res = resultatsDeJournee(p, lue.entries);
    const xpJour = new Map<string, number>();
    for (const x of miens.filter((r) => r.j === j)) {
      const etat = etatDe(pronoRetenu(miens, p, x.joueur, x.sujet), res);
      if (etat === "attente") continue;
      let r = par.get(x.joueur);
      if (!r) par.set(x.joueur, (r = { joueur: x.joueur, justes: 0, juges: 0, xp: 0, matchs: 0, vus: new Set() }));
      r.juges++;
      if (etat !== "juste") continue;
      r.justes++;
      xpJour.set(x.joueur, (xpJour.get(x.joueur) ?? 0) + xpSujet(x.sujet));
      const [, n] = lireSujet(x.sujet);
      if (n != null) r.vus.add(`${j}:${n}`);
    }
    for (const [joueur, xp] of xpJour) par.get(joueur)!.xp += Math.min(xp, plafondDe(p, joueur));
  }
  return [...par.values()]
    .filter((r) => !isHidden(r.joueur))
    .map(({ vus, ...r }) => ({ ...r, matchs: vus.size }))
    .sort((a, b) => b.justes - a.justes || b.xp - a.xp || a.juges - b.juges || a.joueur.localeCompare(b.joueur));
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

/* ------------------------------ Mon Flair ------------------------------ */

// Le Flair d'un joueur, journée par journée (Sabri, 30/10 : « le flair doit
// apparaître dans Ma carte » ; « sur les récaps, il y ait le résultat du
// flair ») : ce qu'il a choisi, s'il a vu juste, l'XP. Les mêmes règles que
// lignesPronos : posé avant le coup d'envoi, plafond par journée, acquis à
// minuit (ou à la clôture).

export type PhaseFlair = "ouvert" | "en-jeu" | "fini";

export interface ChoixFlair {
  sujet: string;
  /** « Match 1 · Qui gagne », « Le MVP », « Le buteur du jour »… */
  titre: string;
  choix: string;
  etat: EtatProno | "hors-delai";
  /** Les bonnes réponses, une fois la feuille remplie. */
  bons: string[] | null;
  /** L'XP de ce choix s'il est juste (avant plafond). */
  xp: number;
}

export interface FlairDeJournee {
  saison: number;
  j: number;
  date: string;
  phase: PhaseFlair;
  choix: ChoixFlair[];
  justes: number;
  /** Les choix déjà jugés (justes ou ratés). */
  juges: number;
  /** L'XP de la journée, plafonnée ; acquise quand la phase est finie. */
  xp: number;
  /** Son plafond : celui de la feuille, ou de la tribune. */
  plafond: number;
}

/** L'ordre de lecture : chaque match, sujet par sujet, puis la journée. */
export function rangSujet(sujet: string): number {
  const [genre, n] = lireSujet(sujet);
  return n != null ? n * 10 + SUJETS_MATCH.indexOf(genre as GenreMatch) : 1000 + SUJETS_JOUR.indexOf(genre as (typeof SUJETS_JOUR)[number]);
}

export const TITRE_MATCH: Record<GenreMatch, string> = {
  match: "Qui gagne",
  ecart: "L'écart",
  duel: "Le duel",
  mvp: "Le MVP",
  buteur: "Le buteur",
  passeur: "Le passeur",
};
export const TITRE_JOUR: Record<(typeof SUJETS_JOUR)[number], string> = {
  pepite: "Le meilleur du jour",
  buteur: "Le buteur du jour",
  passeur: "Le passeur du jour",
};

/** Le titre d'un sujet, avec son match quand la journée en a plusieurs : « Match 2 · Le MVP ». */
export function titreSujet(p: Pick<JourneePronos, "matchs">, sujet: string): string | null {
  const [genre, n] = lireSujet(sujet);
  if (n == null) return TITRE_JOUR[genre as (typeof SUJETS_JOUR)[number]] ?? null;
  const m = p.matchs.find((x) => x.n === n);
  const t = TITRE_MATCH[genre as GenreMatch];
  if (!m || !t) return null;
  return p.matchs.length > 1 ? `${m.label} · ${t}` : t === "Qui gagne" ? "Le match" : t;
}

/** Mon Flair dans une saison, de la journée la plus récente à la plus ancienne. */
export function flairsDuJoueur(
  lue: SaisonLue,
  numero: number,
  close: boolean,
  pronos: Prono[],
  joueur: string,
  maintenant: Date,
  reference: Date
): FlairDeJournee[] {
  const miens = pronos.filter((x) => x.saison === numero && x.joueur === joueur && x.j !== J_SAISON);
  const js = [...new Set(miens.map((x) => x.j))].sort((a, b) => b - a);
  const out: FlairDeJournee[] = [];
  for (const j of js) {
    const p = pronosDeJournee(lue, numero, j, reference);
    if (!p) continue;
    const t = maintenant.getTime();
    const phase: PhaseFlair = close ? "fini" : t < p.coupEnvoi.getTime() ? "ouvert" : t < p.finDuJour.getTime() ? "en-jeu" : "fini";
    const res = p.joue ? resultatsDeJournee(p, lue.entries) : new Map<string, string[]>();
    const choix: ChoixFlair[] = miens
      .filter((x) => x.j === j)
      .sort((a, b) => rangSujet(a.sujet) - rangSujet(b.sujet))
      .flatMap((x) => {
        const titre = titreSujet(p, x.sujet);
        if (!titre) return [];
        const retenu = pronoRetenu(pronos, p, joueur, x.sujet);
        return [{ sujet: x.sujet, titre, choix: x.choix, etat: retenu ? etatDe(retenu, res) : "hors-delai", bons: res.get(x.sujet) ?? null, xp: xpSujet(x.sujet) }];
      });
    if (!choix.length) continue;
    const justes = choix.filter((c) => c.etat === "juste");
    out.push({
      saison: numero,
      j,
      date: p.date,
      phase,
      choix,
      justes: justes.length,
      juges: choix.filter((c) => c.etat === "juste" || c.etat === "faux").length,
      xp: Math.min(plafondDe(p, joueur), justes.reduce((a, c) => a + c.xp, 0)),
      plafond: plafondDe(p, joueur),
    });
  }
  return out;
}

export interface ChoixDeSaison {
  sujet: SujetSaison;
  titre: string;
  choix: string;
  /** La prime si c'est juste (selon l'heure du dernier changement). */
  prime: number;
  /** Jugé à la clôture : « attente » tant que la saison court. */
  etat: EtatProno;
}

/** Mes choix de saison (posés quand l'app les proposait encore) : jugés à la clôture. */
export function choixDeSaisonDu(lue: SaisonLue, numero: number, close: boolean, pronos: Prono[], joueur: string, reference: Date): ChoixDeSaison[] {
  const miens = pronos.filter((x) => x.saison === numero && x.joueur === joueur && x.j === J_SAISON);
  if (!miens.length) return [];
  const res = close ? resultatsDeSaison(lue as Saison) : null;
  return SUJETS_SAISON.flatMap((sujet) => {
    const x = miens.find((r) => r.sujet === sujet);
    if (!x) return [];
    const bons = res?.get(sujet);
    return [
      {
        sujet,
        titre: TITRE_SAISON[sujet],
        choix: x.choix,
        prime: primeAu(lue, numero, new Date(x.le), reference),
        etat: !bons ? "attente" : bons.includes(x.choix) ? "juste" : "faux",
      } satisfies ChoixDeSaison,
    ];
  });
}
