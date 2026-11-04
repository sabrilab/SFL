// Des lignes de la base à la carte d'entraîneur de Bola Team (lot B1,
// 03/11/2026 ; Ilyes, 02/11 : « une équipe = 7 joueurs + 1 entraîneur »,
// trois stats, rés, pré, coh, et la note lente). Le calcul lui-même est dans
// entraineur.ts ; ici, les faits gardés par la base deviennent ses entrées :
//   · le championnat, comme l'app le lit (lireChampionnat, equipes.ts) :
//     chaque rencontre, son état et si elle compte (MatchCompteTeam.compte),
//     saison par saison ; puis rencontreComptee la lit 24 h après la
//     fermeture de sa feuille, un litige jamais tranché avec la version de
//     l'adversaire ;
//   · les places de chaque entraîneur (equipe_entraineurs), dans l'ordre,
//     telles qu'elles sont vraiment (placesReelles : une place ouverte sans
//     sa ligne de membre n'en est pas une ; un préavis d'exclusion échu la
//     ferme à son heure) : une rencontre compte pour lui si son coup d'envoi
//     tombe pendant sa place, 7 jours après sa signature au moins ; sa
//     feuille et celle de l'adversaire (equipe_feuilles), avec la vraie
//     carte de chaque inscrit au coup d'envoi (carteAu ; une carte qui manque
//     rend la force inconnue), et ses joueurs du jour (l'effectif) ; le 5
//     contre 4 et le forfait (les présents, equipe_resultats ; l'annulation
//     à moins de 48 h, equipe_defis.forfait_de) ; sa saisie restée seule ;
//   · les joueurs de son équipe (jamais un entraîneur) : leur arrivée, la
//     première signature (equipe_signatures) ; leur départ et son motif
//     (equipe_departs ; une ligne d'avant le 03/11 sans motif se lit comme un
//     départ, ou comme la dissolution quand elle tombe à l'instant même où
//     l'équipe est dissoute ; un préavis d'exclusion échu que le ménage n'a
//     pas relevé, comme une exclusion à son heure) ; leur dernière feuille
//     d'avant lui ;
//   · son équipe avant lui (EquipeAvant) : ses 16 dernières rencontres
//     classées, et ses 120 derniers jours de joueurs actifs et de départs ;
//   · les normes de la ligue d'une saison finie (normesDeLaSaison), à figer
//     une fois pour toutes (entraineur_normes), dès que toutes ses rencontres
//     ont été lues.
//
// La note de carte au coup d'envoi (cartesDeLaLigue) : celle de la saison
// SFL de cet instant (la carte officielle d'après la dernière journée jouée
// avant ce jour-là, lib/sfl/saisie/evolution.ts) ; sinon sa carte de joueur
// Bola d'après ses matchs validés d'avant (carte-bola.ts) ; sinon pas de
// vraie carte (75 pour l'affichage, mais rés ne juge pas une feuille où il
// y en a une). Les cartes ne bougent jamais avec les matchs Team :
// l'attendu ne dépend pas des résultats de l'entraîneur.
//
// Les matchs arrangés se répètent : aRevoirDe signale à l'admin les
// victoires « contre bien plus fort » contre la même équipe, ou contre les
// mêmes joueurs sous un autre nom.
//
// Avant la mise en ligne des feuilles d'avant-match (la première déposée dans
// la ligue), on ne sait pas qui jouait : tout joueur compte actif. Module
// pur, sans base : le serveur lui passe ses lectures
// (entraineur-serveur.server.ts), tools/entraineur-faits-check.ts des lignes
// inventées.

import { bornesSaison, championnat, coupDEnvoiTeam, jourParis, saisonEnCours, type EquipeChampionnat, type MatchCompteTeam, type MatchTeam, type Presents, type SaisieTeam } from "@/lib/sfl/championnat-team";
import {
  activite,
  BAREME_ENTRAINEUR,
  DEPART_ENTRAINEUR,
  evoluerCarrieres,
  exposition,
  NORMES_DEPART,
  normesDe,
  numeroDuJour,
  rencontreComptee,
  valeurPresence,
  type CarriereEntraineur,
  type EquipeAvant,
  type EvolutionEntraineur,
  type Inscrit,
  type MembreEntraineur,
  type MotifDepart,
  type NormesLigue,
  type RencontreEntraineur,
  type StatsEntraineur,
} from "@/lib/sfl/entraineur";
import { enDirect, evolutionBrute, libelleMatch, type MatchValide } from "@/lib/sfl/carte-bola";
import { ovr } from "@/lib/sfl/engine";
import { compterMatchs, heureMin, type MatchBola } from "@/lib/sfl/ligue-vierge";
import { dateDeJournee } from "@/lib/sfl/saisie/brouillon";
import { evolutionDe, toStats } from "@/lib/sfl/saisie/engine";
import { officiellesAu, type Evolution } from "@/lib/sfl/saisie/evolution";
import { saisonDepuisArchive } from "@/lib/sfl/saisie/mutations";
import type { RosterEntry, Saison } from "@/lib/sfl/saisie/types";

