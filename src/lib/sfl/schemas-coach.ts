// Les schémas du coach : le corps et le terrain, dessinés par l'app.
//
// Demande de Sabri (19/10) : ne plus générer d'image à chaque fois qu'il
// faut montrer une zone. Le coach dit seulement QUOI montrer (« ischios,
// côté droit », « toi ici, l'appel là ») et l'app le dessine tout de suite,
// dans la DA Bola : silhouette grise sur fond sombre, la zone visée allumée
// en blanc. L'image générée (fal) ne reste qu'en secours, pour un geste ou
// une posture que ces schémas ne savent pas montrer.
//
// Le corps : les tracés de face et de dos viennent de react-body-highlighter
// (licence MIT, © 2020 GV79, https://github.com/giavinh79/react-body-highlighter),
// recopiés ici et renommés en français ; chevilles et pieds ajoutés. Repère
// 100 × 210, le corps vu en face : sur la vue de face, la droite du joueur est
// à gauche de l'image ; sur la vue de dos, à droite.
//
// Le terrain : un five vu de dessus, en hauteur (le but adverse en haut),
// repère 0–100 sur la largeur et la longueur.

export const ZONES_CORPS = [
  "tete", "cou", "epaules", "pectoraux", "biceps", "triceps", "avant-bras", "abdos", "obliques",
  "trapezes", "haut-du-dos", "lombaires", "fessiers", "adducteurs", "quadriceps", "ischios",
  "genoux", "mollets", "chevilles", "pieds",
] as const;
export type ZoneCorps = (typeof ZONES_CORPS)[number];
export const COTES = ["droit", "gauche", "les deux"] as const;
export type Cote = (typeof COTES)[number];

export const NOM_ZONE: Record<ZoneCorps, string> = {
  tete: "Tête",
  cou: "Cou",
  epaules: "Épaules",
  pectoraux: "Pectoraux",
  biceps: "Biceps",
  triceps: "Triceps",
  "avant-bras": "Avant-bras",
  abdos: "Abdos",
  obliques: "Obliques",
  trapezes: "Trapèzes",
  "haut-du-dos": "Haut du dos",
  lombaires: "Lombaires",
  fessiers: "Fessiers",
  adducteurs: "Adducteurs",
  quadriceps: "Quadriceps",
  ischios: "Ischios",
  genoux: "Genoux",
  mollets: "Mollets",
  chevilles: "Chevilles",
  pieds: "Pieds",
};

type Vue = "face" | "dos";

