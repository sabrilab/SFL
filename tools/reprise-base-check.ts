// La reprise après une erreur passagère de la base (lib/server/reprise-base.ts,
// 08/11/2026), et son emploi par le calcul de nuit de la carte d'entraîneur
// (lib/sfl/entraineur-serveur.server.ts) : les nuits du 06 et du 07/11, une
// lecture sur douze a été refusée par PostgREST en 401 « JWT issued at
// future » (PGRST303), avant d'être exécutée.
//   · l'utilitaire seul : erreur passagère puis succès (une reprise comptée),
//     passagère à chaque essai (erreur après ESSAIS appels), non passagère
//     (aucune reprise), panne de passerelle reprise seulement si rejouable,
//     attente bornée par appel et pour tout le suivi ;
//   · le vrai supabase-js sur un faux fetch, pour la vraie forme des erreurs :
//     le 401 PGRST303 d'une lecture et d'un rpc, un 504 et une panne réseau
//     sur un rpc, un 42501 (droits) jamais repris ;
//   · le calcul entier sur ce faux fetch : la nuit du 07/11 rejouée (profiles
//     refusé une fois) finit « ok » avec une reprise ; refusée trois fois, il
//     finit en erreur avec deux reprises ; une erreur de droits, aucune.
// Sans réseau, sans attente réelle (attendre ne fait qu'avancer l'horloge).
//   npx tsx tools/reprise-base-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { ATTENTES_MS, ESSAIS, LIMITE_MS, avecReprise, erreurPassagere, nouveauSuivi, ouLever } from "../src/lib/server/reprise-base";
import { calculerCartesEntraineur } from "../src/lib/sfl/entraineur-serveur.server";

/** Un suivi à horloge fausse : attendre avance l'horloge et note l'attente. */
function suiviFaux(limiteMs = LIMITE_MS) {
  let t = 1_000_000;
  const attentes: number[] = [];
  const suivi = nouveauSuivi({
    limiteMs,
    maintenant: () => t,
    attendre: async (ms) => {
      attentes.push(ms);
      t += ms;
    },
  });
  return { suivi, attentes, avancer: (ms: number) => (t += ms) };
}

const JWT_FUTUR = { code: "PGRST303", message: "JWT issued at future", details: null, hint: null };
/** Au-delà, une reprise sans fin : le banc s'arrête au lieu de tourner. */
const GARDE = 50;

/** Un appel qui lève `erreurs` dans l'ordre, puis rend "ok". */
function appel(erreurs: unknown[]) {
  let n = 0;
  return {
    fn: async () => {
      n++;
      if (n > GARDE) throw new Error("GARDE : reprise sans fin");
      if (n <= erreurs.length) throw erreurs[n - 1];
      return "ok";
    },
    appels: () => n,
  };
}

let verifs = 0;
const ok = (c: boolean, m: string) => {
  assert.ok(c, m);
  verifs++;
};

