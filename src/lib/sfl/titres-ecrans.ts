// Les titres d'un dimanche, comme les écrans les disent. Un même joueur peut
// être MVP, Impact et Défensive le même jour (Ilyes, 02/11/2026 : « oui, un
// joueur peut avoir la Défensive et l'Impact le même jour », et le MVP en
// plus) : chaque écran les dit tous, toujours dans l'ordre des puces (MVP,
// Impact, Défensive ; puces-titres.ts, ORDRE_TITRES).
//
// Le MVP est unique au match, sauf égalité ; l'Impact et la Défensive sont
// ceux de chaque équipe. Deux MVP d'un match sont donc des ex æquo ; deux
// élus Impact sur un même terrain, d'abord un par équipe, et des ex æquo
// seulement quand ils sont de la même équipe.
//
// PUR (ni fenêtre, ni base, ni React) : les écrans (le récap de la journée,
// la Gazette, la synthèse sur le terrain, les Actus, Ma saison) ne font que
// poser ce qui sort d'ici, et tools/titres-cumul-check.ts le vérifie.

import type { BoostType } from "./engine";
import { NOM_TITRE, type TitreDuJour } from "./fiche-joueur";
import { ORDRE_TITRES } from "./puces-titres";
import type { MatchEntry } from "./saisie/types";

type AvecTitres = { mvp?: boolean; impact?: boolean; def?: boolean };

/** Ses titres, dans l'ordre des puces. */
export const titresDe = (e: AvecTitres): BoostType[] => ORDRE_TITRES.filter((t) => !!e[t]);

/** « Jouneid », « Jouneid et Zakary », « Abdel, Bilal et Faycal ». */
export const enLigne = (noms: readonly string[]): string =>
  noms.length < 2 ? (noms[0] ?? "") : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;

/* ------------------------------ Le récap ------------------------------ */

/**
 * La ligne d'un top de la journée (journee-recap.tsx) : ses buts, ses passes,
 * puis tous ses titres dans l'ordre des puces ; son résultat s'il n'a rien de
 * tout ça. Chaque mot à part : l'écran pose le point entre eux, et jamais en
 * tête d'une ligne qui se coupe.
 */
export function motsDuTop(e: Pick<MatchEntry, "buts" | "passes" | "mvp" | "impact" | "def" | "result">): string[] {
  const mots = [
    e.buts > 0 ? `${e.buts}B` : null,
    e.passes > 0 ? `${e.passes}P` : null,
    ...titresDe(e).map((t) => MOT_DU_TOP[t]),
  ].filter((x): x is string => !!x);
  return mots.length ? mots : e.result ? [e.result] : [];
}
const MOT_DU_TOP: Record<BoostType, string> = { mvp: "MVP", impact: "IMPACT", def: "DÉF" };

/** La fin de phrase d'un débutant : « — et repart avec deux titres. » s'il en cumule ; « . » sans titre. */
export function repartAvec(e: AvecTitres): string {
  const n = titresDe(e).length;
  return n ? ` — et repart avec ${["un titre", "deux titres", "trois titres"][n - 1]}.` : ".";
}

/**
 * Les cartes à titre d'une journée, parmi toutes celles de la saison : leur
 * date commence par « J1 · 18 oct. ». L'espace compte : sans lui, la J1
 * prenait aussi les cartes des J10 à J19.
 */
export function cartesDeLaJournee<T extends { date: string }>(cartes: readonly T[], j: number): T[] {
  return cartes.filter((c) => c.date.startsWith(`J${j} `));
}

/* ------------------------------ La Gazette ------------------------------ */

const COURT: Record<BoostType, string> = { mvp: "MVP", impact: "IMP", def: "DÉF" };

/** L'étiquette d'une ligne du palmarès (la-une.tsx) : « MVP · IMP · DÉF » ; vide sans titre. */
export const etiquetteDuPalmares = (l: AvecTitres): string =>
  titresDe(l)
    .map((t) => COURT[t])
    .join(" · ");

/* ------------------------------ La synthèse ------------------------------ */

const LONG: Record<BoostType, string> = { mvp: "MVP", impact: "IMPACT", def: "DÉF" };

/** La pastille du mode « Titres » (pitch-synthese.tsx) : le titre en entier s'il est seul, sinon chacun en court (« IMP·DÉF »). */
export function pastilleDesTitres(t: readonly BoostType[]): string {
  const ordre = ORDRE_TITRES.filter((x) => t.includes(x));
  return ordre.length > 1 ? ordre.map((x) => COURT[x]).join("·") : ordre.length ? LONG[ordre[0]] : "";
}

