// Les terrains du Nord : le catalogue où l'on choisit son terrain en ouvrant
// un match (components/sfl/matchs/choisir-terrain.tsx).
//
// Sabri, 23/10 : « une proposition d'ouverture de match sur les mêmes types
// de terrains où on joue actuellement à l'hippodrome […] tous les terrains
// qui sont possibles sur tout le territoire du Nord pour l'instant. »
//
// À l'hippodrome de Marcq, la ligue joue sur des terrains de foot en gazon
// synthétique, en plein air, dans un complexe municipal. On prend donc, au
// Recensement des équipements sportifs (Data ES, ministère chargé des Sports,
// Licence Ouverte 2.0), tous les terrains de football (et les terrains mixtes
// ou « de soccer ») en gazon synthétique, à l'air libre, du département du
// Nord (59). Un complexe fait une seule ligne, avec ses terrains et leur
// format (à 3, à 5, à 7, à 8, à 11, d'après leur nom ou leurs dimensions :
// format() ; c'est sur lui qu'on filtre dans l'app, Sabri, 24/10).
//
// Laissés de côté : les fives couverts (Urban Soccer…), les city-stades, les
// terrains en herbe ; les terrains d'écoles, de lycées et d'universités, et
// les centres d'entraînement des clubs pros (LOSC, VAFC), fermés aux joueurs.
// Les terrains synthétiques de l'hippodrome lui-même ne sont pas au
// recensement : la ligue les a déjà dans ses terrains (saison.terrains).
//
// La source : la copie quotidienne que publie Géo2France, la plateforme de la
// Région (WFS vrt-bot:dataes), le site du ministère ne répondant pas
// toujours ; sinon un export déjà téléchargé.
//
//   npx tsx tools/terrains-nord.ts                    → public/terrains/nord.json
//   npx tsx tools/terrains-nord.ts --depuis=res.json  (un GeoJSON du recensement)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { CatalogueTerrains, TerrainNord } from "../src/lib/sfl/terrains-nord";

const SORTIE = join(import.meta.dirname, "..", "public", "terrains", "nord.json");

const WFS =
  "https://www.geo2france.fr/geoserver/vrt-bot/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature" +
  "&TYPENAMES=vrt-bot:dataes&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326&COUNT=100000" +
  "&CQL_FILTER=" +
  encodeURIComponent("dep_code='59' AND equip_type_name IN ('Terrain de football','Terrain mixte','Terrain de soccer')");

interface Equipement {
  inst_numero: string;
  inst_nom: string | null;
  inst_adresse: string | null;
  inst_cp: string | null;
  new_name: string | null;
  dep_code: string | null;
  equip_nom: string | null;
  equip_type_name: string | null;
  equip_sol: string | null;
  equip_nature: string | null;
  equip_long: number | null;
  equip_larg: number | null;
  equip_eclair: string | null;
  equip_acc_libre: string | null;
  equip_prop_type: string | null;
  equip_x: string | null;
  equip_y: string | null;
}

interface GeoJson {
  features: { geometry: { coordinates: [number, number] } | null; properties: Equipement }[];
}

/* ──────────────────────────────── Le tri ──────────────────────────────── */

const TYPES = new Set(["Terrain de football", "Terrain mixte", "Terrain de soccer"]);
const DEHORS = new Set(["Découvert", "Extérieur couvert", "Découvrable"]);
/** Écoles, lycées, universités : leurs terrains ne s'ouvrent pas aux joueurs. */
const PROPRIETAIRES_FERMES = new Set(["Etablissement Public", "Etablissement d'enseignement privé"]);
/** Les centres d'entraînement des clubs pros. */
const FERMES = /\bLOSC\b|centre (de )?formation/i;

function retenu(e: Equipement): boolean {
  return (
    TYPES.has(e.equip_type_name ?? "") &&
    e.equip_sol === "Gazon synthétique" &&
    DEHORS.has(e.equip_nature ?? "Découvert") &&
    !PROPRIETAIRES_FERMES.has(e.equip_prop_type ?? "") &&
    !FERMES.test(e.inst_nom ?? "")
  );
}

