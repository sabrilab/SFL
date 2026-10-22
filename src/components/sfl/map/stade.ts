// Le mini-stade de BOLA, en SVG.
//
// Repris cote pour cote de l'app iOS (Vues/Plan/PlanStade.swift) : le stade de
// piliers du site en miniature, 20 piliers autour d'un terrain de five, en
// isométrie 2:1, dans une boîte de 64. Ordre de dessin : fond, socle, piliers
// du fond, pelouse, lignes, piliers de devant. Une chaîne SVG, pour servir à
// la fois aux composants React et aux repères Leaflet (qui veulent du HTML).
//
// Variantes (15/10, Sabri garde le mini-stade « en plus beau ») : la même
// construction, avec des finitions — ombre portée sous le socle, pelouse
// éclairée au centre, piliers à chapiteau et base, tranche du socle :
//   - origine : le dessin d'avant, à l'identique ;
//   - fini    : le dessin d'avant, fini (ombre, lumière, chapiteaux) ;
//   - proche  : fini, et resserré : le stade remplit la vignette ;
//   - nuit    : fini, quatre projecteurs et leurs faisceaux ;
//   - marbre  : fini sur fond clair, le blanc du site ;
//   - mono    : fini en noir et blanc, pelouse grise.
// 16/10, Sabri : « Tu mets les deux. » Noir et blanc sur le plan clair (et
// dans la fiche du match), marbre sur la vue satellite, sombre. `VARIANTE_STADE`
// est celle par défaut ; les autres restent pour comparer.

import { SATELLITE } from "./style-snap";

export type Moment = "jour" | "weekend" | "semaine";
export type VarianteStade = "origine" | "fini" | "proche" | "nuit" | "marbre" | "mono";
export const VARIANTES_STADE: VarianteStade[] = ["origine", "fini", "proche", "nuit", "marbre", "mono"];

/** La variante dessinée dans l'app. */
export const VARIANTE_STADE: VarianteStade = "mono";

/** Le fond de la vignette selon le moment du match (comme la tuile de match). */
export const FOND_MOMENT: Record<Moment, [string, string, string]> = {
  jour: ["#4A0E30", "#2D051B", "#12020A"],
  weekend: ["#3A513A", "#263526", "#141D14"],
  semaine: ["#3A3E44", "#24272B", "#14171B"],
};

/** La ligue d'un match, qui donne sa couleur au stade (Sabri, 22/10 : « même
 *  Team, ça doit donner lieu à des couleurs de stades différentes ») :
 *  la SFL au vert du dimanche, Bola au gris de la marque, Team au bleu nuit. */
export type LigueMatch = "sfl" | "bola" | "team";

export const COULEUR_LIGUE: Record<LigueMatch, { fond: [string, string, string]; herbe: [string, string] }> = {
  sfl: { fond: ["#3A5A3A", "#243A24", "#111C11"], herbe: ["#5E8C52", "#527D47"] },
  bola: { fond: ["#45474B", "#2A2C2F", "#151619"], herbe: ["#6E7073", "#626467"] },
  team: { fond: ["#2E3F66", "#1A2647", "#0A1226"], herbe: ["#4F7A86", "#456D79"] },
};

const ENCRE = "#0A0B0D";
const BLANC = "#F4F5F2";

const f = (n: number) => Number(n.toFixed(2));

