"use client";

// Suis-je un joueur Bola, hors de la SFL ? (Sabri, 26/10/2026 : « utilisateur
// Bola qui n'est pas à la SFL : le côté SFL doit lui être invisible, ou en
// tout cas, on peut entrer juste avec la créditation SFL ».)
//
// Venu par le lien d'un parrain, pas dans l'effectif de la saison, pas
// admin : la règle vit en base (supabase/schema.sql : hors_sfl). Pour lui,
// la Map n'a pas les journées de la SFL, les Actus s'ouvrent sur Bola, et
// les pages de la ligue (saisons, palmarès, Vestiaire) le renvoient chez
// Bola (components/sfl/porte-sfl.tsx).
//
// On ne devine rien sur le téléphone (la saison peut arriver après la
// session, et un joueur SFL passerait un instant pour un joueur Bola) : la
// réponse vient de la base, gardée sur le téléphone pour l'ouverture
// suivante. useHorsSfl : false tant qu'on ne sait pas, et si la base ne
// connaît pas encore la fonction (une préversion avant la mise en ligne) :
// l'app reste telle qu'avant.
//
// useHorsSflEtat dit aussi « on ne sait pas encore » (null) : à la toute
// première ouverture d'un compte, avant la réponse de la base. Ce qui montre
// la SFL (Actus et convocation sur la Map, pages de la ligue) attend alors,
// au lieu de la montrer un instant à un joueur Bola (28/10/2026). La réponse
// gardée sur le téléphone fait que, pour un joueur SFL, cette attente n'a
// lieu qu'une fois. Une base qui ne connaît pas la fonction répond « non ».

import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/lib/supabase";

const CLE = "bola-hors-sfl";

interface Etat {
  qui: string | null;
  hors: boolean;
}

const VIDE: Etat = { qui: null, hors: false };

let etat: Etat | null = null;
const abonnes = new Set<() => void>();
const enVol = new Map<string, Promise<void>>();

function lire(): Etat {
  if (etat) return etat;
  try {
    const brut = localStorage.getItem(CLE);
    etat = brut ? (JSON.parse(brut) as Etat) : VIDE;
  } catch {
    etat = VIDE;
  }
  return etat;
}

function abonner(f: () => void) {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}

function relire(qui: string): Promise<void> {
  const deja = enVol.get(qui);
  if (deja) return deja;
  const p = (async () => {
    try {
      const { data, error } = await supabase().rpc("hors_sfl");
      if (error) {
        // La base a répondu sans connaître la fonction (préversion) : « non »,
        // pour cette ouverture seulement (rien de gardé). Une coupure réseau
        // lève plus bas et laisse l'état inconnu, relu à la prochaine fois.
        if (!etat || etat.qui !== qui) {
          etat = { qui, hors: false };
          for (const f of abonnes) f();
        }
        return;
      }
      etat = { qui, hors: data === true };
      try {
        localStorage.setItem(CLE, JSON.stringify(etat));
      } catch {}
      for (const f of abonnes) f();
    } catch {}
  })().finally(() => enVol.delete(qui));
  enVol.set(qui, p);
  return p;
}

/** true : joueur Bola ; false : non ; null : la base n'a pas encore répondu pour ce compte. */
export function useHorsSflEtat(): boolean | null {
  const session = useSession();
  const qui = session?.server && !session.enAttente ? session.user : null;
  const lu = useSyncExternalStore(abonner, lire, () => VIDE);

  useEffect(() => {
    if (qui) void relire(qui);
  }, [qui]);

  if (!qui || session?.admin) return false;
  return lu.qui === qui ? lu.hors : null;
}

export function useHorsSfl(): boolean {
  return useHorsSflEtat() === true;
}