type Role = "capitaine" | "vice" | "membre" | "entraineur";
type Motif = "depart" | "exclusion" | "dissolution";

/** Les lignes de la base que lit le calcul (les colonnes de supabase/schema.sql). */
export interface LignesEntraineur {
  equipes: { id: number; nom: string; created_at: string; dissoute_le: string | null }[];
  /** `depart_le` : la fin d'un préavis d'exclusion (48 h) ; passée, il est parti, même si le ménage ne l'a pas encore relevé. */
  membres: { equipe_id: number; joueur: string; statut: "invite" | "membre"; role: Role; signe_le: string | null; created_at: string; depart_le?: string | null }[];
  signatures: { equipe_id: number; joueur: string; le: string }[];
  departs: { equipe_id: number; joueur: string; parti_le: string; motif: Motif | null; role: Role | null }[];
  entraineurs: { equipe_id: number; joueur: string; debut: string; fin: string | null; motif: Motif | null }[];
  defis: { id: number; de: number; a: number; jour: string; heure: string; lieu: string; statut: "accepte" | "forfait"; forfait_de: number | null }[];
  resultats: { defi_id: number; equipe_id: number; pour: number; contre: number; saisi_le: string; presents: number | null; presents_adverses: number | null }[];
  feuilles: { defi_id: number; equipe_id: number; deposee_le: string }[];
  feuilleJoueurs: { defi_id: number; equipe_id: number; joueur: string }[];
  profils: { id: string; name: string }[];
}

/** Un joueur dont on cherche la carte : son identifiant (les matchs Bola) et son nom (la saison SFL). */
export interface JoueurCarte {
  id: string;
  nom: string;
}

/** La note de carte d'un joueur à un instant. */
export interface CartesDeLaLigue {
  /** Sa note ; 75 sans vraie carte. */
  noteAu(joueur: JoueurCarte, instant: Date): number;
  /** Sa vraie carte (SFL, sinon Bola) ; null sans : sa force est inconnue. */
  carteAu(joueur: JoueurCarte, instant: Date): number | null;
}

/* -------------------------- Les cartes de joueur -------------------------- */

const JOUR_MS = 86_400_000;
const memeNom = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const isoDuJour = (d: { y: number; m: number; d: number }) => new Date(Date.UTC(d.y, d.m, d.d)).toISOString().slice(0, 10);

interface SaisonDeCartes {
  /** Sa clôture (ms) ; la saison en cours : jamais. */
  fin: number;
  /** Ses journées et leur jour (AAAA-MM-JJ). */
  jours: { j: number; jour: string }[];
  roster: RosterEntry[];
  ev: Evolution;
}

/**
 * Les cartes de la ligue dans le temps : chaque saison SFL (les closes et
 * celle en cours, votes appliqués : saison-serveur.server.ts) avec
 * l'évolution de ses cartes, et les matchs Bola validés de chacun.
 * `entreesSfl` : l'entrée en SFL d'un joueur venu par un parrain (avant,
 * c'est sa carte Bola qui compte).
 */
