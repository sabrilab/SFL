"use client";

// Les réponses aux missions du dimanche (lib/sfl/missions.ts) : accepter ou
// passer, jusqu'au coup d'envoi.
//
// En base (supabase/schema.sql, table missions_reponses) : on n'écrit que par
// repondre_mission(), qui pose le nom (mon_nom) et l'heure du serveur, jamais
// celle du téléphone ; on lit les siennes, et toutes les missions acceptées
// de la ligue (les Contrats en jeu des Actus). Un « passer » reste à celui
// qui l'a donné.
//
// Dans un aperçu (NEXT_PUBLIC_BOLA_ENV ≠ production), toutes les réponses
// restent sur le téléphone : la base de la ligue n'y est pas migrée, et un
// essai ne doit jamais compter pour de vrai. Quand on n'est pas sur la
// feuille, l'aperçu montre les missions d'un autre joueur ; elles ne partent
// pas non plus en base à son nom. Le reste de la ligue y est simulé
// (reponsesDemo), pour voir les contrats en jeu : jamais dans l'XP.

import { supabase } from "@/lib/supabase";
import type { Creneau, DimancheMissions, Reponse } from "./missions";

export const MISSIONS_EVENT = "sfl-missions";
export const APERCU_MISSIONS = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";
const CLE_APERCU = "sfl-missions-apercu";

let cache: Reponse[] = [];

function emit() {
  window.dispatchEvent(new Event(MISSIONS_EVENT));
}

const memeMission = (a: Reponse, b: Pick<Reponse, "saison" | "j" | "mission" | "joueur">) =>
  a.saison === b.saison && a.j === b.j && a.mission === b.mission && a.joueur === b.joueur;

function lireApercu(): Reponse[] {
  if (!APERCU_MISSIONS) return [];
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_APERCU) ?? "[]");
    return Array.isArray(brut) ? (brut as Reponse[]) : [];
  } catch {
    return [];
  }
}

export function reponsesEnMemoire(): Reponse[] {
  return cache;
}

/** Charge les réponses que la base nous montre (et, dans un aperçu, celles du téléphone). */
export async function chargerReponses(depuisLaBase: boolean): Promise<void> {
  let lignes: Reponse[] = [];
  if (depuisLaBase) {
    const { data, error } = await supabase()
      .from("missions_reponses")
      .select("saison, j, mission, joueur, reponse, cible, le");
    // Un aperçu tourne avant la migration de la base : la table n'y est pas encore.
    if (error && !APERCU_MISSIONS) throw error;
    lignes = (data ?? []) as Reponse[];
  }
  const apercu = lireApercu();
  cache = [...lignes.filter((l) => !apercu.some((a) => memeMission(a, l))), ...apercu];
  emit();
}

export interface Demande {
  saison: number;
  j: number;
  mission: Creneau;
  joueur: string;
  reponse: Reponse["reponse"];
  cible: string | null;
}

/** Accepter ou passer une mission. Dans un aperçu, la réponse reste sur ce téléphone. */
export async function repondreMission(d: Demande): Promise<void> {
  let le = new Date().toISOString();
  if (APERCU_MISSIONS) {
    try {
      localStorage.setItem(CLE_APERCU, JSON.stringify([...lireApercu().filter((a) => !memeMission(a, d)), { ...d, le }]));
    } catch {
      /* stockage plein ou interdit : la réponse vit le temps de la page */
    }
  } else {
    const { data, error } = await supabase().rpc("repondre_mission", {
      p_saison: d.saison,
      p_j: d.j,
      p_mission: d.mission,
      p_reponse: d.reponse,
      p_cible: d.cible,
    });
    if (error) throw new Error("Réponse refusée. Reconnecte-toi, puis réessaie.");
    if (typeof data === "string") le = data;
  }
  cache = [...cache.filter((x) => !memeMission(x, d)), { ...d, le }];
  emit();
}

/* --------------------------- La ligue d'un aperçu --------------------------- */

/** Un tirage fixe dans [0, 1), le même pour le même texte (FNV-1a). */
function tirage(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** La part de la feuille qui accepte chaque mission, dans la ligue simulée. */
const PART_DEMO: Record<Creneau, number> = { contrat: 0.55, defi: 0.6, ligue: 0.45 };

/**
 * La ligue simulée d'un aperçu : à peu près un joueur de la feuille sur deux
 * accepte chacune de ses missions, toujours les mêmes d'une ouverture à
 * l'autre. Rien hors d'un aperçu ; rien pour `sauf`, dont les réponses sont
 * celles qu'on donne soi-même sur ce téléphone.
 */
export function reponsesDemo(d: DimancheMissions, sauf: string | null): Reponse[] {
  if (!APERCU_MISSIONS) return [];
  const liste: Reponse[] = [];
  for (const [joueur, missions] of d.missions) {
    if (joueur === sauf) continue;
    for (const m of missions) {
      const t = tirage(`${d.saison}·${d.j}·${joueur}·${m.creneau}`);
      if (t >= PART_DEMO[m.creneau]) continue;
      liste.push({
        saison: d.saison,
        j: d.j,
        mission: m.creneau,
        joueur,
        reponse: "acceptee",
        cible: m.creneau === "contrat" ? (m.cibles[0] ?? null) : null,
        le: new Date(d.coupEnvoi.getTime() - (2 + t * 40) * 3600_000).toISOString(),
      });
    }
  }
  return liste;
}

/* ------------------------------ L'annonce ------------------------------ */
// « Missions Bola · J3 » part du serveur (/api/missions/annoncer), une fois la
// feuille finie et une seule fois par joueur. L'app de chacun le sonne à
// l'ouverture tant qu'une journée a des missions ouvertes (MissionsAnnonce) :
// au plus toutes les 20 minutes par téléphone, et plus du tout pendant six
// heures quand le serveur répond que tout le monde est prévenu.

const CLE_ANNONCE = "sfl-missions-annonce";
const RELANCE = 20 * 60_000;
const REPOS = 6 * 3600_000;

export async function annoncerMissions(saison: number, j: number): Promise<void> {
  const cle = `${saison}-${j}`;
  let prochaine = 0;
  try {
    prochaine = Number((JSON.parse(localStorage.getItem(CLE_ANNONCE) ?? "{}") as Record<string, number>)[cle] ?? 0);
  } catch {
    /* mémoire illisible : on sonne */
  }
  if (prochaine > Date.now()) return;
  const noter = (dans: number) => {
    try {
      localStorage.setItem(CLE_ANNONCE, JSON.stringify({ [cle]: Date.now() + dans }));
    } catch {
      /* stockage interdit : on resonnera, le serveur ne renvoie rien deux fois */
    }
  };
  noter(RELANCE);
  try {
    const { data } = await supabase().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) return;
    const r = await fetch("/api/missions/annoncer", {
      method: "POST",
      headers: { Authorization: `Bearer ${jeton}` },
      keepalive: true,
    });
    const corps = (await r.json().catch(() => ({}))) as { fini?: boolean };
    if (corps.fini) noter(REPOS);
  } catch {
    /* une annonce perdue ne bloque rien : le prochain téléphone sonnera */
  }
}
