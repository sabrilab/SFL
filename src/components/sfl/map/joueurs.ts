// Les joueurs sur la Map, à la manière de la Snap Map (Sabri, 22/10).
//
// Chaque joueur est dans sa ville (lib/sfl/villes), jamais à sa position. Ce
// que la Snap Map fait des amis, la Map le fait des joueurs :
//   · de loin, une ville est une PILE : trois cartes en éventail (les mieux
//     notés devant, ceux qui ont une photo d'abord), le compte dans une
//     pastille, le nom de la ville dessous. Des villes trop proches à
//     l'écran se fondent en une seule pile, celle de la plus peuplée ;
//   · la pile reste un paquet fermé tant qu'on ne l'a pas touchée (Sabri,
//     24/10 : « tu crées vraiment des paquets indivisibles tant qu'on n'a
//     pas cliqué dessus. Jusqu'à ce qu'on zoome jusqu'au bout ») : des
//     cartes éparpillées cachaient les matchs. La toucher ouvre sa
//     collection (map/collection-pile.tsx) ;
//   · tout au bout du zoom (ZOOM_OUVERTURE), quand la place le permet, elle
//     s'ouvre : les cartes sortent du centre et se posent en tournesol autour
//     du nom de la ville, à l'angle d'or (137,5°), le mieux noté au plus
//     près. Au-delà de OUVERTE_MAX, un « +N » sur le nom : le reste est dans
//     le catalogue.
//
// Avec le filtre Contrats (map/contrats-map.ts, 23/10), seules les cibles du
// dimanche restent, chacune sous un viseur à la couleur du rang de son
// contrat, sa prime à la place de sa note (le dessin du viseur est dans
// map/contrats-map.css). Les matchs s'effacent alors du plan : les villes
// s'ouvrent dès le quartier (ZOOM_OUVERTURE_CONTRATS), comme avant le 24/10.
//
// Ce fichier ne connaît pas MapLibre : il reçoit des points à l'écran et rend
// des dispositions et du HTML (le dessin est dans globals.css, le mouvement
// dans app/map/animations.css).

/** Les contrats signés contre un joueur, tels que la Map les montre (map/contrats-map.ts). */
export interface ContratPlan {
  /** Le plus haut rang des contrats sur lui : la couleur du viseur. */
  rang: "S" | "A" | "B";
  /** Ce que rapportent, ensemble, les contrats sur lui. */
  prime: number;
  /** verrou : en jeu ; accompli : un contrat sur lui a réussi ; rate : tous ratés ; eteint : tous annulés. */
  etat: "verrou" | "accompli" | "rate" | "eteint";
  /** Le match se joue : le viseur bat. */
  direct: boolean;
}

