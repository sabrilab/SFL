// Le skin de nation « Zellige » (Maroc ; PACK AFRIQUE 2027).
//
// La médina de Fès (patrimoine mondial de l'UNESCO, 1981) et ses ateliers :
// le zellige, une mosaïque de tesselles de faïence émaillée taillées une à
// une au marteau dans des carreaux d'une dizaine de centimètres, posées face
// contre terre puis prises dans le mortier ; le tadelakt, l'enduit de chaux
// de Marrakech poli au galet et au savon noir ; le cèdre sculpté des
// plafonds. La carte est un mur de riad :
//   · le papier : le tadelakt, un blanc de chaux chaud, satiné, ses nuages
//     de polissage ; l'encre presque noire ;
//   · la face : autour du portrait, une chaîne de tesselles (étoiles à huit
//     branches vertes et losanges noirs, leurs joints de mortier), comme la
//     frise qui borde un panneau ; sous le portrait, le même réseau d'étoiles
//     et de croix, gravé dans la chaux, à peine ;
//   · le dos : le panneau entier. Un réseau d'étoiles et de croix (le plus
//     ancien des décors à huit branches), chaque tesselle d'un vert d'émail
//     un peu différent, ses facettes de taille tirées de la graine (un
//     panneau par joueur) ; au centre, autour de la lune, une rosace de cèdre
//     à seize pointes, ses facettes sculptées prises dans la lumière ; le
//     logotype posé sur un bandeau de tadelakt.
//   · le totem (totems/maroc.tsx, 02/11/2026) : le lion de l'Atlas taillé en
//     zellige marche au dos dans une niche de tadelakt, au-dessus du
//     logotype ; la lune et sa rosace de cèdre montent au-dessus de lui
//     (LUNE_MAROC, NICHE_MAROC) ; la glaçure s'use (craquelures, piqûres,
//     pointes ébréchées, tirées de la graine), le tadelakt garde les passes
//     du galet ; à la face, la frise s'use de même, et le lion est gaufré
//     dans le coin du portrait.
// Ce qu'on évite : toute calligraphie (les frises des monuments sont souvent
// coraniques), toute silhouette d'édifice religieux, le signe amazigh ⵣ
// (symbole identitaire et politique), l'étoile à cinq branches du drapeau.
// Le miel, une glaçure brune, reste brun : jamais l'or des cartes MVP.

import type { PropsMotifNation, SkinNation } from "./types";
import { alea, BANDE, f, H, LOGOTYPE_DOS, PORTRAIT, W } from "./outils";
import { LUNE_MAROC, NICHE_MAROC } from "./totems/maroc";

/** Le centre de la rosace et de la lune au dos : remontés au-dessus du lion (totems/maroc.tsx). */
const CENTRE_DOS = { cx: LUNE_MAROC.cx, cy: LUNE_MAROC.cy } as const;
/** L'échelle de la rosace de cèdre : la lune passe de 300 à LUNE_MAROC.d. */
const S = LUNE_MAROC.d / 300;
/**
 * La rosace de cèdre, à l'échelle de la lune de 300 : le disque (r0), les
 * creux (rm) et les pointes (r2). Resserrée (420 → 400) pour tenir dans le
 * panneau d'étoiles, au-dessus de la niche du lion, avec de l'air autour.
 */
const ROSACE_DOS = { r0: 340, rm: 370, r2: 400 } as const;

type Pt = [number, number];

// La palette : les verts d'émail (une cuisson n'est jamais égale), le noir, la chaux, le miel brun.
const VERTS = ["#2c5847", "#27503f", "#33624f", "#2a5444", "#21483a", "#305c4a"];
const NOIR = "#17191a";
const CHAUX = "#ece6da";
const CHAUX_EMAIL = "#f1ece2";
const MIEL = "#7d5a35";
const JOINT = "#cfc8b9";
const CEDRE = { clair: "#a57b52", milieu: "#7e5a3a", sombre: "#4c3420", ombre: "#33231a" };

/** √2/2 ÷ cos(π/8) : le creux d'une étoile à huit branches faite de deux carrés. */
const CREUX8 = Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8);

