// Les notifications ne partent jamais vers un compte qui doit encore changer
// son mot de passe (lib/server/push-envoi.ts, audit de sécurité du 03/11/2026,
// contrôle adverse D1) : son téléphone a pu être abonné avec un mot de passe
// d'origine devenu public, et une notification porte le texte d'un message
// (« Bea : on joue à 18 h ? »). Une base sans la table (aperçu pas encore
// migré) laisse passer ; toute autre erreur de lecture n'envoie rien.
// Sans réseau : les abonnements rendus sont vides, rien ne part vraiment ;
// on regarde à qui la route demande les téléphones.
//   npx tsx tools/push-envoi-check.ts
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { motDePasseAChanger, prevenir, type Envoi } from "../src/lib/server/push-envoi";

type Reponse = { data: unknown; error: { code: string; message: string } | null };
/** Un faux client : chaque table rend ce qu'on lui dit, et on note les « in ». */
function fauxClient(tables: Record<string, Reponse>) {
  const demandes: { table: string; ids: string[] }[] = [];
  const sb = {
    from(table: string) {
      return {
        select() {
          return {
            in(_col: string, ids: string[]) {
              demandes.push({ table, ids });
              return Promise.resolve(tables[table] ?? { data: [], error: null });
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { sb, demandes };
}
const cle = { publique: "x", privee: "x", sujet: "mailto:essai@exemple.invalid" } as never;
const envoi: Envoi = { motif: "vestiaire-message", notif: { titre: "Bea · Vestiaire", texte: "on joue à 18 h ?", url: "/", tag: "vestiaire" } } as Envoi;
const envois = () => new Map<string, Envoi>([["ali", envoi], ["dan", envoi], ["cyr", envoi]]);
const telephones = (d: { table: string; ids: string[] }[]) => d.find((x) => x.table === "push_abonnements")?.ids;

async function main() {
  // 1 · Dan doit changer son mot de passe : on ne cherche même pas ses téléphones.
  {
    const { sb, demandes } = fauxClient({ mot_de_passe_a_changer: { data: [{ user_id: "dan" }], error: null } });
    const bilan = await prevenir(sb, cle, envois(), { traces: null });
    assert.deepEqual(telephones(demandes), ["ali", "cyr"]);
    assert.equal(bilan.recus.size, 0);
  }
  // 2 · Personne n'a de ligne : tout le monde est cherché.
  {
    const { sb, demandes } = fauxClient({ mot_de_passe_a_changer: { data: [], error: null } });
    await prevenir(sb, cle, envois(), { traces: null });
    assert.deepEqual(telephones(demandes), ["ali", "dan", "cyr"]);
  }
  // 3 · Tous en ont une : rien.
  {
    const { sb, demandes } = fauxClient({ mot_de_passe_a_changer: { data: [{ user_id: "ali" }, { user_id: "dan" }, { user_id: "cyr" }], error: null } });
    await prevenir(sb, cle, envois(), { traces: null });
    assert.equal(telephones(demandes), undefined);
  }
  // 4 · La table manque (aperçu pas encore migré) : comme avant.
  for (const code of ["42P01", "PGRST205"]) {
    const { sb, demandes } = fauxClient({ mot_de_passe_a_changer: { data: null, error: { code, message: "absente" } } });
    await prevenir(sb, cle, envois(), { traces: null });
    assert.deepEqual(telephones(demandes), ["ali", "dan", "cyr"], code);
  }
  // 5 · Toute autre erreur (délai, coupure) : personne n'est prévenu (le
  //     journal ne garde que le code, muet ici).
  const journal = console.error;
  console.error = () => {};
  for (const code of ["57014", "08006", ""]) {
    const { sb, demandes } = fauxClient({ mot_de_passe_a_changer: { data: null, error: { code, message: "panne" } } });
    assert.equal(await motDePasseAChanger(sb, ["ali"]), null);
    await prevenir(sb, cle, envois(), { traces: null });
    assert.equal(telephones(demandes), undefined, code);
  }
  console.error = journal;
  // 6 · Aucun envoi demandé : aucune lecture.
  {
    const { sb, demandes } = fauxClient({});
    await prevenir(sb, cle, new Map(), { traces: null });
    assert.equal(demandes.length, 0);
  }
}

main().then(
  () => console.log("push-envoi : tout est ok"),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