export interface JoueurPlan {
  name: string;
  affiche: string;
  note: number;
  /** La photo à montrer : sa vignette (lib/sfl/photos, photoMiniature). */
  photo: string | null;
  /** La photo entière, si la vignette ne vient pas (carte-map.tsx s'en charge). */
  secours?: string | null;
  /** Le filtre Contrats : ce qu'il y a sur sa tête. */
  contrat?: ContratPlan;
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
/** Une ville ne s'ouvre qu'au bout du zoom (zoom de MapLibre ; le plus proche est 17,5). */
export const ZOOM_OUVERTURE = 17;
/** Avec le filtre Contrats, les matchs effacés, elle s'ouvre dès le quartier. */
export const ZOOM_OUVERTURE_CONTRATS = 11;
/** Le zoom où l'on va voir une ville : ses rues, sa pile. */
export const ZOOM_VILLE = 12;

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
  obstacles: { x: number; y: number; r: number }[] = [],
  /** Le zoom à partir duquel une ville peut s'ouvrir. */
  zoomOuverture = ZOOM_OUVERTURE
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
  if (zoom >= zoomOuverture) {
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

// Pas de chargement paresseux : les vignettes pèsent quelques Ko, l'écran
// d'accueil les a déjà préchargées (app-splash.tsx), et les repères sont
// refaits à chaque fin de zoom — une image paresseuse y repasserait par une
// carte vide.
function visage(j: JoueurPlan): string {
  const secours = j.secours && j.secours !== j.photo ? ` data-secours="${echapper(j.secours)}"` : "";
  return j.photo
    ? `<img src="${echapper(j.photo)}"${secours} alt="" decoding="async" draggable="false" />`
    : `<span class="jc__initiale">${echapper(j.affiche.slice(0, 1).toUpperCase())}</span>`;
}

const ORDRE_RANG = { S: 0, A: 1, B: 2 } as const;

/** Une cible passe devant les autres, la plus haute d'abord, puis la plus grosse prime. */
function avantCible(a: JoueurPlan, b: JoueurPlan): number {
  if (!a.contrat || !b.contrat) return Number(!!b.contrat) - Number(!!a.contrat);
  return ORDRE_RANG[a.contrat.rang] - ORDRE_RANG[b.contrat.rang] || b.contrat.prime - a.contrat.prime;
}

/** Les classes d'une cible : la couleur de son rang (fiche--S, actus/missions.css) et l'état de ses contrats. */
function classesCible(c: ContratPlan): string {
  return ` cible fiche--${c.rang} cible--${c.etat}${c.direct ? " cible--direct" : ""}`;
}

/** Les quatre coins du viseur. */
const VISEUR = `<i class="cible__coin cible__coin--hg"></i><i class="cible__coin cible__coin--hd"></i><i class="cible__coin cible__coin--bg"></i><i class="cible__coin cible__coin--bd"></i>`;

/** La taille de la pile suit le nombre d'or : grande, moyenne, petite. */
function taillePile(n: number): "grande" | "moyenne" | "petite" {
  return n >= 13 ? "grande" : n >= 5 ? "moyenne" : "petite";
}

/** Une pile fermée : trois cartes en éventail, le compte, la ville. */
export function pileHtml(d: Extract<Disposition, { genre: "pile" }>): string {
  // Devant : les cibles (filtre Contrats), puis ceux qui ont une photo, du mieux noté au moins bien noté.
  const devant = [...d.joueurs]
    .sort((a, b) => avantCible(a, b) || Number(!!b.photo) - Number(!!a.photo) || b.note - a.note)
    .slice(0, 3);
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
  // La cible de devant, sous son viseur.
  const c = devant[0]?.contrat;
  const viseur = c ? `<span class="grp__viseur${classesCible(c)}">${VISEUR}</span>` : "";
  return `<div class="grp grp--${taillePile(d.joueurs.length)}" data-pile="${echapper(d.id)}">
  <div class="grp__pile">${cartes}${viseur}<span class="grp__compte">${d.joueurs.length}</span></div>
  <span class="grp__ville">${echapper(d.ville)}${autres}</span>
</div>`;
}

/** Le nom d'une ville ouverte, au centre de son tournesol. */
export function centreHtml(ville: string, n: number): string {
  const reste = n > OUVERTE_MAX ? `<span class="vil__reste">+${n - OUVERTE_MAX}</span>` : "";
  return `<div class="vil"><span class="vil__nom">${echapper(ville)}</span><span class="vil__compte">${n}</span>${reste}</div>`;
}

/** Une carte d'une ville ouverte, à sa place dans le tournesol. Une cible : sous son viseur, sa prime à la place de sa note. */
export function joueurHtml(j: JoueurPlan, i: number, sort: boolean): string {
  const p = tournesol(i);
  const c = j.contrat;
  const bas = c ? `<span class="jr__note cible__prime">+${c.prime}</span>` : `<span class="jr__note">${j.note}</span>`;
  return `<div class="jr${sort ? " jr--sort" : ""}${c ? classesCible(c) : ""}" style="--dx:${p.x}px;--dy:${p.y}px;--i:${i}">
  <span class="jc jr__carte">${visage(j)}${bas}</span>${c ? `<span class="jr__viseur">${VISEUR}</span>` : ""}
  <span class="jr__nom">${echapper(j.affiche)}</span>
</div>`;
}

/* ───────────────────────────── Le regroupement ───────────────────────────── */

/** Deux stickers plus proches que ça à l'écran n'en font qu'un. */
export const FUSION_MATCHS = 112;
/** Une pile de joueurs sur un sticker ou sous ses noms s'y range (de côté, au-dessus, en dessous). */
export const FUSION_PILE = 100;
/** La place d'un sticker pour un tournesol : sa vignette et son nom. */
export const R_STICKER = 56;

export interface GroupeMatchs {
  /** Le sticker qui reste devant : le choisi, sinon le plus proche dans le temps. */
  tete: string;
  /** Les matchs du paquet : la tête, puis les autres dans l'ordre du temps. */
  ids: string[];
  x: number;
  y: number;
}

/**
 * Les matchs qui se chevauchent à l'écran (Sabri, 22/10 : « s'il y a des
 * choses qui doivent se chevaucher, elles fusionnent ») : un paquet, le
 * premier devant, les autres rangés derrière lui. Le choisi est toujours une
 * tête ; sinon, le match le plus proche dans le temps (`rang` : l'ordre des
 * matchs, le joué en dernier).
 */
export function grouperMatchs(points: { id: string; x: number; y: number; rang: number }[], choisi: string | null): GroupeMatchs[] {
  const ordre = [...points].sort((a, b) => Number(b.id === choisi) - Number(a.id === choisi) || a.rang - b.rang);
  const groupes: GroupeMatchs[] = [];
  for (const p of ordre) {
    const proche = groupes.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < FUSION_MATCHS);
    if (proche) proche.ids.push(p.id);
    else groupes.push({ tete: p.id, ids: [p.id], x: p.x, y: p.y });
  }
  return groupes;
}

/**
 * Les joueurs rangés sous un sticker (leur ville est au même endroit, à
 * l'écran) : leur pile en petit, posée contre lui, et leur nombre — des
 * cartes, qu'on ne les prenne pas pour des matchs. La toucher ouvre leur
 * collection.
 */
export function joueursSousHtml(joueurs: JoueurPlan[]): string {
  const devant = [...joueurs].sort((a, b) => Number(!!b.photo) - Number(!!a.photo) || b.note - a.note).slice(0, 3);
  const poses = [
    ["-13deg", "-6px"],
    ["10deg", "6px"],
    ["-2deg", "0px"],
  ];
  const cartes = devant
    .map((j, i) => ({ j, pose: poses[devant.length === 1 ? 2 : devant.length === 2 ? [2, 1][i] : [2, 0, 1][i]] }))
    .reverse()
    .map(({ j, pose }) => `<span class="jc stk__joueurs-carte" style="--r:${pose[0]};--x:${pose[1]}">${visage(j)}</span>`)
    .join("");
  const n = joueurs.length;
  return `<span class="stk__joueurs" role="button" aria-label="${n} joueur${n > 1 ? "s" : ""} ici">${cartes}<span class="stk__joueurs-compte">${n}</span></span>`;
}
