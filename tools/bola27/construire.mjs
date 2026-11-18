#!/usr/bin/env node
// Bola 27 (bola-app#33) : construit le jeu seul en site statique, pour l'adresse publique bola27.vercel.app.
//
// Sabri, 18/11/2026 : « Est-ce que tu peux aussi publier l'adresse du jeu sur Vercel ? Bola27 ». Le jeu, et rien
// d'autre : sans Supabase, sans connexion, sans le reste de l'app, sans données ni photo d'un vrai joueur.
//
// Ce que fait ce script, sans aucune dépendance de plus que celles du dépôt (esbuild, Tailwind 4, postcss : déjà dans
// package-lock.json, ceux que l'app utilise) et SANS Next (ni « npm run build », ni le prebuild, qui écrit dans la base
// de production : jamais lancés ici) :
//   1. le paquet JavaScript : esbuild part de ./entree.tsx, qui monte la vraie page du jeu (src/app/jouer/page.tsx).
//      Les modules de l'app que la page emprunte sont remplacés par ceux de ./remplacants/ (REMPLACANTS ci-dessous).
//      La garde refuse tout le reste : next/*, @supabase/*, et tout fichier de src/ hors de PERMIS. Si une passe sur le
//      jeu fait importer autre chose de l'app à la page, la construction s'arrête et dit quoi faire ;
//   2. la feuille de style : ./style.css (la feuille de l'app, src/app/globals.css, et les polices du jeu) compilée
//      par Tailwind 4 sur les seuls fichiers du paquet, puis le repli d'opacité de l'app (postcss-repli-opacite.cjs),
//      comme dans postcss.config.mjs ;
//   3. Inter : récupérée chez Google Fonts au moment de la construction, comme le fait next/font pour l'app, et servie
//      par le site lui-même (aucune requête vers Google chez le visiteur) ; si elle ne vient pas, la police du système
//      prend le relais et le script le dit ;
//   4. les fichiers du jeu : public/jeu/ tel quel (animations .pak brouillées, personnages, plateau, police Anton),
//      et l'icône de l'app ;
//   5. la page : index.html, et la même à jouer/index.html (bola27.vercel.app et bola27.vercel.app/jouer), puis
//      version.json (le commit construit, pour vérifier ce que sert l'adresse en ligne) ;
//   6. les contrôles de sortie : ni « supabase », ni « process.env », ni appel « /api/ » dans ce qui est servi ; un
//      échec arrête tout (code 1) et ne laisse pas de dossier à moitié faux.
//
//   node tools/bola27/construire.mjs [--sortie <dossier>] [--sans-inter]
//     --sortie      le dossier produit ; par défaut out/bola27 à la racine du dépôt (out/ est déjà ignoré par git et
//                   par eslint). Sur Vercel : « --sortie sortie », voir vercel.json et LISEZMOI.md.
//     --sans-inter  ne va pas chercher Inter (construction hors réseau).
//   Derrière un mandataire HTTPS (le cloud de l'agent), lancer avec NODE_USE_ENV_PROXY=1 pour que fetch le suive.
import { build } from "esbuild";
import { compile, optimize } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import postcss from "postcss";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "../..");
const require = createRequire(import.meta.url);

// Les modules de l'app que la page du jeu importe, et ce qui les remplace dans le jeu seul.
const REMPLACANTS = {
  "@/components/sfl/player-provider": "remplacants/joueur.ts",
  "@/lib/sfl/admin": "remplacants/admin.ts",
  "@/lib/sfl/photos": "remplacants/photos.ts",
  "@/components/layout/bouton-retour": "remplacants/bouton-retour.tsx",
  "next/link": "remplacants/lien.tsx",
};
// Les seuls fichiers de src/ admis dans le paquet : la page du jeu et ses composants, le moteur, et cn().
const PERMIS = ["src/app/jouer/", "src/lib/jeu/", "src/lib/utils.ts"];
const EXCLUS = ["src/app/jouer/studio/"]; // le studio du jeu (photos des joueurs) reste dans l'app
// Ce qui n'a jamais sa place dans le jeu seul.
const INTERDIT = /^(next(\/|$)|@supabase\/|server-only$|pg$|@vercel\/)/;

