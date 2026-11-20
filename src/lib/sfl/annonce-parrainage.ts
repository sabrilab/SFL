// Ce que dit l'annonce du parrainage (components/sfl/nouveautes/parrainage.tsx),
// sans rien dessiner : ses titres et ses lignes, composés depuis la table des
// paliers (skins-recrues.ts : PALIERS_RECRUES, XP_RECRUE, FONDATEURS_MAX), ce
// que dit la carte de la première diapo, et le numéro de la carte Fondateur
// de la dernière. Un palier qui change change l'annonce avec lui ; rien n'est
// écrit en dur à côté de la table. Pur : tools/nouveautes-check.ts le vérifie.

import { FONDATEURS_MAX, numeroFondateur, PALIERS_RECRUES, XP_RECRUE, type FinitionRecrue, type PalierRecrues } from "@/components/sfl/skins-recrues";

/** Un palier qui donne un skin. */
export type PalierSkin = PalierRecrues & { finition: FinitionRecrue };

/** Les paliers qui donnent un skin, du plus bas au plus haut : Recruteur, Filigrane, Fondateur. */
export function paliersSkins(paliers: readonly PalierRecrues[] = PALIERS_RECRUES): PalierSkin[] {
  return paliers.filter((p): p is PalierSkin => !!p.finition).sort((a, b) => a.n - b.n);
}

/**
 * Les titres et les lignes des trois diapos. Des espaces insécables : le
 * titre de la dernière se coupe « À 10, / la carte Fondateur. » et pas
 * « À 10, la / carte Fondateur. » ; « à 10 : » ne se coupe pas.
 */
export function textesParrainage(paliers: readonly PalierRecrues[] = PALIERS_RECRUES): { titre: string; ligne: string }[] {
  const skins = paliersSkins(paliers);
  const haut = skins[skins.length - 1];
  const avant = skins.slice(0, -1).map((p) => `${p.titre} à\u00a0${p.n}`);
  return [
    { titre: "Ramène tes potes.", ligne: "Ton lien ouvre ta carte." },
    { titre: `Une recrue, +${XP_RECRUE} XP.`, ligne: "Elle compte dès son premier match joué. Sans plafond." },
    {
      titre: `À ${haut.n}, la\u00a0carte\u00a0${haut.titre}.`,
      ligne: `${avant.join(", ")}. ${haut.titre} à\u00a0${haut.n}\u00a0: numérotée sur ${FONDATEURS_MAX}, jamais réémise.`,
    },
  ];
}

/**
 * Sous la carte de la première diapo, ce que lit celui qui ouvre mon lien :
 * qui l'invite, et ce que mon lien lui offre. Seul le lien d'un joueur de la
 * SFL offre Bola Team (la page Inviter) : rien pour un joueur Bola.
 */
export function lignesInvitation(nom: string, bola: boolean): { invite: string; offert: string | null } {
  return { invite: `${nom} t'invite.`, offert: bola ? null : "Bola Team offert un mois" };
}

/** Le numéro d'exemple : celui de skins-recrues.ts (« N° 097 / 500 »). */
export const NUMERO_EXEMPLE = 97;

/**
 * Le numéro que porte la carte Fondateur de l'annonce : le mien si j'en ai
 * un ; sinon le prochain à poser (le plus haut numéro posé, comptes partis
 * compris, plus un, borné aux places) ; et celui de l'exemple tant que la
 * base n'a pas répondu.
 */
export function numeroAnnonce(mien: number | null, charge: boolean, plusHaut: number): number {
  if (mien) return mien;
  if (!charge) return NUMERO_EXEMPLE;
  return Math.min(FONDATEURS_MAX, Math.max(0, plusHaut) + 1);
}

/** Le numéro seul, sous l'étiquette « Fondateur » : « N° 001 / 500 » (la fin de la ligne de série de la carte). */
export function numeroSeul(n: number): string {
  const serie = numeroFondateur(n);
  return serie.slice(serie.indexOf("N°"));
}
