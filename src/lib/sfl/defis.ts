// Les défis : le prochain badge de palier de chaque joueur, devenu mission
// (Sabri, 30/10/2026 : « il faudrait vraiment que tout le monde puisse avoir,
// sur sa propre interface, une notice de tel contrat […] Si, par exemple,
// quelqu'un est à 8 buts : challenge accepté pour atteindre le trophée des
// 10 buts »).
//
// Les Missions Bola ne tombent qu'avec les équipes du dimanche, et seulement
// pour les joueurs de la feuille : entre deux dimanches, ou pour un membre
// qui n'est pas sur la feuille (l'admin), la face Missions du mode Passe
// restait vide. Les défis, eux, sont toujours là : chaque badge de palier
// (trophees.ts) pas encore au plus haut en donne un, du plus proche au plus
// loin. Rien à accepter : ils sont pris d'office, ne coûtent rien et ne se
// ratent pas. « Défi accepté » quand il ne manque presque plus rien.
//
// L'XP : chaque palier franchi sur une journée de la SFL rapporte sa prime
// (PRIME_DEFI, choix par défaut du 30/10, calé sur les primes des missions du
// dimanche ; le rang suit la prime, rangDe). Seuls les paliers franchis à
// partir de DEFIS_DEPUIS paient : les badges déjà gagnés ne rapportent rien
// d'un coup. Comme le reste du journal, tout se recalcule depuis les feuilles,
// sur la saison que tout le monde lit : les mêmes chiffres sur chaque
// téléphone, donc dans le rang. Les matchs Bola d'un joueur avancent ses
// défis à l'écran (vitrine avec enPlus) mais ne paient pas ici : ils ne sont
// que sur son téléphone.
//
// Pur : ni React ni réseau.

import { journeeJouee, saisonDepuisArchive } from "./saisie/mutations";
import type { Saison } from "./saisie/types";
import { rangDe, type LigneXp, type Rang } from "./missions";
import { metal, NOM_METAL, TROPHEES, type EtatTrophee, type TropheeId } from "./trophees";

/** La prime d'un palier franchi : bronze, argent, or, rouge et or. */
export const PRIME_DEFI: readonly number[] = [100, 120, 150, 200];

/** Les paliers franchis à partir de cette journée paient (S1 J4, 1er novembre 2026). */
export const DEFIS_DEPUIS = { saison: 1, j: 4 };

/** « Défi accepté » : il en manque au plus autant. */
const PRESQUE = 2;

export interface Defi {
  etat: EtatTrophee;
  /** Le palier visé (1 = bronze…). */
  vise: number;
  manque: number;
  xp: number;
  rang: Rang;
  /** Il ne manque presque plus rien. */
  accepte: boolean;
  /** « Buts · Argent » */
  code: string;
  /** « Marque encore 2 buts. » */
  phrase: string;
}

/** Le nom court d'un badge, en tête de fiche. */
const COURT: Partial<Record<TropheeId, string>> = { mvp: "MVP" };
export const nomCourt = (id: TropheeId, nom: string) => COURT[id] ?? nom;

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Ce qu'il reste à faire, à la deuxième personne. */
export function phraseDefi(id: TropheeId, n: number, premiere = false): string {
  if (premiere && n === 1 && (id === "mvp" || id === "mur" || id === "impact"))
    return id === "mvp" ? "Sois MVP d'un match." : id === "mur" ? "Sois le Mur d'un match." : "Sois Impact d'un match.";
  switch (id) {
    case "buts":
      return `Marque encore ${pluriel(n, "but", "buts")}.`;
    case "passes":
      return `Fais encore ${pluriel(n, "passe D", "passes D")}.`;
    case "matchs":
      return `Joue encore ${pluriel(n, "dimanche", "dimanches")}.`;
    case "victoires":
      return `Gagne encore ${pluriel(n, "match", "matchs")}.`;
    case "mvp":
      return n > 1 ? `Sois encore ${n} fois MVP du match.` : "Sois MVP du match une fois de plus.";
    case "mur":
      return n > 1 ? `Sois encore ${n} fois le Mur du match.` : "Sois le Mur du match une fois de plus.";
    case "impact":
      return n > 1 ? `Sois encore ${n} fois Impact du match.` : "Sois Impact du match une fois de plus.";
  }
}

