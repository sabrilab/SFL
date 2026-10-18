"use client";

// Les notifications sur le téléphone, côté joueur : savoir si ce téléphone
// peut les recevoir, les activer (la permission du système, puis
// l'abonnement auprès du service de push), et laisser l'abonnement en base
// (table push_abonnements) pour que l'admin puisse envoyer.
//
// Sur iPhone, Safari ne les propose qu'à une app ouverte depuis l'écran
// d'accueil (iOS 16.4 et plus) : dans Safari même, PushManager n'existe pas.

import { lireEnvironnement } from "@/lib/pwa/environnement";
import { supabase } from "@/lib/supabase";
import { VAPID_PUBLIC_KEY } from "@/lib/sfl/push";

export type EtatNotifications =
  /** Ce navigateur ne sait pas faire. */
  | "indisponible"
  /** iPhone dans Safari : il faut d'abord ajouter Bola à l'écran d'accueil. */
  | "a-installer"
  /** Refusées dans les réglages du téléphone. */
  | "refusees"
  | "actives"
  | "inactives";

function pushPossible(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function etatNotifications(): Promise<EtatNotifications> {
  if (typeof window === "undefined") return "indisponible";
  if (!pushPossible()) {
    const env = lireEnvironnement();
    return env.systeme === "ios" && !env.installee ? "a-installer" : "indisponible";
  }
  if (Notification.permission === "denied") return "refusees";
  if (Notification.permission !== "granted") return "inactives";
  const reg = await navigator.serviceWorker.getRegistration();
  const abo = await reg?.pushManager.getSubscription();
  return abo ? "actives" : "inactives";
}

function cleServeur(): Uint8Array<ArrayBuffer> {
  const b64 = VAPID_PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const octets = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
  return octets;
}

async function enregistrer(abo: PushSubscription): Promise<boolean> {
  const json = abo.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
  const { data } = await supabase().auth.getSession();
  if (!data.session) return false;
  const { error } = await supabase()
    .from("push_abonnements")
    .upsert(
      { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_id: data.session.user.id },
      { onConflict: "endpoint" }
    );
  return !error;
}

/**
 * Demande la permission puis abonne ce téléphone. À appeler sur un geste du
 * joueur (un toucher) : iOS refuse la demande autrement.
 */
export async function activerNotifications(): Promise<EtatNotifications> {
  if (!pushPossible()) return etatNotifications();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "refusees" : "inactives";
  const reg = await navigator.serviceWorker.ready;
  const abo =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleServeur() }));
  return (await enregistrer(abo)) ? "actives" : "inactives";
}

/**
 * À l'ouverture : un téléphone déjà abonné redonne son abonnement (le
 * navigateur peut l'avoir renouvelé, ou un autre joueur s'est connecté sur
 * ce téléphone). Sans permission, ne demande rien.
 */
export async function rafraichirAbonnement(): Promise<void> {
  if (!pushPossible() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration();
  const abo = await reg?.pushManager.getSubscription();
  if (abo) await enregistrer(abo);
}
