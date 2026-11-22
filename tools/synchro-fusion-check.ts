// La synchro de l'admin sur une fausse base (saisie/sync.ts, 22/11/2026) :
// un seul envoi en vol, et au conflit la fusion avec ce que l'autre appareil
// a publié, au lieu de l'appareil figé. Le vrai supabase-js, un faux fetch,
// un faux stockage ; sans réseau.
//   npx tsx tools/synchro-fusion-check.ts
import assert from "node:assert/strict";

// Un navigateur de poche, avant de charger l'app.
const stock = new Map<string, string>();
const localStorage = {
  getItem: (k: string) => stock.get(k) ?? null,
  setItem: (k: string, v: string) => void stock.set(k, String(v)),
  removeItem: (k: string) => void stock.delete(k),
};
const cible = new EventTarget();
Object.assign(globalThis, {
  localStorage,
  window: { localStorage, addEventListener: cible.addEventListener.bind(cible), removeEventListener: cible.removeEventListener.bind(cible), dispatchEvent: cible.dispatchEvent.bind(cible) },
});

// La fausse base : un document, sa version ; publier_saison refuse une base périmée.
const base = { data: null as unknown, version: 0, seed: 0 };
let publications = 0;
let delai = 0;
globalThis.fetch = (async (entree: RequestInfo | URL, init?: RequestInit) => {
  const url = String(entree instanceof Request ? entree.url : entree);
  const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { "content-type": "application/json" } });
  if (url.includes("/rpc/publier_saison")) {
    const p = JSON.parse(String(init?.body ?? (entree instanceof Request ? await entree.text() : "{}")));
    publications++;
    if (delai) await new Promise((r) => setTimeout(r, delai));
    if (!p.p_forcer && p.p_base !== base.version) return json({ ok: false, version: base.version });
    base.data = p.p_data;
    base.version = Math.max(base.version + 1, 1);
    base.seed = p.p_seed;
    return json({ ok: true, version: base.version });
  }
  if (url.includes("/rest/v1/saison")) return json({ data: base.data, version: base.version, seed: base.seed });
  if (url.includes("/auth/")) return json({}, 400);
  return json({}, 404);
}) as typeof fetch;

