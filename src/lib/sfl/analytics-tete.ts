// La tête d'Analytics (refonte de l'admin, 24/11/2026, maquette v3 validée
// le 24/11) : ce que l'admin veut voir en premier (« les gens qui se sont
// connectés dans la journée, un graphique des connexions par jour sur sept
// jours, les emails récoltés, les nouveaux inscrits »), le reste dessous.
//
// Toujours sur les joueurs seuls, quel que soit le public choisi plus bas :
// les admins (profiles.is_admin, Sabri, Ilyes) ouvrent l'app bien plus que
// les autres. « Connecté » : au moins une trace dans le journal ce jour-là,
// n'importe laquelle (comme « Joueurs actifs par jour », retention.ts).
// Les jours sont ceux de l'appareil de l'admin, comme partout dans Analytics.
//
// La moyenne des connectés laisse de côté le jour en cours, encore partiel :
// sinon elle baisserait chaque matin.
// Les mails comptent tous les comptes (admins et comptes d'essai compris) :
// c'est la liste qu'on copie pour écrire à la ligue.
//
// Pur : ni React, ni navigateur (tools/admin-refonte-check.ts).

import { DAY, debutJour, type Evenement, type Profil } from "./retention";

export interface JourConnectes {
  /** Minuit du jour (ms). */
  t: number;
  n: number;
}

export interface TeteAnalytics {
  /** Les joueurs vus aujourd'hui, du plus récent au plus ancien. */
  aujourdhui: string[];
  /** Les `jours` derniers jours, aujourd'hui compris en dernier. */
  parJour: JourConnectes[];
  /** La moyenne des jours complets de la fenêtre (sans aujourd'hui), arrondie ; null s'il n'y en a pas. */
  moyenne: number | null;
  /** Les comptes qui ont laissé un mail, du plus récent au plus ancien. */
  mails: { name: string; email: string }[];
  comptes: number;
  /** Les comptes créés ces 7 derniers jours (aujourd'hui compris), du plus récent au plus ancien. */
  inscrits: { name: string; at: number }[];
}

/** Le minuit d'il y a `i` jours, sûr aux changements d'heure. */
const ilYa = (minuit: number, i: number) => debutJour(minuit + DAY / 2 - i * DAY);

export function teteAnalytics(
  evenements: readonly Pick<Evenement, "name" | "at">[],
  profils: readonly Profil[],
  now: number,
  jours: number
): TeteAnalytics {
  const admins = new Set(profils.filter((p) => p.admin).map((p) => p.name));
  const minuit = debutJour(now);
  const debut = ilYa(minuit, jours - 1);

  const parJourNoms = new Map<number, Set<string>>();
  const derniere = new Map<string, number>();
  for (const e of evenements) {
    if (admins.has(e.name) || e.at < debut || e.at > now) continue;
    const j = debutJour(e.at);
    let s = parJourNoms.get(j);
    if (!s) parJourNoms.set(j, (s = new Set()));
    s.add(e.name);
    if (e.at >= minuit && (derniere.get(e.name) ?? 0) < e.at) derniere.set(e.name, e.at);
  }
  const parJour: JourConnectes[] = [];
  for (let i = jours - 1; i >= 0; i--) {
    const t = ilYa(minuit, i);
    parJour.push({ t, n: parJourNoms.get(t)?.size ?? 0 });
  }
  const complets = parJour.slice(0, -1);
  const moyenne = complets.length ? Math.round(complets.reduce((s, j) => s + j.n, 0) / complets.length) : null;
  const aujourdhui = [...derniere.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);

  const parCreation = [...profils].sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
  const mails = parCreation.flatMap((p) => (p.contact_email ? [{ name: p.name, email: p.contact_email }] : []));
  const depuis7 = ilYa(minuit, 6);
  const inscrits = parCreation.flatMap((p) => (p.created_at != null && p.created_at >= depuis7 && p.created_at <= now ? [{ name: p.name, at: p.created_at }] : []));

  return { aujourdhui, parJour, moyenne, mails, comptes: profils.length, inscrits };
}

/** Un plafond « rond » pour l'axe : 33 → 40, 7 → 8, 1 234 → 1 500. */
export function plafondRond(v: number): number {
  if (v <= 4) return Math.max(1, Math.ceil(v));
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
