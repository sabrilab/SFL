"use client";

// Client Supabase de l'app — un seul, partagé.
//
// L'URL et la clé « publishable » sont publiques par conception : elles partent
// dans le bundle du navigateur et la sécurité repose sur les règles RLS côté
// base (voir supabase/schema.sql). Les variables d'environnement permettent de
// pointer un autre projet (préproduction) sans toucher au code ; à défaut, on
// retombe sur le projet de la ligue.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tpfusliksgxcvfrodchk.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_oZ4YpiQZFgtnu2jTz-mrtw_Dt133w86";

let client: SupabaseClient | null = null;

/** Le client partagé (sessions persistées, jetons auto-rafraîchis). */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "sfl-supabase-auth",
      },
    });
  }
  return client;
}

/**
 * Client jetable SANS persistance de session — pour les opérations qui se
 * connectent « en tant qu'un autre » sans écraser la session courante
 * (ex. la création des comptes depuis la page d'installation admin).
 */
export function supabaseEphemeral(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Les identifiants de connexion sont des emails techniques : user@sfl.local */
export function loginEmail(user: string): string {
  return `${user.trim().toLowerCase()}@sfl.local`;
}