export function cartesDeLaLigue(o: { saison: Saison | null; maintenant: Date; matchsBola: MatchBola[]; entreesSfl?: ReadonlyMap<string, string> }): CartesDeLaLigue {
  const saisons: SaisonDeCartes[] = [];
  const joursDe = (journees: Saison["journees"], reference: Date) =>
    journees.flatMap((m) => {
      const d = dateDeJournee(m.date ?? "", reference);
      return d ? [{ j: m.j, jour: isoDuJour(d) }] : [];
    });
  if (o.saison) {
    const archives = [...(o.saison.archives ?? [])].sort((a, b) => a.cloturee.localeCompare(b.cloturee));
    for (const a of archives) {
      const relue = saisonDepuisArchive(a);
      saisons.push({ fin: Date.parse(a.cloturee), jours: joursDe(a.journees, new Date(a.cloturee)), roster: a.roster, ev: evolutionDe(relue) });
    }
    saisons.push({ fin: Infinity, jours: joursDe(o.saison.journees, o.maintenant), roster: o.saison.roster, ev: evolutionDe(o.saison) });
  }

  // Les matchs Bola validés qui font bouger la carte de chacun (la règle de mes_matchs_bola : un filleul, avant son entrée en SFL).
  const bola = new Map<string, { coup: number; v: MatchValide }[]>();
  for (const m of compterMatchs(o.matchsBola)) {
    if (!m.valide) continue;
    const min = heureMin(m.heure);
    const coup = coupDEnvoiTeam({ jour: m.jour, heure: `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}` }).getTime();
    for (const ligne of m.joueurs) {
      if (!ligne.carteBola) continue;
      const l = bola.get(ligne.id) ?? [];
      l.push({ coup, v: { m, ligne, libelle: libelleMatch(m) } });
      bola.set(ligne.id, l);
    }
  }
  for (const l of bola.values()) l.sort((a, b) => a.coup - b.coup);
  const memo = new Map<string, number>();

  const noteSfl = (j: JoueurCarte, t: number): number | null => {
    const entree = o.entreesSfl?.get(j.id);
    if (entree && t < Date.parse(entree)) return null;
    const s = saisons.find((x) => x.fin >= t);
    if (!s) return null;
    const r = s.roster.find((x) => memeNom(x.name, j.nom));
    if (!r) return null;
    // La carte officielle d'après la dernière journée jouée avant ce jour-là (une journée du même jour n'y est pas encore).
    const jour = jourParis(new Date(t));
    const jMax = s.jours.filter((x) => x.jour < jour).reduce((m, x) => Math.max(m, x.j), 0);
    const ev = s.ev.joueurs.get(r.name);
    return ovr(ev ? (officiellesAu(ev, jMax + 1) ?? ev.depart) : toStats(r.base));
  };
  const noteBola = (j: JoueurCarte, t: number): number | null => {
    const l = bola.get(j.id);
    if (!l) return null;
    let k = 0;
    while (k < l.length && l[k].coup < t) k++;
    if (k === 0) return null;
    const cle = `${j.id}:${k}`;
    const deja = memo.get(cle);
    if (deja != null) return deja;
    const ev = evolutionBrute(
      l.slice(0, k).map((x) => x.v),
      l[0].v.ligne.name
    );
    const n = ev ? ovr(enDirect(ev)) : DEPART_ENTRAINEUR;
    memo.set(cle, n);
    return n;
  };
  const carteAu = (j: JoueurCarte, instant: Date) => {
    const t = instant.getTime();
    return noteSfl(j, t) ?? noteBola(j, t);
  };
  return { carteAu, noteAu: (j, instant) => carteAu(j, instant) ?? DEPART_ENTRAINEUR };
}

/* ---------------------------- Le championnat ---------------------------- */

const presentsDe = (p: number | null): Presents | undefined => (p === 3 || p === 4 || p === 5 ? p : undefined);

/**
 * Le championnat tel que l'app le lit (lireChampionnat, equipes.ts) : les
 * équipes (dissoutes comprises ; active à 5 joueurs, l'entraîneur ne compte
 * pas) et les matchs programmés ou forfaits, avec leurs saisies.
 */
export function championnatDesLignes(l: Pick<LignesEntraineur, "equipes" | "membres" | "defis" | "resultats">): { equipes: EquipeChampionnat[]; matchs: MatchTeam[] } {
  const joueurs = new Map<number, number>();
  for (const m of l.membres) if (m.statut === "membre" && m.role !== "entraineur") joueurs.set(m.equipe_id, (joueurs.get(m.equipe_id) ?? 0) + 1);
  const equipes = l.equipes.map(
    (e): EquipeChampionnat => ({ id: e.id, nom: e.nom, creeLe: e.created_at, active: !e.dissoute_le && (joueurs.get(e.id) ?? 0) >= 5 })
  );
  const saisies = new Map<number, SaisieTeam[]>();
  for (const r of l.resultats) {
    const p = presentsDe(r.presents);
    const pa = presentsDe(r.presents_adverses);
    const s: SaisieTeam = { equipe: r.equipe_id, pour: r.pour, contre: r.contre, le: r.saisi_le, ...(p ? { presents: p } : {}), ...(pa ? { presentsAdverses: pa } : {}) };
    saisies.set(r.defi_id, [...(saisies.get(r.defi_id) ?? []), s]);
  }
  const matchs = l.defis.map(
    (d): MatchTeam => ({
      id: d.id,
      de: d.de,
      a: d.a,
      jour: d.jour,
      heure: d.heure.slice(0, 5),
      lieu: d.lieu,
      statut: d.statut,
      forfaitDe: d.forfait_de,
      saisies: saisies.get(d.id) ?? [],
      buteurs: [],
    })
  );
  return { equipes, matchs };
}