async function main() {
// ── 1. L'utilitaire seul ───────────────────────────────────────────────────
{
  ok(ESSAIS === 3 && ATTENTES_MS.length === ESSAIS - 1, "3 essais, 2 attentes");
  ok(ATTENTES_MS[0] >= 500 && ATTENTES_MS[1] > ATTENTES_MS[0] && ATTENTES_MS[1] <= 5000, "attentes croissantes de l'ordre de 1 à 5 s");
  ok(ATTENTES_MS.reduce((a, b) => a + b, 0) <= 10_000, "attente d'un appel ≤ 10 s");
  ok(LIMITE_MS <= 30_000, "le suivi laisse au calcul la moitié de maxDuration = 60");

  ok(erreurPassagere(JWT_FUTUR, false), "JWT issued at future : passagère même non rejouable");
  ok(!erreurPassagere({ code: "PGRST303", message: "JWT expired" }, true), "un autre PGRST303 (jeton expiré) n'est pas repris");
  ok(!erreurPassagere({ code: "42501", message: "permission denied", status: 403 }, true), "droits : jamais");
  ok(!erreurPassagere({ code: "23505", message: "duplicate key", status: 409 }, true), "données : jamais");
  ok(!erreurPassagere({ code: "P0001", message: "Demande invalide.", status: 400 }, true), "refus de la fonction : jamais");
  ok(!erreurPassagere({ message: "erreur", status: 500 }, true), "500 : jamais");
  ok(!erreurPassagere(new TypeError("x is not a function"), true), "erreur du code : jamais");
  ok(!erreurPassagere(null, true) && !erreurPassagere("JWT issued at future", true), "pas un objet : jamais");
  for (const s of [0, 502, 503, 504]) {
    ok(erreurPassagere({ message: "passerelle", status: s }, true), `${s} rejouable : passagère`);
    ok(!erreurPassagere({ message: "passerelle", status: s }, false), `${s} non rejouable : jamais (l'appel a pu s'exécuter)`);
  }
}

{
  // Passagère puis succès : une reprise, attendue 1 s.
  const { suivi, attentes } = suiviFaux();
  const a = appel([JWT_FUTUR]);
  ok((await avecReprise(suivi, a.fn, true)) === "ok", "passagère puis succès : ok");
  ok(a.appels() === 2 && suivi.reprises === 1, "une reprise comptée");
  ok(attentes.length === 1 && attentes[0] === ATTENTES_MS[0], "après la première attente");
}
{
  // Passagère à chaque essai : erreur après ESSAIS appels, la dernière erreur levée.
  const { suivi, attentes } = suiviFaux();
  const a = appel(Array.from({ length: GARDE + 1 }, () => JWT_FUTUR));
  const e = await avecReprise(suivi, a.fn, true).then(
    () => null,
    (x: unknown) => x
  );
  ok(e === JWT_FUTUR, "la dernière erreur est levée telle quelle");
  ok(a.appels() === ESSAIS, `${ESSAIS} appels au plus (${a.appels()})`);
  ok(suivi.reprises === ESSAIS - 1, "deux reprises comptées");
  ok(attentes.reduce((x, y) => x + y, 0) === ATTENTES_MS.reduce((x, y) => x + y, 0), "attentes 1 s puis 3 s");
}
{
  // Non passagère : aucune reprise, aucune attente.
  const droits = { code: "42501", message: "permission denied for table profiles", status: 403 };
  for (const err of [droits, { message: "erreur", status: 500 }, new TypeError("bogue")]) {
    const { suivi, attentes } = suiviFaux();
    const a = appel([err]);
    const e = await avecReprise(suivi, a.fn, true).then(
      () => null,
      (x: unknown) => x
    );
    ok(e === err && a.appels() === 1 && suivi.reprises === 0 && attentes.length === 0, `non passagère : un seul appel (${JSON.stringify(err)})`);
  }
  // 504 sur un appel non rejouable : pas repris non plus.
  const { suivi } = suiviFaux();
  const a = appel([{ message: "Gateway Timeout", status: 504 }]);
  await avecReprise(suivi, a.fn, false).catch(() => null);
  ok(a.appels() === 1 && suivi.reprises === 0, "504 non rejouable : un seul appel");
  const b = appel([{ message: "Gateway Timeout", status: 504 }, { message: "", status: 0 }]);
  ok((await avecReprise(suivi, b.fn, true)) === "ok" && b.appels() === 3, "504 puis panne réseau, rejouable : repris");
}
{
  // Le suivi borne l'attente de tout le calcul : une reprise ne commence pas si elle finit après limiteMs.
  const { suivi, attentes, avancer } = suiviFaux(20_000);
  avancer(18_500);
  const a = appel([JWT_FUTUR, JWT_FUTUR]);
  const e = await avecReprise(suivi, a.fn, true).then(
    () => null,
    (x: unknown) => x
  );
  ok(e === JWT_FUTUR && a.appels() === 2 && attentes.length === 1, "à 18,5 s : 1 s d'attente encore, pas 3 s");
  // Cent appels qui échouent l'un après l'autre : jamais d'attente au-delà de la limite.
  const f = suiviFaux(20_000);
  for (let i = 0; i < 100; i++) await avecReprise(f.suivi, appel(Array.from({ length: 5 }, () => JWT_FUTUR)).fn, true).catch(() => null);
  const total = f.attentes.reduce((x, y) => x + y, 0);
  ok(total <= 20_000, `attente totale ${total} ms ≤ 20 s`);
  ok(total + 30_000 < 60_000, "et la route garde ≥ 30 s pour ses requêtes (maxDuration = 60)");
}

// ── 2. Le vrai supabase-js sur un faux fetch ───────────────────────────────
type Rendu = { status: number; corps: unknown } | "panne";
/** Un faux fetch : `reglage(chemin, n)` dit ce que rend le n-ième appel (1, 2, …) de ce chemin. */
function fauxFetch(reglage: (chemin: string, n: number) => Rendu | undefined) {
  const appels = new Map<string, number>();
  const fetch = async (url: string | URL | Request) => {
    const chemin = new URL(typeof url === "string" ? url : url instanceof URL ? url.href : url.url).pathname;
    const n = (appels.get(chemin) ?? 0) + 1;
    appels.set(chemin, n);
    if (n > GARDE) throw new Error("GARDE : reprise sans fin");
    const r = reglage(chemin, n) ?? { status: 200, corps: chemin.startsWith("/rest/v1/rpc/") ? 0 : [] };
    if (r === "panne") throw new TypeError("fetch failed");
    return new Response(JSON.stringify(r.corps), { status: r.status, headers: { "content-type": "application/json" } });
  };
  return { fetch: fetch as typeof globalThis.fetch, appels };
}
const client = (f: typeof globalThis.fetch) =>
  createClient("http://base.invalid", "cle-de-banc", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: f } });
