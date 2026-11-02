// Les données de banc des XP S (tools/xp-s-check.ts, 02/11/2026) : la saison
// 0 du dépôt (seedSaison) archivée, close le 31 août, puis la saison de démo
// d'Ilyes (tools/xp-demo.ts, six dimanches, numéro 1) en cours ; des missions
// acceptées à temps et un Flair rempli sans réfléchir (le favori des
// journées d'avant, « large » partout), dont des choix sur soi et des Flairs
// de saison posés tôt ou tard. Des données de test, jamais en base.
import { missionsDeJournee, type Reponse } from "../src/lib/sfl/missions";
import { J_SAISON, pronosDeJournee, type Prono } from "../src/lib/sfl/pronos";
import { entryPP } from "../src/lib/sfl/saisie/engine";
import { journeeJouee } from "../src/lib/sfl/saisie/mutations";
import { seedSaison } from "../src/lib/sfl/saisie/store";
import type { MatchEntry, Saison, SaisonArchivee } from "../src/lib/sfl/saisie/types";
import type { EntreesXp } from "../src/lib/sfl/xp-calcul";
import { reponsesDemoXp, saisonDemoXp } from "./xp-demo";

/** L'instant du banc : le soir du 1er novembre 2026 (la démo place ses dimanches avant). */
export const MAINTENANT = new Date("2026-11-01T18:00:00+01:00");
export const CLOTURE_S0 = "2026-08-31T12:00:00.000Z";

/** Ceux qui remplissent le Flair : des joueurs de la feuille et un spectateur (Wadie joue peu). */
export const PARIEURS = ["Ilyes", "Kader", "Ilies", "Wadie", "Smail", "Zakary"];

const joue = (e: MatchEntry) => e.statut === "Présent" && !e.extraTime;

/** La saison 0 du dépôt, archivée. */
export function archiveS0(): SaisonArchivee {
  const s = seedSaison();
  return { numero: 0, nom: "Saison 0", cloturee: CLOTURE_S0, journees: s.journees, roster: s.roster, entries: s.entries, ...(s.events?.length ? { events: s.events } : {}) };
}

/** La ligue du banc : S0 archivée, la démo en cours. */
export function ligueDuBanc(): Saison {
  const demo = saisonDemoXp(MAINTENANT.getTime(), "xp");
  return { ...demo, archives: [archiveS0()] };
}

/** Tout le monde accepte ses missions une heure avant le coup d'envoi, sur toute la saison 0. */
export function reponsesS0(s0: SaisonArchivee, qui?: ReadonlySet<string>): Reponse[] {
  const ref = new Date(s0.cloturee);
  const out: Reponse[] = [];
  const passe: MatchEntry[] = [];
  for (const m of s0.journees) {
    const d = missionsDeJournee(s0, 0, m.j, ref, passe);
    if (!d) continue;
    const le = new Date(d.coupEnvoi.getTime() - 3600_000).toISOString();
    for (const [joueur, liste] of d.missions) {
      if (qui && !qui.has(joueur)) continue;
      for (const mi of liste) out.push({ saison: 0, j: m.j, mission: mi.creneau, joueur, reponse: "acceptee", cible: mi.creneau === "contrat" ? (mi.cibles[0] ?? null) : null, le });
    }
  }
  return out;
}