export function stadeSvg(
  moment: Moment,
  opts: { fantome?: boolean; fond?: boolean; variante?: VarianteStade; ligue?: LigueMatch } = {},
): string {
  const fantome = !!opts.fantome;
  const fond = opts.fond !== false;
  const v = opts.variante ?? VARIANTE_STADE;
  const fini = v !== "origine";
  const ligue = opts.ligue ? COULEUR_LIGUE[opts.ligue] : null;
  const id = `bola-${moment}-${v}${opts.ligue ? `-${opts.ligue}` : ""}`;
  const out: string[] = [];
  const push = (s: string) => out.push(s);

  // Les couleurs de la variante ; la ligue, quand elle est dite, peint le
  // fond (sauf le marbre, sur la photo satellite) et la pelouse.
  const [c0, c1, c2] =
    ligue && v !== "marbre"
      ? ligue.fond
      : v === "marbre"
        ? ["#FBFBF9", "#EEEEEA", "#DCDDD8"]
        : v === "mono"
          ? ["#45474B", "#2A2C2F", "#151619"]
          : v === "nuit"
            ? ["#1A1F27", "#0D1015", "#05070A"]
            : FOND_MOMENT[moment];
  const socle = v === "marbre" ? ["#E4E5E0", "#C9CAC4"] : ["#2B2F35", "#16191D"];
  const tranche = v === "marbre" ? "#AFB0AA" : "#050607";
  const herbe = ligue ? ligue.herbe : v === "mono" ? ["#6E7073", "#626467"] : v === "nuit" ? ["#5E8C52", "#527D47"] : ["#4F6F48", "#45633F"];
  const hPilier = v === "proche" ? 12 : 11;

  push(`<svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`);
  push(`<defs>
    <linearGradient id="${id}-fond" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset=".5" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <linearGradient id="${id}-socle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${socle[0]}"/><stop offset="1" stop-color="${socle[1]}"/></linearGradient>
    <radialGradient id="${id}-proj" cx="32" cy="37" r="17" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}-ombre" cx="32" cy="44" r="31" gradientTransform="matrix(1 0 0 .42 0 25.5)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#000" stop-opacity="${v === "marbre" ? ".28" : ".55"}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}-faisceau" cx="32" cy="37" r="22" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFF6DC" stop-opacity=".42"/><stop offset="1" stop-color="#FFF6DC" stop-opacity="0"/></radialGradient>
  </defs>`);

  // 1. Fond
  if (!fantome && fond) push(`<rect width="64" height="64" fill="url(#${id}-fond)"/>`);

  // Resserré : tout le stade grandit autour de son centre.
  if (v === "proche") push(`<g transform="translate(32 38.6) scale(1.08) translate(-32 -38)">`);

  // 2. Socle : ovale (2 ; 23,5 ; 60 x 30), son ombre et sa tranche d'abord
  if (fantome) {
    push(`<ellipse cx="32" cy="38.5" rx="30" ry="15" fill="none" stroke="${ENCRE}" stroke-opacity=".32" stroke-width="1" stroke-dasharray="3 2.5"/>`);
  } else {
    if (fini) push(`<ellipse cx="32" cy="45" rx="31" ry="13" fill="url(#${id}-ombre)"/>`);
    push(`<ellipse cx="32" cy="42" rx="30" ry="15" fill="${tranche}"/>`);
    push(`<ellipse cx="32" cy="38.5" rx="30" ry="15" fill="url(#${id}-socle)" stroke="#fff" stroke-opacity="${v === "marbre" ? ".7" : ".1"}" stroke-width=".6"/>`);
  }

  // 3. Piliers : 20 sur l'ovale rx 26,5 ry 13,25 centre (32, 38)
  const piliers = Array.from({ length: 20 }, (_, i) => {
    const a = ((i + 0.5) / 20) * 2 * Math.PI;
    return { x: 32 + 26.5 * Math.cos(a), y: 38 + 13.25 * Math.sin(a), devant: Math.sin(a) > 0 };
  });
  const pilier = (c: { x: number; y: number; devant: boolean }) => {
    const h = hPilier;
    if (fantome) {
      push(`<rect x="${f(c.x - 1.3)}" y="${f(c.y - h)}" width="2.6" height="${h}" fill="none" stroke="${ENCRE}" stroke-opacity=".32" stroke-width=".7"/>`);
      push(`<rect x="${f(c.x - 1.9)}" y="${f(c.y - h - 1.3)}" width="3.8" height="1.4" fill="none" stroke="${ENCRE}" stroke-opacity=".32" stroke-width=".7"/>`);
      return;
    }
    const clair = c.devant ? BLANC : "#D9DAD5";
    const ombre = c.devant ? "#BFC0BA" : "#A9AAA4";
    push(`<rect x="${f(c.x - 1.3)}" y="${f(c.y - h)}" width="2.6" height="${h}" fill="${clair}"/>`);
    push(`<rect x="${f(c.x)}" y="${f(c.y - h)}" width="1.3" height="${h}" fill="${ombre}"/>`);
    if (fini) {
      // Une cannelure, et le chapiteau en deux plateaux.
      push(`<rect x="${f(c.x - 0.55)}" y="${f(c.y - h + 0.6)}" width=".35" height="${f(h - 1.6)}" fill="${ombre}" opacity=".7"/>`);
      push(`<rect x="${f(c.x - 1.6)}" y="${f(c.y - h - 0.6)}" width="3.2" height=".8" fill="${ombre}"/>`);
      push(`<rect x="${f(c.x - 2)}" y="${f(c.y - h - 1.5)}" width="4" height="1" fill="${clair}"/>`);
      push(`<rect x="${f(c.x - 2)}" y="${f(c.y - 0.9)}" width="4" height="1.2" fill="${ombre}"/>`);
      return;
    }
    push(`<rect x="${f(c.x - 1.9)}" y="${f(c.y - h - 1.3)}" width="3.8" height="1.4" fill="${clair}"/>`);
    push(`<rect x="${f(c.x - 1.9)}" y="${f(c.y - 0.9)}" width="3.8" height="1.2" fill="${ombre}"/>`);
  };
  piliers.filter((c) => !c.devant).sort((a, b) => a.y - b.y).forEach(pilier);

  // 4. Pelouse : centre (32 ; 37), demi-longueur A (14 ; 7), demi-largeur B (-7,6 ; 3,8)
  const q = (a: number, b: number) => `${f(32 + a * 14 + b * -7.6)},${f(37 + a * 7 + b * 3.8)}`;
  const quad = (a0: number, a1: number) => `${q(a0, -1)} ${q(a1, -1)} ${q(a1, 1)} ${q(a0, 1)}`;
  const pelouse = quad(-1, 1);
  if (!fantome) {
    // Fini : la tranche de la pelouse, posée sur le socle.
    if (fini) push(`<polygon points="${q(-1, 1)} ${q(1, 1)} ${q(1, -1)} ${f(32 + 14 + 7.6)},${f(37 + 7 - 3.8 + 1.2)} ${f(32 - 14 - 7.6)},${f(37 - 7 + 3.8 + 1.2)}" fill="#000" opacity=".28"/>`);
    push(`<polygon points="${pelouse}" fill="${herbe[0]}"/>`);
    for (const i of [1, 3, 5]) {
      const a0 = -1 + i / 3;
      push(`<polygon points="${quad(a0, a0 + 1 / 3)}" fill="${herbe[1]}"/>`);
    }
    if (moment === "jour" || fini) push(`<polygon points="${pelouse}" fill="url(#${id}-proj)"/>`);
    if (v === "nuit") push(`<ellipse cx="32" cy="37" rx="24" ry="12" fill="url(#${id}-faisceau)"/>`);
  }

  // 5. Lignes
  const trait = fantome ? `stroke="${ENCRE}" stroke-opacity=".4"` : `stroke="#fff" stroke-opacity="${fini ? ".92" : ".85"}"`;
  push(`<polygon points="${pelouse}" fill="none" ${trait} stroke-width=".8"/>`);
  push(`<polyline points="${q(0, -1)} ${q(0, 1)}" fill="none" ${trait} stroke-width=".7"/>`);
  push(`<ellipse cx="32" cy="37" rx="3.6" ry="1.8" fill="none" ${trait} stroke-width=".7"/>`);
  for (const s of [-1, 1]) {
    push(`<polyline points="${q(s * 1.04, -0.32)} ${q(s * 1.04, 0.32)}" fill="none" ${trait} stroke-width="1.4"/>`);
  }

  // 6. Piliers de devant, du plus loin au plus proche
  piliers.filter((c) => c.devant).sort((a, b) => a.y - b.y).forEach(pilier);

  // 7. Nuit : quatre mâts aux coins, leur tête allumée
  if (v === "nuit" && !fantome) {
    for (const [x, y] of [[9, 31], [55, 31], [12, 47], [52, 47]]) {
      push(`<line x1="${x}" y1="${y}" x2="${x}" y2="${y - 17}" stroke="#C9CAC4" stroke-width=".9"/>`);
      push(`<rect x="${x - 2.2}" y="${y - 19}" width="4.4" height="2.2" rx=".5" fill="#FFF6DC"/>`);
      push(`<circle cx="${x}" cy="${y - 18}" r="4.5" fill="#FFF6DC" opacity=".22"/>`);
    }
  }

  if (v === "proche") push(`</g>`);
  push(`</svg>`);
  return out.join("");
}

