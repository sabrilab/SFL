// Bola Plus, la précommande (12/11/2026 : lib/sfl/bola-plus.ts, bola-plus-store.ts).
//   1 · l'offre : 168 = 12 × 20 × 0,7, et le libellé « −30 % » en découle ;
//   2 · le compteur de l'admin : total, mensuel, annuel, sans formule, du plus
//       récent au plus ancien ; l'essai d'un aperçu remplace la ligne du même
//       joueur ;
//   3 · un essai abîmé sur le téléphone se lit comme vide, sans erreur ;
//   4 · le magasin dans un aperçu (le vrai module, sur un faux téléphone et un
//       faux réseau) : noter, changer de formule (la date reste), annuler ;
//       RIEN ne part vers la base, ni pour lire ni pour écrire ;
//   5 · le magasin en production : noter et annuler passent par la fonction
//       bola_plus_interesse et elle seule ; un refus se dit « Pas enregistré… »
//       et ne change rien ; on ne lit que sa ligne ; rien sur le téléphone ;
//       un toucher avant la fin de la lecture lit d'abord : ce qui est noté
//       n'est pas écrasé, et une lecture en échec n'écrit rien ;
//   6 · la lecture de l'admin : les lignes et leurs noms, la table absente
//       (« sans-table »), une autre panne (« autre »), et dans un aperçu l'essai
//       du téléphone montré même sans la table ;
//   7 · garde de source : dans le magasin, noter et annuler traitent l'aperçu
//       et en sortent avant tout appel à la base ; aucun des fichiers de Bola
//       Plus ne cite un prestataire de paiement ; la route, la tuile de Ma
//       carte et la section de l'admin sont branchées ; après « Annuler », rien
//       ne reste coché, et le bouton fait 44 px.
//   8 · les avantages (retour de Sabri, 12/11 23:08) : quatre, dans l'ordre, aux
//       titres exacts ; un titre et rien d'autre (ni chiffre, ni prix, ni
//       promesse) ; chaque visuel est là aux trois largeurs, en WebP, léger ;
//       les cartes se chargent quand on y arrive, l'affiche tout de suite ;
//       « Réduire les animations » est traité ; les prix ne sont écrits qu'une
//       fois ; le bouton collé note comme celui de l'offre.
//       Des mutants de la source sont rejoués : chaque garde doit les refuser.
// Sans réseau : fetch est remplacé.
//   npx tsx tools/bola-plus-check.ts
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  AFFICHE,
  ANNUEL,
  AVANTAGES,
  LARGEURS,
  LIBELLE_REMISE,
  MENSUEL,
  REMISE,
  avecEssai,
  compter,
  fichierVisuel,
  interetDe,
  lireEssais,
  sourcesVisuel,
  type Avantage,
  type LigneInteret,
} from "../src/lib/sfl/bola-plus";

// 1 · L'offre.
assert.equal(MENSUEL, 20);
assert.equal(ANNUEL, 168);
assert.equal(ANNUEL * 10, 12 * MENSUEL * 7, "168 = 12 × 20 × 0,7");
assert.ok(Math.abs(REMISE - 0.3) < 1e-12, "la remise est de 30 %");
assert.equal(LIBELLE_REMISE, "−30 %");

// 2 · Le compteur.
const lignes: LigneInteret[] = [
  { nom: "Nolan", formule: "mensuel", le: "2026-11-11T09:47:00Z" },
  { nom: "Malo", formule: "annuel", le: "2026-11-12T19:42:00Z" },
  { nom: "Enzo", formule: null, le: "2026-11-11T21:14:00Z" },
  { nom: "Jules", formule: "annuel", le: "2026-11-11T20:02:00Z" },
];
const c = compter(lignes);
assert.deepEqual([c.total, c.mensuel, c.annuel, c.sansFormule], [4, 1, 2, 1]);
assert.deepEqual(c.lignes.map((l) => l.nom), ["Malo", "Enzo", "Jules", "Nolan"], "du plus récent au plus ancien");
assert.equal(lignes[0].nom, "Nolan", "la liste donnée n'est pas triée sur place");
assert.deepEqual(compter([]), { total: 0, mensuel: 0, annuel: 0, sansFormule: 0, lignes: [] });
const avec = avecEssai(lignes, { nom: "Enzo", formule: "annuel", le: "2026-11-12T20:00:00Z" });
assert.equal(avec.length, 4, "l'essai remplace la ligne du même joueur");
assert.equal(compter(avec).annuel, 3);
assert.equal(avecEssai(lignes, null).length, 4);
assert.equal(avecEssai([], { nom: "Léo", formule: null, le: "2026-11-12T20:00:00Z" }).length, 1);

