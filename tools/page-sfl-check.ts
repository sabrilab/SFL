// La page publique getbola.app/sfl (components/sfl/page-sfl, 12/11/2026) : ce
// que le lien de la bio Instagram ouvre doit rester ouvert, juste, et ne
// montrer que des joueurs qui ont dit oui (depuis le 13/11, la page montre de
// vrais joueurs : l'instantané, lib/sfl/page-sfl-instantane.ts, écrit par
// tools/page-sfl-instantane.ts). Ce que ce banc tient (durci le 12/11 après
// un contrôle par mutants : il en laissait passer 23 sur 35) :
//   1 · la porte : estPublique (lib/sfl/routes-publiques.ts) ouvre /sfl et les
//       adresses prévues, rien d'autre (chaque dossier de src/app est essayé) ;
//       /sfl est comparée en entier partout (la porte, la barre d'onglets,
//       l'accueil, ce qui s'ouvre seul, le guide d'installation, l'intro
//       courte) ; une page ouverte passe avant l'attente du client (son HTML
//       est servi entier) ; /SFL en capitales renvoie à /sfl ; l'intro pose
//       toujours son signal de fin, que la Map et l'accueil attendent ;
//   2 · aucune autre adresse de l'app ne commence par /sfl ;
//   3 · la route est un composant serveur qui exporte METADONNEES_SFL telles
//       quelles ; ces métadonnées sont comparées en entier (titre absolu,
//       description, adresse canonique, Open Graph, Twitter) ;
//   4 · chaque bouton mène où il le dit (BOUTONS_SFL : le texte et l'adresse
//       vont ensemble, un seul composant les pose) ; la page ne mène qu'à
//       /inscription, /connexion, /confidentialite et / ; aucun lien vers
//       l'extérieur ; la visite n'est notée qu'à l'étape « site », et jamais
//       pour un joueur connecté ;
//   5 · la page n'importe que ce qui est sur une liste (l'instantané compris) :
//       ni Supabase, ni la saison, ni un hook de joueurs, ni un composant de
//       carte ; ses cartes sont des images de l'instantané, rien d'autre ;
//   6 · aucun nom de l'effectif embarqué n'apparaît, en mot entier, dans ses
//       textes ni dans ses sources ; dans l'instantané, tout nom (des blocs,
//       des textes de remplacement, des fichiers) est dans ACCORDS, et ACCORDS
//       ne tient que les joueurs montrés : un joueur absent d'ACCORDS fait
//       échouer le banc (preuve par mutants) ; les règles de l'outil
//       (empechement, podiumSansTrou) sont essayées sur des cas ;
//   7 · ses textes : ni point d'exclamation, ni émoji, ni mot rejeté ; aucun
//       nombre hors de ceux de la page ; aucun nom propre hors d'une liste
//       (donc aucun lieu que Lille, aucun prénom) ; aucun texte écrit dans le
//       composant, ni entre deux balises, ni en chaîne ; les nombres des
//       joueurs (notes, points, places, score, journée) ne viennent que de
//       l'instantané, et sont plausibles ;
//   8 · ses faits suivent le code : le barème (entryPP), la révélation
//       (REGLES_REVELATION), le vendredi 19 h (equipesVisibles), la réponse
//       jusqu'à vendredi (reponsesOuvertes), le lundi de la convocation
//       (vercel.json), le 75 (carte neutre), ce qui fait monter chaque stat,
//       la série de trois dimanches et « ne descend jamais » (evoluer), les
//       titres votés (CATEGORIES_VOTE), les classements de fin de saison
//       (CLASSEMENTS), les divisions (DIVISIONS). Les phrases de règle que le
//       code ne sait pas dire sont figées ici (FIGEES) : en changer une, c'est
//       la relire contre la règle, puis la recopier ;
//   9 · le sigle : public/bola/sfl.svg est celui du générateur, les exports le
//       reprennent sans y toucher ; l'aperçu du lien fait 1200 × 630, moins de
//       300 ko, à l'empreinte de l'image écrite par l'outil, avec son texte de
//       remplacement ;
//  10 · le guide d'installation rouvre, hors de l'app hôte, la page affichée
//       avec la source d'arrivée du visiteur (adresseSortie) ;
//  11 · l'instantané : chaque image existe dans public/sfl/cartes, a
//       l'empreinte, les dimensions et le poids écrits par l'outil ; aucun
//       fichier orphelin ; aucun « @ », identifiant de compte ou adresse ; la
//       date de lecture est écrite et pas dans le futur ; les blocs suivent
//       les règles (pas de trou dans un podium, dix joueurs dans la compo,
//       un titre par édition au plus, une carte qui monte).
// Ce qu'il ne tient pas : le rendu (les captures), ce qu'une chaîne
// construite à l'exécution pourrait écrire dans la page, et l'état de la base
// aujourd'hui : un accord retiré depuis la lecture, c'est
// « tools/page-sfl-instantane.ts --verifier » qui le voit.
//   npx tsx tools/page-sfl-check.ts
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { adresseSortie, lienSortie } from "../src/lib/pwa/environnement";
import { carteNeutre } from "../src/lib/sfl/carte-neutre";
import { equipesVisibles, reponsesOuvertes } from "../src/lib/sfl/convocation-temps";
import { DIVISIONS, nomDivision } from "../src/lib/sfl/divisions";
import { STAT_KEYS, type Stats } from "../src/lib/sfl/engine";
import { CLASSEMENTS } from "../src/lib/sfl/fin-de-saison";
import {
  BOUTONS_SFL,
  CARTE_SFL,
  CLASSEMENT_SFL,
  DIMANCHE_SFL,
  FIN_SFL,
  LIENS_SFL,
  META_SFL,
  METADONNEES_SFL,
  SEMAINE_SFL,
  TITRES_SFL,
  pointsLisibles,
  textesPageSfl,
  type TuileBareme,
} from "../src/lib/sfl/page-sfl";
import { REGLES_REVELATION } from "../src/lib/sfl/revelation";
import { ACCORDS, CARTE_MONTEE, COMPO, LU_LE, PODIUMS, TITRES, type ImageCarte } from "../src/lib/sfl/page-sfl-instantane";
import { CHEMIN_SFL, PUBLIC_ROUTES, estPageSfl, estPageSflMalEcrite, estPublique } from "../src/lib/sfl/routes-publiques";
import { entryPP } from "../src/lib/sfl/saisie/engine";
import { SERIE, evoluer } from "../src/lib/sfl/saisie/evolution";
import { seedSaison } from "../src/lib/sfl/saisie/store";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";
import { CATEGORIES_VOTE } from "../src/lib/sfl/votes";
import { sigleSfl } from "./sigle-sfl";
import { APERCU_LIEN, composer, empreinte, sigleSerre } from "./sigle-sfl-exports";
import { empechement, podiumSansTrou, slug, type LigneJoueur } from "./page-sfl-instantane";