/** Chaque match vu du championnat de sa saison (son état, s'il compte), de la première saison à celle en cours. */
export function matchsComptes(equipes: EquipeChampionnat[], matchs: MatchTeam[], maintenant: Date): Map<number, MatchCompteTeam> {
  const out = new Map<number, MatchCompteTeam>();
  const derniere = Math.max(saisonEnCours(maintenant), ...matchs.map((m) => saisonEnCours(coupDEnvoiTeam(m))));
  for (let s = 1; s <= derniere; s++) for (const mc of championnat(s, equipes, matchs, maintenant).matchs) out.set(mc.m.id, mc);
  return out;
}

/* ------------------------------- Les faits ------------------------------- */

/** Une rencontre qui compte pour une équipe, telle que la carte la lit (sans les feuilles). */
interface RencontreLue {
  defi: number;
  coup: number;
  jour: string;
  saison: number;
  adversaire: number;
  forfait: boolean;
  pour: number;
  contre: number;
  cinqContreQuatre: "nous" | "eux" | null;
  saisieSeule: boolean;
  /** Un litige jamais tranché, lu avec la version de l'adversaire. */
  litige: boolean;
}

/** Ce que le calcul tire une fois des lignes : de quoi construire chaque place. */
export interface FaitsDeLaLigue {
  maintenant: Date;
  /** Par équipe, ses rencontres qui comptent, dans l'ordre du coup d'envoi. */
  rencontres: Map<number, RencontreLue[]>;
  /** Les feuilles : par match et par équipe, les joueurs inscrits. */
  feuilles: Map<string, string[]>;
  /** Par équipe, ses joueurs (jamais un entraîneur). */
  joueurs: Map<number, MembreEntraineur[]>;
  /** Par équipe et par joueur, les jours de ses feuilles (rencontres qui comptent). */
  joursDeFeuille: Map<number, Map<string, number[]>>;
  /** Le premier jour des feuilles dans la ligue (AAAA-MM-JJ). */
  feuillesDepuis: string;
  noms: Map<number, string>;
  profils: Map<string, string>;
}

const cleFeuille = (defi: number, equipe: number) => `${defi}:${equipe}`;
const jourDe = (iso: string) => jourParis(new Date(iso));

/** Les membres dont le préavis d'exclusion est échu (depart_le passé), que le ménage les ait relevés ou non. */
function exclusionsEchues(l: Pick<LignesEntraineur, "membres">, maintenant: Date) {
  return l.membres.flatMap((m) =>
    m.statut === "membre" && m.depart_le && Date.parse(m.depart_le) <= maintenant.getTime() ? [{ ...m, depart_le: m.depart_le }] : []
  );
}

/** Le motif d'un départ ; une ligne d'avant le 03/11 n'en a pas : la dissolution si elle tombe avec elle, sinon un départ. */
function motifDe(d: LignesEntraineur["departs"][number], dissouteLe: string | null): MotifDepart {
  if (d.motif) return d.motif;
  return dissouteLe && Date.parse(d.parti_le) === Date.parse(dissouteLe) ? "dissolution" : "depart";
}