const args = process.argv.slice(2);
const option = (nom) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
};
const SORTIE = resolve(process.cwd(), option("--sortie") ?? join(RACINE, "out", "bola27"));
const SANS_INTER = args.includes("--sans-inter");

const rel = (f) => relative(RACINE, f).split(sep).join("/");
const empreinte = (contenu) => createHash("sha256").update(contenu).digest("hex").slice(0, 10).toUpperCase();
// un échec, une fois le dossier de sortie préparé, l'efface : jamais de site à moitié construit, et la construction
// suivante le retrouve vide (elle refuse d'effacer un dossier qu'elle n'a pas produit)
let sortieANous = false;
const echouer = (message) => {
  if (sortieANous) rmSync(SORTIE, { recursive: true, force: true });
  console.error(`\nBola 27 : construction arrêtée.\n${message}\n`);
  process.exit(1);
};
const ko = (n) => `${(n / 1024).toFixed(0)} ko`;
const mo = (n) => `${(n / 1024 / 1024).toFixed(2)} Mo`;

// --- 0. le dossier de sortie : jamais la racine, jamais un dossier du dépôt, jamais un dossier qui n'est pas à nous
function preparerSortie() {
  const interdits = [RACINE, join(RACINE, "src"), join(RACINE, "public"), join(RACINE, "tools"), ICI, dirname(RACINE), "/"];
  if (interdits.includes(SORTIE) || RACINE.startsWith(SORTIE + sep)) echouer(`Dossier de sortie refusé : ${SORTIE}`);
  if (existsSync(SORTIE)) {
    const contenu = readdirSync(SORTIE);
    if (contenu.length && !existsSync(join(SORTIE, "version.json"))) {
      echouer(`${SORTIE} existe, n'est pas vide et n'a pas été produit par ce script (pas de version.json) : rien n'est effacé.`);
    }
    rmSync(SORTIE, { recursive: true, force: true });
  }
  mkdirSync(join(SORTIE, "bola27"), { recursive: true });
  sortieANous = true;
}

// --- 1. le paquet JavaScript
const garde = {
  name: "bola27-garde",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (a) => {
      if (a.kind === "entry-point") return undefined;
      const r = REMPLACANTS[a.path];
      if (r) return { path: join(ICI, r) };
      if (INTERDIT.test(a.path)) {
        return {
          errors: [
            {
              text: `« ${a.path} » n'a pas sa place dans le jeu seul (importé par ${rel(a.importer)}). Retirer l'import, ou lui donner un remplaçant sans données dans tools/bola27/remplacants/ et l'ajouter à REMPLACANTS (construire.mjs).`,
            },
          ],
        };
      }
      return undefined;
    });
  },
};

