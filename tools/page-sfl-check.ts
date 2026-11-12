// La page publique getbola.app/sfl (components/sfl/page-sfl, 12/11/2026) : ce
// que le lien de la bio Instagram ouvre doit rester ouvert, juste et sans
// joueur réel.
//   1 · /sfl est ouverte à tous (PUBLIC_ROUTES), sans barre d'onglets
//       (SANS_BARRE), sans accueil de l'app (SANS_ACCUEIL), sans guide
//       d'installation (SANS_GUIDE), à l'intro courte (INTRO_COURTE) ; l'intro
//       pose toujours son signal de fin, que la Map et l'accueil attendent ;
//   2 · aucune autre adresse de l'app ne commence par /sfl (la porte compare
//       un début d'adresse) ;
//   3 · la route est un composant serveur, avec son titre absolu, ses balises
//       Open Graph et Twitter ;
//   4 · la page ne mène qu'à /inscription, /connexion, /confidentialite et / :
//       aucun lien vers l'extérieur ;
//   5 · elle ne lit ni la saison ni le joueur connecté, et ne montre aucune
//       carte de joueur réel (ni PlayerCard, ni MiniCarte, ni CarteDe) ;
//   6 · aucun nom de l'effectif embarqué n'apparaît, en mot entier, dans ses
//       textes ni dans ses sources ;
//   7 · ses textes : ni point d'exclamation, ni émoji, ni mot non décidé (un
//       prix, une adresse, une heure de coup d'envoi) ou rejeté ;
//   8 · ses faits suivent le code : le barème contre entryPP, l'heure de la
//       révélation contre REGLES_REVELATION, le vendredi 19 h contre
//       equipesVisibles, le 75 contre la carte neutre ;
//   9 · le sigle : public/bola/sfl.svg est celui du générateur, les exports le
//       reprennent sans y toucher ; l'aperçu du lien fait 1200 × 630, moins de
//       300 ko, avec son texte de remplacement.
//   npx tsx tools/page-sfl-check.ts
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { carteNeutre } from "../src/lib/sfl/carte-neutre";
import { equipesVisibles } from "../src/lib/sfl/convocation-temps";
import {
  CARTE_SFL,
  CLASSEMENT_SFL,
  LIENS_SFL,
  META_SFL,
  SEMAINE_SFL,
  pointsLisibles,
  textesPageSfl,
  type TuileBareme,
} from "../src/lib/sfl/page-sfl";
import { REGLES_REVELATION } from "../src/lib/sfl/revelation";
import { entryPP } from "../src/lib/sfl/saisie/engine";
import { seedSaison } from "../src/lib/sfl/saisie/store";
import type { MatchEntry } from "../src/lib/sfl/saisie/types";
import { sigleSfl } from "./sigle-sfl";
import { APERCU_LIEN, composer, sigleSerre } from "./sigle-sfl-exports";

const RACINE = join(__dirname, "..");
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");
const fautes: string[] = [];
const verifier = (ok: boolean, message: string) => {
  if (!ok) fautes.push(message);
};

const ROUTE = "src/app/sfl/page.tsx";
const PAGE = "src/components/sfl/page-sfl/page-sfl.tsx";
const TEXTES = "src/lib/sfl/page-sfl.ts";
const ALT = "src/app/sfl/opengraph-image.alt.txt";
const SOURCES = [ROUTE, PAGE, TEXTES, ALT];