/**
 * Un format écrit en toutes lettres dans le nom du terrain : « Foot à 5 »,
 * « TERRAIN HERBE A 7 », « Terrain synthétique 7V7 », « 6 vs 6 ». Jamais
 * dans des dimensions (« (105x65) ») ni un numéro (« Terrain N° 2 »).
 */
const ECRIT = /(?:^|[^a-zà-ÿ0-9])à ?(3|5|6|7|8|11)(?![0-9])|(?<![0-9])(3|5|6|7|8|11) ?(?:vs?|x|contre) ?(?:3|5|6|7|8|11)(?![0-9])/i;

/**
 * Le format d'un terrain, en joueurs par équipe : 3, 5, 7, 8 ou 11, ceux
 * qu'on filtre dans l'app (Sabri, 24/10 : « 11 5 8 7 3 versus »).
 *
 * Le nom d'abord, quand il le dit (six contre six passe à 5). Sinon les
 * dimensions : un mini-terrain de moins de 30 m (un mini-stade de 24 × 12)
 * se joue à 3 ; un five, un futsal, un hat-trick (50 × 30 m au plus) à 5 ;
 * un petit terrain ou un demi-terrain (65 × 45 m au plus) à 7 ; jusqu'à
 * 88 m, à 8 ; au-delà, un grand terrain, à 11. Sans dimensions, d'autres
 * mots du nom ; 0 quand on ne sait pas.
 */
function format(e: Equipement): number {
  const ecrit = (e.equip_nom ?? "").match(ECRIT);
  if (ecrit) {
    const n = Number(ecrit[1] ?? ecrit[2]);
    return n === 6 ? 5 : n;
  }
  // La longueur est le plus grand côté, quel que soit l'ordre de saisie.
  const [long, large] = [e.equip_long ?? 0, e.equip_larg ?? 0].sort((a, b) => b - a);
  if (long > 0) {
    // Sans largeur, celle d'un terrain ordinaire de cette longueur.
    const l = large > 0 ? large : long * 0.6;
    if (long < 30) return 3;
    if (long <= 50 && l <= 30) return 5;
    if (long <= 65 && l <= 45) return 7;
    return long < 88 ? 8 : 11;
  }
  const n = (e.equip_nom ?? "").toLowerCase();
  if (/five|futsal|hat.?tre?i?ck|mini|petit/.test(n)) return 5;
  if (/poussin/.test(n)) return 8;
  if (/honneur|grand/.test(n)) return 11;
  return 0;
}

/* ────────────────────────────── Les noms ────────────────────────────── */

const PETITS = new Set(["de", "du", "des", "la", "le", "les", "et", "à", "au", "aux", "en", "sur", "sous", "lez", "lès"]);
/** Des noms communs, en minuscules après le premier mot (« Complexe sportif », « Stade municipal »). */
const COMMUNS = new Set(["sportif", "sportive", "municipal", "municipale", "synthétique", "football", "multi-sports", "multisports", "proximité", "jeux"]);
const SIGLES = new Set(["eps", "uphf", "vafc", "jp", "ii", "iii"]);
/** Les accents que les noms en capitales ont perdus. */
const ACCENTS: Record<string, string> = {
  andre: "André",
  leo: "Léo",
  leon: "Léon",
  general: "Général",
  etoile: "Étoile",
  celestin: "Célestin",
  frederic: "Frédéric",
  desire: "Désiré",
  maraichers: "Maraîchers",
  sollieres: "Sollières",
  liberte: "Liberté",
  egalite: "Égalité",
  iena: "Iéna",
  vallieres: "Vallières",
  cimetiere: "Cimetière",
  honore: "Honoré",
  deportes: "Déportés",
  hayees: "Hayées",
  pres: "Prés",
  clairiere: "Clairière",
  republique: "République",
  metropole: "Métropole",
  eluard: "Éluard",
  emile: "Émile",
  foret: "Forêt",
  freres: "Frères",
  liberation: "Libération",
  proximite: "proximité",
  synthetique: "synthétique",
  stabilise: "stabilisé",
  chatellerie: "Châtellerie",
  jaures: "Jaurès",
};

