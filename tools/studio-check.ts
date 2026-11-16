// Bola Studio dans Bola Plus (14/11/2026, bola-app#22 ; lib/sfl/studio.ts,
// components/sfl/studio-bola.tsx).
//   1 · le catalogue : douze templates, dans l'ordre de la demande, aux noms,
//       rendus et prix exacts (prix proposés, affichés tels quels) ; ids
//       uniques ; prix entiers positifs ; « Option HD » est un supplément
//       (« +399 ⚽ », « +5 s ») ; les durées s'écrivent « Image », « 5 s »… ;
//       le modèle et les crédits ne sont jamais à l'écran ;
//   2 · la phrase « 300 ⚽ = un trash talk ou six images » : calculée, et
//       juste, contre des attendus écrits à la main (accord « un » / « une »,
//       aucune quantité nulle, jamais lettres et chiffres mêlés ; rien ne
//       tient : une erreur) ; les ballons des deux formules ;
//   3 · les recharges : centimes entiers, jamais moins de ballons que le taux
//       de base (lib/sfl/ballons.ts, BALLONS_PAR_EURO), et le bonus de chacune
//       (1, 101, 401 ballons) ; plus chère, plus généreuse ;
//   4 · une seule source : aucun prix, aucun nombre de ballons écrit dans
//       l'écran ; aucun paiement, aucun porte-monnaie, aucun réseau dans les
//       fichiers du studio ; aucun prestataire nommé ;
//   5 · les vignettes (retours du 15/11 et du 16/11 : les vraies images des
//       douze modèles) : douze templates, douze fichiers dans
//       public/bola-plus/studio/, dans l'ordre du catalogue (chaque fichier
//       porte le rang et le nom de son modèle), en 3:4 (1100 × 1470 : les
//       images fournies le 16/11 au soir, en Seedream 5.0 Pro, en couleur,
//       réduites à la largeur de la fiche en grand sur un iPhone × 3), et pour
//       chacun sa copie légère (« -660 », 660 × 882 : les proportions de
//       l'original, 110:147, au pixel) ; du WebP, léger ; rien d'autre dans
//       le dossier. Et ce sont CES images :
//       l'empreinte de chacun des vingt-quatre fichiers est écrite ici
//       (EMPREINTES) ; deux fichiers échangés, un fichier teint, retouché ou
//       recodé arrêtent le banc (tools/studio-vignettes.py les refait et
//       affiche leurs empreintes).
//       L'écran les montre dans une boîte en 4:5 (jamais carrée), qui les
//       recadre en haut (cover, object-position 50 % 30 %, rien d'autre ;
//       Sabri, 16/11 à 19:20), l'image ni grossie, ni déformée, ni teinte (aucune fusion, aucun
//       filtre, aucune couleur de Bola Plus dessus), ni animée ; et cela où
//       que la règle soit écrite : les règles de la feuille qui nomment une
//       vignette sont une liste fermée, les propriétés de sa boîte aussi,
//       l'image n'a qu'une règle, tout ce qui peut teinter, déformer ou
//       découper dans la feuille est écrit ici, aucune couleur n'y est
//       nommée, aucune variable n'y est définie ; dans l'écran, aucune classe
//       qui teinte, recadre ou déforme, aucun style sur une vignette.
//       L'image est décorative (alt vide), chargée à l'approche (lazy), à sa
//       taille (srcset ; le cadre du rail est la largeur d'un template dans
//       la feuille) ; le voile sous la légende est noir ; la légende ne
//       descend pas sous 11 px et garde une taille sans unités de conteneur.
//       La fiche : la vignette et ses deux lignes dans une colonne, bornée à
//       ce qui tient dans la feuille à toute hauteur d'écran (elle ne défile
//       pas) ; sous l'original, sa copie légère, aux mêmes proportions (pas
//       de cadre noir, et rien ne bouge quand il la recouvre). Plus aucune
//       vignette composée : ni carte « Toi », ni visuel de Bola Plus recadré.
//       Le rail s'accroche au doigt ; dans la feuille, aucune teinte écrite :
//       les couleurs de Bola Plus passent par les variables --bp-plus-*
//       (PALETTE) ; avec « Réduire les animations », aucune transition
//       (l'appui se marque d'un coup) ;
//   6 · ce qui se voit et se lit : rien de caché (hidden, sr-only…) dans
//       l'écran du studio ; les mots écrits en dur sont une liste fermée (ni
//       texte d'aide ni sous-titre) ; la vignette porte le nom et le prix
//       (la légende), le rail montre dessous ce que tu reçois et la durée,
//       la feuille aussi ; la légende se lit (jamais aria-hidden), le
//       bouton d'un template n'a pas d'aria-label (son texte se lit en
//       entier) ; une recharge montre ses ballons (pas ses centimes) et son
//       prix, sans geste ni focus ;
//   7 · le raccord au carrousel Bola Plus (14/11) : « Ton studio » est un
//       seul bouton (l'éventail des trois templates d'EVENTAIL_STUDIO, la
//       carte en vrai au milieu, la seule à porter sa légende ; « Bola
//       Studio » et le nombre), qui se lit « Bola Studio » (pas d'aria-label ;
//       l'éventail et le nombre sont décoratifs) et ouvre le panneau ; sous
//       le titre, les ballons du mois ; le panneau porte la phrase, le rail
//       des douze et les recharges, et pousse la fiche d'un template dans la
//       même feuille ; le panneau et la fiche reçoivent les couleurs de PALETTE ;
//   8 · toi, dedans (16/11, bola-app#22 : « il faut bien faire comprendre que
//       l'user pourra générer ces templates avec sa propre personne ») : le
//       sous-titre du panneau est « Avec ta photo. 300 ⚽ = un trash talk ou
//       six images » (AVEC_TA_PHOTO, puis PHRASE_INCLUS : l'écran compose
//       le sous-titre) ; la photo de ta carte, en pastille
//       ronde, est en haut à gauche de chaque vignette du rail (pas sur
//       l'éventail), et au bas de la fiche, ta photo → ton image (la photo,
//       une flèche, la vignette en petit, sans un mot) ; cette photo vient du
//       chemin de la carte (useMyPlayer puis usePhotoPerso, comme PlayerCard
//       pour BolaCard) : ni usePlayerPhoto (son repli /players/… n'existe
//       plus : une image cassée), ni une autre adresse (une requête de plus) ;
//       sans photo, ou si elle ne se charge pas, l'initiale (le repli du
//       portrait de la carte) ; la pastille est décorative ; dans la feuille,
//       elle est ronde, cerclée de blanc, sans teinte ; la fiche se borne
//       aussi à cette ligne de plus, jamais sous un plancher (un téléphone
//       tenu en largeur) qui ne change rien en hauteur jusqu'au 320 × 568.
//   Des mutants sont rejoués : chaque garde doit les refuser (pour la raison
//   dite, quand elle est écrite) ; un mutant dont le texte à changer n'est
//   plus dans la source arrête le banc (SansPrise).
//   npx tsx tools/studio-check.ts
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BALLONS_PAR_EURO } from "../src/lib/sfl/ballons";
import { CARTE_TOI, PALETTE, VARIABLES_PLUS } from "../src/lib/sfl/bola-plus";
import {
  BALLONS_FORMULE,
  BALLONS_PAR_MOIS,
  MENTION_STUDIO,
  OFFERTS_ANNUEL,
  PHRASE_INCLUS,
  AVEC_TA_PHOTO,
  RECHARGES_STUDIO,
  TEMPLATES,
  VIGNETTE,
  ballons,
  bonusDe,
  dureeDe,
  equivalence,
  fichierVignette,
  hauteurVignette,
  prixDe,
  prixRecharge,
  sourcesVignette,
  EVENTAIL_STUDIO,
  template,
  type RechargeStudio,
  type Template,
} from "../src/lib/sfl/studio";

const NB = " ";
const FIN = " ";

// 1 · Le catalogue de la demande, tel quel.
const DEMANDE: [string, string, string, number][] = [
  ["Ma carte en vrai", "Image", "49", 49],
  ["Maillot à ton nom", "Image", "49", 49],
  ["La Une du dimanche", "Image", "79", 79],
  ["L'affiche du match", "Image", "99", 99],
  ["La célébration", `5${NB}s`, "199", 199],
  ["Trash talk", `5${NB}s`, "299", 299],
  ["Sorti de la carte", `5${NB}s`, "299", 299],
  ["Option HD", `+5${NB}s`, "+399", 399],
  ["Ta saison", `15${NB}s`, "499", 499],
  ["L'entrée", `10${NB}s`, "599", 599],
  ["Le but de ta journée", `10${NB}s`, "599", 599],
  ["Convocation d'équipe", `10${NB}s`, "599", 599],
];
const catalogueJuste = (liste: readonly Template[]) => {
  assert.equal(liste.length, 12, "douze templates");
  assert.deepEqual(
    liste.map((t) => [t.nom, dureeDe(t), prixDe(t).replace(`${NB}⚽`, ""), t.prix]),
    DEMANDE,
    "les noms, les rendus et les prix de la demande, dans l'ordre"
  );
  assert.equal(new Set(liste.map((t) => t.id)).size, liste.length, "des ids uniques");
  for (const t of liste) {
    assert.ok(Number.isInteger(t.prix) && t.prix > 0, `${t.nom} : un prix entier positif`);
    assert.ok(t.recoit.length > 0 && t.recoit.length <= 64, `${t.nom} : ce que le joueur reçoit, en une ligne`);
    assert.ok(!/\d/.test(t.recoit.replace("720p", "")), `${t.nom} : pas de chiffre dans la ligne (sauf 720p)`);
    if (t.rendu.genre === "video") assert.ok(Number.isInteger(t.rendu.secondes) && t.rendu.secondes > 0, `${t.nom} : une durée`);
    assert.ok(t.credits === null || (Number.isInteger(t.credits) && t.credits > 0), `${t.nom} : des crédits entiers, ou à recopier`);
  }
  assert.deepEqual(liste.filter((t) => t.supplement).map((t) => t.id), ["option-hd"], "seule l'option HD est un supplément");
};
catalogueJuste(TEMPLATES);
assert.equal(prixDe(TEMPLATES[7]), `+399${NB}⚽`);
assert.equal(ballons(1000), `1${FIN}000`);
assert.throws(() => ballons(1.5));

// 2 · Les ballons du mois.
assert.equal(BALLONS_PAR_MOIS, 300);
assert.equal(OFFERTS_ANNUEL, 1000);
assert.equal(PHRASE_INCLUS, `300${NB}⚽ = un trash talk ou six images`);
// Le sous-titre du panneau, mot pour mot (Sabri, 16/11), tel que l'écran le compose (« Avec ta photo. » sur sa ligne,
// un espace, puis la phrase calculée : la composition elle-même est lue dans l'écran, ecranJuste).
assert.equal(AVEC_TA_PHOTO, "Avec ta photo.");
assert.equal(`${AVEC_TA_PHOTO} ${PHRASE_INCLUS}`, `Avec ta photo. 300${NB}⚽ = un trash talk ou six images`, "le sous-titre : « Avec ta photo. », puis la phrase calculée");
// Les attendus, écrits à la main (prix du catalogue : trash talk 299, image la moins chère 49).
const PHRASES: [number, string][] = [
  [49, "une image"],
  [98, "deux images"],
  [299, "un trash talk ou six images"],
  [300, "un trash talk ou six images"],
  [598, "deux trash talks ou douze images"],
  [600, "deux trash talks ou douze images"],
  [637, "2 trash talks ou 13 images"],
  [1000, "3 trash talks ou 20 images"],
];
const phraseJuste = (phrase: (budget: number, c: readonly Template[]) => string) => {
  for (const [budget, attendu] of PHRASES) assert.equal(phrase(budget, TEMPLATES), attendu, `${budget} ballons`);
  // Rien ne tient : ce n'est pas une phrase, c'est une erreur.
  for (const budget of [0, 48]) assert.throws(() => phrase(budget, TEMPLATES), `${budget} ballons ne paient rien`);
};
phraseJuste(equivalence);
assert.deepEqual(BALLONS_FORMULE, { mensuel: `300${NB}⚽ / mois`, annuel: `300${NB}⚽ / mois + 1${FIN}000${NB}⚽${NB}offerts` }, "« offerts » ne part pas seul à la ligne");
// L'éventail de « Ton studio » : trois templates différents du catalogue ; au milieu, la carte en vrai,
// la seule vignette entière (les deux autres, à demi cachées, ne montrent que leur image).
const eventailJuste = (ids: readonly string[]) => {
  assert.equal(ids.length, 3, "trois templates en éventail");
  assert.equal(new Set(ids).size, 3, "trois templates différents");
  assert.equal(ids[1], "carte-en-vrai", "la carte en vrai au milieu");
  for (const id of ids) assert.ok(TEMPLATES.some((t) => t.id === id), `${id} : un template du catalogue`);
};
eventailJuste(EVENTAIL_STUDIO);
assert.throws(() => template("absent"), "un template inconnu est refusé");
assert.equal(ballons(1100, NB), `1${NB}100`, "en Anton : l'espace large");
assert.equal(MENTION_STUDIO, BALLONS_FORMULE.mensuel);

