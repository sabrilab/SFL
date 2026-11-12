// La boutique (accueil, grille filtrable, fiche produit ; 12/11/2026) : ce
// que la vitrine promet, rejoué sans navigateur.
//   1. le catalogue : huit pièces, chaque image citée existe, chaque coloris
//      a son devant et son dos, les tailles sont sur l'échelle S à 3XL ;
//   2. les rayons : maillots 3, vestiaire 4, survêts 1, fondateurs 1, tout 8,
//      favoris = les ids donnés ;
//   3. les filtres : OU dans une section, ET entre sections ;
//   4. le tri : stable à prix égal, « Nouveautés » = l'ordre du catalogue ;
//   5. l'adresse : un aller-retour rend la même recherche, l'inconnu est ignoré ;
//   6. les libellés : singulier et pluriel ;
//   7. « Tu aimeras aussi » : quatre pièces, jamais la pièce, sa ligne d'abord ;
//   8. les vues de la fiche et le coloris montré par la grille ;
//   9. les garde-fous de la DA et de la demande, lus dans le code de la
//      boutique : ni ton de couleur sur un bouton, ni blanc nu (mode clair),
//      ni prix barré, ni paiement, ni taille de texte hors jetons, ni marque
//      d'autrui.
//   npx tsx tools/boutique-check.ts
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  RAYONS,
  RECHERCHE_VIDE,
  SANS_FILTRE,
  TAILLES,
  TRANCHES,
  TRIS,
  adresseGrille,
  aussi,
  basculer,
  colorisMontre,
  ecrireRecherche,
  filtrer,
  lireRecherche,
  nombreArticles,
  nombreCouleurs,
  nombreDeFiltres,
  trier,
  voirLesArticles,
  vuesFiche,
  type Filtres,
  type Recherche,
} from "../src/lib/boutique/catalogue";
import { CATEGORIES, PRODUITS, produitDe } from "../src/lib/boutique/produits";

const racine = new URL("..", import.meta.url).pathname;
const ids = (l: { id: string }[]) => l.map((p) => p.id);
const f = (x: Partial<Filtres>): Filtres => ({ ...SANS_FILTRE, ...x });

// 1 · Le catalogue.
{
  assert.equal(PRODUITS.length, 8, "huit pièces");
  assert.equal(new Set(ids(PRODUITS)).size, 8, "des ids uniques");
  for (const p of PRODUITS) {
    assert.ok(/^[a-z0-9-]+$/.test(p.id), `${p.id} : un id qui tient dans une adresse`);
    assert.ok(p.type && p.description && CATEGORIES.includes(p.categorie), `${p.id} : type, description, catégorie`);
    assert.ok(Number.isInteger(p.euros) && p.euros > 0, `${p.id} : un prix entier`);
    assert.ok(p.porte.length >= 1 && p.coloris.length >= 1 && p.tailles.length >= 1, `${p.id} : photos, coloris, tailles`);
    assert.ok(p.tailles.every((t) => (TAILLES as readonly string[]).includes(t)), `${p.id} : tailles sur l'échelle`);
    assert.equal(new Set(p.coloris.map((c) => c.nom)).size, p.coloris.length, `${p.id} : un coloris par nom`);
    for (const c of p.coloris) {
      assert.equal(c.aPlat.length, p.id === "survet-olympe" ? 3 : 2, `${p.id} ${c.nom} : devant et dos`);
      assert.ok(c.aPlat[0].includes("-front") && c.aPlat[1].includes("-back"), `${p.id} ${c.nom} : devant puis dos`);
    }
    for (const src of [...p.porte, ...p.coloris.flatMap((c) => c.aPlat)]) {
      assert.ok(existsSync(join(racine, "public", src)), `${src} existe`);
    }
  }
  assert.deepEqual(produitDe("polo-club")?.euros, 45);
  assert.equal(produitDe("inconnu"), undefined);
}

// 2 · Les rayons.
{
  const n = (r: Recherche["rayon"], fav: string[] = []) => filtrer(PRODUITS, r, SANS_FILTRE, fav).length;
  assert.deepEqual(
    [n("maillots"), n("vestiaire"), n("survets"), n("fondateurs"), n("tout")],
    [3, 4, 1, 1, 8],
  );
  assert.equal(n("favoris"), 0, "aucun favori : rayon vide");
  assert.deepEqual(
    ids(filtrer(PRODUITS, "favoris", SANS_FILTRE, ["sweat-fondateurs", "disparu", "polo-club"])),
    ["polo-club", "sweat-fondateurs"],
    "les favoris, dans l'ordre du catalogue, sans les ids inconnus",
  );
  assert.deepEqual(ids(RAYONS), ["maillots", "vestiaire", "survets", "fondateurs", "tout", "favoris"]);
}