export const primeDefi = (vise: number) => PRIME_DEFI[Math.min(vise, PRIME_DEFI.length) - 1];

/** Les défis d'un joueur, du plus proche au plus loin ; aucun pour un badge au plus haut. */
export function defisDe(etats: EtatTrophee[]): Defi[] {
  return etats
    .filter((e) => e.cible != null)
    .map((e) => {
      const vise = e.palier + 1;
      const manque = e.cible! - e.valeur;
      const xp = primeDefi(vise);
      return {
        etat: e,
        vise,
        manque,
        xp,
        rang: rangDe({ xp }),
        accepte: manque <= PRESQUE,
        code: `${nomCourt(e.def.id, e.def.nom)} · ${NOM_METAL[metal(vise)!]}`,
        phrase: phraseDefi(e.def.id, manque, e.valeur === 0),
      };
    })
    .sort((a, b) => a.manque - b.manque || b.etat.progression - a.etat.progression);
}

type Compteurs = Record<TropheeId, number>;
const zero = (): Compteurs => Object.fromEntries(TROPHEES.map((t) => [t.id, 0])) as Compteurs;

const apres = (saison: number, j: number) =>
  saison > DEFIS_DEPUIS.saison || (saison === DEFIS_DEPUIS.saison && j >= DEFIS_DEPUIS.j);

/**
 * Les lignes d'XP des défis : journée par journée, toutes saisons, les
 * compteurs de chacun (comme trophees.ts, sur les journées jouées) ; un palier
 * franchi à partir de DEFIS_DEPUIS paie sa prime.
 */
export function lignesDefis(s: Saison): { joueur: string; ligne: LigneXp }[] {
  const saisons = [
    ...[...(s.archives ?? [])].sort((a, b) => a.numero - b.numero).map((a) => ({ numero: a.numero, lue: saisonDepuisArchive(a) })),
    { numero: s.numero ?? 0, lue: s },
  ];
  const compte = new Map<string, Compteurs>();
  const out: { joueur: string; ligne: LigneXp }[] = [];
  for (const sa of saisons) {
    const journees = [...sa.lue.journees].sort((a, b) => a.j - b.j).filter((m) => journeeJouee(sa.lue, m.j));
    for (const m of journees) {
      const lignes = sa.lue.entries.filter((e) => e.j === m.j && e.statut === "Présent" && !e.extraTime);
      const joueurs = new Set(lignes.map((e) => e.player));
      for (const nom of joueurs) {
        let c = compte.get(nom);
        if (!c) compte.set(nom, (c = zero()));
        const avant = { ...c };
        c.matchs += 1;
        for (const e of lignes) {
          if (e.player !== nom) continue;
          c.buts += e.buts;
          c.passes += e.passes;
          if (e.result === "Victoire") c.victoires += 1;
          if (e.mvp) c.mvp += 1;
          if (e.def) c.mur += 1;
          if (e.impact) c.impact += 1;
        }
        if (!apres(sa.numero, m.j)) continue;
        for (const def of TROPHEES) {
          def.paliers.forEach((seuil, i) => {
            if (avant[def.id] >= seuil || c[def.id] < seuil) return;
            out.push({
              joueur: nom,
              ligne: {
                saison: sa.numero,
                j: m.j,
                date: m.date,
                quoi: `Défi · ${def.nom} ${NOM_METAL[metal(i + 1)!].toLowerCase()}`,
                xp: primeDefi(i + 1),
                defi: true,
              },
            });
          });
        }
      }
    }
  }
  return out;
}

/** Ajoute les défis réussis au journal d'XP (use-missions.ts, après journalXp). */
export function ajouterDefis(journal: Map<string, { lignes: LigneXp[]; reussies: number }>, s: Saison): void {
  for (const { joueur, ligne } of lignesDefis(s)) {
    let x = journal.get(joueur);
    if (!x) journal.set(joueur, (x = { lignes: [], reussies: 0 }));
    x.lignes.push(ligne);
  }
}
