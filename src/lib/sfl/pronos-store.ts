"use client";

// Les pronos Bola (lib/sfl/pronos.ts) : les charger, en poser un, en retirer un.
//
// En base (supabase/schema.sql, table pronos) : on n'écrit que par
// pronostiquer(), qui pose le nom (mon_nom) et l'heure du serveur, jamais
// celle du téléphone ; l'app ne retient qu'un prono posé avant le coup
// d'envoi. Toute la ligue lit tous les pronos : c'est ce qui fait les parts
// (« 62 % pour les Noirs »).
//
// Dans un aperçu (NEXT_PUBLIC_BOLA_ENV ≠ production), comme pour les
// missions, les pronos restent sur le téléphone : la base de la ligue n'a pas
// la table, et un essai ne doit jamais compter pour de vrai. Le reste de la
// ligue y est simulé (pronosDemo) pour voir les parts : jamais dans l'XP.

import { supabase } from "@/lib/supabase";
import { choixPermis, J_SAISON, SUJETS_SAISON, type JourneePronos, type Prono } from "./pronos";

export const PRONOS_EVENT = "sfl-pronos";
export const APERCU_PRONOS = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";
const CLE_APERCU = "sfl-pronos-apercu";

let cache: Prono[] = [];

const emit = () => window.dispatchEvent(new Event(PRONOS_EVENT));
const meme = (a: Pick<Prono, "saison" | "j" | "sujet" | "joueur">, b: Pick<Prono, "saison" | "j" | "sujet" | "joueur">) =>
  a.saison === b.saison && a.j === b.j && a.sujet === b.sujet && a.joueur === b.joueur;

function lireApercu(): Prono[] {
  if (!APERCU_PRONOS) return [];
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_APERCU) ?? "[]");
    return Array.isArray(brut) ? (brut as Prono[]) : [];
  } catch {
    return [];
  }
}

function ecrireApercu(liste: Prono[]) {
  try {
    localStorage.setItem(CLE_APERCU, JSON.stringify(liste));
  } catch {
    /* stockage plein ou interdit : le prono vit le temps de la page */
  }
}

export function pronosEnMemoire(): Prono[] {
  return cache;
}

/** Charge les pronos que la base montre (et, dans un aperçu, ceux du téléphone). */
export async function chargerPronos(depuisLaBase: boolean): Promise<void> {
  let lignes: Prono[] = [];
  if (depuisLaBase && !APERCU_PRONOS) {
    const { data, error } = await supabase().from("pronos").select("saison, j, sujet, joueur, choix, le");
    if (error) throw error;
    lignes = (data ?? []) as Prono[];
  }
  const apercu = lireApercu();
  cache = [...lignes.filter((l) => !apercu.some((a) => meme(a, l))), ...apercu];
  emit();
}

export type DemandeProno = Omit<Prono, "le" | "choix"> & { choix: string | null };

/** Poser un prono, ou le retirer (choix null). Dans un aperçu, il reste sur ce téléphone. */
export async function pronostiquer(d: DemandeProno): Promise<void> {
  let le = new Date().toISOString();
  if (APERCU_PRONOS) {
    const reste = lireApercu().filter((a) => !meme(a, d));
    ecrireApercu(d.choix ? [...reste, { ...d, choix: d.choix, le }] : reste);
  } else {
    const { data, error } = await supabase().rpc("pronostiquer", {
      p_saison: d.saison,
      p_j: d.j,
      p_sujet: d.sujet,
      p_choix: d.choix,
    });
    if (error) throw new Error("Prono refusé. Reconnecte-toi, puis réessaie.");
    if (typeof data === "string") le = data;
  }
  const reste = cache.filter((x) => !meme(x, d));
  cache = d.choix ? [...reste, { ...d, choix: d.choix, le }] : reste;
  emit();
}

/* --------------------------- La ligue d'un aperçu --------------------------- */

/** Un tirage fixe dans [0, 1), le même pour le même texte (FNV-1a, brassé). */
function tirage(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Le brassage final de murmur3 : deux textes voisins ne tombent plus côte à côte.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * La ligue simulée d'un aperçu : à peu près deux joueurs de la feuille sur
 * trois pronostiquent, toujours les mêmes choix d'une ouverture à l'autre.
 * Rien hors d'un aperçu, rien pour `sauf`.
 */
export function pronosDemo(p: JourneePronos | null, saison: number, candidats: string[], sauf: string | null): Prono[] {
  if (!APERCU_PRONOS || !candidats.length) return [];
  const liste: Prono[] = [];
  const le = new Date(Date.now() - 86_400_000).toISOString();
  const parmi = (cle: string, l: string[]) => l[Math.floor(tirage(cle) * l.length)];
  const joueurs = p?.joueurs.length ? p.joueurs : candidats;
  for (const joueur of joueurs) {
    if (joueur === sauf || tirage(`${saison}·${joueur}·oui`) > 0.66) continue;
    if (p) {
      for (const m of p.matchs) {
        const permis = choixPermis(p, m.n, joueur);
        // Les camps penchent : deux sur trois pour le même côté, comme une vraie ligue.
        const penche = tirage(`${p.j}·${m.n}`) < 0.5 ? "noirs" : "blancs";
        const t = tirage(`${p.j}·${m.n}·${joueur}`);
        const choix = permis.length === 1 ? permis[0] : t < 0.55 ? penche : t < 0.75 ? "nul" : penche === "noirs" ? "blancs" : "noirs";
        liste.push({ saison, j: p.j, sujet: `match:${m.n}`, joueur, choix, le });
      }
      const tete = p.joueurs.slice(0, 6);
      liste.push({ saison, j: p.j, sujet: "buteur", joueur, choix: parmi(`${p.j}·b·${joueur}`, tete), le });
      liste.push({ saison, j: p.j, sujet: "pepite", joueur, choix: parmi(`${p.j}·p·${joueur}`, tete), le });
    }
    for (const sujet of SUJETS_SAISON)
      liste.push({ saison, j: J_SAISON, sujet, joueur, choix: parmi(`${saison}·${sujet}·${joueur}`, candidats.slice(0, 5)), le });
  }
  return liste;
}
