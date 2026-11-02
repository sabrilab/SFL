"use client";

// Ouvrir le PACK AFRIQUE 2027 depuis l'app (la route : app/api/boutique-xp).
// La clé de l'ouverture (un UUID) est tirée quand la confirmation s'ouvre, et
// gardée sur le téléphone jusqu'à ce que le résultat soit vu : si l'app se
// ferme en pleine ouverture, on rejoue la même clé au retour, et le serveur
// rend le même tirage sans débiter deux fois.

import { PACK_AFRIQUE } from "@/lib/sfl/pack-afrique";
import { supabase } from "@/lib/supabase";

const CLE = "sfl-pack-afrique-cle";

export type IssueOuverture =
  | { ok: true; obtenu: string; serie: number; xp: number; solde: number; deja: boolean }
  | { ok: false; raison: string; solde?: number | null; code: number };

/** La clé en cours pour ce joueur, ou une nouvelle, gardée. */
export function cleOuverture(nom: string): string {
  try {
    const x = JSON.parse(localStorage.getItem(CLE) ?? "null") as { nom: string; cle: string } | null;
    if (x?.nom === nom && x.cle) return x.cle;
  } catch {}
  const cle = crypto.randomUUID();
  try {
    localStorage.setItem(CLE, JSON.stringify({ nom, cle, envoyee: false }));
  } catch {}
  return cle;
}

/** Une ouverture partie vers le serveur et dont le résultat n'a pas été vu : à rejouer. */
export function ouvertureEnSuspens(nom: string): string | null {
  try {
    const x = JSON.parse(localStorage.getItem(CLE) ?? "null") as { nom: string; cle: string; envoyee?: boolean } | null;
    return x?.nom === nom && x.envoyee ? x.cle : null;
  } catch {
    return null;
  }
}

/** Le résultat est vu (ou la confirmation fermée sans rien envoyer) : la clé s'oublie. */
export function oublierOuverture(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {}
}

export async function ouvrirPackAfrique(nom: string, cle: string): Promise<IssueOuverture> {
  try {
    localStorage.setItem(CLE, JSON.stringify({ nom, cle, envoyee: true }));
  } catch {}
  try {
    const { data } = await supabase().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) return { ok: false, raison: "Session requise.", code: 401 };
    const r = await fetch("/api/boutique-xp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ article: PACK_AFRIQUE.article, cle }),
    });
    const corps = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (r.ok) return { ok: true, obtenu: String(corps.obtenu), serie: Number(corps.serie), xp: Number(corps.xp), solde: Number(corps.solde), deja: !!corps.deja };
    // Un refus net : la clé ne sert plus (l'XP manque, le pack est complet).
    if (r.status === 402 || r.status === 409 || r.status === 403 || r.status === 400) oublierOuverture();
    return { ok: false, raison: String(corps.error ?? "Réessaie."), solde: (corps.solde as number | null | undefined) ?? null, code: r.status };
  } catch {
    return { ok: false, raison: "Réseau coupé.", code: 0 };
  }
}