// 3 · Les recharges.
const rechargesJustes = (liste: readonly RechargeStudio[]) => {
  assert.deepEqual(liste.map((r) => [prixRecharge(r), r.ballons]), [["4,99", 500], ["9,99", 1100], ["19,99", 2400]], "les trois recharges de la demande");
  let avant = 0;
  for (const r of liste) {
    assert.ok(Number.isInteger(r.centimes) && Number.isInteger(r.ballons), "des entiers");
    assert.ok(r.ballons >= (r.centimes * BALLONS_PAR_EURO) / 100, `${prixRecharge(r)} € : jamais sous le taux de base`);
    const part = bonusDe(r) / r.ballons;
    assert.ok(part > avant, `${prixRecharge(r)} € : plus chère, plus généreuse`);
    avant = part;
  }
};
rechargesJustes(RECHARGES_STUDIO);
assert.equal(BALLONS_PAR_EURO, 100, "1 ballon = 1 centime");
assert.deepEqual(RECHARGES_STUDIO.map(bonusDe), [1, 101, 401], "le bonus de chaque recharge");

// 4 · Une seule source ; ni paiement, ni porte-monnaie, ni réseau.
const SRC = join(__dirname, "..", "src");
const lire = (f: string) => readFileSync(join(SRC, f), "utf8");
const sansNotes = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const ecran = lire("components/sfl/studio-bola.tsx");
const page = lire("components/sfl/bola-plus.tsx");
const feuille = lire("components/sfl/studio-bola.css");
const source = lire("lib/sfl/studio.ts");
const NOMBRES = /(?<![\w.[-])(49|79|99|199|299|399|499|599|300|1000|1100|2400|500|499|999|1999)(?![\w\]%])|\d+\s*(⚽|&nbsp;⚽)|(?<![\w.,])1(?:[\s\u00a0\u202f]|&nbsp;)000(?![\w\]%])|4,99|9,99|19,99/;
const uneSource = (nom: string, t: string, nombres: RegExp = NOMBRES) => {
  const code = sansNotes(t).replace(/\[[\d.]+(px|em|%)?\]/g, "").replace(/-\[[^\]]*\]/g, "");
  const trouve = nombres.exec(code);
  assert.equal(trouve, null, `${nom} écrit un prix ou des ballons en dur : ${trouve?.[0]}`);
};
uneSource("studio-bola.tsx", ecran);
// La page Bola Plus a deux chiffres à elle, retirés mot pour mot (et seulement ceux-là) : la lune de l'emblème
// (300 / 236, une proportion du dos de la carte) et la taille du logo (1000 × 237). Les stats de « Toi » sont
// dans CARTE_TOI (lib/sfl/bola-plus.ts). Tout le reste passe par NOMBRES, le même garde que l'écran du studio.
const NEUTRES_PAGE = ["const LUNE = (300 / 236) * ROSACE.r1;", "width={1000} height={237}"];
for (const n of NEUTRES_PAGE) assert.equal(page.split(n).length, 2, `la page porte une fois et une seule : ${n}`);
const pageSansLune = NEUTRES_PAGE.reduce((t, n) => t.replace(n, ""), page);
uneSource("bola-plus.tsx", pageSansLune);
const INTERDIT = /stripe|paypal|checkout|apple ?pay|google ?pay|carte bancaire|klarna|higgsfield|magnific|fetch\(|supabase|localStorage|spendBallons|addBallons|getBalance|acheter|payer/i;
const propre = (nom: string, t: string) => {
  const trouve = INTERDIT.exec(sansNotes(t));
  assert.equal(trouve, null, `${nom} : ${trouve?.[0]}`);
};
propre("studio-bola.tsx", ecran);
propre("studio.ts", source);
// Le modèle et les crédits ne vont jamais à l'écran.
assert.ok(!/\.(modele|credits)\b/.test(ecran) && !/\.(modele|credits)\b/.test(page), "le modèle et les crédits restent hors de l'écran");
// Le studio est montré : rien dans l'écran ne débite ni n'achète ; la feuille n'a pas de bouton.
const fiche = ecran.slice(ecran.indexOf("function FicheTemplate("), ecran.indexOf("\n}\n", ecran.indexOf("function FicheTemplate(")));
assert.ok(fiche && !/<button|onClick/.test(fiche), "la fiche d'un template : aucun bouton");
const recharges = ecran.slice(ecran.indexOf("export function RechargesStudio("));
assert.ok(!/<button|onClick|href=/.test(recharges) && /Bientôt/.test(recharges), "les recharges : « Bientôt », sans geste");
assert.ok(/\{AVEC_TA_PHOTO\}<\/span> \{PHRASE_INCLUS\}/.test(ecran) && /TEMPLATES\.map\(/.test(ecran), "le rail lit la source");
assert.ok(/const EVENTAIL = EVENTAIL_STUDIO\.map\(template\);/.test(ecran), "l'éventail lit la source");

// 5 · Les vignettes : douze templates, douze images, dans l'ordre du catalogue, en 3:4, montrées en 4:5.
const PUBLIC = join(__dirname, "..", "public");
const DOSSIER_STUDIO = join(PUBLIC, "bola-plus", "studio");
/** La taille d'un WebP, lue dans son en-tête (VP8X, VP8 ou VP8L) : sans dépendance. */
const tailleWebp = (o: Buffer) => {
  assert.ok(o.length > 30 && o.subarray(0, 4).toString("latin1") === "RIFF" && o.subarray(8, 12).toString("latin1") === "WEBP", "du WebP (en-tête RIFF…WEBP)");
  const genre = o.subarray(12, 16).toString("latin1");
  if (genre === "VP8X") return { largeur: 1 + o.readUIntLE(24, 3), hauteur: 1 + o.readUIntLE(27, 3) };
  if (genre === "VP8 ") return { largeur: o.readUInt16LE(26) & 0x3fff, hauteur: o.readUInt16LE(28) & 0x3fff };
  if (genre === "VP8L") {
    const b = o.readUInt32LE(21);
    return { largeur: (b & 0x3fff) + 1, hauteur: ((b >> 14) & 0x3fff) + 1 };
  }
  throw new Error(`WebP inconnu : ${genre}`);
};
/** Le nom d'un modèle en nom de fichier : « L'affiche du match » → « l-affiche-du-match ». */
const enFichier = (nom: string) =>
  nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
assert.equal(enFichier("L'affiche du match"), "l-affiche-du-match");
assert.equal(enFichier("Le but de ta journée"), "le-but-de-ta-journee");
/** Les deux largeurs d'une vignette : l'original et sa copie légère ; le poids permis à chacune, en octets. */
const LARGEURS_VIGNETTE = [VIGNETTE.largeur, VIGNETTE.legere] as const;
const POIDS_VIGNETTE: Record<number, number> = { [VIGNETTE.largeur]: 150_000, [VIGNETTE.legere]: 70_000 };
assert.deepEqual(
  { ...VIGNETTE },
  { rapport: 5 / 4, fichier: { largeur: 110, hauteur: 147 }, largeur: 1100, legere: 660 },
  "des vignettes en 4:5 à l'écran, des fichiers en 3:4 (110:147) : 1100 px, et 660 px pour le rail",
);
assert.deepEqual([hauteurVignette(VIGNETTE.largeur), hauteurVignette(VIGNETTE.legere)], [1470, 882], "les hauteurs des fichiers, au pixel : 1470 et 882");
type Lecteur = (adresse: string) => Buffer | null;
const surDisque: Lecteur = (adresse) => (existsSync(join(PUBLIC, adresse)) ? readFileSync(join(PUBLIC, adresse)) : null);
/**
 * L'empreinte (sha256) de chacun des vingt-quatre fichiers : ce sont les images fournies le 16/11 au soir (en
 * couleur, Seedream 5.0 Pro), chacune sous le nom de son modèle, et pas seulement des fichiers du bon nom et de la
 * bonne taille. L'original et sa copie légère sont tirés du fichier fourni (1320 × 1764), réduit tout entier.
 * tools/studio-vignettes.py refait les vingt-quatre et affiche ces lignes.
 */
const EMPREINTES: Record<string, string> = {
  "01-ma-carte-en-vrai.webp": "e0632b6bf0c4319c1c1a40218668bffc2e1ca4a5780843110a628fd3e802fd56",
  "01-ma-carte-en-vrai-660.webp": "ce4f0323e611eb544701dcf0387bdd00e94fc5d34734c22fca48f228eecbc5ab",
  "02-maillot-a-ton-nom.webp": "956cb8748348f2e89a8223723c1224b5e33b5c5d41ee438320f85cc8eec6519d",
  "02-maillot-a-ton-nom-660.webp": "d8ae7a627029cc50223357ad77e70fee0c85b0f247b7306542c70e6177929e51",
  "03-la-une-du-dimanche.webp": "bacbc5d0eaacb5503773ed17aaba878114b4c0385a8c52b127aabf58c9ea60b9",
  "03-la-une-du-dimanche-660.webp": "d48e14291411b197da6f8354296e72608ad91a4ceed0b102f79ddbb061880aee",
  "04-l-affiche-du-match.webp": "82cf5422346d9d65d772f767b1f0269141636569649bd581e8d5a435ff0c1055",
  "04-l-affiche-du-match-660.webp": "442c889c0b82d33d9dea92598fc9e55eba7126f22a02321b3220fca705ef0451",
  "05-la-celebration.webp": "807790627d5b223183cad2e56327c3d6a533b540978c90ed52541dd673167b5a",
  "05-la-celebration-660.webp": "4bc67b0f0783762fabcafbf2a5f2a25ab7bffbba06c5461c31a40c826797f210",
  "06-trash-talk.webp": "be2d8a0a4784429181951963565696652ea80127b676ddc157b0fa75d4b99c13",
  "06-trash-talk-660.webp": "820301e15a2771bb4f579053a1eac32224302f2f2dd2ae852c22dd9370a01ab8",
  "07-sorti-de-la-carte.webp": "46122debae27ad4b6bbfe79af6b9e1a30935cfcc10684d914182f6fb8e2f104d",
  "07-sorti-de-la-carte-660.webp": "f76674500ca00d097e1d1e04a17fda292f546a6f47531c7db60ab5a5485318f2",
  "08-option-hd.webp": "040aff32a741f62aa6106ea881464bc67e689ecf313d16c232e066d93c866c6e",
  "08-option-hd-660.webp": "9c651fab0abc8cd19a7647e91c860504803783852ddb3218b090bbd96eec118e",
  "09-ta-saison.webp": "735abd7ffb319d5937597bb6dd25b0afb6dc63b30d551f108799db8de7bbd944",
  "09-ta-saison-660.webp": "f6d5fba71c7584fce0c068627daf2a896f0dd3dac2cd1afc48c49f1bd4d677bd",
  "10-l-entree.webp": "e529c10d5ed15f3f7d32216ef72bc44d9da62c94551f3b0bf41734905ba22816",
  "10-l-entree-660.webp": "b734763b5538585800d77354fd516210c6fa3e9840633bda468725fc47340781",
  "11-le-but-de-ta-journee.webp": "23844d763d131ec14ff70e1489f7ad6a6b412826d8530a8fa46b4ddd9f6eb825",
  "11-le-but-de-ta-journee-660.webp": "c4fd459bbef8d99933b039236b8956d0000466b6de00e4550b4e9f3c8ebb5bf8",
  "12-convocation-d-equipe.webp": "0d6ed3151739074308ef803b88d847937d5d26c87e2c002085a7a80be194f2dd",
  "12-convocation-d-equipe-660.webp": "94860f42f0b0bec6fae049901b3ba094fe3ec997104e40b7bc8bc68d2ca7fa84",
};
const empreinte = (o: Buffer) => createHash("sha256").update(o).digest("hex");
assert.equal(new Set(Object.values(EMPREINTES)).size, 24, "vingt-quatre fichiers, vingt-quatre images différentes");
/**
 * Chaque template a sa vignette, à son rang : le fichier « NN-nom-du-modèle » (NN : sa place dans le catalogue),
 * présent à ses deux largeurs, en WebP, en 3:4, léger, et c'est l'image posée (son empreinte). L'original et sa
 * copie légère ont les proportions de l'image fournie, au pixel (110:147 : 1100 × 1470 et 660 × 882) : dans la
 * fiche, les deux se superposent ; l'écran les recadre en 4:5 (la feuille de style).
 * Rend le poids total.
 */
const vignettesJustes = (liste: readonly Template[], lireFichier: Lecteur = surDisque) => {
  assert.equal(liste.length, 12, "douze templates");
  let total = 0;
  liste.forEach((t, i) => {
    assert.equal(t.image, `${String(i + 1).padStart(2, "0")}-${enFichier(t.nom)}`, `${t.nom} : sa vignette, dans l'ordre du catalogue`);
    assert.equal(fichierVignette(t), `/bola-plus/studio/${t.image}.webp`, `${t.nom} : l'adresse de son image`);
    assert.equal(fichierVignette(t, VIGNETTE.legere), `/bola-plus/studio/${t.image}-${VIGNETTE.legere}.webp`, `${t.nom} : l'adresse de sa copie légère`);
    assert.equal(sourcesVignette(t), `/bola-plus/studio/${t.image}-660.webp 660w, /bola-plus/studio/${t.image}.webp 1100w`, `${t.nom} : ses deux largeurs`);
    const proportions: number[] = [];
    for (const l of LARGEURS_VIGNETTE) {
      const adresse = fichierVignette(t, l);
      const o = lireFichier(adresse);
      assert.ok(o, `${adresse} manque`);
      const { largeur, hauteur } = tailleWebp(o);
      assert.equal(largeur, l, `${adresse} : ${largeur} px de large, attendu ${l}`);
      // En 3:4, aux proportions de l'image fournie (110:147), au pixel : la boîte en 4:5 en ôte le haut et le bas.
      assert.equal(hauteur, hauteurVignette(largeur), `${adresse} : ${largeur} × ${hauteur}, pas du 3:4 des images fournies`);
      assert.ok(o.length <= POIDS_VIGNETTE[l], `${adresse} : ${o.length} octets, au plus ${POIDS_VIGNETTE[l]}`);
      assert.equal(empreinte(o), EMPREINTES[adresse.split("/").pop()!], `${adresse} : ce n'est pas l'image posée (son empreinte a changé)`);
      proportions.push(hauteur / largeur);
      total += o.length;
    }
    // La copie légère a les proportions de l'original, à une demi-ligne près : posée sous lui dans la fiche, elle a le même cadre.
    assert.ok(Math.abs(proportions[0] - proportions[1]) * VIGNETTE.legere < 0.5, `${t.nom} : sa copie légère n'a pas les proportions de l'original`);
  });
  assert.equal(new Set(liste.map((t) => t.image)).size, liste.length, "une image par template");
  assert.ok(total <= 1_500_000, `les vignettes pèsent ${total} octets, au plus 1,5 Mo`);
  return total;
};
const POIDS_STUDIO = vignettesJustes(TEMPLATES);
/** Le dossier ne tient que les vignettes : les douze originaux et leurs douze copies, des fichiers. */
const dossierJuste = (noms: readonly string[]) => {
  const attendu = TEMPLATES.flatMap((t) => LARGEURS_VIGNETTE.map((l) => fichierVignette(t, l).split("/").pop()!)).sort();
  assert.deepEqual([...noms].sort(), attendu, "public/bola-plus/studio : les douze vignettes à leurs deux largeurs, rien d'autre");
  assert.deepEqual(Object.keys(EMPREINTES).sort(), attendu, "une empreinte par fichier, aucune de trop");
};
dossierJuste(readdirSync(DOSSIER_STUDIO));
assert.ok(readdirSync(DOSSIER_STUDIO).every((f) => statSync(join(DOSSIER_STUDIO, f)).isFile()), "public/bola-plus/studio : des fichiers");
// Plus aucune vignette composée : l'écran ne dessine ni carte « Toi », ni visuel de Bola Plus recadré, ni photo de
// joueur dans l'image (la photo de ta carte n'est qu'en pastille, posée dessus : dedansJuste).
const sansComposition = (tsx: string) => {
  const trouve = /BolaCard|DosCarte|CARTE_TOI|matiereDe|fichierVisuel|sourcesVisuel|photo=|username=/.exec(sansNotes(tsx));
  assert.equal(trouve, null, `l'écran du studio compose encore une vignette : ${trouve?.[0]}`);
};
sansComposition(ecran);
// La carte « Toi » ne vit plus que sur la page (« Ta carte continue. ») : anonyme, ses stats dans CARTE_TOI, sa note calculée.
const toiJuste = (src: string) => {
  assert.ok(!/(?:VIT|TIR|PAS|DRI|DEF|PHY):\s*\d/.test(sansNotes(src)), "les stats de « Toi » ne s'écrivent que dans CARTE_TOI");
  assert.ok(/stats=\{CARTE_TOI\.stats\}/.test(src) && /ovr\(CARTE_TOI\.stats\)/.test(src), "« Toi » : CARTE_TOI et sa note calculée");
};
toiJuste(page);
assert.equal(CARTE_TOI.name, "Toi", "la carte « Toi » est anonyme");
// Les variables de Bola Plus, clé par clé : chaque teinte de PALETTE.plus, une fois, rien d'autre.
const variablesJustes = (v: Record<string, string>) => {
  const attendu: Record<string, string> = Object.fromEntries(Object.entries(PALETTE.plus).map(([k, c]) => [`--bp-plus-${k === "fondClair" ? "papier" : k}`, c]));
  assert.deepEqual({ ...v }, attendu, "VARIABLES_PLUS : les six teintes de PALETTE.plus, clé par clé");
};
variablesJustes(VARIABLES_PLUS);
/** Les règles d'une feuille dont le sélecteur nomme `mot` : leurs déclarations, bout à bout. */
const regles = (code: string, mot: string) => [...code.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].includes(mot)).map((m) => m[2]).join("\n");
/** Les règles d'une feuille sans ses notes, dans l'ordre (celles des blocs @media et @supports comprises) : leur sélecteur, leurs déclarations. */
const reglesDe = (code: string) =>
  [...code.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selecteur: m[1].trim().replace(/\s+/g, " "),
    declarations: m[2]
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => [d.slice(0, d.indexOf(":")).trim(), d.slice(d.indexOf(":") + 1).trim().replace(/\s+/g, " ")] as const),
  }));
