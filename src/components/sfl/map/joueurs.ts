// Les joueurs sur la Map, à la manière de la Snap Map (Sabri, 22/10).
//
// Chaque joueur est dans sa ville (lib/sfl/villes), jamais à sa position. Ce
// que la Snap Map fait des amis, la Map le fait des joueurs :
//   · de loin, une ville est une PILE : trois cartes en éventail (les mieux
//     notés devant, ceux qui ont une photo d'abord), le compte dans une
//     pastille, le nom de la ville dessous. Des villes trop proches à
//     l'écran se fondent en une seule pile, celle de la plus peuplée ;
//   · en s'approchant, quand la place le permet, la pile s'ouvre : les cartes
//     sortent du centre et se posent en tournesol autour du nom de la ville,
//     à l'angle d'or (137,5°), le mieux noté au plus près. Au-delà de
//     OUVERTE_MAX, un « +N » sur le nom : le reste est dans le catalogue.
//
// Ce fichier ne connaît pas MapLibre : il reçoit des points à l'écran et rend
// des dispositions et du HTML (le dessin est dans globals.css, le mouvement
// dans app/map/animations.css).

export interface JoueurPlan {
  name: string;
  affiche: string;
  note: number;
  photo: string | null;
}

export interface VillePlan {
  id: string;
  ville: string;
  lat: number;
  lng: number;
  /** Du mieux noté au moins bien noté. */
  joueurs: JoueurPlan[];
}

const PHI = (1 + Math.sqrt(5)) / 2;
/** L'angle d'or, en radians : le tournesol. */
const ANGLE_OR = Math.PI * 2 * (1 - 1 / PHI);
/** Le premier anneau laisse la place au nom de la ville ; l'écart suit √i. */
const R0 = 58;
const PAS = 30;
/** Au-delà, le reste est dans le catalogue. */
export const OUVERTE_MAX = 21;
/** Deux piles plus proches que ça à l'écran n'en font qu'une. */
const FUSION = 96;
/** Le rayon qu'occupe une pile fermée (cartes, pastille et nom). */
const R_PILE = 52;
/** Une ville ne s'ouvre qu'à partir de ce zoom (le quartier ; zoom de MapLibre). */
export const ZOOM_OUVERTURE = 11;

/** Le dossier d'une ville : « Villeneuve-d'Ascq » → « villeneuve-d-ascq ». */
export function cleVille(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** La place de la i-ème carte autour du centre, en pixels. */
export function tournesol(i: number): { x: number; y: number } {
  const r = R0 + PAS * Math.sqrt(i);
  const a = i * ANGLE_OR - Math.PI / 2;
  // Étiré en largeur : le nom de la ville, au centre, est plus large que haut.
  return { x: Math.round(Math.cos(a) * r * 1.3), y: Math.round(Math.sin(a) * r * 0.92) };
}

function rayonOuvert(n: number): number {
  return (R0 + PAS * Math.sqrt(Math.max(0, Math.min(n, OUVERTE_MAX) - 1))) * 1.3 + 34;
}

export type Disposition =
  | { genre: "pile"; id: string; ville: string; lat: number; lng: number; joueurs: JoueurPlan[]; villes: VillePlan[] }
  | { genre: "ouverte"; id: string; ville: string; lat: number; lng: number; joueurs: JoueurPlan[] };

/**
 * Où va chaque ville à ce zoom. `ecran` projette un point sur l'écran (en
 * pixels). Les villes les plus peuplées passent d'abord : elles gardent leur
 * place, les petites voisines se fondent en elles.
 */
export function disposer(
  villes: VillePlan[],
  zoom: number,
  ecran: (lat: number, lng: number) => { x: number; y: number },
  /** Ce qu'un tournesol ne doit pas recouvrir (les stickers des matchs). */
  obstacles: { x: number; y: number; r: number }[] = []
): Disposition[] {
  const ordre = [...villes].sort((a, b) => b.joueurs.length - a.joueurs.length || a.ville.localeCompare(b.ville));
  const groupes: { tete: VillePlan; villes: VillePlan[]; x: number; y: number }[] = [];
  for (const v of ordre) {
    const p = ecran(v.lat, v.lng);
    const proche = groupes.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < FUSION);
    if (proche) proche.villes.push(v);
    else groupes.push({ tete: v, villes: [v], x: p.x, y: p.y });
  }

  // Ouvrir ce qui a la place, des plus peuplées aux plus petites : un
  // tournesol ne recouvre ni une pile voisine ni un autre tournesol.
  const rayons = groupes.map(() => R_PILE);
  const ouverte = groupes.map(() => false);
  if (zoom >= ZOOM_OUVERTURE) {
    groupes.forEach((g, i) => {
      if (g.villes.length > 1) return;
      const r = rayonOuvert(g.tete.joueurs.length);
      const libre =
        groupes.every((h, k) => k === i || Math.hypot(h.x - g.x, h.y - g.y) >= r + rayons[k]) &&
        obstacles.every((o) => Math.hypot(o.x - g.x, o.y - g.y) >= r + o.r);
      if (libre) {
        ouverte[i] = true;
        rayons[i] = r;
      }
    });
  }

  return groupes.map((g, i) => {
    const joueurs = g.villes.length > 1 ? g.villes.flatMap((v) => v.joueurs).sort((a, b) => b.note - a.note) : g.tete.joueurs;
    return ouverte[i]
      ? { genre: "ouverte", id: g.tete.id, ville: g.tete.ville, lat: g.tete.lat, lng: g.tete.lng, joueurs }
      : { genre: "pile", id: g.villes.map((v) => v.id).join("+"), ville: g.tete.ville, lat: g.tete.lat, lng: g.tete.lng, joueurs, villes: g.villes };
  });
}