// 3 · Un essai abîmé.
assert.deepEqual(lireEssais(null), {});
assert.deepEqual(lireEssais("{pas du json"), {});
assert.deepEqual(lireEssais("[1,2]"), {});
assert.deepEqual(lireEssais('"texte"'), {});
assert.deepEqual(lireEssais('{"Léo":{"formule":"hebdo","le":"2026-11-12T20:00:00Z"},"Tom":{"formule":"annuel"},"Malo":{"formule":"annuel","le":"pas une date"},"Noé":null}'), {
  Léo: { formule: null, le: "2026-11-12T20:00:00Z" },
});
assert.equal(interetDe(null), null);
assert.deepEqual(interetDe({ formule: "mensuel", le: "2026-11-12T20:00:00Z", autre: 1 }), { formule: "mensuel", le: "2026-11-12T20:00:00Z" });

/* ------------------------- Le magasin, le vrai module ------------------------- */

// Un faux téléphone : son stockage et ses événements.
const stockage = new Map<string, string>();
const g = globalThis as Record<string, unknown>;
g.localStorage = {
  getItem: (k: string) => stockage.get(k) ?? null,
  setItem: (k: string, v: string) => void stockage.set(k, v),
  removeItem: (k: string) => void stockage.delete(k),
};
let evenements = 0;
g.window = {
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => (evenements++, true),
  localStorage: g.localStorage,
  location: { href: "http://localhost/", hash: "", search: "" },
};
// Le client de la base ne lit la session du téléphone que dans un navigateur (window et document).
g.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };

// Un faux réseau : chaque requête est notée, la réponse est celle qu'on a préparée.
interface Requete {
  methode: string;
  chemin: string;
  corps: unknown;
}
const requetes: Requete[] = [];
let repondre: (r: Requete) => { status: number; body: unknown } = () => ({ status: 500, body: { message: "non prévu" } });
g.fetch = async (entree: RequestInfo | URL, init?: RequestInit) => {
  const u = new URL(typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url);
  const r: Requete = { methode: init?.method ?? "GET", chemin: u.pathname + u.search, corps: typeof init?.body === "string" ? JSON.parse(init.body) : null };
  requetes.push(r);
  const { status, body } = repondre(r);
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
};

// Le client rechargé plusieurs fois dans le même faux navigateur : son avertissement n'est pas un défaut.
const avertir = console.warn;
console.warn = (...a: unknown[]) => {
  if (!a.some((x) => /Multiple GoTrueClient instances/.test(String(x)))) avertir(...a);
};

type Magasin = typeof import("../src/lib/sfl/bola-plus-store");
const CHEMIN = require.resolve("../src/lib/sfl/bola-plus-store");
const CLIENT = require.resolve("../src/lib/supabase");
/** Le magasin chargé à neuf, comme dans un aperçu (env absent) ou en production. */
function charger(env: string | undefined): Magasin {
  if (env === undefined) delete process.env.NEXT_PUBLIC_BOLA_ENV;
  else process.env.NEXT_PUBLIC_BOLA_ENV = env;
  delete require.cache[CHEMIN];
  // Le client de la base aussi : il relit la session du téléphone à sa création.
  delete require.cache[CLIENT];
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- rechargé exprès, une fois par environnement
  return require(CHEMIN) as Magasin;
}
const REFUS = "Pas enregistré. Reconnecte-toi, puis réessaie.";
const UID = "aaaaaaaa-0000-4000-8000-000000000001";