/** Les règles de la feuille qui nomment une vignette, dans l'ordre : une de plus, où qu'elle soit, s'écrit ici. */
const SELECTEURS_VIGNETTE = [
  ".st-item__bouton:active .st-vignette",
  ".st-vignette",
  ".st-vignette--grand",
  // En petit, au bas de la fiche (ta photo → ton image, 16/11).
  ".st-vignette--mini",
  ".st-vignette__image",
  ".st-vignette::after",
  ".st-vignette__bas",
  ".st-vignette__nom",
  ".st-vignette__prix",
  // Sans unités de conteneur (@supports) : la légende, et elle seule.
  ".st-vignette__bas",
  ".st-vignette__nom",
  ".st-vignette__prix",
  // « Réduire les animations ».
  ".st-vignette, .st-eventail__place",
];
/** La boîte d'une vignette : ses propriétés, et les valeurs qu'elles prennent. Ni hauteur, ni largeur, ni découpe, ni filtre, ni opacité. */
const BOITE: Record<string, readonly string[]> = {
  position: ["relative"],
  display: ["block"],
  "aspect-ratio": ["4 / 5"],
  overflow: ["hidden"],
  "border-radius": ["20px", "24px", "12px"],
  background: ["#000"],
  color: ["#fff"],
  isolation: ["isolate"],
  "container-type": ["inline-size"],
  "text-align": ["left"],
  transition: ["scale 0.2s ease", "none"],
  scale: ["0.98"],
};
/** Ce qui peut teinter, déformer ou découper une vignette, même posé sur un parent : tout ce que la feuille en écrit. */
const SENSIBLE = /^(-webkit-)?(filter|backdrop-filter|opacity|transform|scale|rotate|translate|zoom|clip-path|mask(-[a-z]+)*|object-(fit|position|view-box)|aspect-ratio|mix-blend-mode|background-blend-mode)$/;
const SENSIBLES = [
  ".st-item__bouton:active .st-vignette { scale: 0.98 }",
  ".st-vignette { aspect-ratio: 4 / 5 }",
  ".st-vignette__image { object-fit: cover }",
  // Les fichiers sont en 3:4 (16/11 au soir) : la boîte en 4:5 les recadre en haut, là où sont les têtes.
  ".st-vignette__image { object-position: 50% 30% }",
  // La photo de ta carte dans sa pastille ronde (16/11) : elle la remplit, comme sur la carte ; ce n'est pas une vignette.
  ".st-toi__image { object-fit: cover }",
  // L'ombre portée des vignettes de l'éventail : le seul filtre de la feuille, et il est noir.
  ".st-eventail__place { filter: drop-shadow(0 14px 22px rgb(0 0 0 / 0.42)) }",
  '.st-eventail__place[data-place="0"] { translate: -6% -56% }',
  '.st-eventail__place[data-place="0"] { rotate: -9deg }',
  '.st-eventail__place[data-place="2"] { translate: 6% -56% }',
  '.st-eventail__place[data-place="2"] { rotate: 9deg }',
  '.st-eventail__place[data-place="1"] { translate: -50% -46% }',
  ".st-eventail:active .st-eventail__place { scale: 0.98 }",
  // Les recharges « Bientôt », atténuées : ce ne sont pas des vignettes.
  ".st-recharge { opacity: 0.74 }",
];
/** Les propriétés qui portent une couleur, et les seuls mots qu'elles écrivent : aucun nom de couleur. */
const PORTE_COULEUR = /^(color|background(-color|-image)?|box-shadow|text-shadow|outline(-color)?|border(-(top|right|bottom|left|inline|block))?(-color)?|filter|backdrop-filter|fill|stroke|caret-color|accent-color|text-decoration(-color)?)$/;
const MOTS_COULEUR = new Set(["rgb", "color-mix", "in", "srgb", "transparent", "linear-gradient", "radial-gradient", "to", "top", "at", "inset", "solid", "none", "inherit", "currentColor", "drop-shadow"]);
const feuilleJuste = (css: string) => {
  assert.ok(/scroll-snap-type: x mandatory;/.test(css) && /scroll-snap-align: start;/.test(css), "le rail s'accroche carte par carte");
  const code = sansNotes(css);
  // Aucune teinte écrite : du gris, le blanc ou le noir, et les variables de Bola Plus (PALETTE, posées par la page et le panneau).
  for (const m of code.matchAll(/rgb\((\d+) (\d+) (\d+)/g)) assert.ok(Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) <= 8, `une couleur dans la feuille : ${m[0]}`);
  assert.ok(!/#(?!fff\b|000\b)[0-9a-f]{3,8}\b/i.test(code), "pas d'autre teinte écrite que le noir et le blanc");
  assert.ok(!/\b(hsla?|hwb|lab|lch|oklab|oklch)\(/.test(code), "aucune couleur écrite autrement qu'en rgb gris, #fff ou #000");
  for (const m of code.matchAll(/color-mix\(in srgb, (var\([^)]*\)|[^ ,]+(?:\([^)]*\))?)/g)) assert.match(m[1], /^var\(--bp-plus-[a-z]+\)$/, `un mélange d'une autre couleur que celles de Bola Plus : ${m[1]}`);
  for (const m of code.matchAll(/var\((--[a-z-]+)/g)) assert.ok(!/^--bp-(sfl|prix|nuit)/.test(m[1]), `le studio est dans la part Bola Plus : ${m[1]}`);
  // Une vignette : une boîte en 4:5, jamais carrée (le seul rapport écrit dans la feuille).
  assert.deepEqual([...code.matchAll(/aspect-ratio:\s*([^;]+);/g)].map((m) => m[1].trim()), ["4 / 5"], "une vignette en 4:5, jamais carrée");
  assert.ok(/\n\.st-vignette \{[^}]*aspect-ratio: 4 \/ 5;[^}]*overflow: hidden;/.test(code), "la boîte d'une vignette : 4:5");
  // L'image la remplit telle quelle : ni grossie, ni déplacée, ni déformée.
  const image = regles(code, ".st-vignette__image");
  assert.ok(/object-fit: cover;/.test(image) && /inset: 0;/.test(image) && /width: 100%;/.test(image) && /height: 100%;/.test(image), "l'image remplit sa vignette sans se déformer");
  assert.ok(!/\b(scale|transform|translate|rotate|zoom)\s*:/.test(image), "l'image n'est ni grossie ni déplacée");
  // Recadrée en haut, à 50 % 30 %, et nulle part ailleurs (Sabri, 16/11 à 19:20) : les têtes entières, le tiers bas gardé.
  assert.deepEqual([...image.matchAll(/object-position:\s*([^;]+);/g)].map((x) => x[1].trim()), ["50% 30%"], "l'image recadrée en haut, à 50 % 30 %");
  // Ni teinte : aucune fusion dans la feuille ; sur une vignette, ni filtre, ni opacité, ni couleur de Bola Plus.
  assert.ok(!/mix-blend-mode|background-blend-mode/.test(code), "aucune fusion : les images ne sont pas teintes");
  const vignette = regles(code, ".st-vignette");
  assert.ok(!/\b(filter|backdrop-filter|opacity)\s*:/.test(vignette) && !/var\(--bp-/.test(vignette), "une vignette : ni filtre, ni opacité, ni couleur de Bola Plus");
  // Le voile sous la légende est noir, et seulement noir.
  const voile = /\n\.st-vignette__bas \{[^}]*background: ([^;]+);/.exec(code)?.[1] ?? "";
  assert.ok(/^linear-gradient\(to top, /.test(voile) && /transparent 100%\)$/.test(voile), "la légende : un voile qui monte du bas et s'efface");
  assert.equal(voile.replace(/rgb\(0 0 0 \/ 0?\.\d+\) \d+%, /g, ""), "linear-gradient(to top, transparent 100%)", "le voile est noir, et seulement noir");
  // Et cela où que la règle soit écrite (contrôle du 15/11 : une seconde règle, un parent, une pseudo-boîte passaient).
  const R = reglesDe(code);
  // Les règles qui nomment une vignette : une liste fermée.
  assert.deepEqual(R.map((r) => r.selecteur).filter((sel) => sel.includes(".st-vignette")), SELECTEURS_VIGNETTE, "les règles de la feuille qui nomment une vignette : une liste fermée");
  // Sa boîte : des propriétés et des valeurs connues.
  for (const r of R.filter((x) => x.selecteur.split(", ").some((sel) => /(^| )\.st-vignette(--grand|--mini)?$/.test(sel))))
    for (const [prop, valeur] of r.declarations) assert.ok(BOITE[prop]?.includes(valeur), `la boîte d'une vignette : ${prop}: ${valeur} (${r.selecteur})`);
  // Son image : une seule règle, ces déclarations et rien d'autre ; son liseré : un filet blanc.
  const declarations = (sel: string) => R.filter((r) => r.selecteur === sel).map((r) => r.declarations.map((d) => d.join(": ")).sort());
  assert.deepEqual(declarations(".st-vignette__image"), [["-webkit-user-drag: none", "height: 100%", "inset: 0", "object-fit: cover", "object-position: 50% 30%", "position: absolute", "user-select: none", "width: 100%"]], "l'image d'une vignette : une règle, rien d'autre");
  assert.deepEqual(declarations(".st-vignette::after"), [["border-radius: inherit", "box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.09)", 'content: ""', "inset: 0", "pointer-events: none", "position: absolute", "z-index: 2"]], "le liseré d'une vignette : un filet blanc, rien d'autre");
  // Ce qui peut teinter, déformer ou découper, même depuis un parent : seulement ce qui est écrit dans SENSIBLES.
  assert.deepEqual(R.flatMap((r) => r.declarations.filter(([prop]) => SENSIBLE.test(prop)).map(([prop, valeur]) => `${r.selecteur} { ${prop}: ${valeur} }`)), SENSIBLES, "ce qui peut teinter, déformer ou découper une vignette : une liste fermée");
  // Aucune couleur nommée, dans aucune propriété qui en porte une : il n'y reste que des mots connus. Et aucune ne se
  // cache dans une variable : la feuille n'en définit pas, elle ne lit que celles de la part Bola Plus et l'encre de l'app.
  assert.ok(!R.some((r) => r.declarations.some(([prop]) => prop.startsWith("--"))), "aucune variable définie dans la feuille");
  for (const v of code.matchAll(/var\((--[a-z-]+)/g)) assert.match(v[1], /^--(bp-plus-[a-z]+|foreground)$/, `une variable d'ailleurs dans la feuille : ${v[1]}`);
  for (const r of R)
    for (const [prop, valeur] of r.declarations.filter(([nom]) => PORTE_COULEUR.test(nom)))
      for (const mot of valeur.replace(/var\(--[a-z-]+\)|#(fff|000)\b|-?\d*\.?\d+(px|%|deg)?/g, " ").match(/[A-Za-z][A-Za-z-]*/g) ?? []) assert.ok(MOTS_COULEUR.has(mot), `une couleur nommée dans la feuille : ${mot} (${r.selecteur} { ${prop} })`);
  // La légende suit la largeur de la vignette, sans descendre sous 11 px (la vignette du milieu de l'éventail, sur un
  // petit écran) ; sans unités de conteneur, elle garde une taille et des marges.
  assert.ok(/\n\.st-vignette__nom \{[^}]*font-size: max\(8\.6cqw, 11px\);/.test(code) && /\n\.st-vignette__prix \{[^}]*font-size: max\(7\.8cqw, 11px\);/.test(code), "la légende : à la largeur de la vignette, jamais sous 11 px");
  const repli = /\n@supports not \(width: 1cqw\) \{\s*\.st-vignette__bas \{\s*gap: ([\d.]+)px;\s*padding: 0 ([\d.]+)px ([\d.]+)px;\s*\}\s*\.st-vignette__nom \{\s*font-size: ([\d.]+)px;\s*\}\s*\.st-vignette__prix \{\s*font-size: ([\d.]+)px;\s*\}\s*\}/.exec(code);
  assert.ok(repli, "sans unités de conteneur : la légende garde une taille et des marges");
  // Ce repli vaut ce que donnent les cqw sur le plus étroit des rails (58vw d'un écran de 320 px), à un demi-pixel
  // près : une taille changée en cqw sans son repli (ou l'inverse) arrête le banc.
  const enCqw = [
    ...(/\n\.st-vignette__bas \{[^}]*gap: ([\d.]+)cqw;[^}]*padding: 0 ([\d.]+)cqw ([\d.]+)cqw;/.exec(code)?.slice(1) ?? []),
    /\n\.st-vignette__nom \{[^}]*font-size: max\(([\d.]+)cqw, 11px\);/.exec(code)?.[1],
    /\n\.st-vignette__prix \{[^}]*font-size: max\(([\d.]+)cqw, 11px\);/.exec(code)?.[1],
  ];
  assert.equal(enCqw.filter(Boolean).length, 5, "la légende : ses marges et ses tailles en cqw");
  const RAIL_ETROIT = 320 * 0.58;
  enCqw.forEach((v, i) => assert.ok(Math.abs(+repli[i + 1] - (+v! * RAIL_ETROIT) / 100) <= 0.5, `sans unités de conteneur : ${repli[i + 1]} px, pas ce que donnent ${v}cqw sur le plus étroit des rails`));
  // La fiche : la vignette, ses deux lignes et ta photo → ton image dans une colonne, bornée à ce qui tient dans la
  // feuille (92dvh, FEUILLE_STUDIO), à toute hauteur d'écran : la règle est hors de tout @media (en début de ligne).
  // 298 px : le retour, les marges et les deux lignes (222 px), puis l'écart (16 px) et la ligne de ta photo, à la
  // hauteur de la vignette en petit (48 px de large en 4:5 : 60 px).
  const borne = /\n\.st-fiche \{[^}]*flex-direction: column;[^}]*width: min\(100%, max\((\d+)px, \(92dvh - 298px\) \* 0\.8\)\);[^}]*margin-inline: auto;[^}]*\}/.exec(code);
  assert.ok(borne, "la fiche se borne à ce qui tient dans la feuille, à toute hauteur d'écran");
  // Son plancher : un téléphone tenu en largeur (844 × 390) ne la réduit pas à la vignette en petit ; il ne change rien
  // en hauteur jusqu'au plus petit écran (320 × 568 : la borne y vaut 179,6 px) ; ta photo → ton image y tient
  // (4 + 48 + 12 + 20 + 12 + 48 + 4 = 148 px).
  const plancher = +borne[1];
  assert.ok(plancher <= (0.92 * 568 - 298) * 0.8, `le plancher de la fiche (${plancher} px) la ferait défiler sur un écran de 320 × 568`);
  assert.ok(plancher >= 148, `le plancher de la fiche (${plancher} px) : ta photo → ton image n'y tient plus`);
  assert.ok(/\n\.st-ligne__image \{[^}]*width: 48px;/.test(code) && /\n\.st-ligne \{[^}]*align-items: center;/.test(code), "ta photo → ton image : la vignette en petit, 48 px de large (60 de haut), comptée dans la borne de la fiche");
  // Ni animée : rien ne bouge seul dans la feuille ; une vidéo se dit par son triangle et sa durée.
  assert.ok(!/animation\s*:|@keyframes/.test(code), "aucune animation : une vignette ne bouge pas");
  reduitJuste(css);
};
/** Avec « Réduire les animations » : l'appui d'une vignette se marque d'un coup, sans transition (comme partout dans l'app). */
function reduitJuste(css: string) {
  const reduit = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/.exec(css)?.[1] ?? "";
  assert.ok(/\.st-vignette,\s*\.st-eventail__place \{[^}]*transition: none;/.test(reduit), "mouvement réduit : l'appui d'une vignette se marque sans transition");
  // Tout ce qui a une transition dans la feuille est nommé dans ce bloc.
  const mobiles = [...sansNotes(css).matchAll(/\n(\.[\w-]+) \{[^}]*\btransition:/g)].map((m) => m[1]);
  for (const sel of mobiles) assert.ok(reduit.includes(sel), `mouvement réduit : ${sel} garde sa transition`);
}
feuilleJuste(feuille);