const RACINE = join(__dirname, "..");
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");
const fautes: string[] = [];
const verifier = (ok: boolean, message: string) => {
  if (!ok) fautes.push(message);
};
const pareil = (a: unknown, b: unknown) => {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
};

const ROUTE = "src/app/sfl/page.tsx";
const PAGE = "src/components/sfl/page-sfl/page-sfl.tsx";
const TEXTES = "src/lib/sfl/page-sfl.ts";
const ROUTES = "src/lib/sfl/routes-publiques.ts";
const ALT = "src/app/sfl/opengraph-image.alt.txt";
const INSTANTANE = "src/lib/sfl/page-sfl-instantane.ts";
const CARTES = "public/sfl/cartes";
const SOURCES = [ROUTE, PAGE, TEXTES, ROUTES, ALT];

// 1 · La porte.
// Ce qui est ouvert sans compte, et rien d'autre : chaque dossier de src/app est essayé.
const OUVERTES = new Set(["bienvenue", "inscription", "confidentialite", "sfl"]);
const dossiers = readdirSync(join(RACINE, "src/app")).filter((n) => statSync(join(RACINE, "src/app", n)).isDirectory());
assert.ok(dossiers.length > 20 && dossiers.includes("sfl") && dossiers.includes("saisons"), "1 · src/app n'a plus la forme attendue : le contrôle de la porte ne prouve plus rien");
for (const d of dossiers)
  verifier(estPublique(`/${d}`) === OUVERTES.has(d), `1 · /${d} ${OUVERTES.has(d) ? "n'est plus ouverte à tous" : "est ouverte à tous"} (estPublique)`);
for (const ouverte of ["/sfl", "/equipe/abc", "/p/ABC123", "/v/12", "/inscription", "/bienvenue", "/confidentialite"])
  verifier(estPublique(ouverte), `1 · ${ouverte} n'est plus ouverte à tous`);
for (const fermee of ["/", "/map", "/s", "/sf", "/sflx", "/sfl-test", "/sfl/abc", "/SFL", "/saisons", "/stats", "/equipe", "/p", "/v", "/admin", "/profil", "", null, undefined])
  verifier(!estPublique(fermee), `1 · « ${fermee} » est ouverte à tous`);
assert.deepEqual([...PUBLIC_ROUTES], ["/bienvenue", "/inscription", "/equipe/", "/p/", "/v/", "/confidentialite"], "1 · les débuts d'adresse ouverts à tous ont changé");
// /sfl, l'adresse entière, à la lettre ; en capitales, on y renvoie.
assert.equal(CHEMIN_SFL, "/sfl");
for (const [chemin, page, malEcrite] of [
  ["/sfl", true, false],
  ["/SFL", false, true],
  ["/Sfl", false, true],
  ["/SFL/", false, true],
  ["/sfl/", false, true],
  ["/sflx", false, false],
  ["/sfl/abc", false, false],
  ["/SFL/abc", false, false],
  ["/sfl-test", false, false],
  ["/", false, false],
  [null, false, false],
] as const) {
  verifier(estPageSfl(chemin) === page, `1 · estPageSfl(${chemin}) ne vaut plus ${page}`);
  verifier(estPageSflMalEcrite(chemin) === malEcrite, `1 · estPageSflMalEcrite(${chemin}) ne vaut plus ${malEcrite}`);
}
const porte = lire("src/components/sfl/auth/auth-gate.tsx");
verifier(!/const PUBLIC_ROUTES\b/.test(porte), "1 · la porte a de nouveau sa propre liste d'adresses ouvertes");
const laisse = porte.indexOf("if (estPublique(pathname)) return <>{children}</>;");
verifier(laisse > 0 && laisse < porte.indexOf("if (!isClient) return null;"), "1 · la porte attend le client avant de laisser passer une page ouverte : son HTML servi serait vide");
verifier(/if \(ok \|\| cancelled \|\| estPublique\(window\.location\.pathname\)\) return;/.test(porte), "1 · la reprise de session ne lit plus estPublique");
verifier(
  /const malEcrite = estPageSflMalEcrite\(pathname\);/.test(porte) &&
    /if \(malEcrite\) window\.location\.replace\(CHEMIN_SFL \+ window\.location\.search\);/.test(porte) &&
    porte.indexOf("if (malEcrite) return null;") > 0 &&
    porte.indexOf("if (malEcrite) return null;") < laisse,
  "1 · /SFL, en capitales, ne renvoie plus à /sfl"
);
// /sfl comparée en entier dans chaque composant, plus jamais par un début d'adresse.
for (const [fichier, attendu, quoi] of [
  ["src/components/layout/bottom-nav.tsx", "if (estPageSfl(pathname) || SANS_BARRE.some((r) => pathname.startsWith(r))) return null;", "la barre d'onglets se montre sur /sfl"],
  ["src/components/sfl/accueil/accueil.tsx", "const libre = estPageSfl(pathname) || SANS_ACCUEIL.some((r) => pathname?.startsWith(r));", "l'accueil de l'app s'ouvre sur /sfl"],
  ["src/components/sfl/accueil/accueil.tsx", "if (estPageSfl(pathname)) return null;\n  if (etat !== \"fini\") return null;", "ce qui s'ouvre de soi-même joue sous /sfl (ApresAccueil)"],
  [
    "src/components/pwa/guide-installation.tsx",
    "if (!isClient || ferme || estPageSfl(pathname) || estPageSflMalEcrite(pathname) || SANS_GUIDE.some((r) => pathname?.startsWith(r))) return null;",
    "le guide d'installation couvre /sfl",
  ],
  ["src/components/sfl/app-splash.tsx", "const courte = estPageSfl(window.location.pathname);", "l'intro courte ne reconnaît plus /sfl"],
] as const)
  verifier(lire(fichier).includes(attendu), `1 · ${quoi} (${fichier})`);
for (const fichier of ["src/components/layout/bottom-nav.tsx", "src/components/sfl/accueil/accueil.tsx", "src/components/pwa/guide-installation.tsx", "src/components/sfl/app-splash.tsx", "src/components/sfl/auth/auth-gate.tsx", ROUTES])
  verifier(!/"\/sfl[^"]*"/.test(lire(fichier).replace('export const CHEMIN_SFL = "/sfl";', "")), `1 · ${fichier} compare de nouveau /sfl par un début d'adresse`);