/** Tout ce que le calcul lit, une fois : les rencontres qui comptent pour chaque équipe, ses joueurs, ses feuilles. */
export function faitsDeLaLigue(l: LignesEntraineur, maintenant: Date): FaitsDeLaLigue {
  const { equipes, matchs } = championnatDesLignes(l);
  const comptes = matchsComptes(equipes, matchs, maintenant);
  const noms = new Map(l.equipes.map((e) => [e.id, e.nom]));
  const profils = new Map(l.profils.map((p) => [p.id, p.name]));

  const rencontres = new Map<number, RencontreLue[]>();
  for (const mc of comptes.values()) {
    for (const e of [mc.m.de, mc.m.a]) {
      // Validée et classée ; ou un litige jamais tranché, lu avec la version de l'adversaire (rencontreComptee).
      const r = rencontreComptee(mc, e, maintenant);
      if (!r) continue;
      const lue: RencontreLue = {
        defi: mc.m.id,
        coup: coupDEnvoiTeam(mc.m).getTime(),
        jour: mc.m.jour,
        saison: mc.saison,
        adversaire: e === mc.m.de ? mc.m.a : mc.m.de,
        forfait: r.forfait,
        pour: r.pour,
        contre: r.contre,
        cinqContreQuatre: r.aQuatre,
        saisieSeule: r.saisieSeule,
        litige: r.litige,
      };
      rencontres.set(e, [...(rencontres.get(e) ?? []), lue]);
    }
  }
  for (const t of rencontres.values()) t.sort((a, b) => a.coup - b.coup || a.defi - b.defi);

  const feuilles = new Map<string, string[]>();
  for (const f of l.feuilles) feuilles.set(cleFeuille(f.defi_id, f.equipe_id), []);
  for (const j of l.feuilleJoueurs) feuilles.get(cleFeuille(j.defi_id, j.equipe_id))?.push(j.joueur);
  const premiere = l.feuilles.reduce<string | null>((m, f) => (m == null || f.deposee_le < m ? f.deposee_le : m), null);
  const feuillesDepuis = premiere ? jourDe(premiere) : jourParis(maintenant);

  // Les jours de feuille de chaque joueur, par équipe : seulement les rencontres qui comptent pour elle.
  const joursDeFeuille = new Map<number, Map<string, number[]>>();
  for (const [e, t] of rencontres) {
    const parJoueur = new Map<string, number[]>();
    for (const r of t)
      for (const j of feuilles.get(cleFeuille(r.defi, e)) ?? []) parJoueur.set(j, [...(parJoueur.get(j) ?? []), numeroDuJour(r.jour)]);
    joursDeFeuille.set(e, parJoueur);
  }

  // Les joueurs de chaque équipe : l'arrivée (la première signature), le départ et son motif ; jamais un entraîneur.
  const dissoute = new Map(l.equipes.map((e) => [e.id, e.dissoute_le]));
  const entraineurs = new Set(l.entraineurs.map((x) => `${x.equipe_id}:${x.joueur}`));
  for (const m of l.membres) if (m.role === "entraineur") entraineurs.add(`${m.equipe_id}:${m.joueur}`);
  const arrivees = new Map<string, string>();
  for (const s of l.signatures) {
    const k = `${s.equipe_id}:${s.joueur}`;
    const deja = arrivees.get(k);
    if (!deja || s.le < deja) arrivees.set(k, s.le);
  }
  for (const m of l.membres) {
    const k = `${m.equipe_id}:${m.joueur}`;
    if (m.statut === "membre" && !arrivees.has(k)) arrivees.set(k, m.signe_le ?? m.created_at);
  }
  const departs = new Map(l.departs.map((d) => [`${d.equipe_id}:${d.joueur}`, d]));
  // Un préavis d'exclusion échu que le ménage n'a pas encore relevé : il est parti à son heure (equipe_menage le
  // datera de même), exclu.
  for (const m of exclusionsEchues(l, maintenant)) {
    const k = `${m.equipe_id}:${m.joueur}`;
    if (!departs.has(k)) departs.set(k, { equipe_id: m.equipe_id, joueur: m.joueur, parti_le: m.depart_le, motif: "exclusion", role: m.role });
  }
  const joueurs = new Map<number, MembreEntraineur[]>();
  for (const [k, arrivee] of arrivees) {
    if (entraineurs.has(k)) continue;
    const d = departs.get(k);
    if (d?.role === "entraineur") continue;
    const [e, id] = [Number(k.slice(0, k.indexOf(":"))), k.slice(k.indexOf(":") + 1)];
    const m: MembreEntraineur = {
      id,
      nom: profils.get(id) ?? "?",
      arrivee: jourDe(arrivee),
      ...(d ? { depart: { le: jourDe(d.parti_le), motif: motifDe(d, dissoute.get(e) ?? null) } } : {}),
    };
    joueurs.set(e, [...(joueurs.get(e) ?? []), m]);
  }
  for (const t of joueurs.values()) t.sort((a, b) => a.arrivee.localeCompare(b.arrivee) || a.id.localeCompare(b.id));

  return { maintenant, rencontres, feuilles, joueurs, joursDeFeuille, feuillesDepuis, noms, profils };
}

/** Le dernier jour de feuille d'un joueur pour son équipe avant un jour donné. */
function derniereFeuilleAvant(f: FaitsDeLaLigue, e: number, joueur: string, avant: number): string | undefined {
  const t = (f.joursDeFeuille.get(e)?.get(joueur) ?? []).filter((j) => j < avant);
  return t.length ? new Date(Math.max(...t) * JOUR_MS).toISOString().slice(0, 10) : undefined;
}

