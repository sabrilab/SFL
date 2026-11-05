// estAdmin (lib/sfl/serveur-ligue.server.ts), le seul contrôle « admin ou
// pas » des routes qui agissent avec la clé secrète (04/11/2026, contrôle SQL
// de l'intégration de l'entraîneur) : comme is_league_admin() en base, un
// admin qui doit encore changer son mot de passe (une ligne dans
// mot_de_passe_a_changer, « origine » ou « provisoire ») n'est pas admin.
// Fermé par défaut : une erreur de lecture de profiles ou du verrou répond
// non, et le journal ne garde que le code. Seule une base sans la table
// (42P01, PGRST205 : aperçu pas encore migré) garde le comportement d'avant.
// estMembre, son pendant pour est_membre() (validé, et pas tant que le mot
// de passe reste à changer), suit les mêmes règles (05/11/2026).
// Puis les routes : toutes passent par estAdmin, aucune ne relit
// profiles.is_admin pour l'appelant (quelle que soit la liste de colonnes),
// l'organisateur d'un match garde son droit sans qu'estAdmin soit lu, et
// matchs/notifier exige estMembre de l'organisateur avant d'effacer.
// Sans réseau : un faux client rend ce qu'on lui dit.
//   npx tsx tools/est-admin-check.ts
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estAdmin, estMembre } from "../src/lib/sfl/serveur-ligue.server";

type Erreur = { code: string; message: string } | null;
type Reponse = { data: unknown; error: Erreur };
/** Un faux client : chaque table rend ce qu'on lui dit, et on note ce qui est lu. */
function fauxClient(tables: Record<string, Reponse>) {
  const lus: string[] = [];
  const rendre = (table: string) => {
    lus.push(table);
    return Promise.resolve(tables[table] ?? { data: null, error: null });
  };
  const sb = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return { maybeSingle: () => rendre(table) };
            },
            in(_col: string, ids: string[]) {
              const r = tables[table];
              // Le verrou ne rend que les lignes demandées, comme la base.
              if (r && Array.isArray(r.data))
                return rendre(table).then(() => ({ ...r, data: (r.data as { user_id: string }[]).filter((x) => ids.includes(x.user_id)) }));
              return rendre(table);
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { sb, lus };
}

const ID = "6f1c2d3e-0000-4000-8000-000000000001";
const admin: Reponse = { data: { is_admin: true }, error: null };
const joueur: Reponse = { data: { is_admin: false }, error: null };
const verrou = (motif: string): Reponse => ({ data: [{ user_id: ID, motif }], error: null });
const panne = (code: string): Reponse => ({ data: null, error: { code, message: `panne ${ID}` } });

