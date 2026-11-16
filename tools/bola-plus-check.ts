// Bola Plus, la précommande (12/11/2026 : lib/sfl/bola-plus.ts, bola-plus-store.ts).
//   1 · l'offre (retour de Sabri, 13/11 01:44) : 19,90 € et 168,90 €, écrits
//       en centimes dans lib/sfl/bola-plus.ts et nulle part ailleurs ; la
//       remise se calcule (1 − 16 890 / 23 880 = 29,27 % → « −29 % », arrondie
//       vers le bas) ; les 4 fois aussi (16 890 / 4 = 4 222,5 centimes →
//       « 4 × 42,23 € sans frais », arrondie au centime supérieur, en entiers :
//       un toFixed sur des euros tombe parfois sous le prix). Balayage de 0 à 50 000
//       centimes : n échéances ne passent jamais sous le prix, ni plus de n − 1
//       centimes au-dessus ;
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
//       Plus ne cite un prestataire de paiement (ni Klarna, ni aucun autre
//       paiement en plusieurs fois ; « Klarna » n'est nulle part dans src/) ; la route, la tuile de Ma
//       carte et la section de l'admin sont branchées ; après « Annuler », rien
//       ne reste coché, et le bouton fait 44 px.
//   8 · le carrousel (retours de Sabri du 14/11, 20:34 → 20:47) : la grille
//       officielle de la SFL et le prix premiers joueurs dans la seule
//       source (barrés au-dessus des prix, saison < 140 €, année < 280 € et
//       < 12 × 35 €, 4 échéances qui couvrent le prix, remises 43 % et 32 %
//       calculées, jamais affichées) ; le bundle complet ; les avantages (une
//       part et un identifiant chacun, les sept attendus dans l'ordre, Bola
//       Studio compris, et aucun de plus) ; les visuels (trois largeurs, WebP,
//       légers, « Image générée : » pour ceux qui le sont) ; la palette loin
//       de l'or, du rouge et du cobalt des cartes, sans la braise, et ses
//       contrastes ; la feuille sans aucune teinte écrite (tout passe par les
//       variables de la page) ; l'écran : carrousel aimanté, segments,
//       clavier, mouvement réduit, une seule barre « Je suis intéressé »
//       effacée sur « Ton prix », la vraie carte « Toi », aucun montant en
//       dur, une liste fermée de mots. « Tes maillots » prend l'image des
//       maillots portés par un seul fichier déposé, refusé par .gitignore.
//   9 · Bola Studio dans le carrousel (bola-app#22, raccordé le 14/11) :
//       « Ton studio » après « Bola Plus », dessiné par VisuelStudio
//       (COMPOSANTS) avec ses ballons du mois sous le titre (PIEDS,
//       MentionStudio) ; sous chaque formule de « Ton prix », ses ballons
//       (BALLONS_FORMULE de lib/sfl/studio.ts), visibles, après la ligne du
//       dessous. Le catalogue, le panneau, les recharges et les vignettes
//       (public/bola-plus/studio/, le seul dossier admis à côté des visuels)
//       sont contrôlés par tools/studio-check.ts.
//       Des mutants de la source sont rejoués : chaque garde doit les refuser.
// Sans réseau : fetch est remplacé.
//   npx tsx tools/bola-plus-check.ts
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AFFICHE,
  ANNUEL,
  ANNUEL_CENTIMES,
  AVANTAGES,
  BARRE,
  BOLA_PLUS_SEUL,
  BOLA_PLUS_SEUL_CENTIMES,
  BUNDLE,
  CARTE_TOI,
  ECHEANCES,
  FONCTIONS_BOLA_PLUS,
  GRILLE_SFL,
  LARGEURS,
  LIBELLE_ECHEANCES,
  LIBELLE_REMISE,
  MENSUEL,
  MENSUEL_CENTIMES,
  NOM_BUNDLE,
  PALETTE,
  PARRAINAGE,
  PRIX_FORMULE,
  REMISE,
  REMISE_GRILLE,
  REMISE_POUR_CENT,
  SFL_OFFICIEL,
  TEINTES_RESERVEES,
  avecEssai,
  compter,
  diapos,
  echeance,
  fichierVisuel,
  interetDe,
  lireEssais,
  montant,
  prix,
  sourcesVisuel,
  type Avantage,
  type LigneInteret,
} from "../src/lib/sfl/bola-plus";
import { voitBolaPlus } from "../src/lib/sfl/bola-plus";
import { createHmac } from "node:crypto";
import { signatureValide } from "../src/lib/server/stripe.server";
import { FIN_PREMIERS_JOUEURS, casesDe, resteAvant, resteCourt } from "../src/lib/sfl/compte-a-rebours";

// 1 · L'offre.
const NBSP = "\u00a0";
assert.equal(MENSUEL_CENTIMES, 1990);
assert.equal(ANNUEL_CENTIMES, 16890);
assert.equal(ECHEANCES, 4);
assert.equal(MENSUEL, "19,90");
assert.equal(ANNUEL, "168,90");
assert.equal(montant(5), "0,05");
assert.equal(montant(100), "1,00");
assert.equal(montant(100000), "1\u202f000,00");
assert.throws(() => montant(42.225), "un montant n'est fait que de centimes entiers");
assert.throws(() => montant(-1));
assert.ok(Math.abs(REMISE - (1 - 16890 / 23880)) < 1e-12, "la remise : 1 − 16 890 / (12 × 1 990)");
assert.equal(REMISE_POUR_CENT, 29, "29,27 % arrondis vers le bas");
assert.equal(LIBELLE_REMISE, `−29${NBSP}%`);
assert.equal(LIBELLE_ECHEANCES, `4${NBSP}×${NBSP}42,23${NBSP}€ sans frais`);
// La remise et l'échéance, rejouées par des calculs qu'on peut fausser (les mutants, plus bas).
const remiseJuste = (pourCent: (mois: number, an: number) => number) => {
  assert.equal(pourCent(1990, 16890), 29, "−29 % pour 19,90 € et 168,90 €");
  assert.equal(pourCent(2000, 16800), 30, "−30 % pour 20 € et 168 €");
  assert.equal(pourCent(1000, 8900), 25, "25,83 % → −25 % : jamais plus que la vraie remise");
};
remiseJuste((m, a) => Math.floor(((12 * m - a) * 100) / (12 * m)));
const echeanceJuste = (libelle: (centimes: number, n: number) => string) => {
  assert.equal(libelle(16890, 4), "42,23", "168,90 € en 4 fois : 42,23 €");
  for (let c = 0; c <= 50_000; c += 7) {
    for (const n of [2, 3, 4]) {
      const [e, ct] = libelle(c, n).split(",").map(Number);
      const parEcheance = e * 100 + ct;
      assert.ok(parEcheance * n >= c && parEcheance * n - c <= n - 1, `${c} centimes en ${n} fois : ${libelle(c, n)} €`);
    }
  }
};
echeanceJuste((c, n) => montant(echeance(c, n)));

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
function charger(env: string | undefined, table = true): Magasin {
  if (env === undefined) delete process.env.NEXT_PUBLIC_BOLA_ENV;
  else process.env.NEXT_PUBLIC_BOLA_ENV = env;
  // La table en base (NEXT_PUBLIC_BOLA_PLUS_TABLE) : sans elle, même la production garde le toucher sur le téléphone.
  if (table) process.env.NEXT_PUBLIC_BOLA_PLUS_TABLE = "1";
  else delete process.env.NEXT_PUBLIC_BOLA_PLUS_TABLE;
  delete require.cache[CHEMIN];
  // Le client de la base aussi : il relit la session du téléphone à sa création.
  delete require.cache[CLIENT];
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- rechargé exprès, une fois par environnement
  return require(CHEMIN) as Magasin;
}
const REFUS = "Pas enregistré. Reconnecte-toi, puis réessaie.";
const UID = "aaaaaaaa-0000-4000-8000-000000000001";