/** L'activité des joueurs d'une équipe (coh), la même règle que la carte (entraineur.ts, activite). */
function activiteDe(f: FaitsDeLaLigue, e: number) {
  return activite(f.joueurs.get(e) ?? [], f.joursDeFeuille.get(e) ?? new Map(), numeroDuJour(f.feuillesDepuis));
}

/**
 * Son équipe avant lui, à sa signature (`debut`, un instant ISO) : ses 16
 * dernières rencontres qui comptent (ce qu'elles valaient en pré), et ses 120
 * derniers jours de joueurs actifs et de départs. Rien avant : la moyenne de
 * la ligue (zéros).
 */
export function equipeAvantDe(f: FaitsDeLaLigue, e: number, debut: string): EquipeAvant {
  const D = numeroDuJour(jourDe(debut));
  const avant = (f.rencontres.get(e) ?? []).filter((r) => r.coup < Date.parse(debut)).slice(-BAREME_ENTRAINEUR.poidsLigue.rencontres);
  const presence = avant.length ? avant.reduce((s, r) => s + valeurPresence(r).valeur, 0) / avant.length : 0;
  const { jours, partis } = exposition(f.joueurs.get(e) ?? [], activiteDe(f, e), D - 120, D);
  return { rencontres: avant.length, presence, joursActifs: jours, departs: partis.length };
}

/**
 * Les normes d'une saison finie : ce que vaut une rencontre en pré, en
 * moyenne, de chaque côté de chaque rencontre qui compte ; et les départs par
 * jour-joueur actif, toutes équipes réunies. null sans rien à mesurer : la
 * saison garde alors celles d'avant (normesDe).
 */
export function normesDeLaSaison(f: FaitsDeLaLigue, saison: number): Partial<NormesLigue> {
  const { debut, finExclue } = bornesSaison(saison);
  let n = 0;
  let somme = 0;
  for (const t of f.rencontres.values())
    for (const r of t)
      if (r.saison === saison) {
        n += 1;
        somme += valeurPresence(r).valeur;
      }
  let jours = 0;
  let partis = 0;
  for (const e of f.joueurs.keys()) {
    const x = exposition(f.joueurs.get(e)!, activiteDe(f, e), numeroDuJour(debut), numeroDuJour(finExclue));
    jours += x.jours;
    partis += x.partis.length;
  }
  return { ...(n > 0 ? { presence: somme / n } : {}), ...(jours > 0 ? { departsParJour: partis / jours } : {}) };
}

/** Une saison finie se fige quand toutes ses rencontres ont été lues : 5 jours après son dernier jour (fermeture à 3 jours, lecture 24 h après). */
export const NORMES_APRES_JOURS = 5;
export function normesFigeables(saison: number, maintenant: Date): boolean {
  const { finExclue } = bornesSaison(saison);
  return jourParis(maintenant) >= new Date(Date.parse(finExclue) + (NORMES_APRES_JOURS - 1) * JOUR_MS).toISOString().slice(0, 10);
}

/**
 * Une place d'entraîneur (equipe_entraineurs), telle que la carte la rejoue :
 * ses rencontres à partir de 7 jours après sa signature (la qualification),
 * jusqu'à la fin de sa place. La force de chaque côté vient des feuilles, et
 * de son côté jamais moins que celle de ses cinq meilleurs joueurs au coup
 * d'envoi (l'effectif) ; dès qu'un inscrit de l'une des deux feuilles n'a
 * pas de vraie carte, sa force est inconnue et rés saute la rencontre (des
 * comptes neufs à 75 ne font plus passer une équipe forte pour moyenne).
 */