/** Le symbole BOLA (lune / ballon), recadré sur son encombrement réel. */
export function symboleSvg(couleur = BLANC): string {
  return `<svg viewBox="60 59.964 391.133 391.133" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="${couleur}" fill-rule="evenodd" d="M451.133,255.531c0-108.009-87.559-195.567-195.567-195.567S60,147.522,60,255.531s87.558,195.566,195.566,195.566c8.771,0,17.407-.577,25.872-1.696-57.091-9.652-100.572-59.334-100.572-119.17,0-66.753,54.113-120.867,120.866-120.867s120.867,54.114,120.867,120.867c0,12.206-1.81,23.99-5.175,35.098,21.275-31.301,33.707-69.097,33.707-109.797Z"/></svg>`;
}

/** Inclinaison déterministe d'un sticker, par identifiant (comme dans l'app). */
export function penche(id: string): number {
  let somme = 0;
  for (const ch of id) somme += ch.codePointAt(0) ?? 0;
  return [-5, 4, -3, 6, -6, 3][(somme + 5) % 6];
}

/** « 19h30 » → « 19H30 », « 13h00 » → « 13H ». */
export function heureCourte(heure: string): string {
  const h = heure.toUpperCase();
  return h.endsWith("H00") ? h.slice(0, -2) : h;
}

