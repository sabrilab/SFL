"use client";

// Messagerie de la ligue — le salon SFL et les conversations privées.
//
// Une seule table côté base, et une seule requête côté app : les règles de
// sécurité laissent passer le salon plus les privés qui me concernent, rien
// d'autre. On partage ensuite le résultat en fils, ici. Inutile d'aller
// chercher chaque conversation séparément pour une ligue de 74 personnes.
//
// Les noms viennent de la table des profils : un message ne transporte que
// l'identifiant de son auteur, jamais un nom recopié qui deviendrait faux le
// jour où quelqu'un change le sien.

import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/sfl/auth/session";

/** Le salon de toute la ligue. */
export const SALON = "sfl";

export interface Message {
  id: number;
  canal: "sfl" | "dm";
  auteurId: string;
  auteur: string;
  destinataireId: string | null;
  texte: string;
  at: number;
  /** Vrai si c'est moi qui l'ai écrit. */
  mien: boolean;
}

export interface Profil {
  id: string;
  name: string;
}

export interface Fil {
  /** `SALON`, ou l'identifiant de l'autre personne. */
  cle: string;
  titre: string;
  messages: Message[];
  dernier: Message | null;
}

export type Resultat = { ok: true } | { ok: false; raison: string };

/* ------------------------------- Lecture ------------------------------- */

export async function chargerProfils(): Promise<Profil[]> {
  const { data, error } = await supabase().from("profiles").select("id, name").order("name");
  if (error) return [];
  return (data ?? []) as Profil[];
}

interface Brut {
  id: number;
  canal: "sfl" | "dm";
  auteur: string;
  destinataire: string | null;
  texte: string;
  created_at: string;
}

/** Traduit une erreur Postgres en phrase utile, avec le geste qui répare. */
export function expliquer(message: string): string {
  if (/relation .*messages.* does not exist|schema cache|could not find the table/i.test(message)) {
    return "La messagerie n'est pas encore installée en base. Ouvre Réglages → Installation Supabase une fois : le schéma s'applique tout seul.";
  }
  if (/jwt|token|not authenticated|auth session/i.test(message)) {
    return "Ta session serveur a expiré. Déconnecte-toi puis reconnecte-toi.";
  }
  return message;
}

/**
 * Tout ce que je peux lire, en une fois : le salon et mes conversations.
 * En cas d'échec, on rend le MOTIF : « pas joignable » ne dit pas si la table
 * manque, si la session a expiré, ou si le réseau est coupé — et ce sont
 * trois gestes différents.
 */
export async function chargerTout(
  moi: string,
  profils: Profil[],
  limite = 400
): Promise<
  { ok: true; salon: Fil; prives: Fil[] } | { ok: false; raison: string }
> {
  const { data, error } = await supabase()
    .from("messages")
    .select("id, canal, auteur, destinataire, texte, created_at")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) return { ok: false, raison: expliquer(error.message) };

  const nomDe = new Map(profils.map((p) => [p.id, p.name]));
  const tous: Message[] = ((data ?? []) as Brut[])
    .map((r) => ({
      id: r.id,
      canal: r.canal,
      auteurId: r.auteur,
      auteur: nomDe.get(r.auteur) ?? "Quelqu'un",
      destinataireId: r.destinataire,
      texte: r.texte,
      at: new Date(r.created_at).getTime(),
      mien: r.auteur === moi,
    }))
    // La base rend du plus récent au plus ancien (pour la limite) ; un fil se
    // lit dans l'autre sens.
    .reverse();

  const salonMsgs = tous.filter((m) => m.canal === SALON);
  const parPersonne = new Map<string, Message[]>();
  for (const m of tous) {
    if (m.canal !== "dm") continue;
    const autre = m.auteurId === moi ? m.destinataireId : m.auteurId;
    if (!autre) continue;
    const liste = parPersonne.get(autre) ?? [];
    liste.push(m);
    parPersonne.set(autre, liste);
  }

  const prives: Fil[] = [...parPersonne.entries()]
    .map(([id, messages]) => ({
      cle: id,
      titre: nomDe.get(id) ?? "Quelqu'un",
      messages,
      dernier: messages[messages.length - 1] ?? null,
    }))
    .sort((a, b) => (b.dernier?.at ?? 0) - (a.dernier?.at ?? 0));

  return {
    ok: true,
    salon: {
      cle: SALON,
      titre: "Salon SFL",
      messages: salonMsgs,
      dernier: salonMsgs[salonMsgs.length - 1] ?? null,
    },
    prives,
  };
}

/* ------------------------------- Écriture ------------------------------ */

/** Pourquoi écrire est impossible — null si ça l'est. */
export function blocage(): string | null {
  const session = getSession();
  if (!session) return "Personne n'est connecté.";
  if (!session.server)
    return "Ta session n'est pas vérifiée par le serveur. Déconnecte-toi puis reconnecte-toi pour écrire.";
  return null;
}

export async function envoyer(
  texte: string,
  destinataireId: string | null
): Promise<Resultat> {
  const propre = texte.trim();
  if (!propre) return { ok: false, raison: "Message vide." };
  if (propre.length > 2000) return { ok: false, raison: "Message trop long (2000 caractères max)." };
  const empeche = blocage();
  if (empeche) return { ok: false, raison: empeche };

  try {
    const sb = supabase();
    const { data: auth } = await sb.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return { ok: false, raison: "Session serveur expirée — reconnecte-toi." };

    const { error } = await sb.from("messages").insert({
      canal: destinataireId ? "dm" : SALON,
      auteur: uid,
      destinataire: destinataireId,
      texte: propre,
    });
    if (error) return { ok: false, raison: expliquer(error.message) };
    return { ok: true };
  } catch (e) {
    return { ok: false, raison: e instanceof Error ? e.message : "Base injoignable." };
  }
}

export async function retirer(id: number): Promise<boolean> {
  try {
    const { error } = await supabase().from("messages").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/* ------------------------------ Temps réel ----------------------------- */

// Nom de canal unique par abonné : supabase-js renvoie le canal existant
// quand on redemande un nom déjà pris, et son `.on()` lève alors.
let seq = 0;

/** Rappelle `onChange` à chaque message reçu. Renvoie la fonction d'arrêt. */
export function ecouter(onChange: () => void): () => void {
  try {
    const sb = supabase();
    const channel = sb
      .channel(`sfl-messages-${++seq}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, onChange)
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  } catch {
    // Sans temps réel la messagerie reste utilisable : elle se recharge à
    // l'envoi et à l'ouverture.
    return () => {};
  }
}

/* --------------------------- Messages non lus -------------------------- */

// Par appareil : savoir qu'on a déjà lu tient du confort, pas de la donnée
// partagée. Une table de plus en base pour ça n'en vaut pas la peine.
const LU_PREFIX = "sfl-msg-lu-";

export function marquerLu(cle: string, at: number) {
  try {
    localStorage.setItem(`${LU_PREFIX}${cle}`, String(at));
  } catch {
    /* stockage indisponible */
  }
}

export function dernierLu(cle: string): number {
  try {
    const n = Number(localStorage.getItem(`${LU_PREFIX}${cle}`) ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Combien de messages non lus dans ce fil (les miens ne comptent pas). */
export function nonLus(fil: Fil): number {
  const seuil = dernierLu(fil.cle);
  return fil.messages.filter((m) => !m.mien && m.at > seuil).length;
}
