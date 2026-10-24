// Le compte vitrine — un compte masqué qui se voit rempli, sur son seul écran.
//
// Sabri, 24/10/2026 : « je suis connecté et je veux voir, par exemple sur ma
// carte, des espèces de badges, des trucs […] que ça n'apparaisse pas dans
// les classements de tout le monde […] juste pour que je voie comment un
// utilisateur lambda pourrait voir toutes les interfaces ».
//
// Son compte est masqué (hidden.ts) et n'a joué aucun dimanche : Ma carte
// restait vide. Ici, sur SON téléphone seulement, la saison qu'il lit porte
// en plus les dimanches d'un vrai joueur de la ligue, son modèle, recopiés à
// son nom : ses lignes de la saison en cours et des saisons closes, sa base
// de carte, et ses réponses aux missions (use-missions.ts). Tout ce qui se
// dérive de la saison (Ma saison, l'Évolution, Mes cartes, les badges, les
// trophées, le Niveau XP) se remplit donc comme pour n'importe quel joueur.
//
// Ce qui ne bouge pas :
//   - les autres : le compte reste masqué, aucun classement, aucune liste,
//     aucun fil ne le montre, ni chez eux ni chez lui ;
//   - les scores : chaque ligne recopiée porte en bonus d'équipe l'opposé de
//     ses buts, le score d'un match reste celui de la feuille ;
//   - la base : les lignes recopiées sont marquées (`vitrine`), et la
//     sauvegarde comme la publication de la saison (saisie/store.ts,
//     saisie/sync.ts) les retirent avant d'écrire quoi que ce soit ;
//   - l'espace admin : la vitrine s'y éteint, l'admin voit la vraie feuille.
//
// ?vitrine=0 l'éteint sur le téléphone, ?vitrine=1 la rallume.

import type { MatchEntry, RosterEntry, Saison, SaisonArchivee } from "./saisie/types";

/** Le compte vitrine, et le joueur dont il recopie les dimanches. */
export const COMPTES_VITRINE: Readonly<Record<string, string>> = { Sabri: "Sidali" };

export interface Vitrine {
  nom: string;
  modele: string;
}

const CLE = "bola-vitrine";

/** Éteinte sur ce téléphone (?vitrine=0) ? */
function eteinte(): boolean {
  try {
    const voulu = new URLSearchParams(window.location.search).get("vitrine");
    if (voulu === "0" || voulu === "1") localStorage.setItem(CLE, voulu);
    return localStorage.getItem(CLE) === "0";
  } catch {
    return false;
  }
}

/** La vitrine de ce compte, ou null (autre compte, espace admin, éteinte). */
export function vitrineDe(nom: string | null | undefined, chemin: string | null): Vitrine | null {
  if (!nom || !(nom in COMPTES_VITRINE)) return null;
  if (chemin?.startsWith("/admin")) return null;
  if (typeof window === "undefined" || eteinte()) return null;
  return { nom, modele: COMPTES_VITRINE[nom] };
}

/** Les lignes du modèle, à mon nom, sans effet sur le score de son équipe. */
function lignes(entries: MatchEntry[], v: Vitrine): MatchEntry[] {
  const copies: MatchEntry[] = entries
    .filter((e) => e.player === v.modele)
    .map((e) => ({ ...e, player: v.nom, teamScoreBonus: -e.buts, vitrine: true }));
  return copies.length ? [...entries.filter((e) => e.player !== v.nom), ...copies] : entries;
}

/** Ma fiche d'effectif, à la base du modèle (l'ancienne gardée pour la retirer). */
function effectif(roster: RosterEntry[], v: Vitrine): RosterEntry[] {
  const modele = roster.find((r) => r.name === v.modele);
  if (!modele) return roster;
  const moi = roster.find((r) => r.name === v.nom);
  const copie: RosterEntry = moi
    ? { ...moi, base: modele.base, vitrine: { base: moi.base } }
    : { ...modele, name: v.nom, vitrine: "ajout" };
  return moi ? roster.map((r) => (r === moi ? copie : r)) : [...roster, copie];
}

function archive(a: SaisonArchivee, v: Vitrine): SaisonArchivee {
  if (!a.entries.some((e) => e.player === v.modele)) return a;
  return { ...a, entries: lignes(a.entries, v), roster: effectif(a.roster, v) };
}

/** La saison telle que le compte vitrine la lit sur son téléphone. */
export function avecVitrine(saison: Saison, v: Vitrine | null): Saison {
  if (!v || !saison.entries.some((e) => e.player === v.modele)) return saison;
  return {
    ...saison,
    entries: lignes(saison.entries, v),
    roster: effectif(saison.roster, v),
    archives: saison.archives?.map((a) => archive(a, v)),
  };
}

const sansLignes = (entries: MatchEntry[]) => entries.filter((e) => !e.vitrine);

function sansEffectif(roster: RosterEntry[]): RosterEntry[] {
  if (!roster.some((r) => r.vitrine)) return roster;
  return roster.flatMap((r) => {
    if (!r.vitrine) return [r];
    if (r.vitrine === "ajout") return [];
    const { vitrine, ...reste } = r;
    return [{ ...reste, base: vitrine.base }];
  });
}

/** La vraie saison : tout ce que la vitrine avait ajouté, retiré. Appelé avant toute écriture. */
export function sansVitrine(saison: Saison): Saison {
  const touchee =
    saison.entries.some((e) => e.vitrine) ||
    saison.roster.some((r) => r.vitrine) ||
    !!saison.archives?.some((a) => a.entries.some((e) => e.vitrine) || a.roster.some((r) => r.vitrine));
  if (!touchee) return saison;
  return {
    ...saison,
    entries: sansLignes(saison.entries),
    roster: sansEffectif(saison.roster),
    archives: saison.archives?.map((a) => ({ ...a, entries: sansLignes(a.entries), roster: sansEffectif(a.roster) })),
  };
}
