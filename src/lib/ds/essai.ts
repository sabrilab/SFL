// Le mode essai du design system (Admin → Design, app/admin/design).
//
// L'admin change une couleur, une taille ou un arrondi de app/tokens.css et
// voit toute l'app changer, sur son seul téléphone : les valeurs essayées
// vivent dans le stockage local du navigateur, et components/ds/essai-design
// les réécrit par-dessus les variables du fichier. Rien ne part chez les
// joueurs : une valeur gardée se reporte dans tokens.css, passe par un
// aperçu, et n'est publiée qu'après le OK de Sabri.
//
// Les réglages essayables sont catalogués ici (REGLAGES), dans l'ordre de la
// page ; chacun dit s'il change avec le mode (clair et sombre ont chacun leur
// valeur) ou non (les tailles et les arrondis).

export type Mode = "clair" | "sombre";

export interface Essai {
  clair: Record<string, string>;
  sombre: Record<string, string>;
  commun: Record<string, string>;
}

export type Famille = "couleur" | "taille" | "arrondi";

export interface Reglage {
  /** La variable CSS de tokens.css. */
  nom: string;
  libelle: string;
  /** Où elle se voit dans l'app. */
  role: string;
  famille: Famille;
  /** La classe Tailwind qui la lit, quand il y en a une. */
  classe?: string;
}

export const REGLAGES: Reglage[] = [
  { nom: "--background", libelle: "Fond", role: "Le fond de chaque page", famille: "couleur", classe: "bg-background" },
  { nom: "--foreground", libelle: "Encre", role: "Le texte et les gris qui en dérivent", famille: "couleur", classe: "text-encre" },
  { nom: "--contraste", libelle: "Plein contraste", role: "Le texte des scènes, blanc pur en sombre", famille: "couleur", classe: "text-contraste" },
  { nom: "--card", libelle: "Surface", role: "Les fiches posées sur la page", famille: "couleur", classe: "bg-card" },
  { nom: "--popover", libelle: "Feuille", role: "Les feuilles qui montent du bas", famille: "couleur", classe: "bg-popover" },
  { nom: "--secondary", libelle: "Secondaire", role: "Les champs, les pastilles", famille: "couleur", classe: "bg-secondary" },
  { nom: "--muted", libelle: "Atténué", role: "Les fonds en retrait", famille: "couleur", classe: "bg-muted" },
  { nom: "--muted-foreground", libelle: "Texte atténué", role: "Les étiquettes grises", famille: "couleur", classe: "text-muted-foreground" },
  { nom: "--accent", libelle: "Survol", role: "Une ligne touchée", famille: "couleur", classe: "bg-accent" },
  { nom: "--border", libelle: "Trait", role: "Les filets et les bords", famille: "couleur", classe: "border-border" },
  { nom: "--primary", libelle: "Plein", role: "Le bouton plein de shadcn", famille: "couleur", classe: "bg-primary" },
  { nom: "--vert", libelle: "Vert", role: "Y aller : venir, valider, créer", famille: "couleur", classe: "text-vert" },
  { nom: "--mauve", libelle: "Mauve", role: "Les autres : Vestiaire, partager", famille: "couleur", classe: "text-mauve" },
  { nom: "--braise", libelle: "Braise", role: "Seulement « Il manque N »", famille: "couleur", classe: "text-braise" },

  { nom: "--text-micro", libelle: "Micro", role: "Les mentions minuscules", famille: "taille", classe: "text-micro" },
  { nom: "--text-etiquette", libelle: "Étiquette", role: "Les étiquettes en capitales", famille: "taille", classe: "text-etiquette" },
  { nom: "--text-legende", libelle: "Légende", role: "Les petites lignes d'une rangée", famille: "taille", classe: "text-legende" },
  { nom: "--text-petit", libelle: "Petit", role: "Les sous-lignes", famille: "taille", classe: "text-petit" },
  { nom: "--text-corps", libelle: "Corps", role: "Le texte courant", famille: "taille", classe: "text-corps" },
  { nom: "--text-ligne", libelle: "Ligne", role: "Les boutons, les rangées", famille: "taille", classe: "text-ligne" },
  { nom: "--text-lecture", libelle: "Lecture", role: "Les noms, les grands boutons", famille: "taille", classe: "text-lecture" },
  { nom: "--text-titre", libelle: "Titre", role: "Les titres de rubrique", famille: "taille", classe: "text-titre" },
  { nom: "--text-titre-fort", libelle: "Titre fort", role: "Un titre de carte ou de feuille", famille: "taille", classe: "text-titre-fort" },
  { nom: "--text-titre-m", libelle: "Titre moyen", role: "Les titres de fiche", famille: "taille", classe: "text-titre-m" },
  { nom: "--text-titre-g", libelle: "Grand titre", role: "Le titre d'un écran", famille: "taille", classe: "text-titre-g" },
  { nom: "--text-titre-l", libelle: "Très grand titre", role: "Le titre d'une page", famille: "taille", classe: "text-titre-l" },
  { nom: "--text-nom", libelle: "Nom", role: "Le nom en haut d'un profil", famille: "taille", classe: "text-nom" },
  { nom: "--text-affiche", libelle: "Affiche", role: "Un chiffre ou un mot seul", famille: "taille", classe: "text-affiche" },

  { nom: "--radius-petit", libelle: "Petit", role: "Les vignettes, les pastilles carrées", famille: "arrondi", classe: "rounded-petit" },
  { nom: "--radius-champ", libelle: "Champ", role: "Les champs, les petites fiches", famille: "arrondi", classe: "rounded-champ" },
  { nom: "--radius-tuile", libelle: "Tuile", role: "Les tuiles et les fiches", famille: "arrondi", classe: "rounded-tuile" },
  { nom: "--radius-feuille", libelle: "Feuille", role: "Le haut des feuilles", famille: "arrondi", classe: "rounded-feuille" },
  { nom: "--radius", libelle: "Base shadcn", role: "rounded-lg, et ses multiples (xl, 2xl, 3xl)", famille: "arrondi", classe: "rounded-lg" },
];

