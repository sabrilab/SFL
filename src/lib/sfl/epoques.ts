// Les cartes d'une saison close, dans les visuels de leur temps (Sabri,
// 24/10 : « récupérer, pour les joueurs de la saison 0, les designs qu'on
// avait à ce moment-là […] Tu fais un truc qui respecte notre carte
// actuelle, mais qui fait penser à ça. Du coup, ça va faire en sorte que ces
// actifs-là, ces cartes-là, se différencient déjà de par leur date
// d'émission » ; puis : « que le design des cartes actuelles soit celui-ci.
// Sans modifier »).
//
// La saison 0 s'est jouée du dimanche 21 juin au dimanche 30 août 2026 (J1
// à J11) et a été close le 10/10. Ses cartes étaient celles des visuels
// officiels du 12/07 : la carte « Standard parchemin », et les cartes Boost
// (MVP du match, Joueur Impact, Défensive). Leur dessin, sur la carte
// d'aujourd'hui, est dans components/sfl/finitions-carte.ts (les matières
// « s0 ») ; ici, ce que chaque carte dit d'elle-même dans sa ligne de série :
//   · sa date d'émission : la carte de saison est émise le jour de la
//     première journée jouée par le joueur, une carte à titre le jour de
//     son titre ;
//   · son numéro : son rang d'émission dans la saison, sur le nombre de
//     cartes de son édition émises cette saison-là (« n° 012 / 054 » : la
//     12e carte de saison émise, sur 54 ; « n° 003 / 015 » : le 3e MVP). Le
//     même jour, l'ordre alphabétique départage.
// Tout se lit dans les lignes de la saison, rien n'est stocké. Une archive
// ne change plus : le registre de chaque saison est calculé une fois.

import { jourMoisDuLibelle } from "./convocation-temps";
import type { BoostType } from "./engine";
import type { JourneeMeta, MatchEntry, Saison } from "./saisie/types";

/** L'année de la première journée des saisons qui ont leur édition d'époque. */
const ANNEE_DE_DEPART: Record<number, number> = { 0: 2026 };

/** Ce qu'une carte d'époque dit d'elle-même : sa saison, sa date d'émission, son numéro. */
export interface EmissionCarte {
  saison: number;
  /** Le jour de son émission, « 21.06.2026 » ; null s'il ne se lit pas. */
  le: string | null;
  /** Son rang d'émission, et le nombre de cartes de son édition émises dans la saison. */
  n: number | null;
  sur: number | null;
}

interface Registre {
  /** La date de chaque journée, « 21.06.2026 ». */
  dates: Map<number, string>;
  /** La carte de saison de chacun : sa première journée, son rang d'émission. */
  saison: Map<string, { j: number; n: number }>;
  cartes: number;
  /** Les cartes à titre, par « type-j-nom » : leur rang parmi celles de leur type. */
  titres: Map<string, { n: number; sur: number }>;
}

// Une saison relue (son archive) garde le même tableau de lignes : la clé du registre.
const registres = new WeakMap<MatchEntry[], Registre>();

const deux = (n: number) => String(n).padStart(2, "0");

/** Les dates des journées : l'année de départ, puis une de plus à chaque fois que les mois repartent. */
function datesDesJournees(journees: JourneeMeta[], annee: number | undefined): Map<number, string> {
  const out = new Map<number, string>();
  let an = annee;
  let avant = 0;
  for (const m of [...journees].sort((a, b) => a.j - b.j)) {
    const jm = jourMoisDuLibelle(m.date);
    if (!jm) continue;
    if (an != null && jm.mois < avant) an++;
    avant = jm.mois;
    out.set(m.j, `${deux(jm.jour)}.${deux(jm.mois)}${an != null ? `.${an}` : ""}`);
  }
  return out;
}

const compte = (e: MatchEntry) => e.statut === "Présent" && !e.extraTime;

function registre(s: Pick<Saison, "numero" | "journees" | "entries">): Registre {
  const deja = registres.get(s.entries);
  if (deja) return deja;
  // La carte de saison : émise à la première journée jouée.
  const premiere = new Map<string, number>();
  for (const e of s.entries) {
    if (!compte(e)) continue;
    const j = premiere.get(e.player);
    if (j == null || e.j < j) premiere.set(e.player, e.j);
  }
  const ordre = [...premiere].sort(([a, ja], [b, jb]) => ja - jb || a.localeCompare(b, "fr"));
  const saison = new Map(ordre.map(([nom, j], i) => [nom, { j, n: i + 1 }]));
  // Les cartes à titre, comme computeBoostCards les émet : une par titre d'une ligne jouée.
  const titres = new Map<string, { n: number; sur: number }>();
  for (const type of ["mvp", "impact", "def"] as const) {
    const lignes = s.entries.filter((e) => compte(e) && e[type]).sort((a, b) => a.j - b.j || a.player.localeCompare(b.player, "fr"));
    lignes.forEach((e, i) => titres.set(`${type}-${e.j}-${e.player}`, { n: i + 1, sur: lignes.length }));
  }
  const r: Registre = { dates: datesDesJournees(s.journees, ANNEE_DE_DEPART[s.numero ?? 0]), saison, cartes: ordre.length, titres };
  registres.set(s.entries, r);
  return r;
}

/**
 * L'émission d'une carte de la saison `s` : la carte de saison de `nom`, ou
 * sa carte à titre (`titre`) de la journée `titre.j`.
 */
export function emissionDe(
  s: Pick<Saison, "numero" | "journees" | "entries">,
  nom: string,
  titre?: { type: BoostType; j?: number },
): EmissionCarte {
  const r = registre(s);
  const saison = s.numero ?? 0;
  if (titre) {
    const t = titre.j != null ? r.titres.get(`${titre.type}-${titre.j}-${nom}`) : undefined;
    return { saison, le: titre.j != null ? (r.dates.get(titre.j) ?? null) : null, n: t?.n ?? null, sur: t?.sur ?? null };
  }
  const c = r.saison.get(nom);
  return { saison, le: c ? (r.dates.get(c.j) ?? null) : null, n: c?.n ?? null, sur: c ? r.cartes : null };
}

/** La ligne de série d'une carte d'époque : « émise le 21.06.2026 », puis « n° 012 / 054 ». */
export function ligneDEmission(e: EmissionCarte): { date: string; numero: string } {
  const trois = (n: number) => String(n).padStart(3, "0");
  return {
    date: e.le ? `émise le ${e.le}` : `saison ${e.saison}`,
    numero: e.n != null && e.sur != null ? `n° ${trois(e.n)} / ${trois(e.sur)}` : e.le ? `saison ${e.saison}` : "",
  };
}