const echapper = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** L'état d'un match SFL vu du sticker : il manque N, N participants, tu y es, complet. */
export type EtatSticker =
  | { genre: "manque"; n: number }
  /** Une journée de ligue, sans plafond : qui vient déjà. */
  | { genre: "inscrits"; n: number }
  | { genre: "dedans" }
  | { genre: "complet" }
  /** Un match d'équipe (Team) : les deux sigles, « SF – LC ». */
  | { genre: "equipe"; texte: string }
  | { genre: "joue" };

export interface StickerPlan {
  id: string;
  lat: number;
  lng: number;
  moment: Moment;
  jourCourt: string;
  heure: string;
  etat: EtatSticker;
  nom: string;
  ligue?: LigueMatch;
}

/** Le HTML d'un sticker de match pour Leaflet (le CSS est dans globals.css). */
export function stickerHtml(s: StickerPlan, choisi: boolean, variante?: VarianteStade): string {
  const badge =
    s.etat.genre === "manque"
      ? `<span class="stk__badge stk__badge--manque">${s.etat.n}</span>`
      : s.etat.genre === "inscrits" && s.etat.n > 0
        ? `<span class="stk__badge stk__badge--inscrits">${s.etat.n}</span>`
        : s.etat.genre === "dedans"
          ? `<span class="stk__badge stk__badge--dedans">${COCHE}</span>`
          : "";
  const etiquette =
    s.etat.genre === "manque"
      ? `<span class="stk__etiquette stk__etiquette--manque">il manque ${s.etat.n}</span>`
      : s.etat.genre === "inscrits"
        ? `<span class="stk__etiquette stk__etiquette--inscrits">${s.etat.n ? `${s.etat.n} participant${s.etat.n > 1 ? "s" : ""}` : "ouvert"}</span>`
        : s.etat.genre === "dedans"
          ? `<span class="stk__etiquette stk__etiquette--dedans">tu y es</span>`
          : s.etat.genre === "equipe"
            ? `<span class="stk__etiquette stk__etiquette--inscrits">${echapper(s.etat.texte)}</span>`
            : `<span class="stk__etiquette stk__etiquette--complet">${s.etat.genre === "joue" ? "joué" : "complet"}</span>`;
  return `<div class="stk${s.ligue ? ` stk--${s.ligue}` : ""}${choisi ? " stk--choisi" : ""}${s.etat.genre === "complet" || s.etat.genre === "joue" ? " stk--complet" : ""}" style="--penche:${penche(s.id)}deg">
  <div class="stk__vignette">
    <div class="stk__stade">${stadeSvg(s.moment, { variante, ligue: s.ligue })}</div>
    <span class="stk__cal"><span class="stk__cal-jour">${echapper(s.jourCourt)}</span><span class="stk__cal-heure">${echapper(heureCourte(s.heure))}</span></span>
    ${choisi ? etiquette : badge}
  </div>
  <span class="stk__queue"></span>
  <span class="stk__nom">${echapper(s.nom)}</span>
</div>`;
}

