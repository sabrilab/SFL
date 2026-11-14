// La couverture du haut de getbola.app/sfl (14/11/2026, retour sur
// bola-app#6 : « rends l'accueil plus visuel avec une belle photo de
// couverture. Enfin, le header »). Cet outil écrit les images de chaque
// variante, et le module qui les décrit (src/lib/sfl/page-sfl-couverture.ts,
// généré) ; la page n'en lit rien d'autre.
//
// Rien n'est généré ni téléchargé : chaque image vient de ce qui est déjà
// dans l'app et a été validé.
//   · a « La cage » et c « Les ombres » : deux photos du moodboard des Actus
//     (public/actus/couvertures, lib/sfl/couvertures.ts), en production depuis
//     le 24/10 sur le « ok » du directeur artistique (SFL#178) : noir et blanc, aucun visage.
//     Elles sont seulement recadrées et réencodées.
//   · b « Les cartes » : un mur des vraies cartes de l'instantané
//     (public/sfl/cartes, lib/sfl/page-sfl-instantane.ts), donc seulement des
//     joueurs dont l'accord hors-app était « oui » (ACCORDS). Les cartes au
//     format compact (podiums, carte de départ, les trois titres) sont posées
//     en colonnes décalées, le mur penché de 7°, sur un fond transparent :
//     la page passe entre les cartes, en clair comme en sombre. Le mur est en
//     noir et blanc (contrôle du 14/11 : pas de drapeaux ni d'or, de bleu et
//     de rouge en décor) ; le banc le recompose (imagesMur) et compare les
//     empreintes : ses pixels viennent bien des cartes d'ACCORDS.
// Le stade « Olympe » (les piliers de marbre) n'est pas sur la machine qui a
// écrit cet outil : une variante de plus = une entrée de VARIANTES.
//
// Chaque variante a deux formats :
//   · le téléphone, en portrait 9:14 (720 × 1120 et 1029 × 1600, srcset) ;
//     le cadre (`cadre`) garde le sujet de la photo ; 250 ko au plus ;
//   · l'ordinateur, une bande 16:9 (1200 × 675 pour une photo de 1200 px de
//     large ; 1600 × 900 pour le mur, dessiné à cette taille). Les photos du
//     moodboard n'existent qu'en 1200 px de large : la bande est un peu douce
//     sur un grand écran ; rien n'est agrandi ni généré pour la remplacer.
// WebP (sharp, déjà installé), sans métadonnées.
//
//   npx tsx tools/page-sfl-couverture.ts
// Puis relire les images, et tools/page-sfl-check.ts (12 · la couverture).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { ACCORDS, CARTE_MONTEE, PODIUMS, TITRES } from "../src/lib/sfl/page-sfl-instantane";

const RACINE = join(__dirname, "..");
const DOSSIER = "sfl/couverture";
const SORTIE_TS = join(RACINE, "src/lib/sfl/page-sfl-couverture.ts");
/** Le plus lourd que le téléphone télécharge. */
export const POIDS_TELEPHONE = 250_000;
/** Le plus lourd que l'ordinateur télécharge. */
export const POIDS_ORDINATEUR = 320_000;

/** Les deux largeurs du téléphone (portrait 9:14) et la bande de l'ordinateur (16:9). */
const TELEPHONE = [
  [720, 1120],
  [1029, 1600],
] as const;

type Variante =
  | { cle: "a" | "c"; nom: string; photo: string; cadre: { x: number; haut: number; yBande: number } }
  | { cle: "b"; nom: string; cartes: true };

/**
 * Les variantes. `cadre.x` : le centre du recadrage portrait, de 0 (à gauche)
 * à 1 ; `cadre.haut` : la part de la photo retirée en haut du portrait (les
 * pieds coupés au bord des ombres, contrôle du 14/11) ; `cadre.yBande` : le
 * centre de la bande de l'ordinateur, de 0 (en haut) à 1.
 */
const VARIANTES: Variante[] = [
  { cle: "a", nom: "La cage", photo: "cage-2", cadre: { x: 0.6, haut: 0, yBande: 0.36 } },
  { cle: "b", nom: "Les cartes", cartes: true },
  { cle: "c", nom: "Les ombres", photo: "ombres-1", cadre: { x: 0.5, haut: 0.05, yBande: 0.3 } },
];

const empreinte = (b: Buffer) => createHash("sha256").update(b).digest("hex");

interface Ecrite {
  src: string;
  largeur: number;
  hauteur: number;
  sha256: string;
  octets: number;
}

function ecrire(nom: string, b: Buffer, l: number, h: number): Ecrite {
  writeFileSync(join(RACINE, "public", DOSSIER, nom), b);
  return { src: `/${DOSSIER}/${nom}`, largeur: l, hauteur: h, sha256: empreinte(b), octets: b.length };
}

