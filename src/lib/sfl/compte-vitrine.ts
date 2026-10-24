// Le compte vitrine — un compte masqué qui se voit rempli, sur son seul écran.
//
// Sabri, 24/10/2026 : « je suis connecté et je veux voir, par exemple sur ma
// carte, des espèces de badges, des trucs […] que ça n'apparaisse pas dans
// les classements de tout le monde […] juste pour que je voie comment un
// utilisateur lambda pourrait voir toutes les interfaces ».
//
// Son compte est masqué (hidden.ts) et n'a joué aucun dimanche : Ma carte
// restait vide. Puis, le même soir : « À moi, tu me donnes tout : les
// meilleures stats, les meilleurs trucs […] Tout, tout, tout. Sauf que tu me
// montres à personne. » Ici, sur SON téléphone seulement, il a donc tout au
// plus haut :
//   - chaque dimanche joué de chaque saison (en cours et closes), une ligne à
//     son nom avec le meilleur de la journée : le plus de buts, de passes,
//     d'arrêts et d'interceptions, une victoire, MVP, Impact et Défensive. Il
//     finit premier de tous les classements, donc tous les trophées ;
//   - sa base de carte, 99 partout (sa fiche d'effectif) ;
//   - tous les badges de palier au plus haut, rouge et or (trophees.ts) ;
//   - le Passe Bola au palier 20, toutes les épreuves, le rang S et tous les
//     crans (use-missions.ts) ;
//   - la D1 quand la ligue est coupée en divisions (use-division.ts).
//
// Ce qui ne bouge pas :
//   - les autres : le compte reste masqué, aucun classement, aucune liste,
//     aucun fil ne le montre, ni chez eux ni chez lui ;
//   - les scores : chaque ligne ajoutée porte en bonus d'équipe l'opposé de
//     ses buts, le score d'un match reste celui de la feuille ;
//   - la base : les lignes ajoutées sont marquées (`vitrine`), et la
//     sauvegarde comme la publication de la saison (saisie/store.ts,
//     saisie/sync.ts) les retirent avant d'écrire quoi que ce soit ;
//   - l'espace admin : la vitrine s'y éteint, l'admin voit la vraie feuille.
//
// ?vitrine=0 l'éteint sur le téléphone, ?vitrine=1 la rallume.

import type { MatchEntry, RosterEntry, Saison, SaisonArchivee } from "./saisie/types";

/** Les comptes vitrine. */
export const COMPTES_VITRINE: readonly string[] = ["Sabri"];

export interface Vitrine {
  nom: string;
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
  if (!nom || !COMPTES_VITRINE.includes(nom)) return null;
  if (chemin?.startsWith("/admin")) return null;
  if (typeof window === "undefined" || eteinte()) return null;
  return { nom };
}

// Le compte vitrine en cours, pour les calculs qui ne lisent que la saison
// (les badges de palier, trophees.ts). Posé par avecVitrine.
let active: string | null = null;

/** Ce nom est-il celui du compte vitrine, sur ce téléphone ? */
export function estVitrine(nom: string | null | undefined): boolean {
  return !!nom && nom === active;
}

const max = (lignes: MatchEntry[], f: (e: MatchEntry) => number) => Math.max(0, ...lignes.map(f));

/** Le meilleur de chaque journée, à mon nom, sans effet sur le score de son équipe. */
function lignes(entries: MatchEntry[], nom: string): MatchEntry[] {
  const reelles = entries.filter((e) => e.player !== nom);
  const copies: MatchEntry[] = [];
  for (const j of [...new Set(reelles.map((e) => e.j))].sort((a, b) => a - b)) {
    const du = reelles.filter((e) => e.j === j && e.statut === "Présent" && !e.extraTime);
    if (!du.length) continue;
    // Une équipe gagnante quand il y en a une : la victoire compte aussi.
    const modele = du.find((e) => e.result === "Victoire") ?? du[0];
    const joue = modele.result != null;
    const buts = max(du, (e) => e.buts);
    copies.push({
      j,
      player: nom,
      team: modele.team,
      statut: "Présent",
      result: modele.result,
      sflTime: true,
      buts,
      passes: max(du, (e) => e.passes),
      cleanSheet: joue,
      mvp: joue,
      impact: joue,
      def: joue,
      retard: false,
      arrets: max(du, (e) => e.arrets ?? 0),
      interceptions: max(du, (e) => e.interceptions ?? 0),
      teamScoreBonus: -buts,
      vitrine: true,
    });
  }
  return copies.length ? [...reelles, ...copies] : entries;
}

const BASE_MAX = [99, 99, 99, 99, 99, 99];

/** Ma fiche d'effectif, à 99 partout (l'ancienne base gardée pour la retirer). */
function effectif(roster: RosterEntry[], nom: string): RosterEntry[] {
  const moi = roster.find((r) => r.name === nom);
  if (!moi) return [...roster, { name: nom, poste: null, profil: "Actif", base: BASE_MAX, vitrine: "ajout" }];
  return roster.map((r) => (r === moi ? { ...moi, base: BASE_MAX, vitrine: { base: moi.base } } : r));
}

function archive(a: SaisonArchivee, nom: string): SaisonArchivee {
  return { ...a, entries: lignes(a.entries, nom), roster: effectif(a.roster, nom) };
}

/** La saison telle que le compte vitrine la lit sur son téléphone. */
export function avecVitrine(saison: Saison, v: Vitrine | null): Saison {
  active = v?.nom ?? null;
  if (!v) return saison;
  return {
    ...saison,
    entries: lignes(saison.entries, v.nom),
    roster: effectif(saison.roster, v.nom),
    archives: saison.archives?.map((a) => archive(a, v.nom)),
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
