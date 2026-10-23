// L'annonce des divisions, côté téléphone (lib/sfl/divisions.ts).
//
// L'écran de l'ouverture (annonce-divisions.tsx) passe une fois par édition
// et par joueur sur cet appareil : une fois dans la semaine, une fois le
// dimanche de la J3.
//
// La notification part du serveur (/api/divisions/annoncer), une seule fois
// par joueur. L'app de chacun la sonne à l'ouverture pendant sa fenêtre, comme
// l'annonce des missions : au plus toutes les 20 minutes par téléphone, et
// plus du tout pendant six heures quand le serveur répond que tout le monde
// est prévenu.

import { supabase } from "@/lib/supabase";
import type { EditionAnnonce } from "./divisions";

const VUE = (edition: EditionAnnonce, nom: string) => `sfl-annonce-divisions-${edition}-${nom}`;

/** L'écran de cette édition est-il déjà passé ? Sans stockage, on le tient pour vu : pas d'écran à chaque ouverture. */
export function annonceVue(edition: EditionAnnonce, nom: string): boolean {
  try {
    return localStorage.getItem(VUE(edition, nom)) !== null;
  } catch {
    return true;
  }
}

export function noterAnnonceVue(edition: EditionAnnonce, nom: string): void {
  try {
    localStorage.setItem(VUE(edition, nom), String(Date.now()));
  } catch {
    /* stockage interdit : rien à retenir */
  }
}

const CLE_SONNE = "sfl-divisions-annonce";
const RELANCE = 20 * 60_000;
const REPOS = 6 * 3600_000;

export async function annoncerDivisions(): Promise<void> {
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
    const r = await fetch("/api/divisions/annoncer", {
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