/** Les polygones de chaque zone, vue par vue (points « x y x y … »). */
export const TRACES: Record<Vue, Partial<Record<ZoneCorps, string[]>>> = {
  face: {
    "pectoraux": ["51.8 41.6 51 55.1 58 58 67.8 55.5 70.6 47.3 62 41.6", "29.8 46.5 31.4 55.5 40.8 58 48.2 55.1 47.8 42 37.6 42"],
    "obliques": ["68.6 63.3 67.3 57.1 58.8 59.6 60 64.1 60.4 83.3 65.7 78.8 66.5 69.8", "33.9 78.4 33.1 71.8 31 63.3 32.2 57.1 40.8 59.2 39.2 63.3 39.2 83.7"],
    "abdos": ["56.3 59.2 58 64.1 58.4 78 58.4 92.7 56.3 98.4 55.1 104.1 51.4 107.8 51 84.5 50.6 67.3 51 57.1", "43.7 58.8 48.6 57.1 49 67.3 48.6 84.5 48.2 107.3 44.5 103.7 40.8 91.4 40.8 78.4 41.2 64.5"],
    "biceps": ["16.7 68.2 18 71.4 22.9 66.1 29 53.9 27.8 49.4 20.4 55.9", "71.4 49.4 70.2 54.7 76.3 66.1 81.6 71.8 82.9 69 78.8 55.5"],
    "triceps": ["69.4 55.5 69.4 61.6 75.9 72.7 77.6 70.2 75.5 67.3", "22.4 69.4 29.8 55.5 29.8 60.8 22.9 73.1"],
    "cou": ["55.5 23.7 50.6 33.5 50.6 39.2 61.6 40 70.6 44.9 69.4 36.7 63.3 35.1 58.4 30.6", "29 44.9 30.2 37.1 36.3 35.1 41.2 30.2 44.5 24.5 49 33.9 48.6 39.2 38 39.6"],
    "epaules": ["78.4 53.1 79.6 47.8 79.2 41.2 75.9 38 71 36.3 72.2 42.9 71.4 47.3", "28.2 47.3 21.2 53.1 20 47.8 20.4 40.8 24.5 37.1 28.6 37.1 26.9 43.3"],
    "tete": ["42.4 2.9 40 11.8 42 19.6 46.1 23.3 49.8 25.3 54.7 22.4 57.6 19.2 59.2 10.2 57.1 2.4 49.8 0"],
    "adducteurs": ["52.7 110.2 54.3 124.9 60 110.2 62 100 64.9 94.3 60 92.7 56.7 104.5", "47.8 110.6 44.9 125.3 42 115.9 40.4 113.1 39.6 107.3 38 102.4 34.7 93.9 39.6 92.2 41.6 99.2 43.7 105.3"],
    "quadriceps": ["34.7 98.8 37.1 108.2 37.1 127.8 34.3 137.1 31 132.7 29.4 120 28.2 111.4 29.4 100.8 32.2 94.7", "63.3 105.7 64.5 100 66.9 94.7 70.2 101.2 71 111.8 68.2 133.1 65.3 137.6 62.4 128.6 62 111.4", "38.8 129.4 38.4 112.2 41.2 118.4 44.5 129.4 42.9 135.1 40 146.1 36.3 146.5 35.5 140", "59.6 145.7 55.5 129 60.8 113.9 61.2 130.2 64.1 139.6 62.9 146.5", "32.7 138.4 26.5 145.7 25.7 136.7 25.7 127.3 26.9 114.3 29.4 133.5", "71.8 113.1 73.9 124.1 73.9 140.4 72.7 145.7 66.5 138.4 70.2 133.5"],
    "genoux": ["33.9 140 34.7 143.3 35.5 147.3 36.3 151 35.1 156.7 29.8 156.7 27.3 152.7 27.3 147.3 30.2 144.1", "65.7 140 72.2 147.8 72.2 152.2 69.8 157.1 64.9 156.7 62.9 151"],
    "mollets": ["71.4 160.4 73.5 153.5 76.7 161.2 79.6 167.8 78.4 187.8 79.6 195.5 74.7 195.5", "24.9 194.7 27.8 164.9 28.2 160.4 26.1 154.3 24.9 157.6 22.4 161.6 20.8 167.8 22 188.2 20.8 195.5", "72.7 195.1 69.8 159.2 65.3 158.4 64.1 162.4 64.1 165.3 65.7 177.1", "35.5 158.4 35.9 162.4 35.9 166.9 35.1 172.2 35.1 176.7 32.2 182 30.6 187.3 26.9 194.7 27.3 187.8 28.2 180.4 28.6 175.5 29 169.8 29.8 164.1 30.2 158.8"],
    "avant-bras": ["6.1 88.6 10.2 75.1 14.7 70.2 16.3 74.3 19.2 73.5 4.5 97.6 0 100", "84.5 69.8 83.3 73.5 80 73.1 95.1 98.4 100 100.4 93.5 89.4 89.8 76.3", "77.6 72.2 77.6 77.6 80.4 84.1 85.3 89.8 92.2 101.2 94.7 99.6", "6.9 101.2 13.5 90.6 18.8 84.1 21.6 77.1 21.2 71.8 4.9 98.8"],
    "chevilles": ["22.5 196.5 33.5 196.5 33 202 23 202", "66.5 196.5 77.5 196.5 77 202 67 202"],
    "pieds": ["22.5 203.5 33.5 203.5 35.5 210 19.5 210", "66.5 203.5 77.5 203.5 80.5 210 64.5 210"],
  },
  dos: {
    "tete": ["50.6 0 46 0.9 40.9 5.5 40.4 12.8 45.1 20 55.7 20 59.1 13.6 59.6 4.7 55.7 1.3"],
    "trapezes": ["44.7 21.7 47.7 21.7 47.2 38.3 47.7 64.7 38.3 53.2 35.3 40.9 31.1 36.6 39.1 33.2 43.8 27.2", "52.3 21.7 55.7 21.7 56.6 27.2 60.9 32.8 68.9 36.6 64.7 40.4 61.7 53.2 52.3 64.7 53.2 38.3"],
    "epaules": ["29.4 37 23 39.1 17.4 44.3 18.3 53.6 24.3 49.4 27.2 46.4", "71.1 37 78.3 39.6 82.6 44.7 81.7 53.6 74.9 48.9 72.3 45.1"],
    "haut-du-dos": ["31.1 38.7 28.1 48.9 28.5 55.3 34 75.3 47.2 71.1 47.2 66.4 36.6 54 33.6 41.3", "68.9 38.7 71.9 49.4 71.5 56.2 66 75.3 52.8 71.1 52.8 66.4 63.4 54.5 66.4 41.7"],
    "triceps": ["26.8 49.8 17.9 55.7 14.5 72.3 16.6 81.7 21.7 63.8 26.8 55.7", "73.6 50.2 82.1 55.7 86 73.2 83.4 82.1 77.9 63 73.2 55.7", "26.8 58.3 26.8 68.5 23 75.3 19.1 77.4 22.6 65.5", "72.8 58.3 77 64.7 80.4 77.4 76.6 75.3 72.8 68.9"],
    "lombaires": ["47.7 72.8 34.5 77 35.3 83.4 49.4 102.1 46.8 83", "52.3 72.8 65.5 77 64.7 83.4 50.6 102.1 53.2 83.8"],
    "avant-bras": ["86.4 75.7 91.1 83.4 93.2 94 100 106.4 96.2 104.3 88.1 89.4 84.3 83.8", "13.6 75.7 8.9 83.8 6.8 93.6 0 106.4 3.8 104.3 12.3 88.5 15.7 83", "81.3 79.6 77.4 77.9 79.1 84.7 91.1 103.8 93.2 108.9 94.5 104.7", "18.7 79.6 22.1 77.9 20.9 84.3 9.4 103 6.8 108.5 5.1 104.7"],
    "fessiers": ["44.7 99.6 30.2 108.5 29.8 118.7 31.5 126 47.2 121.3 49.4 114.9", "55.3 99.1 51.1 114.5 52.3 120.9 68.1 126 69.8 119.1 69.4 108.5"],
    "adducteurs": ["48.1 123 44.7 123 41.3 125.5 45.1 144.3 48.5 135.7 48.9 129.4", "51.9 122.6 55.7 123.4 59.1 126 54.9 144.3 51.9 136.2 51.1 129.4"],
    "ischios": ["28.9 122.1 31.1 129.4 36.6 126 35.3 135.3 34.5 150.2 29.4 158.3 28.9 146.8 27.7 141.3 27.2 131.5", "71.5 121.7 69.4 128.9 63.8 126 65.5 136.6 66.4 150.2 71.1 158.3 71.5 147.7 72.8 142.1 73.6 131.9", "38.7 125.5 44.3 146 40.4 166.8 36.2 152.8 37 135.3", "61.7 125.5 63.4 136.2 64.3 153.2 60 166.8 56.2 146.4"],
    "genoux": ["34.5 153.2 31.1 159.1 33.6 166.4 37.4 162.6", "66.4 153.6 63 163 66.8 166.4 69.4 159.1"],
    "mollets": ["29.4 160.4 28.5 167.2 24.7 179.6 23.8 192.8 25.5 197 28.5 193.2 29.8 180 31.9 171.1 31.9 166.8", "37.4 165.1 35.3 167.7 33.2 171.9 31.1 180.4 30.2 191.9 34 200 38.7 190.6 39.1 168.9", "63 165.1 61.3 168.5 61.7 190.6 66.4 199.6 70.6 191.9 68.9 179.6 66.8 170.2", "70.6 160.4 72.3 168.5 75.7 179.1 76.6 192.8 74.5 196.6 72.3 193.6 70.6 179.6 68.1 168.1", "28.5 195.7 30.2 195.7 33.6 201.7 30.6 220 28.5 213.6 26.8 198.3", "69.8 195.7 71.9 195.7 73.6 198.3 71.9 213.2 70.2 219.6 67.2 202.1"],
  },
};