export function changeAvecLeMode(r: Reglage) {
  return r.famille === "couleur";
}

const CLE = "bola-design-essai";
const EVENEMENT = "bola-design-essai";
const VIDE: Essai = { clair: {}, sombre: {}, commun: {} };

export function lireEssai(): Essai {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return VIDE;
    const e = JSON.parse(brut) as Partial<Essai>;
    return { clair: e.clair ?? {}, sombre: e.sombre ?? {}, commun: e.commun ?? {} };
  } catch {
    return VIDE;
  }
}

export function ecrireEssai(e: Essai) {
  try {
    if (nombreDeChangements(e) === 0) localStorage.removeItem(CLE);
    else localStorage.setItem(CLE, JSON.stringify(e));
  } catch {
    // Navigation privée : l'essai vaut pour la page ouverte seulement.
  }
  window.dispatchEvent(new CustomEvent<Essai>(EVENEMENT, { detail: e }));
}

export function arreterEssai() {
  ecrireEssai(VIDE);
}

export function ecouterEssai(f: (e: Essai) => void) {
  const surEvenement = (ev: Event) => f((ev as CustomEvent<Essai>).detail);
  const surStockage = (ev: StorageEvent) => {
    if (ev.key === CLE) f(lireEssai());
  };
  window.addEventListener(EVENEMENT, surEvenement);
  window.addEventListener("storage", surStockage);
  return () => {
    window.removeEventListener(EVENEMENT, surEvenement);
    window.removeEventListener("storage", surStockage);
  };
}

export function nombreDeChangements(e: Essai) {
  return Object.keys(e.clair).length + Object.keys(e.sombre).length + Object.keys(e.commun).length;
}

/** Une valeur sans accolade ni point-virgule : rien d'autre ne passe dans la feuille. */
function propre(v: string) {
  return v.replace(/[{};<>]/g, "").trim();
}

/** « #a9cba9 » → « 169 203 169 » : la version en canaux qui accompagne chaque
 *  couleur de tokens.css (postcss-repli-opacite.cjs), et que lisent les gris
 *  du texte. Une couleur essayée la réécrit aussi. */
function canaux(v: string) {
  const m = v.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}

function bloc(selecteur: string, vars: Record<string, string>) {
  const lignes = Object.entries(vars)
    .filter(([nom]) => /^--[a-z0-9-]+$/.test(nom))
    .flatMap(([nom, v]) => {
      const c = canaux(v);
      return [`  ${nom}: ${propre(v)};`, ...(c ? [`  ${nom}-rgb: ${c};`] : [])];
    });
  return lignes.length ? `${selecteur} {\n${lignes.join("\n")}\n}\n` : "";
}

/** La feuille de l'essai. Les sélecteurs pèsent plus lourd que ceux de
 *  tokens.css (:root, .dark), et .dark.dark atteint aussi les îlots sombres
 *  (une cérémonie, une story) posés dans une page claire. */
export function feuilleDEssai(e: Essai) {
  return (
    bloc(":root:root", e.commun) +
    bloc(":root:root:not(.dark)", e.clair) +
    bloc(".dark.dark", e.sombre)
  );
}

/** Les valeurs de tokens.css, lues dans les feuilles de style chargées : la
 *  page montre le fichier tel qu'il est publié, essai ou pas. */
export function valeursDuFichier(): Record<Mode, Record<string, string>> {
  const clair: Record<string, string> = {};
  const sombre: Record<string, string> = {};
  const parcourir = (regles: CSSRuleList) => {
    for (const r of Array.from(regles)) {
      if (r instanceof CSSStyleRule) {
        const sel = r.selectorText.trim();
        const cible = sel === ":root" || sel === ":root, :host" ? clair : sel === ".dark" ? sombre : null;
        if (!cible) continue;
        for (const nom of Array.from(r.style)) {
          if (nom.startsWith("--")) cible[nom] = r.style.getPropertyValue(nom).trim();
        }
      } else if ("cssRules" in r) {
        parcourir((r as CSSGroupingRule).cssRules);
      }
    }
  };
  for (const feuille of Array.from(document.styleSheets)) {
    try {
      parcourir(feuille.cssRules);
    } catch {
      // Feuille d'un autre domaine (polices) : rien à y lire.
    }
  }
  // Ce qui ne change pas avec le mode n'est écrit qu'une fois, sur :root.
  for (const [nom, v] of Object.entries(clair)) if (!(nom in sombre)) sombre[nom] = v;
  return { clair, sombre };
}

/** Le résumé à envoyer : ce qui change, de quoi à quoi, mode par mode. */
export function resume(e: Essai, fichier: Record<Mode, Record<string, string>>) {
  const nomDe = (n: string) => REGLAGES.find((r) => r.nom === n)?.libelle ?? n;
  const lignes: string[] = ["Essai de design Bola, à reporter dans app/tokens.css :"];
  const partie = (titre: string, vars: Record<string, string>, base: Record<string, string>) => {
    const entrees = Object.entries(vars);
    if (!entrees.length) return;
    lignes.push("", titre);
    for (const [n, v] of entrees) lignes.push(`- ${nomDe(n)} (${n}) : ${base[n] ?? "?"} → ${v}`);
  };
  partie("Tailles et arrondis", e.commun, fichier.clair);
  partie("Mode clair", e.clair, fichier.clair);
  partie("Mode sombre", e.sombre, fichier.sombre);
  return lignes.join("\n");
}
