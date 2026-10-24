// Les missions d'arbitre (Sabri, 24/10 : « Il faudrait que les arbitres, eux
// aussi, aient des missions et des aspects différents de ceux des joueurs,
// qu'ils puissent activer, accepter et refuser aussi des missions. Il
// faudrait que ça leur ramène, dans les trophées à avoir dans les passes […]
// des skins de cartes, mais d'arbitres, et des choses pour l'arbitre »).
//
// Un arbitre ne marque pas, ne fait pas de passe D, n'a pas de rival : ses
// missions partent de ce qu'il a, la note des joueurs de ses matchs
// (arbitres.ts). Chaque journée où l'admin l'a désigné sur au moins un match,
// il a trois missions, dans les fiches des joueurs (rangs, prime, risque) :
//   · Sang-froid (rang S) : finir la journée à 80 de satisfaction ou plus ;
//   · Tribune (rang A) : recevoir au moins 4 notes par match arbitré ;
//   · Unanime (rang A) : au moins 2 notes de 5 sur 5 par match arbitré.
// Comme les joueurs, il accepte ou passe jusqu'au coup d'envoi (table
// missions_arbitre) ; acceptée puis ratée, une mission coûte la moitié de sa
// prime (risqueDe) ; passer ne coûte rien. Les joueurs notent jusqu'au mardi
// minuit (noter_arbitre, arbitrages.ferme_le) : le verdict tombe alors, et ne
// bouge plus.
//
// L'XP : 100 par match arbitré (une journée jouée), la prime des missions
// réussies, 150 de plus pour les trois. Elle fait le passe d'arbitre de la
// saison (passe-arbitre.ts), jamais de points Pépite.
//
// Pur : ni React ni réseau.

import { heuresDeJournee, risqueDe, rangDe, XP_PARFAIT, type LigneXp, type SaisonLue } from "./missions";
import { journeeJouee } from "./saisie/mutations";
import type { Saison } from "./saisie/types";
import type { Arbitrage, Avis } from "./arbitres";

export type CreneauArbitre = "sang-froid" | "tribune" | "unanime";
export const CRENEAUX_ARBITRE: CreneauArbitre[] = ["sang-froid", "tribune", "unanime"];

/** Ce que rapporte un match arbitré, une fois la journée jouée. */
export const XP_MATCH_ARBITRE = 100;
/** Sang-froid : la satisfaction de la journée, au moins. */
export const SEUIL_SATISFACTION = 80;
const NOTES_PAR_MATCH = 4;
const CINQ_PAR_MATCH = 2;

const PRIME: Record<CreneauArbitre, number> = { "sang-froid": 140, tribune: 100, unanime: 120 };

export const NOM_DE_CODE_ARBITRE: Record<CreneauArbitre, string> = {
  "sang-froid": "Sang-froid",
  tribune: "Tribune",
  unanime: "Unanime",
};

export interface MissionArbitre {
  creneau: CreneauArbitre;
  /** Sang-froid : la satisfaction ; Tribune : les notes ; Unanime : les 5 sur 5. */
  seuil: number;
  xp: number;
}

/** Une réponse, telle que la base la garde (missions_arbitre). */
export interface ReponseArbitre {
  saison: number;
  j: number;
  mission: CreneauArbitre;
  reponse: "acceptee" | "passee";
  /** L'heure de la base. */
  le: string;
}

export type PhaseArbitre = "ouvert" | "en-jeu" | "fini";

export interface JourneeArbitre {
  saison: number;
  j: number;
  date: string;
  heure: string;
  coupEnvoi: Date;
  /** Le mardi minuit : les notes ferment, le verdict tombe. */
  finDesNotes: Date;
  /** La feuille porte des résultats. */
  joue: boolean;
  /** Ses matchs de la journée. */
  arbitrages: Arbitrage[];
  missions: MissionArbitre[];
}

export type EtatMission = "reussie" | "ratee" | "en-jeu";

export interface VerdictArbitre {
  etat: EtatMission;
  /** Ce que l'app a lu : « 84 de satisfaction », « 5 notes sur 8 ». */
  detail: string;
}

