// Les équipes par division, côté téléphone (lib/sfl/equipes-division.ts).
//
// Le serveur les compose le vendredi à 18 h et les tient à jour
// (/api/divisions/equipes). Le téléphone l'appelle juste après une réponse à
// la convocation, pour qu'un « Je viens » tardif trouve sa place, et à
// l'ouverture de l'app pendant le week-end des équipes, au plus toutes les
// 20 minutes : un appel perdu se rattrape au suivant. Le reste de la
// semaine, il ne l'appelle pas.

import { supabase } from "@/lib/supabase";
import { equipesEnCours } from "./equipes-division";

const CLE = "sfl-divisions-equipes";
const RELANCE = 20 * 60_000;

export async function ajusterEquipes(pourquoi: "reponse" | "ouverture", coupDEnvoi?: string): Promise<void> {
  if (!equipesEnCours(new Date(), coupDEnvoi)) return;
  if (pourquoi === "ouverture") {
    try {
      if (Number(localStorage.getItem(CLE) ?? 0) > Date.now()) return;
      localStorage.setItem(CLE, String(Date.now() + RELANCE));
    } catch {
      /* mémoire illisible : on appelle, le serveur ne change rien pour rien */
    }
  }
  try {
    const { data } = await supabase().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) return;
    await fetch("/api/divisions/equipes", {
      method: "POST",
      headers: { Authorization: `Bearer ${jeton}` },
      keepalive: true,
    });
  } catch {
    /* rien de bloquant : le prochain appel rattrape */
  }
}