export interface SchemaCorps {
  zones: { zone: ZoneCorps; cote: Cote }[];
  legende: string;
}

/** Le côté d'un polygone, pour le joueur (voir l'en-tête). */
export function coteDe(vue: Vue, points: string): "droit" | "gauche" {
  const n = points.split(" ").map(Number);
  let x = 0;
  for (let i = 0; i < n.length; i += 2) x += n[i];
  const aGauche = x / (n.length / 2) < 50;
  return vue === "face" ? (aGauche ? "droit" : "gauche") : aGauche ? "gauche" : "droit";
}

/** Les vues utiles : celles où au moins une zone demandée existe. */
export function vuesDe(s: SchemaCorps): Vue[] {
  const v = (["face", "dos"] as const).filter((vue) => s.zones.some((z) => TRACES[vue][z.zone]));
  return v.length ? v : ["face"];
}

export const allume = (s: SchemaCorps, vue: Vue, zone: ZoneCorps, points: string) =>
  s.zones.some((z) => z.zone === zone && (z.cote === "les deux" || z.cote === coteDe(vue, points)));

/* -------------------------------- Le terrain ------------------------------- */

export const ROLES_TERRAIN = ["moi", "partenaire", "adversaire"] as const;
export type RoleTerrain = (typeof ROLES_TERRAIN)[number];
export const TYPES_FLECHE = ["course", "passe", "tir"] as const;
export type TypeFleche = (typeof TYPES_FLECHE)[number];