const pl = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 || n === 0 ? plusieurs : un}`;

/** La satisfaction d'une moyenne sur 5 : ×20, plafonnée à 99 comme une note de carte ; null sans note. */
export const satisfactionDe = (t: Avis | null | undefined): number | null =>
  t && t.avis > 0 ? Math.min(99, Math.round((t.total / t.avis) * 20)) : null;

/** Les missions d'une journée arbitrée : les seuils suivent ses matchs. */
export function missionsArbitre(matchs: number): MissionArbitre[] {
  const n = Math.max(1, matchs);
  return [
    { creneau: "sang-froid", seuil: SEUIL_SATISFACTION, xp: PRIME["sang-froid"] },
    { creneau: "tribune", seuil: NOTES_PAR_MATCH * n, xp: PRIME.tribune },
    { creneau: "unanime", seuil: CINQ_PAR_MATCH * n, xp: PRIME.unanime },
  ];
}

/** L'objectif d'une mission, comme la fiche le dit. */
export function phraseArbitre(m: MissionArbitre, matchs: number): string {
  const sur = matchs > 1 ? ` sur tes ${matchs} matchs` : "";
  if (m.creneau === "sang-froid") return `Finis à ${m.seuil} de satisfaction ou plus${sur}.`;
  if (m.creneau === "tribune") return `Reçois au moins ${m.seuil} notes des joueurs${sur}.`;
  return `Reçois au moins ${m.seuil} notes de 5 sur 5${sur}.`;
}

/** Une journée où il arbitre : ses heures, ses matchs, ses missions ; null sans équipes. */
export function journeeArbitre(
  s: SaisonLue,
  saison: number,
  j: number,
  arbitrages: Arbitrage[],
  reference: Date
): JourneeArbitre | null {
  const h = heuresDeJournee(s, j, reference);
  if (!h || arbitrages.length === 0) return null;
  return {
    saison,
    j,
    date: h.meta.date,
    heure: h.heure,
    coupEnvoi: h.coupEnvoi,
    finDesNotes: h.finDesNotes,
    joue: journeeJouee(s, j),
    arbitrages: [...arbitrages].sort((a, b) => a.n - b.n),
    missions: missionsArbitre(arbitrages.length),
  };
}

export function phaseArbitre(d: JourneeArbitre, maintenant: Date): PhaseArbitre {
  if (maintenant.getTime() < d.coupEnvoi.getTime()) return "ouvert";
  return maintenant.getTime() < d.finDesNotes.getTime() ? "en-jeu" : "fini";
}

/** Les notes de la journée, ses matchs mis ensemble. */
export function avisDeJournee(d: JourneeArbitre, avis: Record<number, Avis>): Avis {
  return d.arbitrages.reduce<Avis>(
    (s, a) => {
      const t = avis[a.id];
      return t ? { avis: s.avis + t.avis, total: s.total + t.total, cinq: s.cinq + t.cinq } : s;
    },
    { avis: 0, total: 0, cinq: 0 }
  );
}

/** Le verdict, sur les notes telles qu'elles sont ; définitif une fois les notes fermées. */
export function jugerArbitre(m: MissionArbitre, d: JourneeArbitre, avis: Record<number, Avis>, maintenant: Date): VerdictArbitre {
  if (!d.joue) return { etat: "en-jeu", detail: "" };
  const t = avisDeJournee(d, avis);
  const sat = satisfactionDe(t);
  const ok =
    m.creneau === "sang-froid" ? sat != null && sat >= m.seuil : m.creneau === "tribune" ? t.avis >= m.seuil : t.cinq >= m.seuil;
  const detail =
    m.creneau === "sang-froid"
      ? sat == null
        ? "Pas encore de note"
        : `${sat} de satisfaction`
      : m.creneau === "tribune"
        ? `${pl(t.avis, "note", "notes")} · il en faut ${m.seuil}`
        : `${t.cinq} fois 5 sur 5 · il en faut ${m.seuil}`;
  if (maintenant.getTime() < d.finDesNotes.getTime()) return { etat: "en-jeu", detail };
  return { etat: ok ? "reussie" : "ratee", detail };
}

/** La réponse qui compte : donnée avant le coup d'envoi. */
export function reponseArbitreDe(reponses: ReponseArbitre[], d: JourneeArbitre, c: CreneauArbitre): ReponseArbitre | null {
  const r = reponses.find((x) => x.saison === d.saison && x.j === d.j && x.mission === c);
  return r && new Date(r.le).getTime() <= d.coupEnvoi.getTime() ? r : null;
}

/** Les saisons où chercher une journée : les archives, puis celle en cours. */
function saisonsDe(s: Saison): { numero: number; lue: SaisonLue; reference: (m: Date) => Date; close: boolean }[] {
  return [
    ...(s.archives ?? []).map((a) => ({ numero: a.numero, lue: a as SaisonLue, reference: () => new Date(a.cloturee), close: true })),
    { numero: s.numero ?? 0, lue: s as SaisonLue, reference: (m: Date) => m, close: false },
  ];
}

/** Toutes les journées où il arbitre (toutes saisons), de la plus ancienne à la plus récente. */
export function journeesArbitre(s: Saison, arbitre: string, arbitrages: Arbitrage[], maintenant: Date): JourneeArbitre[] {
  const miens = arbitrages.filter((a) => a.arbitre === arbitre);
  const out: JourneeArbitre[] = [];
  for (const sa of saisonsDe(s)) {
    const js = [...new Set(miens.filter((a) => a.saison === sa.numero).map((a) => a.j))].sort((a, b) => a - b);
    for (const j of js) {
      const d = journeeArbitre(
        sa.lue,
        sa.numero,
        j,
        miens.filter((a) => a.saison === sa.numero && a.j === j),
        sa.reference(maintenant)
      );
      if (d) out.push(d);
    }
  }
  return out;
}

/** La journée des missions : la prochaine à jouer, sinon la dernière dont le verdict n'est pas tombé, sinon la dernière. */
export function journeeEnCours(journees: JourneeArbitre[], saison: number, maintenant: Date): JourneeArbitre | null {
  const ici = journees.filter((d) => d.saison === saison);
  return (
    ici.find((d) => phaseArbitre(d, maintenant) === "ouvert") ??
    [...ici].reverse().find((d) => phaseArbitre(d, maintenant) === "en-jeu") ??
    ici[ici.length - 1] ??
    null
  );
}

/** Le journal d'XP d'un arbitre : ses matchs arbitrés, ses missions jugées. */
export function journalArbitre(
  journees: JourneeArbitre[],
  reponses: ReponseArbitre[],
  avis: Record<number, Avis>,
  maintenant: Date
): LigneXp[] {
  const lignes: LigneXp[] = [];
  for (const d of journees) {
    if (!d.joue) continue;
    const base = { saison: d.saison, j: d.j, date: d.date };
    lignes.push({
      ...base,
      quoi: d.arbitrages.length > 1 ? `${d.arbitrages.length} matchs arbitrés` : "Match arbitré",
      xp: XP_MATCH_ARBITRE * d.arbitrages.length,
    });
    if (maintenant.getTime() < d.finDesNotes.getTime()) continue;
    let ok = 0;
    for (const m of d.missions) {
      if (reponseArbitreDe(reponses, d, m.creneau)?.reponse !== "acceptee") continue;
      const v = jugerArbitre(m, d, avis, maintenant);
      const mission = { creneau: m.creneau, rang: rangDe(m) };
      if (v.etat === "reussie") {
        ok++;
        lignes.push({ ...base, quoi: NOM_DE_CODE_ARBITRE[m.creneau], xp: m.xp, mission: { ...mission, reussie: true } });
      } else if (v.etat === "ratee")
        lignes.push({ ...base, quoi: `${NOM_DE_CODE_ARBITRE[m.creneau]} ratée`, xp: -risqueDe(m), mission: { ...mission, reussie: false } });
    }
    if (ok === 3) lignes.push({ ...base, quoi: "Trois sur trois", xp: XP_PARFAIT, parfait: true });
  }
  return lignes.sort((a, b) => b.saison - a.saison || b.j - a.j);
}
