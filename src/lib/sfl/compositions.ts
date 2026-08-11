"use client";

// Compositions 5v5 — le dépôt d'équipe rêvée de chaque joueur.
//
// Un joueur compose son cinq idéal pour dimanche sur le terrain de l'Arène
// et le dépose. Une composition par joueur et par dimanche : la nouvelle
// remplace l'ancienne, mais la récompense (+5 ⚽) ne tombe qu'au premier
// dépôt de la semaine — sinon il suffirait de re-déposer en boucle.
//
// Les dépôts vivent en localStorage, et filent aussi vers Supabase quand la
// session est serveur (même modèle que le journal d'activité : silencieux,
// jamais bloquant). C'est ce gisement qui nourrira les « matchs populaires »
// et la génération d'équipes « selon l'avis des joueurs ».

import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/sfl/auth/session";
import { credit } from "@/lib/sfl/ballons";
import { logActivity } from "@/lib/sfl/activity";
import { cleDimanche, prochainDimanche } from "@/lib/sfl/convocation-temps";

export const COMPO_REWARD = 5;

/** Les cinq postes du terrain, du gardien aux attaquants. */
export const COMPO_SLOTS = [
  { id: "G", label: "Gardien", x: 50, y: 86 },
  { id: "DG", label: "Défenseur gauche", x: 27, y: 60 },
  { id: "DD", label: "Défenseur droit", x: 73, y: 60 },
  { id: "AG", label: "Attaquant gauche", x: 29, y: 26 },
  { id: "AD", label: "Attaquant droit", x: 71, y: 26 },
] as const;

export type CompoSlotId = (typeof COMPO_SLOTS)[number]["id"];
export type CompoSlots = Partial<Record<CompoSlotId, string>>;

export interface Composition {
  dimanche: string; // « 2026-08-23 »
  slots: Record<CompoSlotId, string>;
  ts: number;
}

function storeKey(voter: string) {
  return `sfl-compos-${voter}`;
}

export function getCompos(voter: string): Composition[] {
  try {
    return JSON.parse(localStorage.getItem(storeKey(voter)) ?? "[]");
  } catch {
    return [];
  }
}

/** La composition déjà déposée pour un dimanche donné, s'il y en a une. */
export function compoPourDimanche(voter: string, dimanche: string): Composition | null {
  return getCompos(voter).find((c) => c.dimanche === dimanche) ?? null;
}

/**
 * Dépose (ou remplace) la composition du joueur pour le prochain dimanche.
 * Renvoie les Ballons crédités : COMPO_REWARD au premier dépôt de la
 * semaine, 0 pour un remplacement.
 */
export function submitCompo(
  voter: string,
  slots: Record<CompoSlotId, string>,
  now: Date
): { dimanche: string; rewarded: number } {
  const dimanche = cleDimanche(prochainDimanche(now));

  const rest = getCompos(voter).filter((c) => c.dimanche !== dimanche);
  rest.push({ dimanche, slots, ts: Date.now() });
  localStorage.setItem(storeKey(voter), JSON.stringify(rest.slice(-30)));
  window.dispatchEvent(new Event("sfl-compos"));

  // La récompense ne tombe qu'une fois par dimanche visé.
  const rewardKey = `sfl-compo-reward-${voter}-${dimanche}`;
  let rewarded = 0;
  if (!localStorage.getItem(rewardKey)) {
    localStorage.setItem(rewardKey, "1");
    credit(voter, COMPO_REWARD, "Composition 5v5 déposée");
    rewarded = COMPO_REWARD;
  }

  logActivity("compo", { meta: { dimanche } });

  // Vers la base, sans jamais bloquer : la contrainte (player_id, dimanche)
  // fait du dépôt un remplacement naturel.
  try {
    const session = getSession();
    if (session?.server) {
      const sb = supabase();
      sb.auth
        .getUser()
        .then(({ data }) => {
          const uid = data.user?.id;
          if (!uid) return;
          return sb
            .from("compositions")
            .upsert({ player_id: uid, dimanche, slots }, { onConflict: "player_id,dimanche" });
        })
        .catch(() => {});
    }
  } catch {
    // jamais bloquant
  }

  return { dimanche, rewarded };
}