export function carriereDe(f: FaitsDeLaLigue, place: LignesEntraineur["entraineurs"][number], cartes: CartesDeLaLigue): CarriereEntraineur {
  const e = place.equipe_id;
  const debut = Date.parse(place.debut);
  const qualifie = debut + BAREME_ENTRAINEUR.qualificationJours * JOUR_MS;
  const fin = place.fin ? Date.parse(place.fin) : Infinity;
  const arrivee = jourDe(place.debut);
  const D = numeroDuJour(arrivee);
  const carteDe = (id: string, coup: number) => cartes.carteAu({ id, nom: f.profils.get(id) ?? "" }, new Date(coup));
  const inscrits = (defi: number, equipe: number, coup: number): { inscrits: Inscrit[]; inconnus: number } | null => {
    const ids = f.feuilles.get(cleFeuille(defi, equipe));
    if (!ids) return null;
    const notes = ids.map((id) => ({ id, carte: carteDe(id, coup) }));
    return { inscrits: notes.map((x) => ({ id: x.id, note: x.carte ?? DEPART_ENTRAINEUR })), inconnus: notes.filter((x) => x.carte == null).length };
  };
  // Ses joueurs au coup d'envoi (jamais un entraîneur), avec leur vraie carte.
  const effectifAu = (coup: number) => {
    const j = numeroDuJour(jourParis(new Date(coup)));
    return (f.joueurs.get(e) ?? [])
      .filter((m) => numeroDuJour(m.arrivee) <= j && (!m.depart || numeroDuJour(m.depart.le) > j))
      .flatMap((m) => {
        const n = carteDe(m.id, coup);
        return n == null ? [] : [n];
      });
  };
  const rencontres: RencontreEntraineur[] = (f.rencontres.get(e) ?? [])
    .filter((r) => r.coup >= qualifie && r.coup < fin)
    .map((r) => {
      const feuille = inscrits(r.defi, e, r.coup);
      const adverses = inscrits(r.defi, r.adversaire, r.coup);
      const effectif = feuille ? effectifAu(r.coup) : [];
      return {
        id: String(r.defi),
        le: r.jour,
        saison: r.saison,
        adversaire: r.adversaire,
        adversaireNom: f.noms.get(r.adversaire),
        forfait: r.forfait,
        pour: r.pour,
        contre: r.contre,
        cinqContreQuatre: r.cinqContreQuatre,
        // Sans les deux feuilles, la force d'un côté manque : rés saute la rencontre (pré et coh la comptent).
        feuille: feuille?.inscrits ?? [],
        adverses: feuille && adverses ? adverses.inscrits.map((i) => i.note) : [],
        ...(effectif.length ? { effectif } : {}),
        ...((feuille?.inconnus ?? 0) + (adverses?.inconnus ?? 0) > 0 ? { cartesInconnues: true } : {}),
        ...(r.saisieSeule ? { saisieSeule: true } : {}),
        ...(r.litige ? { litige: true } : {}),
      };
    });
  const finJour = place.fin ? numeroDuJour(jourDe(place.fin)) : numeroDuJour(jourParis(f.maintenant)) + 1;
  const membres = (f.joueurs.get(e) ?? [])
    .filter((m) => numeroDuJour(m.arrivee) < finJour && (!m.depart || numeroDuJour(m.depart.le) >= D))
    .map((m) => {
      const derniere = derniereFeuilleAvant(f, e, m.id, D);
      return derniere ? { ...m, derniereFeuille: derniere } : m;
    });
  return {
    arrivee,
    ...(place.fin ? { fin: jourDe(place.fin) } : {}),
    rencontres,
    membres,
    equipeAvant: equipeAvantDe(f, e, place.debut),
    feuillesDepuis: f.feuillesDepuis,
  };
}

/* -------------------------------- Le tout -------------------------------- */

/** Ce que le serveur garde d'une carte (entraineur_cartes). */
export interface CarteCalculee {
  joueur: string;
  /** Son équipe : celle qu'il entraîne, sinon la dernière. */
  equipe: number;
  stats: StatsEntraineur;
  ev: EvolutionEntraineur;
  /** À revoir par la modération (aRevoirDe). */
  aRevoir: ARevoir[];
}

/** Des victoires « contre bien plus fort » qui se répètent : la modération les revoit (des matchs arrangés). */
export interface ARevoir {
  entraineur: string;
  /** Les rencontres en cause (les ids des défis). */
  rencontres: number[];
  /** « equipe » : deux fois ou plus contre la même équipe ; « joueurs » : contre trois mêmes joueurs ou plus, sous deux noms d'équipe (une équipe refaite). */
  motif: "equipe" | "joueurs";
}

/**
 * Les matchs arrangés se répètent (contrôle du 03/11/2026) : ses victoires
 * « contre bien plus fort » (l'attendu de 0,30 ou moins), deux fois ou plus
 * contre la même équipe, ou contre trois mêmes joueurs sous deux noms
 * d'équipe. Rien ne change sur sa carte : c'est pour l'admin, qui les lit
 * dans le bilan du calcul (/api/entraineurs/calcul).
 */
