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
//   5 · les vignettes : chaque fond est un visuel de public/bola-plus/ à ses
//       trois largeurs ; la carte est la vraie (BolaCard, DosCarte) ; une
//       vidéo bouge (data-video posé), et s'arrête avec « Réduire les
//       animations », transition comprise ; le rail s'accroche au doigt ;
//       noir et blanc dans la feuille ;
//   6 · ce qui se voit et se lit : rien de caché (hidden, sr-only…) dans
//       l'écran du studio ; les mots écrits en dur sont une liste fermée (ni
//       texte d'aide ni sous-titre) ; le rail montre la durée et le prix,
//       la feuille aussi ; la scène est cachée aux lecteurs d'écran, le
//       bouton d'un template n'a pas d'aria-label (son texte se lit en
//       entier) ; une recharge montre ses ballons (pas ses centimes) et son
//       prix, sans geste ni focus.
//   Des mutants sont rejoués : chaque garde doit les refuser.
//   npx tsx tools/studio-check.ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BALLONS_PAR_EURO } from "../src/lib/sfl/ballons";
import { LARGEURS, fichierVisuel } from "../src/lib/sfl/bola-plus";
import {
  BALLONS_FORMULE,
  BALLONS_PAR_MOIS,
  MENTION_STUDIO,
  OFFERTS_ANNUEL,
  PHRASE_INCLUS,
  RECHARGES_STUDIO,
  TEMPLATES,
  ballons,
  bonusDe,
  dureeDe,
  equivalence,
  prixDe,
  prixRecharge,
  sceneStudio,
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
assert.equal(sceneStudio("affiche").pose, "vise", "« Ton studio » : le ballon au centre, sans carte");
assert.throws(() => sceneStudio("absente"), "« Ton studio » : un fond inconnu est refusé");
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
const NOMBRES = /(?<![\w.[-])(49|79|99|199|299|399|499|599|300|1000|1100|2400|500|499|999|1999)(?![\w\]%])|\d+\s*(⚽|&nbsp;⚽)|4,99|9,99|19,99/;
const uneSource = (nom: string, t: string) => {
  const code = sansNotes(t).replace(/\[[\d.]+(px|em|%)?\]/g, "").replace(/-\[[^\]]*\]/g, "");
  const trouve = NOMBRES.exec(code);
  assert.equal(trouve, null, `${nom} écrit un prix ou des ballons en dur : ${trouve?.[0]}`);
};
uneSource("studio-bola.tsx", ecran);
// La lune de l'emblème (300 / 236) est une proportion du dos de la carte, pas un prix.
uneSource("bola-plus.tsx", page.replace("const LUNE = (300 / 236) * ROSACE.r1;", ""));
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
assert.ok(/\{PHRASE_INCLUS\}/.test(ecran) && /TEMPLATES\.map\(/.test(ecran), "le rail lit la source");

// 5 · Les vignettes et la feuille.
const PUBLIC = join(__dirname, "..", "public");
for (const t of TEMPLATES) for (const l of LARGEURS) assert.ok(existsSync(join(PUBLIC, fichierVisuel(t.scene.fond, l))), `${t.nom} : ${fichierVisuel(t.scene.fond, l)}`);
for (const f of ["bola/logo-blanc.svg", "bola/symbole-blanc.svg"]) assert.ok(existsSync(join(PUBLIC, f)), f);
assert.ok(/<BolaCard \{\.\.\.TOI\}/.test(ecran) && /<DosCarte /.test(ecran), "la vraie carte « Toi », face et dos");
assert.ok(/const TOI = \{ name: "Toi", position: "MC", overall: 75 \} as const;/.test(ecran) && !/photo=|username=/.test(ecran), "une carte anonyme : « Toi », sans photo ni pseudo");
const feuilleJuste = (css: string) => {
  const reduit = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/.exec(css)?.[1] ?? "";
  assert.ok(/\.st-scene\[data-video\] \.st-scene__fond[^{]*\{[^}]*animation: none;/.test(reduit), "mouvement réduit : le cadrage d'une vidéo s'arrête");
  assert.ok(/\.st-scene\[data-video\] \.st-scene__fond \{\s*animation: st-cadrage/.test(css), "une vidéo : le cadrage avance");
  assert.ok(/scroll-snap-type: x mandatory;/.test(css) && /scroll-snap-align: start;/.test(css), "le rail s'accroche carte par carte");
  const code = sansNotes(css);
  for (const m of code.matchAll(/rgb\((\d+) (\d+) (\d+)/g)) assert.ok(Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) <= 8, `une couleur dans la feuille : ${m[0]}`);
  assert.ok(!/#(?!fff\b|000\b)[0-9a-f]{3,8}\b/i.test(code), "pas d'autre teinte que le noir et le blanc");
  assert.ok(!/\b(hsla?|oklch|color-mix)\(|:\s*[^;{}]*\b(gold|red|orange|yellow|green|blue|purple)\b/.test(code), "aucune couleur nommée ni calculée");
};
feuilleJuste(feuille);

// 6 · Ce qui se voit et se lit.
const bloc = (tsx: string, nom: string) => {
  const debut = tsx.indexOf(`function ${nom}(`);
  assert.ok(debut >= 0, `${nom} est trouvée`);
  return tsx.slice(debut, tsx.indexOf("\n}\n", debut));
};
const CACHE = /(^|[\s:"])(hidden|sr-only|invisible|opacity-0)(?=[\s"])|\shidden(?=[\s>={/])/;
const ecranJuste = (tsx: string) => {
  const code = sansNotes(tsx);
  const cache = CACHE.exec(code);
  assert.equal(cache, null, `quelque chose est caché dans l'écran du studio : ${cache?.[0]}`);
  // Les mots écrits en dur : une liste fermée (entre deux balises ; le code entre « > » et « < » est écarté).
  const mots = [...code.matchAll(/>([^<>{}]*[A-Za-zÀ-ÿ][^<>{}]*)</g)].map((m) => m[1].trim()).filter((t) => t && !/[;()=]/.test(t)).sort();
  assert.deepEqual(mots, ["Bientôt", "Bola Studio", "Recharges"], "les mots écrits en dur dans l'écran du studio");
  const scene = bloc(tsx, "SceneStudio");
  assert.ok(/<div\s+ref=\{ref\}\s+aria-hidden\s/.test(scene), "la scène est cachée aux lecteurs d'écran");
  assert.ok(/data-video=\{video \? "" : undefined\}/.test(scene), "une vidéo porte data-video");
  const item = bloc(tsx, "CarteTemplate");
  assert.ok(!/aria-label/.test(item), "le bouton d'un template se lit en entier (pas d'aria-label)");
  assert.ok(/\{t\.nom\}/.test(item) && /\{t\.recoit\}/.test(item) && /<Meta t=\{t\} \/>/.test(item), "le rail : nom, ce que tu reçois, durée et prix");
  const meta = bloc(tsx, "Meta");
  assert.ok(/\{dureeDe\(t\)\}/.test(meta) && /\{prixDe\(t\)\}/.test(meta), "la durée et le prix d'un template");
  const fiche = bloc(tsx, "FicheTemplate");
  assert.ok(/\{t\.nom\}/.test(fiche) && /\{t\.recoit\}/.test(fiche) && /\{dureeDe\(t\)\}/.test(fiche) && /texte=\{prixDe\(t\)\}/.test(fiche), "la feuille : nom, ce que tu reçois, durée et prix");
  const rail = bloc(tsx, "RailStudio");
  assert.ok(/<p[^>]*>\{PHRASE_INCLUS\}<\/p>/.test(rail), "la phrase des ballons du mois se voit");
  const rech = tsx.slice(tsx.indexOf("export function RechargesStudio("));
  assert.ok(/ballons\(r\.ballons, ESPACE_LARGE\)/.test(rech) && /\{prixRecharge\(r\)\}/.test(rech) && !/r\.centimes\)/.test(rech.replace("key={r.centimes}", "")), "une recharge : ses ballons et son prix");
  assert.ok(!/<button|onClick|href=|role=|tabIndex/.test(rech), "une recharge : ni geste, ni focus");
};
ecranJuste(ecran);
const reduitJuste = (css: string) => {
  const reduit = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/.exec(css)?.[1] ?? "";
  assert.ok(/\.st-scene,[^{]*\{[^}]*transition: none;/.test(reduit), "mouvement réduit : la vignette ne s'enfonce pas");
};
reduitJuste(feuille);

// Les mutants.
const refuse = (nom: string, essai: () => void) => {
  let passe = true;
  try {
    essai();
  } catch {
    passe = false;
  }
  assert.ok(!passe, `mutant accepté : ${nom}`);
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
  assert.ok(ecran.includes(de), `le mutant a prise : ${de}`);
  return ecran.replace(de, vers);
};
refuse("M1 une recharge en centimes", () => ecranJuste(m("ballons(r.ballons, ESPACE_LARGE)", "ballons(r.centimes, ESPACE_LARGE)")));
refuse("M2 data-video jamais posé", () => ecranJuste(m('data-video={video ? "" : undefined}', "data-video={undefined}")));
refuse("M4 le prix retiré du rail", () => ecranJuste(m('<span className="text-foreground">{prixDe(t)}</span>', "")));
refuse("M5 la phrase cachée", () => ecranJuste(m("<p className=\"text-corps", "<p hidden className=\"text-corps")));
refuse("M5 bis la phrase en sr-only", () => ecranJuste(m("<p className=\"text-corps", "<p className=\"sr-only text-corps")));
refuse("M6 la transition gardée en mouvement réduit", () => reduitJuste(feuille.replace(/(@media \(prefers-reduced-motion: reduce\) \{[\s\S]*)transition: none;/, "$1")));
refuse("M8 un texte d'aide dans le rail", () => ecranJuste(m("      <ul className=\"st-rail\">", "      <p>Choisis un template pour créer ta vidéo</p>\n      <ul className=\"st-rail\">")));
refuse("M9 une recharge touchable", () => ecranJuste(m('<li key={r.centimes} className=', '<li key={r.centimes} role="button" tabIndex={0} className=')));
refuse("M14 un aria-label qui cache le contenu", () => ecranJuste(m('className="st-item__bouton">', 'className="st-item__bouton" aria-label={t.nom}>')));
refuse("la scène lue par un lecteur d'écran", () => ecranJuste(m("      aria-hidden\n", "")));
refuse("la durée retirée de la feuille", () => ecranJuste(m("                  {dureeDe(t)}\n                </span>\n              </span>", "                </span>\n              </span>")));
refuse("une recharge sous le taux", () => rechargesJustes(RECHARGES_STUDIO.map((r, i) => (i === 0 ? { ...r, ballons: 450 } : r))));
refuse("une recharge moins généreuse que la précédente", () => rechargesJustes(RECHARGES_STUDIO.map((r, i) => (i === 2 ? { ...r, ballons: 2100 } : r))));
refuse("un prix en dur dans l'écran", () => uneSource("écran", ecran.replace("{prixDe(t)}", "299&nbsp;⚽")));
const pageSansLune = page.replace("const LUNE = (300 / 236) * ROSACE.r1;", "");
assert.ok(pageSansLune.includes("{MENTION_STUDIO}") && ecran.includes("{prixDe(t)}"), "les mutants de source ont prise");
refuse("des ballons en dur dans la page", () => uneSource("page", pageSansLune.replace("{MENTION_STUDIO}", "300 ⚽ / mois")));
refuse("un appel réseau", () => propre("écran", ecran + "\nfetch('/api/studio');"));
refuse("un débit du porte-monnaie", () => propre("écran", ecran + "\nspendBallons(moi, 299);"));
refuse("le mouvement réduit oublié", () => feuilleJuste(feuille.replace(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*$/, "")));
refuse("une couleur dans la feuille", () => feuilleJuste(feuille.replace("rgb(40 40 40)", "rgb(255 138 76)")));
refuse("un rail sans accroche", () => feuilleJuste(feuille.replace("scroll-snap-type: x mandatory;", "")));

console.log(`studio : ok (bonus des recharges : ${RECHARGES_STUDIO.map((r) => `${prixRecharge(r)} € → +${bonusDe(r)}`).join(", ")})`);