/**
 * Les cartes du mode « Titres » de la synthèse : cinq au plus (rien ne se
 * chevauche sur le terrain), les MVP d'abord, puis ceux qui ont le plus de
 * titres, dans l'ordre de la feuille à égalité ; ni l'extra time, ni ceux
 * qui n'ont rien. La pastille les dit tous ; la carte d'un MVP est en avant.
 */
export function titresDeLaSynthese<L extends { name: string; extraTime?: boolean }>(
  lignes: readonly L[],
  titresDuJour: (nom: string) => readonly BoostType[],
): { name: string; badge: string; hot: boolean }[] {
  return lignes
    .filter((l) => !l.extraTime)
    .map((l) => ({ l, t: titresDuJour(l.name) }))
    .filter(({ t }) => t.length > 0)
    .sort((a, b) => Number(b.t.includes("mvp")) - Number(a.t.includes("mvp")) || b.t.length - a.t.length)
    .slice(0, 5)
    .map(({ l, t }) => ({ name: l.name, badge: pastilleDesTitres(t), hot: t.includes("mvp") }));
}

/* ------------------------------ Les Actus ------------------------------ */

/** « (ex æquo) », d'un bloc : jamais « (ex » en fin de ligne et « æquo) » sur la suivante. */
const EX_AEQUO = " (ex\u00a0æquo)";

/** Le nom d'un titre dans les Actus (la rubrique des cartes d'un match). */
export const NOM_TITRE_ACTUS: Record<BoostType, string> = { mvp: "MVP", impact: "Impact", def: "Défensive" };

/**
 * La ligne du bas de la rubrique des cartes d'un match (actus/pelouse.tsx) :
 * « MVP : Selim · Impact : Youss, Jouneid · Défensive : Youss, Sidali ».
 * Deux MVP sont des ex æquo. L'Impact et la Défensive se lisent équipe par
 * équipe : un élu par équipe n'a rien d'un ex æquo, deux de la même équipe
 * le sont, et un point-virgule sépare alors les équipes (« Impact : Anas,
 * Mehdi et Ryad (ex æquo) ; Yassine »). Une ligne
 * sans équipe (le compte vitrine, un dimanche d'avant les équipes) compte
 * seule. `titres` : ceux du match, du plus rare au moins rare (actus.ts).
 */
export function texteDesTitres(
  titres: readonly { nom: string; types: readonly BoostType[]; equipe?: string }[],
  nom: (n: string) => string = (n) => n,
): string {
  return ORDRE_TITRES.flatMap((type) => {
    const elus = titres.filter((x) => x.types.includes(type));
    if (!elus.length) return [];
    if (type === "mvp") {
      return [`${NOM_TITRE_ACTUS.mvp} : ${elus.map((x) => nom(x.nom)).join(", ")}${elus.length > 1 ? EX_AEQUO : ""}`];
    }
    // Les élus groupés par équipe, dans l'ordre où elles arrivent.
    const groupes: string[][] = [];
    const deLEquipe = new Map<string, string[]>();
    for (const x of elus) {
      const g = x.equipe ? deLEquipe.get(x.equipe) : undefined;
      if (g) g.push(nom(x.nom));
      else {
        const neuf = [nom(x.nom)];
        groupes.push(neuf);
        if (x.equipe) deLEquipe.set(x.equipe, neuf);
      }
    }
    // Des ex æquo : un point-virgule entre les équipes, sinon « Ilyes, Selim et Sidali (ex æquo) » les mêlait.
    const entre = groupes.some((g) => g.length > 1) ? "\u00a0; " : ", ";
    return [`${NOM_TITRE_ACTUS[type]} : ${groupes.map((g) => (g.length > 1 ? `${enLigne(g)}${EX_AEQUO}` : g[0])).join(entre)}`];
  }).join(" · ");
}

/* ------------------------------ Ma saison ------------------------------ */

/** Un titre du jour en toutes lettres (ma-saison.tsx, en grand) : « MVP du match », « Le Mur de ton équipe ». */
export const titreEnGrand = (t: TitreDuJour): string => `${NOM_TITRE[t]} ${t === "mvp" ? "du match" : "de ton équipe"}`;