const refusJwt: Rendu = { status: 401, corps: JWT_FUTUR };

{
  // Une lecture (GET) refusée une fois : reprise, comme toutesLesLignes la lève.
  const { fetch, appels } = fauxFetch((c, n) => (c === "/rest/v1/profiles" && n === 1 ? refusJwt : undefined));
  const sb = client(fetch);
  const { suivi } = suiviFaux();
  const lignes = await avecReprise(
    suivi,
    async () => {
      const { data, error } = await sb.from("profiles").select("id");
      if (error) throw error;
      return data;
    },
    true
  );
  ok(Array.isArray(lignes) && appels.get("/rest/v1/profiles") === 2 && suivi.reprises === 1, "GET 401 PGRST303 : repris une fois");
}
{
  // Un rpc (POST) : PGRST303, 504, panne réseau repris ; 42501 jamais.
  const cas: [string, Rendu[], number, boolean][] = [
    ["PGRST303", [refusJwt], 2, true],
    ["504", [{ status: 504, corps: { message: "Gateway Timeout" } }], 2, true],
    ["panne réseau", ["panne"], 2, true],
    ["503 trois fois", [{ status: 503, corps: {} }, { status: 503, corps: {} }, { status: 503, corps: {} }], 3, false],
    ["42501", [{ status: 403, corps: { code: "42501", message: "permission denied for function poser_cartes_entraineur" } }], 1, false],
    ["P0001", [{ status: 400, corps: { code: "P0001", message: "Demande invalide." } }], 1, false],
  ];
  for (const [nom, rendus, attendus, reussi] of cas) {
    const { fetch, appels } = fauxFetch((c, n) => (c === "/rest/v1/rpc/poser_cartes_entraineur" ? rendus[n - 1] : undefined));
    const sb = client(fetch);
    const { suivi } = suiviFaux();
    const r = await avecReprise(suivi, () => ouLever(sb.rpc("poser_cartes_entraineur", { p_lignes: [] })), true).then(
      () => true,
      () => false
    );
    ok(appels.get("/rest/v1/rpc/poser_cartes_entraineur") === attendus && r === reussi, `rpc ${nom} : ${attendus} appel(s), ${reussi ? "ok" : "erreur"}`);
    ok(suivi.reprises === attendus - 1, `rpc ${nom} : ${attendus - 1} reprise(s) comptée(s)`);
  }
}