const COCHE = `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#EFEFEC" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>`;

/** Le HTML de « toi » : ta carte en miniature, debout là où tu es. */
export function toiHtml(note: number, teinte: string): string {
  return `<div class="toi"><div class="toi__carte"><span class="toi__symbole">${symboleSvg()}</span><span class="toi__note">${note}</span><span class="toi__bande" style="background:${teinte}"></span></div><span class="toi__anneau"></span></div>`;
}

/**
 * Un terrain enregistré sans match ce jour : le mini-stade en plus petit,
 * désaturé, et son nom dans une étiquette blanche — qu'on le repère d'un
 * coup d'œil sur le plan comme sur le satellite.
 */
export function pointHtml(nom: string, variante?: VarianteStade): string {
  return `<div class="ter"><div class="ter__vignette"><div class="ter__stade">${stadeSvg("semaine", { variante })}</div></div><span class="ter__queue"></span><span class="ter__nom">${echapper(nom)}</span></div>`;
}

const TUILE = 256;

/** Un point en pixels du monde de Mercator, au zoom `z` (tuiles de 256). */
function mercator(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = TUILE * 2 ** z;
  const phi = (lat * Math.PI) / 180;
  return { x: ((lng + 180) / 360) * n, y: ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * n };
}

export interface MosaiqueSatellite {
  /** Ce qu'on montre, en pixels de tuiles depuis la première tuile : le viewBox d'un SVG. */
  boite: [number, number, number, number];
  /** Les tuiles à poser, à leur place dans ce repère. */
  tuiles: { x: number; y: number; url: string }[];
}

/**
 * La photo satellite centrée sur un point (Esri World Imagery, sans clé),
 * faite des tuiles de la vue satellite du plan : ~`demi` degrés de latitude
 * de part et d'autre, `rapport` = largeur / hauteur. C'est la « vue aérienne
 * du vrai terrain » de l'app iPhone. Le zoom est le premier qui donne au
 * moins 1,5 pixel de tuile par pixel affiché sur `hauteur` px : aussi net que
 * l'ancienne image calculée par Esri, en 4 à 9 tuiles.
 *
 * Avant le 22/10, c'était une seule image demandée au service « export »
 * d'Esri, qui la calculait à chaque fois (~2 s) et en interdisait le cache
 * (max-age=0) : le carrousel de la Map attendait ses photos à chaque
 * ouverture. Les tuiles sortent d'un CDN en ~150 ms et restent un jour dans
 * le cache du téléphone.
 */
export function mosaiqueSatellite(
  lat: number,
  lng: number,
  { demi, rapport, hauteur }: { demi: number; rapport: number; hauteur: number }
): MosaiqueSatellite {
  const haut = (z: number) => mercator(lat - demi, lng, z).y - mercator(lat + demi, lng, z).y;
  let z = 10;
  while (z < 18 && haut(z) < 1.5 * hauteur) z++;
  const c = mercator(lat, lng, z);
  const h = haut(z);
  const w = h * rapport;
  const [gauche, dessus] = [c.x - w / 2, c.y - h / 2];
  const [tx0, ty0] = [Math.floor(gauche / TUILE), Math.floor(dessus / TUILE)];
  const tuiles: MosaiqueSatellite["tuiles"] = [];
  for (let ty = ty0; ty <= Math.floor((dessus + h) / TUILE); ty++)
    for (let tx = tx0; tx <= Math.floor((gauche + w) / TUILE); tx++)
      tuiles.push({
        x: (tx - tx0) * TUILE,
        y: (ty - ty0) * TUILE,
        url: SATELLITE.replace("{z}", String(z)).replace("{y}", String(ty)).replace("{x}", String(tx)),
      });
  return { boite: [gauche - tx0 * TUILE, dessus - ty0 * TUILE, w, h], tuiles };
}

/** Les trois façons d'y aller : Plans (Apple), Google Maps, Waze. */
export function itineraires(lat: number, lng: number, nom: string) {
  return [
    { id: "plans", libelle: "Plans", url: `https://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(nom)}` },
    { id: "google", libelle: "Google Maps", url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` },
    { id: "waze", libelle: "Waze", url: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` },
  ] as const;
}