async function main() {
  const journal: unknown[][] = [];
  const avant = console.error;
  console.error = (...x: unknown[]) => void journal.push(x);
  try {
    // 1 · Admin, mot de passe choisi (aucune ligne) : admin, comme avant.
    {
      const { sb, lus } = fauxClient({ profiles: admin, mot_de_passe_a_changer: { data: [], error: null } });
      assert.equal(await estAdmin(sb, ID), true);
      assert.deepEqual(lus, ["profiles", "mot_de_passe_a_changer"]);
    }
    // 1 bis · Une ligne pour un autre compte ne le touche pas.
    {
      const { sb } = fauxClient({ profiles: admin, mot_de_passe_a_changer: { data: [{ user_id: "autre", motif: "origine" }], error: null } });
      assert.equal(await estAdmin(sb, ID), true);
    }
    // 2 · Admin qui doit encore changer son mot de passe : pas admin.
    for (const motif of ["origine", "provisoire"]) {
      const { sb } = fauxClient({ profiles: admin, mot_de_passe_a_changer: verrou(motif) });
      assert.equal(await estAdmin(sb, ID), false, motif);
    }
    // 3 · Pas admin : non, sans même lire le verrou ; avec un verrou, non aussi.
    {
      const { sb, lus } = fauxClient({ profiles: joueur, mot_de_passe_a_changer: { data: [], error: null } });
      assert.equal(await estAdmin(sb, ID), false);
      assert.deepEqual(lus, ["profiles"]);
      assert.equal(await estAdmin(fauxClient({ profiles: joueur, mot_de_passe_a_changer: verrou("origine") }).sb, ID), false);
      assert.equal(await estAdmin(fauxClient({ profiles: { data: null, error: null } }).sb, ID), false, "aucun profil");
    }
    // 4 · Profil illisible : non (fermé par défaut), le verrou n'est pas lu.
    for (const code of ["57014", "08006", "PGRST116", ""]) {
      const { sb, lus } = fauxClient({ profiles: panne(code), mot_de_passe_a_changer: { data: [], error: null } });
      assert.equal(await estAdmin(sb, ID), false, code);
      assert.deepEqual(lus, ["profiles"], code);
    }
    // 5 · Verrou illisible (délai, coupure, droits) : non.
    for (const code of ["57014", "08006", "42501", ""]) {
      const { sb } = fauxClient({ profiles: admin, mot_de_passe_a_changer: panne(code) });
      assert.equal(await estAdmin(sb, ID), false, code);
    }
    // 6 · Table absente (aperçu pas encore migré) : comportement d'avant.
    for (const code of ["42P01", "PGRST205"]) {
      const { sb } = fauxClient({ profiles: admin, mot_de_passe_a_changer: panne(code) });
      assert.equal(await estAdmin(sb, ID), true, code);
      assert.equal(await estAdmin(fauxClient({ profiles: joueur, mot_de_passe_a_changer: panne(code) }).sb, ID), false, code);
    }
  } finally {
    console.error = avant;
  }
  // 7 · Le journal ne garde que des codes : ni l'identifiant, ni le message.
  assert.ok(journal.length > 0);
  for (const ligne of journal) {
    const texte = ligne.map(String).join(" ");
    assert.ok(!texte.includes(ID) && !texte.includes("panne"), texte);
    assert.match(String(ligne[0]), /^\[admin\] (profiles|mot_de_passe_a_changer)$/);
  }

  // 7 bis · estMembre : les mêmes cas, sur profiles.valide.
  const membre: Reponse = { data: { valide: true }, error: null };
  const enAttente: Reponse = { data: { valide: false }, error: null };
  const journalM: unknown[][] = [];
  console.error = (...x: unknown[]) => void journalM.push(x);
  try {
    {
      const { sb, lus } = fauxClient({ profiles: membre, mot_de_passe_a_changer: { data: [], error: null } });
      assert.equal(await estMembre(sb, ID), true);
      assert.deepEqual(lus, ["profiles", "mot_de_passe_a_changer"]);
    }
    for (const motif of ["origine", "provisoire"])
      assert.equal(await estMembre(fauxClient({ profiles: membre, mot_de_passe_a_changer: verrou(motif) }).sb, ID), false, motif);
    {
      const { sb, lus } = fauxClient({ profiles: enAttente, mot_de_passe_a_changer: { data: [], error: null } });
      assert.equal(await estMembre(sb, ID), false);
      assert.deepEqual(lus, ["profiles"]);
      assert.equal(await estMembre(fauxClient({ profiles: { data: null, error: null } }).sb, ID), false, "aucun profil");
    }
    for (const code of ["57014", "08006", ""]) {
      assert.equal(await estMembre(fauxClient({ profiles: panne(code) }).sb, ID), false, code);
      assert.equal(await estMembre(fauxClient({ profiles: membre, mot_de_passe_a_changer: panne(code) }).sb, ID), false, code);
    }
    for (const code of ["42P01", "PGRST205"])
      assert.equal(await estMembre(fauxClient({ profiles: membre, mot_de_passe_a_changer: panne(code) }).sb, ID), true, code);
  } finally {
    console.error = avant;
  }
  assert.ok(journalM.length > 0);
  for (const ligne of journalM) {
    const texte = ligne.map(String).join(" ");
    assert.ok(!texte.includes(ID) && !texte.includes("panne"), texte);
    assert.match(String(ligne[0]), /^\[membre\] (profiles|mot_de_passe_a_changer)$/);
  }

  // 8 · Les routes. Toute route qui agit avec la clé secrète et réserve un
  //     geste à l'admin passe par estAdmin ; aucune ne relit is_admin pour
  //     l'appelant (la cible protégée, elle, peut l'être).
  const racine = join(import.meta.dirname, "..", "src", "app", "api");
  const routes: string[] = [];
  const parcourir = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) parcourir(p);
      else if (n === "route.ts") routes.push(p);
    }
  };
  parcourir(racine);
  const lire = (r: string) => readFileSync(join(racine, r, "route.ts"), "utf8");
  const AVEC_ESTADMIN = [
    "comptes/creer",
    "comptes/joueurs-bola",
    "comptes/reinitialiser",
    "comptes/supprimer",
    "entraineurs/calcul",
    "ligue/publication",
    "matchs/notifier",
    "matchs/resultat",
    "migrate",
    "videos/annoncer",
  ];
  for (const r of AVEC_ESTADMIN) assert.match(lire(r), /estAdmin\(sb, moi\.id\)/, r);
  for (const p of routes) {
    const s = readFileSync(p, "utf8");
    if (!/\bserveur\(\)/.test(s)) continue;
    // Quelle que soit la liste de colonnes (« name, is_admin »…) ou les guillemets.
    assert.doesNotMatch(
      s,
      /select\(\s*["'`][^"'`]*\bis_admin\b[^"'`]*["'`]\s*\)\s*\.eq\(\s*["'`]id["'`]\s*,\s*(moi|auth\.user|user)\.id\s*\)/,
      p
    );
    if (/Réservé à l'admin/.test(s)) assert.match(s, /estAdmin\(sb, (moi|auth\.user)\.id\)/, p);
  }
  // push/envoyer lit avec les droits de l'appelant, mais ses traces partent à la clé secrète.
  assert.match(lire("push/envoyer"), /estAdmin\(sb, auth\.user\.id\)/);
  // Le doublon d'entraineurs/calcul est parti : estAdmin le couvre, même 403.
  assert.doesNotMatch(lire("entraineurs/calcul"), /motDePasseAChanger/);
  // L'organisateur d'un match garde son droit : estAdmin n'est lu que pour un autre.
  assert.match(lire("matchs/resultat"), /match\.organisateur !== moi\.id && !\(await estAdmin\(sb, moi\.id\)\)/);
  // matchs/notifier : l'organisateur doit être membre (estMembre) avant que
  // la route lise les joueurs ou efface le match, comme la base.
  {
    const s = lire("matchs/notifier");
    const garde = s.search(/if \(!\(await estMembre\(sb, moi\.id\)\) && !\(await estAdmin\(sb, moi\.id\)\)\)\s*return/);
    const orga = s.indexOf("match.organisateur !== moi.id");
    assert.ok(orga > 0 && garde > orga, "notifier : garde estMembre après le contrôle de l'organisateur");
    for (const apres of ['from("match_joueurs")', 'from("matchs").delete()', "prevenir("])
      assert.ok(s.indexOf(apres) > garde, `notifier : ${apres} avant la garde estMembre`);
  }
}

main().then(
  () => console.log("est-admin : tout est ok"),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
