"use client";

// Le haut de l'entonnoir d'acquisition : qui arrive sur getbola.app et
// jusqu'où il va avant d'avoir un compte (Sabri, 03/11/2026 : « surtout les
// gens qui arrivent sur getbola.app et qui s'inscrivent »).
//
// Chaque étape est notée une fois par navigateur (table site_visites, par la
// fonction site_vu, supabase/schema.sql) avec l'identifiant tiré au hasard
// que garde déjà le parrainage (lib/sfl/parrainage.ts) : ni adresse IP, ni
// nom. Le site d'où vient le visiteur n'est gardé que par son nom
// (instagram.com), ou la source d'un lien « ?utm_source= ». Rien n'attend
// la réponse : une lecture refusée ne gêne jamais le visiteur.
//
// Lu par Admin → Analytics → Acquisition (app/admin/activite/acquisition.tsx).

import { supabase } from "@/lib/supabase";
import { visiteur } from "@/lib/sfl/parrainage";

export const ETAPES_SITE = ["site", "inscription", "identite", "jeu", "gabarit", "angles", "compte", "cree", "connexion"] as const;
export type EtapeSite = (typeof ETAPES_SITE)[number];

const CLE_SOURCE = "bola-source-arrivee";

/**
 * D'où vient le visiteur : la source d'un lien marqué, sinon le nom du site
 * qui l'envoie (sans « www. », jamais l'adresse entière). Gardée pour la
 * session : les écrans suivants de l'inscription la reprennent.
 */
export function sourceArrivee(): string | null {
  try {
    const gardee = sessionStorage.getItem(CLE_SOURCE);
    if (gardee) return gardee;
    const utm = new URLSearchParams(window.location.search).get("utm_source");
    let s: string | null = null;
    if (utm) s = utm;
    else if (document.referrer) {
      const h = new URL(document.referrer).hostname.replace(/^www\./, "");
      // Venu de l'app elle-même : pas une source.
      if (h && h !== window.location.hostname) s = h;
    }
    s = s ? s.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 60) || null : null;
    if (s) sessionStorage.setItem(CLE_SOURCE, s);
    return s;
  } catch {
    return null;
  }
}

/** Une étape de l'entonnoir, une fois par navigateur. Jamais bloquant. */
export function noterSite(etape: EtapeSite): void {
  const v = visiteur();
  if (!v) return;
  void supabase()
    .rpc("site_vu", { visiteur: v, etape, source: sourceArrivee() })
    .then(
      () => {},
      () => {}
    );
}
