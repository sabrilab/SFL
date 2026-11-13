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
//   8. les vues de la fiche (les photos du coloris choisi d'abord) et le
//      coloris montré par la grille ;
//   9. les garde-fous de la DA et de la demande, lus dans le code de la
//      boutique : aucune couleur (ni ton sur un bouton, ni utilité de
//      couleur), ni blanc nu (mode clair), ni prix barré (classe ou balise),
//      ni paiement, ni taille de texte hors jetons, ni marque d'autrui ;
//      chaque image citée existe ; la grille ne demande rien au serveur ;
//  10. les rayons vus de l'accueil et de la feuille de filtres : un rayon
//      d'une pièce mène à sa fiche, la section Catégorie suit le rayon ;
//      deux gestes coup sur coup gardent leur effet ;
//  11. la place de la boutique dans l'app : son retour mène à Ma carte, celui
//      de la grille et des fiches à la boutique ; elle est ouverte aux
//      joueurs Bola ;
//  12. les favoris gardés sur l'appareil : un contenu abîmé ne casse rien.
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
  adresseFiche,
  adresseGrille,
  adresseRayon,
  aussi,
  basculer,
  categoriesDuRayon,
  colorisMontre,
  couleurPortee,
  ecrireRecherche,
  filtrer,
  lireRecherche,
  nombreArticles,
  nombreCouleurs,
  nombreDeFiltres,
  rechercheApres,
  trier,
  voirLesArticles,
  vuesFiche,
  type Filtres,
  type Recherche,
} from "../src/lib/boutique/catalogue";
import { CATEGORIES, PRODUITS, produitDe } from "../src/lib/boutique/produits";
import { parentDe, titreDe } from "../src/lib/nav";
import { lireFavoris } from "../src/hooks/use-favoris-boutique";

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
    vuesFiche(maillot, 0).map((v) => v.src.replace("/boutique/", "").replace(".webp", "")),
    ["porte-maillot-noir", "a-plat-rt0082-black-front", "a-plat-rt0082-black-back", "porte-maillot-blanc-dos"],
    "Noir : sa photo portée, ses vues à plat, puis la photo du blanc",
  );
  assert.deepEqual(
    vuesFiche(maillot, 1).map((v) => v.src.replace("/boutique/", "").replace(".webp", "")),
    ["porte-maillot-blanc-dos", "a-plat-rt0082-white-front", "a-plat-rt0082-white-back", "porte-maillot-noir"],
    "Blanc : sa photo portée d'abord, celle du noir en dernier",
  );
  const polo = produitDe("polo-club")!;
  assert.ok(vuesFiche(polo, 0)[0].src.includes("porte-polo-blanc"), "le polo blanc : sa photo portée d'abord");
  assert.deepEqual(
    vuesFiche(polo, 1).map((v) => v.aPlat),
    [true, true, false],
    "le polo noir : ses vues à plat, la photo du blanc en dernier",
  );
  for (const p of PRODUITS) {
    // La première image de la fiche montre toujours le coloris choisi ; aucune image n'est perdue.
    p.coloris.forEach((c, i) => {
      const vues = vuesFiche(p, i);
      assert.equal(vues.length, p.porte.length + c.aPlat.length, `${p.id} ${c.nom} : toutes ses images`);
      assert.equal(new Set(vues.map((v) => v.src)).size, vues.length, `${p.id} ${c.nom} : sans doublon`);
      assert.ok(vues[0].aPlat || couleurPortee(p, vues[0].src) === c.nom, `${p.id} ${c.nom} : la première image est de ce coloris`);
    });
    // Une photo portée dit sa couleur par son nom, et la pièce a ce coloris.
    for (const src of p.porte) assert.ok(p.coloris.some((c) => c.nom === couleurPortee(p, src)), `${src} : un coloris de ${p.id}`);
    assert.ok(!vuesFiche(p, 0)[0].aPlat, `${p.id} : le premier coloris s'ouvre sur une photo portée`);
  }
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
    [
      /\b(text|bg|border|outline|fill|stroke|ring|from|via|to|decoration|shadow|accent|caret|divide)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|or|bleu|rouge|braise|vert|mauve|destructive)\b/,
      "une couleur (la boutique est en noir et blanc)",
    ],
    [/(?<!dark:)\b(text|border|bg|outline|fill|stroke)-white\b|rgba\(255/, "un blanc nu (mode clair)"],
    [/line-through|<(s|del|strike)[\s>]/, "un prix barré"],
    [/router\.(push|replace)|useRouter/, "une navigation qui attend le serveur"],
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
  // Chaque image citée en toutes lettres (hero, panneaux, camps, blocs) existe.
  let citees = 0;
  for (const chemin of fichiers) {
    for (const [src] of readFileSync(chemin, "utf8").matchAll(/\/boutique\/[a-z0-9-]+\.webp/g)) {
      citees++;
      assert.ok(existsSync(join(racine, "public", src)), `${chemin.replace(racine, "")} : ${src} existe`);
    }
  }
  assert.ok(citees >= 11, `les images de l'accueil sont lues (${citees})`);
  // La grille change l'adresse sur place : rien ne part au serveur, rien ne s'empile.
  const grille = readFileSync(join(racine, "src/app/boutique/articles/page.tsx"), "utf8");
  assert.ok(/window\.history\.replaceState\(/.test(grille) && !/pushState/.test(grille), "la grille remplace l'adresse sur place");
  assert.ok(/rechercheApres\(window\.location\.search,/.test(grille), "chaque geste part de l'adresse du moment");
  assert.ok(/matchMedia\("\(min-width: 1024px\)"\)/.test(grille), "la feuille de filtres se ferme en large");
  // Rien de payable : le bouton du panier reste désactivé.
  const fiche = readFileSync(join(racine, "src/app/boutique/articles/[id]/page.tsx"), "utf8");
  assert.ok(/disabled\s+className="bouton-principal[^>]*>\s*Ajouter au panier/.test(fiche), "« Ajouter au panier » est désactivé");
}

// 10 · Les rayons vus de l'accueil et de la feuille de filtres.
{
  assert.equal(adresseRayon("maillots"), "/boutique/articles?rayon=maillots");
  assert.equal(adresseRayon("vestiaire"), "/boutique/articles?rayon=vestiaire");
  assert.equal(adresseRayon("tout"), "/boutique/articles");
  assert.equal(adresseRayon("survets"), adresseFiche("survet-olympe"), "un rayon d'une pièce mène à sa fiche");
  assert.equal(adresseRayon("fondateurs"), adresseFiche("sweat-fondateurs"));
  assert.equal(adresseRayon("fondateurs", [...PRODUITS, { ...produitDe("sweat-fondateurs")!, id: "second" }]), "/boutique/articles?rayon=fondateurs", "deux pièces : la grille");
  assert.equal(adresseRayon("favoris"), "/boutique/articles?rayon=favoris", "aucun favori : la grille, pas une fiche");

  assert.deepEqual(categoriesDuRayon("tout"), CATEGORIES);
  assert.deepEqual(categoriesDuRayon("favoris"), CATEGORIES);
  assert.deepEqual(categoriesDuRayon("vestiaire"), ["T-shirts", "Polos", "Survêts"], "le vestiaire : ses catégories seulement");
  for (const r of ["maillots", "survets", "fondateurs"] as const) assert.deepEqual(categoriesDuRayon(r), [], `${r} : une seule catégorie, pas de section`);
  // Aucune case offerte ne peut vider un rayon à elle seule.
  for (const r of RAYONS) for (const c of categoriesDuRayon(r.id)) {
    if (r.id !== "favoris") assert.ok(filtrer(PRODUITS, r.id, f({ categories: [c] })).length > 0, `${r.id} + ${c} : au moins une pièce`);
  }

  // Deux gestes coup sur coup : le second part de l'adresse laissée par le premier.
  const coche = <C extends keyof Filtres>(q: string, section: C, valeur: Filtres[C][number]) =>
    rechercheApres(q, (r) => ({ ...r, filtres: basculer(r.filtres, section, valeur) }));
  let q = "?rayon=tout";
  q = coche(q, "categories", "Maillots");
  q = coche(`?${q}`, "couleurs", "Blanc");
  q = coche(`?${q}`, "tailles", "XL");
  assert.equal(q, "categorie=Maillots&couleur=Blanc&taille=XL", "les trois cases sont gardées");
  assert.equal(coche(`?${q}`, "couleurs", "Blanc"), "categorie=Maillots&taille=XL", "recocher décoche");
  assert.equal(rechercheApres("?rayon=maillots&couleur=Blanc&tri=prix-croissant", (r) => ({ ...r, filtres: SANS_FILTRE })), "rayon=maillots&tri=prix-croissant", "« Tout effacer » garde le rayon et le tri");
  assert.equal(rechercheApres("?couleur=Blanc", (r) => ({ ...r, tri: "prix-decroissant" })), "couleur=Blanc&tri=prix-decroissant", "trier garde les filtres");
  assert.equal(rechercheApres("", (r) => r), "");
  // Le marquage dit ce qui est imprimé, pas une personnalisation qui n'existe pas.
  assert.ok(!PRODUITS.some((p) => p.marquage.some((m) => /nom et numéro/i.test(m))), "aucun « nom et numéro » promis");
}

// 11 · La place de la boutique dans l'app.
{
  assert.deepEqual(parentDe("/boutique"), { href: "/profil", titre: "Ma carte" }, "le retour de la boutique mène à Ma carte");
  assert.deepEqual(parentDe("/boutique/articles"), { href: "/boutique", titre: "Boutique" });
  assert.deepEqual(parentDe("/boutique/articles/polo-club"), { href: "/boutique", titre: "Boutique" });
  assert.equal(titreDe("/boutique/articles?rayon=maillots"), "Boutique");
  // Ouverte aux joueurs Bola : elle n'est pas une page de la SFL.
  const porte = readFileSync(join(racine, "src/components/sfl/porte-sfl.tsx"), "utf8");
  const pages = /const PAGES_SFL[^=]*=\s*\[([\s\S]*?)\n\];/.exec(porte)?.[1] ?? "";
  assert.ok(pages.includes('"/collection"'), "la liste des pages de la SFL est lue");
  assert.ok(!pages.includes("/boutique"), "la boutique n'est pas fermée aux joueurs Bola");
  // Le guichet ne mène à la Collection qu'un joueur de la SFL.
  const guichet = readFileSync(join(racine, "src/components/boutique/guichet-ballons.tsx"), "utf8");
  assert.ok(/\{sfl && \(\s*<Link\s+href="\/collection"/.test(guichet), "le lien vers la Collection est réservé à la SFL");
}

// 12 · Les favoris gardés sur l'appareil.
{
  const g = globalThis as unknown as { localStorage?: { getItem: (k: string) => string | null } };
  let garde: string | null = null;
  g.localStorage = { getItem: () => garde };
  const lus = (v: string | null) => {
    garde = v;
    return lireFavoris();
  };
  assert.deepEqual(lus(null), []);
  assert.deepEqual(lus('["polo-club",3,null,"disparu"]'), ["polo-club", "disparu"], "seuls les textes sont gardés");
  assert.deepEqual(ids(filtrer(PRODUITS, "favoris", SANS_FILTRE, lus('["polo-club",3,null,"disparu"]'))), ["polo-club"]);
  for (const v of ['{"a":1}', "null", "pas du json", '"polo-club"', "12"]) assert.deepEqual(lus(v), [], `${v} : aucun favori, aucune erreur`);
  g.localStorage = { getItem: () => { throw new Error("refusé"); } };
  assert.deepEqual(lireFavoris(), [], "stockage refusé : aucun favori");
  delete g.localStorage;
}

console.log("boutique-check: ok");