/** Encode en WebP, en baissant la qualité jusqu'à tenir le poids. */
async function webp(img: sharp.Sharp, poids: number, alpha: boolean): Promise<Buffer> {
  for (let q = 76; q >= 40; q -= 4) {
    const b = await img.clone().webp({ quality: q, alphaQuality: alpha ? 80 : 100, effort: 6, smartSubsample: true }).toBuffer();
    if (b.length <= poids) return b;
  }
  throw new Error(`impossible de tenir ${poids} octets`);
}

/** Une photo des Actus : le portrait 9:14 recadré autour de cadre.x, et la bande 16:9 autour de cadre.yBande. */
async function photo(v: Extract<Variante, { photo: string }>): Promise<{ telephone: Ecrite[]; ordinateur: Ecrite }> {
  const source = join(RACINE, "public/actus/couvertures", `${v.photo}-1200.webp`);
  const meta = await sharp(source).metadata();
  const L = meta.width!;
  const H = meta.height!;
  const haut0 = Math.round(v.cadre.haut * H);
  const lPortrait = Math.round(((H - haut0) * 9) / 14);
  const gauche = Math.max(0, Math.min(L - lPortrait, Math.round(v.cadre.x * L - lPortrait / 2)));
  const portrait = sharp(source).extract({ left: gauche, top: haut0, width: lPortrait, height: H - haut0 });
  const telephone: Ecrite[] = [];
  for (const [l, h] of TELEPHONE) {
    const b = await webp(portrait.clone().resize(l, h, { kernel: "lanczos3" }), POIDS_TELEPHONE, false);
    telephone.push(ecrire(`${v.cle}-${l}.webp`, b, l, h));
  }
  const hBande = Math.round((L * 9) / 16);
  const haut = Math.max(0, Math.min(H - hBande, Math.round(v.cadre.yBande * H - hBande / 2)));
  const bande = sharp(source).extract({ left: 0, top: haut, width: L, height: hBande });
  const ordinateur = ecrire(`${v.cle}-ordinateur.webp`, await webp(bande, POIDS_ORDINATEUR, false), L, hBande);
  return { telephone, ordinateur };
}

/** Les cartes du mur : le format compact de l'instantané (450 × 726), dans un ordre qui alterne les joueurs. */
function cartesDuMur(): { src: string; nom: string }[] {
  const compactes = [
    ...PODIUMS.flatMap((p) => p.places.map((x) => ({ src: x.image.src, nom: x.nom }))),
    { src: CARTE_MONTEE.depart.src, nom: CARTE_MONTEE.nom },
    ...TITRES.cartes.map((c) => ({ src: c.petite.src, nom: c.nom })),
  ];
  for (const c of compactes) if (!(ACCORDS as readonly string[]).includes(c.nom)) throw new Error(`le mur ne prend que les joueurs d'ACCORDS`);
  return compactes;
}

/**
 * Le mur : des colonnes décalées d'une demi-carte, la carte à `largeur` px,
 * `pas` entre deux colonnes, le tout penché de 7°, puis recadré à l × h.
 * L'ordre des cartes tourne d'une colonne à l'autre : deux voisines ne sont
 * jamais la même.
 */
