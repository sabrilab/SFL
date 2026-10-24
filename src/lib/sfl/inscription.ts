// Inscription autonome — les règles partagées entre l'écran (/inscription) et
// la route serveur qui crée le compte (/api/inscription).
//
// Jusqu'ici, seul l'admin fabriquait les comptes et distribuait les accès. Un
// joueur peut désormais créer le sien : identité, gabarit et les quatre
// photos en pied (face, droite, gauche, dos) qui serviront de personnage de
// référence aux skins — la photo de carte, elle, ne vient que du studio, une
// fois le compte accepté (22/10/2026). Le compte naît EN ATTENTE : il se
// connecte, voit sa carte, et l'admin l'accepte d'un geste (Admin → Vue
// d'ensemble → Inscriptions), ce qui l'ajoute à l'effectif.
//
// Ce module est PUR (aucun accès réseau, aucun navigateur) : la route serveur
// refait exactement les mêmes contrôles que l'écran, l'écran ne sert qu'à
// prévenir plus tôt.

/** Les postes, avec les codes de l'effectif (saisie/seed.ts). */
export const POSTES = [
  { id: "G", label: "Gardien" },
  { id: "DG", label: "Latéral gauche" },
  { id: "DC", label: "Défenseur central" },
  { id: "DD", label: "Latéral droit" },
  { id: "MDC", label: "Milieu défensif" },
  { id: "MC", label: "Milieu" },
  { id: "AG", label: "Ailier gauche" },
  { id: "AT", label: "Attaquant" },
  { id: "AD", label: "Ailier droit" },
] as const;
export type Poste = (typeof POSTES)[number]["id"];

export const PIEDS = ["droit", "gauche", "les deux"] as const;
export type Pied = (typeof PIEDS)[number];

/** Demandé à l'accueil de l'app (components/sfl/accueil), pas à l'inscription. */
export const SEXES = ["homme", "femme"] as const;
export type Sexe = (typeof SEXES)[number];

export const MAILLOTS = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export type Maillot = (typeof MAILLOTS)[number];

/** Les quatre prises du personnage de référence, dans l'ordre imposé. */
export const ANGLES = [
  { id: "face", label: "De face", consigne: "Face à l'objectif, bras le long du corps." },
  { id: "droite", label: "Profil droit", consigne: "Tourne-toi d'un quart : ton épaule droite vers l'objectif." },
  { id: "gauche", label: "Profil gauche", consigne: "L'autre quart : ton épaule gauche vers l'objectif." },
  { id: "dos", label: "De dos", consigne: "Dos à l'objectif, même position." },
] as const;
export type Angle = (typeof ANGLES)[number]["id"];

export const BORNES = {
  taille: { min: 140, max: 210, defaut: 178 },
  poids: { min: 40, max: 140, defaut: 74 },
  pointure: { min: 35, max: 50, defaut: 43 },
  motDePasse: 8,
  ageMin: 12,
} as const;

export interface Inscription {
  prenom: string;
  nom: string;
  pseudo: string;
  naissance: string; // AAAA-MM-JJ
  email: string;
  taille: number;
  poids: number;
  pointure: number;
  maillot: Maillot;
  pied: Pied;
  poste: Poste;
  motDePasse: string;
}

/** Un pseudo est aussi l'identifiant de connexion : court, sans accent ni espace. */
export function normaliserPseudo(brut: string): string {
  return brut
    .trim()
    .replace(/^@+/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "");
}

export function erreurPseudo(pseudo: string): string | null {
  if (pseudo.length < 3) return "3 caractères au moins.";
  if (pseudo.length > 20) return "20 caractères au plus.";
  if (!/^[a-z0-9]/.test(pseudo)) return "Commence par une lettre ou un chiffre.";
  return null;
}

/** Prénom, nom : on garde accents et tirets, on retire le superflu. */
export function nettoyerNom(brut: string): string {
  return brut.trim().replace(/\s+/g, " ").slice(0, 60);
}

/** Majuscule en tête de chaque mot (« jean-marc » → « Jean-Marc »). */
export function capitaliser(s: string): string {
  return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase());
}

export function age(naissance: string, aujourdhui = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(naissance);
  if (!m) return null;
  const [a, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(a, mo - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== j) return null;
  let ans = aujourdhui.getUTCFullYear() - a;
  const avant =
    aujourdhui.getUTCMonth() < mo - 1 || (aujourdhui.getUTCMonth() === mo - 1 && aujourdhui.getUTCDate() < j);
  if (avant) ans--;
  return ans;
}

export function emailValide(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/**
 * Le nom du joueur dans la saison — la clé de toute l'app (classements,
 * cartes, photos). L'usage de la ligue : le prénom seul, puis l'initiale du
 * nom en cas d'homonyme (« Kevin B »), puis le nom complet, puis un numéro.
 * `pris` : les noms déjà portés, en minuscules.
 */
export function nomDeLigue(prenom: string, nom: string, pris: Set<string>): string {
  const p = capitaliser(nettoyerNom(prenom));
  const n = capitaliser(nettoyerNom(nom));
  const candidats = [p, `${p} ${n.charAt(0)}`, `${p} ${n}`];
  for (const c of candidats) if (!pris.has(c.toLowerCase())) return c;
  let i = 2;
  while (pris.has(`${p} ${n} ${i}`.toLowerCase())) i++;
  return `${p} ${n} ${i}`;
}

/**
 * Tous les contrôles d'une inscription. null = tout est bon.
 * `sansMotDePasse` : inscription par Google ou Apple, qui n'en a pas.
 */
export function erreurInscription(
  f: Inscription,
  aujourdhui = new Date(),
  { sansMotDePasse = false } = {}
): string | null {
  if (!nettoyerNom(f.prenom)) return "Ton prénom manque.";
  if (!nettoyerNom(f.nom)) return "Ton nom manque.";
  const ep = erreurPseudo(normaliserPseudo(f.pseudo));
  if (ep) return `Pseudo : ${ep}`;
  const a = age(f.naissance, aujourdhui);
  if (a === null) return "Ta date de naissance est incomplète.";
  if (a < BORNES.ageMin || a > 90) return "Vérifie ta date de naissance.";
  if (!emailValide(f.email)) return "Ton email ne semble pas valide.";
  if (!(f.taille >= BORNES.taille.min && f.taille <= BORNES.taille.max)) return "Vérifie ta taille.";
  if (!(f.poids >= BORNES.poids.min && f.poids <= BORNES.poids.max)) return "Vérifie ton poids.";
  if (!(f.pointure >= BORNES.pointure.min && f.pointure <= BORNES.pointure.max)) return "Vérifie ta pointure.";
  if (!MAILLOTS.includes(f.maillot)) return "Choisis ta taille de maillot.";
  if (!PIEDS.includes(f.pied)) return "Choisis ton pied fort.";
  if (!POSTES.some((p) => p.id === f.poste)) return "Choisis ton poste.";
  if (!sansMotDePasse && (f.motDePasse ?? "").length < BORNES.motDePasse) return `Mot de passe : ${BORNES.motDePasse} caractères au moins.`;
  return null;
}