async function main() {
  const { saisieStore, localStorageStore, CURRENT_SEED_VERSION } = await import("../src/lib/sfl/saisie/store");
  const sync = await import("../src/lib/sfl/saisie/sync");
  const { newEntry, updateEntryAt } = await import("../src/lib/sfl/saisie/mutations");
  type Saison = ReturnType<typeof localStorageStore.load>;

  localStorage.setItem("sfl-session", JSON.stringify({ user: "ilyes", name: "Ilyes", admin: true, since: 1, server: true }));
  const depart: Saison = {
    numero: 1,
    roster: ["Ilyes", "Théo", "Kamil", "Yacine"].map((name) => ({ name, poste: null, profil: "Actif", base: null })),
    convocations: [],
    journees: [{ j: 7, date: "22 nov.", sflTime: false, matchsDuJour: [{ equipes: ["Noirs 1", "Blancs 1"] }, { equipes: ["Noirs 2", "Blancs 2"] }] }],
    entries: [newEntry(7, "Ilyes", "Noirs 1"), newEntry(7, "Théo", "Blancs 1"), newEntry(7, "Kamil", "Noirs 2"), newEntry(7, "Yacine", "Blancs 2")],
  };
  base.data = depart;
  base.version = 10;
  base.seed = CURRENT_SEED_VERSION;
  const ligne = (s: Saison, p: string) => s.entries.find((e) => e.player === p)!;
  const plus = (s: Saison, p: string, x: Parameters<typeof updateEntryAt>[2]) => updateEntryAt(s, s.entries.findIndex((e) => e.player === p), x);
  const pousser = (s: Saison) => sync.pushSaison(s);

  // 0 · L'appareil lit la base.
  assert.equal(await sync.pullSaison(), true);
  assert.equal(localStorage.getItem("sfl-saison-remote-version"), "10");

  // 1 · Dix + d'affilée pendant qu'un envoi est en vol : deux publications, pas dix.
  delai = 30;
  publications = 0;
  let s = localStorageStore.load();
  const envois: Promise<boolean>[] = [];
  for (let i = 1; i <= 10; i++) {
    s = plus(s, "Ilyes", { buts: i });
    localStorageStore.save(s);
    envois.push(pousser(s));
  }
  assert.deepEqual(await Promise.all(envois), Array(10).fill(true));
  assert.equal(publications, 2);
  assert.equal(ligne(base.data as Saison, "Ilyes").buts, 10);
  assert.equal(sync.publicationEnAttente(), false);
  delai = 0;

  // 2 · Un autre appareil publie le match 2 ; celui-ci saisit le match 1 sans
  // avoir relu. Avant : conflit, appareil figé. Maintenant : les deux restent.
  base.data = plus(plus(base.data as Saison, "Kamil", { buts: 3, result: "Victoire" }), "Yacine", { passes: 1, result: "Défaite" });
  base.version++;
  s = plus(localStorageStore.load(), "Théo", { buts: 2 });
  localStorageStore.save(s);
  publications = 0;
  assert.equal(await pousser(s), true);
  assert.equal(publications, 2, "le conflit, puis la fusion publiée");
  for (const doc of [base.data as Saison, localStorageStore.load()]) {
    assert.deepEqual([ligne(doc, "Ilyes").buts, ligne(doc, "Théo").buts], [10, 2]);
    assert.deepEqual([ligne(doc, "Kamil").buts, ligne(doc, "Kamil").result, ligne(doc, "Yacine").passes], [3, "Victoire", 1]);
  }
  assert.equal(sync.publicationEnAttente(), false);
  assert.equal(localStorage.getItem("sfl-saison-remote-version"), String(base.version));

  // 3 · Pendant qu'un envoi est en vol, la base n'est pas adoptée (elle
  // effacerait le geste) ; elle l'est une fois l'envoi fini.
  delai = 40;
  s = plus(localStorageStore.load(), "Théo", { buts: 3 });
  localStorageStore.save(s);
  const envoi = pousser(s);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(await sync.pullSaison(), false);
  assert.equal(ligne(localStorageStore.load(), "Théo").buts, 3);
  assert.equal(await envoi, true);
  delai = 0;

  // 4 · Sans point de départ (un appareil d'avant ce correctif) : le conflit reste un conflit.
  localStorage.removeItem("sfl-saisie-base");
  base.version++;
  s = plus(localStorageStore.load(), "Théo", { buts: 4 });
  localStorageStore.save(s);
  assert.equal(await pousser(s), false);
  assert.equal(sync.dernierEnvoiAuto()?.conflit, true);
  assert.equal(sync.publicationEnAttente(), true);
  assert.equal(ligne(localStorageStore.load(), "Théo").buts, 4, "la saisie reste sur l'appareil");

  // 5 · « Reprendre la base » garde une copie de ce qu'elle remplace.
  assert.deepEqual(await sync.reprendreDeLaBase(), { ok: true });
  const copie = JSON.parse(localStorage.getItem(sync.COPIE_KEY)!) as { le: string; saison: Saison };
  assert.equal(ligne(copie.saison, "Théo").buts, 4);
  assert.equal(ligne(localStorageStore.load(), "Théo").buts, 3);
  assert.equal(sync.publicationEnAttente(), false);

  // 6 · Par saisieStore.save (le chemin de l'app), après la reprise : tout repart.
  assert.deepEqual(saisieStore.save(plus(localStorageStore.load(), "Théo", { buts: 5 })), []);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(ligne(base.data as Saison, "Théo").buts, 5);

  console.log("synchro-fusion-check : ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
