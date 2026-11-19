#!/usr/bin/env node
// Bola 27 (bola-app#33) : vérifie le jeu seul dans un vrai navigateur (Chromium de Playwright, déjà dans le dépôt),
// en local (servir.mjs) ou en ligne (bola27.vercel.app), et en prend les captures.
//
// Pour chaque format, téléphone en portrait (390 × 844) puis en paysage (844 × 390) : la page s'ouvre sur l'écran du
// jeu, « Jouer » devient actif quand tout est chargé, un appui lance le match, et le chrono doit tourner. Pendant ce
// temps, TOUTES les requêtes du navigateur sont relevées : une seule qui sort de l'adresse servie (Supabase, une API de
// l'app, Google…), un fichier manquant ou une erreur de la page, et la vérification échoue (code 1). Le relevé est
// écrit à côté des captures (reseau-<format>.json).
//
//   node tools/bola27/verifier.mjs [--url http://127.0.0.1:3957] [--captures <dossier>]
//   (sans GPU, le rendu est logiciel, lent : compter quelques minutes par format)
import { chromium } from "playwright";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const option = (nom, defaut) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : defaut;
};
const URL_JEU = option("--url", "http://127.0.0.1:3957").replace(/\/$/, "");
const CAPTURES = resolve(process.cwd(), option("--captures", join(RACINE, "out", "bola27-essai")));
const ORIGINE = new URL(URL_JEU).origin;
const LONG = 15 * 60 * 1000;

const FORMATS = [
  { nom: "portrait", fichier: "01-bola27-portrait.png", largeur: 390, hauteur: 844, ouverture: "03-bola27-ouverture.png" },
  { nom: "paysage", fichier: "02-bola27-paysage.png", largeur: 844, hauteur: 390 },
];

// Le navigateur : celui que Playwright attend ; s'il manque (révision différente déjà installée), un Chromium déjà
// présent dans PLAYWRIGHT_BROWSERS_PATH, ou celui de --chromium. Rien n'est téléchargé.
async function lancer() {
  const reglages = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };
  const donne = option("--chromium", process.env.BOLA27_CHROMIUM);
  if (donne) return chromium.launch({ ...reglages, executablePath: donne });
  try {
    return await chromium.launch(reglages);
  } catch (e) {
    const dossier = process.env.PLAYWRIGHT_BROWSERS_PATH;
    const present = dossier && existsSync(dossier)
      ? readdirSync(dossier)
          .filter((n) => /^chromium_headless_shell-\d+$/.test(n))
          .sort()
          .reverse()
          .map((n) => join(dossier, n, "chrome-headless-shell-linux64", "chrome-headless-shell"))
          .find((f) => existsSync(f))
      : undefined;
    if (!present) throw e;
    console.log(`(navigateur attendu absent : ${present})`);
    return chromium.launch({ ...reglages, executablePath: present });
  }
}

mkdirSync(CAPTURES, { recursive: true });
const navigateur = await lancer();
let echecs = 0;

for (const F of FORMATS) {
  const t0 = Date.now();
  const s = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;
  const ctx = await navigateur.newContext({ viewport: { width: F.largeur, height: F.hauteur }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR" });
  const requetes = [];
  const fautes = [];
  ctx.on("request", (r) => requetes.push({ url: r.url(), methode: r.method(), type: r.resourceType(), statut: null }));
  ctx.on("requestfinished", async (r) => {
    const e = requetes.find((q) => q.url === r.url() && q.statut === null);
    if (e) e.statut = (await r.response())?.status() ?? null;
  });
  ctx.on("requestfailed", (r) => fautes.push(`requête échouée : ${r.url()} (${r.failure()?.errorText})`));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => fautes.push(`erreur de la page : ${e.message}`));
  p.on("console", (m) => {
    if (m.type() === "error") fautes.push(`console : ${m.text()}`);
  });

  await p.goto(`${URL_JEU}/`, { waitUntil: "load", timeout: LONG });
  const etat = await p.waitForFunction(
    () => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Jouer");
      if (b && !b.disabled) return "pret";
      if (document.body.textContent?.includes("n'a pas pu se charger")) return "erreur";
      return false;
    },
    null,
    { timeout: LONG, polling: 500 },
  );
  if ((await etat.jsonValue()) !== "pret") fautes.push(`le jeu ne s'est pas chargé : ${await p.textContent("body")}`);
  const pret = s();
  if (F.ouverture) await p.screenshot({ path: join(CAPTURES, F.ouverture), timeout: LONG });

  // « Jouer », puis le chrono doit avancer (le match tourne vraiment)
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Jouer")?.click());
  const chrono = () => p.evaluate(() => [...document.querySelectorAll("span")].map((x) => x.textContent?.trim() ?? "").find((t) => /^\d:\d\d$/.test(t)) ?? null);
  await p.waitForFunction(() => [...document.querySelectorAll("span")].some((x) => /^\d:\d\d$/.test(x.textContent?.trim() ?? "")), null, { timeout: LONG, polling: 500 });
  const depart = await chrono();
  const enSecondes = (t) => (t ? Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]) : NaN);
  await p.waitForFunction(
    (d) => {
      const t = [...document.querySelectorAll("span")].map((x) => x.textContent?.trim() ?? "").find((x) => /^\d:\d\d$/.test(x));
      return t && Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]) <= d - 3;
    },
    enSecondes(depart),
    { timeout: LONG, polling: 500 },
  );
  const apres = await chrono();
  await p.screenshot({ path: join(CAPTURES, F.fichier), timeout: LONG });

  await p.waitForTimeout(1000); // les dernières réponses
  const sorties = requetes.filter((r) => !r.url.startsWith("data:") && !r.url.startsWith("blob:") && new URL(r.url).origin !== ORIGINE);
  const interdites = requetes.filter((r) => /supabase|\/api\//i.test(r.url));
  const manquants = requetes.filter((r) => r.statut !== null && r.statut >= 400);
  for (const r of sorties) fautes.push(`requête hors de ${ORIGINE} : ${r.methode} ${r.url}`);
  for (const r of interdites) fautes.push(`requête interdite : ${r.methode} ${r.url}`);
  for (const r of manquants) fautes.push(`fichier manquant : ${r.statut} ${r.url}`);

  const chemins = [...new Set(requetes.map((r) => (r.url.startsWith("data:") || r.url.startsWith("blob:") ? r.url.slice(0, 5) : new URL(r.url).pathname)))].sort();
  writeFileSync(
    join(CAPTURES, `reseau-${F.nom}.json`),
    `${JSON.stringify({ format: `${F.largeur}x${F.hauteur}`, origine: ORIGINE, total: requetes.length, horsOrigine: sorties.length, interdites: interdites.length, enErreur: manquants.length, chemins, requetes }, null, 2)}\n`,
  );
  const poids = (statSync(join(CAPTURES, F.fichier)).size / 1024 / 1024).toFixed(2);
  console.log(
    `${F.nom} ${F.largeur}×${F.hauteur} : « Jouer » prêt à ${pret}, chrono ${depart} → ${apres}, capture ${F.fichier} (${poids} Mo), ` +
      `${requetes.length} requêtes, ${sorties.length} hors de l'adresse, ${interdites.length} interdites, ${manquants.length} en erreur`,
  );
  for (const f of fautes) console.log(`  ✗ ${f}`);
  echecs += fautes.length;
  await ctx.close();
}

await navigateur.close();
if (echecs) {
  console.log(`Bola 27 : ${echecs} défaut(s).`);
  process.exit(1);
}
console.log("Bola 27 : vérifié, aucune requête hors de l'adresse servie.");