function majuscule(mot: string): string {
  return mot.charAt(0).toUpperCase() + mot.slice(1);
}

/** Un mot du recensement, mis au propre ; `premier` : le premier mot du nom. */
function motPropre(mot: string, premier: boolean): string {
  return mot
    .split(/([-'’/.])/)
    .map((part, k) => {
      if (!part || /^[-'’/.]$/.test(part)) return part;
      const bas = part.toLowerCase();
      const debut = premier && k === 0;
      if (SIGLES.has(bas)) return bas.toUpperCase();
      // Une initiale (« D », « G. ») ou un sigle connu restent en capitales.
      if (part.length === 1 && part === part.toUpperCase() && !/^[ldà]$/i.test(part)) return part;
      const accent = ACCENTS[bas];
      if (accent) return debut ? majuscule(accent) : accent;
      // Un petit mot en capitales (« DE », « LA ») passe en minuscules ; écrit
      // « La » dans un nom en casse mixte (« Centre La Marlière »), il reste.
      if (!debut && PETITS.has(bas) && (part === part.toUpperCase() || part === bas)) return bas;
      if (!debut && COMMUNS.has(bas)) return bas;
      if (/^[ld]$/.test(bas)) return debut ? bas.toUpperCase() : bas;
      // Un mot déjà en casse mixte (« McDonald », « Balaÿ ») ne bouge pas.
      if (part !== part.toUpperCase() && part !== bas && /^[A-ZÀ-Ý]/.test(part)) return part;
      return majuscule(bas);
    })
    .join("");
}

/**
 * Un nom lisible : les capitales du recensement (« STADE ANDRE GILLIARD »),
 * comme ses minuscules (« stade lionel terray »), passent à une capitale par
 * mot, sauf les petits mots et les noms communs (« Stade André Gilliard »,
 * « Complexe sportif Pierre de Coubertin ») ; les sigles restent.
 */
export function joli(brut: string): string {
  const s = brut
    .replace(/\s+/g, " ")
    .trim()
    // « STADE DE L ETOILE » : l'apostrophe perdue.
    .replace(/\b([LD]) (?=[AEIOUYHÉÈÊÀ])/g, "$1'")
    .replace(/\b([ld]) (?=[aeiouyhéèêà])/g, "$1'");
  return s
    .split(" ")
    .map((mot, i) => motPropre(mot, i === 0))
    .join(" ");
}

/** Les noms qu'aucune règle ne rend bien. */
const NOMS: Record<string, string> = {
  "SALLE DU PARC/59355/LOMME": "Stade du Parc, Lomme",
  "GYMNASE DEBERDT ET STADE VAN DEN EEDEN/59355/LOMME": "Stade Van den Eeden, Lomme",
  "Leo Lagrange Lomme": "Stade Léo Lagrange, Lomme",
  "Stade Clarles Bury": "Stade Charles Bury",
  "Complexe sportif Youri Gargarine": "Complexe sportif Youri Gagarine",
  "Stade Julien Da-rui": "Stade Julien Darui",
  "Terrain synthétique (stade Leo Lagrange)": "Stade Léo Lagrange",
  "Stade Sylvain Leverd / Salle des Cheminots": "Stade Sylvain Leverd",
  "Terrain synthétique et Boulodrome Emile de Bischop": "Espace Émile de Bischop",
  "STADE PAPIN et Boulodrome LEKADIR": "Stade Papin",
  "JOEL BATS": "Stade Joël Bats",
  "ESPACE SPORTIF Rue du Général Hoche": "Espace sportif du Général Hoche",
  "Complexe des Stade de Flandres DEWERDT - DELAPORTE": "Stades de Flandres Dewerdt-Delaporte",
  "COMPLEXE A MIMOUN": "Complexe Alain Mimoun",
  "Complexe Sportif JP PAPIN": "Complexe sportif Jean-Pierre Papin",
  "URBAN FOOTBALL": "Urban Football",
  "FOOTSAL RONCQ": "Footsal Roncq",
  "complexe B. Hinault": "Complexe Bernard Hinault",
  "complexe sportif D Eloy": "Complexe sportif D. Eloy",
  "TERRAIN DE JEUX du Haut vinage": "Terrain de jeux du Haut Vinage",
  "Salle Colette Besson": "Complexe Colette Besson",
  "Halle de Sports Debussy": "Complexe Debussy",
  "Gymnase Pierre de Coubertin": "Complexe Pierre de Coubertin",
  "COMPLEXE MULTI-SPORTS": "Complexe multisports",
  "COMPLEXE SPORTIF G.DRUT": "Complexe sportif Guy Drut",
};

/* ──────────────────────────── Les adresses ──────────────────────────── */

const VOIES: [RegExp, string][] = [
  [/^r\.? /i, "Rue "],
  [/^av\.? /i, "Avenue "],
  [/^bd\.? /i, "Boulevard "],
  [/^all\.? /i, "Allée "],
  [/^che\.? /i, "Chemin "],
  [/^qu\.? /i, "Quai "],
  [/^pl\.? /i, "Place "],
  [/^rte\.? /i, "Route "],
];

/** Les rues qu'aucune règle ne rend bien. */
const RUES: Record<string, string> = {
  "av Athur Notebart": "Avenue Arthur Notebart",
  "Avenue Duray Lille St Maurice Pellevoisin": "Avenue Duray",
  "Rue de l'abrisseau": "Rue de l'Arbrisseau",
  "Rue du Progrés": "Rue du Progrès",
  "Avenue de la liberation du 4 septembre 1944": "Avenue de la Libération du 4 Septembre 1944",
  "Rue des anciens d'afrique du nord": "Rue des Anciens d'Afrique du Nord",
  "Rue de Cantaing Espaces Verts": "Rue de Cantaing",
  "4119 Boulevard Clémenceau": "Boulevard Clémenceau",
};

/** Une rue lisible : chaque mot avec sa capitale, sauf les petits mots (« Rue de la Plage »). */
function rueLisible(voie: string): string {
  return voie
    .split(" ")
    .map((mot, i) =>
      mot
        .split(/([-'’])/)
        .map((part, k) => {
          if (!part || /^[-'’]$/.test(part)) return part;
          const bas = part.toLowerCase();
          if (/^\d/.test(part)) return bas;
          const debut = i === 0 && k === 0;
          if (ACCENTS[bas]) return majuscule(ACCENTS[bas]);
          if (!debut && (PETITS.has(bas) || /^[ld]$/.test(bas))) return bas;
          if (/^(bis|ter)$/.test(bas)) return bas;
          return majuscule(bas);
        })
        .join("")
    )
    .join(" ");
}

/** « r des deportes » → « Rue des Déportés » ; le code postal et la commune au bout. */
function adresse(e: Equipement, commune: string): string {
  let rue = (e.inst_adresse ?? "").replace(/\s+/g, " ").trim();
  rue = RUES[rue] ?? rue;
  // « RUE DE BEAUMONT HEM » : la commune recopiée en fin de rue.
  rue = rue.replace(new RegExp(`\\s+${commune.replace(/[-\s]/g, "[-\\s]")}$`, "i"), "");
  rue = rue.replace(/\s+-\s+BP\s*\d+$/i, "");
  // Le numéro : « 2 -4 », « 23 bis », « 64, ».
  const m = rue.match(/^(\d+)(?:\s?-\s?(\d+))?(?:\s?(bis|ter)\b)?\s*,?\s*/i);
  const numero = m ? `${m[1]}${m[2] ? `-${m[2]}` : ""}${m[3] ? ` ${m[3].toLowerCase()}` : ""} ` : "";
  let voie = m ? rue.slice(m[0].length) : rue;
  for (const [re, plein] of VOIES) voie = voie.replace(re, plein);
  voie = RUES[voie] ?? rueLisible(voie);
  const ligne = `${numero}${voie}`.trim();
  return [ligne, `${e.inst_cp ?? ""} ${commune}`.trim()].filter(Boolean).join(", ");
}

/* ──────────────────────────────── Tout ──────────────────────────────── */

/**
 * Les points que le recensement place mal : le stade Julien-Darui (avenue
 * Duray, Saint-Maurice-Pellevoisin) y porte les coordonnées du complexe
 * Youri-Gagarine, aux Bois-Blancs ; son terrain est celui d'OpenStreetMap.
 */
const POINTS: Record<string, [number, number]> = {
  I593500061: [50.65378, 3.08867],
};

function kmEntre(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const d = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(d));
}

async function lireRecensement(): Promise<GeoJson> {
  const depuis = process.argv.find((a) => a.startsWith("--depuis="))?.slice("--depuis=".length);
  if (depuis) return JSON.parse(readFileSync(depuis, "utf8")) as GeoJson;
  const res = await fetch(WFS, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`Géo2France répond ${res.status}`);
  return (await res.json()) as GeoJson;
}

async function main() {
  const res = await lireRecensement();
  const parSite = new Map<string, Equipement[]>();
  for (const f of res.features) {
    const e = f.properties;
    if (e.dep_code && e.dep_code !== "59") continue;
    if (!retenu(e)) continue;
    // Le point de l'équipement, sinon ses coordonnées écrites.
    const [x, y] = f.geometry?.coordinates ?? [Number(e.equip_x), Number(e.equip_y)];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    e.equip_x = String(x);
    e.equip_y = String(y);
    const l = parSite.get(e.inst_numero) ?? [];
    l.push(e);
    parSite.set(e.inst_numero, l);
  }

  const terrains: TerrainNord[] = [];
  for (const [id, equipements] of parSite) {
    // Le plus grand terrain d'abord : c'est lui qui place le complexe.
    equipements.sort((a, b) => format(b) - format(a) || (b.equip_long ?? 0) - (a.equip_long ?? 0));
    const e = equipements[0];
    const commune = e.new_name ?? "";
    const brut = (e.inst_nom ?? e.equip_nom ?? "Terrain").trim();
    const lat = Math.round(Number(e.equip_y) * 1e5) / 1e5;
    const lng = Math.round(Number(e.equip_x) * 1e5) / 1e5;
    // Le Nord : 49,9° à 51,1° de latitude, 2,0° à 4,3° de longitude.
    if (lat < 49.9 || lat > 51.15 || lng < 2 || lng > 4.3) {
      console.warn(`hors du Nord, laissé : ${brut} (${commune}) ${lat}, ${lng}`);
      continue;
    }
    const nom = NOMS[brut] ?? joli(brut);
    const [la, ln] = POINTS[id] ?? [lat, lng];
    const t: TerrainNord = {
      id,
      nom,
      commune,
      adresse: adresse(e, commune),
      lat: la,
      lng: ln,
      formats: equipements.map(format),
      eclaire: equipements.some((x) => x.equip_eclair === "true"),
      libre: equipements.some((x) => x.equip_acc_libre === "true"),
    };
    // Un même stade inscrit deux fois (deux installations à quelques pas,
    // même nom, même commune) : une seule ligne, tous ses terrains.
    const double = terrains.find((x) => x.commune === t.commune && x.nom === t.nom && kmEntre(x, t) < 0.3);
    if (double) {
      double.formats = [...double.formats, ...t.formats].sort((a, b) => b - a);
      double.eclaire ||= t.eclaire;
      double.libre ||= t.libre;
      continue;
    }
    terrains.push(t);
  }
  terrains.sort((a, b) => a.commune.localeCompare(b.commune, "fr") || a.nom.localeCompare(b.nom, "fr"));

  const catalogue: CatalogueTerrains = {
    source: "Recensement des équipements sportifs (Data ES), ministère chargé des Sports",
    licence: "Licence Ouverte 2.0",
    date: new Date().toISOString().slice(0, 10),
    terrains,
  };
  mkdirSync(dirname(SORTIE), { recursive: true });
  writeFileSync(SORTIE, JSON.stringify(catalogue) + "\n");
  const n = terrains.reduce((s, t) => s + t.formats.length, 0);
  console.log(`${terrains.length} complexes, ${n} terrains, ${new Set(terrains.map((t) => t.commune)).size} communes → ${SORTIE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