/* ──────────────────────────────── Le dessin ──────────────────────────────── */

const echapper = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

function visage(j: JoueurPlan): string {
  return j.photo
    ? `<img src="${echapper(j.photo)}" alt="" loading="lazy" decoding="async" draggable="false" />`
    : `<span class="jc__initiale">${echapper(j.affiche.slice(0, 1).toUpperCase())}</span>`;
}

/** La taille de la pile suit le nombre d'or : grande, moyenne, petite. */
function taillePile(n: number): "grande" | "moyenne" | "petite" {
  return n >= 13 ? "grande" : n >= 5 ? "moyenne" : "petite";
}

/** Une pile fermée : trois cartes en éventail, le compte, la ville. */
export function pileHtml(d: Extract<Disposition, { genre: "pile" }>): string {
  // Devant : ceux qui ont une photo, du mieux noté au moins bien noté.
  const devant = [...d.joueurs].sort((a, b) => Number(!!b.photo) - Number(!!a.photo) || b.note - a.note).slice(0, 3);
  const eventail = [
    ["-11deg", "-9px", "2px"],
    ["10deg", "9px", "2px"],
    ["0deg", "0px", "0px"],
  ];
  // Le premier est posé en dernier : il est au-dessus.
  const cartes = devant
    .map((j, i) => ({ j, pose: eventail[devant.length === 1 ? 2 : devant.length === 2 ? [2, 1][i] : [2, 0, 1][i]] }))
    .reverse()
    .map(({ j, pose }) => `<span class="jc grp__carte" style="--r:${pose[0]};--x:${pose[1]};--y:${pose[2]}">${visage(j)}</span>`)
    .join("");
  const autres = d.villes.length > 1 ? `<span class="grp__plus">+${d.villes.length - 1}</span>` : "";
  return `<div class="grp grp--${taillePile(d.joueurs.length)}" data-pile="${echapper(d.id)}">
  <div class="grp__pile">${cartes}<span class="grp__compte">${d.joueurs.length}</span></div>
  <span class="grp__ville">${echapper(d.ville)}${autres}</span>
</div>`;
}

/** Le nom d'une ville ouverte, au centre de son tournesol. */
export function centreHtml(ville: string, n: number): string {
  const reste = n > OUVERTE_MAX ? `<span class="vil__reste">+${n - OUVERTE_MAX}</span>` : "";
  return `<div class="vil"><span class="vil__nom">${echapper(ville)}</span><span class="vil__compte">${n}</span>${reste}</div>`;
}

/** Une carte d'une ville ouverte, à sa place dans le tournesol. */
export function joueurHtml(j: JoueurPlan, i: number, sort: boolean): string {
  const p = tournesol(i);
  return `<div class="jr${sort ? " jr--sort" : ""}" style="--dx:${p.x}px;--dy:${p.y}px;--i:${i}">
  <span class="jc jr__carte">${visage(j)}<span class="jr__note">${j.note}</span></span>
  <span class="jr__nom">${echapper(j.affiche)}</span>
</div>`;
}

/* ───────────────────────────── Le regroupement ───────────────────────────── */

/** Deux stickers plus proches que ça à l'écran n'en font qu'un. */
const FUSION_MATCHS = 112;
/** Une pile de joueurs sous un sticker s'y range. */
export const FUSION_PILE = 100;
/** La place d'un sticker pour un tournesol : sa vignette et son nom. */
export const R_STICKER = 56;

export interface GroupeMatchs {
  /** Le sticker qui reste à l'écran : le choisi, sinon le premier venu. */
  tete: string;
  ids: string[];
  x: number;
  y: number;
}

/**
 * Les matchs qui se chevauchent à l'écran (Sabri, 22/10 : « s'il y a des
 * choses qui doivent se chevaucher, elles fusionnent ») : un seul sticker
 * reste, les autres s'y rangent. Le choisi est toujours une tête.
 */
export function grouperMatchs(points: { id: string; x: number; y: number }[], choisi: string | null): GroupeMatchs[] {
  const ordre = [...points].sort((a, b) => Number(b.id === choisi) - Number(a.id === choisi));
  const groupes: GroupeMatchs[] = [];
  for (const p of ordre) {
    const proche = groupes.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < FUSION_MATCHS);
    if (proche) proche.ids.push(p.id);
    else groupes.push({ tete: p.id, ids: [p.id], x: p.x, y: p.y });
  }
  return groupes;
}

/** La pastille sous un sticker qui en range d'autres : « 2 matchs · 14 joueurs ». */
export function groupeHtml(matchs: number, joueurs: number): string {
  const morceaux = [
    ...(matchs > 1 ? [`${matchs} matchs`] : []),
    ...(joueurs > 0 ? [`${joueurs} joueur${joueurs > 1 ? "s" : ""}`] : []),
  ];
  return morceaux.length ? `<span class="stk__groupe">${morceaux.join(" · ")}</span>` : "";
}