async function banc() {
  // 0 ter · La signature du webhook (lib/server/stripe.server.ts) : la bonne passe, une fausse, une vieille ou un corps changé non.
  {
    const secret = "whsec_essai";
    const corps = '{"type":"checkout.session.completed"}';
    const t = 1_794_850_000;
    const sig = createHmac("sha256", secret).update(`${t}.${corps}`).digest("hex");
    const maintenant = t * 1000 + 10_000;
    assert.ok(signatureValide(corps, `t=${t},v1=${sig}`, secret, maintenant), "la bonne signature passe");
    assert.ok(signatureValide(corps, `t=${t},v1=${"0".repeat(64)},v1=${sig}`, secret, maintenant), "une des signatures suffit");
    assert.ok(!signatureValide(corps, `t=${t},v1=${"0".repeat(64)}`, secret, maintenant), "une fausse non");
    assert.ok(!signatureValide(corps + " ", `t=${t},v1=${sig}`, secret, maintenant), "un corps changé non");
    assert.ok(!signatureValide(corps, `t=${t},v1=${sig}`, secret, maintenant + 600_000), "une vieille non");
    assert.ok(!signatureValide(corps, null, secret, maintenant), "sans en-tête non");
  }
  // 0 bis · Le compte à rebours (16/11) : dimanche 22/11 23:59:59 à Paris, soit 22:59:59 UTC.
  assert.equal(new Date(FIN_PREMIERS_JOUEURS).toISOString(), "2026-11-22T22:59:59.000Z");
  const lundi = Date.parse("2026-11-16T17:30:00+01:00");
  const r = resteAvant(FIN_PREMIERS_JOUEURS, lundi);
  assert.deepEqual([r.jours, r.heures, r.minutes, r.secondes, r.fini, r.dernierJour], [6, 6, 29, 59, false, false]);
  assert.equal(resteCourt(r), "6 j 06 h");
  assert.deepEqual(casesDe(r).map((c) => c.valeur), ["06", "06", "29", "59"]);
  const dimanche = resteAvant(FIN_PREMIERS_JOUEURS, Date.parse("2026-11-22T21:00:00+01:00"));
  assert.ok(dimanche.dernierJour && resteCourt(dimanche) === "02 h 59 min");
  assert.equal(resteCourt(resteAvant(FIN_PREMIERS_JOUEURS, FIN_PREMIERS_JOUEURS - 65_500)), "01 min 05 s", "arrondi vers le bas");
  const apres = resteAvant(FIN_PREMIERS_JOUEURS, FIN_PREMIERS_JOUEURS + 1);
  assert.ok(apres.fini && !apres.dernierJour && apres.jours === 0 && apres.secondes === 0, "après la fin : terminé, jamais négatif");
  // 0 · Qui voit Bola Plus en ligne (16/11) : Ilyes et Sabri, personne d'autre.
  assert.ok(voitBolaPlus("Ilyes") && voitBolaPlus("Sabri"), "les deux admins voient Bola Plus");
  for (const nom of ["Léo", "sabri", "Sidali", "", null, undefined]) assert.equal(voitBolaPlus(nom), false, `${String(nom)} ne voit pas Bola Plus`);

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

  // 4 bis · En production sans la table (16/11 : seuls les admins voient Bola Plus) : le toucher reste sur le téléphone, rien n'est demandé à la base.
  stockage.clear();
  requetes.length = 0;
  const sansTable = charger("production", false);
  assert.equal(sansTable.APERCU, true, "sans la table, la production reste sur le téléphone");
  await sansTable.chargerInteret("Ilyes");
  await sansTable.noterInteret("Ilyes", "annuel");
  assert.equal(sansTable.interetEnMemoire("Ilyes")?.formule, "annuel");
  assert.equal(requetes.length, 0, "sans la table, aucune requête");

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
    "lib/sfl/studio.ts",
    "components/sfl/studio-bola.tsx",
    "components/sfl/studio-bola.css",
  ];
  const PAIEMENT = /stripe|paypal|lydia|sumup|mollie|adyen|checkout|apple ?pay|google ?pay|carte bancaire|\biban\b|\bcvc\b|klarna|\balma\b|\boney\b|scalapay|\bfloa\b|younited|cofidis|afterpay|clearpay/i;
  const sansPaiement = (f: string, texte: string) => {
    const trouve = PAIEMENT.exec(texte);
    assert.equal(trouve, null, `${f} cite un moyen de paiement : ${trouve?.[0]}`);
  };
  for (const f of FICHIERS) sansPaiement(f, readFileSync(join(SRC, f), "utf8"));
  // « Klarna » nulle part dans l'app : ni nom, ni logo, ni appel.
  const tout = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tout(join(d, e.name)) : [join(d, e.name)]));
  for (const f of tout(SRC)) assert.ok(!/klarna/i.test(readFileSync(f, "utf8")), `${f} nomme Klarna`);
  // Les prix : une seule source. Aucun montant de l'offre ailleurs que dans lib/sfl/bola-plus.ts.
  const MONTANTS = /(?<![\d,.])(19[,.]90?|168[,.]90?|42[,.]2[235]|1990|16890|4223)(?![\d,.])|[−-][\s\u00a0]?(29|30)[\s\u00a0]?%/;
  const uneSource = (f: string, texte: string) => {
    const sansNotes = texte.replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
    const trouve = MONTANTS.exec(sansNotes);
    assert.equal(trouve, null, `${f} écrit un montant de l'offre en dur : ${trouve?.[0]}`);
  };
  // Et aucun montant du tout, ni « euros » écrit dans un texte (un ancien prix, un prix écrit en lettres) :
  // le seul montant permis hors de la source est le « 0 € » du revenu de l'admin, qui n'est pas un prix.
  const UN_MONTANT = /(?<![\w.,])\d+(?:[.,]\d+)?(?:\s|&nbsp;|\u00a0|\u202f)?€|(["'`>])[^"'`<>\n]*\beuros?\b/i;
  const aucunMontant = (f: string, texte: string) => {
    const sansNotes = texte.replace(/^\s*(\/\/|\*|\/\*).*$/gm, "").replace(/>0 €</g, "><");
    const trouve = UN_MONTANT.exec(sansNotes);
    assert.equal(trouve, null, `${f} écrit un montant hors de la source : ${trouve?.[0]}`);
  };
  for (const f of [...FICHIERS.filter((f) => f !== "lib/sfl/bola-plus.ts"), "app/profil/page.tsx", "app/admin/activite/revenu.tsx"]) {
    uneSource(f, readFileSync(join(SRC, f), "utf8"));
    aucunMontant(f, readFileSync(join(SRC, f), "utf8"));
  }
  // Dans la source de l'offre : les deux prix en centimes, une seule fois, et aucun arrondi sur des euros flottants.
  const offreSource = readFileSync(join(SRC, "lib/sfl/bola-plus.ts"), "utf8");
  const sourceJuste = (texte: string) => {
    const code = texte.replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
    assert.equal(code.match(/\b1990\b/g)?.length, 1, "1990 écrit une fois");
    assert.equal(code.match(/\b16890\b/g)?.length, 1, "16890 écrit une fois");
    assert.ok(!/toFixed|parseFloat|toLocaleString|Intl\./.test(code), "les montants se calculent en centimes entiers");
    assert.ok(/export const REMISE_POUR_CENT = Math\.floor\(\(\(12 \* MENSUEL_CENTIMES - ANNUEL_CENTIMES\) \* 100\) \/ \(12 \* MENSUEL_CENTIMES\)\);/.test(code), "la remise s'arrondit vers le bas, en entiers, dans la source");
    assert.ok(/export const LIBELLE_REMISE = `−\$\{REMISE_POUR_CENT\}\\u00a0%`;/.test(code), "« −29 % » lit la remise arrondie de la source");
    assert.ok(/LIBELLE_ECHEANCES = `\$\{ECHEANCES\}[^`]*\$\{montant\(echeance\(ANNUEL_CENTIMES, ECHEANCES\)\)\}[^`]*sans frais`/.test(code), "les 4 fois se calculent sur le prix de l'année");
  };
  sourceJuste(offreSource);

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
  assert.ok(/function defaire\(\) \{\s*suivre\.current = true;\s*onChoix\(null\);\s*annuler\(\);\s*\}/.test(ecran), "« Annuler » décoche la formule");
  assert.ok(/<DiapoPrix plus=\{plus\} choix=\{choix\} onChoix=\{setChoix\} actionRef=\{actionRef\} \/>/.test(ecran) && /<OffreBolaPlus plus=\{plus\} choix=\{choix\} onChoix=\{onChoix\} actionRef=\{actionRef\} \/>/.test(ecran), "l'offre reçoit le choix de la page");
  assert.ok(/onClick=\{defaire\}[\s\S]{0,120}min-h-11/.test(ecran), "« Annuler » : une cible de 44 px");
  assert.ok(!/onClick=\{annuler\}/.test(ecran), "« Annuler » passe par defaire");

  // 8 · Le carrousel.
  // La grille de la SFL et le prix premiers joueurs : une seule source, des barrés au-dessus des prix.
  type Grille = { mois: number; saison: { prix: number; reference: number }; annee: { prix: number; reference: number } };
  const grilleJuste = (g: Grille, barre: typeof BARRE, mois: number, an: number) => {
    assert.ok(g.saison.prix < g.saison.reference && g.saison.reference === 14000, "la saison : 119,90 € au lieu de 140 €");
    assert.ok(g.annee.prix < g.annee.reference && g.annee.reference === 28000, "l'année : 249,90 € au lieu de 280 €");
    assert.ok(g.annee.prix < 12 * g.mois, "l'année coûte moins que douze mois sans engagement");
    assert.equal(barre.mensuel, g.mois, "le mensuel barre le mois de la grille");
    assert.equal(barre.annuel, g.annee.prix, "l'annuel barre l'année de la grille");
    assert.ok(barre.mensuel > mois && barre.annuel > an, "chaque barré est au-dessus de son prix");
    assert.ok(ECHEANCES * echeance(an, ECHEANCES) >= an, "quatre échéances couvrent le prix");
  };
  assert.equal(BOLA_PLUS_SEUL_CENTIMES, 990);
  assert.deepEqual(SFL_OFFICIEL, { mois: 3500, saison: { prix: 11990, reference: 14000 }, annee: { prix: 24990, reference: 28000 } });
  grilleJuste(SFL_OFFICIEL, BARRE, MENSUEL_CENTIMES, ANNUEL_CENTIMES);
  assert.deepEqual(REMISE_GRILLE, { mensuel: 43, annuel: 32 }, "−43 % et −32 % contre la grille, arrondis vers le bas");
  assert.equal(prix(3500), "35");
  assert.equal(prix(24990), "249,90");
  assert.equal(BOLA_PLUS_SEUL, "9,90");
  assert.deepEqual(GRILLE_SFL, [
    { prix: "35", par: "mois" },
    { prix: "119,90", par: "saison" },
    { prix: "249,90", par: "an" },
  ]);
  assert.deepEqual(PRIX_FORMULE, {
    mensuel: { euros: MENSUEL, par: "mois", barre: "35", sous: "Sans engagement" },
    annuel: { euros: ANNUEL, par: "an", barre: "249,90", sous: LIBELLE_ECHEANCES },
  });
  // Le bundle : Bola Plus, les maillots, les stats, la carte, la SFL.
  const bundleJuste = (b: readonly string[]) => assert.deepEqual([...b], ["bola-plus", "maillots", "stats", "carte", "sfl"], "le bundle est complet, dans l'ordre");
  bundleJuste(BUNDLE);
  assert.deepEqual(Object.keys(NOM_BUNDLE).sort(), [...BUNDLE].sort());
  assert.deepEqual(
    FONCTIONS_BOLA_PLUS.map((f) => f.nom),
    ["Ton équipe", "Trash talk", "Skins et aspects", "Quêtes et missions"]
  );

  // Les avantages : une part et un identifiant chacun ; les six attendus, dans l'ordre ; un de plus permis (Bola Studio).
  const ATTENDUS = [
    ["carte", "plus", "Ta carte continue."],
    ["bola-plus", "plus", "Bola Plus"],
    ["studio", "plus", "Ton studio"],
    ["maillots", "sfl", "Tes maillots"],
    ["matchs-filmes", "sfl", "Tes matchs filmés"],
    ["cadeaux", "sfl", "Des cadeaux"],
    ["ceremonies", "sfl", "Les cérémonies officielles"],
  ] as const;
  const INTERDIT = /\d|€|%|gratuit|illimit|inclus|garanti|chaque|toujours|bientôt/i;
  const DEPOSE = "/bola-plus/maillots-portes.webp";
  const avantagesJustes = (liste: readonly Avantage[]) => {
    assert.equal(new Set(liste.map((a) => a.id)).size, liste.length, "un identifiant par avantage");
    const ids = liste.map((a) => a.id);
    let avant = -1;
    for (const [id, part, titre] of ATTENDUS) {
      const i = ids.indexOf(id);
      assert.ok(i > avant, `« ${titre} » est là, à sa place`);
      avant = i;
      assert.equal(liste[i].part, part, `« ${titre} » : sa part`);
      assert.equal(liste[i].titre, titre, `« ${titre} » : son titre exact`);
    }
    assert.equal(liste.length, ATTENDUS.length, "les sept avantages, aucun de plus");
    // « Ton studio » : dessiné par le code (l'éventail de Bola Studio), pas une image.
    const studio = liste.find((a) => a.id === "studio");
    assert.deepEqual(studio?.visuel, { genre: "composant", composant: "studio" }, "« Ton studio » : l'éventail de Bola Studio");
    assert.ok(!studio?.sous, "« Ton studio » : ses ballons viennent de studio.ts, pas d'une ligne écrite ici");
    // Les violettes d'abord, puis les vertes : on glisse de Bola Plus à la SFL.
    const parts = liste.map((a) => a.part);
    assert.deepEqual(parts, [...parts].sort((x, y) => (x === y ? 0 : x === "plus" ? -1 : 1)), "les avantages de Bola Plus avant ceux de la SFL");
    for (const a of liste) {
      assert.ok(a.part === "plus" || a.part === "sfl", `« ${a.titre} » : une part connue`);
      assert.ok(!INTERDIT.test(a.titre) && !(a.sous && INTERDIT.test(a.sous)), `« ${a.titre} » : ni chiffre, ni prix, ni promesse`);
      assert.ok(a.titre.length <= 28 && (a.sous ?? "").length <= 28, `« ${a.titre} » : peu de mots`);
      assert.deepEqual(Object.keys(a).filter((k) => !["depose", "sous"].includes(k)).sort(), ["id", "part", "titre", "visuel"], `« ${a.titre} » : un titre et son visuel, rien d'autre`);
      if (a.visuel.genre === "image") {
        assert.ok(a.visuel.alt && !/\d|€|%/.test(a.visuel.alt), `« ${a.titre} » : un visuel décrit`);
        if (a.visuel.rapport === 1.5) assert.ok(a.visuel.alt.startsWith("Image générée : "), `« ${a.titre} » : son visuel dit qu'il est généré`);
      }
      if (a.depose) {
        assert.equal(a.id, "maillots", "seule « Tes maillots » attend un visuel déposé");
        assert.deepEqual(Object.keys(a.depose).sort(), ["alt", "fichier"]);
        assert.equal(a.depose.fichier, DEPOSE, "un seul fichier à déposer");
        assert.ok(a.depose.alt.startsWith("Image générée : "), "le visuel déposé dit qu'il est généré");
        const noms = a.depose.alt.slice("Image générée : ".length).match(/@|\b[A-ZÀ-Ý][\p{L}'’-]*/gu) ?? [];
        assert.deepEqual(noms.filter((m) => m !== "SFL" && m !== "BOLA" && m !== "Bola"), [], "le visuel déposé ne nomme aucun joueur");
      }
    }
  };
  avantagesJustes(AVANTAGES);
  assert.equal(AVANTAGES.filter((a) => a.depose).length, 1, "« Tes maillots » est prête pour les maillots portés");
  // Les cartes du carrousel : l'ouverture, les avantages, « Ramène 5 », le prix.
  const ordre = diapos().map((d) => d.id);
  assert.deepEqual(ordre, ["ouverture", ...AVANTAGES.map((a) => a.id), "parrainage", "prix"]);
  assert.equal(diapos([...AVANTAGES, { id: "autre", part: "plus", titre: "Un autre", visuel: { genre: "composant", composant: "carte" } }]).length, ordre.length + 1, "un avantage de plus fait une carte de plus, sans rien d'autre");
  assert.equal(ordre.indexOf("studio"), ordre.indexOf("bola-plus") + 1, "« Ton studio » juste après « Bola Plus »");
  assert.deepEqual(PARRAINAGE, { titre: "Ramène 5 abonnés.", sous: "Le tien est offert, tant qu'ils restent abonnés.", nombre: 5 });
  assert.equal(AFFICHE.alt, "", "l'ouverture : le stade est un décor");
  assert.deepEqual([...LARGEURS], [480, 780, 1170]);
  assert.equal(sourcesVisuel("affiche"), "/bola-plus/affiche-480.webp 480w, /bola-plus/affiche-780.webp 780w, /bola-plus/affiche-1170.webp 1170w");

  // La palette : loin de l'or, du rouge et du cobalt des cartes ; pas de braise ; des contrastes AA.
  const rvb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const teinte = (h: string) => {
    const [r, g, b] = rvb(h).map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    // Une teinte presque neutre (la nuit) n'a pas de couleur à comparer.
    if (d < 0.12) return null;
    const t = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (t * 60 + 360) % 360;
  };
  const ecart = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  const lum = (h: string) => {
    const [r, g, b] = rvb(h).map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contraste = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  type Palette = { plus: { [k in keyof typeof PALETTE.plus]: string }; sfl: { [k in keyof typeof PALETTE.sfl]: string }; prix: string; nuit: string };
  const couleurs = (p: Palette) => [...Object.values(p.plus), ...Object.values(p.sfl), p.prix, p.nuit];
  const paletteJuste = (p: Palette) => {
    for (const c of couleurs(p)) {
      assert.match(c, /^#[0-9A-F]{6}$/i);
      assert.notEqual(c.toUpperCase(), "#FF8A4C", "la braise est réservée au « Il manque N »");
      const t = teinte(c);
      if (t === null) continue;
      for (const [nom, r] of Object.entries(TEINTES_RESERVEES)) assert.ok(ecart(t, teinte(r)!) >= 30, `${c} est trop près de la teinte ${nom} (${Math.round(ecart(t, teinte(r)!))}°)`);
    }
    for (const [texte, fond] of [
      ["#FFFFFF", p.plus.fond],
      [p.plus.clair, p.plus.fond],
      ["#FFFFFF", p.plus.vif],
      ["#FFFFFF", p.sfl.fond],
      ["#FFFFFF", p.sfl.encre],
      [p.prix, p.nuit],
      [p.prix, p.plus.fond],
      [p.prix, p.sfl.fond],
      [p.nuit, p.prix],
      [p.plus.encre, "#FFFFFF"],
      [p.sfl.encre, "#FFFFFF"],
      [p.plus.fond, p.plus.fondClair],
      [p.plus.encre, p.plus.fondClair],
    ])
      assert.ok(contraste(texte, fond) >= 4.5, `${texte} sur ${fond} : ${contraste(texte, fond).toFixed(1)}, au moins 4,5`);
  };
  paletteJuste(PALETTE);

  // Les visuels : chacun à ses trois largeurs, en WebP (en-tête RIFF…WEBP), léger ; rien d'autre dans le dossier.
  const PUBLIC = join(__dirname, "..", "public");
  const POIDS: Record<number, number> = { 480: 70_000, 780: 250_000, 1170: 250_000 };
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
  const IMAGES = [AFFICHE.image, ...AVANTAGES.flatMap((a) => (a.visuel.genre === "image" ? [a.visuel.image] : []))];
  assert.equal(new Set(IMAGES).size, 5, "cinq visuels distincts");
  const total = visuelsLa(IMAGES);
  assert.ok(total <= 2_000_000, `les visuels pèsent ${total} octets, au plus 2 Mo`);
  // La taille d'un WebP, lue dans son en-tête (VP8X, VP8 ou VP8L).
  const tailleWebp = (o: Buffer) => {
    const bloc = o.subarray(12, 16).toString("latin1");
    if (bloc === "VP8X") return { largeur: 1 + o.readUIntLE(24, 3), hauteur: 1 + o.readUIntLE(27, 3) };
    if (bloc === "VP8 ") return { largeur: o.readUInt16LE(26) & 0x3fff, hauteur: o.readUInt16LE(28) & 0x3fff };
    if (bloc === "VP8L") {
      const b = o.readUInt32LE(21);
      return { largeur: (b & 0x3fff) + 1, hauteur: ((b >> 14) & 0x3fff) + 1 };
    }
    throw new Error(`WebP inconnu : ${bloc}`);
  };
  // Le rapport de chaque visuel : celui qu'il déclare.
  for (const a of AVANTAGES) {
    if (a.visuel.genre !== "image") continue;
    const { largeur, hauteur } = tailleWebp(readFileSync(join(PUBLIC, fichierVisuel(a.visuel.image, 780))));
    assert.ok(Math.abs(hauteur - largeur * a.visuel.rapport) <= 2, `${a.visuel.image} : ${largeur} × ${hauteur}, rapport ${a.visuel.rapport}`);
  }
  const deposeJuste = (dossier = PUBLIC) => {
    const f = join(dossier, DEPOSE);
    if (!existsSync(f)) return false;
    const o = readFileSync(f);
    assert.ok(o.subarray(0, 4).toString("latin1") === "RIFF" && o.subarray(8, 12).toString("latin1") === "WEBP", `${DEPOSE} : du WebP`);
    assert.ok(o.length <= 250_000, `${DEPOSE} : ${o.length} octets, au plus 250 000`);
    const { largeur, hauteur } = tailleWebp(o);
    assert.ok(largeur === 1170 && Math.abs(hauteur - 1170 * 1.25) <= 1, `${DEPOSE} : ${largeur} × ${hauteur}, attendu 1170 × 1462 (4:5)`);
    return true;
  };
  // Il montre de vrais joueurs : .gitignore le garde hors du dépôt public.
  assert.ok(/^public\/bola-plus\/maillots-portes\*\.webp$/m.test(readFileSync(join(__dirname, "..", ".gitignore"), "utf8")), ".gitignore refuse les maillots portés");
  const depose = deposeJuste();
  if (depose) console.log(`bola-plus : ${DEPOSE} est déposé, « Tes maillots » le montre`);
  // Le dossier studio/ : les vignettes de Bola Studio (douze images et leurs copies légères), contrôlées par tools/studio-check.ts.
  const STUDIO = "studio";
  const dossier = readdirSync(join(PUBLIC, "bola-plus")).sort();
  assert.deepEqual(
    dossier,
    [...IMAGES.flatMap((i) => LARGEURS.map((l) => `${i}-${l}.webp`)), ...(depose ? [DEPOSE.split("/").pop()!] : []), STUDIO].sort(),
    "public/bola-plus : les quinze visuels (et le visuel déposé), le dossier des vignettes de Bola Studio, rien d'autre"
  );
  assert.ok(dossier.every((f) => (f === STUDIO ? statSync(join(PUBLIC, "bola-plus", f)).isDirectory() : statSync(join(PUBLIC, "bola-plus", f)).isFile())));

  // La source de l'écran.
  const style = src("components/sfl/bola-plus.css");
  const ecranJuste = (tsx: string, css: string) => {
    const bloc = (nom: string) => {
      const debut = tsx.indexOf(`function ${nom}(`);
      assert.ok(debut >= 0, `${nom} est trouvée`);
      const fin = tsx.indexOf("\n}\n", debut);
      return tsx.slice(debut, fin);
    };
    const page = bloc("PageBolaPlus");
    const offre = bloc("OffreBolaPlus");
    const barre = bloc("BarreInteret");
    const photo = bloc("DiapoPhoto");
    const ouverture = bloc("DiapoOuverture");
    const carte = bloc("VisuelCarte");
    const tuile = bloc("TuileBolaPlus");
    const sansCommentaire = tsx.replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    // Aucun montant en dur, aucune couleur écrite : tout vient de lib/sfl/bola-plus.ts.
    assert.ok(!/(?<![\w/[.-])(19|20|35|119|140|168|249|280|29|30|32|42|43|90|990|1990|16890|3500|4223)(?![\w\]])/.test(sansCommentaire.replace(/size-\[\d+px\]|\[\d+px\]/g, "")), "aucun prix écrit en dur dans l'écran");
    assert.ok(!/sans frais|en \d+ fois|×/.test(sansCommentaire), "les 4 fois ne s'écrivent que dans la source");
    assert.ok(!/#[0-9a-f]{3,8}\b/i.test(sansCommentaire), "aucune teinte écrite dans l'écran (PALETTE)");
    assert.ok(/"--bp-prix": PALETTE\.prix/.test(tsx) && /style=\{COULEURS\}/.test(page), "la page pose la palette en variables");
    const COULEUR = /\b(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d/;
    assert.equal(COULEUR.exec(sansCommentaire)?.[0] ?? null, null, "une classe de couleur de Tailwind dans l'écran");
    // La tuile de Ma carte reste en noir et blanc : la couleur ne sort pas de la page.
    assert.ok(!/bp-|PALETTE/.test(tuile), "la tuile de Ma carte n'a pas les couleurs de la page");
    // Le carrousel : aimanté, nommé, une diapositive par carte, segments et clavier.
    assert.ok(/aria-roledescription="carrousel"/.test(page) && /aria-roledescription="diapositive"/.test(page), "le carrousel et ses diapositives sont nommés");
    assert.ok(/aria-label=\{`\$\{i \+ 1\} sur \$\{n\} : \$\{d\.nom\}`\}/.test(page), "chaque diapositive dit sa place");
    assert.ok(/aria-current=\{i === actif \? "true" : undefined\}/.test(page) && /aria-label=\{`Aller à \$\{i \+ 1\} sur \$\{n\} : \$\{d\.nom\}`\}/.test(page), "les segments disent où l'on est");
    assert.ok(/e\.key === "ArrowRight"/.test(page) && /e\.key === "Home"/.test(page) && /e\.key === "End"/.test(page) && /onKeyDown=\{clavier\}/.test(page), "le clavier fait tourner le carrousel");
    assert.ok(/e\.stopPropagation\(\);/.test(offre), "les flèches des formules ne font pas tourner le carrousel");
    assert.ok(/className="bp-rail" tabIndex=\{0\} aria-label="Cartes"/.test(page) && /role="group"[^>]*aria-roledescription="diapositive"/.test(page), "le rail et chaque diapositive ont un nom");
    assert.ok(/vise\.current = j;/.test(page) && /const depart = \(\) => vise\.current \?\? actif;/.test(page) && /aller\(depart\(\) \+ 1\)/.test(page), "plusieurs ← → rapides avancent d'autant");
    assert.ok(/threshold: 0\.6/.test(page) && /root: rail/.test(page), "la carte active : les trois cinquièmes du rail");
    assert.ok(/behavior: doux \? "smooth" : "auto"/.test(page) && /prefers-reduced-motion: reduce/.test(page), "les sauts suivent « Réduire les animations »");
    assert.ok(/diapos\(\)/.test(page), "le carrousel lit la liste des cartes de la source");
    assert.ok(/const COMPOSANTS: Record<ComposantAvantage, \(\) => ReactNode> = \{/.test(tsx), "les visuels dessinés passent par COMPOSANTS");
    // Bola Studio : son éventail dans COMPOSANTS, ses ballons du mois sous le titre (PIEDS), lus dans studio-bola.tsx.
    assert.ok(/\n  studio: VisuelStudio,\n\};/.test(tsx) && /const PIEDS: Partial<Record<ComposantAvantage, \(\) => ReactNode>> = \{ studio: MentionStudio \};/.test(tsx), "« Ton studio » : l'éventail et ses ballons du mois");
    const composant = bloc("DiapoComposant");
    assert.ok(/const Pied = PIEDS\[composant\];/.test(composant) && composant.indexOf("{Pied && <Pied />}") > composant.indexOf("{avantage.sous &&"), "les ballons du mois sous le titre de « Ton studio »");
    // Une seule barre « Je suis intéressé », effacée sur « Ton prix » où le bouton est dans la carte.
    assert.ok(/createPortal\(/.test(barre) && /document\.body/.test(barre), "la barre collée est portée dans <body>");
    assert.ok(/cachee=\{actif === iPrix\}/.test(page) && /inert=\{cachee\}/.test(barre), "la barre s'efface sur « Ton prix »");
    assert.ok(/onNoter=\{\(\) => plus\.noter\(choix\)\}/.test(page), "la barre collée note par le noter de la page");
    assert.ok(/function interesser\(\) \{\s*suivre\.current = true;\s*noter\(choix\);\s*\}/.test(offre) && /onClick=\{interesser\}/.test(offre), "le bouton de l'offre note par le même noter");
    assert.ok(/aller\(iPrix\);/.test(page), "« C'est noté » mène à « Ton prix »");
    assert.equal(tsx.match(/useBolaPlus\(\)/g)?.length, 2, "un seul useBolaPlus pour la page (et celui de la tuile)");
    assert.ok(/aria-disabled=\{!note && occupe \? true : undefined\}/.test(barre) && /!occupe && onNoter\(\)/.test(barre), "la barre : bouton gelé pendant l'envoi");
    // Un seul bouton, jamais désactivé : le focus reste dessus quand « Je suis intéressé » devient « C'est noté ».
    assert.ok(!/(?<!-)\bdisabled=/.test(barre) && barre.match(/<button/g)?.length === 1, "la barre : un seul bouton, qui garde le focus");
    assert.equal(offre.match(/disabled=\{occupe\}/g)?.length, 3, "l'offre : formules, bouton et « Annuler » gelés pendant l'envoi");
    assert.ok(/if \(!interet\) onChoix\(f\);\s*else if \(interet\.formule !== f\) noter\(f\);/.test(offre), "une fois noté, toucher une formule la change");
    // Les prix de l'offre : PRIX_FORMULE, avec le barré et la ligne dessous ; rien ne les cache.
    assert.ok(/const p = PRIX_FORMULE\[f\];/.test(offre) && /<Barre somme=\{p\.barre\} \/>/.test(offre) && /\{p\.sous\}/.test(offre), "chaque formule : son prix, son barré, sa ligne");
    // Et ses ballons de Bola Studio (studio.ts), juste sous la ligne du dessous.
    assert.ok(/<span className="bp-formule__ballons tabular-nums">\{BALLONS_FORMULE\[f\]\}<\/span>/.test(offre) && offre.indexOf("{BALLONS_FORMULE[f]}") > offre.indexOf("{p.sous}"), "chaque formule porte ses ballons, sous sa ligne");
    assert.ok(/import \{ BALLONS_FORMULE \} from "@\/lib\/sfl\/studio";/.test(tsx), "les ballons des formules viennent de studio.ts");
    const CACHE = /(^|[\s:"])(hidden|sr-only|invisible|opacity-0)(?=[\s"])/;
    assert.ok(!CACHE.test(offre) && !CACHE.test(ouverture), "les prix se voient");
    // La vraie carte « Toi », sans photo ni nom de joueur.
    assert.ok(/<PlayerCard player=\{player\} /.test(carte) && /player\.name === me/.test(carte), "« Ta carte » : la carte du compte ouvert (16/11)");
    assert.ok(/<BolaCard name=\{CARTE_TOI\.name\} /.test(carte) && CARTE_TOI.name === "Toi" && !/photo=/.test(carte), "sans joueur à soi : la carte « Toi », sans photo");
    // « Tes maillots » : le portant d'abord ; le visuel déposé ne le remplace qu'une fois chargé.
    assert.ok(/const \[deposeLa, setDeposeLa\] = useState\(false\);/.test(photo) && /const depose = deposeLa \? avantage\.depose : undefined;/.test(photo), "la carte montre le portant tant que le visuel déposé n'est pas chargé");
    assert.ok(/essai\.onload = \(\) => \{\s*if \(vivant && essai\.naturalWidth > 0\) setDeposeLa\(true\);/.test(photo) && !/onerror/.test(photo), "le visuel déposé ne passe devant qu'une fois chargé");
    assert.ok(/alt=\{visuel\.alt\}/.test(photo) && /alt=\{depose\.alt\}/.test(photo) && /alt=\{AFFICHE\.alt\}/.test(ouverture), "chaque visuel a son texte de remplacement");
    assert.ok(/srcSet=\{sourcesVisuel\(/.test(photo) && /sizes=\{TAILLES\}/.test(photo) && /loading="lazy"/.test(photo), "les visuels : trois tailles, chargés quand on y arrive");
    // Les mots de l'écran : une liste fermée. Ni sous-titre, ni texte d'aide.
    const mots = [...new Set([...sansCommentaire.replace(/&apos;/g, "'").matchAll(/>\s*([^<>{}\n;()=]*[A-Za-zÀ-ÿ][^<>{}\n;()=]*?)\s*</g)].map((m) => m[1].trim()))].sort();
    assert.deepEqual(mots, ["Annuler", "Bola Plus", "C'est noté", "Je suis intéressé", "Offert", "Prix premiers joueurs", "Toi"], "les mots de l'écran : une liste fermée");
    // La feuille : aimantée, sans teinte écrite (seulement les variables de la page), le mouvement réduit traité.
    const sansNotes = css.replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(/scroll-snap-type: x mandatory;/.test(sansNotes) && /scroll-snap-align: center;/.test(sansNotes) && /scroll-snap-stop: always;/.test(sansNotes), "le rail est aimanté, carte par carte");
    assert.ok(/overscroll-behavior-x: contain;/.test(sansNotes), "le rail ne fait pas reculer la page");
    assert.ok(!/#[0-9a-f]{3,8}\b/i.test(sansNotes.replace(/#fff\b/g, "")), "pas d'autre teinte écrite que le blanc dans la feuille");
    assert.ok(!/\b(hsla?|hwb|lab|lch|oklab|oklch)\(/.test(sansNotes), "aucune teinte écrite dans la feuille");
    assert.ok(!/:\s*[^;{}]*\b(gold|red|orange|yellow|green|blue|purple|pink|brown|tomato|coral|salmon|crimson|orangered|goldenrod|navy|teal|cyan|magenta|violet|indigo|maroon|olive|lime|aqua|fuchsia|khaki|tan|beige)\b/.test(sansNotes), "aucune couleur nommée dans la feuille");
    for (const m of sansNotes.matchAll(/rgb\((\d+) (\d+) (\d+)/g)) assert.ok(Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) <= 8, `une couleur écrite dans la feuille : ${m[0]}`);
    assert.ok(!/animation:|@keyframes/.test(sansNotes), "rien ne bouge en boucle");
    const reduit = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/.exec(css)?.[1] ?? "";
    assert.ok(/\.bp-arc__rond,[\s\S]*\.bp-fleche \{\s*transition: none;/.test(reduit), "mouvement réduit : rien ne glisse ni ne fond (flèches comprises)");
    assert.ok(/\.bp-parrainage \.bp-arc__rond \{[^}]*background-color: var\(--bp-prix\);/.test(reduit), "mouvement réduit : les ronds de « Ramène 5 » sont pleins d'emblée");
    assert.ok(/html\[data-clavier\] \.bp-barre \{\s*display: none;/.test(css), "la barre s'efface sous le clavier");
    assert.ok(/@media \(pointer: fine\)/.test(css) && /\.bp-fleche \{\s*display: none;/.test(css), "les flèches : sur ordinateur seulement");
    const regle = (selecteur: string) => {
      const i = css.indexOf(`\n${selecteur} {`);
      assert.ok(i >= 0, `${selecteur} est dans la feuille`);
      return css.slice(i, css.indexOf("}", i));
    };
    assert.ok(/z-index: 30;/.test(regle(".bp-barre")) && /bottom: calc\(max\(calc\(env\(safe-area-inset-bottom\) - 4px\), 14px\) \+ 62px \+ 10px\);/.test(regle(".bp-barre")), "la barre est au-dessus des onglets");
    assert.ok(/height: 44px;/.test(regle(".bp-segments")), "les segments se touchent sur 44 px");
  };
  ecranJuste(ecran, style);

  // Les mutants : chaque garde refuse sa faute.
  const sansEffet: string[] = [];
  const refuse = (nom: string, essai: () => void) => {
    let passe = true;
    try {
      essai();
    } catch (e) {
      passe = false;
      if (process.env.MUTANTS) console.log(`${nom} ← ${(e as Error).message.split("\n")[0]}`);
    }
    assert.ok(!passe, `mutant accepté : ${nom}`);
  };
  const mute = (nom: string, source: string, de: string | RegExp, vers: string) => {
    const m = source.replace(de, vers);
    // Noté à part : un mutant sans effet ne doit pas passer pour un mutant refusé.
    if (m === source) sansEffet.push(nom);
    return m;
  };
  // La grille et le bundle.
  refuse("un barré sous son prix", () => grilleJuste(SFL_OFFICIEL, { ...BARRE, mensuel: 1500 }, MENSUEL_CENTIMES, ANNUEL_CENTIMES));
  refuse("l'année plus chère que douze mois", () => grilleJuste({ ...SFL_OFFICIEL, annee: { prix: 43000, reference: 28000 } }, BARRE, MENSUEL_CENTIMES, ANNUEL_CENTIMES));
  refuse("la saison au-dessus de 140 €", () => grilleJuste({ ...SFL_OFFICIEL, saison: { prix: 15000, reference: 14000 } }, BARRE, MENSUEL_CENTIMES, ANNUEL_CENTIMES));
  refuse("l'annuel qui barre 280 € sans le dire", () => grilleJuste(SFL_OFFICIEL, { ...BARRE, annuel: 28000 }, MENSUEL_CENTIMES, ANNUEL_CENTIMES));
  refuse("le bundle sans la SFL", () => bundleJuste(BUNDLE.filter((b) => b !== "sfl")));
  // Les avantages.
  refuse("un titre changé", () => avantagesJustes(AVANTAGES.map((a) => (a.id === "maillots" ? { ...a, titre: "Ton kit complet" } : a))));
  refuse("deux avantages de plus", () => avantagesJustes([...AVANTAGES, { ...AVANTAGES[0], id: "x" }, { ...AVANTAGES[0], id: "y" }]));
  refuse("un identifiant en double", () => avantagesJustes([...AVANTAGES, AVANTAGES[1]]));
  refuse("un avantage sans part connue", () => avantagesJustes(AVANTAGES.map((a, i) => (i === 0 ? ({ ...a, part: "club" } as unknown as Avantage) : a))));
  const iSfl = AVANTAGES.findIndex((a) => a.part === "sfl");
  refuse("une part SFL avant Bola Plus", () => avantagesJustes([AVANTAGES[iSfl], ...AVANTAGES.filter((_, i) => i !== iSfl)]));
  refuse("une promesse chiffrée", () => avantagesJustes(AVANTAGES.map((a) => (a.id === "cadeaux" ? { ...a, titre: "3 cadeaux par saison" } : a))));
  // La même promesse dans la ligne du dessous, que le titre exact ne garde pas : seul le garde « ni chiffre » la refuse.
  refuse("une promesse chiffrée sous le titre", () => avantagesJustes(AVANTAGES.map((a) => (a.id === "cadeaux" ? { ...a, sous: "3 cadeaux par saison" } : a))));
  refuse("une description ajoutée", () => avantagesJustes(AVANTAGES.map((a) => ({ ...a, description: "Chaque saison." }) as Avantage)));
  refuse("un visuel généré qui ne le dit pas", () => avantagesJustes(AVANTAGES.map((a) => (a.id === "cadeaux" && a.visuel.genre === "image" ? { ...a, visuel: { ...a.visuel, alt: "Des crampons verts" } } : a))));
  refuse("un joueur nommé dans le visuel déposé", () => avantagesJustes(AVANTAGES.map((a) => (a.depose ? { ...a, depose: { ...a.depose, alt: "Image générée : Inès, Léo et Nolan portent les maillots" } } : a))));
  refuse("un second fichier déposé", () => avantagesJustes(AVANTAGES.map((a) => (a.id === "matchs-filmes" ? { ...a, depose: { fichier: "/bola-plus/camera-portee.webp", alt: "Image générée : une caméra" } } : a))));
  refuse("une image retirée", () => visuelsLa([...IMAGES, "absente"]));
  // La palette.
  refuse("l'or des MVP", () => paletteJuste({ ...PALETTE, prix: "#D4A537" }));
  refuse("le rouge d'Impact", () => paletteJuste({ ...PALETTE, plus: { ...PALETTE.plus, vif: "#E11D48" } }));
  refuse("le cobalt de la Défensive", () => paletteJuste({ ...PALETTE, plus: { ...PALETTE.plus, vif: "#2563EB" } }));
  refuse("la braise", () => paletteJuste({ ...PALETTE, prix: "#FF8A4C" }));
  refuse("un vert illisible sur blanc", () => paletteJuste({ ...PALETTE, sfl: { ...PALETTE.sfl, encre: "#34D399" } }));
  // L'écran.
  refuse("un prix en dur", () => ecranJuste(mute("prix", ecran, "{p.euros}&nbsp;€\n          </span>\n          <span className=\"bp-ouverture__par\">", "19,90&nbsp;€\n          </span>\n          <span className=\"bp-ouverture__par\">"), style));
  refuse("une teinte dans l'écran", () => ecranJuste(mute("teinte", ecran, '"--bp-prix": PALETTE.prix,', '"--bp-prix": "#D9FF3F",'), style));
  refuse("une couleur dans la feuille", () => ecranJuste(ecran, mute("couleur", style, "background: var(--bp-prix);\n  color: var(--bp-nuit);", "background: #d9ff3f;\n  color: var(--bp-nuit);")));
  refuse("une couleur nommée", () => ecranJuste(ecran, mute("nommée", style, "color: var(--bp-prix);\n}", "color: lime;\n}")));
  refuse("une classe de couleur", () => ecranJuste(mute("classe", ecran, 'className="bp-offert__mot"', 'className="bp-offert__mot text-lime-300"'), style));
  refuse("la tuile en couleurs", () => ecranJuste(mute("tuile", ecran, '"tuile tuile--plus col-span-2', '"tuile tuile--plus bp-part--plus col-span-2'), style));
  refuse("le rail sans aimant", () => ecranJuste(ecran, mute("aimant", style, "scroll-snap-type: x mandatory;", "")));
  refuse("une carte sautée d'un geste", () => ecranJuste(ecran, mute("stop", style, "scroll-snap-stop: always;", "scroll-snap-stop: normal;")));
  refuse("la barre jamais effacée", () => ecranJuste(mute("inert", ecran, " inert={cachee}", ""), style));
  refuse("la barre effacée ailleurs", () => ecranJuste(mute("cachee", ecran, "cachee={actif === iPrix}", "cachee={actif === 0}"), style));
  refuse("la barre branchée ailleurs", () => ecranJuste(mute("barre", ecran, "onNoter={() => plus.noter(choix)}", "onNoter={() => aller(iPrix)}"), style));
  refuse("les flèches des formules qui font tourner le carrousel", () => ecranJuste(mute("stop", ecran, "    e.stopPropagation();\n", ""), style));
  refuse("le saut toujours animé", () => ecranJuste(mute("saut", ecran, 'behavior: doux ? "smooth" : "auto"', 'behavior: "smooth"'), style));
  refuse("le mouvement réduit oublié", () => ecranJuste(ecran, mute("reduit", style, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*$/, "")));
  refuse("les segments muets", () => ecranJuste(mute("segments", ecran, 'aria-current={i === actif ? "true" : undefined}', ""), style));
  refuse("un texte d'aide", () => ecranJuste(mute("aide", ecran, "      <div className=\"bp-pied\" aria-hidden />", "      <p>Glisse pour voir la suite.</p>\n      <div className=\"bp-pied\" aria-hidden />"), style));
  refuse("une fausse carte à la place de la vraie", () => ecranJuste(mute("carte", ecran, '<BolaCard name={CARTE_TOI.name} ', '<BolaCard name={CARTE_TOI.name} photo="/bola/joueur.jpg" '), style));
  refuse("le barré retiré", () => ecranJuste(mute("barré", ecran, "                  <Barre somme={p.barre} />\n", ""), style));
  refuse("les 4 fois en dur", () => ecranJuste(mute("4 fois", ecran, "{p.sous}</span>", "4 × 42,23 € sans frais</span>"), style));
  refuse("les prix cachés sur petit écran", () => ecranJuste(mute("caché", ecran, 'className="bp-formule__sous tabular-nums"', 'className="bp-formule__sous tabular-nums max-[359px]:hidden"'), style));
  refuse("le visuel déposé avant d'être chargé", () => ecranJuste(mute("d'emblée", ecran, "useState(false);\n  const depose = deposeLa", "useState(true);\n  const depose = deposeLa"), style));
  refuse("les ballons des formules retirés", () => ecranJuste(mute("ballons retirés", ecran, '                <span className="bp-formule__ballons tabular-nums">{BALLONS_FORMULE[f]}</span>\n', ""), style));
  refuse("les ballons des formules cachés", () => ecranJuste(mute("ballons cachés", ecran, 'className="bp-formule__ballons tabular-nums"', 'className="bp-formule__ballons tabular-nums hidden"'), style));
  refuse("les ballons des formules au-dessus des 4 fois", () => ecranJuste(mute("ballons avant", ecran, '                <span className="bp-formule__sous tabular-nums">{p.sous}</span>\n                <span className="bp-formule__ballons tabular-nums">{BALLONS_FORMULE[f]}</span>', '                <span className="bp-formule__ballons tabular-nums">{BALLONS_FORMULE[f]}</span>\n                <span className="bp-formule__sous tabular-nums">{p.sous}</span>'), style));
  refuse("« Ton studio » sans ses ballons du mois", () => ecranJuste(mute("pied", ecran, "          {Pied && <Pied />}\n", ""), style));
  refuse("« Ton studio » dessiné par un autre visuel", () => ecranJuste(mute("visuel studio", ecran, "  studio: VisuelStudio,\n", "  studio: VisuelCarte,\n"), style));
  refuse("« Ton studio » retiré du carrousel", () => avantagesJustes(AVANTAGES.filter((a) => a.id !== "studio")));
  refuse("« Ton studio » après la part SFL", () => avantagesJustes([...AVANTAGES.filter((a) => a.id !== "studio"), AVANTAGES.find((a) => a.id === "studio")!]));
  refuse("« Ton studio » en image", () => avantagesJustes(AVANTAGES.map((a) => (a.id === "studio" ? { ...a, visuel: { genre: "image", image: "affiche", alt: "Le stade", teinte: "#2a2440", rapport: 1.25 } } : a))));
  refuse("le visuel déposé même en erreur", () => ecranJuste(mute("erreur", ecran, "    essai.src = fichier;", "    essai.onerror = () => setDeposeLa(true);\n    essai.src = fichier;"), style));
  refuse("Klarna nommé", () => sansPaiement("bola-plus.tsx", mute("klarna", ecran, "Je suis intéressé\n          </button>\n        )}\n      </div>\n    </div>", "Je suis intéressé avec Klarna\n          </button>\n        )}\n      </div>\n    </div>")));
  refuse("un montant en dur dans la tuile", () => uneSource("tuile", ecran.replace('whitespace-nowrap">Bola Plus</span>', 'whitespace-nowrap">Bola Plus · 19,90 €</span>')));
  refuse("un ancien prix dans l'admin", () => aucunMontant("admin", "<span>20 € par mois</span>"));
  // Les mutants des prix (13/11).
  refuse("l'échéance par toFixed", () => echeanceJuste((c, n) => (c / 100 / n).toFixed(2).replace(".", ",")));
  refuse("l'échéance arrondie vers le bas", () => echeanceJuste((c, n) => montant(Math.floor(c / n))));
  refuse("la remise arrondie vers le haut", () => remiseJuste((m, a) => Math.ceil(((12 * m - a) * 100) / (12 * m))));
  refuse("un prix écrit deux fois", () => sourceJuste(mute("deux fois", offreSource, "export const MENSUEL = montant(MENSUEL_CENTIMES);", "export const MENSUEL = montant(1990);")));
  refuse("les 4 fois sur le prix du mois", () => sourceJuste(mute("4 fois mois", offreSource, "montant(echeance(ANNUEL_CENTIMES, ECHEANCES))", "montant(echeance(12 * MENSUEL_CENTIMES, ECHEANCES))")));
  refuse("un visuel déposé trop petit", () => {
    // Un faux dossier public où le visuel déposé n'a que 780 px de large.
    const faux = mkdtempSync(join(tmpdir(), "bola-plus-"));
    try {
      mkdirSync(join(faux, "bola-plus"));
      copyFileSync(join(PUBLIC, fichierVisuel("maillots", 780)), join(faux, DEPOSE));
      deposeJuste(faux);
    } finally {
      rmSync(faux, { recursive: true, force: true });
    }
  });

  assert.deepEqual(sansEffet, [], "des mutants sans effet");

  console.log("bola-plus : ok");
}

banc().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
