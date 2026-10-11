// Le mini-stade de BOLA, en SVG.
//
// Repris cote pour cote de l'app iOS (Vues/Plan/PlanStade.swift) : le stade de
// piliers du site en miniature, 20 piliers autour d'un terrain de five, en
// isométrie 2:1, dans une boîte de 64. Ordre de dessin : fond, socle, piliers
// du fond, pelouse, lignes, piliers de devant. Une chaîne SVG, pour servir à
// la fois aux composants React et aux repères Leaflet (qui veulent du HTML).

export type Moment = "jour" | "weekend" | "semaine";

/** Le fond de la vignette selon le moment du match (comme la tuile de match). */
export const FOND_MOMENT: Record<Moment, [string, string, string]> = {
  jour: ["#4A0E30", "#2D051B", "#12020A"],
  weekend: ["#3A513A", "#263526", "#141D14"],
  semaine: ["#3A3E44", "#24272B", "#14171B"],
};

const ENCRE = "#0A0B0D";
const BLANC = "#F4F5F2";

const f = (n: number) => Number(n.toFixed(2));

export function stadeSvg(moment: Moment, opts: { fantome?: boolean; fond?: boolean } = {}): string {
  const fantome = !!opts.fantome;
  const fond = opts.fond !== false;
  const id = `bola-${moment}`;
  const out: string[] = [];
  const push = (s: string) => out.push(s);

  push(`<svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`);
  const [c0, c1, c2] = FOND_MOMENT[moment];
  push(`<defs>
    <linearGradient id="${id}-fond" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset=".5" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <linearGradient id="${id}-socle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B2F35"/><stop offset="1" stop-color="#16191D"/></linearGradient>
    <radialGradient id="${id}-proj" cx="32" cy="37" r="17" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>`);

  // 1. Fond
  if (!fantome && fond) push(`<rect width="64" height="64" fill="url(#${id}-fond)"/>`);

  // 2. Socle : ovale (2 ; 23,5 ; 60 x 30), sa tranche d'abord
  if (fantome) {
    push(`<ellipse cx="32" cy="38.5" rx="30" ry="15" fill="none" stroke="${ENCRE}" stroke-opacity=".32" stroke-width="1" stroke-dasharray="3 2.5"/>`);
  } else {
    push(`<ellipse cx="32" cy="42" rx="30" ry="15" fill="#050607"/>`);
    push(`<ellipse cx="32" cy="38.5" rx="30" ry="15" fill="url(#${id}-socle)" stroke="#fff" stroke-opacity=".1" stroke-width=".6"/>`);
  }

  // 3. Piliers : 20 sur l'ovale rx 26,5 ry 13,25 centre (32, 38)
  const piliers = Array.from({ length: 20 }, (_, i) => {
    const a = ((i + 0.5) / 20) * 2 * Math.PI;
    return { x: 32 + 26.5 * Math.cos(a), y: 38 + 13.25 * Math.sin(a), devant: Math.sin(a) > 0 };
  });
  const pilier = (c: { x: number; y: number; devant: boolean }) => {
    const h = 11;
    if (fantome) {
      push(`<rect x="${f(c.x - 1.3)}" y="${f(c.y - h)}" width="2.6" height="${h}" fill="none" stroke="${ENCRE}" stroke-opacity=".32" stroke-width=".7"/>`);
      push(`<rect x="${f(c.x - 1.9)}" y="${f(c.y - h - 1.3)}" width="3.8" height="1.4" fill="none" stroke="${ENCRE}" stroke-opacity=".32" stroke-width=".7"/>`);
      return;
    }
    const clair = c.devant ? BLANC : "#D9DAD5";
    const ombre = c.devant ? "#BFC0BA" : "#A9AAA4";
    push(`<rect x="${f(c.x - 1.3)}" y="${f(c.y - h)}" width="2.6" height="${h}" fill="${clair}"/>`);
    push(`<rect x="${f(c.x)}" y="${f(c.y - h)}" width="1.3" height="${h}" fill="${ombre}"/>`);
    push(`<rect x="${f(c.x - 1.9)}" y="${f(c.y - h - 1.3)}" width="3.8" height="1.4" fill="${clair}"/>`);
    push(`<rect x="${f(c.x - 1.9)}" y="${f(c.y - 0.9)}" width="3.8" height="1.2" fill="${ombre}"/>`);
  };
  piliers.filter((c) => !c.devant).sort((a, b) => a.y - b.y).forEach(pilier);

  // 4. Pelouse : centre (32 ; 37), demi-longueur A (14 ; 7), demi-largeur B (-7,6 ; 3,8)
  const q = (a: number, b: number) => `${f(32 + a * 14 + b * -7.6)},${f(37 + a * 7 + b * 3.8)}`;
  const quad = (a0: number, a1: number) => `${q(a0, -1)} ${q(a1, -1)} ${q(a1, 1)} ${q(a0, 1)}`;
  const pelouse = quad(-1, 1);
  if (!fantome) {
    push(`<polygon points="${pelouse}" fill="#4F6F48"/>`);
    for (const i of [1, 3, 5]) {
      const a0 = -1 + i / 3;
      push(`<polygon points="${quad(a0, a0 + 1 / 3)}" fill="#45633F"/>`);
    }
    if (moment === "jour") push(`<polygon points="${pelouse}" fill="url(#${id}-proj)"/>`);
  }

  // 5. Lignes
  const trait = fantome ? `stroke="${ENCRE}" stroke-opacity=".4"` : `stroke="#fff" stroke-opacity=".85"`;
  push(`<polygon points="${pelouse}" fill="none" ${trait} stroke-width=".8"/>`);
  push(`<polyline points="${q(0, -1)} ${q(0, 1)}" fill="none" ${trait} stroke-width=".7"/>`);
  push(`<ellipse cx="32" cy="37" rx="3.6" ry="1.8" fill="none" ${trait} stroke-width=".7"/>`);
  for (const s of [-1, 1]) {
    push(`<polyline points="${q(s * 1.04, -0.32)} ${q(s * 1.04, 0.32)}" fill="none" ${trait} stroke-width="1.4"/>`);
  }

  // 6. Piliers de devant, du plus loin au plus proche
  piliers.filter((c) => c.devant).sort((a, b) => a.y - b.y).forEach(pilier);

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

/** L'état d'un match SFL vu du sticker : il manque N, tu y es, complet. */
export type EtatSticker = { genre: "manque"; n: number } | { genre: "dedans" } | { genre: "complet" } | { genre: "joue" };

export interface StickerPlan {
  id: string;
  lat: number;
  lng: number;
  moment: Moment;
  jourCourt: string;
  heure: string;
  etat: EtatSticker;
  nom: string;
}

/** Le HTML d'un sticker de match pour Leaflet (le CSS est dans globals.css). */
export function stickerHtml(s: StickerPlan, choisi: boolean): string {
  const badge =
    s.etat.genre === "manque"
      ? `<span class="stk__badge stk__badge--manque">${s.etat.n}</span>`
      : s.etat.genre === "dedans"
        ? `<span class="stk__badge stk__badge--dedans">${COCHE}</span>`
        : "";
  const etiquette =
    s.etat.genre === "manque"
      ? `<span class="stk__etiquette stk__etiquette--manque">il manque ${s.etat.n}</span>`
      : s.etat.genre === "dedans"
        ? `<span class="stk__etiquette stk__etiquette--dedans">tu y es</span>`
        : `<span class="stk__etiquette stk__etiquette--complet">${s.etat.genre === "joue" ? "joué" : "complet"}</span>`;
  return `<div class="stk${choisi ? " stk--choisi" : ""}${s.etat.genre === "complet" || s.etat.genre === "joue" ? " stk--complet" : ""}" style="--penche:${penche(s.id)}deg">
  <div class="stk__vignette">
    <div class="stk__stade">${stadeSvg(s.moment)}</div>
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
export function pointHtml(nom: string): string {
  return `<div class="ter"><div class="ter__vignette"><div class="ter__stade">${stadeSvg("semaine")}</div></div><span class="ter__queue"></span><span class="ter__nom">${echapper(nom)}</span></div>`;
}

/**
 * La photo satellite centrée sur un point (Esri World Imagery, sans clé) :
 * une image de `l` × `h` pixels qui couvre ~`demi` degrés de latitude de part
 * et d'autre. C'est la « vue aérienne du vrai terrain » de l'app iPhone.
 */
export function photoSatellite(lat: number, lng: number, l = 600, h = 450, demi = 0.0012): string {
  const dl = (demi / Math.cos((lat * Math.PI) / 180)) * (l / h);
  const bbox = [lng - dl, lat - demi, lng + dl, lat + demi].map((n) => n.toFixed(6)).join(",");
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=3857&size=${l},${h}&format=jpg&f=image`;
}

/** Les trois façons d'y aller : Plans (Apple), Google Maps, Waze. */
export function itineraires(lat: number, lng: number, nom: string) {
  return [
    { id: "plans", libelle: "Plans", url: `https://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(nom)}` },
    { id: "google", libelle: "Google Maps", url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` },
    { id: "waze", libelle: "Waze", url: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` },
  ] as const;
}
