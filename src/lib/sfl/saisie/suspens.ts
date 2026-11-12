// La journée en suspens, et « Reprendre ».
//
// Ilyes, 12/11/2026 : « J'aimerais pouvoir mettre une journée en pause quand
// elle s'est mal tournée ou quand on a mal géré l'organisation. Par exemple
// la journée 5, on avait des travaux sur les terrains donc on n'a pas pu
// jouer tous les matchs […]. J'aimerais un bouton qui puisse me permettre de
// mettre en pause ou en suspens les résultats de cette journée, et dans le
// classement ou dans les classements et même dans les récaps, que les
// joueurs puissent voir que cette journée-là sera rattrapée. »
//
// Un seul état est stocké : `JourneeMeta.suspens` (et sa dernière `reprise`,
// gardée comme `publiee`). Absent, null ou false : comme avant — toutes les
// journées d'avant le 12/11, sans migration. La même règle en base :
// public.est_en_suspens (supabase/schema.sql).
//
// La règle : une journée en suspens RESTE visible (contrairement au
// brouillon), avec ses équipes et ses matchs, mais ne compte nulle part :
// aucun point, aucune stat, aucune évolution de carte, aucun vote, aucun
// prono, aucune mission, aucune XP. Elle se lit « En suspens · à rattraper »
// jusqu'à ce que l'admin la reprenne.
//
// Le point d'entrée unique est revelation.ts, `journeeComptee` : une journée
// en suspens n'y compte jamais, si bien que `figer` la remet en feuille
// posée dans la vue que lit toute la ligue (SeasonProvider, le serveur), et
// tout ce qui lit cette vue l'ignore d'office. Le reste (vote, feuille en
// direct, divisions, clôture, annonces, missions, Flair) est branché un par
// un ; la liste est en tête de tools/suspens-check.ts, qui la garde.
//
// Les états s'excluent : on ne suspend qu'une journée publiée, et une
// journée en suspens ne se remet pas en brouillon (brouillon.ts).
//
// Le rattrapage : la même journée, à une autre date (on change la date, puis
// on reprend, ou l'inverse : la reprise garde la date d'origine). La base
// fait alors le ménage de ce qui n'est pas du nouveau jour (votes, feuilles,
// fin des matchs, notes d'arbitre : public.saison_reprise). Une journée
// rattrapée se joue après de plus grands numéros : la journée du moment
// (missions, pronos, arbitres) se choisit par date (journeeDuMoment), et les
// divisions se rejouent dans l'ordre du calendrier (ordreDuCalendrier,
// convocation-temps.ts).
//
// Pur : ni base, ni écran.

import { journeeJouee } from "./engine";
import { estBrouillon } from "./brouillon";
import type { JourneeMeta, Saison } from "./types";

/** Le motif que lisent les joueurs (« Travaux sur les terrains ») : une ligne, pas plus. */
export const MOTIF_MAX = 60;

/** Le libellé d'état d'une journée en suspens, partout côté joueurs. */
export const EN_SUSPENS = "En suspens · à rattraper";
/** En court, dans une frise ou une pastille : « J5 · à rattraper ». */
export const A_RATTRAPER = "à rattraper";
/** Le signe de l'état (frise, pastilles). */
export const SIGNE_SUSPENS = "‖";

/** Absent, null ou false : pas en suspens. Tout le reste : en suspens (comme public.est_en_suspens). */
export const estEnSuspens = (m: Pick<JourneeMeta, "suspens"> | undefined | null): boolean =>
  !!m && m.suspens != null && (m.suspens as unknown) !== false;

/** Les numéros des journées en suspens, dans l'ordre. */
export function journeesEnSuspens(s: Pick<Saison, "journees">): number[] {
  return s.journees.filter(estEnSuspens).map((m) => m.j).sort((a, b) => a - b);
}

/** La première journée en suspens (la clôture de la saison l'attend) ; null s'il n'y en a pas. */
export function resteUneJourneeEnSuspens(s: Pick<Saison, "journees">): number | null {
  return journeesEnSuspens(s)[0] ?? null;
}

/** Le motif tel qu'il s'écrit : rogné, « » devient absent. */
export function motifPropre(motif: string | null | undefined): string | undefined {
  const m = (motif ?? "").replace(/\s+/g, " ").trim();
  return m ? m : undefined;
}

export type RefusSuspendre = "absente" | "brouillon" | "deja" | "motif";
export type RefusReprendre = "absente" | "pas-en-suspens";

/**
 * Suspend la journée : pose `suspens` (l'heure, l'admin, la date du moment,
 * le motif). Ses lignes, ses buts et sa meta restent tels quels : rien n'est
 * effacé, tout revient à la reprise.
 */