async function paquet() {
  const r = await build({
    absWorkingDir: RACINE,
    entryPoints: { entree: join(ICI, "entree.tsx") },
    tsconfig: join(RACINE, "tsconfig.json"),
    bundle: true,
    splitting: true, // le moteur (lib/jeu/match.js, importé à la demande par la page) part dans son propre morceau
    format: "esm",
    platform: "browser",
    target: ["es2020", "safari15", "chrome100", "firefox100"],
    outdir: join(SORTIE, "bola27"),
    publicPath: "/bola27/",
    entryNames: "[name]-[hash]",
    chunkNames: "[name]-[hash]",
    assetNames: "[name]-[hash]",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    minify: true,
    charset: "utf8",
    metafile: true,
    logLevel: "warning",
    plugins: [garde],
  });
  const entrees = Object.keys(r.metafile.inputs);
  const fautifs = entrees.filter((f) => {
    if (/node_modules\/(@supabase|next)\//.test(f)) return true;
    if (!f.startsWith("src/")) return false;
    return !PERMIS.some((p) => f.startsWith(p)) || EXCLUS.some((p) => f.startsWith(p));
  });
  if (fautifs.length) {
    echouer(
      `Ces fichiers de l'app sont entrés dans le paquet du jeu seul :\n  ${fautifs.join("\n  ")}\n` +
        `Donner un remplaçant sans données au module qui les amène (tools/bola27/remplacants/, REMPLACANTS), ou, s'ils ne touchent ni compte ni données, les ajouter à PERMIS.`,
    );
  }
  const sorties = Object.entries(r.metafile.outputs);
  const [js, infos] = sorties.find(([, o]) => o.entryPoint) ?? [];
  if (!js) echouer("esbuild n'a pas produit l'entrée.");
  return { js: `/bola27/${basename(js)}`, cssPaquet: infos.cssBundle ? `/bola27/${basename(infos.cssBundle)}` : null, entrees };
}

// --- 2. la feuille de style
async function feuille(entrees) {
  const source = join(ICI, "style.css");
  const compilateur = await compile(readFileSync(source, "utf8"), { base: ICI, from: source, shouldRewriteUrls: true, onDependency: () => {} });
  // les classes ne sont cherchées que dans les fichiers du paquet (et ce script, pour celles de la page HTML)
  const fichiers = entrees.filter((f) => !f.includes("node_modules")).map((f) => resolve(RACINE, f));
  fichiers.push(fileURLToPath(import.meta.url));
  const scanner = new Scanner({
    sources: fichiers.map((f) => ({ base: dirname(f), pattern: basename(f), negated: false })).concat(compilateur.sources),
  });
  let css = compilateur.build(scanner.scan());
  css = optimize(css, { minify: true }).code;
  const repli = require(join(RACINE, "postcss-repli-opacite.cjs"));
  css = (await postcss([repli()]).process(css, { from: undefined })).css;
  return css;
}

// --- 3. Inter, une fois, au moment de la construction
async function inter() {
  if (SANS_INTER) return null;
  try {
    const ua = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" };
    const r = await fetch("https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap", { headers: ua });
    if (!r.ok) throw new Error(`Google Fonts : ${r.status}`);
    const bloc = (await r.text()).split("/* latin */")[1]?.split("}")[0];
    const url = bloc?.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/)?.[1];
    const plage = bloc?.match(/unicode-range:\s*([^;]+);/)?.[1];
    if (!url || !plage) throw new Error("pas de sous-ensemble « latin » dans la réponse de Google Fonts");
    const f = await fetch(url);
    if (!f.ok) throw new Error(`fichier d'Inter : ${f.status}`);
    const octets = Buffer.from(await f.arrayBuffer());
    if (octets.subarray(0, 4).toString("latin1") !== "wOF2") throw new Error("le fichier d'Inter n'est pas un woff2");
    const nom = `inter-latin-${empreinte(octets)}.woff2`;
    writeFileSync(join(SORTIE, "bola27", nom), octets);
    return {
      chemin: `/bola27/${nom}`,
      regle: `@font-face{font-family:"BolaInter";font-style:normal;font-weight:100 900;font-display:swap;src:url(/bola27/${nom}) format("woff2");unicode-range:${plage.trim()}}`,
    };
  } catch (e) {
    const indice = process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY ? " (derrière un mandataire : relancer avec NODE_USE_ENV_PROXY=1)" : "";
    console.warn(`Bola 27 : Inter n'a pas pu être récupérée${indice} : ${e instanceof Error ? e.message : e}. La police du système la remplace.`);
    return null;
  }
}

// --- 5. la page
function page({ js, css, cssPaquet, police }) {
  return `<!doctype html>
<html lang="fr" class="dark h-full antialiased">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#05070a">
<meta name="color-scheme" content="dark">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Bola 27">
<meta name="description" content="Bola 27, le jeu de foot à cinq de Bola.">
<title>Bola 27</title>
<link rel="icon" href="/favicon.ico" sizes="any">
${police ? `<link rel="preload" href="${police}" as="font" type="font/woff2" crossorigin>\n` : ""}<link rel="stylesheet" href="${css}">
${cssPaquet ? `<link rel="stylesheet" href="${cssPaquet}">\n` : ""}<script type="module" src="${js}"></script>
</head>
<body class="h-dvh overflow-hidden overscroll-none touch-manipulation">
<div id="bola27"></div>
</body>
</html>
`;
}

