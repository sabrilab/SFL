// Les recrues (Sabri, 27/10/2026) : un filleul (parrainage.ts) ne compte
// qu'une fois qu'il a vraiment joué son premier match après la création de
// son compte (une ligne de feuille validée, dans un match d'au moins 4
// présents qui ne sont pas tous les filleuls d'un même parrain). La règle vit
// en base (supabase/schema.sql, presences_reelles → premiers_matchs →
// recrues), qui seule voit les matchs privés et qui a fait venir qui ; l'app
// ne lit que le résultat :
//   · recrues_de_la_ligue() : par parrain, ses recrues actives, la date de
//     chaque activation et son numéro de Fondateur (sans un nom de filleul) ;
//   · mes_recrues() : mes filleuls, nom par nom, actifs ou en attente.
// Ici, la part pure : l'XP. Chaque recrue active vaut +100 XP à son parrain,
// sans plafond, une ligne « Recrue · <nom> · 1er match » dans le journal
// (missions.ts, journalXp), à la saison et au dimanche de son activation.
// Ces lignes sont hors du rang (horsRang) : elles montent le Niveau et le
// passe, jamais le rang B, A, S (classementNiveau avec pourLeRang), jamais
// une épreuve (elles n'ont pas de mission), jamais la Pépite d'Or (le moteur
// ne lit pas le journal). Le nom n'est connu que de mes propres recrues : sur
// le journal d'un autre, « Recrue · 1er match ».

import { XP_RECRUE } from "@/components/sfl/skins-recrues";
import type { LigneXp } from "@/lib/sfl/missions";
import type { JourneeMeta, Saison } from "@/lib/sfl/saisie/types";

/** Ce que la ligue sait des recrues d'un joueur. */
export interface RecruesJoueur {
  /** Le nom de saison du parrain (la clé de la ligue). */
  nom: string;
  actives: number;
  /** La date (ISO) de chaque activation, de la plus ancienne à la plus récente. */
  activations: string[];
  /** Son numéro de Fondateur, s'il en a un. */
  fondateur: number | null;
}

/** Un de mes filleuls. */
export interface MaRecrue {
  id: string;
  nom: string;
  inscritLe: string;
  /** Son premier vrai match ; null : inscrit, pas encore joué. */
  activeLe: string | null;
  /**
   * Il compte pour mes paliers (compte validé, code pas coupé). Sinon, même
   * s'il a joué, il reste « en attente » sur Inviter.
   */
  compte: boolean;
}

/** Mes recrues actives : celles qui comptent et ont joué. */
export const estActive = (r: MaRecrue): boolean => r.compte && !!r.activeLe;

// Les mois des étiquettes de journée (« 26 oct. », « 3 févr. ») : quatre
// lettres au moins, juin et juillet ne se confondent pas.
const MOIS: [RegExp, number][] = [
  [/janv/, 0],
  [/fev/, 1],
  [/mars/, 2],
  [/avr/, 3],
  [/mai/, 4],
  [/juin/, 5],
  [/juil/, 6],
  [/aou/, 7],
  [/sep/, 8],
  [/oct/, 9],
  [/nov/, 10],
  [/dec/, 11],
];

/** Le jour d'une étiquette de journée, l'année tirée de la référence (comme date_de_journee en base). */
export function jourDeJournee(etiquette: string, reference: Date): Date | null {
  const t = etiquette
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const d = Number(t.match(/\d{1,2}/)?.[0]);
  const m = MOIS.find(([r]) => r.test(t))?.[1];
  if (!d || m === undefined) return null;
  let x = new Date(reference.getFullYear(), m, d);
  if (x.getTime() > reference.getTime() + 7 * 86400_000) x = new Date(reference.getFullYear() - 1, m, d);
  return x;
}

/**
 * La saison et le dimanche d'une activation : la première saison close après
 * elle, sinon celle en cours. Aussi l'XP d'un match Bola (lib/sfl/carte-bola.ts).
 */
export function placeDe(s: Saison, t: Date, maintenant: Date): { saison: number; j: number } {
  const archives = [...(s.archives ?? [])].sort((a, b) => a.cloturee.localeCompare(b.cloturee));
  const close = archives.find((a) => new Date(a.cloturee).getTime() >= t.getTime());
  const { numero, journees, reference } = close
    ? { numero: close.numero, journees: close.journees, reference: new Date(close.cloturee) }
    : { numero: s.numero ?? 0, journees: s.journees, reference: maintenant };
  const fin = new Date(t);
  fin.setHours(23, 59, 59, 999);
  let j = 0;
  for (const m of journees as JourneeMeta[]) {
    const jour = jourDeJournee(m.date ?? "", reference);
    if (jour && jour.getTime() <= fin.getTime() && m.j > j) j = m.j;
  }
  // Avant la première journée datée de sa saison (ou sans date lisible) : la
  // première journée, jamais une « J0 » avant tous les dimanches.
  if (j === 0 && journees.length) j = Math.min(...(journees as JourneeMeta[]).map((m) => m.j));
  return { saison: numero, j };
}

const dateCourte = (t: Date) => t.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

/**
 * Ajoute au journal d'XP une ligne par recrue active de chacun (+100, sans
 * plafond), hors du rang. `moi` : mon nom et mes recrues, pour les nommer.
 */
export function ajouterRecrues(
  journal: Map<string, { lignes: LigneXp[]; reussies: number }>,
  s: Saison,
  ligue: readonly RecruesJoueur[],
  moi: { nom: string; recrues: readonly MaRecrue[] } | null,
  maintenant: Date
): void {
  for (const r of ligue) {
    // Une entrée pour chacun, même sans activation (un Fondateur dont les
    // recrues sont parties) : les cartes la lisent (surLesCartes).
    const x = journal.get(r.nom) ?? { lignes: [], reussies: 0 };
    journal.set(r.nom, x);
    if (!r.activations.length) continue;
    const noms =
      moi && moi.nom === r.nom
        ? moi.recrues
            .filter(estActive)
            .sort((a, b) => a.activeLe!.localeCompare(b.activeLe!))
            .map((x) => x.nom)
        : [];
    const activations = [...r.activations].sort();
    activations.forEach((iso, i) => {
      const t = new Date(iso);
      if (Number.isNaN(t.getTime()) || t.getTime() > maintenant.getTime()) return;
      const { saison, j } = placeDe(s, t, maintenant);
      const nom = noms.length === activations.length ? noms[i] : null;
      x.lignes.push({
        saison,
        j,
        date: dateCourte(t),
        quoi: nom ? `Recrue · ${nom} · 1er match` : "Recrue · 1er match",
        xp: XP_RECRUE,
        horsRang: true,
      });
    });
  }
}