/** Le Flair rempli sans réfléchir sur une saison : le favori des journées d'avant, « large » partout. */
export function flairParesseux(s: Pick<Saison, "journees" | "entries" | "roster"> & Partial<Saison>, numero: number, ref: Date, parieurs: readonly string[]): Prono[] {
  const out: Prono[] = [];
  for (const m of s.journees) {
    if (!journeeJouee(s as Saison, m.j)) continue;
    const p = pronosDeJournee(s, numero, m.j, ref);
    if (!p) continue;
    const le = new Date(p.coupEnvoi.getTime() - 3600_000).toISOString();
    const avant = s.entries.filter((e) => e.j < m.j && joue(e));
    const moy = (n: string, f: (e: MatchEntry) => number) => {
      const l = avant.filter((e) => e.player === n);
      return l.length ? l.reduce((a, e) => a + f(e), 0) / l.length : 0;
    };
    const fav = (noms: readonly string[], f: (e: MatchEntry) => number) => [...noms].sort((a, b) => moy(b, f) - moy(a, f) || a.localeCompare(b))[0];
    for (const joueur of parieurs) {
      const pose = (sujet: string, choix: string | undefined) => choix && out.push({ saison: numero, j: m.j, sujet, joueur, choix, le });
      for (const mt of p.matchs) {
        const tous = [...mt.noirs, ...mt.blancs];
        const camp = p.camps.get(joueur);
        pose(`match:${mt.n}`, camp && camp.terrain === mt.n ? camp.equipe : "noirs");
        pose(`mvp:${mt.n}`, fav(tous, entryPP));
        pose(`buteur:${mt.n}`, fav(tous, (e) => e.buts));
        pose(`passeur:${mt.n}`, fav(tous, (e) => e.passes));
        pose(`ecart:${mt.n}`, "large");
        if (mt.duel) pose(`duel:${mt.n}`, mt.duel.includes(joueur) ? joueur : fav(mt.duel, entryPP));
      }
      pose("buteur", fav(p.joueurs, (e) => e.buts));
      pose("passeur", fav(p.joueurs, (e) => e.passes));
      pose("pepite", fav(p.joueurs, entryPP));
    }
  }
  return out;
}

/**
 * Les Flairs de saison de la saison 0 (jugés à sa clôture), selon les coups
 * d'envoi déjà passés (primeAu : la J2 de la saison 0 n'a pas d'équipes, elle
 * n'en a pas) : avant le premier (prime 300), après le deuxième (220), après
 * le troisième (180), et sur soi.
 */
export function flairsDeSaisonS0(s0: SaisonArchivee): Prono[] {
  const ref = new Date(s0.cloturee);
  const coups = s0.journees
    .filter((m) => journeeJouee(s0, m.j))
    .flatMap((m) => pronosDeJournee(s0, 0, m.j, ref)?.coupEnvoi.getTime() ?? [])
    .sort((a, b) => a - b);
  const iso = (t: number) => new Date(t).toISOString();
  return [
    { saison: 0, j: J_SAISON, sujet: "buteur", joueur: "Kader", choix: "Ilyes", le: iso(coups[0] - 86400_000) },
    { saison: 0, j: J_SAISON, sujet: "pepite", joueur: "Kader", choix: "Ilyes", le: iso(coups[1] + 3600_000) },
    { saison: 0, j: J_SAISON, sujet: "buteur", joueur: "Ilies", choix: "Ilyes", le: iso(coups[2] + 3600_000) },
    { saison: 0, j: J_SAISON, sujet: "buteur", joueur: "Ilyes", choix: "Ilyes", le: iso(coups[0] - 86400_000) },
    { saison: 0, j: J_SAISON, sujet: "pepite", joueur: "Smail", choix: "Ilyes", le: iso(coups[0] - 86400_000) },
  ];
}

/** Les entrées du calcul (xp-calcul.ts) sur la ligue du banc : celles du serveur et du téléphone. */
export function entreesDuBanc(): EntreesXp {
  const jugee = ligueDuBanc();
  const s0 = jugee.archives![0];
  const reponses = [...reponsesS0(s0), ...reponsesDemoXp(jugee, "xp")];
  const pronos = [...flairParesseux(s0, 0, new Date(s0.cloturee), PARIEURS), ...flairsDeSaisonS0(s0), ...flairParesseux(jugee, 1, MAINTENANT, PARIEURS)];
  return { jugee, reponses, votes: [], felicitations: [], pronos, ligueRecrues: [], moi: null, bolaCarte: null, maintenant: MAINTENANT };
}
