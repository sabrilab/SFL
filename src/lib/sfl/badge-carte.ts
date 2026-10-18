// Le badge posé sur la carte d'un joueur, en haut à droite du portrait.
//
// Le joueur choisit lequel (demande de Sabri, 17/10) : par défaut son
// meilleur, sinon n'importe quel badge gagné, ou aucun. Le choix est une
// courte chaîne, gardée dans profiles.badge (voir badges-choisis.ts) :
//   · « auto »          — le meilleur, recalculé à chaque saison ;
//   · « aucun »         — le coin reste vide ;
//   · « s:pepite »…     — un classement de fin de saison (son meilleur podium) ;
//   · « p:buts »…       — un badge de palier (son palier atteint).
// Un choix qui ne correspond plus à rien de gagné retombe sur le meilleur.
//
// L'ordre du meilleur suit la hiérarchie de Sabri : un podium de fin de
// saison passe devant tout palier (1er avant 2e avant 3e, le Pépite d'Or
// avant les autres classements), puis les paliers du plus haut au plus bas.
//
// Calculé à partir de la saison, mis en cache par saison : la carte s'affiche
// dans les classements, des dizaines de fois par écran.

import { CLASSEMENTS, podiumsDe, type ClassementId } from "./fin-de-saison";
import { TROPHEES, vitrine, type TropheeId } from "./trophees";
import type { Saison } from "./saisie/types";

export type BadgeCarte =
  | { famille: "saison"; id: ClassementId; rang: number }
  | { famille: "palier"; id: TropheeId; palier: number };

export type ChoixBadge = string;

export function cleBadge(b: BadgeCarte): string {
  return b.famille === "saison" ? `s:${b.id}` : `p:${b.id}`;
}

const parSaison = new WeakMap<Saison, { podiums: Map<string, Map<ClassementId, number>>; joueurs: Map<string, BadgeCarte[]> }>();

function cache(saison: Saison) {
  let c = parSaison.get(saison);
  if (!c) {
    // Les podiums de toutes les saisons closes, une fois : nom → classement → meilleur rang.
    const podiums = new Map<string, Map<ClassementId, number>>();
    for (const def of CLASSEMENTS) {
      for (const p of podiumsDe(saison, def.id)) {
        const m = podiums.get(p.nom) ?? new Map<ClassementId, number>();
        m.set(def.id, Math.min(m.get(def.id) ?? 9, p.rang));
        podiums.set(p.nom, m);
      }
    }
    c = { podiums, joueurs: new Map() };
    parSaison.set(saison, c);
  }
  return c;
}

/** Tous les badges gagnés d'un joueur, du meilleur au plus modeste. */
export function badgesGagnes(saison: Saison, nom: string): BadgeCarte[] {
  const c = cache(saison);
  const deja = c.joueurs.get(nom);
  if (deja) return deja;
  const rangs = c.podiums.get(nom);
  const saisons: BadgeCarte[] = CLASSEMENTS.flatMap((def) => {
    const rang = rangs?.get(def.id);
    return rang ? [{ famille: "saison" as const, id: def.id, rang }] : [];
  }).sort((a, b) => a.rang - b.rang);
  const ordre = new Map(TROPHEES.map((t, i) => [t.id, i]));
  const paliers: BadgeCarte[] = vitrine(saison, nom, new Date())
    .filter((e) => e.palier > 0)
    .map((e) => ({ famille: "palier" as const, id: e.def.id, palier: e.palier }))
    .sort((a, b) => b.palier - a.palier || ordre.get(a.id)! - ordre.get(b.id)!);
  const tous = [...saisons, ...paliers];
  c.joueurs.set(nom, tous);
  return tous;
}

/** Le badge à poser sur la carte, selon le choix du joueur ; null si le coin reste vide. */
export function badgeDeCarte(saison: Saison, nom: string, choix: ChoixBadge | null | undefined): BadgeCarte | null {
  if (choix === "aucun") return null;
  const tous = badgesGagnes(saison, nom);
  return tous.find((b) => cleBadge(b) === choix) ?? tous[0] ?? null;
}