// 3 · Les filtres.
{
  const n = (x: Partial<Filtres>, r: Recherche["rayon"] = "tout") => filtrer(PRODUITS, r, f(x)).length;
  const blanc = filtrer(PRODUITS, "tout", f({ couleurs: ["Blanc"] }));
  assert.equal(blanc.length, 6);
  assert.ok(!ids(blanc).includes("maillot-phases") && !ids(blanc).includes("survet-olympe"), "ni Phases ni Olympe en blanc");
  assert.equal(n({ couleurs: ["Noir"] }), 8);
  assert.equal(n({ couleurs: ["Noir", "Blanc"] }), 8, "OU dans la section Couleur");
  assert.equal(n({ tailles: ["3XL"] }), 4);
  assert.equal(n({ tailles: ["S"] }), 7, "le maillot Noirs / Blancs n'a pas de S");
  assert.equal(n({ tailles: ["S", "3XL"] }), 7, "OU dans la section Taille");
  assert.deepEqual(
    TRANCHES.map((t) => n({ prix: [t.id] })),
    [5, 1, 2],
  );
  assert.equal(n({ prix: ["moins-de-40", "plus-de-60"] }), 7, "OU dans la section Prix");
  assert.equal(n({ categories: ["Maillots", "Polos"] }), 4, "OU dans la section Catégorie");
  assert.equal(n({ categories: ["Maillots"], couleurs: ["Blanc"] }), 2, "ET entre sections");
  assert.equal(n({ categories: ["Maillots"], couleurs: ["Blanc"], tailles: ["S"] }), 1);
  assert.equal(n({ categories: ["Sweats"], prix: ["moins-de-40"] }), 0, "rien : liste vide");
  assert.equal(n({ categories: ["Polos"] }, "maillots"), 0, "le rayon resserre aussi");
  // Chaque prix tombe dans une tranche, et une seule.
  for (const p of PRODUITS) assert.equal(TRANCHES.filter((t) => t.dedans(p.euros)).length, 1, `${p.id} : une tranche`);
  for (const e of [39, 40, 60, 61]) assert.equal(TRANCHES.filter((t) => t.dedans(e)).length, 1, `${e} € : une tranche`);

  let x = SANS_FILTRE;
  x = basculer(x, "couleurs", "Blanc");
  x = basculer(x, "tailles", "L");
  assert.equal(nombreDeFiltres(x), 2);
  x = basculer(x, "couleurs", "Blanc");
  assert.deepEqual(x, f({ tailles: ["L"] }), "recocher décoche");
  assert.equal(nombreDeFiltres(SANS_FILTRE), 0);
}

// 4 · Le tri.
{
  assert.deepEqual(ids(trier(PRODUITS, "nouveautes")), ids(PRODUITS), "Nouveautés : l'ordre du catalogue");
  const croissant = trier(PRODUITS, "prix-croissant");
  assert.deepEqual(
    croissant.map((p) => p.euros),
    [35, 35, 35, 35, 39, 45, 65, 99],
  );
  assert.deepEqual(
    ids(croissant).slice(0, 4),
    ["maillot-noirs-blancs", "maillot-dimanche", "maillot-phases", "raglan-le-ballon-parle"],
    "à prix égal, l'ordre du catalogue",
  );
  const decroissant = trier(PRODUITS, "prix-decroissant");
  assert.deepEqual(
    decroissant.map((p) => p.euros),
    [99, 65, 45, 39, 35, 35, 35, 35],
  );
  assert.deepEqual(
    ids(decroissant).slice(4),
    ["maillot-noirs-blancs", "maillot-dimanche", "maillot-phases", "raglan-le-ballon-parle"],
    "décroissant : stable aussi",
  );
  assert.deepEqual(ids(trier(PRODUITS, "prix-croissant")), ids(croissant), "le catalogue n'est pas trié en place");
  assert.equal(PRODUITS[0].id, "maillot-noirs-blancs");
  assert.deepEqual(ids(TRIS), ["nouveautes", "prix-croissant", "prix-decroissant"]);
}

// 5 · L'adresse.
{
  const lire = (q: string) => lireRecherche(new URLSearchParams(q));
  assert.deepEqual(lire(""), RECHERCHE_VIDE, "adresse vide : tout, sans filtre, Nouveautés");
  assert.equal(ecrireRecherche(RECHERCHE_VIDE), "", "le défaut ne s'écrit pas");
  const pleine: Recherche = {
    rayon: "vestiaire",
    tri: "prix-decroissant",
    filtres: { categories: ["T-shirts", "Polos"], couleurs: ["Blanc"], tailles: ["S", "3XL"], prix: ["moins-de-40", "40-a-60"] },
  };
  assert.deepEqual(lire(ecrireRecherche(pleine)), pleine, "aller-retour");
  assert.equal(ecrireRecherche(lire(ecrireRecherche(pleine))), ecrireRecherche(pleine), "adresse stable");
  for (const r of RAYONS) for (const t of TRIS) {
    const x = { ...RECHERCHE_VIDE, rayon: r.id, tri: t.id };
    assert.deepEqual(lire(ecrireRecherche(x)), x);
  }
  assert.deepEqual(
    lire("rayon=promo&tri=hasard&couleur=Rouge,Blanc&taille=XS&prix=gratuit&categorie=Montres&autre=1"),
    { ...RECHERCHE_VIDE, filtres: f({ couleurs: ["Blanc"] }) },
    "les valeurs inconnues sont ignorées",
  );
  assert.deepEqual(lire("couleur=Blanc&couleur=Noir&couleur=Blanc").filtres.couleurs, ["Noir", "Blanc"], "sans doublon, dans l'ordre de la section");
  assert.equal(adresseGrille(), "/boutique/articles");
  assert.equal(adresseGrille({ rayon: "maillots" }), "/boutique/articles?rayon=maillots");
  assert.equal(adresseGrille({ filtres: { couleurs: ["Blanc"] } }), "/boutique/articles?couleur=Blanc");
}