async function mur(l: number, h: number, largeur: number): Promise<Buffer> {
  const cartes = cartesDuMur();
  const hauteur = Math.round((largeur * 726) / 450);
  const gouttiere = Math.round(largeur * 0.09);
  const pasX = largeur + gouttiere;
  const pasY = hauteur + gouttiere;
  // Une toile assez grande pour que la rotation ne laisse aucun coin vide.
  const T = Math.ceil(Math.hypot(l, h)) + pasX * 2;
  const colonnes = Math.ceil(T / pasX) + 1;
  const rangs = Math.ceil(T / pasY) + 2;
  const tuiles = new Map<string, Buffer>();
  for (const c of cartes) tuiles.set(c.src, await sharp(join(RACINE, "public", c.src)).resize(largeur, hauteur, { kernel: "lanczos3" }).png().toBuffer());
  const poses: sharp.OverlayOptions[] = [];
  for (let i = 0; i < colonnes; i++) {
    const decalage = i % 2 ? Math.round(pasY / 2) : 0;
    for (let j = -1; j < rangs; j++) {
      const k = (((i * 4 + j * 3) % cartes.length) + cartes.length) % cartes.length;
      const top = j * pasY + decalage;
      const left = i * pasX;
      if (top + hauteur <= 0 || top >= T || left >= T) continue;
      // sharp refuse une pose qui déborde : la carte est rognée à la toile.
      const haut = Math.max(0, -top);
      const bas = Math.min(hauteur, T - top);
      const droite = Math.min(largeur, T - left);
      const tuile = await sharp(tuiles.get(cartes[k].src)!).extract({ left: 0, top: haut, width: droite, height: bas - haut }).toBuffer();
      poses.push({ input: tuile, left, top: top + haut });
    }
  }
  const toile = await sharp({ create: { width: T, height: T, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(poses)
    .png()
    .toBuffer();
  const penche = await sharp(toile).rotate(-7, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const m = await sharp(penche).metadata();
  // En noir et blanc (contrôle du 14/11) : les drapeaux et l'or, le bleu et le rouge des cartes à titre ne
  // deviennent pas un décor ; la page reste noir et blanc, et le mur ne jaunit plus en clair.
  return sharp(penche)
    .extract({ left: Math.round((m.width! - l) / 2), top: Math.round((m.height! - h) / 2), width: l, height: h })
    .grayscale()
    .png()
    .toBuffer();
}

/**
 * Les images du mur, telles que l'outil les écrit : le téléphone (deux
 * largeurs) puis la bande de l'ordinateur. Déterministe : le banc les
 * recompose et compare leurs empreintes à celles des fichiers (les pixels du
 * mur, pas seulement la liste des noms, viennent des cartes d'ACCORDS).
 */
export async function imagesMur(): Promise<{ telephone: { l: number; h: number; b: Buffer }[]; ordinateur: { l: number; h: number; b: Buffer } }> {
  const telephone: { l: number; h: number; b: Buffer }[] = [];
  // La carte fait 36 % de la largeur du portrait : environ 140 px sur un téléphone de 390.
  for (const [l, h] of TELEPHONE) telephone.push({ l, h, b: await webp(sharp(await mur(l, h, Math.round(l * 0.36))), POIDS_TELEPHONE, true) });
  return { telephone, ordinateur: { l: 1600, h: 900, b: await webp(sharp(await mur(1600, 900, 240)), POIDS_ORDINATEUR, true) } };
}

/** Les joueurs du mur, sans doublon, dans l'ordre alphabétique : ce que le module généré écrit dans `cartes`. */
export const nomsDuMur = () => [...new Set(cartesDuMur().map((c) => c.nom))].sort((x, y) => x.localeCompare(y, "fr"));

async function principal() {
  const dossier = join(RACINE, "public", DOSSIER);
  mkdirSync(dossier, { recursive: true });
  for (const f of existsSync(dossier) ? readdirSync(dossier) : []) unlinkSync(join(dossier, f));
  const sortie: Record<string, unknown> = {};
  for (const v of VARIANTES) {
    if ("photo" in v) {
      const { telephone, ordinateur } = await photo(v);
      sortie[v.cle] = { nom: v.nom, source: `/actus/couvertures/${v.photo}-1200.webp`, cartes: [], telephone, ordinateur };
    } else {
      const m = await imagesMur();
      const telephone = m.telephone.map((t) => ecrire(`b-${t.l}.webp`, t.b, t.l, t.h));
      const ordinateur = ecrire("b-ordinateur.webp", m.ordinateur.b, m.ordinateur.l, m.ordinateur.h);
      sortie[v.cle] = { nom: v.nom, source: null, cartes: nomsDuMur(), telephone, ordinateur };
    }
  }
  const ts = `// GÉNÉRÉ par tools/page-sfl-couverture.ts : ne pas modifier à la main.
//
// Les images de la couverture du haut de getbola.app/sfl, une entrée par
// variante : a « La cage » et c « Les ombres », deux photos du moodboard des
// Actus (en production depuis le 24/10), recadrées ; b « Les cartes », le mur
// des vraies cartes de l'instantané (joueurs d'ACCORDS seulement, nommés dans
// \`cartes\`). Le téléphone a deux largeurs (srcset), l'ordinateur une bande.
// tools/page-sfl-check.ts relit chaque fichier (empreinte, taille, poids).
//
// Pur : des données, ni React, ni base.

/** Une image de la couverture : son adresse, sa taille en pixels, son empreinte, son poids. */
export interface ImageCouverture {
  src: string;
  largeur: number;
  hauteur: number;
  sha256: string;
  octets: number;
}

/** Une variante : son nom, sa source (la photo des Actus, ou null pour le mur), les joueurs du mur. */
export interface VarianteCouverture {
  nom: string;
  source: string | null;
  cartes: readonly string[];
  telephone: readonly ImageCouverture[];
  ordinateur: ImageCouverture;
}

export const VARIANTES_COUVERTURE = ${JSON.stringify(sortie, null, 2)} as const satisfies Record<"a" | "b" | "c", VarianteCouverture>;

export type CleCouverture = keyof typeof VARIANTES_COUVERTURE;
`;
  writeFileSync(SORTIE_TS, ts);
  for (const [cle, v] of Object.entries(sortie) as [string, { telephone: Ecrite[]; ordinateur: Ecrite }][])
    console.log(cle, [...v.telephone, v.ordinateur].map((i) => `${i.src} ${i.largeur}×${i.hauteur} ${Math.round(i.octets / 1000)} ko`).join(" · "));
}

if (process.argv[1]?.endsWith("page-sfl-couverture.ts")) void principal();

// Pour le banc : les cartes que le mur a le droit de prendre.
export const cartesPermises = () => cartesDuMur();
