// L'accord à la politique de confidentialité vu du serveur
// (lib/sfl/confidentialite.server.ts, audit de sécurité du 03/11/2026, T15) :
// seule l'absence de la table laisse passer ; toute autre erreur de lecture
// refuse, et rien ne part chez Anthropic ni chez fal.
//   npx tsx tools/accord-check.ts
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accordEnregistre } from "../src/lib/sfl/confidentialite.server";

/** Un client qui rend toujours la même réponse à la lecture de consentements. */
const client = (reponse: { data: unknown[] | null; error: { code: string; message: string } | null }) => {
  const requete = { select: () => requete, eq: () => requete, gte: () => requete, limit: async () => reponse };
  return { from: (table: string) => (assert.equal(table, "consentements"), requete) } as unknown as SupabaseClient;
};
const erreur = (code: string) => ({ data: null, error: { code, message: `essai ${code}` } });

async function verifier() {
  const journal = console.error;
  console.error = () => {};
  try {
    assert.equal(await accordEnregistre(client({ data: [{ id: 1 }], error: null }), "u"), true);
    assert.equal(await accordEnregistre(client({ data: [], error: null }), "u"), false);
    // La table n'existe pas (aperçu sans migration) : on laisse passer.
    assert.equal(await accordEnregistre(client(erreur("42P01")), "u"), true);
    assert.equal(await accordEnregistre(client(erreur("PGRST205")), "u"), true);
    // Toute autre panne refuse : délai dépassé, droits, réseau, jeton expiré.
    for (const code of ["57014", "42501", "PGRST301", "PGRST116", "", "08006"])
      assert.equal(await accordEnregistre(client(erreur(code)), "u"), false, code);
  } finally {
    console.error = journal;
  }
}

verifier().then(
  () => console.log("accord : tout est ok"),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