export interface SchemaTerrain {
  joueurs: { role: RoleTerrain; x: number; y: number }[];
  fleches: { type: TypeFleche; x1: number; y1: number; x2: number; y2: number }[];
  /** La zone à occuper ou à couvrir, si besoin. */
  zone: { x: number; y: number; r: number } | null;
  ballon: { x: number; y: number } | null;
  legende: string;
}

export type SchemaCoach = ({ type: "corps" } & SchemaCorps) | ({ type: "terrain" } & SchemaTerrain);

const borne = (v: unknown, min = 0, max = 100) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null);
const legende = (v: unknown) => (typeof v === "string" ? v.slice(0, 200) : "");

/** Un schéma reçu (du modèle, ou relu en base), vérifié champ par champ ; null s'il n'y a rien à dessiner. */
export function lireSchema(v: unknown): SchemaCoach | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  if (s.type === "corps") {
    const zones = (Array.isArray(s.zones) ? s.zones : [])
      .filter((z): z is Record<string, unknown> => !!z && typeof z === "object")
      .filter((z) => (ZONES_CORPS as readonly string[]).includes(z.zone as string))
      .map((z) => ({ zone: z.zone as ZoneCorps, cote: (COTES as readonly string[]).includes(z.cote as string) ? (z.cote as Cote) : "les deux" }))
      .slice(0, 8);
    return zones.length ? { type: "corps", zones, legende: legende(s.legende) } : null;
  }
  if (s.type === "terrain") {
    const joueurs = (Array.isArray(s.joueurs) ? s.joueurs : [])
      .filter((j): j is Record<string, unknown> => !!j && typeof j === "object" && (ROLES_TERRAIN as readonly string[]).includes(j.role as string))
      .flatMap((j) => {
        const x = borne(j.x);
        const y = borne(j.y);
        return x == null || y == null ? [] : [{ role: j.role as RoleTerrain, x, y }];
      })
      .slice(0, 10);
    const fleches = (Array.isArray(s.fleches) ? s.fleches : [])
      .filter((f): f is Record<string, unknown> => !!f && typeof f === "object" && (TYPES_FLECHE as readonly string[]).includes(f.type as string))
      .flatMap((f) => {
        const [x1, y1, x2, y2] = [f.x1, f.y1, f.x2, f.y2].map((n) => borne(n));
        return x1 == null || y1 == null || x2 == null || y2 == null ? [] : [{ type: f.type as TypeFleche, x1, y1, x2, y2 }];
      })
      .slice(0, 6);
    const z = s.zone && typeof s.zone === "object" ? (s.zone as Record<string, unknown>) : null;
    const zx = borne(z?.x);
    const zy = borne(z?.y);
    // r = 0 : pas de zone (le modèle remplit toujours tous les champs).
    const zr = typeof z?.r === "number" && z.r > 0 ? borne(z.r, 4, 40) : null;
    const b = s.ballon && typeof s.ballon === "object" && (s.ballon as Record<string, unknown>).montre !== false ? (s.ballon as Record<string, unknown>) : null;
    const bx = borne(b?.x);
    const by = borne(b?.y);
    if (!joueurs.length && !fleches.length) return null;
    return {
      type: "terrain",
      joueurs,
      fleches,
      zone: zx != null && zy != null && zr != null ? { x: zx, y: zy, r: zr } : null,
      ballon: bx != null && by != null ? { x: bx, y: by } : null,
      legende: legende(s.legende),
    };
  }
  return null;
}