async function banc() {
  // 4 · Dans un aperçu.
  for (const env of [undefined, "preview", "development"]) {
    stockage.clear();
    requetes.length = 0;
    const m = charger(env);
    assert.equal(m.APERCU, true, `aperçu (${env})`);
    assert.equal(m.interetEnMemoire("Léo"), undefined, "pas encore lu");
    await m.chargerInteret("Léo");
    assert.equal(m.interetEnMemoire("Léo"), null, "rien de noté");
    await m.noterInteret("Léo", null);
    const premier = m.interetEnMemoire("Léo");
    assert.ok(premier && premier.formule === null && !Number.isNaN(Date.parse(premier.le)));
    await m.noterInteret("Léo", "annuel");
    assert.deepEqual(m.interetEnMemoire("Léo"), { formule: "annuel", le: premier.le }, "la date du premier toucher reste");
    assert.deepEqual(lireEssais(stockage.get("bola-plus-apercu") ?? null), { Léo: { formule: "annuel", le: premier.le } });
    await m.noterInteret("Tom", "mensuel");
    assert.equal(Object.keys(lireEssais(stockage.get("bola-plus-apercu") ?? null)).length, 2, "un essai par joueur");
    // Rechargé (l'app rouverte) : l'essai est relu du téléphone.
    const m2 = charger(env);
    await m2.chargerInteret("Léo");
    assert.deepEqual(m2.interetEnMemoire("Léo"), { formule: "annuel", le: premier.le });
    await m2.annulerInteret("Léo");
    assert.equal(m2.interetEnMemoire("Léo"), null);
    await m2.annulerInteret("Léo");
    assert.deepEqual(Object.keys(lireEssais(stockage.get("bola-plus-apercu") ?? null)), ["Tom"], "annuler n'efface que le sien");
    assert.equal(requetes.length, 0, `dans un aperçu (${env}), rien ne part vers la base`);
  }
  // Un essai d'un autre jour : changer de formule garde sa date.
  stockage.set("bola-plus-apercu", JSON.stringify({ Léo: { formule: "annuel", le: "2026-11-01T10:00:00.000Z" } }));
  const ancien = charger(undefined);
  await ancien.chargerInteret("Léo");
  await ancien.noterInteret("Léo", "mensuel");
  assert.deepEqual(ancien.interetEnMemoire("Léo"), { formule: "mensuel", le: "2026-11-01T10:00:00.000Z" });
  // Un stockage abîmé ne casse rien.
  stockage.set("bola-plus-apercu", "{abîmé");
  const abime = charger(undefined);
  await abime.chargerInteret("Léo");
  assert.equal(abime.interetEnMemoire("Léo"), null);
  await abime.noterInteret("Léo", "mensuel");
  assert.equal(lireEssais(stockage.get("bola-plus-apercu") ?? null).Léo.formule, "mensuel");

  // Un toucher arrivé pendant la lecture fait foi : la lecture ne l'efface pas.
  stockage.clear();
  const course = charger(undefined);
  const lecture = course.chargerInteret("Léo");
  await course.noterInteret("Léo", "annuel");
  await lecture;
  assert.equal(course.interetEnMemoire("Léo")?.formule, "annuel", "la lecture n'écrase pas le toucher");

  // 5 · En production.
  stockage.clear();
  requetes.length = 0;
  evenements = 0;
  let p = charger("production");
  assert.equal(p.APERCU, false);
  // Sans session : rien n'est lu.
  await p.chargerInteret("Léo");
  assert.equal(p.interetEnMemoire("Léo"), undefined);
  assert.equal(requetes.length, 0, "sans session, aucune lecture");
  // Avec une session : on ne lit que sa ligne.
  const session = { access_token: "x.y.z", refresh_token: "r", token_type: "bearer", expires_in: 31536000, expires_at: Math.floor(Date.now() / 1000) + 31536000, user: { id: UID } };
  stockage.set("sfl-supabase-auth", JSON.stringify(session));
  p = charger("production");
  repondre = () => ({ status: 200, body: { formule: "mensuel", le: "2026-11-10T08:20:00+00:00" } });
  await p.chargerInteret("Léo");
  assert.deepEqual(p.interetEnMemoire("Léo"), { formule: "mensuel", le: "2026-11-10T08:20:00+00:00" });
  assert.equal(requetes.length, 1);
  assert.equal(requetes[0].methode, "GET");
  assert.ok(requetes[0].chemin.startsWith("/rest/v1/bola_plus_interets?"), requetes[0].chemin);
  assert.ok(requetes[0].chemin.includes(`joueur=eq.${UID}`), "la lecture demande sa seule ligne (l'admin les verrait toutes)");
  await p.chargerInteret("Léo");
  assert.equal(requetes.length, 1, "lu une seule fois");
  // Noter : la fonction, et elle seule.
  requetes.length = 0;
  repondre = () => ({ status: 200, body: "2026-11-10T08:20:00+00:00" });
  await p.noterInteret("Léo", "annuel");
  assert.deepEqual(requetes, [{ methode: "POST", chemin: "/rest/v1/rpc/bola_plus_interesse", corps: { p_interesse: true, p_formule: "annuel" } }]);
  assert.deepEqual(p.interetEnMemoire("Léo"), { formule: "annuel", le: "2026-11-10T08:20:00+00:00" }, "l'heure est celle de la base");
  // Un refus : le message habituel, rien ne change.
  requetes.length = 0;
  repondre = () => ({ status: 403, body: { code: "42501", message: "Réservé aux joueurs." } });
  await assert.rejects(p.noterInteret("Léo", "mensuel"), { message: REFUS });
  await assert.rejects(p.annulerInteret("Léo"), { message: REFUS });
  assert.deepEqual(p.interetEnMemoire("Léo"), { formule: "annuel", le: "2026-11-10T08:20:00+00:00" });
  // La table absente (le code poussé avant la migration) : le même message, sans autre effet.
  repondre = () => ({ status: 404, body: { code: "PGRST202", message: "Could not find the function" } });
  await assert.rejects(p.noterInteret("Léo", "mensuel"), { message: REFUS });
  // Annuler.
  requetes.length = 0;
  repondre = () => ({ status: 200, body: null });
  await p.annulerInteret("Léo");
  assert.deepEqual(requetes, [{ methode: "POST", chemin: "/rest/v1/rpc/bola_plus_interesse", corps: { p_interesse: false, p_formule: null } }]);
  assert.equal(p.interetEnMemoire("Léo"), null);
  assert.equal(stockage.has("bola-plus-apercu"), false, "en production, rien sur le téléphone");
  assert.ok(evenements >= 3, "chaque changement prévient l'app");
  // La table absente à la lecture : pas d'erreur, on relira.
  p = charger("production");
  repondre = () => ({ status: 404, body: { code: "PGRST205", message: "Could not find the table" } });
  await p.chargerInteret("Léo");
  assert.equal(p.interetEnMemoire("Léo"), undefined);

  // Un toucher avant la fin de la lecture (rien en mémoire) : on lit d'abord.
  const LIGNE = { formule: "mensuel", le: "2026-11-10T08:20:00+00:00" };
  const parMethode = (lecture: { status: number; body: unknown }, ecriture: { status: number; body: unknown }) => (r: Requete) => (r.methode === "GET" ? lecture : ecriture);
  //   · déjà noté, toucher sans formule : rien n'est écrit, la formule notée reste ;
  p = charger("production");
  requetes.length = 0;
  repondre = parMethode({ status: 200, body: LIGNE }, { status: 200, body: "2026-11-12T20:00:00+00:00" });
  await p.noterInteret("Léo", null);
  assert.deepEqual(requetes.map((r) => r.methode), ["GET"], "un toucher sans formule n'écrase pas la formule notée");
  assert.deepEqual(p.interetEnMemoire("Léo"), LIGNE);
  //   · déjà noté, la même formule : rien à écrire ;
  p = charger("production");
  requetes.length = 0;
  await p.noterInteret("Léo", "mensuel");
  assert.deepEqual(requetes.map((r) => r.methode), ["GET"]);
  //   · déjà noté, une autre formule : elle est écrite ;
  p = charger("production");
  requetes.length = 0;
  repondre = parMethode({ status: 200, body: LIGNE }, { status: 200, body: LIGNE.le });
  await p.noterInteret("Léo", "annuel");
  assert.deepEqual(requetes.map((r) => r.methode), ["GET", "POST"]);
  assert.deepEqual(requetes[1].corps, { p_interesse: true, p_formule: "annuel" });
  assert.deepEqual(p.interetEnMemoire("Léo"), { formule: "annuel", le: LIGNE.le });
  //   · rien de noté : le toucher est écrit ;
  p = charger("production");
  requetes.length = 0;
  repondre = parMethode({ status: 200, body: null }, { status: 200, body: "2026-11-12T20:00:00+00:00" });
  await p.noterInteret("Léo", null);
  assert.deepEqual(requetes.map((r) => r.methode), ["GET", "POST"]);
  assert.deepEqual(p.interetEnMemoire("Léo"), { formule: null, le: "2026-11-12T20:00:00+00:00" });
  //   · la lecture échoue : on n'écrit pas à l'aveugle.
  p = charger("production");
  requetes.length = 0;
  repondre = parMethode({ status: 500, body: { code: "XX000", message: "panne" } }, { status: 200, body: "2026-11-12T20:00:00+00:00" });
  await assert.rejects(p.noterInteret("Léo", null), { message: REFUS });
  assert.deepEqual(requetes.map((r) => r.methode), ["GET"], "lecture en échec : aucune écriture");
  assert.equal(p.interetEnMemoire("Léo"), undefined);

  // 6 · La lecture de l'admin.
  const enBase = [
    { joueur: "a", formule: "annuel", le: "2026-11-12T19:42:00+00:00", profiles: { name: "Malo" } },
    { joueur: "b", formule: null, le: "2026-11-11T21:14:00+00:00", profiles: [{ name: "Enzo" }] },
    { joueur: "c", formule: "mensuel", le: "2026-11-11T09:47:00+00:00", profiles: null },
  ];
  requetes.length = 0;
  repondre = () => ({ status: 200, body: enBase });
  let lu = await p.lireInteresses("Léo");
  assert.equal(lu.echec, null);
  assert.deepEqual(lu.lignes.map((l) => [l.nom, l.formule]), [["Malo", "annuel"], ["Enzo", null], ["?", "mensuel"]]);
  assert.equal(requetes.length, 1);
  assert.ok(requetes[0].chemin.includes("profiles") && requetes[0].methode === "GET");
  repondre = () => ({ status: 404, body: { code: "PGRST205", message: "Could not find the table" } });
  assert.deepEqual(await p.lireInteresses("Léo"), { lignes: [], echec: "sans-table" });
  for (const code of ["42P01", "PGRST200"]) {
    repondre = () => ({ status: 400, body: { code, message: "table ou lien inconnu" } });
    assert.deepEqual(await p.lireInteresses("Léo"), { lignes: [], echec: "sans-table" }, code);
  }
  repondre = () => ({ status: 500, body: { code: "XX000", message: "panne" } });
  assert.deepEqual(await p.lireInteresses("Léo"), { lignes: [], echec: "autre" });
  // En production, un vieil essai resté sur le téléphone ne compte pas.
  stockage.set("bola-plus-apercu", JSON.stringify({ Léo: { formule: "annuel", le: "2026-11-01T10:00:00.000Z" } }));
  repondre = () => ({ status: 200, body: enBase });
  assert.equal((await p.lireInteresses("Léo")).lignes.length, 3, "en production, l'essai du téléphone ne s'ajoute pas");
  repondre = () => ({ status: 404, body: { code: "PGRST205", message: "Could not find the table" } });
  assert.deepEqual(await p.lireInteresses("Léo"), { lignes: [], echec: "sans-table" });
  // Dans un aperçu : l'essai du téléphone s'ajoute, même sans la table ; jamais sur une autre panne.
  stockage.clear();
  const a = charger(undefined);
  repondre = () => ({ status: 404, body: { code: "PGRST205", message: "Could not find the table" } });
  assert.deepEqual(await a.lireInteresses("Léo"), { lignes: [], echec: "sans-table" });
  await a.noterInteret("Léo", "annuel");
  lu = await a.lireInteresses("Léo");
  assert.equal(lu.echec, null);
  assert.deepEqual(lu.lignes.map((l) => [l.nom, l.formule]), [["Léo", "annuel"]]);
  assert.deepEqual(await a.lireInteresses(null), { lignes: [], echec: "sans-table" });
  repondre = () => ({ status: 200, body: enBase });
  lu = await a.lireInteresses("Léo");
  assert.equal(lu.lignes.length, 4);
  repondre = () => ({ status: 500, body: { code: "XX000", message: "panne" } });
  assert.deepEqual(await a.lireInteresses("Léo"), { lignes: [], echec: "autre" });
  assert.ok(requetes.every((r) => r.methode === "GET"), "l'admin ne fait que lire");

  // 7 · Gardes de source.
  const SRC = join(__dirname, "..", "src");
  const magasin = readFileSync(join(SRC, "lib/sfl/bola-plus-store.ts"), "utf8");
  for (const nom of ["noterInteret", "annulerInteret"]) {
    const corps = new RegExp(`export async function ${nom}\\([^)]*\\): Promise<void> \\{([\\s\\S]*?)\\n\\}`).exec(magasin)?.[1];
    assert.ok(corps, `${nom} est trouvée`);
    const garde = corps.indexOf("if (APERCU) {");
    const base = corps.indexOf("supabase()");
    assert.ok(garde >= 0 && base > garde, `${nom} : l'aperçu est traité avant tout appel à la base`);
    assert.ok(/\n {4}return;\n {2}\}/.test(corps.slice(garde, base)), `${nom} : la branche de l'aperçu sort avant la base`);
  }
  const FICHIERS = [
    "lib/sfl/bola-plus.ts",
    "lib/sfl/bola-plus-store.ts",
    "hooks/use-bola-plus.ts",
    "components/sfl/bola-plus.tsx",
    "components/sfl/bola-plus.css",
    "app/profil/bola-plus/page.tsx",
    "app/admin/activite/bola-plus.tsx",
  ];
  const PAIEMENT = /stripe|paypal|lydia|sumup|mollie|adyen|checkout|apple ?pay|google ?pay|carte bancaire|\biban\b|\bcvc\b/i;
  for (const f of FICHIERS) {
    const trouve = PAIEMENT.exec(readFileSync(join(SRC, f), "utf8"));
    assert.equal(trouve, null, `${f} cite un moyen de paiement : ${trouve?.[0]}`);
  }

  // Les trois branchements : la route et son titre, la tuile de Ma carte, la section de l'admin.
  const src = (f: string) => readFileSync(join(SRC, f), "utf8");
  const nav = src("lib/nav.ts");
  assert.ok(nav.includes('["/profil/bola-plus", MA_CARTE]'), "la page Bola Plus revient à Ma carte");
  assert.ok(nav.includes('["/profil/bola-plus", "Bola Plus"]'), "la page Bola Plus a son titre");
  assert.ok(src("app/profil/page.tsx").includes("<TuileBolaPlus />"), "la tuile est sur Ma carte");
  assert.ok(src("app/admin/activite/revenu.tsx").includes("<BolaPlusStats />"), "le compteur est dans Activité → Revenu");
  assert.ok(src("app/profil/bola-plus/page.tsx").includes("<PageBolaPlus />"), "la route montre la page Bola Plus");
  // L'écran : après « Annuler », rien ne reste coché ; le bouton fait 44 px de haut.
  const ecran = src("components/sfl/bola-plus.tsx");
  assert.ok(/function defaire\(\) \{\s*onChoix\(null\);\s*annuler\(\);\s*\}/.test(ecran), "« Annuler » décoche la formule");
  assert.ok(/<OffreBolaPlus plus=\{plus\} choix=\{choix\} onChoix=\{setChoix\} \/>/.test(ecran), "l'offre reçoit le choix de la page");
  assert.ok(/onClick=\{defaire\}[\s\S]{0,120}min-h-11/.test(ecran), "« Annuler » : une cible de 44 px");
  assert.ok(!/onClick=\{annuler\}/.test(ecran), "« Annuler » passe par defaire");

  // 8 · Les avantages.
  const TITRES = ["Tes maillots", "Tes matchs filmés", "Des cadeaux", "Les cérémonies officielles"];
  const INTERDIT = /\d|€|%|offert|gratuit|illimit|inclus|garanti|chaque|toujours|bientôt/i;
  const CHAMPS = ["alt", "id", "image", "numero", "teinte", "titre"];
  const avantagesJustes = (liste: readonly Avantage[]) => {
    assert.deepEqual(liste.map((a) => a.titre), TITRES, "quatre avantages, dans l'ordre, aux titres exacts");
    assert.deepEqual(liste.map((a) => a.numero), ["01", "02", "03", "04"]);
    assert.equal(new Set(liste.map((a) => a.id)).size, liste.length);
    for (const a of liste) {
      assert.ok(!INTERDIT.test(a.titre) && !INTERDIT.test(a.alt), `« ${a.titre} » : ni chiffre, ni prix, ni promesse`);
      assert.ok(a.titre.length <= 28, `« ${a.titre} » : 28 caractères au plus`);
      assert.deepEqual(Object.keys(a).sort(), CHAMPS, `« ${a.titre} » : un titre et son visuel, aucun autre texte`);
      assert.match(a.teinte, /^#([0-9a-f]{2})\1\1$/, `« ${a.titre} » : une teinte grise`);
    }
  };
  avantagesJustes(AVANTAGES);
  assert.deepEqual([...LARGEURS], [480, 780, 1170]);
  assert.equal(sourcesVisuel("affiche"), "/bola-plus/affiche-480.webp 480w, /bola-plus/affiche-780.webp 780w, /bola-plus/affiche-1170.webp 1170w");

  // Les visuels : chacun à ses trois largeurs, en WebP (en-tête RIFF…WEBP), léger ; rien d'autre dans le dossier.
  const PUBLIC = join(__dirname, "..", "public");
  const POIDS: Record<number, number> = { 480: 70_000, 780: 90_000, 1170: 150_000 };
  const visuelsLa = (images: readonly string[], dossier = PUBLIC) => {
    let total = 0;
    for (const image of images) {
      for (const l of LARGEURS) {
        const f = join(dossier, fichierVisuel(image, l));
        assert.ok(existsSync(f), `${fichierVisuel(image, l)} manque`);
        const o = readFileSync(f);
        assert.ok(o.subarray(0, 4).toString("latin1") === "RIFF" && o.subarray(8, 12).toString("latin1") === "WEBP", `${fichierVisuel(image, l)} : du WebP`);
        assert.ok(o.length <= POIDS[l], `${fichierVisuel(image, l)} : ${o.length} octets, au plus ${POIDS[l]}`);
        total += o.length;
      }
    }
    return total;
  };
  const IMAGES = [AFFICHE.image, ...AVANTAGES.map((a) => a.image)];
  assert.equal(new Set(IMAGES).size, 5, "cinq visuels distincts");
  const total = visuelsLa(IMAGES);
  assert.ok(total <= 1_500_000, `les visuels pèsent ${total} octets, au plus 1,5 Mo`);
  const dossier = readdirSync(join(PUBLIC, "bola-plus")).sort();
  assert.deepEqual(dossier, IMAGES.flatMap((i) => LARGEURS.map((l) => `${i}-${l}.webp`)).sort(), "public/bola-plus : les quinze visuels, rien d'autre");
  assert.ok(dossier.every((f) => statSync(join(PUBLIC, "bola-plus", f)).isFile()));

  // La source de l'écran.
  const style = src("components/sfl/bola-plus.css");
  const ecranJuste = (tsx: string, css: string) => {
    const bloc = (nom: string) => {
      const debut = tsx.indexOf(`function ${nom}(`);
      assert.ok(debut >= 0, `${nom} est trouvée`);
      const fin = tsx.indexOf("\n}\n", debut);
      return tsx.slice(debut, fin);
    };
    const carte = bloc("CarteAvantage");
    const affiche = bloc("AfficheBolaPlus");
    const barre = bloc("BarreInteret");
    const page = bloc("PageBolaPlus");
    // Les cartes se chargent quand on y arrive, à leur taille ; l'affiche tout de suite.
    assert.ok(/loading="lazy"/.test(carte) && /decoding="async"/.test(carte), "les cartes d'avantage sont chargées paresseusement");
    for (const b of [carte, affiche]) assert.ok(/width=\{LARGEUR\}/.test(b) && /height=\{HAUTEUR\}/.test(b) && /srcSet=\{sourcesVisuel\(/.test(b), "un visuel a sa largeur, sa hauteur et ses trois tailles");
    assert.ok(!/loading=/.test(affiche) && /fetchPriority="high"/.test(affiche), "l'affiche est chargée tout de suite");
    // Une carte : son numéro, son titre, rien d'autre d'écrit.
    assert.ok(/\{avantage\.numero\}/.test(carte) && /\{avantage\.titre\}/.test(carte), "la carte montre le numéro et le titre");
    assert.equal(carte.match(/<(p|h[1-6]|span)\b/g)?.length, 2, "la carte n'écrit que le numéro et le titre");
    assert.ok(/AVANTAGES\.map\(/.test(page), "la page montre les avantages de la liste");
    // Les prix : une seule source.
    // (Hors commentaires ; « border-foreground/30 » est une opacité, pas un prix.)
    const sansCommentaire = tsx.replace(/^\s*\/\/.*$/gm, "");
    assert.ok(!/(?<![\w/[-])(20|168|30)(?![\w\]])/.test(sansCommentaire), "aucun prix écrit en dur dans l'écran");
    assert.ok(/\{MENSUEL\}/.test(affiche) && /\{ANNUEL\}/.test(affiche) && /\{LIBELLE_REMISE\}/.test(affiche), "l'affiche lit les prix de l'offre");
    // Le bouton, ses états.
    for (const mot of ["Je suis intéressé", "C&apos;est noté", "Annuler"]) assert.ok(tsx.includes(mot), `« ${mot} » est toujours là`);
    // La barre collée : le même geste que le bouton de l'offre, dans <body>, effacée quand l'offre est à l'écran.
    assert.ok(/onNoter=\{\(\) => plus\.noter\(choix\)\}/.test(page), "la barre collée note par le noter de la page");
    assert.ok(/onClick=\{\(\) => noter\(choix\)\}/.test(bloc("OffreBolaPlus")), "le bouton de l'offre note par le même noter");
    assert.equal(tsx.match(/useBolaPlus\(\)/g)?.length, 2, "un seul useBolaPlus pour la page (et celui de la tuile)");
    assert.ok(/createPortal\(/.test(barre) && /document\.body/.test(barre), "la barre collée est portée dans <body>");
    assert.ok(/cachee=\{offreVue\}/.test(page) && /inert=\{cachee\}/.test(barre), "la barre s'efface quand l'offre est à l'écran");
    assert.ok(/prefers-reduced-motion: reduce/.test(page), "le saut vers l'offre est immédiat avec « Réduire les animations »");
    // La feuille de style : le mouvement réduit, le clavier.
    const reduit = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/.exec(css)?.[1] ?? "";
    assert.ok(/\.bp-carte \{[^}]*opacity: 1;[^}]*transition: none;/.test(reduit), "mouvement réduit : les cartes sont là d'emblée");
    assert.ok(/\.bp-barre[^{]*\{[^}]*transition: none;/.test(reduit), "mouvement réduit : la barre ne fond pas");
    assert.ok(/html\[data-clavier\] \.bp-barre \{\s*display: none;/.test(css), "la barre s'efface sous le clavier");
    assert.ok(!/scroll-snap|animation:|@keyframes/.test(css), "ni accroche ni animation en boucle");
    // Noir et blanc : aucune couleur écrite dans la feuille.
    for (const m of css.matchAll(/rgb\((\d+) (\d+) (\d+)/g)) assert.ok(Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) <= 8, `une couleur dans la feuille : ${m[0]}`);
    assert.ok(!/#[0-9a-f]{3,8}\b/i.test(css.replace(/#fff\b/g, "")), "pas d'autre teinte que le blanc dans la feuille");
  };
  ecranJuste(ecran, style);

  // Les mutants : chaque garde refuse sa faute.
  const refuse = (nom: string, essai: () => void) => {
    let passe = true;
    try {
      essai();
    } catch {
      passe = false;
    }
    assert.ok(!passe, `mutant accepté : ${nom}`);
  };
  const mute = (nom: string, source: string, de: string | RegExp, vers: string) => {
    const m = source.replace(de, vers);
    assert.notEqual(m, source, `mutant sans effet : ${nom}`);
    return m;
  };
  refuse("un titre changé", () => avantagesJustes(AVANTAGES.map((a, i) => (i === 0 ? { ...a, titre: "Ton kit complet" } : a))));
  refuse("un avantage de plus", () => avantagesJustes([...AVANTAGES, { ...AVANTAGES[0], id: "x", numero: "05", titre: "Tes stats" }]));
  refuse("une promesse chiffrée", () => avantagesJustes(AVANTAGES.map((a, i) => (i === 2 ? { ...a, titre: "Des cadeaux offerts" } : a))));
  refuse("une description ajoutée", () => avantagesJustes(AVANTAGES.map((a) => ({ ...a, description: "Chaque saison." }) as Avantage)));
  refuse("une image retirée", () => visuelsLa([...IMAGES, "absente"]));
  refuse("lazy retiré", () => ecranJuste(mute("lazy", ecran, '        loading="lazy"\n', ""), style));
  refuse("un prix en dur", () => ecranJuste(mute("prix", ecran, "{MENSUEL}&nbsp;€\n          </span>\n          / mois", "20&nbsp;€\n          </span>\n          / mois"), style));
  refuse("la barre branchée ailleurs", () => ecranJuste(mute("barre", ecran, "onNoter={() => plus.noter(choix)}", "onNoter={voirOffre}"), style));
  refuse("une phrase sous un titre", () => ecranJuste(mute("phrase", ecran, "{avantage.titre}</h2>", "{avantage.titre}</h2>\n      <p>Chaque saison.</p>"), style));
  refuse("la barre jamais effacée", () => ecranJuste(mute("inert", ecran, " inert={cachee}", ""), style));
  refuse("le mouvement réduit oublié", () => ecranJuste(ecran, mute("reduit", style, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*$/, "")));
  refuse("une couleur dans la feuille", () => ecranJuste(ecran, mute("couleur", style, "color: rgb(255 255 255 / 0.7);", "color: rgb(255 138 76 / 0.7);")));

  console.log("bola-plus : ok");
}

banc().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