// 6 · Ce qui se voit et se lit.
const bloc = (tsx: string, nom: string) => {
  const debut = tsx.indexOf(`function ${nom}(`);
  assert.ok(debut >= 0, `${nom} est trouvée`);
  return tsx.slice(debut, tsx.indexOf("\n}\n", debut));
};
const CACHE = /(^|[\s:"])(hidden|sr-only|invisible|opacity-0)(?=[\s"])|\shidden(?=[\s>={/])/;
/** Une classe utilitaire qui teinte, recadre ou déforme (un filtre, une fusion, un rapport, un cadrage, une échelle) : aucune dans l'écran du studio. */
const CLASSE_TORDUE = /(?<![\w-])(sepia|grayscale|invert|(hue-rotate|saturate|brightness|contrast|backdrop|mix-blend|bg-blend|aspect|object|scale|rotate|skew|opacity)-[\w.[\]/%-]+!?|blur(-[\w.[\]-]+)?)(?![\w-])/;
const ecranJuste = (tsx: string) => {
  const code = sansNotes(tsx);
  const cache = CACHE.exec(code);
  assert.equal(cache, null, `quelque chose est caché dans l'écran du studio : ${cache?.[0]}`);
  // Aucune classe qui teinte, recadre ou déforme, où qu'elle soit posée (une vignette, sa place dans l'éventail, le rail).
  const tordue = CLASSE_TORDUE.exec(code);
  assert.equal(tordue, null, `une classe qui teinte, recadre ou déforme dans l'écran du studio : ${tordue?.[0]}`);
  // Les styles posés par l'écran, une liste fermée : la police des prix, les couleurs des deux feuilles. Aucun sur une vignette.
  // (La seconde police : l'initiale de la pastille, quand tu n'as pas de photo.)
  assert.deepEqual((code.match(/style=\{[^\n]*/g) ?? []).sort(), ["style={COULEURS_STUDIO}>", "style={COULEURS_STUDIO}>", "style={{ fontFamily: ANTON }}>", "style={{ fontFamily: ANTON }}>"], "les styles posés par l'écran : une liste fermée");
  // Les mots écrits en dur : une liste fermée (entre deux balises ; le code entre « > » et « < » est écarté).
  const mots = [...code.matchAll(/>([^<>{}]*[A-Za-zÀ-ÿ][^<>{}]*)</g)].map((m) => m[1].trim()).filter((t) => t && !/[;()=]/.test(t)).sort();
  assert.deepEqual(mots, ["Bientôt", "Bola Studio", "Bola Studio", "Recharges"], "les mots écrits en dur dans l'écran du studio");
  // L'image d'un template : décorative, à ses deux largeurs, chargée à l'approche, sans style à elle (ni recadrage, ni grossissement).
  const image = bloc(tsx, "ImageTemplate");
  assert.equal(code.match(/<img\b/g)?.length, 3, "trois images dans l'écran : celle d'un template, la copie légère sous l'original de la fiche, la photo de ta carte");
  // Sous l'original de la fiche : la copie légère du même template, sous la même règle de style, sans rien d'autre.
  const dessous = bloc(tsx, "ImageLegere");
  assert.ok(/<img className="st-vignette__image" src=\{fichierVignette\(t, VIGNETTE\.legere\)\} width=\{VIGNETTE\.legere\} height=\{hauteurVignette\(VIGNETTE\.legere\)\} alt="" draggable=\{false\} \/>/.test(dessous) && !/srcSet|sizes|style=|aria-|role=/.test(dessous), "sous l'original de la fiche : la copie légère, telle quelle, décorative");
  assert.ok(/\salt=""\s/.test(image) && !/aria-label|role=/.test(image), "l'image d'un template est décorative (alt vide)");
  assert.ok(/src=\{fichierVignette\(t, VIGNETTE\.legere\)\}/.test(image) && /srcSet=\{sourcesVignette\(t\)\}/.test(image) && /sizes=\{LARGEUR_CADRE\[cadre\]\}/.test(image), "l'image à ses deux largeurs, à la taille de son cadre");
  assert.ok(/width=\{VIGNETTE\.legere\}/.test(image) && /height=\{hauteurVignette\(VIGNETTE\.legere\)\}/.test(image), "l'image dit les dimensions de son fichier (3:4)");
  assert.ok(/loading=\{proche \? "eager" : "lazy"\}/.test(image) && /const proche = useProche\(ref\);/.test(image), "l'image attend d'être proche pour se charger");
  assert.ok(!/style=/.test(image) && /className="st-vignette__image"/.test(image), "l'image n'a pas de style à elle");
  // La légende : le nom du modèle et son prix, écrits sur la vignette, lus par un lecteur d'écran.
  const legende = bloc(tsx, "Legende");
  assert.ok(/<Boite className="st-vignette__bas">/.test(legende) && !/aria-hidden/.test(legende), "la légende se lit");
  assert.ok(/<Nom className="bp-titre st-vignette__nom">\{t\.nom\}<\/Nom>/.test(legende) && /<Prix texte=\{prixDe\(t\)\} /.test(legende), "la légende : le nom et le prix");
  assert.ok(legende.indexOf("{t.nom}") < legende.indexOf("prixDe(t)"), "le nom, puis le prix");
  assert.ok(/const Nom = titre \? SheetTitle : "span";/.test(legende), "dans la fiche, le nom est le titre de la feuille");
  const duree = bloc(tsx, "Duree");
  assert.ok(/\{dureeDe\(t\)\}/.test(duree) && /t\.rendu\.genre === "video" && <Play /.test(duree), "la durée d'un template, et le triangle d'une vidéo");
  const item = bloc(tsx, "CarteTemplate");
  assert.ok(!/aria-label|aria-hidden/.test(item), "le bouton d'un template se lit en entier (pas d'aria-label)");
  assert.ok(/<span className="st-vignette">\s*<ImageTemplate t=\{t\} cadre="rail" \/>\s*<Legende t=\{t\} \/>\s*<PastilleToi toi=\{toi\} \/>\s*<\/span>/.test(item), "le rail : la vignette, avec le nom et le prix, et la photo de ta carte");
  assert.ok(/\{t\.recoit\}/.test(item) && /<Duree t=\{t\} \/>/.test(item) && item.indexOf("{t.recoit}") > item.indexOf("<Legende") && item.indexOf("<Duree") > item.indexOf("{t.recoit}"), "le rail : sous la vignette, ce que tu reçois, puis la durée");
  const fiche = bloc(tsx, "FicheTemplate");
  // Une colonne (.st-fiche, bornée dans la feuille) : la vignette en grand, sa copie légère sous l'original (la fiche ne
  // s'ouvre pas sur un cadre noir le temps qu'il arrive) ; dessous, au bord de l'image, ce que tu reçois et la durée.
  assert.ok(/<div className="st-fiche">\s*<div className="st-vignette st-vignette--grand">\s*<ImageLegere t=\{t\} \/>\s*<ImageTemplate t=\{t\} cadre="page" \/>\s*<Legende t=\{t\} titre \/>\s*<\/div>/.test(fiche), "la feuille : la vignette en grand (sa copie légère sous l'original), son nom en titre, son prix");
  assert.ok(/<Legende t=\{t\} titre \/>\s*<\/div>\s*<div className="flex flex-col gap-3 px-1">\s*<p className="text-corps leading-snug text-encre-2">\{t\.recoit\}<\/p>\s*<Duree t=\{t\} grand \/>\s*<\/div>\s*<LigneToi t=\{t\} toi=\{toi\} \/>\s*<\/div>/.test(fiche) && !/aria-hidden/.test(fiche), "la feuille : ce que tu reçois et la durée, puis ta photo → ton image, dans la colonne de la vignette");
  assert.ok(/\nconst FEUILLE_STUDIO = "st-feuille max-h-\[92dvh\] overflow-y-auto /.test(tsx), "la feuille : 92dvh au plus (la borne de la fiche le recopie)");
  const panneau = bloc(tsx, "PanneauStudio");
  // Le sous-titre en deux lignes : « Avec ta photo. » (AVEC_TA_PHOTO), puis la phrase des ballons ; un espace entre les deux.
  assert.ok(/<p className="st-panneau__phrase tabular-nums">\s*<span className="st-panneau__avec">\{AVEC_TA_PHOTO\}<\/span> \{PHRASE_INCLUS\}\s*<\/p>/.test(panneau), "« Avec ta photo. » et la phrase des ballons du mois se voient");
  assert.ok(/TEMPLATES\.map\(\(t\) => \(\s*<CarteTemplate key=\{t\.id\} t=\{t\} toi=\{toi\} onOuvrir=\{\(\) => setFiche\(t\)\} \/>/.test(panneau), "le panneau : les douze templates en rail");
  assert.ok(/<RechargesStudio \/>/.test(panneau) && panneau.indexOf("<RechargesStudio />") > panneau.indexOf("TEMPLATES.map("), "les recharges sous le rail");
  // La fiche est rendue dans le panneau : elle y est poussée (même fenêtre, retour en haut à gauche).
  const contenu = panneau.slice(panneau.indexOf("<SheetContent"), panneau.lastIndexOf("</SheetContent>"));
  assert.ok(/<FicheTemplate t=\{fiche\} toi=\{toi\} onFermer=\{\(\) => setFiche\(null\)\} \/>/.test(contenu), "la fiche est poussée dans le panneau");
  // Le panneau et la fiche, portés hors de la page, reçoivent les couleurs de Bola Plus.
  assert.ok(/<SheetContent side="bottom" className=\{FEUILLE_STUDIO\} style=\{COULEURS_STUDIO\}>/.test(panneau) && /<SheetContent side="bottom" className=\{FEUILLE_STUDIO\} style=\{COULEURS_STUDIO\}>/.test(fiche), "le panneau et la fiche ont les couleurs de Bola Plus");
  assert.ok(/const COULEURS_STUDIO = VARIABLES_PLUS as CSSProperties;/.test(tsx) && !/"--bp-/.test(sansNotes(tsx)), "le panneau pose VARIABLES_PLUS, sans recopier une variable");
  // « Ton studio » : un seul bouton, qui se lit « Bola Studio » et ouvre le panneau ; les ballons du mois sous le titre.
  const visuel = bloc(tsx, "VisuelStudio");
  assert.equal(visuel.match(/<button\b/g)?.length, 1, "« Ton studio » : un seul bouton");
  assert.ok(/<button type="button" className="st-eventail" onClick=\{\(\) => setOuvert\(true\)\}>/.test(visuel), "le bouton ouvre le panneau, sans aria-label");
  assert.ok(/EVENTAIL\.map\(/.test(visuel) && /<ImageTemplate t=\{t\} cadre="rail" \/>/.test(visuel) && /\{TEMPLATES\.length\}/.test(visuel), "l'éventail, et le nombre de templates");
  assert.ok(/<span key=\{t\.id\} className="st-eventail__place" data-place=\{i\}>\s*<span className="st-vignette">\s*<ImageTemplate t=\{t\} cadre="rail" \/>\s*\{i === MILIEU && <Legende t=\{t\} \/>\}\s*<\/span>\s*<\/span>/.test(visuel), "l'éventail : trois vignettes telles quelles, sans classe de plus");
  // L'éventail est décoratif (chaque template se lit en entier dans le panneau) ; seule la vignette du milieu, entière, porte sa légende.
  assert.ok(/<span className="st-eventail__cartes" aria-hidden>/.test(visuel), "l'éventail, décoratif : le bouton se lit « Bola Studio »");
  assert.ok(/\{i === MILIEU && <Legende t=\{t\} \/>\}/.test(visuel) && /\nconst MILIEU = 1;\n/.test(tsx) && visuel.match(/<Legende\b/g)?.length === 1, "dans l'éventail, la légende sur la vignette du milieu seulement");
  assert.ok(/<span className="st-eventail__nombre tabular-nums" aria-hidden>\s*\{TEMPLATES\.length\}/.test(visuel), "le nombre de templates, décoratif : le bouton se lit « Bola Studio », pas « Bola Studio 12 »");
  assert.ok(/<PanneauStudio ouvert=\{ouvert\} onFermer=\{\(\) => setOuvert\(false\)\} \/>/.test(visuel), "le panneau est branché");
  assert.ok(/<p className="bp-texte__sous st-mention tabular-nums">\{MENTION_STUDIO\}<\/p>/.test(bloc(tsx, "MentionStudio")), "les ballons du mois sous le titre");
  const rech = tsx.slice(tsx.indexOf("export function RechargesStudio("));
  assert.ok(/ballons\(r\.ballons, ESPACE_LARGE\)/.test(rech) && /\{prixRecharge\(r\)\}/.test(rech) && !/r\.centimes\)/.test(rech.replace("key={r.centimes}", "")), "une recharge : ses ballons et son prix");
  assert.ok(!/<button|onClick|href=|role=|tabIndex/.test(rech), "une recharge : ni geste, ni focus");
};
ecranJuste(ecran);
/**
 * Les largeurs de cadre d'une image (sizes). Celle du rail est la largeur d'un template dans la feuille, recopiée :
 * plus large, le rail chargerait l'original au lieu de la copie légère. Celle de la fiche : la page moins ses marges.
 */
const cadresJustes = (tsx: string, css: string) => {
  const cadres = /\nconst LARGEUR_CADRE: Record<Cadre, string> = \{ rail: "([^"]+)", page: "([^"]+)" \};\n/.exec(tsx);
  assert.ok(cadres, "les largeurs de cadre d'une image : le rail et la page");
  assert.equal(cadres[1], /\n\.st-item \{[^}]*\n {2}width: ([^;]+);/.exec(sansNotes(css))?.[1], "le cadre « rail » : la largeur d'un template dans la feuille");
  assert.equal(cadres[2], "min(406px, calc(100vw - 24px))", "le cadre « page » : la largeur de la fiche");
};
cadresJustes(ecran, feuille);

// 8 · Toi, dedans (16/11) : la photo de ta carte sur chaque vignette du rail, et ta photo → ton image dans la fiche.
const dedansJuste = (tsx: string, css: string) => {
  const code = sansNotes(tsx);
  // La photo : celle de ta carte, par son chemin (le joueur de Ma carte, puis la photo que PlayerCard donne à BolaCard).
  const toi = bloc(tsx, "useToi");
  assert.ok(/const \{ me, player \} = useMyPlayer\(\);/.test(toi) && /const nom = player\?\.name \?\? me;/.test(toi) && /return \{ nom, photo: usePhotoPerso\(nom\) \};/.test(toi), "la photo de ta carte : le joueur de Ma carte, et la photo de sa carte (usePhotoPerso)");
  // Ni le repli de usePlayerPhoto (/players/… : plus livré, une image cassée), ni une autre adresse (une requête de plus).
  assert.ok(!/usePlayerPhoto|photoMiniature|photoSrc|\/players\//.test(code), "la photo de ta carte : aucune autre adresse que celle de son portrait");
  // La pastille : décorative, la photo à l'adresse du portrait (même mode CORS que BolaCard), et le repli de la carte.
  const pastille = bloc(tsx, "PastilleToi");
  assert.ok(/<span className="st-toi" aria-hidden>/.test(pastille), "la pastille est décorative (le sous-titre dit ce qu'elle dit)");
  assert.ok(/<img\s+className="st-toi__image"\s+src=\{photo\}\s+crossOrigin=\{photo\.startsWith\("data:"\) \? undefined : "anonymous"\}\s+alt=""/.test(pastille), "la pastille : la photo, telle que le portrait de la carte la charge");
  assert.ok(/onError=\{\(\) => setCassee\(photo\)\}/.test(pastille) && /const photo = toi\.photo && toi\.photo !== cassee \? toi\.photo : null;/.test(pastille), "une photo qui ne se charge pas laisse la place au repli");
  assert.ok(/\{toi\.nom\.slice\(0, 1\)\.toUpperCase\(\)\}/.test(pastille) && /fontFamily: ANTON/.test(pastille), "sans photo : l'initiale en Anton, le repli du portrait de la carte");
  // Où elle est : sur chaque vignette du rail ; dans la fiche, la ligne ; pas sur l'éventail.
  assert.equal(code.match(/<PastilleToi toi=\{toi\} \/>/g)?.length, 2, "la pastille : une fois dans le rail (sur chaque vignette), une fois dans la ligne de la fiche");
  assert.ok(/<PastilleToi /.test(bloc(tsx, "CarteTemplate")) && /<PastilleToi /.test(bloc(tsx, "LigneToi")) && !/PastilleToi|useToi/.test(bloc(tsx, "VisuelStudio")), "la pastille : dans le rail et dans la fiche, pas sur l'éventail");
  assert.ok(/const toi = useToi\(\);/.test(bloc(tsx, "PanneauStudio")), "le panneau lit la photo de ta carte une fois, pour le rail et la fiche");
  // Ta photo → ton image : la pastille, une flèche, la vignette en petit (sa copie légère) ; aucun mot.
  const ligne = bloc(tsx, "LigneToi");
  assert.ok(/<div className="st-ligne">\s*<PastilleToi toi=\{toi\} \/>\s*<ArrowRight [^>]*aria-hidden \/>\s*<span className="st-ligne__image">\s*<span className="st-vignette st-vignette--mini">\s*<ImageLegere t=\{t\} \/>\s*<\/span>\s*<\/span>\s*<\/div>/.test(ligne), "ta photo → ton image : la photo, la flèche, la vignette en petit");
  assert.ok(!/>[^<>{}]*[A-Za-zÀ-ÿ][^<>{}]*</.test(ligne.slice(ligne.indexOf("return ("))), "ta photo → ton image : aucun mot");
  // Dans la feuille : une pastille ronde, cerclée de blanc, sur du noir ; au rail, en haut à gauche, au-dessus de l'image.
  const feuilleCode = sansNotes(css);
  assert.ok(/\n\.st-toi \{[^}]*overflow: hidden;[^}]*border-radius: 999px;[^}]*background: #000;[^}]*color: #fff;[^}]*box-shadow: 0 0 0 2px #fff, /.test(feuilleCode), "la pastille : ronde, cerclée de blanc, sur du noir");
  assert.ok(/\n\.st-item \.st-toi \{\s*position: absolute;\s*top: 10px;\s*left: 10px;\s*z-index: 1;\s*\}/.test(feuilleCode), "dans le rail : en haut à gauche de la vignette, au-dessus de l'image");
};
dedansJuste(ecran, feuille);

// Les mutants.
/** Un mutant dont le texte à changer n'est plus dans la source : il ne prouve rien, le banc s'arrête. */
class SansPrise extends Error {}
/**
 * Un mutant est refusé ; et pour la raison dite, quand elle est écrite (`raison`) : refusé par un autre garde que le
 * sien, il ne prouverait rien de celui-ci.
 */
const refuse = (nom: string, essai: () => void, raison?: RegExp) => {
  let erreur: unknown;
  try {
    essai();
  } catch (e) {
    if (e instanceof SansPrise) throw e;
    erreur = e ?? new Error("refus");
  }
  assert.ok(erreur !== undefined, `mutant accepté : ${nom}`);
  if (raison) assert.match(erreur instanceof Error ? erreur.message : String(erreur), raison, `mutant refusé par un autre garde que le sien : ${nom}`);
};
refuse("un template de moins", () => catalogueJuste(TEMPLATES.slice(1)));
refuse("un prix changé", () => catalogueJuste(TEMPLATES.map((t, i) => (i === 5 ? { ...t, prix: 249 } : t))));
refuse("un prix nul", () => catalogueJuste(TEMPLATES.map((t, i) => (i === 0 ? { ...t, prix: 0 } : t))));
refuse("l'option HD sans son +", () => catalogueJuste(TEMPLATES.map((t) => ({ ...t, supplement: undefined }))));
refuse("une phrase arrondie au plus proche", () => phraseJuste((b, c) => equivalence(Math.round(b / 299) * 299, c)));
refuse("une phrase écrite en dur", () => phraseJuste(() => "un trash talk ou six images"));
refuse("« un image »", () => phraseJuste((b, c) => equivalence(b, c).replace(/^une /, "un ")));
refuse("une quantité nulle écrite", () => phraseJuste((b, c) => (b < 299 ? `zéro trash talk ou ${equivalence(b, c)}` : equivalence(b, c))));
refuse("lettres et chiffres mêlés", () => phraseJuste((b, c) => equivalence(b, c).replace("3 trash", "trois trash")));
refuse("rien ne tient, sans erreur", () => phraseJuste((b, c) => (b < 49 ? "" : equivalence(b, c))));
const m = (de: string, vers: string) => {
  if (!ecran.includes(de)) throw new SansPrise(`le mutant de l'écran n'a pas prise : ${de}`);
  return ecran.replace(de, vers);
};
refuse("M1 une recharge en centimes", () => ecranJuste(m("ballons(r.ballons, ESPACE_LARGE)", "ballons(r.centimes, ESPACE_LARGE)")));
refuse("M4 le prix retiré de la vignette", () => ecranJuste(m('      <Prix texte={prixDe(t)} className="st-vignette__prix tabular-nums" />\n', "")));
refuse("le nom retiré de la vignette", () => ecranJuste(m('      <Nom className="bp-titre st-vignette__nom">{t.nom}</Nom>\n', "")));
refuse("le prix avant le nom", () => ecranJuste(m('      <Nom className="bp-titre st-vignette__nom">{t.nom}</Nom>\n      <Prix texte={prixDe(t)} className="st-vignette__prix tabular-nums" />\n', '      <Prix texte={prixDe(t)} className="st-vignette__prix tabular-nums" />\n      <Nom className="bp-titre st-vignette__nom">{t.nom}</Nom>\n')));
refuse("la légende retirée du rail", () => ecranJuste(m("          <Legende t={t} />\n", "")));
refuse("la légende retirée de la fiche", () => ecranJuste(m("                <Legende t={t} titre />\n", "")));
refuse("dans la fiche, le nom n'est plus le titre de la feuille", () => ecranJuste(m("<Legende t={t} titre />", "<Legende t={t} />")));
refuse("M5 la phrase cachée", () => ecranJuste(m('<p className="st-panneau__phrase', '<p hidden className="st-panneau__phrase')));
refuse("M5 bis la phrase en sr-only", () => ecranJuste(m('<p className="st-panneau__phrase', '<p className="sr-only st-panneau__phrase')));
refuse("M6 la transition gardée en mouvement réduit", () => reduitJuste(feuille.replace(/(@media \(prefers-reduced-motion: reduce\) \{[\s\S]*)transition: none;/, "$1")));
refuse("M8 un texte d'aide dans le rail", () => ecranJuste(m('          <ul className="st-rail">', '          <p>Choisis un template pour créer ta vidéo</p>\n          <ul className="st-rail">')));
refuse("M9 une recharge touchable", () => ecranJuste(m('<li key={r.centimes} className=', '<li key={r.centimes} role="button" tabIndex={0} className=')));
refuse("M14 un aria-label qui cache le contenu", () => ecranJuste(m('className="st-item__bouton">', 'className="st-item__bouton" aria-label={t.nom}>')));
refuse("la légende cachée aux lecteurs d'écran", () => ecranJuste(m('<Boite className="st-vignette__bas">', '<Boite className="st-vignette__bas" aria-hidden>')));
refuse("une image décrite, lue en plus du nom", () => ecranJuste(m('      alt=""\n', "      alt={t.nom}\n")));
refuse("une image chargée d'emblée, même hors de l'écran", () => ecranJuste(m('loading={proche ? "eager" : "lazy"}', 'loading="eager"')));
refuse("une image sans ses deux largeurs", () => ecranJuste(m("      srcSet={sourcesVignette(t)}\n", "")));
refuse("une image sans ses dimensions", () => ecranJuste(m("      width={VIGNETTE.legere}\n      height={hauteurVignette(VIGNETTE.legere)}\n", "")));
refuse("une image qui dit les dimensions de sa boîte (4:5), pas celles de son fichier", () => ecranJuste(m("      height={hauteurVignette(VIGNETTE.legere)}\n", "      height={VIGNETTE.legere * VIGNETTE.rapport}\n")));
refuse("une image recadrée par un style", () => ecranJuste(m('      className="st-vignette__image"\n', '      className="st-vignette__image"\n      style={{ objectPosition: "50% 30%", scale: 1.3 }}\n')));
refuse("ce que tu reçois retiré du rail", () => ecranJuste(m('          <span className="line-clamp-2 min-h-[2.5em] text-[13px] leading-[1.25] text-encre-2">{t.recoit}</span>\n', "")));
refuse("la durée retirée du rail", () => ecranJuste(m("          <Duree t={t} />\n", "")));
refuse("la durée retirée de la feuille", () => ecranJuste(m("                <Duree t={t} grand />\n", "")));
refuse("une vidéo sans son triangle de lecture", () => ecranJuste(m('{t.rendu.genre === "video" && <Play ', "{false && <Play ")));
refuse("une recharge sous le taux", () => rechargesJustes(RECHARGES_STUDIO.map((r, i) => (i === 0 ? { ...r, ballons: 450 } : r))));
refuse("une recharge moins généreuse que la précédente", () => rechargesJustes(RECHARGES_STUDIO.map((r, i) => (i === 2 ? { ...r, ballons: 2100 } : r))));
refuse("un prix en dur dans l'écran", () => uneSource("écran", ecran.replace("{prixDe(t)}", "299&nbsp;⚽")));
assert.ok(pageSansLune.includes("{BALLONS_FORMULE[f]}") && ecran.includes("{prixDe(t)}") && ecran.includes("{MENTION_STUDIO}"), "les mutants de source ont prise");
refuse("des ballons en dur dans la page", () => uneSource("page", pageSansLune.replace("{BALLONS_FORMULE[f]}", "300 ⚽ / mois")));
refuse("les offerts de l'annuel en dur dans la page", () => uneSource("page", pageSansLune.replace("{BALLONS_FORMULE[f]}", '{f === "annuel" ? "+ 1 000 ⚽ offerts" : ""}')));
assert.ok(pageSansLune.includes("const COMPOSANTS"), "le mutant du studio a prise");
refuse("« + 1000 offerts » en dur sous « Ton studio »", () => uneSource("page", pageSansLune.replace("const COMPOSANTS", 'const X = <span>{"+ 1000 offerts"}</span>;\nconst COMPOSANTS')));
refuse("« 1 000 offerts à l'annuel » en dur", () => uneSource("page", pageSansLune.replace("const COMPOSANTS", 'const X = <span>{"1 000 offerts à l\'annuel"}</span>;\nconst COMPOSANTS')));
refuse("les ballons du mois en dur sous « Ton studio »", () => uneSource("écran", ecran.replace("{MENTION_STUDIO}", "300 ⚽ / mois")));
// Le raccord au carrousel.
const mf = (de: string, vers: string) => {
  if (!feuille.includes(de)) throw new SansPrise(`le mutant de la feuille n'a pas prise : ${de.slice(0, 60)}`);
  return feuille.replace(de, vers);
};
refuse("l'éventail sans la carte en vrai au milieu", () => eventailJuste(["carte-en-vrai", "maillot-a-ton-nom", "ta-saison"]));
refuse("l'éventail deux fois le même template", () => eventailJuste(["ta-saison", "carte-en-vrai", "ta-saison"]));
refuse("l'éventail d'un template inconnu", () => eventailJuste(["maillot-a-ton-nom", "carte-en-vrai", "absent"]));
refuse("l'éventail lu par un lecteur d'écran", () => ecranJuste(m('<span className="st-eventail__cartes" aria-hidden>', '<span className="st-eventail__cartes">')));
refuse("la légende sur les trois vignettes de l'éventail", () => ecranJuste(m("{i === MILIEU && <Legende t={t} />}", "<Legende t={t} />")));
refuse("la légende sur une vignette à demi cachée", () => ecranJuste(m("\nconst MILIEU = 1;\n", "\nconst MILIEU = 0;\n")));
refuse("l'éventail résumé par un aria-label", () => ecranJuste(m('className="st-eventail" onClick', 'className="st-eventail" aria-label="Bola Studio" onClick')));
refuse("l'éventail en deux boutons", () => ecranJuste(m('        <span className="st-eventail__nom">', '        <button type="button" className="st-eventail__nom">')));
refuse("le panneau jamais ouvert", () => ecranJuste(m("onClick={() => setOuvert(true)}", "onClick={() => setOuvert(false)}")));
refuse("les ballons du mois retirés de « Ton studio »", () => ecranJuste(m("{MENTION_STUDIO}</p>", "</p>")));
refuse("les recharges hors du panneau", () => ecranJuste(m("          <div className=\"px-5\">\n            <RechargesStudio />\n          </div>\n", "")));
refuse("la fiche par-dessus le panneau, hors de sa feuille", () => ecranJuste(m("        <FicheTemplate t={fiche} toi={toi} onFermer={() => setFiche(null)} />\n      </SheetContent>", "      </SheetContent>\n      <FicheTemplate t={fiche} toi={toi} onFermer={() => setFiche(null)} />")));
refuse("le panneau sans les couleurs de Bola Plus", () => ecranJuste(m('<SheetContent side="bottom" className={FEUILLE_STUDIO} style={COULEURS_STUDIO}>\n        <div className="st-panneau', '<SheetContent side="bottom" className={FEUILLE_STUDIO}>\n        <div className="st-panneau')));
refuse("une vignette teinte en violet", () => feuilleJuste(feuille + '\n.st-vignette::before {\n  content: "";\n  position: absolute;\n  inset: 0;\n  mix-blend-mode: color;\n  background: var(--bp-plus-vif);\n}\n'));
refuse("un fond violet sous l'image", () => feuilleJuste(mf("  background: #000;\n  color: #fff;\n  isolation: isolate;", "  background: var(--bp-plus-fond);\n  color: #fff;\n  isolation: isolate;")));
refuse("une image passée au filtre", () => feuilleJuste(mf("  object-fit: cover;\n", "  object-fit: cover;\n  filter: sepia(1) saturate(4);\n")));
refuse("une vignette carrée", () => feuilleJuste(mf("aspect-ratio: 4 / 5;", "aspect-ratio: 1;")));
refuse("une vignette carrée dans la fiche", () => feuilleJuste(mf("  border-radius: 24px;\n", "  border-radius: 24px;\n  aspect-ratio: 1 / 1;\n")));
refuse("une image déformée", () => feuilleJuste(mf("object-fit: cover;", "object-fit: fill;")));
refuse("une image grossie", () => feuilleJuste(mf("  object-fit: cover;\n", "  object-fit: cover;\n  scale: 1.2;\n")));
refuse("une image recadrée ailleurs qu'en haut", () => feuilleJuste(mf("  object-position: 50% 30%;\n", "  object-position: 50% 20%;\n")));
refuse("une image recadrée au centre (le cadrage ôté)", () => feuilleJuste(mf("  object-position: 50% 30%;\n", "")));
refuse("un second cadrage sur l'image", () => feuilleJuste(feuille + "\n.st-vignette--grand .st-vignette__image {\n  object-position: 50% 0%;\n}\n"));
refuse("une vignette qui bouge", () => feuilleJuste(feuille + "\n.st-vignette__image {\n  animation: st-cadrage 8s ease-in-out infinite alternate;\n}\n@keyframes st-cadrage {\n  to {\n    scale: 1.12;\n  }\n}\n"));
refuse("un voile de couleur sous la légende", () => feuilleJuste(mf("rgb(0 0 0 / 0.82) 0%", "color-mix(in srgb, var(--bp-plus-fond) 82%, transparent) 0%")));
refuse("une transition oubliée en mouvement réduit", () => feuilleJuste(mf("  .st-vignette,\n  .st-eventail__place {", "  .st-vignette {")));
refuse("une couleur dans la feuille", () => feuilleJuste(mf("rgb(0 0 0 / 0.42)", "rgb(255 138 76 / 0.42)")));
refuse("un violet écrit dans la feuille", () => feuilleJuste(mf("background: var(--bp-plus-vif);", "background: #7c3aed;")));
refuse("un violet mélangé en dur", () => feuilleJuste(mf("color-mix(in srgb, var(--bp-plus-vif) 40%", "color-mix(in srgb, rgb(124 58 237) 40%")));
refuse("le vert de la SFL dans le studio", () => feuilleJuste(mf("background: var(--bp-plus-vif);", "background: var(--bp-sfl-vif);")));
refuse("une variable de Bola Plus oubliée", () => variablesJustes(Object.fromEntries(Object.entries(VARIABLES_PLUS).filter(([k]) => k !== "--bp-plus-haut"))));
refuse("une variable de Bola Plus d'une autre teinte", () => variablesJustes({ ...VARIABLES_PLUS, "--bp-plus-clair": PALETTE.sfl.clair }));
refuse("une variable recopiée dans le panneau", () => ecranJuste(m("const COULEURS_STUDIO = VARIABLES_PLUS as CSSProperties;", 'const COULEURS_STUDIO = { ...VARIABLES_PLUS, "--bp-plus-vif": "#7C3AED" } as CSSProperties;')));
refuse("une carte « Toi » reposée sur une vignette", () => sansComposition(ecran + '\nconst X = <BolaCard name="Toi" position="ATT" overall={77} size={0.7} />;'));
refuse("un visuel de Bola Plus recadré en vignette", () => sansComposition(ecran + '\nconst X = <img src={fichierVisuel("affiche", 480)} alt="" />;'));
refuse("une autre note pour « Toi » dans la page", () => toiJuste(page.replace("overall={ovr(CARTE_TOI.stats)}", "overall={75}")));
refuse("le nombre de templates lu seul", () => ecranJuste(m('<span className="st-eventail__nombre tabular-nums" aria-hidden>', '<span className="st-eventail__nombre tabular-nums">')));
refuse("un appel réseau", () => propre("écran", ecran + "\nfetch('/api/studio');"));
refuse("un débit du porte-monnaie", () => propre("écran", ecran + "\nspendBallons(moi, 299);"));
refuse("le mouvement réduit oublié", () => feuilleJuste(feuille.replace(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*$/, "")));

refuse("un rail sans accroche", () => feuilleJuste(feuille.replace("scroll-snap-type: x mandatory;", "")));

// Le contrôle du 15/11 : la règle posée ailleurs que là où le banc regardait (une seconde règle, un parent, une classe).
const LISTE = /les règles de la feuille qui nomment une vignette/;
const SENS = /ce qui peut teinter, déformer ou découper/;
refuse("C1 la boîte rendue carrée par une hauteur, dans une autre règle", () => feuilleJuste(feuille + "\n.st-item .st-vignette {\n  height: 216px;\n}\n"), LISTE);
refuse("la boîte rendue carrée par une hauteur, dans sa règle", () => feuilleJuste(mf("  aspect-ratio: 4 / 5;\n", "  aspect-ratio: 4 / 5;\n  height: 216px;\n")), /la boîte d'une vignette : height/);
refuse("C2 la fiche carrée par une hauteur maximale", () => feuilleJuste(mf("  border-radius: 24px;\n", "  border-radius: 24px;\n  max-height: 366px;\n")), /la boîte d'une vignette : max-height/);
refuse("C10 la boîte découpée en rond", () => feuilleJuste(mf("  isolation: isolate;\n", "  isolation: isolate;\n  clip-path: circle(50%);\n")), /la boîte d'une vignette : clip-path/);
refuse("C3 une image déformée par une seconde règle", () => feuilleJuste(feuille + "\n.st-item .st-vignette__image {\n  object-fit: fill;\n  height: 70%;\n}\n"), LISTE);
refuse("C4 une image grossie par une seconde règle", () => feuilleJuste(feuille + "\n.st-vignette--grand .st-vignette__image {\n  inset: -20%;\n  width: 140%;\n  height: 140%;\n}\n"), LISTE);
refuse("C9 une image recadrée par object-view-box", () => feuilleJuste(mf("  object-fit: cover;\n", "  object-fit: cover;\n  object-view-box: inset(10% 20%);\n")), /l'image d'une vignette : une règle, rien d'autre/);
refuse("C5 l'éventail teint par le filtre de sa place", () => feuilleJuste(mf("filter: drop-shadow(0 14px 22px rgb(0 0 0 / 0.42));", "filter: drop-shadow(0 14px 22px rgb(0 0 0 / 0.42)) sepia(1) hue-rotate(220deg);")), SENS);
refuse("C6 tout le rail teint par un filtre", () => feuilleJuste(mf("  scrollbar-width: none;\n", "  scrollbar-width: none;\n  filter: sepia(1) hue-rotate(220deg);\n")), SENS);
refuse("un template grossi dans le rail", () => feuilleJuste(mf("  scroll-snap-align: start;\n", "  scroll-snap-align: start;\n  zoom: 1.2;\n")), SENS);
refuse("C7 un voile de couleur nommée sur la vignette", () => feuilleJuste(feuille + '\n.st-vignette::before {\n  content: "";\n  position: absolute;\n  inset: 0;\n  background: orchid;\n}\n'), LISTE);
refuse("un voile de couleur nommée sur un template", () => feuilleJuste(feuille + '\n.st-item::before {\n  content: "";\n  position: absolute;\n  inset: 0;\n  background: orchid;\n}\n'), /une couleur nommée dans la feuille : orchid/);
refuse("un liseré de couleur", () => feuilleJuste(mf("box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.09);", "box-shadow: inset 0 0 0 1px gold;")), /le liseré d'une vignette/);
refuse("une teinte cachée dans une variable de la feuille", () => feuilleJuste(feuille + '\n.st-item {\n  --st-teinte: orchid;\n}\n.st-item::before {\n  content: "";\n  position: absolute;\n  inset: 0;\n  background: var(--st-teinte);\n}\n'), /aucune variable définie dans la feuille/);
refuse("une teinte lue dans une variable d'ailleurs", () => feuilleJuste(feuille + '\n.st-item::before {\n  content: "";\n  position: absolute;\n  inset: 0;\n  background: var(--primary);\n}\n'), /une variable d'ailleurs dans la feuille/);
refuse("la borne de la fiche remise sous un écran court seulement", () => feuilleJuste(mf("  gap: 16px;\n  width: min(100%, max(176px, (92dvh - 298px) * 0.8));\n  margin-inline: auto;\n}", "  gap: 16px;\n}\n@media (max-height: 700px) {\n  .st-fiche {\n    width: min(100%, max(176px, (92dvh - 298px) * 0.8));\n    margin-inline: auto;\n  }\n}")), /à toute hauteur d'écran/);
refuse("la borne de la fiche restée à l'ancienne (sans la ligne de ta photo, la fiche défilerait)", () => feuilleJuste(mf("max(176px, (92dvh - 298px) * 0.8)", "max(176px, (92dvh - 222px) * 0.8)")), /à toute hauteur d'écran/);
refuse("la fiche sans plancher (en largeur, la vignette à la taille de la petite)", () => feuilleJuste(mf("width: min(100%, max(176px, (92dvh - 298px) * 0.8));", "width: min(100%, (92dvh - 298px) * 0.8);")), /à toute hauteur d'écran/);
refuse("un plancher qui fait défiler la fiche sur 320 × 568", () => feuilleJuste(mf("max(176px, ", "max(200px, ")), /défiler sur un écran de 320 × 568/);
refuse("un plancher où ta photo → ton image ne tient plus", () => feuilleJuste(mf("max(176px, ", "max(120px, ")), /n'y tient plus/);
refuse("une légende sans plancher", () => feuilleJuste(mf("font-size: max(8.6cqw, 11px);", "font-size: 8.6cqw;")), /jamais sous 11 px/);
// Le repli resté aux tailles d'avant (17 et 15 px) : sur un rail de 320 px, « TRASH TALK » reviendrait contre sa ligne de craie.
refuse("le repli sans unités de conteneur resté aux tailles d'avant", () => feuilleJuste(mf("    font-size: 16px;\n", "    font-size: 17px;\n")), /17 px, pas ce que donnent 8\.6cqw/);
refuse("le prix du repli plus grand que celui du rail étroit", () => feuilleJuste(mf("    font-size: 14.5px;\n", "    font-size: 15px;\n")), /15 px, pas ce que donnent 7\.8cqw/);
const sansRepli = feuille.replace(/\n@supports not \(width: 1cqw\) \{[\s\S]*?\n\}\n/, "\n");
if (sansRepli === feuille) throw new SansPrise("le mutant du repli n'a pas prise");
refuse("une légende sans repli (sans unités de conteneur)", () => feuilleJuste(sansRepli), LISTE);
const TORDUE = /une classe qui teinte, recadre ou déforme/;
refuse("T1 l'éventail teint par une classe", () => ecranJuste(m('              <span className="st-vignette">', '              <span className="st-vignette sepia hue-rotate-180">')), TORDUE);
refuse("T3 la vignette du rail carrée par une classe", () => ecranJuste(m('        <span className="st-vignette">', '        <span className="st-vignette aspect-square!">')), TORDUE);
refuse("une place de l'éventail saturée par une classe", () => ecranJuste(m('className="st-eventail__place" data-place={i}>', 'className="st-eventail__place saturate-200" data-place={i}>')), TORDUE);
refuse("une vignette de l'éventail avec une classe de plus", () => ecranJuste(m('              <span className="st-vignette">', '              <span className="st-vignette dark">')), /l'éventail : trois vignettes telles quelles/);
refuse("la vignette du rail carrée par un style", () => ecranJuste(m('        <span className="st-vignette">', '        <span className="st-vignette" style={{ height: 216 }}>')), /les styles posés par l'écran/);
const SOUS = /sa copie légère sous l'original/;
refuse("la fiche sans la copie légère sous l'original (elle s'ouvrirait sur un cadre noir)", () => ecranJuste(m("                <ImageLegere t={t} />\n", "")), SOUS);
refuse("la copie légère par-dessus l'original", () => ecranJuste(m('                <ImageLegere t={t} />\n                <ImageTemplate t={t} cadre="page" />\n', '                <ImageTemplate t={t} cadre="page" />\n                <ImageLegere t={t} />\n')), SOUS);
refuse("sous l'original, l'original lui-même (rien n'est encore chargé)", () => ecranJuste(m('<img className="st-vignette__image" src={fichierVignette(t, VIGNETTE.legere)}', '<img className="st-vignette__image" src={fichierVignette(t)}')), /la copie légère, telle quelle/);
refuse("la fiche sans sa colonne bornée", () => ecranJuste(m('            <div className="st-fiche">\n', '            <div className="st-fiche" />\n            <div>\n')), SOUS);
refuse("T2 le rail charge l'original (un cadre à la largeur de l'écran)", () => cadresJustes(m('rail: "min(216px, 58vw)"', 'rail: "100vw"'), feuille), /le cadre « rail »/);
refuse("un rail élargi dans la feuille, sans son cadre", () => cadresJustes(ecran, mf("  width: min(216px, 58vw);\n", "  width: min(300px, 80vw);\n")), /le cadre « rail »/);
refuse("le cadre de la fiche pris pour celui du rail", () => cadresJustes(m('page: "min(406px, calc(100vw - 24px))"', 'page: "min(216px, 58vw)"'), feuille), /le cadre « page »/);

// Les vignettes : les fichiers. Un WebP de travers se fabrique en changeant la taille écrite dans son en-tête (VP8 simple).
const retaille = (o: Buffer, largeur: number, hauteur: number) => {
  assert.equal(o.subarray(12, 16).toString("latin1"), "VP8 ", "les vignettes sont du WebP simple (VP8)");
  const c = Buffer.from(o);
  c.writeUInt16LE((c.readUInt16LE(26) & 0xc000) | largeur, 26);
  c.writeUInt16LE((c.readUInt16LE(28) & 0xc000) | hauteur, 28);
  return c;
};
const premiere = fichierVignette(TEMPLATES[0]);
const legere = fichierVignette(TEMPLATES[5], VIGNETTE.legere);
assert.deepEqual(tailleWebp(retaille(surDisque(premiere)!, 1100, 1100)), { largeur: 1100, hauteur: 1100 }, "le mutant des tailles a prise");
const sauf = (adresse: string, autre: (o: Buffer) => Buffer | null): Lecteur => (a) => (a === adresse ? autre(surDisque(a)!) : surDisque(a));
const PAS_34 = /pas du 3:4 des images fournies/;
refuse("une vignette absente", () => vignettesJustes(TEMPLATES, sauf(fichierVignette(TEMPLATES[11]), () => null)), /manque/);
refuse("une copie légère absente", () => vignettesJustes(TEMPLATES, sauf(legere, () => null)), /manque/);
refuse("une vignette carrée (le fichier)", () => vignettesJustes(TEMPLATES, sauf(premiere, (o) => retaille(o, 1100, 1100))), PAS_34);
// Un fichier recadré en 4:5 avant d'être posé : la boîte le recadre déjà, il perdrait deux fois le haut et le bas.
refuse("une vignette déjà recadrée en 4:5 (le fichier)", () => vignettesJustes(TEMPLATES, sauf(premiere, (o) => retaille(o, 1100, 1375))), PAS_34);
refuse("une vignette en 3:4 arrondi (1100 × 1467)", () => vignettesJustes(TEMPLATES, sauf(premiere, (o) => retaille(o, 1100, 1467))), PAS_34);
refuse("une vignette en 16:9", () => vignettesJustes(TEMPLATES, sauf(premiere, (o) => retaille(o, 1100, 619))), PAS_34);
refuse("une vignette rognée de deux lignes", () => vignettesJustes(TEMPLATES, sauf(premiere, (o) => retaille(o, 1100, 1468))), PAS_34);
// Un fichier à la taille de ceux de l'après-midi du 16/11 (896 × 1120, en 4:5) : ce n'est plus la vignette attendue.
refuse("une vignette à l'ancienne taille (896 × 1120)", () => vignettesJustes(TEMPLATES, sauf(premiere, (o) => retaille(o, 896, 1120))), /px de large, attendu 1100/);
// Le fichier fourni tel quel (1320 × 1764) : trop lourd pour le web, les vingt-quatre passeraient 1,5 Mo.
refuse("le fichier fourni tel quel (1320 × 1764)", () => vignettesJustes(TEMPLATES, sauf(premiere, (o) => retaille(o, 1320, 1764))), /px de large, attendu 1100/);
refuse("une copie légère carrée", () => vignettesJustes(TEMPLATES, sauf(legere, (o) => retaille(o, 660, 660))), PAS_34);
refuse("une copie légère en 4:5 (660 × 825)", () => vignettesJustes(TEMPLATES, sauf(legere, (o) => retaille(o, 660, 825))), PAS_34);
refuse("une copie légère qui n'a pas sa largeur", () => vignettesJustes(TEMPLATES, sauf(legere, (o) => retaille(o, 480, 600))), /px de large, attendu 660/);
refuse("une vignette trop lourde", () => vignettesJustes(TEMPLATES, sauf(premiere, (o) => Buffer.concat([o, Buffer.alloc(200_000)]))), /octets, au plus/);
refuse("un fichier qui n'est pas du WebP", () => vignettesJustes(TEMPLATES, sauf(premiere, () => Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>".padEnd(64)))), /du WebP/);
// Le contrôle du 15/11 : le bon nom et la bonne taille ne suffisent pas, c'est l'image qui compte (son empreinte).
const PAS_ELLE = /ce n'est pas l'image posée/;
const echange = (a: string, b: string): Lecteur => (x) => surDisque(x === a ? b : x === b ? a : x);
refuse("deux fichiers échangés, leurs noms gardés (la célébration sous « Trash talk »)", () => vignettesJustes(TEMPLATES, echange(fichierVignette(TEMPLATES[4]), fichierVignette(TEMPLATES[5]))), PAS_ELLE);
refuse("deux copies légères échangées", () => vignettesJustes(TEMPLATES, echange(fichierVignette(TEMPLATES[4], VIGNETTE.legere), legere)), PAS_ELLE);
refuse("la même image sous deux noms", () => vignettesJustes(TEMPLATES, sauf(fichierVignette(TEMPLATES[4]), () => surDisque(fichierVignette(TEMPLATES[5])))), PAS_ELLE);
/** Un fichier teint, retouché ou recodé : même nom, même taille, une autre image (ici, un octet de ses données change). */
const retouche = (o: Buffer) => {
  const c = Buffer.from(o);
  c[c.length >> 1] ^= 0xff;
  return c;
};
refuse("un fichier teint, retouché ou recodé", () => vignettesJustes(TEMPLATES, sauf(premiere, retouche)), PAS_ELLE);
refuse("une copie légère teinte, retouchée ou recodée", () => vignettesJustes(TEMPLATES, sauf(legere, retouche)), PAS_ELLE);
refuse("onze templates", () => vignettesJustes(TEMPLATES.slice(0, 11)));
refuse("deux vignettes échangées", () => vignettesJustes(TEMPLATES.map((t, i) => (i === 5 ? { ...t, image: TEMPLATES[6].image } : i === 6 ? { ...t, image: TEMPLATES[5].image } : t))));
refuse("deux templates, la même vignette", () => vignettesJustes(TEMPLATES.map((t, i) => (i === 3 ? { ...t, image: TEMPLATES[0].image } : t))));
refuse("le catalogue dans un autre ordre que les fichiers", () => vignettesJustes([TEMPLATES[1], TEMPLATES[0], ...TEMPLATES.slice(2)]));
refuse("une vignette au nom d'un autre modèle", () => vignettesJustes(TEMPLATES.map((t, i) => (i === 7 ? { ...t, image: "08-la-camera" } : t))));
refuse("un fichier de trop dans le dossier", () => dossierJuste([...readdirSync(DOSSIER_STUDIO), "13-bonus.webp"]));
refuse("une copie légère de moins dans le dossier", () => dossierJuste(readdirSync(DOSSIER_STUDIO).filter((f) => f !== legere.split("/").pop())));

// Toi, dedans (16/11).
const TOI = /la photo de ta carte|la pastille|ta photo → ton image|sans photo|une photo qui ne se charge pas|le panneau lit la photo/;
refuse("la pastille par usePlayerPhoto (sans photo, une image cassée)", () => dedansJuste(m("photo: usePhotoPerso(nom)", "photo: usePlayerPhoto(nom)"), feuille), TOI);
refuse("la photo en miniature (une autre adresse, une requête de plus)", () => dedansJuste(m("photo: usePhotoPerso(nom)", "photo: photoMiniature(usePhotoPerso(nom) ?? \"\")"), feuille), TOI);
refuse("la photo d'un autre que le joueur connecté", () => dedansJuste(m("const nom = player?.name ?? me;", "const nom = player?.name ?? \"Toi\";"), feuille), TOI);
refuse("une photo cassée laissée cassée", () => dedansJuste(m("          onError={() => setCassee(photo)}\n", ""), feuille), TOI);
refuse("sans photo, une pastille vide", () => dedansJuste(m("          {toi.nom.slice(0, 1).toUpperCase()}\n", ""), feuille), TOI);
refuse("la pastille lue par un lecteur d'écran", () => dedansJuste(m('<span className="st-toi" aria-hidden>', '<span className="st-toi">'), feuille), TOI);
refuse("la pastille retirée du rail", () => ecranJuste(m("          <PastilleToi toi={toi} />\n        </span>", "        </span>")), /la photo de ta carte/);
refuse("la ligne retirée de la fiche", () => ecranJuste(m("              <LigneToi t={t} toi={toi} />\n", "")), /ta photo → ton image/);
refuse("un mot dans ta photo → ton image", () => dedansJuste(m('      <span className="st-ligne__image">', '      <span>ton image</span>\n      <span className="st-ligne__image">'), feuille), TOI);
refuse("le sous-titre sans « Avec ta photo. »", () => ecranJuste(m('<span className="st-panneau__avec">{AVEC_TA_PHOTO}</span> ', "")), /Avec ta photo/);
refuse("« Avec ta photo. » collé à la phrase", () => ecranJuste(m("{AVEC_TA_PHOTO}</span> {PHRASE_INCLUS}", "{AVEC_TA_PHOTO}</span>{PHRASE_INCLUS}")), /Avec ta photo/);
refuse("la pastille teinte en or", () => feuilleJuste(mf("box-shadow: 0 0 0 2px #fff, ", "box-shadow: 0 0 0 2px #e0b23c, ")), /pas d'autre teinte écrite que le noir et le blanc/);
refuse("la pastille carrée", () => dedansJuste(ecran, mf("  border-radius: 999px;\n  background: #000;", "  border-radius: 4px;\n  background: #000;")), TOI);

console.log(`studio : ok (bonus des recharges : ${RECHARGES_STUDIO.map((r) => `${prixRecharge(r)} € → +${bonusDe(r)}`).join(", ")} ; ${TEMPLATES.length} vignettes en 3:4, montrées en 4:5, ${Math.round(POIDS_STUDIO / 1000)} ko)`);