function commit() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: RACINE, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function parcourir(dossier, liste = []) {
  for (const n of readdirSync(dossier)) {
    const f = join(dossier, n);
    if (statSync(f).isDirectory()) parcourir(f, liste);
    else liste.push(f);
  }
  return liste;
}

// --- 6. les contrôles de sortie
function controler() {
  const textes = parcourir(SORTIE).filter((f) => /\.(js|css|html|json)$/.test(f) && !f.includes(`${sep}jeu${sep}`));
  const motifs = [
    [/supabase/i, "une trace de Supabase"],
    [/process\.env/, "un « process.env » (il planterait dans le navigateur)"],
    [/["'`]\/api\//, "un appel à une API de l'app (/api/…)"],
    [/getbola\.app/i, "une adresse de l'app"],
  ];
  const fautes = [];
  for (const f of textes) {
    const t = readFileSync(f, "utf8");
    for (const [m, quoi] of motifs) if (m.test(t)) fautes.push(`${rel(f)} : ${quoi}`);
  }
  if (fautes.length) echouer(`Le site produit contient :\n  ${fautes.join("\n  ")}\nLe dossier de sortie a été effacé.`);
}

// ---
const debut = Date.now();
preparerSortie();
let js, cssPaquet, entrees, police, nomCss;
try {
  ({ js, cssPaquet, entrees } = await paquet());
  let css;
  [css, police] = await Promise.all([feuille(entrees), inter()]);
  const cssFinal = (police ? police.regle : "") + css;
  nomCss = `style-${empreinte(cssFinal)}.css`;
  writeFileSync(join(SORTIE, "bola27", nomCss), cssFinal);
  cpSync(join(RACINE, "public", "jeu"), join(SORTIE, "jeu"), { recursive: true });
  cpSync(join(RACINE, "src", "app", "favicon.ico"), join(SORTIE, "favicon.ico"));
  const html = page({ js, css: `/bola27/${nomCss}`, cssPaquet, police: police?.chemin });
  writeFileSync(join(SORTIE, "index.html"), html);
  mkdirSync(join(SORTIE, "jouer"), { recursive: true });
  writeFileSync(join(SORTIE, "jouer", "index.html"), html);
  writeFileSync(join(SORTIE, "version.json"), `${JSON.stringify({ jeu: "Bola 27", commit: commit(), construit: new Date().toISOString() }, null, 2)}\n`);
} catch (e) {
  // esbuild a déjà écrit ses erreurs (dont celles de la garde) ; pour le reste, le message
  echouer(e && typeof e === "object" && "errors" in e ? "esbuild a refusé le paquet (erreurs ci-dessus)." : String(e instanceof Error ? e.stack : e));
}
controler();

// le compte rendu
const tous = parcourir(SORTIE);
const poids = (filtre) => tous.filter(filtre).reduce((s, f) => s + statSync(f).size, 0);
const total = poids(() => true);
console.log(`Bola 27 : construit dans ${rel(SORTIE) || SORTIE} en ${((Date.now() - debut) / 1000).toFixed(1)} s`);
const deSrc = entrees.filter((f) => f.startsWith("src/"));
const groupes = PERMIS.map((p) => `${p.replace(/^src\//, "").replace(/\/$/, "")} : ${deSrc.filter((f) => f.startsWith(p)).length}`);
const paquets = [...new Set(entrees.map((f) => f.match(/node_modules\/((@[^/]+\/)?[^/]+)/)?.[1]).filter(Boolean))].sort();
console.log(`  sources        ${deSrc.length} fichiers de src/ (${groupes.join(", ")}), ${entrees.filter((f) => f.startsWith("tools/bola27/")).length} de tools/bola27, paquets : ${paquets.join(", ")}`);
console.log(`  page et code   ${ko(poids((f) => f.includes(`${sep}bola27${sep}`) && f.endsWith(".js")))} (JavaScript), ${ko(statSync(join(SORTIE, "bola27", nomCss)).size)} (CSS)`);
console.log(`  Inter          ${police ? police.chemin : "absente (police du système)"}`);
console.log(`  fichiers du jeu ${mo(poids((f) => f.includes(`${sep}jeu${sep}`)))} (public/jeu)`);
console.log(`  total          ${mo(total)} en ${tous.length} fichiers`);