// 6 · Les libellés.
{
  assert.deepEqual([nombreArticles(0), nombreArticles(1), nombreArticles(8)], ["0 articles", "1 article", "8 articles"]);
  assert.deepEqual([nombreCouleurs(1), nombreCouleurs(2)], ["1 couleur", "2 couleurs"]);
  assert.deepEqual([voirLesArticles(0), voirLesArticles(1), voirLesArticles(8)], ["Aucun article", "Voir l'article", "Voir les 8 articles"]);
}

// 7 · « Tu aimeras aussi ».
for (const p of PRODUITS) {
  const a = aussi(p);
  assert.equal(a.length, 4, `${p.id} : quatre pièces`);
  assert.ok(!ids(a).includes(p.id), `${p.id} : jamais elle-même`);
  assert.equal(new Set(ids(a)).size, 4, `${p.id} : sans doublon`);
  const memeLigne = PRODUITS.filter((x) => x.ligne === p.ligne && x.id !== p.id).slice(0, 4);
  assert.deepEqual(ids(a).slice(0, memeLigne.length), ids(memeLigne), `${p.id} : sa ligne d'abord`);
}

// 8 · Les vues de la fiche, le coloris de la grille.
{
  const maillot = produitDe("maillot-noirs-blancs")!;
  assert.deepEqual(
    vuesFiche(maillot, 0).map((v) => v.aPlat),
    [false, false, true, true],
    "premier coloris : les photos portées d'abord",
  );
  assert.deepEqual(
    vuesFiche(maillot, 1).map((v) => v.aPlat),
    [true, true, false, false],
    "autre coloris : ses vues à plat d'abord",
  );
  assert.ok(vuesFiche(maillot, 1)[0].src.includes("white-front"));
  assert.equal(vuesFiche(produitDe("survet-olympe")!, 0).length, 5);
  assert.equal(colorisMontre(maillot, SANS_FILTRE), 0);
  assert.equal(colorisMontre(maillot, f({ couleurs: ["Blanc"] })), 1, "filtre Blanc : le blanc devant");
  assert.equal(colorisMontre(maillot, f({ couleurs: ["Noir", "Blanc"] })), 0);
  assert.equal(colorisMontre(produitDe("maillot-phases")!, f({ couleurs: ["Blanc"] })), 0, "une pièce sans blanc garde son coloris");
  assert.equal(colorisMontre(produitDe("polo-club")!, f({ couleurs: ["Noir"] })), 1, "le polo : blanc d'abord, noir si filtré");
}

// 9 · Les garde-fous, dans le code de la boutique.
{
  const fichiers: string[] = [];
  const parcourir = (dossier: string) => {
    for (const nom of readdirSync(dossier)) {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (/\.tsx?$/.test(nom)) fichiers.push(chemin);
    }
  };
  parcourir(join(racine, "src/app/boutique"));
  parcourir(join(racine, "src/components/boutique"));
  fichiers.push(join(racine, "src/lib/boutique/catalogue.ts"), join(racine, "src/lib/boutique/produits.ts"), join(racine, "src/hooks/use-favoris-boutique.ts"));
  assert.ok(fichiers.length >= 13, `tous les fichiers de la boutique sont lus (${fichiers.length})`);
  const INTERDITS: [RegExp, string][] = [
    [/bouton--(or|vert|mauve|braise|rouge)/, "un ton de couleur sur un bouton"],
    [/text-white\/|border-white\/|bg-white\/|rgba\(255/, "un blanc nu (mode clair)"],
    [/line-through/, "un prix barré"],
    [/stripe/i, "un paiement"],
    [/text-\[\d+(\.\d+)?px\]/, "une taille de texte hors jetons"],
    [/nike|footkorner/i, "la marque d'un autre"],
    [/-\d+ ?%|compte à rebours|meilleure vente/i, "une promo"],
  ];
  for (const chemin of fichiers) {
    const code = readFileSync(chemin, "utf8");
    for (const [motif, quoi] of INTERDITS) {
      assert.ok(!motif.test(code), `${chemin.replace(racine, "")} : ${quoi} (${motif.exec(code)?.[0]})`);
    }
  }
  // Rien de payable : le bouton du panier reste désactivé.
  const fiche = readFileSync(join(racine, "src/app/boutique/articles/[id]/page.tsx"), "utf8");
  assert.ok(/disabled\s+className="bouton-principal[^>]*>\s*Ajouter au panier/.test(fiche), "« Ajouter au panier » est désactivé");
}

console.log("boutique-check: ok");