const intro = lire("src/components/sfl/app-splash.tsx");
verifier(/document\.documentElement\.dataset\.splash = "fini"/.test(intro), "1 · l'intro ne pose plus data-splash=\"fini\"");
verifier(/window\.dispatchEvent\(new Event\(SPLASH_FINI\)\)/.test(intro), "1 · l'intro n'émet plus SPLASH_FINI");
// L'intro courte ne passe pas par le préchauffage de la 3D : son retour est avant l'import du moteur.
const courte = intro.indexOf("if (courte) {");
verifier(courte > 0 && courte < intro.indexOf('await import("@/components/sfl/card-3d-canvas")'), "1 · l'intro courte charge le moteur des cartes 3D");

// 2 · Aucune autre adresse ne commence par /sfl.
const voisines = dossiers.filter((n) => n.toLowerCase().startsWith("sfl"));
assert.deepEqual(voisines, ["sfl"], `2 · des adresses commencent par /sfl : ${voisines.join(", ")}`);

// 3 · La route : un composant serveur, qui exporte les métadonnées telles quelles.
const route = lire(ROUTE);
verifier(!/^\s*["']use client["']/m.test(route), "3 · la route /sfl est devenue un composant client (plus de métadonnées)");
verifier(/^export const metadata: Metadata = METADONNEES_SFL;$/m.test(route), "3 · la route /sfl n'exporte plus METADONNEES_SFL telles quelles");
verifier(!/generateMetadata/.test(route) && (route.match(/\bmetadata\b/g) ?? []).length === 1, "3 · la route /sfl écrit d'autres métadonnées");
verifier(/export default function \w+\(\) \{\s*return <PageSfl \/>;\s*\}/.test(route), "3 · la route /sfl ne rend plus la page");
const TITRE = "SFL · Sunday Five League, Lille";
const DESCRIPTION = "Foot à cinq, chaque dimanche à Lille. Noirs contre Blancs, trois divisions, le classement Pépite d’Or. Ta carte bouge avec toi.";
verifier(
  pareil(METADONNEES_SFL, {
    title: { absolute: TITRE },
    description: DESCRIPTION,
    alternates: { canonical: "/sfl" },
    openGraph: { title: TITRE, description: DESCRIPTION, url: "/sfl", siteName: "Bola", locale: "fr_FR", type: "website" },
    twitter: { card: "summary_large_image", title: TITRE, description: DESCRIPTION },
  }),
  "3 · les métadonnées de /sfl ont changé (titre, description, adresse, Open Graph ou Twitter)"
);
verifier(META_SFL.titre === TITRE && META_SFL.description === DESCRIPTION, "3 · META_SFL ne dit plus ce que disent les métadonnées");
// Un moteur, un aperçu de lien lisent la description : c'est elle qui dit « foot ».
verifier(/^Foot à cinq\b/.test(META_SFL.description) && META_SFL.description.length <= 160, "3 · la description du lien ne commence plus par « Foot à cinq », ou dépasse 160 signes");

// 4 · Les boutons et les liens.
assert.deepEqual(LIENS_SFL, { inscription: "/inscription", connexion: "/connexion", confidentialite: "/confidentialite", app: "/" }, "4 · les liens de la page ont changé");
assert.deepEqual(
  BOUTONS_SFL,
  {
    creer: { texte: "Créer mon compte", vers: "/inscription" },
    connecter: { texte: "Se connecter", vers: "/connexion" },
    ouvrir: { texte: "Ouvrir Bola", vers: "/" },
  },
  "4 · un bouton de la page ne mène plus où il le dit"
);
const page = lire(PAGE);
/** Le composant sans ses commentaires : ce qui s'exécute. */
const sansCommentaires = page.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");
const compte = (motif: RegExp) => (sansCommentaires.match(motif) ?? []).length;
// Un seul composant pose un bouton : son adresse et son texte viennent du même objet.
verifier(
  /function Bouton\(\{ bouton, className \}: \{ bouton: BoutonSfl; className\?: string \}\) \{\s*return \(\s*<Link href=\{bouton\.vers\} className=\{className\}>\s*\{bouton\.texte\}\s*<\/Link>\s*\);\s*\}/.test(page),
  "4 · le composant Bouton ne pose plus le texte et l'adresse d'un même bouton"
);
verifier(compte(/\.vers\b/g) === 1 && compte(/\.texte\b/g) === 1, "4 · le texte ou l'adresse d'un bouton est lu hors du composant Bouton");
verifier(
  compte(/BOUTONS_SFL\.creer\b/g) === 2 && compte(/BOUTONS_SFL\.connecter\b/g) === 1 && compte(/BOUTONS_SFL\.ouvrir\b/g) === 2 && compte(/BOUTONS_SFL\b/g) === 6,
  "4 · les boutons de la page ont changé : « Créer mon compte » (en haut et en bas, et dans la barre), « Se connecter », « Ouvrir Bola »"
);
verifier(/bouton=\{connecte \? BOUTONS_SFL\.ouvrir : BOUTONS_SFL\.creer\}/.test(page), "4 · la barre du haut ne porte plus « Créer mon compte » (ou « Ouvrir Bola »)");
verifier(
  /\{connecte \? \(\s*<Bouton bouton=\{BOUTONS_SFL\.ouvrir\}[^>]*\/>\s*\) : \(\s*<>\s*<Bouton bouton=\{BOUTONS_SFL\.creer\}[^>]*\/>\s*<Bouton bouton=\{BOUTONS_SFL\.connecter\}[^>]*\/>\s*<\/>\s*\)\}/.test(page),
  "4 · les boutons du haut et du bas ne sont plus « Créer mon compte » puis « Se connecter »"
);
const liens = [...page.matchAll(/href=(\{[^}]*\}|"[^"]*")/g)].map((m) => m[1]).sort();
assert.deepEqual(liens, ["{LIENS_SFL.app}", "{LIENS_SFL.confidentialite}", "{bouton.vers}"], `4 · les liens de la page ont changé : ${liens.join(" ")}`);
for (const f of [...SOURCES, INSTANTANE]) {
  verifier(!/https?:\/\//.test(lire(f)), `4 · ${f} écrit une adresse entière`);
  verifier(!/target=|window\.open|<a\s/.test(lire(f)), `4 · ${f} ouvre un lien hors de l'app`);
}
// L'entonnoir : la seule étape notée est « site », et pas pour un joueur connecté.
verifier(compte(/noterSite\(/g) === 1 && /if \(!getSession\(\)\) noterSite\("site"\);/.test(page), "4 · la page ne note plus sa visite à l'étape « site », pour un visiteur sans compte seulement");

// 5 · Les imports, par liste : ni Supabase, ni la saison, ni les joueurs.
const imports = (source: string) => [...source.matchAll(/^import\s[^;]*?from\s+"([^"]+)";/gm)].map((m) => m[1]).sort();
assert.deepEqual(
  imports(page),
  [
    "@/components/sfl/finitions-carte",
    "@/components/sfl/marques-carte",
    "@/hooks/use-session",
    "@/lib/sfl/auth/session",
    "@/lib/sfl/maillots",
    "@/lib/sfl/page-sfl",
    "@/lib/sfl/page-sfl-instantane",
    "@/lib/sfl/site-visites",
    "@/lib/utils",
    "lucide-react",
    "next/link",
    "react",
  ],
  "5 · la page importe autre chose que sa liste (une lecture de la saison, des joueurs, de la base ?)"
);
verifier(compte(/\bimport\b/g) === imports(page).length && !/\brequire\(|\bfetch\(|import\(/.test(page), "5 · la page charge quelque chose hors de ses imports");
assert.deepEqual(imports(lire(TEXTES)), ["./routes-publiques", "next"], "5 · les textes de la page importent autre chose que le type des métadonnées et l'adresse de la page");
assert.deepEqual(imports(lire(ROUTES)), [], "5 · les adresses ouvertes importent quelque chose");
assert.deepEqual(imports(lire(INSTANTANE)), [], "5 · l'instantané importe quelque chose : il ne tient que des données");
assert.deepEqual(imports(route), ["@/components/sfl/page-sfl/page-sfl", "@/lib/sfl/page-sfl", "next"], "5 · la route importe autre chose que la page et ses métadonnées");
for (const f of [ROUTE, PAGE, TEXTES, INSTANTANE])
  for (const interdit of ["useSeason", "useMyPlayer", "usePlayers", "supabase", "PlayerCard", "MiniCarte", "CarteDe", "photoParNom", "seedSaison", "BolaCard", "CartePhoto", "DosCarte", "carteNeutre", "Card3D"])
    verifier(!new RegExp(`\\b${interdit}\\b`).test(lire(f)), `5 · ${f} lit ${interdit}`);
// Les cartes : des images de l'instantané, posées par un seul composant ; aucune autre photo ni image.
verifier(!/\bphoto=|<Image\b|\.webp|\.jpe?g|\.png/.test(page), "5 · la page porte une photo ou une image hors de l'instantané");
verifier(compte(/<img\b/g) === 1 && /<img\s+src=\{image\.src\}\s+alt=\{image\.lue\}/.test(page), "5 · une image de la page ne vient pas de l'instantané (Carte)");

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

// L'instantané : chaque joueur montré est dans ACCORDS, et ACCORDS ne tient que les joueurs montrés.
interface Instantane {
  accords: readonly string[];
  compo: { camps: readonly { joueurs: readonly { nom: string; image: ImageCarte }[] }[] };
  carte: { nom: string; depart: ImageCarte; officielle: ImageCarte };
  podiums: readonly { places: readonly { nom: string; image: ImageCarte }[] }[];
  titres: { cartes: readonly { nom: string; petite: ImageCarte; complete: ImageCarte }[] };
}
const INST: Instantane = { accords: ACCORDS, compo: COMPO, carte: CARTE_MONTEE, podiums: PODIUMS, titres: TITRES };
/** Chaque carte de l'instantané : le nom du joueur et son image. */
const cartesDe = (i: Instantane) => [
  ...i.compo.camps.flatMap((c) => c.joueurs.map((j) => ({ nom: j.nom, image: j.image }))),
  { nom: i.carte.nom, image: i.carte.depart },
  { nom: i.carte.nom, image: i.carte.officielle },
  ...i.podiums.flatMap((p) => p.places.map((x) => ({ nom: x.nom, image: x.image }))),
  ...i.titres.cartes.flatMap((t) => [
    { nom: t.nom, image: t.petite },
    { nom: t.nom, image: t.complete },
  ]),
];
/** Ce qui cloche dans les noms d'un instantané (vide : rien). */
function fautesDeNoms(i: Instantane): string[] {
  const f: string[] = [];
  const accords = new Set(i.accords);
  const montres = new Set(cartesDe(i).map((c) => c.nom));
  for (const c of cartesDe(i)) {
    if (!accords.has(c.nom)) f.push(`6 · « ${c.nom} » est montré sans être dans ACCORDS`);
    if (!c.image.lue.startsWith(c.nom)) f.push(`6 · le texte de remplacement « ${c.image.lue} » ne nomme pas « ${c.nom} »`);
    if (!c.image.src.startsWith(`/sfl/cartes/${slug(c.nom)}-`)) f.push(`6 · l'image ${c.image.src} ne porte pas le nom de « ${c.nom} »`);
  }
  for (const a of accords) if (!montres.has(a)) f.push(`6 · « ${a} » est dans ACCORDS sans être montré`);
  if (accords.size !== i.accords.length) f.push("6 · un nom est deux fois dans ACCORDS");
  return f;
}
fautes.push(...fautesDeNoms(INST));
// La preuve par mutants : un joueur ajouté à un bloc, un nom de remplacement changé, une image d'un autre, un nom de trop.
const intrus = "Intrus";
const mutants: [string, Instantane][] = [
  ["un joueur de plus dans un podium", { ...INST, podiums: [{ places: [...INST.podiums[0].places, { nom: intrus, image: { ...INST.podiums[0].places[0].image, lue: intrus, src: `/sfl/cartes/${slug(intrus)}-d1.webp` } }] }, ...INST.podiums.slice(1)] }],
  ["un autre nom sur la carte qui monte", { ...INST, carte: { ...INST.carte, nom: intrus } }],
  ["le texte de remplacement d'un autre", { ...INST, titres: { cartes: INST.titres.cartes.map((t, k) => (k === 0 ? { ...t, complete: { ...t.complete, lue: `${intrus}, carte MVP` } } : t)) } }],
  ["l'image d'un autre", { ...INST, compo: { camps: INST.compo.camps.map((c, k) => (k === 0 ? { joueurs: c.joueurs.map((j, n) => (n === 0 ? { ...j, image: { ...j.image, src: `/sfl/cartes/${slug(intrus)}-compo.webp` } } : j)) } : c)) } }],
  ["un nom de trop dans ACCORDS", { ...INST, accords: [...INST.accords, intrus] }],
];
for (const [quoi, m] of mutants) assert.ok(fautesDeNoms(m).length > 0, `6 · le contrôle de l'instantané laisse passer : ${quoi}`);
// Hors des noms d'ACCORDS (et de leurs fichiers), aucun nom de l'effectif dans l'instantané.
let resteInstantane = lire(INSTANTANE);
for (const a of ACCORDS) resteInstantane = resteInstantane.split(a).join(" ").split(slug(a)).join(" ");
for (const nom of effectif) verifier(!motEntier(nom).test(resteInstantane), `6 · un nom de l'effectif hors d'ACCORDS dans ${INSTANTANE} : « ${nom} »`);
// Les règles de l'outil, sur des cas : qui passe, et le podium sans trou.
const oui: LigneJoueur = { nom: "a", affiche: "A", valide: true, joue: true, arbitre: false, horsApp: true, version: "2026-10-24", majeur: true };
verifier(empechement(oui, true) === null, "6 · un joueur avec l'accord, majeur, photo : refusé");
for (const [quoi, j, photo] of [
  ["sans accord", { ...oui, horsApp: false }, true],
  ["sans ligne d'accord", { ...oui, horsApp: null }, true],
  ["accord périmé", { ...oui, version: "2026-10-01" }, true],
  ["mineur", { ...oui, majeur: false }, true],
  ["sans date de naissance", { ...oui, majeur: null }, true],
  ["compte en attente", { ...oui, valide: false }, true],
  ["arbitre", { ...oui, arbitre: true }, true],
  ["membre qui ne joue pas", { ...oui, joue: false }, true],
  ["masqué", { ...oui, nom: "Sabri" }, true],
  ["place X1", { ...oui, nom: "X1" }, true],
  ["sans photo du studio", oui, false],
] as const)
  verifier(empechement(j as LigneJoueur, photo) !== null, `6 · empechement laisse passer un joueur ${quoi}`);
verifier(empechement(undefined, true) !== null, "6 · empechement laisse passer un compte parti");
const P = (nom: string, place: number) => ({ nom, place, points: 10 - place });
const avec = (...noms: string[]) => (n: string) => noms.includes(n);
verifier(pareil(podiumSansTrou([P("a", 1), P("b", 2), P("c", 3), P("d", 3)], avec("a", "b", "c")).map((x) => x.nom), ["a", "b"]), "6 · un 3e ex æquo sans accord ne coupe plus le podium");
verifier(pareil(podiumSansTrou([P("a", 1), P("b", 2), P("c", 3)], avec("a", "c")).map((x) => x.nom), ["a"]), "6 · le podium saute un 2e sans accord");
verifier(pareil(podiumSansTrou([P("a", 1), P("b", 1), P("c", 3), P("d", 4)], avec("a", "b", "c", "d")).map((x) => x.nom), ["a", "b", "c"]), "6 · le podium va au-delà de la 3e place");

// 7 · Les textes.
const INTERDITS = [
  "gratuit", "€", "euro", "prix", "abonnement", "cotisation", "App Store", "télécharge", "Ballon d", "prono", "pari", "Hippodrome", "Marcq",
  "12h30", "12 h 30", "arbitre", "mixte", "bêta", "SFL Time", "champion", "Il manque", "Flair", "carton", "coup d'envoi",
];
/** Un mot interdit, au début d'un mot (« champion » trouve aussi « championnat »). */
const debutDeMot = (mot: string) => new RegExp(`(?<![\\p{L}\\p{N}])${mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "iu");
const plat = (t: string) => t.replace(/ /g, " ").replace(/’/g, "'");
/** Les nombres de la page, chacun dans sa forme : tout autre chiffre est une faute. */
const NOMBRES = [/Match [12](?!\d)/g, /(?<![\p{L}\p{N}])D[123](?!\d)/gu, /(?<!\d)19 h(?!\p{L})/gu, /[+−][123](?!\d)/g, /© 2026(?!\d)/g, /(?<!\d)75(?!\d)/g];
/**
 * Les noms propres de la page, quand ils ne commencent pas une phrase : la
 * ville, la marque, les camps, les titres, les mots de l'app. Un lieu, un
 * prénom, un nom de plus sont des fautes.
 */
const NOMS_PROPRES = new Set([
  "Lille", "Sunday", "Five", "League", "SFL", "Bola", "Noirs", "Blancs", "Match", "Pépite", "Or", "MVP", "Impact", "Défensive", "Wall", "Fame", "Map",
  "D1", "D2", "D3",
]);
/** Un mot à capitale qui ne commence ni le texte ni une phrase (après un point, deux-points, un point médian, un guillemet ouvrant, une ligne). */
function nomsPropresDe(t: string): string[] {
  return [...t.matchAll(/\p{Lu}[\p{L}\p{N}]*/gu)]
    .filter((m) => {
      const avant = t.slice(0, m.index);
      return !(avant.trim() === "" || /[.:·«\n]\s*$/.test(avant) || /[\p{L}\p{N}]$/u.test(avant));
    })
    .map((m) => m[0]);
}
for (const t of textes) {
  verifier(!t.includes("!"), `7 · un point d'exclamation : « ${t} »`);
  verifier(!/\p{Extended_Pictographic}/u.test(t.replace(/©/g, "")), `7 · un émoji : « ${t} »`);
  verifier(!/'/.test(t), `7 · une apostrophe droite (le site écrit ’) : « ${t} »`);
  for (const mot of INTERDITS) verifier(!debutDeMot(mot).test(plat(t)), `7 · le mot « ${mot} » : « ${t} »`);
  const sansNombres = NOMBRES.reduce((reste, n) => reste.replace(n, ""), t);
  verifier(!/\d/.test(sansNombres), `7 · un nombre qui n'est pas de la page (75, 19 h, Match 1 et 2, D1 à D3, le barème, 2026) : « ${t} »`);
  for (const nom of nomsPropresDe(t)) verifier(NOMS_PROPRES.has(nom), `7 · un nom propre hors de la liste (un lieu, un prénom ?) : « ${nom} » dans « ${t} »`);
}
// La preuve que ces deux contrôles voient.
assert.deepEqual(nomsPropresDe("À Croix."), ["Croix"], "7 · le contrôle des noms propres ne trouve plus rien");
assert.deepEqual(nomsPropresDe("À toi de jouer.\nSur la Map : « Rejoindre la ligue »."), ["Map"]);
assert.ok(/\d/.test(NOMBRES.reduce((reste, n) => reste.replace(n, ""), "Coup d’envoi à 13 h.")), "7 · le contrôle des nombres ne trouve plus rien");
// Tout ce que la page montre vient de son fichier de textes : rien entre deux balises, rien en chaîne.
for (const m of page.matchAll(/>\s*([A-ZÀ-Ýa-zà-ÿ][^<>{}\n]{3,})\s*</g))
  verifier(false, `7 · un texte écrit dans le composant, hors de ${TEXTES} : « ${m[1].trim()} »`);
for (const m of page.matchAll(/(?<![=\w])\{\s*(["'`])((?:(?!\1).)*)\1\s*\}/g))
  verifier(false, `7 · un texte écrit en chaîne dans le composant, hors de ${TEXTES} : « ${m[2]} »`);
verifier(!/(aria-label|alt|title|placeholder)="/.test(page), `7 · un libellé écrit dans le composant, hors de ${TEXTES}`);
// Hors des classes, des commentaires et des imports, le composant n'écrit aucune phrase.
for (const m of sansCommentaires.matchAll(/"([^"\n]*[\p{Ll}]{3,}[  ][\p{L}][^"\n]*[.!?…])"/gu))
  verifier(false, `7 · une phrase écrite dans le composant, hors de ${TEXTES} : « ${m[1]} »`);

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
const [lundi, jusqua, vendredi, , dimanche] = SEMAINE_SFL.lignes;
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
// La convocation : elle part le lundi (la tâche planifiée), on y répond jusqu'au vendredi soir.
const crons = (JSON.parse(lire("vercel.json")) as { crons: { path: string; schedule: string }[] }).crons;
const convocation = crons.find((c) => c.path === "/api/convocation/cron");
verifier(lundi.jour === "Lundi" && convocation?.schedule.split(" ")[4] === "1", `8 · « ${lundi.jour} » : la convocation ne part plus le lundi (vercel.json : ${convocation?.schedule})`);
verifier(
  jusqua.jour === "Jusqu’à vendredi" && reponsesOuvertes(new Date("2026-11-13T21:30:00Z")) && !reponsesOuvertes(new Date("2026-11-13T23:30:00Z")),
  `8 · « ${jusqua.jour} » ne suit plus reponsesOuvertes (ouvertes le vendredi soir, closes le samedi)`
);
// La carte : 75 partout, comme celle d'un compte neuf.
const neutre = carteNeutre("x");
verifier(Object.values(neutre.stats).every((s) => s === CARTE_SFL.note), `8 · la carte neutre n'est plus à ${CARTE_SFL.note} partout`);
verifier(CARTE_SFL.phrases[0].includes(String(CARTE_SFL.note)), "8 · la phrase de la carte ne dit plus sa note de départ");

// Ce qui fait monter chaque stat : la saison rejouée par evoluer, un joueur seul, parti de la carte neutre.
const base = seedSaison();
/** Une saison d'un joueur : une ligne par dimanche. */
function saisonDe(dimanches: Partial<MatchEntry>[]): Saison {
  return {
    ...base,
    numero: 1,
    archives: [],
    convocations: [],
    events: [],
    journees: dimanches.map((_, i) => ({ j: i + 1, date: `${String(4 + 7 * i).padStart(2, "0")}/10/2026`, sflTime: false })),
    entries: dimanches.map((e, i) => ligne({ j: i + 1, result: "Nul", ...e })),
  };
}
const depart = (): Stats => ({ ...neutre.stats });
const joueur = (dimanches: Partial<MatchEntry>[]) => {
  const j = evoluer(saisonDe(dimanches), depart).joueurs.get("x");
  assert.ok(j, "8 · evoluer ne rend plus le joueur");
  return j;
};
/** Les stats qu'un dimanche fait monter, dans l'ordre. */
const statsDe = (dimanches: Partial<MatchEntry>[]) => joueur(dimanches).journal[0].faits.map((f) => f.stat);
assert.deepEqual(
  CARTE_SFL.lignes.map((l) => l.cle),
  ["but", "passe", "defensive", "impact", "mvp", "serie"],
  "8 · les gestes de la carte ont changé"
);
const GESTES: Record<(typeof CARTE_SFL.lignes)[number]["cle"], { geste: string; stats: string[] }> = {
  but: { geste: "Un but", stats: statsDe([{ buts: 1 }]) },
  passe: { geste: "Une passe décisive", stats: statsDe([{ passes: 1 }]) },
  defensive: { geste: "Défensive", stats: statsDe([{ def: true }]) },
  impact: { geste: "Impact", stats: statsDe([{ impact: true }]) },
  mvp: { geste: "MVP", stats: statsDe([{ mvp: true }]) },
  serie: { geste: "Trois dimanches de suite, à l’heure", stats: statsDe([{}, {}, {}]) },
};
for (const l of CARTE_SFL.lignes) {
  const code = GESTES[l.cle];
  verifier(l.geste === code.geste, `8 · le geste « ${l.geste} » a changé (attendu : « ${code.geste} »)`);
  if (l.cle === "mvp") verifier(code.stats.length === 2 && l.stat === "Tes deux meilleures", `8 · « ${l.geste} → ${l.stat} » ne suit plus evoluer (${code.stats.join(", ")})`);
  else verifier(code.stats.length === 1 && code.stats[0] === l.stat, `8 · « ${l.geste} → ${l.stat} » ne suit plus evoluer (${code.stats.join(", ") || "rien"})`);
}
// « Trois dimanches de suite, à l'heure » : la série du code, ni deux dimanches, ni un retard.
verifier(SERIE === 3, `8 · la série de présence n'est plus de trois dimanches (${SERIE}) : la page écrit « Trois »`);
verifier(statsDe([{}, {}]).length === 0, "8 · deux dimanches de suite font déjà monter une stat");
verifier(!joueur([{}, { retard: true }, {}]).journal.some((d) => d.faits.length > 0), "8 · un retard ne casse plus la série : la page écrit « à l’heure »");
// « Elle ne descend jamais. » : absences, retards, défaites, rien ne fait baisser une stat.
const mauvais = joueur([{ buts: 2, def: true }, { statut: "Absence injustifiée", result: null }, { retard: true, result: "Défaite" }, { statut: "Blessure", result: null }, { result: "Défaite" }, { retard: true }, { statut: "Absence injustifiée", result: null }, { result: "Défaite" }]);
verifier(
  STAT_KEYS.every((k) => mauvais.officielles[k] >= neutre.stats[k]) && mauvais.majs.every((m) => STAT_KEYS.every((k) => m.stats[k] >= neutre.stats[k])),
  "8 · une stat est descendue sous son départ : la page écrit « Elle ne descend jamais. »"
);
// Les titres : le MVP se lit sur la feuille, les deux autres se votent.
assert.deepEqual(TITRES_SFL.cartes.map((c) => c.edition), ["mvp", ...CATEGORIES_VOTE], "8 · les titres de la page ne sont plus le MVP et les deux titres votés (CATEGORIES_VOTE)");
assert.deepEqual(TITRES_SFL.cartes.map((c) => c.nom), ["MVP", "Impact", "Défensive"]);
// La fin de saison : les classements du code, dans leur ordre.
const NOMS_CLASSEMENTS: Record<string, string> = { pepite: "Pépite d’Or", buteur: "Buteurs", passeur: "Passeurs", defenseur: "Défenseurs", mvp: "MVP" };
verifier(
  TITRES_SFL.saison.phrases[0] === `${CLASSEMENTS.map((c) => NOMS_CLASSEMENTS[c.id] ?? `?${c.id}`).join(". ")}.`,
  `8 · « ${TITRES_SFL.saison.phrases[0]} » ne suit plus les classements de fin de saison (${CLASSEMENTS.map((c) => c.id).join(", ")})`
);
// Les divisions du code.
assert.deepEqual([...CLASSEMENT_SFL.divisions], DIVISIONS.map(nomDivision), "8 · les divisions de la page ne sont plus celles du code");
assert.deepEqual([...DIMANCHE_SFL.camps], ["Noirs", "Blancs"]);

// Les phrases de règle que le code ne sait pas dire : figées. En changer une,
// c'est la relire contre la règle (la mémoire du projet), puis la recopier ici.
const FIGEES: [string, readonly string[], string[]][] = [
  ["la semaine", SEMAINE_SFL.lignes.map((l) => `${l.jour}${l.heure ? ` ${l.heure}` : ""} : ${l.phrase}${l.pastille ? ` [${l.pastille}]` : ""}`), [
    "Lundi : La convocation arrive.",
    "Jusqu’à vendredi : Une réponse, une seule. [Je viens]",
    "Vendredi 19 h : Tu découvres ton équipe.",
    "Dimanche : Tu joues.",
    "Dimanche 19 h : Points, classement, divisions, titres.",
  ]],
  ["le dimanche", DIMANCHE_SFL.phrases, ["Match 1, Match 2.", "Chacun son heure, son lieu, son terrain.", "Les équipes se font seules.\nÉquilibrées.", "La feuille de match se tient en direct."]],
  ["la carte", CARTE_SFL.phrases, ["Elle part à 75.", "Elle ne descend jamais."]],
  ["le classement", CLASSEMENT_SFL.phrases, ["Refaites chaque dimanche par le classement.", "Chaque division a son premier.", "La D1 joue le Match 1."]],
  ["les titres", TITRES_SFL.phrases, ["Le MVP ne se vote pas.\nIl se lit sur la feuille de match.", "Un Impact et une Défensive par équipe.\nL’équipe d’en face vote."]],
  ["la fin de saison", TITRES_SFL.saison.phrases, ["Pépite d’Or. Buteurs. Passeurs. Défenseurs. MVP.", "Les trois premiers gardent leur écusson.\nPour toujours.", "Chaque saison reste au Wall of Fame."]],
  ["le chemin", FIN_SFL.etapes, ["Crée ta carte.", "Sur la Map : « Rejoindre la ligue ».", "La ligue te répond."]],
  ["le barème", CLASSEMENT_SFL.bareme.map((t) => t.libelle), ["Tu viens.", "Tu gagnes.", "Un but.", "Une passe décisive.", "Clean sheet.", "MVP.", "En retard.", "Absent sans prévenir."]],
];
for (const [quoi, ecrites, figees] of FIGEES)
  verifier(pareil([...ecrites], figees), `8 · une phrase de règle a changé (${quoi}) : la relire contre la règle, puis la recopier dans FIGEES\n      écrit : ${JSON.stringify(ecrites)}`);

// 9 · Le sigle et l'aperçu du lien.
const svg = lire("public/bola/sfl.svg");
verifier(svg === sigleSfl(), "9 · public/bola/sfl.svg n'est plus celui de tools/sigle-sfl.ts (retouché à la main ?)");
const trace = / d="([^"]+)"/.exec(svg)?.[1];
verifier(!!trace && sigleSerre().d === trace, "9 · le tracé des exports n'est plus celui de public/bola/sfl.svg");
verifier(
  !!trace && composer({ nom: "x", l: 1080, h: 1080, fond: "#08090B", sigle: "#F4F5F2", largeur: 702 }).includes(` d="${trace}"`),
  "9 · une image exportée ne reprend plus le tracé tel quel"
);
verifier(/url\(\/bola\/sfl\.svg\)/.test(page), "9 · le sigle du haut de la page n'est plus le fichier du générateur");
/**
 * L'empreinte de src/app/sfl/opengraph-image.png, telle que l'écrit
 * « tools/sigle-sfl-exports.ts --apercu-lien » (qui l'affiche) : le sigle seul,
 * papier sur encre, à 480 px. Une autre image à cette place est une faute.
 */
const EMPREINTE_APERCU = "32aa2eddea0fcc88043b91f046df1725de02f3bb80a481d036eba07c83354ab1";
verifier(existsSync(APERCU_LIEN), "9 · l'aperçu du lien (opengraph-image.png) manque");
if (existsSync(APERCU_LIEN)) {
  const png = readFileSync(APERCU_LIEN);
  verifier(png.subarray(1, 4).toString("latin1") === "PNG", "9 · l'aperçu du lien n'est pas un PNG");
  verifier(png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630, `9 · l'aperçu du lien fait ${png.readUInt32BE(16)} × ${png.readUInt32BE(20)}, pas 1200 × 630`);
  verifier(png.length < 300_000, `9 · l'aperçu du lien pèse ${png.length} octets (300 ko au plus)`);
  verifier(empreinte(png) === EMPREINTE_APERCU, "9 · l'aperçu du lien n'est plus l'image écrite par tools/sigle-sfl-exports.ts --apercu-lien (la refaire, puis recopier son empreinte)");
}
const autour = readdirSync(join(RACINE, "src/app/sfl")).sort();
assert.deepEqual(autour, ["opengraph-image.alt.txt", "opengraph-image.png", "page.tsx"], `9 · le dossier de la route a changé : ${autour.join(", ")}`);
verifier(existsSync(join(RACINE, ALT)) && lire(ALT).trim() === META_SFL.image, "9 · le texte de remplacement de l'aperçu manque ou ne suit plus META_SFL.image");

// 10 · Hors de l'app hôte (le navigateur d'Instagram), le guide rouvre la page affichée, avec la source d'arrivée.
for (const [href, chemin, source, attendu] of [
  // Venu de /sfl par « Créer mon compte » : la page a changé avant l'adresse.
  ["https://getbola.app/sfl", "/inscription", "l.instagram.com", "https://getbola.app/inscription?utm_source=l.instagram.com"],
  ["https://getbola.app/sfl?utm_source=instagram", "/inscription", "instagram", "https://getbola.app/inscription?utm_source=instagram"],
  ["https://getbola.app/", "/connexion", null, "https://getbola.app/connexion"],
  // La page de l'adresse : sa suite est gardée ; une source déjà écrite reste.
  ["https://getbola.app/p/ABC123?x=1", "/p/ABC123", "snapchat.com", "https://getbola.app/p/ABC123?x=1&utm_source=snapchat.com"],
  ["https://getbola.app/inscription?parrain=ABC123&utm_source=snap", "/inscription", "instagram", "https://getbola.app/inscription?parrain=ABC123&utm_source=snap"],
  ["https://getbola.app/inscription?parrain=ABC123", null, null, "https://getbola.app/inscription?parrain=ABC123"],
] as const)
  verifier(adresseSortie(href, chemin, source).href === attendu, `10 · adresseSortie(${href}, ${chemin}, ${source}) rend ${adresseSortie(href, chemin, source).href}, pas ${attendu}`);
verifier(
  lienSortie(adresseSortie("https://getbola.app/sfl", "/inscription", "instagram"), "ios") === "x-safari-https://getbola.app/inscription?utm_source=instagram",
  "10 · le lien « Ouvrir dans Safari » ne porte plus la page affichée et la source"
);
const guide = lire("src/components/pwa/guide-installation.tsx");
verifier(
  /const sortie = adresseSortie\(window\.location\.href, pathname, sourceArrivee\(\)\);/.test(guide) &&
    /const lien = lienSortie\(sortie, env\.systeme\);/.test(guide) &&
    /const lien = sortie\.href;/.test(guide) &&
    (guide.match(/window\.location\.href/g) ?? []).length === 1,
  "10 · le guide d'installation ne rouvre plus la page affichée avec la source d'arrivée (bouton et lien copié)"
);

// 11 · L'instantané : les images, la lecture, les règles des blocs.
const images = cartesDe(INST).map((c) => c.image);
/** La largeur et la hauteur d'un WebP (VP8X, VP8L ou VP8), lues dans son en-tête. */
function tailleWebp(b: Buffer): [number, number] | null {
  if (b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 8, 12) !== "WEBP") return null;
  const bloc = b.toString("latin1", 12, 16);
  if (bloc === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (bloc === "VP8L") {
    const v = b.readUInt32LE(21);
    return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)];
  }
  if (bloc === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  return null;
}
const servis = new Set(images.map((i) => i.src));
verifier(servis.size === images.length, "11 · deux cartes de l'instantané partagent une image");
let poids = 0;
for (const i of images) {
  const f = join(RACINE, "public", i.src);
  if (!existsSync(f)) {
    verifier(false, `11 · l'image ${i.src} manque`);
    continue;
  }
  const b = readFileSync(f);
  poids += b.length;
  verifier(empreinte(b) === i.sha256, `11 · ${i.src} n'est plus l'image écrite par l'outil (empreinte)`);
  verifier(b.length === i.octets && b.length <= 160_000, `11 · ${i.src} pèse ${b.length} octets (écrit : ${i.octets}, 160 ko au plus)`);
  verifier(pareil(tailleWebp(b), [i.largeur, i.hauteur]), `11 · ${i.src} ne fait pas ${i.largeur} × ${i.hauteur} (WebP)`);
}
verifier(poids <= 1_500_000, `11 · les cartes pèsent ${poids} octets (1,5 Mo au plus)`);
const fichiers = existsSync(join(RACINE, CARTES)) ? readdirSync(join(RACINE, CARTES)) : [];
for (const f of fichiers) verifier(servis.has(`/sfl/cartes/${f}`), `11 · ${CARTES}/${f} n'est cité par aucune carte (orphelin)`);
const texteInstantane = lire(INSTANTANE);
verifier(!/@/.test(texteInstantane), "11 · l'instantané écrit un « @ » (une adresse ?)");
verifier(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(texteInstantane), "11 · l'instantané écrit un identifiant de compte");
verifier(!/pseudo|username|naissance|user_id/i.test(texteInstantane.replace(/^\/\/.*$/gm, "")), "11 · l'instantané écrit un pseudo, une date de naissance ou un compte");
const lu = Date.parse(LU_LE);
verifier(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(LU_LE) && lu <= Date.now(), `11 · la date de lecture (${LU_LE}) manque ou est dans le futur`);
// Les règles des blocs.
const noteOk = (n: number) => Number.isInteger(n) && n >= 40 && n <= 99;
verifier(pareil(COMPO.camps.map((c) => c.camp), ["Noirs", "Blancs"]) && COMPO.camps.every((c) => c.joueurs.length === 5), "11 · la compo n'est plus Noirs contre Blancs, cinq contre cinq");
verifier(new Set(COMPO.camps.flatMap((c) => c.joueurs.map((j) => j.nom))).size === 10, "11 · un joueur est deux fois dans la compo");
verifier(COMPO.camps.every((c) => Number.isInteger(c.score) && c.score >= 0 && c.joueurs.every((j) => noteOk(j.note))), "11 · un score ou une note de la compo n'est pas plausible");
for (const m of [COMPO, TITRES])
  verifier(Number.isInteger(m.journee) && m.journee >= 1 && Number.isInteger(m.match) && m.match >= 1 && /^\d{1,2} [a-zéû]+\.?$/.test(m.date), `11 · la journée « J${m.journee} · ${m.date} · Match ${m.match} » n'est pas lisible`);
verifier(CARTE_MONTEE.a > CARTE_MONTEE.de && noteOk(CARTE_MONTEE.a) && noteOk(CARTE_MONTEE.de), "11 · la carte montrée ne monte pas");
verifier(pareil(PODIUMS.map((p) => p.division), ["D1", "D2", "D3"]), "11 · les podiums ne sont plus D1, D2, D3");
for (const p of PODIUMS) {
  // Pas de trou : la première place est 1, puis chaque place suit le nombre de joueurs devant.
  const ok = p.places.every((x, k) => x.place <= 3 && x.place === (k === 0 ? 1 : p.places[k - 1].place === x.place ? x.place : k + 1));
  verifier(ok && p.places.every((x, k) => Number.isInteger(x.points) && x.points >= 0 && (k === 0 || x.points <= p.places[k - 1].points)), `11 · le podium ${p.division} a un trou, ou ses points ne descendent pas`);
}
const editions = TITRES.cartes.map((c) => c.edition);
verifier(new Set(editions).size === editions.length && editions.every((e) => ["mvp", "impact", "def"].includes(e)), "11 · un titre est deux fois, ou n'est pas MVP, Impact, Défensive");
verifier(new Set(TITRES.cartes.map((c) => c.nom)).size === TITRES.cartes.length && TITRES.cartes.every((c) => noteOk(c.note)), "11 · deux titres au même joueur, ou une note pas plausible");

assert.equal(fautes.length, 0, `\n${fautes.join("\n")}`);
console.log(`page-sfl : ok (${textes.length} textes, ${effectif.length} noms cherchés, ${dossiers.length} adresses essayées à la porte, ${CLASSEMENT_SFL.bareme.length} points du barème, ${CARTE_SFL.lignes.length} gestes rejoués, ${ACCORDS.length} joueurs et ${images.length} images dans l'instantané, ${mutants.length} mutants refusés)`);
