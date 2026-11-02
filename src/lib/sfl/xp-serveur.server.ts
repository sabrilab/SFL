// L'XP calculée par le SERVEUR (Ilyes, 01/11/2026 : « sur mon téléphone j'en
// ai plein de déverrouillés […] sur l'ordinateur ils sont verrouillés »).
// Rien n'était stocké : chaque appareil recalculait l'XP de toute la ligue
// avec ce qu'il avait chargé, et il suffisait qu'il manque les réponses aux
// missions pour que le Passe tombe à 4/16. Le serveur fait foi :
//   · il lit la base comme l'outsider (outsider/annoncer) : la saison publiée,
//     votes appliqués, les réponses aux missions, les félicitations, et en plus
//     les pronos du Flair, les recrues et, pour celui qui appelle, ses matchs
//     Bola (par son propre jeton : mes_recrues et mes_matchs_bola lisent
//     auth.uid()) ;
//   · il calcule le même journal que le téléphone (xp-calcul.ts, journalComplet) ;
//   · il garde le palier atteint par chacun dans passe_acquis
//     (poser_paliers_acquis : un palier n'y redescend jamais) ;
//   · il rend le bilan de l'appelant, que l'app garde en cache.
// Le compte vitrine n'y entre jamais (son XP fictive vit sur son téléphone).
//
// Serveur seulement : la clé secrète (serveur-ligue.server.ts).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { carteBola } from "./carte-bola";
import { compterMatchs, type MatchBola } from "./ligue-vierge";
import { bilanDe, paliersDe, type FelicitationXp, type Reponse } from "./missions";
import { EPREUVES_BOLA } from "./passe";
import type { Prono } from "./pronos";
import type { MaRecrue, RecruesJoueur } from "./recrues";
import { SAISONS_PASSE } from "./saisons-passe";
import { lireSaisonServeur, toutesLesLignes } from "./saison-serveur.server";
import { journalComplet, type JournalXp } from "./xp-calcul";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tpfusliksgxcvfrodchk.supabase.co";
const CLE_PUBLIQUE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Un client qui agit au nom de l'appelant (son jeton) : pour les fonctions qui lisent auth.uid(). */
function auNomDe(jeton: string): SupabaseClient | null {
  if (!CLE_PUBLIQUE) return null;
  return createClient(SUPABASE_URL, CLE_PUBLIQUE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jeton}` } },
  });
}

const memeNom = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Le bilan d'un joueur tel que le serveur le rend (et que l'app garde : sfl-xp-bilan). */
export interface BilanServeur {
  nom: string;
  total: number;
  niveau: number;
  dansLeNiveau: number;
  pourLeSuivant: number;
  /** Par saison du Passe : l'XP de la saison et le palier atteint (au moins celui gardé). */
  saisons: Record<string, { xp: number; palier: number }>;
  calculeLe: string;
}

export interface XpServeur {
  journal: JournalXp;
  /** Le joueur qui appelle, en joueur Bola (hors de la SFL) : son passe suit EPREUVES_BOLA. */
  bola: boolean;
  /** Les noms de la saison (l'effectif) : ceux dont le palier se garde. */
  effectif: Set<string>;
  /** Nom → identifiant de compte. */
  idDeNom: Map<string, string>;
}

/**
 * Le journal d'XP de toute la ligue, lu dans la base. Lève une erreur si une
 * table est illisible : l'XP serait fausse, l'appelant répond « réessaie ».
 */
export async function xpServeur(sb: SupabaseClient, appelant: { id: string; nom: string; jeton: string }, maintenant = new Date()): Promise<XpServeur> {
  const lue = await lireSaisonServeur(sb, maintenant);
  if (!lue) throw new Error("Saison illisible.");
  type Felicitation = { de: string; a: string; exploit: string; saison: number; j: number };
  type LigneLigue = { nom: string; actives: number; activations: string[] | null; fondateur: number | null };
  type LigneMienne = { filleul: string; nom: string; inscrit_le: string; active_le: string | null; compte: boolean | null };
  const lui = auNomDe(appelant.jeton);
  const [reponses, felicitationsBrutes, pronos, profils, ligue, miennes, matchs] = await Promise.all([
    toutesLesLignes<Reponse>(sb, "missions_reponses", "saison, j, mission, joueur, reponse, cible, le", ["saison", "j", "mission", "joueur"]),
    toutesLesLignes<Felicitation>(sb, "felicitations", "de, a, exploit, saison, j", ["id"]),
    toutesLesLignes<Prono>(sb, "pronos", "saison, j, sujet, joueur, choix, le", ["saison", "j", "sujet", "joueur"]),
    toutesLesLignes<{ id: string; name: string }>(sb, "profiles", "id, name", ["id"]),
    lui ? lui.rpc("recrues_de_la_ligue") : Promise.resolve({ data: [], error: null }),
    lui ? lui.rpc("mes_recrues") : Promise.resolve({ data: [], error: null }),
    lui ? lui.rpc("mes_matchs_bola") : Promise.resolve({ data: [], error: null }),
  ]);
  if (ligue.error) throw ligue.error;
  const idDeNom = new Map(profils.map((p) => [p.name, p.id]));
  const nomDeId = new Map(profils.map((p) => [p.id, p.name]));
  const felicitations: FelicitationXp[] = felicitationsBrutes.flatMap((f) => {
    const de = nomDeId.get(f.de);
    const a = nomDeId.get(f.a);
    return de && a ? [{ de, a, exploit: f.exploit, saison: f.saison, j: f.j }] : [];
  });
  const ligueRecrues: RecruesJoueur[] = ((ligue.data ?? []) as LigneLigue[]).map((l) => ({
    nom: l.nom,
    actives: l.actives,
    activations: l.activations ?? [],
    fondateur: l.fondateur ?? null,
  }));
  const mesRecrues: MaRecrue[] = miennes.error
    ? []
    : ((miennes.data ?? []) as LigneMienne[]).map((l) => ({
        id: l.filleul,
        nom: l.nom,
        inscritLe: l.inscrit_le,
        activeLe: l.active_le,
        compte: l.compte !== false,
      }));
  const effectif = new Set((lue.saison.roster ?? []).map((r) => r.name));
  const bola = ![...effectif].some((n) => memeNom(n, appelant.nom));
  const mesMatchs = matchs.error ? [] : ((matchs.data ?? []) as MatchBola[]);
  const bolaCarte = mesMatchs.length ? carteBola(compterMatchs(mesMatchs), appelant.id, appelant.nom, null) : null;
  const journal = journalComplet({
    jugee: lue.saison,
    reponses,
    votes: lue.votes,
    felicitations,
    pronos,
    ligueRecrues,
    moi: { nom: appelant.nom, recrues: mesRecrues },
    bolaCarte,
    maintenant,
  });
  return { journal, bola, effectif, idDeNom };
}

/** Les paliers à garder : un par joueur de l'effectif (et l'appelant) et par saison du Passe atteinte. */
export function paliersAGarder(
  x: XpServeur,
  appelant: string,
  maintenant: Date
): { joueur: string; saison_passe: string; palier: number; xp_saison: number }[] {
  const out: { joueur: string; saison_passe: string; palier: number; xp_saison: number }[] = [];
  for (const nom of x.journal.keys()) {
    const id = x.idDeNom.get(nom);
    // Un joueur Bola autre que l'appelant : ses matchs ne sont pas lus ici, son palier se garde de son téléphone.
    if (!id || (!x.effectif.has(nom) && nom !== appelant)) continue;
    const epreuves = nom === appelant && x.bola ? EPREUVES_BOLA : undefined;
    const paliers = paliersDe(x.journal, nom, maintenant, epreuves);
    for (const s of SAISONS_PASSE) {
      const palier = paliers[s.id] ?? 0;
      if (palier <= 0) continue;
      out.push({ joueur: id, saison_passe: s.id, palier, xp_saison: bilanDe(x.journal, nom, maintenant, epreuves, s).saison });
    }
  }
  return out;
}

/** Le bilan de l'appelant, ses paliers pris au plus haut avec ce qui est gardé. */
export function bilanServeurDe(x: XpServeur, nom: string, maintenant: Date, gardes: Record<string, number> = {}): BilanServeur {
  const epreuves = x.bola ? EPREUVES_BOLA : undefined;
  const b = bilanDe(x.journal, nom, maintenant, epreuves);
  const saisons: BilanServeur["saisons"] = {};
  for (const s of SAISONS_PASSE) {
    const bs = bilanDe(x.journal, nom, maintenant, epreuves, s);
    const palier = Math.max(bs.palier, gardes[s.id] ?? 0);
    if (palier > 0 || bs.saison > 0) saisons[s.id] = { xp: bs.saison, palier };
  }
  return {
    nom,
    total: b.total,
    niveau: b.niveau,
    dansLeNiveau: b.dansLeNiveau,
    pourLeSuivant: b.pourLeSuivant,
    saisons,
    calculeLe: maintenant.toISOString(),
  };
}