// ── 3. Le calcul entier ────────────────────────────────────────────────────
// Aucun entraîneur, aucune feuille (la base du 08/11) : les douze lectures, et rien d'autre.
const LECTURES = [
  "equipe_entraineurs", "equipes", "equipe_membres", "equipe_signatures", "equipe_departs", "equipe_defis",
  "equipe_resultats", "equipe_feuilles", "equipe_feuille_joueurs", "profiles", "entraineur_cartes", "entraineur_normes",
];
{
  // La nuit du 07/11 : profiles refusé une fois.
  const { fetch, appels } = fauxFetch((c, n) => (c === "/rest/v1/profiles" && n === 1 ? refusJwt : undefined));
  const { suivi } = suiviFaux();
  const bilan = await calculerCartesEntraineur(client(fetch), new Date("2026-11-07T04:30:41Z"), suivi);
  ok(bilan.statut === "ok" && bilan.reprises === 1 && bilan.erreur === undefined, `07/11 rejoué : ok après une reprise (${JSON.stringify(bilan)})`);
  ok(LECTURES.every((t) => appels.get(`/rest/v1/${t}`) === (t === "profiles" ? 2 : 1)), "seule la lecture refusée est relancée");
  ok(![...appels.keys()].some((c) => c.startsWith("/rest/v1/rpc/")), "sans entraîneur, aucune écriture");
}
{
  // La nuit du 06/11 : equipe_defis, refusé à chaque essai.
  const { fetch, appels } = fauxFetch((c) => (c === "/rest/v1/equipe_defis" ? refusJwt : undefined));
  const { suivi } = suiviFaux();
  const bilan = await calculerCartesEntraineur(client(fetch), new Date("2026-11-06T04:30:41Z"), suivi);
  ok(bilan.statut === "erreur" && bilan.erreur === "JWT issued at future", "refusé à chaque essai : erreur, le message de la base");
  ok(bilan.reprises === ESSAIS - 1 && appels.get("/rest/v1/equipe_defis") === ESSAIS, "après ESSAIS appels et deux reprises");
}
{
  // Une erreur de droits : aucune reprise.
  const { fetch, appels } = fauxFetch((c) =>
    c === "/rest/v1/equipes" ? { status: 403, corps: { code: "42501", message: "permission denied for table equipes" } } : undefined
  );
  const { suivi } = suiviFaux();
  const bilan = await calculerCartesEntraineur(client(fetch), new Date("2026-11-08T04:30:41Z"), suivi);
  ok(bilan.statut === "erreur" && bilan.reprises === 0 && appels.get("/rest/v1/equipes") === 1, "erreur de droits : un seul appel, aucune reprise");
}
{
  // Une nuit sans erreur : rien ne change, zéro reprise.
  const { fetch } = fauxFetch(() => undefined);
  const bilan = await calculerCartesEntraineur(client(fetch), new Date("2026-11-08T04:30:41Z"), suiviFaux().suivi);
  ok(bilan.statut === "ok" && bilan.reprises === 0 && bilan.entraineurs === 0 && bilan.ecrites === 0, "nuit sans erreur : ok, 0 reprise");
}

// ── 4. Chaque appel à la base du calcul passe par la reprise ──────────────
// (les écritures n'ont lieu qu'avec des entraîneurs : la base vide ne les atteint pas)
{
  const src = readFileSync(new URL("../src/lib/sfl/entraineur-serveur.server.ts", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");
  const appels = [...src.matchAll(/sb\.rpc\(|toutesLesLignes<|lireSaisonServeur\(sb|sb\.from\(/g)];
  ok(appels.length === 5, `5 appels à la base dans le calcul (${appels.length}) : lire, la saison, trois rpc`);
  for (const m of appels) {
    const avant = src.slice(Math.max(0, m.index - 120), m.index);
    ok(/reprendre\(\(\) =>\s*(ouLever\(\s*)?$/.test(avant), `${m[0]} : dans reprendre(() => …)${m[0].startsWith("sb.rpc") ? " et ouLever" : ""}`);
    if (m[0].startsWith("sb.rpc")) ok(/ouLever\(\s*$/.test(avant), `${m[0]} : son erreur levée avec le statut (ouLever)`);
  }
  ok(/avecReprise\(suivi, appel, true\)/.test(src), "toutes rejouables (en-tête : lectures, figer « do nothing », poser « greatest »)");
}

console.log(`reprise-base: ok (${verifs} vérifications)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