// 1 · Ouverte, sans barre, sans accueil, sans guide, à l'intro courte.
/** La liste écrite après `const NOM = [` dans un fichier. */
function liste(fichier: string, nom: string): string[] {
  const m = new RegExp(`const ${nom} = \\[([^\\]]*)\\]`).exec(lire(fichier));
  assert.ok(m, `${fichier} : la liste ${nom} est introuvable`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
for (const [fichier, nom] of [
  ["src/components/sfl/auth/auth-gate.tsx", "PUBLIC_ROUTES"],
  ["src/components/layout/bottom-nav.tsx", "SANS_BARRE"],
  ["src/components/sfl/accueil/accueil.tsx", "SANS_ACCUEIL"],
  ["src/components/pwa/guide-installation.tsx", "SANS_GUIDE"],
  ["src/components/sfl/app-splash.tsx", "INTRO_COURTE"],
] as const)
  verifier(liste(fichier, nom).includes("/sfl"), `1 · /sfl manque à ${nom} (${fichier})`);
const guide = lire("src/components/pwa/guide-installation.tsx");
verifier(
  /if \(!isClient \|\| ferme \|\| SANS_GUIDE\.some\(\(r\) => pathname\?\.startsWith\(r\)\)\) return null;/.test(guide),
  "1 · le guide d'installation ne s'efface plus sur les pages de SANS_GUIDE"
);
const intro = lire("src/components/sfl/app-splash.tsx");
verifier(/document\.documentElement\.dataset\.splash = "fini"/.test(intro), "1 · l'intro ne pose plus data-splash=\"fini\"");
verifier(/window\.dispatchEvent\(new Event\(SPLASH_FINI\)\)/.test(intro), "1 · l'intro n'émet plus SPLASH_FINI");
// L'intro courte ne passe pas par le préchauffage de la 3D : son retour est avant l'import du moteur.
const courte = intro.indexOf("if (courte) {");
verifier(courte > 0 && courte < intro.indexOf('await import("@/components/sfl/card-3d-canvas")'), "1 · l'intro courte charge le moteur des cartes 3D");

// 2 · Aucune autre adresse ne commence par /sfl.
const voisines = readdirSync(join(RACINE, "src/app")).filter((n) => n.startsWith("sfl") && statSync(join(RACINE, "src/app", n)).isDirectory());
assert.deepEqual(voisines, ["sfl"], `2 · des adresses commencent par /sfl : ${voisines.join(", ")}`);

// 3 · La route : un composant serveur, avec ses métadonnées.
const route = lire(ROUTE);
verifier(!/^\s*["']use client["']/m.test(route), "3 · la route /sfl est devenue un composant client (plus de métadonnées)");
for (const attendu of ["title: { absolute:", "openGraph:", "twitter:", 'alternates: { canonical: "/sfl" }', 'card: "summary_large_image"'])
  verifier(route.includes(attendu), `3 · la route /sfl n'a plus « ${attendu} »`);

// 4 · Les liens : quatre adresses de l'app, rien vers l'extérieur.
assert.deepEqual(LIENS_SFL, { inscription: "/inscription", connexion: "/connexion", confidentialite: "/confidentialite", app: "/" }, "4 · les liens de la page ont changé");
const page = lire(PAGE);
for (const m of page.matchAll(/href=(\{[^}]*\}|"[^"]*")/g))
  verifier(m[1].includes("LIENS_SFL."), `4 · un lien de la page n'est pas dans LIENS_SFL : ${m[0]}`);
for (const f of SOURCES) {
  verifier(!/https?:\/\//.test(lire(f)), `4 · ${f} écrit une adresse entière`);
  verifier(!/target=|window\.open|<a\s/.test(lire(f)), `4 · ${f} ouvre un lien hors de l'app`);
}

// 5 · Ni la saison, ni le joueur connecté, ni une carte de joueur réel.
for (const f of [ROUTE, PAGE, TEXTES])
  for (const interdit of ["useSeason", "useMyPlayer", "PlayerCard", "MiniCarte", "CarteDe", "photoParNom", "seedSaison"])
    verifier(!new RegExp(`\\b${interdit}\\b`).test(lire(f)), `5 · ${f} lit ${interdit}`);
verifier(!/\bphoto=/.test(page), "5 · une carte de la page porte une photo");

// 6 · Aucun nom de l'effectif, en mot entier (les lettres accentuées comptent).
const motEntier = (mot: string) => new RegExp(`(?<![\\p{L}\\p{N}])${mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu");
const effectif = [...new Set(seedSaison().roster.flatMap((r) => [r.name, ...r.name.split(/\s+/)]))].filter((n) => n.length > 1);
assert.ok(effectif.length > 50, "6 · l'effectif embarqué est vide : le contrôle ne prouve plus rien");
const textes = textesPageSfl();
for (const nom of effectif) {
  for (const t of textes) verifier(!motEntier(nom).test(t), `6 · un nom de l'effectif dans un texte : « ${nom} » dans « ${t} »`);
  for (const f of SOURCES) verifier(!motEntier(nom).test(lire(f)), `6 · un nom de l'effectif dans ${f} : « ${nom} »`);
}
// La preuve que le contrôle voit : un nom glissé dans une phrase est trouvé.
assert.ok(motEntier(effectif[0]).test(`Avec ${effectif[0]}.`), "6 · le contrôle des noms ne trouve plus rien");

// 7 · Les textes.
const INTERDITS = [
  "gratuit", "€", "euro", "prix", "abonnement", "cotisation", "App Store", "télécharge", "Ballon d", "prono", "pari", "Hippodrome", "Marcq",
  "12h30", "12 h 30", "arbitre", "mixte", "bêta", "SFL Time", "champion", "Il manque", "Flair", "carton",
];
/** Un mot interdit, au début d'un mot (« champion » trouve aussi « championnat »). */
const debutDeMot = (mot: string) => new RegExp(`(?<![\\p{L}\\p{N}])${mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "iu");
const plat = (t: string) => t.replace(/ /g, " ").replace(/’/g, "'");
for (const t of textes) {
  verifier(!t.includes("!"), `7 · un point d'exclamation : « ${t} »`);
  verifier(!/\p{Extended_Pictographic}/u.test(t.replace(/©/g, "")), `7 · un émoji : « ${t} »`);
  verifier(!/'/.test(t), `7 · une apostrophe droite (le site écrit ’) : « ${t} »`);
  for (const mot of INTERDITS) verifier(!debutDeMot(mot).test(plat(t)), `7 · le mot « ${mot} » : « ${t} »`);
}
// Tout ce que la page montre vient de son fichier de textes : aucune phrase écrite dans le composant.
for (const m of page.matchAll(/>\s*([A-ZÀ-Ýa-zà-ÿ][^<>{}\n]{3,})\s*</g))
  verifier(false, `7 · un texte écrit dans le composant, hors de ${TEXTES} : « ${m[1].trim()} »`);
verifier(!/aria-label="/.test(page), `7 · un libellé écrit dans le composant, hors de ${TEXTES}`);

// 8 · Les faits suivent le code.
const ligne = (e: Partial<MatchEntry> = {}): MatchEntry => ({
  j: 1,
  player: "x",
  team: null,
  statut: "Présent",
  result: null,
  sflTime: false,
  buts: 0,
  passes: 0,
  cleanSheet: false,
  mvp: false,
  impact: false,
  def: false,
  retard: false,
  ...e,
});
const presence = entryPP(ligne());
/** Ce que le code donne pour le geste d'une tuile : seul, ou en plus de la présence. */
const DU_CODE: Record<TuileBareme["cle"], number> = {
  presence,
  victoire: entryPP(ligne({ result: "Victoire" })) - presence,
  but: entryPP(ligne({ buts: 1 })) - presence,
  passe: entryPP(ligne({ passes: 1 })) - presence,
  cleanSheet: entryPP(ligne({ cleanSheet: true })) - presence,
  mvp: entryPP(ligne({ mvp: true })) - presence,
  retard: entryPP(ligne({ retard: true })) - presence,
  absence: entryPP(ligne({ statut: "Absence injustifiée" })),
};
assert.deepEqual(
  CLASSEMENT_SFL.bareme.map((t) => t.cle),
  ["presence", "victoire", "but", "passe", "cleanSheet", "mvp", "retard", "absence"],
  "8 · les tuiles du barème ont changé"
);
for (const t of CLASSEMENT_SFL.bareme)
  verifier(t.points === DU_CODE[t.cle], `8 · le barème affiché (${t.libelle} ${pointsLisibles(t.points)}) ne suit plus entryPP (${DU_CODE[t.cle]})`);
assert.equal(pointsLisibles(-1), "−1");
assert.equal(pointsLisibles(2), "+2");

const heure = (h: number) => `${h} h`;
const [, , vendredi, , dimanche] = SEMAINE_SFL.lignes;
// La révélation : le dimanche, à l'heure du code.
verifier(REGLES_REVELATION.REVELATION.min === 0, "8 · la révélation n'est plus à l'heure pile : la page écrit « 19 h »");
verifier(dimanche.jour === "Dimanche" && dimanche.heure === heure(REGLES_REVELATION.REVELATION.h), `8 · « ${dimanche.jour} · ${dimanche.heure} » ne suit plus REGLES_REVELATION (${REGLES_REVELATION.REVELATION.h} h)`);
// Les équipes : visibles le vendredi à l'heure écrite, pas une minute avant (heure de Paris, hiver comme été).
verifier(vendredi.jour === "Vendredi" && vendredi.heure === heure(19), "8 · la ligne des équipes n'est plus « Vendredi · 19 h »");
for (const [avant, apres] of [
  ["2026-11-13T17:59:00Z", "2026-11-13T18:00:00Z"],
  ["2026-07-03T16:59:00Z", "2026-07-03T17:00:00Z"],
]) {
  verifier(!equipesVisibles(new Date(avant)), `8 · les équipes sont visibles avant le vendredi 19 h (${avant})`);
  verifier(equipesVisibles(new Date(apres)), `8 · les équipes ne sont pas visibles le vendredi à 19 h (${apres})`);
}
// La carte : 75 partout, comme celle d'un compte neuf.
const neutre = carteNeutre(CARTE_SFL.nom);
verifier(Object.values(neutre.stats).every((s) => s === CARTE_SFL.note), `8 · la carte neutre n'est plus à ${CARTE_SFL.note} partout`);
verifier(CARTE_SFL.phrases[0].includes(String(CARTE_SFL.note)) && CARTE_SFL.lue.includes(String(CARTE_SFL.note)), "8 · la phrase de la carte ne dit plus sa note de départ");
verifier(/carteNeutre\(CARTE_SFL\.nom\)/.test(page) && /overall=\{CARTE_SFL\.note\}/.test(page), "8 · la page ne montre plus la carte neutre");

// 9 · Le sigle et l'aperçu du lien.
const svg = lire("public/bola/sfl.svg");
verifier(svg === sigleSfl(), "9 · public/bola/sfl.svg n'est plus celui de tools/sigle-sfl.ts (retouché à la main ?)");
const trace = / d="([^"]+)"/.exec(svg)?.[1];
verifier(!!trace && sigleSerre().d === trace, "9 · le tracé des exports n'est plus celui de public/bola/sfl.svg");
verifier(
  !!trace && composer({ nom: "x", l: 1080, h: 1080, fond: "#08090B", sigle: "#F4F5F2", largeur: 702 }).includes(` d="${trace}"`),
  "9 · une image exportée ne reprend plus le tracé tel quel"
);
verifier(existsSync(APERCU_LIEN), "9 · l'aperçu du lien (opengraph-image.png) manque");
if (existsSync(APERCU_LIEN)) {
  const png = readFileSync(APERCU_LIEN);
  verifier(png.subarray(1, 4).toString("latin1") === "PNG", "9 · l'aperçu du lien n'est pas un PNG");
  verifier(png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630, `9 · l'aperçu du lien fait ${png.readUInt32BE(16)} × ${png.readUInt32BE(20)}, pas 1200 × 630`);
  verifier(png.length < 300_000, `9 · l'aperçu du lien pèse ${png.length} octets (300 ko au plus)`);
}
verifier(existsSync(join(RACINE, ALT)) && lire(ALT).trim() === META_SFL.image, "9 · le texte de remplacement de l'aperçu manque ou ne suit plus META_SFL.image");

assert.equal(fautes.length, 0, `\n${fautes.join("\n")}`);
console.log(`page-sfl : ok (${textes.length} textes, ${effectif.length} noms cherchés, ${CLASSEMENT_SFL.bareme.length} points du barème)`);
