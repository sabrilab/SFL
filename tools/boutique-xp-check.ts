// La boutique en XP (PACK AFRIQUE 2027), relue en adversaire le 02/11/2026 :
// ce que le navigateur ne peut pas choisir, et ce que rien ne fait baisser.
//   1. la route ne lit du navigateur que l'article et la clé : le joueur
//      (sa session), le prix, les nations en jeu et l'XP gagnée viennent du
//      serveur ; le compte vitrine et un compte non validé n'achètent rien ;
//   2. le Niveau XP et le Passe ne lisent jamais les achats : dépenser ne les
//      fait pas baisser ;
//   3. le serveur lit les recrues et les matchs Bola avec la même clé
//      publique que l'app (sans repli, une production sans la variable les
//      perdait en silence) ;
//   4. le solde « à dépenser » part du total que l'écran montre ;
//   5. les listes de toute la ligue (achats_xp, passe_acquis) se lisent page
//      par page : passé 1 000 lignes, rien ne disparaît.
// Le reste (solde, double exécution, tirage, droits, simultanéité) est dans
// tools/sql/achats-xp-check.sql et tools/sql/achats-xp-concurrence.sh.
//   npx tsx tools/boutique-xp-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PAGE, toutesLesPages } from "../src/lib/sfl/pages";

const lire = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
const sansCommentaires = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");

// 1 · La route : rien de ce qui compte ne vient du navigateur.
{
  const route = sansCommentaires(lire("app/api/boutique-xp/route.ts"));
  const lus = new Set([...route.matchAll(/corps\??\.(\w+)/g)].map((m) => m[1]));
  assert.deepEqual([...lus].sort(), ["article", "cle"], `le corps ne donne que l'article et la clé (lu : ${[...lus].join(", ")})`);
  const appel = /rpc\("ouvrir_pack_xp",\s*\{([\s\S]*?)\}\)/.exec(route)?.[1] ?? "";
  assert.match(appel, /p_joueur:\s*moi\.id\b/, "le joueur est celui de la session");
  assert.match(appel, /p_prix:\s*PACK_AFRIQUE\.prix\b/, "le prix est celui du serveur");
  assert.match(appel, /p_choix:\s*choix\b/, "les nations en jeu viennent du serveur");
  assert.match(route, /const choix = nationsEnJeu\(\);/);
  assert.match(appel, /p_gagne:\s*gagnee\b/, "l'XP gagnée est recalculée");
  assert.match(route, /xpServeur\(sb, \{ id: moi\.id, nom: p\.name, jeton \}/, "recalculée pour le joueur de la session, par son nom en base");
  assert.match(route, /COMPTES_VITRINE/, "le compte vitrine n'achète rien");
  assert.match(route, /!p\?\.valide/, "un compte non validé n'achète rien");
  assert.match(route, /appelant\(sb, req\)/, "la session est vérifiée par le serveur d'authentification");
}

// 2 · Le Niveau XP et le Passe ne lisent jamais les achats.
for (const f of ["lib/sfl/missions.ts", "lib/sfl/xp-calcul.ts", "lib/sfl/xp-acquis.ts", "lib/sfl/xp-serveur.server.ts", "lib/sfl/passe.ts", "lib/sfl/saisons-passe.ts", "hooks/use-missions.ts"]) {
  const code = sansCommentaires(lire(f));
  assert.ok(!/achats_xp|mes_achats_xp|soldeXp|use-achats-xp|useSoldeXp/.test(code), `${f} ne lit pas les achats`);
}

// 3 · La clé publique du serveur : la même que celle de l'app, jamais vide.
{
  const repli = (code: string) => /"(sb_publishable_[A-Za-z0-9_-]+)"/.exec(code)?.[1];
  const app = repli(lire("lib/supabase.ts"));
  assert.ok(app, "l'app a sa clé publique");
  assert.equal(repli(lire("lib/sfl/xp-serveur.server.ts")), app, "le serveur d'XP retombe sur la même clé");
}

// 4 · Le solde part du total que l'écran montre (useXp), pas d'un bilan vieux de 10 minutes.
{
  const hook = sansCommentaires(lire("hooks/use-achats-xp.ts"));
  assert.match(hook, /soldeXp\(b\.total,/, "le solde part du total affiché");
  assert.ok(!/useBilanServeur/.test(hook), "le solde ne lit plus le bilan du serveur seul");
}

// 5 · Les pages : tout est lu, et une erreur ne rend jamais une liste coupée pour complète.
void (async () => {
  const table = Array.from({ length: 2 * PAGE + 500 }, (_, i) => ({ id: i + 1 }));
  let appels = 0;
  const lecteur = (debut: number) => {
    appels++;
    return Promise.resolve({ data: table.slice(debut, debut + PAGE), error: null });
  };
  const tout = await toutesLesPages<{ id: number }>(lecteur);
  assert.equal(tout.error, null);
  assert.equal(tout.lu.length, table.length, "2 500 lignes, toutes");
  assert.equal(appels, 3);
  assert.deepEqual(new Set(tout.lu.map((l) => l.id)).size, table.length, "sans doublon");
  const juste = await toutesLesPages<{ id: number }>((debut) => Promise.resolve({ data: table.slice(0, PAGE).slice(debut, debut + PAGE), error: null }));
  assert.equal(juste.lu.length, PAGE, "1 000 lignes pile : la page suivante, vide, clôt la lecture");
  const coupee = await toutesLesPages<{ id: number }>((debut) =>
    Promise.resolve(debut === 0 ? { data: table.slice(0, PAGE), error: null } : { data: null, error: { message: "coupé" } })
  );
  assert.ok(coupee.error, "une page en erreur se dit : l'appelant garde son cache");
  for (const f of ["hooks/use-achats-xp.ts", "hooks/use-bilan-serveur.ts"]) {
    const code = sansCommentaires(lire(f));
    assert.match(code, /toutesLesPages/, `${f} lit page par page`);
    assert.match(code, /\.range\(debut, debut \+ PAGE - 1\)/, `${f} : des pages de 1 000`);
  }
  console.log("boutique-xp : ok");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
