"use client";

// « Ton premier match » : faire jouer un joueur Bola qui vient d'arriver
// (Sabri, 31/10/2026 : « les inciter à créer des matchs, c'est-à-dire
// repérer où ils sont s'ils ont autorisé leur localisation […] lui dire :
// fais un match ici, fais un match là, organise là, invite […] pour voir le
// comportement de l'utilisateur, parce qu'on veut l'activer et on va avoir de
// la rétention »).
//
// À l'ouverture, tant qu'un joueur Bola (hors de la SFL) n'a ni ouvert ni
// rejoint de match, l'écran « Ton premier match » lui montre les terrains les
// plus proches (components/sfl/invitation-premier-match.tsx) : autour de sa
// position s'il la donne d'un toucher, sinon autour de sa ville. Une fois par
// jour au plus ; « Plus tard » le fait taire deux jours (invitation-carte.tsx).
//
// Sa position reste sur son téléphone, comme la ville ne dit que le centre
// de sa commune : on la garde une heure dans ce navigateur pour que la Map
// le place au même endroit, et on n'en envoie rien. Le journal d'usage note
// seulement ses gestes (activity, kind « activation ») : l'écran vu, la
// position donnée ou refusée, le terrain touché, l'invitation de ses potes,
// « Plus tard ». Admin → Activité → Nouveaux en fait son parcours, à côté de
// ce que la base sait déjà (sa ville, ses notifications, ses matchs, ses
// partages de lien ; app/admin/activite/parcours.ts).

import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/sfl/activity";

export type GesteActivation = "vu" | "position-oui" | "position-non" | "terrain" | "inviter" | "plus-tard";

/** Un geste de l'écran, au journal d'usage. Jamais bloquant. */
export function noterActivation(geste: GesteActivation, meta: Record<string, string | number> = {}) {
  logActivity("activation", { meta: { geste, ...meta } });
}

/* ───────────────────────── Une fois par jour au plus ───────────────────────── */

const VU = (nom: string) => `bola-premier-match-vu-${nom}`;
const jour = () => new Date().toISOString().slice(0, 10);

export function premierMatchVuAujourdhui(nom: string): boolean {
  try {
    return localStorage.getItem(VU(nom)) === jour();
  } catch {
    return false;
  }
}

export function noterPremierMatchVu(nom: string) {
  try {
    localStorage.setItem(VU(nom), jour());
  } catch {}
}

/* ─────────────────────────── La position, ici seulement ─────────────────────────── */

const POSITION = "bola-ma-position";
/** Au-delà, la position n'est plus sûre : on la redemande. */
const POSITION_MS = 3600 * 1000;

export interface Position {
  lat: number;
  lng: number;
}

/** La position donnée il y a moins d'une heure, sur ce téléphone. */
export function positionGardee(): Position | null {
  try {
    const v = JSON.parse(localStorage.getItem(POSITION) ?? "null") as (Position & { t: number }) | null;
    if (!v || Date.now() - v.t > POSITION_MS || !Number.isFinite(v.lat) || !Number.isFinite(v.lng)) return null;
    return { lat: v.lat, lng: v.lng };
  } catch {
    return null;
  }
}

export function garderPosition(p: Position) {
  try {
    localStorage.setItem(POSITION, JSON.stringify({ lat: p.lat, lng: p.lng, t: Date.now() }));
  } catch {}
}

/** La position du téléphone ; le navigateur demande la permission au premier toucher. */
export function demanderPosition(): Promise<Position> {
  return new Promise((ok, ko) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      ko(new Error("indisponible"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        garderPosition(p);
        ok(p);
      },
      (err) => ko(err),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
    );
  });
}

/** Déjà autorisée sur ce téléphone : on peut la lire sans rien demander. */
export async function positionAutorisee(): Promise<boolean> {
  try {
    const p = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    return p?.state === "granted";
  } catch {
    return false;
  }
}

/* ─────────────────────────── A-t-il déjà un match ? ─────────────────────────── */

/**
 * Le joueur connecté a ouvert un match, ou il est dans l'un d'eux (invité
 * compris : quelqu'un l'a déjà fait entrer dans le jeu). Lu dans la base ;
 * une lecture ratée répond oui, pour ne rien proposer à tort.
 */
export async function aDejaUnMatch(): Promise<boolean> {
  const sb = supabase();
  const { data } = await sb.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return true;
  const [orga, dedans] = await Promise.all([
    sb.from("matchs").select("id", { count: "exact", head: true }).eq("organisateur", uid),
    sb.from("match_joueurs").select("match_id", { count: "exact", head: true }).eq("player_id", uid),
  ]);
  if (orga.error || dedans.error) return true;
  return (orga.count ?? 0) + (dedans.count ?? 0) > 0;
}
