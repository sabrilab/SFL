"use client";

// La notification des cartons, côté téléphone (lib/sfl/cartons.ts) : elle part
// du serveur (/api/cartons/annoncer), une seule fois par carton. L'app de
// chacun la sonne à l'ouverture, au plus toutes les 20 minutes par
// téléphone, et plus pendant une heure quand tout le monde est prévenu ;
// l'admin la sonne aussi, sans attendre, dès qu'il note un retard.

import { supabase } from "@/lib/supabase";

const CLE_SONNE = "sfl-cartons-annonce";
const RELANCE = 20 * 60_000;
const REPOS = 3600_000;

export async function annoncerCartons({ maintenant = false }: { maintenant?: boolean } = {}): Promise<void> {
  let prochaine = 0;
  try {
    prochaine = Number(localStorage.getItem(CLE_SONNE) ?? 0);
  } catch {
    /* mémoire illisible : on sonne */
  }
  if (!maintenant && prochaine > Date.now()) return;
  const noter = (dans: number) => {
    try {
      localStorage.setItem(CLE_SONNE, String(Date.now() + dans));
    } catch {
      /* stockage interdit : le serveur ne renvoie rien deux fois */
    }
  };
  noter(RELANCE);
  try {
    const { data } = await supabase().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) return;
    const r = await fetch("/api/cartons/annoncer", { method: "POST", headers: { Authorization: `Bearer ${jeton}` }, keepalive: true });
    const corps = (await r.json().catch(() => ({}))) as { fini?: boolean };
    if (corps.fini) noter(REPOS);
  } catch {
    /* une annonce perdue ne bloque rien : le prochain téléphone sonnera */
  }
}

/**
 * L'admin vient de noter un retard : dès que la saison est en base (le
 * prochain envoi réussi), la notification du carton part.
 */
export function annoncerCartonsApresEnvoi(): void {
  void import("./saisie/sync").then(({ SYNC_EVENT, dernierEnvoiAuto }) => {
    const suite = () => {
      window.removeEventListener(SYNC_EVENT, suite);
      if (dernierEnvoiAuto()?.ok) void annoncerCartons({ maintenant: true });
    };
    window.addEventListener(SYNC_EVENT, suite);
    window.setTimeout(() => window.removeEventListener(SYNC_EVENT, suite), 30_000);
  });
}
