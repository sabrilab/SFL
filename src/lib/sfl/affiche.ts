// L'affiche du match (Sabri, 31/10 : « générer une image des deux joueurs
// les plus forts automatiquement, comme ça ça pourrait être l'affiche du
// match » ; puis, devant l'essai Jouneid contre Zakary, il la préfère aux
// vignettes). Le meilleur des Noirs contre le meilleur des Blancs une fois
// les équipes faites ; avant, les deux meilleures notes parmi ceux qui
// viennent (ou les habitués). Elle prend la place du terrain dessiné sur la
// carte du match, et s'affiche en grand dans la page du lieu
// (app/map/page.tsx).
//
// L'image est faite une seule fois par paire, côté serveur (api/affiche :
// accord hors de l'app et photo de carte exigés, fal, bucket « affiches »).
// Ici, on la demande une fois par match et par session, et on la garde en
// mémoire ; une paire sans image laisse la carte avec son terrain.

import { useSyncExternalStore } from "react";
import { jetonServeur } from "./auth/session";
import { ovr, type Player } from "./engine";

export interface Affiche {
  image: string;
  joueurs: { nom: string; note: number }[];
}

/** Ce qu'on envoie pour un match : ses deux équipes, ou ses joueurs d'un seul tenant, triés par note. */
export type DemandeAffiche = { noirs: string[]; blancs: string[] } | { joueurs: string[] };

type Reponse = { image: string; joueurs: [string, string] } | null;

const cache = new Map<string, Reponse | "attente">();
const ecouteurs = new Set<() => void>();
let version = 0;
const signaler = () => {
  version++;
  for (const f of ecouteurs) f();
};

async function demander(cle: string, demande: DemandeAffiche, essai = 0): Promise<void> {
  const jeton = await jetonServeur();
  if (!jeton) {
    cache.set(cle, null);
    return;
  }
  const r = await fetch("/api/affiche", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
    body: JSON.stringify(demande),
  }).catch(() => null);
  const sortie = r?.ok ? ((await r.json().catch(() => null)) as { image?: string; joueurs?: [string, string]; attente?: boolean } | null) : null;
  // Une autre session la fait en ce moment : on repasse un peu plus tard.
  if (sortie?.attente && essai < 6) {
    setTimeout(() => void demander(cle, demande, essai + 1), 20_000);
    return;
  }
  cache.set(cle, sortie?.image && sortie.joueurs ? { image: sortie.image, joueurs: sortie.joueurs } : null);
  signaler();
}

/** Relit les affiches à chaque réponse du serveur. */
export function useAffiches(): number {
  return useSyncExternalStore(
    (f) => {
      ecouteurs.add(f);
      return () => ecouteurs.delete(f);
    },
    () => version,
    () => 0
  );
}

/** Trie des noms par note, la meilleure d'abord. */
export function parNote(noms: readonly string[], joueur: (nom: string) => Player | undefined): string[] {
  return [...new Set(noms)]
    .map((nom) => ({ nom, note: joueur(nom) ? ovr(joueur(nom)!.stats) : -1 }))
    .filter((x) => x.note >= 0)
    .sort((a, b) => b.note - a.note || a.nom.localeCompare(b.nom, "fr"))
    .map((x) => x.nom);
}

/** L'affiche de ce match si elle est prête ; la demande au serveur la première fois. */
export function afficheDe(demande: DemandeAffiche, joueur: (nom: string) => Player | undefined): Affiche | null {
  const tous = "joueurs" in demande ? demande.joueurs : [...demande.noirs, ...demande.blancs];
  if (tous.length < 2 || ("noirs" in demande && (!demande.noirs.length || !demande.blancs.length))) return null;
  const cle = JSON.stringify(demande);
  const deja = cache.get(cle);
  if (deja === undefined) {
    cache.set(cle, "attente");
    if (typeof window !== "undefined") void demander(cle, demande);
    return null;
  }
  if (!deja || deja === "attente") return null;
  return {
    image: deja.image,
    // Le serveur rend [Noir, Blanc] ; sur l'image, le Blanc est à gauche.
    joueurs: [deja.joueurs[1], deja.joueurs[0]].map((nom) => ({ nom, note: joueur(nom) ? ovr(joueur(nom)!.stats) : 0 })),
  };
}