export function aRevoirDe(f: FaitsDeLaLigue, entraineur: string, equipes: readonly number[], exploits: readonly string[]): ARevoir[] {
  const lus = exploits.flatMap((id) => {
    const defi = Number(id);
    for (const e of equipes) {
      const r = f.rencontres.get(e)?.find((x) => x.defi === defi);
      if (r) return [{ defi, adversaire: r.adversaire, joueurs: new Set(f.feuilles.get(cleFeuille(defi, r.adversaire)) ?? []) }];
    }
    return [];
  });
  const out: ARevoir[] = [];
  const parEquipe = new Map<number, number[]>();
  for (const x of lus) parEquipe.set(x.adversaire, [...(parEquipe.get(x.adversaire) ?? []), x.defi]);
  for (const d of parEquipe.values()) if (d.length >= 2) out.push({ entraineur, rencontres: d, motif: "equipe" });
  for (let i = 0; i < lus.length; i++)
    for (let j = i + 1; j < lus.length; j++) {
      if (lus[i].adversaire === lus[j].adversaire) continue;
      let communs = 0;
      for (const p of lus[i].joueurs) if (lus[j].joueurs.has(p)) communs++;
      if (communs >= 3) out.push({ entraineur, rencontres: [lus[i].defi, lus[j].defi], motif: "joueurs" });
    }
  return out;
}

/** Le journal gardé en base : les 120 derniers faits. */
export const JOURNAL_GARDE = 120;

/**
 * Les places d'entraîneur telles qu'elles sont vraiment (contrôle du
 * 03/11/2026) : une place ouverte sans la ligne de membre (entraîneur) qui va
 * avec n'en est pas une (une signature concurrente l'avait laissée) ; un
 * préavis d'exclusion échu la ferme à son heure, même avant que le ménage
 * ne le relève.
 */
export function placesReelles(l: Pick<LignesEntraineur, "entraineurs" | "membres">, maintenant: Date): LignesEntraineur["entraineurs"] {
  const lignes = new Map(l.membres.filter((m) => m.statut === "membre" && m.role === "entraineur").map((m) => [`${m.equipe_id}:${m.joueur}`, m]));
  return l.entraineurs.flatMap((p) => {
    if (p.fin) return [p];
    const m = lignes.get(`${p.equipe_id}:${p.joueur}`);
    if (!m) return [];
    if (m.depart_le && Date.parse(m.depart_le) <= maintenant.getTime()) return [{ ...p, fin: m.depart_le, motif: "exclusion" as const }];
    return [p];
  });
}

/**
 * Toutes les cartes d'entraîneur, et les normes à figer : les normes d'abord
 * (une saison finie, lue en entier, pas encore figée), qui servent aussitôt
 * au calcul. `planchers` : les cartes gardées en base (rien ne descend).
 */
export function cartesEntraineurs(
  l: LignesEntraineur,
  o: { cartes: CartesDeLaLigue; normes: Partial<Record<number, NormesLigue>>; planchers: ReadonlyMap<string, StatsEntraineur>; maintenant: Date }
): { cartes: CarteCalculee[]; normes: { saison: number; normes: NormesLigue }[] } {
  const f = faitsDeLaLigue(l, o.maintenant);
  const normes: Partial<Record<number, NormesLigue>> = { ...o.normes };
  const aFiger: { saison: number; normes: NormesLigue }[] = [];
  for (let s = 1; s < saisonEnCours(o.maintenant); s++) {
    if (normes[s] || !normesFigeables(s, o.maintenant)) continue;
    const mesurees = normesDeLaSaison(f, s);
    const avant = normesDe(normes, s - 1);
    const n: NormesLigue = { presence: mesurees.presence ?? avant.presence, departsParJour: mesurees.departsParJour ?? avant.departsParJour };
    normes[s] = n;
    aFiger.push({ saison: s, normes: n });
  }
  const parEntraineur = new Map<string, LignesEntraineur["entraineurs"]>();
  for (const p of placesReelles(l, o.maintenant)) parEntraineur.set(p.joueur, [...(parEntraineur.get(p.joueur) ?? []), p]);
  const cartes: CarteCalculee[] = [];
  for (const [joueur, places] of parEntraineur) {
    const ordre = [...places].sort((a, b) => a.debut.localeCompare(b.debut));
    const carrieres = ordre.map((p) => carriereDe(f, p, o.cartes));
    const ev = evoluerCarrieres(carrieres, { normes, plancher: o.planchers.get(joueur) });
    const ouverte = ordre.find((p) => !p.fin);
    const aRevoir = aRevoirDe(f, joueur, ordre.map((p) => p.equipe_id), ev.exploits);
    cartes.push({ joueur, equipe: (ouverte ?? ordre[ordre.length - 1]).equipe_id, stats: ev.officielles, ev, aRevoir });
  }
  return { cartes, normes: aFiger };
}

/** Les normes de départ, pour ce qui n'a rien de mieux (NORMES_DEPART d'entraineur.ts). */
export { NORMES_DEPART };
