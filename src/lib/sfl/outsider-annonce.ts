// La notification de l'outsider, côté téléphone (lib/sfl/outsiders.ts).
//
// Elle part du serveur (/api/outsider/annoncer), une seule fois par joueur et
// par dimanche. L'app de chacun la sonne à l'ouverture, le samedi soir et le
// dimanche (peutEtreLaVeille), comme l'annonce des divisions : au plus toutes
// les 20 minutes par téléphone, et plus du tout pendant six heures quand le
// serveur répond que c'est fini (tout le monde prévenu, ou rien à dire).

import { supabase } from "@/lib/supabase";

const CLE_SONNE = "sfl-outsider-annonce";
const RELANCE = 20 * 60_000;
const REPOS = 6 * 3600_000;

export async function annoncerOutsider(): Promise<void> {
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
    const r = await fetch("/api/outsider/annoncer", {
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