export function suspendreJournee(
  s: Saison,
  j: number,
  o: { par: string; le: string; motif?: string | null }
): { saison: Saison } | { refus: RefusSuspendre } {
  const meta = s.journees.find((m) => m.j === j);
  if (!meta) return { refus: "absente" };
  if (estBrouillon(meta)) return { refus: "brouillon" };
  if (estEnSuspens(meta)) return { refus: "deja" };
  const motif = motifPropre(o.motif);
  if (motif && motif.length > MOTIF_MAX) return { refus: "motif" };
  const suspens: NonNullable<JourneeMeta["suspens"]> = { depuis: o.le, par: o.par, date: meta.date, ...(motif ? { motif } : {}) };
  return { saison: { ...s, journees: s.journees.map((m) => (m.j === j ? { ...m, suspens } : m)) } };
}

/**
 * Reprend la journée : retire `suspens`, pose `reprise` (avec la date
 * d'origine). Elle vit ensuite son cycle normal à sa date.
 */
export function reprendreJournee(s: Saison, j: number, o: { par: string; le: string }): { saison: Saison } | { refus: RefusReprendre } {
  const meta = s.journees.find((m) => m.j === j);
  if (!meta) return { refus: "absente" };
  if (!estEnSuspens(meta)) return { refus: "pas-en-suspens" };
  return {
    saison: {
      ...s,
      journees: s.journees.map((m) => {
        if (m.j !== j) return m;
        const { suspens, ...reste } = m;
        // La date d'origine voyage avec la reprise : changer la date ensuite
        // fait le même ménage qu'un rattrapage (public.saison_reprise).
        const date = estEnSuspens({ suspens }) ? suspens?.date : undefined;
        return { ...reste, reprise: { le: o.le, par: o.par, ...(date ? { date } : {}) } };
      }),
    },
  };
}

/** Rattrapée à une autre date : la date a changé depuis la suspension (la base fait le même test, public.saison_reprise). */
export function rattrapeeAilleurs(meta: Pick<JourneeMeta, "suspens" | "date">): boolean {
  return estEnSuspens(meta) && !!meta.suspens?.date && meta.suspens.date !== meta.date;
}

/** Le seul libellé côté joueurs : l'état, et le motif s'il y en a un. null : pas en suspens. */
export function libelleSuspens(meta: Pick<JourneeMeta, "suspens"> | undefined | null): { etat: string; motif?: string } | null {
  if (!meta || !estEnSuspens(meta)) return null;
  const motif = motifPropre(meta.suspens?.motif);
  return { etat: EN_SUSPENS, ...(motif ? { motif } : {}) };
}

/**
 * La prochaine journée à jouer : celle d'après la dernière journée jouée de la
 * saison passée (la vue figée : la dernière comptée), en sautant les
 * journées en suspens. Le numéro peut ne pas exister encore (la J6 pas
 * encore créée).
 */
export function prochaineAJouer(s: Pick<Saison, "journees" | "entries">): number {
  const enSuspens = new Set(journeesEnSuspens(s));
  let j = Math.max(0, ...s.journees.map((m) => m.j).filter((x) => !enSuspens.has(x) && journeeJouee(s as Saison, x))) + 1;
  while (enSuspens.has(j)) j++;
  return j;
}

/**
 * La journée « du moment » parmi des journées datées (missions, pronos,
 * arbitres) : la prochaine à se jouer ou à se dénouer — pas encore finie,
 * hors suspens, la plus proche par son coup d'envoi —, sinon la dernière par
 * date, une journée en suspens comprise. Les numéros ne disent pas l'ordre du
 * calendrier : une J5 rattrapée le 29/11 se joue après la J7 du 22/11
 * (contrôle du 12/11). Quand les numéros suivent les dates, c'est la journée
 * qu'on prenait avant (la plus grande qui a des équipes), sauf qu'une
 * journée pas encore révélée passe devant la suivante déjà convoquée.
 */
export function journeeDuMoment<T extends { j: number; coupEnvoi: Date; finDuJour: Date; suspens: boolean }>(
  liste: readonly T[],
  maintenant: Date
): T | null {
  const t = maintenant.getTime();
  const ordre = (a: T, b: T) => a.coupEnvoi.getTime() - b.coupEnvoi.getTime() || a.j - b.j;
  const ouverte = liste.filter((d) => !d.suspens && t < d.finDuJour.getTime()).sort(ordre)[0];
  return ouverte ?? [...liste].sort(ordre).at(-1) ?? null;
}

/** La première journée de la saison qui n'est ni jouée ni en suspens (la « prochaine » d'un écran) ; undefined s'il n'y en a pas. */
export function premiereAVenir(s: Pick<Saison, "journees" | "entries">): JourneeMeta | undefined {
  return [...s.journees].sort((a, b) => a.j - b.j).find((m) => !estEnSuspens(m) && !journeeJouee(s as Saison, m.j));
}
