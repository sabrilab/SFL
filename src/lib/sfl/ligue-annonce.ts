// Les annonces de la ligue, côté téléphone : la convocation du dimanche et
// les résultats d'une journée (lib/sfl/annonces-ligue.ts).
//
// La notification part du serveur (/api/ligue/annoncer), une seule fois par
// joueur. L'app de chacun la sonne à l'ouverture, comme l'annonce des
// divisions : au plus toutes les 20 minutes par téléphone, et plus du tout
// pendant une heure quand le serveur répond que tout le monde est prévenu
// (une feuille remplie peut arriver à tout moment du dimanche).

import { supabase } from "@/lib/supabase";

const CLE_SONNE = "sfl-ligue-annonce";
const RELANCE = 20 * 60_000;
const REPOS = 3600_000;

export async function annoncerLigue(): Promise<void> {
  let prochaine = 0;
  try {
    prochaine = Number(localStorage.getItem(CLE_SONNE) ?? 0);
  } catch {
    /* mémoire illisible : on sonne */
  }
  if (prochaine > Date.now()) return;
  const noter = (dans: number) => {
    try {
      localStorage.setItem(CLE_SONNE, String(Date.now() + dans));
    } catch {
      /* stockage interdit : on resonnera, le serveur ne renvoie rien deux fois */
    }
  };
  noter(RELANCE);
  try {
    const { data } = await supabase().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) return;
    const r = await fetch("/api/ligue/annoncer", {
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