/** Une étoile à n branches (pointes R, creux r), tournée de `rot`, ses sommets un peu bougés (la taille au marteau). */
function etoile(cx: number, cy: number, R: number, n = 8, r = R * CREUX8, rot = 0, bouge?: () => number, amp = 0): string {
  let d = "";
  for (let k = 0; k < 2 * n; k++) {
    const a = rot + (k * Math.PI) / n;
    const ray = k % 2 === 0 ? R : r;
    const jx = bouge ? (bouge() - 0.5) * amp : 0;
    const jy = bouge ? (bouge() - 0.5) * amp : 0;
    d += `${k === 0 ? "M" : "L"}${f(cx + ray * Math.cos(a) + jx)} ${f(cy + ray * Math.sin(a) + jy)}`;
  }
  return d + "Z";
}

/** Un carré posé sur la pointe (le losange des frises). */
function losange(cx: number, cy: number, r: number, rot = 0): string {
  let d = "";
  for (let k = 0; k < 4; k++) {
    const a = rot + (k * Math.PI) / 2;
    d += `${k === 0 ? "M" : "L"}${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`;
  }
  return d + "Z";
}

/** Un rectangle arrondi (le chemin), pour les découpes. */
function rectArrondi(x: number, y: number, l: number, h: number, r: number): string {
  return `M${x + r} ${y}H${x + l - r}A${r} ${r} 0 0 1 ${x + l} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + l - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

/** Des points régulièrement espacés sur un rectangle arrondi (x, y, l, h, rayon r), à partir du milieu du haut. */
function surLePourtour(x: number, y: number, l: number, h: number, r: number, pas: number): Pt[] {
  const lh = l - 2 * r;
  const lv = h - 2 * r;
  const q = (Math.PI / 2) * r;
  const total = 2 * lh + 2 * lv + 4 * q;
  const n = Math.max(4, Math.round(total / pas));
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    let s = ((i * total) / n + lh / 2) % total;
    const coin = (cx: number, cy: number, a0: number, t: number): Pt => [cx + r * Math.cos(a0 + t / r), cy + r * Math.sin(a0 + t / r)];
    if (s < lh) { pts.push([x + r + s, y]); continue; }
    s -= lh;
    if (s < q) { pts.push(coin(x + l - r, y + r, -Math.PI / 2, s)); continue; }
    s -= q;
    if (s < lv) { pts.push([x + l, y + r + s]); continue; }
    s -= lv;
    if (s < q) { pts.push(coin(x + l - r, y + h - r, 0, s)); continue; }
    s -= q;
    if (s < lh) { pts.push([x + l - r - s, y + h]); continue; }
    s -= lh;
    if (s < q) { pts.push(coin(x + r, y + h - r, Math.PI / 2, s)); continue; }
    s -= q;
    if (s < lv) { pts.push([x, y + h - r - s]); continue; }
    s -= lv;
    pts.push(coin(x + r, y + r, Math.PI, s));
  }
  return pts;
}

const deja = new Map<string, unknown>();
function memo<T>(cle: string, calcul: () => T): T {
  const v = deja.get(cle);
  if (v !== undefined) return v as T;
  if (deja.size > 48) deja.clear();
  const r = calcul();
  deja.set(cle, r);
  return r;
}

/* ------------------------------- Le panneau ------------------------------- */

/** Le pas du réseau d'étoiles et de croix : une étoile tombe juste sur la lune. */
const PAS = 112;

interface Panneau {
  /** Les étoiles, groupées par teinte d'émail. */
  etoiles: string[];
  /** Les petites étoiles du cœur, en chaux ou en noir. */
  coeursChaux: string;
  coeursNoirs: string;
  /** Le cœur des croix : un losange noir, parfois miel. */
  croixNoir: string;
  croixMiel: string;
  /** La lumière prise par l'émail : un éclat sur une branche de chaque étoile. */
  eclats: string;
  /** L'usure : la glaçure craquelée, ses piqûres, une pointe ébréchée (la graine). */
  craquelures: string;
  piqures: string;
  ebrechures: string;
}

function panneau(graine: number): Panneau {
  const rnd = alea(graine ^ 0x2a5f);
  const etoiles = VERTS.map(() => "");
  let coeursChaux = "";
  let coeursNoirs = "";
  let croixNoir = "";
  let croixMiel = "";
  let eclats = "";
  let craquelures = "";
  let piqures = "";
  let ebrechures = "";
  const R = PAS / 2 - 1.5;
  const x0 = CENTRE_DOS.cx - 5 * PAS;
  // Une étoile tombe juste sur la lune : le réseau part d'elle et couvre la carte.
  const y0 = CENTRE_DOS.cy - Math.ceil(CENTRE_DOS.cy / PAS) * PAS;
  for (let j = 0; y0 + (j - 1) * PAS < H; j++) {
    for (let i = 0; i <= 10; i++) {
      const cx = x0 + i * PAS;
      const cy = y0 + j * PAS;
      // Le disque de la lune et le bandeau du logotype se posent par-dessus : rien à tailler dessous.
      const dl = Math.hypot(cx - CENTRE_DOS.cx, cy - CENTRE_DOS.cy);
      if (dl < 330 * S) continue;
      // La niche de tadelakt du lion : nue.
      if (cy > NICHE_MAROC.y - PAS / 2 + 4 && cy < LOGOTYPE_DOS.cy) continue;
      etoiles[Math.floor(rnd() * VERTS.length)] += etoile(cx, cy, R, 8, R * CREUX8, 0, rnd, 3.2);
      const cle = (i + j) % 2 === 0;
      if (cle) coeursChaux += etoile(cx, cy, R * 0.42, 8, R * 0.42 * CREUX8, Math.PI / 8, rnd, 1.6);
      else coeursNoirs += etoile(cx, cy, R * 0.42, 8, R * 0.42 * CREUX8, Math.PI / 8, rnd, 1.6);
      // L'éclat : la glaçure accroche la lumière sur la branche du haut à gauche.
      const a = -Math.PI * 0.75;
      eclats += `M${f(cx + R * 0.32 * Math.cos(a - 0.12))} ${f(cy + R * 0.32 * Math.sin(a - 0.12))}L${f(cx + R * 0.86 * Math.cos(a))} ${f(cy + R * 0.86 * Math.sin(a))}`;
      // La craquelure : deux ou trois fêlures qui partent d'un point de la glaçure.
      if (rnd() < 0.3) {
        const [ox, oy] = [cx + (rnd() - 0.5) * R * 0.8, cy + (rnd() - 0.5) * R * 0.8];
        for (let k = 0, n = 2 + Math.floor(rnd() * 2); k < n; k++) {
          const b = rnd() * Math.PI * 2;
          const l1 = R * (0.25 + rnd() * 0.3);
          const b2 = b + (rnd() - 0.5) * 0.9;
          craquelures += `M${f(ox)} ${f(oy)}L${f(ox + l1 * Math.cos(b))} ${f(oy + l1 * Math.sin(b))}L${f(ox + l1 * Math.cos(b) + l1 * 0.7 * Math.cos(b2))} ${f(oy + l1 * Math.sin(b) + l1 * 0.7 * Math.sin(b2))}`;
        }
      }
      // Les piqûres de cuisson : une bulle crevée dans l'émail.
      if (rnd() < 0.35) piqures += `M${f(cx + (rnd() - 0.5) * R)} ${f(cy + (rnd() - 0.5) * R)}h0.1`;
      // Une pointe ébréchée au marteau : la terre cuite paraît.
      if (rnd() < 0.12) {
        const b = Math.floor(rnd() * 8) * (Math.PI / 4);
        const [px, py] = [cx + R * Math.cos(b), cy + R * Math.sin(b)];
        const [qx, qy] = [cx + R * 0.72 * Math.cos(b + 0.1), cy + R * 0.72 * Math.sin(b + 0.1)];
        const [rx, ry] = [cx + R * 0.8 * Math.cos(b - 0.12), cy + R * 0.8 * Math.sin(b - 0.12)];
        ebrechures += `M${f(px)} ${f(py)}L${f(qx)} ${f(qy)}L${f(rx)} ${f(ry)}Z`;
      }
      // Le cœur de la croix, au milieu de quatre étoiles.
      const kx = cx + PAS / 2;
      const ky = cy + PAS / 2;
      if (Math.hypot(kx - CENTRE_DOS.cx, ky - CENTRE_DOS.cy) < 330 * S) continue;
      if (ky > NICHE_MAROC.y - 4 && ky < LOGOTYPE_DOS.cy) continue;
      if (rnd() < 0.18) croixMiel += losange(kx, ky, PAS * 0.13, 0);
      else croixNoir += losange(kx, ky, PAS * 0.13, 0);
    }
  }
  return { etoiles, coeursChaux, coeursNoirs, croixNoir, croixMiel, eclats, craquelures, piqures, ebrechures };
}

/* ---------------------------- La rosace de cèdre --------------------------- */

interface Rosace {
  contour: string;
  /** Les seize pièces en losange (les « pétales »), et les triangles qui les joignent au disque. */
  petales: string;
  triangles: string;
  /** Les filets de bois en relief qui cernent chaque pièce. */
  filets: string;
}

/**
 * La rosace de cèdre à seize pointes, comme au cœur d'un plafond : autour du
 * disque, seize pièces en losange et les triangles qui les joignent, chacune
 * cernée d'un filet de bois en relief ; les pointes tombent entre les étoiles.
 */
function rosace(): Rosace {
  return memo("rosace", () => {
    const { cx, cy } = CENTRE_DOS;
    const n = 16;
    const h = Math.PI / n;
    const r0 = ROSACE_DOS.r0 * S;
    const rm = ROSACE_DOS.rm * S;
    const r2 = ROSACE_DOS.r2 * S;
    const P = (r: number, a: number) => `${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`;
    let contour = "";
    let petales = "";
    let triangles = "";
    for (let k = 0; k < n; k++) {
      // Aucune pointe droit vers le bas : le bandeau du logotype reste libre.
      const a = -Math.PI / 2 + h + k * 2 * h;
      contour += `${k === 0 ? "M" : "L"}${P(r2, a)}L${P(rm, a + h)}`;
      petales += `M${P(r0, a)}L${P(rm, a + h)}L${P(r2, a)}L${P(rm, a - h)}Z`;
      triangles += `M${P(r0, a)}L${P(rm, a + h)}L${P(r0, a + 2 * h)}Z`;
    }
    contour += "Z";
    return { contour, petales, triangles, filets: petales + triangles };
  });
}

/* --------------------------------- La face --------------------------------- */

interface Face {
  anneau: string;
  chaineEtoiles: string;
  chaineLosanges: string;
  joints: string;
  gravure: string;
}

/** La frise du portrait : de 8 (le bord de la carte) à 41 (le portrait), jusqu'à 1016 (la bande du bas). */
const FRISE = { ext: 8, int: PORTRAIT.x, bas: BANDE - 8 };

function face(): Face {
  return memo("face", () => {
    const { ext, bas } = FRISE;
    const anneau = rectArrondi(ext, ext, W - 2 * ext, bas - ext, 92 - ext) + rectArrondi(PORTRAIT.x - 2, PORTRAIT.y - 2, PORTRAIT.c + 4, PORTRAIT.c + 4, 53);
    // Les tesselles, sur la ligne médiane de la frise : étoiles de chaux, losanges noirs, sur l'émail vert.
    const m = (ext + PORTRAIT.x) / 2;
    const pts = surLePourtour(m, m, W - 2 * m, bas - (bas - (PORTRAIT.y + PORTRAIT.c)) / 2 - m, 51 + (PORTRAIT.x - m), 33);
    let chaineEtoiles = "";
    let chaineLosanges = "";
    pts.forEach(([x, y], i) => {
      if (i % 2 === 0) chaineEtoiles += etoile(x, y, 11.5, 8, 11.5 * CREUX8, 0);
      else chaineLosanges += losange(x, y, 6.2, 0);
    });
    // Les joints : la frise est bordée de mortier des deux côtés.
    const joints = rectArrondi(ext + 3, ext + 3, W - 2 * ext - 6, bas - ext - 6, 92 - ext - 3);
    // Le réseau gravé sous le portrait : étoiles et croix, au trait.
    let gravure = "";
    const p = 96;
    const R = p / 2;
    for (let y = BANDE + 8; y < H + p; y += p) {
      for (let x = W / 2 - 6 * p; x <= W + p; x += p) {
        gravure += etoile(x, y, R, 8, R * CREUX8, 0);
        gravure += etoile(x, y, R * 0.42, 8, R * 0.42 * CREUX8, Math.PI / 8);
      }
    }
    return { anneau, chaineEtoiles, chaineLosanges, joints, gravure };
  });
}

/** L'usure de la frise (la graine) : la glaçure craquelée, ses piqûres, dans l'émail vert seulement. */
function usureFrise(graine: number): { craquelures: string; piqures: string } {
  return memo(`frise-${graine}`, () => {
    const rnd = alea(graine ^ 0x6672);
    let craquelures = "";
    let piqures = "";
    // Un point au hasard dans la frise : un des quatre côtés, entre le bord (8) et le portrait (41).
    const point = (): [number, number] => {
      const c = Math.floor(rnd() * 4);
      const t = 60 + rnd() * (c % 2 ? BANDE - 120 : W - 120);
      const p = 10 + rnd() * 29;
      return c === 0 ? [t, p] : c === 1 ? [W - p, t] : c === 2 ? [t, BANDE - 8 - p * 0.95] : [p, t];
    };
    for (let i = 0; i < 70; i++) {
      const [x, y] = point();
      let [px, py] = [x, y];
      let a = rnd() * Math.PI * 2;
      craquelures += `M${f(px)} ${f(py)}`;
      for (let k = 0; k < 3; k++) {
        a += (rnd() - 0.5) * 1.4;
        [px, py] = [px + 5 * Math.cos(a), py + 5 * Math.sin(a)];
        craquelures += `L${f(px)} ${f(py)}`;
      }
    }
    for (let i = 0; i < 90; i++) {
      const [x, y] = point();
      piqures += `M${f(x)} ${f(y)}h.1`;
    }
    return { craquelures, piqures };
  });
}

/** Le portrait sans photo : une grande rosace à seize pointes, gravée dans la chaux, à peine. */
function rosacePortrait(): string {
  return memo("portrait", () => {
    const c = PORTRAIT.x + PORTRAIT.c / 2;
    return etoile(c, c, 360, 16, 318, -Math.PI / 2) + etoile(c, c, 250, 8, 250 * CREUX8, Math.PI / 8) + etoile(c, c, 170, 8, 170 * CREUX8, 0);
  });
}

/** Les passes du galet sur le tadelakt : des arcs courts, couchés, qui se recouvrent (la graine). */
function polissage(graine: number, y0: number, y1: number): string {
  return memo(`pol-${graine}-${y0}`, () => {
    const rnd = alea(graine ^ 0x7a1d);
    let d = "";
    for (let y = y0; y < y1; y += 9) {
      for (let x = 50 + rnd() * 60; x < W - 60; x += 70 + rnd() * 90) {
        if (rnd() < 0.45) continue;
        const l = 26 + rnd() * 50;
        const b = (rnd() - 0.5) * 7;
        d += `M${f(x)} ${f(y + rnd() * 6)}q${f(l / 2)} ${f(b)} ${f(l)} ${f(rnd() * 3 - 1.5)}`;
      }
    }
    return d;
  });
}

/* --------------------------------- Le motif -------------------------------- */

function Zellige({ cote, m, graine, id }: PropsMotifNation) {
  if (cote === "face") {
    const fc = face();
    const us = usureFrise(graine);
    return (
      <>
        <defs>
          <clipPath id={`zl-b-${id}`}>
            <rect x={0} y={BANDE} width={W} height={H - BANDE} />
          </clipPath>
          <clipPath id={`zl-a-${id}`}>
            <path d={fc.anneau} clipRule="evenodd" />
          </clipPath>
          <linearGradient id={`zl-f-${id}`} x1="0" y1="0" x2="1" y2="0.6">
            <stop offset="0" stopColor="#fff" stopOpacity={0.22} />
            <stop offset="0.5" stopColor="#fff" stopOpacity={0} />
            <stop offset="1" stopColor="#000" stopOpacity={0.18} />
          </linearGradient>
        </defs>
        {/* Sous le portrait : le réseau gravé dans la chaux, son creux puis sa lèvre de lumière. */}
        <g clipPath={`url(#zl-b-${id})`} fill="none" strokeLinejoin="round">
          <path d={fc.gravure} stroke={m.clair} strokeWidth={2.4} transform="translate(1.6 2)" />
          <path d={fc.gravure} stroke={m.fonce} strokeWidth={1.6} />
        </g>
        {/* Le portrait vide : la rosace, plus calme encore. */}
        <path d={rosacePortrait()} fill="none" stroke={m.fonce} strokeWidth={1.4} opacity={0.55} />
        {/* La frise du portrait : l'émail vert, ses étoiles de chaux et ses losanges noirs, le mortier. */}
        <path d={fc.anneau} fill={VERTS[1]} fillRule="evenodd" />
        <path d={fc.anneau} fill={`url(#zl-f-${id})`} fillRule="evenodd" />
        <g clipPath={`url(#zl-a-${id})`}>
          <path d={us.craquelures} fill="none" stroke="#0b1510" strokeOpacity={0.35} strokeWidth={0.8} strokeLinejoin="round" />
          <path d={us.piqures} stroke={CHAUX_EMAIL} strokeOpacity={0.6} strokeWidth={1.8} strokeLinecap="round" />
        </g>
        <path d={fc.joints} fill="none" stroke={JOINT} strokeWidth={2} opacity={0.75} />
        <g strokeLinejoin="round" stroke={JOINT} strokeWidth={1.8}>
          <path d={fc.chaineLosanges} fill={NOIR} />
          <path d={fc.chaineEtoiles} fill={CHAUX_EMAIL} />
        </g>
        {/* La bande du bas : un double filet d'émail vert et noir suit le bord. */}
        <path
          d={`M10 ${BANDE}V${H - 92}A82 82 0 0 0 92 ${H - 10}H${W - 92}A82 82 0 0 0 ${W - 10} ${H - 92}V${BANDE}`}
          fill="none"
          stroke={VERTS[1]}
          strokeWidth={5}
        />
        <path
          d={`M17 ${BANDE}V${H - 92}A75 75 0 0 0 92 ${H - 17}H${W - 92}A75 75 0 0 0 ${W - 17} ${H - 92}V${BANDE}`}
          fill="none"
          stroke={NOIR}
          strokeWidth={1.6}
          opacity={0.7}
        />
      </>
    );
  }

  const p = panneau(graine);
  const ro = rosace();
  const { cx, cy } = CENTRE_DOS;
  const bandeau = { y: LOGOTYPE_DOS.cy - 66, h: 134 };
  return (
    <>
      <defs>
        <clipPath id={`zl-p-${id}`}>
          <path d={rectArrondi(30, 30, W - 60, H - 60, 62)} />
        </clipPath>
        <radialGradient id={`zl-c-${id}`} cx="0.42" cy="0.36" r="0.75">
          <stop offset="0" stopColor="#f6f2ea" />
          <stop offset="0.7" stopColor={CHAUX} />
          <stop offset="1" stopColor="#ddd5c6" />
        </radialGradient>
        <linearGradient id={`zl-b1-${id}`} gradientUnits="userSpaceOnUse" x1={cx - ROSACE_DOS.r2 * S} y1={cy - ROSACE_DOS.r2 * S} x2={cx + ROSACE_DOS.r2 * S} y2={cy + ROSACE_DOS.r2 * S}>
          <stop offset="0" stopColor="#8a6440" />
          <stop offset="0.55" stopColor="#5e412a" />
          <stop offset="1" stopColor="#3d2a1b" />
        </linearGradient>
        <linearGradient id={`zl-b2-${id}`} gradientUnits="userSpaceOnUse" x1={cx - ROSACE_DOS.r2 * S} y1={cy - ROSACE_DOS.r2 * S} x2={cx + ROSACE_DOS.r2 * S} y2={cy + ROSACE_DOS.r2 * S}>
          <stop offset="0" stopColor="#6b4a2f" />
          <stop offset="1" stopColor="#2e2016" />
        </linearGradient>
        <linearGradient id={`zl-l-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.16} />
          <stop offset="0.45" stopColor="#fff" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.12} />
        </linearGradient>
      </defs>
      {/* Le panneau : le mortier (les croix sont d'émail blanc), puis les tesselles. */}
      <g clipPath={`url(#zl-p-${id})`}>
        <rect width={W} height={H} fill={JOINT} />
        <rect width={W} height={H} fill={CHAUX_EMAIL} opacity={0.82} />
        <g strokeLinejoin="round" stroke={JOINT} strokeWidth={3}>
          {p.etoiles.map((d, i) => (
            <path key={i} d={d} fill={VERTS[i]} />
          ))}
          <path d={p.coeursNoirs} fill={NOIR} strokeWidth={2.2} />
          <path d={p.coeursChaux} fill={CHAUX_EMAIL} strokeWidth={2.2} />
          <path d={p.croixNoir} fill={NOIR} strokeWidth={2.2} />
          <path d={p.croixMiel} fill={MIEL} strokeWidth={2.2} />
        </g>
        <path d={p.eclats} stroke="#fff" strokeOpacity={0.32} strokeWidth={3.2} strokeLinecap="round" fill="none" />
        <path d={p.craquelures} stroke="#0b1510" strokeOpacity={0.32} strokeWidth={0.9} fill="none" strokeLinejoin="round" />
        <path d={p.piqures} stroke={CHAUX_EMAIL} strokeOpacity={0.75} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        <path d={p.ebrechures} fill="#a77a57" stroke={JOINT} strokeWidth={0.8} />
        <rect width={W} height={H} fill={`url(#zl-l-${id})`} />
      </g>
      {/* Le cadre du panneau : un filet noir, un filet de chaux, comme la frise qui borde un lambris. */}
      <path d={rectArrondi(30, 30, W - 60, H - 60, 62)} fill="none" stroke={NOIR} strokeWidth={10} />
      <path d={rectArrondi(38, 38, W - 76, H - 76, 54)} fill="none" stroke={CHAUX_EMAIL} strokeWidth={3} />

      {/* La niche de tadelakt du lion, jusqu'au logotype : la chaux polie au galet, ses passes, bordée en haut de deux filets. */}
      <rect x={38} y={NICHE_MAROC.y} width={W - 76} height={bandeau.y - NICHE_MAROC.y} fill={`url(#zl-c-${id})`} />
      <path d={polissage(graine, NICHE_MAROC.y + 14, bandeau.y + bandeau.h - 10)} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={1.4} strokeLinecap="round" />
      <path d={polissage(graine ^ 0x55, NICHE_MAROC.y + 14, bandeau.y + bandeau.h - 10)} fill="none" stroke="#b9ae9b" strokeOpacity={0.28} strokeWidth={1.1} strokeLinecap="round" />
      <path d={`M38 ${NICHE_MAROC.y}H${W - 38}`} stroke={NOIR} strokeWidth={6} />
      <path d={`M38 ${NICHE_MAROC.y + 9}H${W - 38}`} stroke={VERTS[1]} strokeWidth={2.4} />
      {/* Le bandeau de tadelakt du logotype, bordé de deux filets. */}
      <rect x={38} y={bandeau.y} width={W - 76} height={bandeau.h} fill={`url(#zl-c-${id})`} />
      <path d={`M38 ${bandeau.y}H${W - 38}M38 ${bandeau.y + bandeau.h}H${W - 38}`} stroke={NOIR} strokeWidth={6} />
      <path d={`M38 ${bandeau.y + 9}H${W - 38}M38 ${bandeau.y + bandeau.h - 9}H${W - 38}`} stroke={VERTS[1]} strokeWidth={2.4} />

      {/* La rosace de cèdre : son ombre portée, les pièces, puis les filets en relief (l'ombre, le bois, l'arête de lumière). */}
      <path d={ro.contour} fill={CEDRE.ombre} transform="translate(6 9)" opacity={0.3} />
      <path d={ro.petales} fill={`url(#zl-b1-${id})`} />
      <path d={ro.triangles} fill={`url(#zl-b2-${id})`} />
      <g fill="none" strokeLinejoin="round">
        <path d={ro.filets} stroke={CEDRE.ombre} strokeWidth={10} />
        <path d={ro.filets} stroke={CEDRE.clair} strokeWidth={6} />
        <path d={ro.filets} stroke="#d3b18a" strokeWidth={1.4} transform="translate(-1.4 -1.4)" opacity={0.8} />
      </g>
      <circle cx={cx} cy={cy} r={ROSACE_DOS.r0 * S} fill={`url(#zl-c-${id})`} />
      <circle cx={cx} cy={cy} r={ROSACE_DOS.r0 * S} fill="none" stroke={CEDRE.ombre} strokeWidth={5} />
      <circle cx={cx} cy={cy} r={(ROSACE_DOS.r0 - 9) * S} fill="none" stroke={VERTS[1]} strokeWidth={2} opacity={0.6} />
    </>
  );
}

const maroc: SkinNation = {
  nation: "ma",
  nom: "Zellige",
  quoi: "Les tesselles d'émail taillées à la main dans les ateliers de Fès, le tadelakt poli à la chaux, la rosace d'un plafond de cèdre.",
  sources: [
    { titre: "UNESCO, Médina de Fès (patrimoine mondial, 1981)", url: "https://whc.unesco.org/fr/list/170" },
    { titre: "Zellij : tesselles taillées une à une, posées face contre terre puis prises au mortier", url: "https://en.wikipedia.org/wiki/Zellij" },
    { titre: "APMEP, Le Petit Vert n° 139 (2019) : l'étoile à huit branches et les pièces du zellige", url: "https://bibnum.publimath.fr/ALO/ALO19020.pdf" },
    { titre: "Futura Sciences : le tadelakt, enduit de chaux de Marrakech poli au galet et au savon noir", url: "https://www.futura-sciences.com/maison/definitions/maison-tadelakt-8533/" },
    { titre: "Médersa Bou Inania de Fès (1350-1355) : vestibule au plafond de cèdre sculpté", url: "https://en.wikipedia.org/wiki/Bou_Inania_Madrasa_(Fez)" },
  ],
  dessine: true,
  matiere: {
    titre: "zellige",
    encre: "24,26,25",
    sombre: false,
    // Le tadelakt : la chaux chaude, ses nuages de polissage au galet, le satin.
    papier: [
      "radial-gradient(70% 38% at 22% 12%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 70%)",
      "radial-gradient(55% 30% at 78% 46%, rgba(214,204,186,0.45) 0%, rgba(214,204,186,0) 70%)",
      "radial-gradient(60% 34% at 30% 78%, rgba(255,252,246,0.55) 0%, rgba(255,252,246,0) 70%)",
      "radial-gradient(40% 22% at 84% 88%, rgba(206,196,178,0.4) 0%, rgba(206,196,178,0) 70%)",
      "linear-gradient(118deg, rgba(255,255,255,0) 34%, rgba(255,255,255,0.32) 46%, rgba(255,255,255,0) 58%)",
      "linear-gradient(165deg, #f3eee5 0%, #ebe4d7 44%, #e2d9c9 78%, #d8cebc 100%)",
    ].join(", "),
    motif: { clair: "rgba(255,255,255,0.7)", fonce: "rgba(70,62,48,0.2)" },
    fond: "rgba(240,234,223,0.9)",
    lueur: "rgba(255,255,255,0.9)",
    rayures: 0.012,
    micro: 0.04,
    reflet: 0.42,
    coins: 0.55,
    etiquette: { fond: "transparent", bord: "rgba(24,26,25,0.5)", texte: "rgba(24,26,25,0.78)" },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,255,255,0.95)", ombre: "rgba(60,52,40,0.24)" },
    puce: "linear-gradient(135deg, #ffffff, #c9c3b6 45%, #f1ede5 70%, #a39d90)",
    // La carte photo : un serti de tesselles, vertes et noires dans leur mortier.
    cadre: [
      "linear-gradient(118deg, rgba(255,255,255,0) 36%, rgba(255,255,255,0.28) 46%, rgba(255,255,255,0) 56%)",
      "conic-gradient(from 45deg at 50% 50%, #2c5847 0 25%, #17191a 0 50%, #2c5847 0 75%, #17191a 0) 0 0 / 9px 9px",
      "#cfc8b9",
    ].join(", "),
    voile: "rgba(18,20,19,0.55)",
    onglet: { fond: "#ece6da", encre: "#17191a" },
    vive: "#2c5847",
    // La 3D : la tranche émaillée verte, presque sans grain ; un reflet de glaçure, à peine vert.
    dos: { micro: 0.018 },
    tranche: { couleur: "#24493a", metal: 0.12, rugosite: 0.22 },
    holo: { force: 0.5, teinte: [0.9, 1, 0.94] },
  },
  Motif: Zellige,
};

export default maroc;
