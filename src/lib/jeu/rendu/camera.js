// La caméra de la télé (bola-app#26, lot 4), sortie de match.js pour être mesurée par le banc (tools/jeu-banc.ts) :
// sans three ni DOM, des nombres seulement, dans le repère du jeu (x = largeur, z = longueur, y = hauteur ; les Noirs
// attaquent vers -z, la droite de l'écran).
//
// Ce qui ne change pas depuis bola-app#23 : en hauteur dans la tribune, le long du terrain ; une frappe fait reculer le
// cadre pour tenir la balle ET le but visé (et 0,6 s après la ligne) ; au téléphone, le panneau proche reste au-dessus
// de la zone du pouce quand la balle s'en approche ; la célébration est filmée en pied.
//
// Ce qui change (lot 4, « une caméra de télé qui anticipe, rien qui tremble ») :
//   - le cadre vise où VA la balle : balle + vitesse × 0,45 s (avance bornée à 4,5 m en longueur, 2 m en largeur),
//     comme un cadreur qui suit le jeu au lieu de courir derrière ;
//   - ce foyer est tenu par un ressort critique (second ordre, sans dépassement) : une balle déviée, un rebond, une
//     passe qui part ne donnent plus de cassure de vitesse au cadre (le filtre du premier ordre d'avant en donnait une à
//     chaque changement brusque de cible) ; aucun bruit, aucune secousse, nulle part ;
//   - un duel près d'un but (porteur pressé à moins de 2 m, à moins de 8 m de la ligne) resserre le cadre de 8 %, par le
//     même genre de ressort.
//   - la place et le regard de la caméra suivent eux aussi par des ressorts critiques (avant : un filtre du premier
//     ordre, dont la vitesse cassait à chaque changement de cible) ; la vitesse de la balle qui sert à viser est
//     lissée sur 0,2 s ; le retard propre au ressort (2v/ω) est rattrapé dans la visée.
// Le reste (place de la caméra, recul pour le but, panneau du téléphone) est la même géométrie que bola-app#23.

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Un ressort critique sur une valeur (x, v) vers la cible c, de pulsation w, pas dt : exact, stable, sans dépassement. */
export function ressortCritique(r, k, c, w, dt) {
  const x = r[k], v = r[k + 'v'] ?? 0;
  const e = Math.exp(-w * dt), d = x - c;
  const j = (v + w * d) * dt;
  r[k] = c + (d + j) * e;
  r[k + 'v'] = (v - w * j) * e;
}

export const CAMERA_TELE = {
  avance: 0.45,       // s : où sera la balle (net, une fois le retard des ressorts rattrapé)
  avanceZ: 6, avanceX: 2.5, // m : la visée devant la balle au plus
  w: 3.2, wTir: 6.5,  // pulsations du ressort du foyer (s⁻¹)
  wCadre: 4.5, wCadreTir: 6, wFace: 3, // pulsations des ressorts de la place et du regard de la caméra
  lisse: 0.2,         // s : la vitesse de la balle est lissée avant de servir à viser (un rebond ne fait pas sursauter)
  serre: 0.92,        // le cadre au duel près d'un but
};

export function creerCameraTele() {
  return {
    pos: { x: 0, y: 8.5, z: 12 }, regard: { x: 0, y: 0, z: 0 }, dernierBut: null,
    f: { x: 0, xv: 0, z: 0, zv: 0 }, // le foyer (sol) et sa vitesse
    vb: { x: 0, z: 0 },               // la vitesse de la balle, lissée
    recul: 0, zoom: { s: 1, sv: 0 },
    _v: { x: 0, y: 0, z: 0 }, _r: { x: 0, y: 0, z: 0 },
  };
}

/** Le foyer posé tout de suite (un scénario, un nouveau match : pas de travelling depuis l'ancienne place). */
export function poserFoyer(c, x, z) { c.f.x = x; c.f.z = z; c.f.xv = 0; c.f.zv = 0; c.vb.x = 0; c.vb.z = 0; }

/**
 * Une image. E : { phase, phaseT, butPause, balle {x,y,z,vx,vz}, zBut (le but visé par une frappe, ou null),
 * large (paysage), fov (degrés, vertical), aspect, celebre {x,z,cap} (le joueur filmé en pied, ou null : plan de la télé),
 * intro (plan de l'intro et de l'attente), duel (un porteur pressé près d'un but) }.
 * Écrit c.pos et c.regard (repère du jeu).
 */
export function majCameraTele(c, E, dt, P = CAMERA_TELE) {
  let voulu = c._v, regard = c._r;
  const face = !!E.celebre;
  if (face) {
    const I = E.celebre;
    const ang = I.cap + (E.intro ? 0.35 : -0.5);
    const d = E.intro ? 3.4 : 4.6; // la célébration : en pied
    voulu.x = I.x + Math.sin(ang) * d; voulu.y = 1.7; voulu.z = I.z + Math.cos(ang) * d;
    regard.x = I.x; regard.y = 1.45; regard.z = I.z;
  } else {
    const b = E.balle, large = E.large, zBut = E.zBut;
    // la cible du foyer : la balle et le but visé (une frappe), sinon là où va la balle
    let cx, cz;
    const kv = 1 - Math.exp(-dt / P.lisse);
    c.vb.x += (b.vx - c.vb.x) * kv; c.vb.z += (b.vz - c.vb.z) * kv;
    const w = zBut != null ? P.wTir : P.w;
    if (zBut != null) { cx = b.x + c.vb.x * 0.2; cz = b.z * 0.4 + zBut * 0.6; }
    else {
      // un ressort critique suivant une cible qui file à v reste 2v/ω derrière : on vise d'autant plus loin, pour que
      // le foyer soit, net, `avance` secondes devant la balle
      const t = P.avance + 2 / w;
      cx = b.x + clamp(c.vb.x * t, -P.avanceX, P.avanceX);
      cz = b.z + clamp(c.vb.z * t, -P.avanceZ, P.avanceZ);
    }
    ressortCritique(c.f, 'x', cx, w, dt); ressortCritique(c.f, 'z', cz, w, dt);
    // le recul d'une frappe (0..1, filtré) : il élargit les bornes du foyer et éloigne la caméra, sans à-coup quand la
    // frappe finit (arrêt, contre) : tout suit c.recul, jamais l'interrupteur « frappe en cours »
    c.recul += ((zBut != null ? 1 : 0) - c.recul) * (1 - Math.exp(-dt * 2.5));
    if (zBut != null) c.dernierBut = zBut;
    const lim = large ? 6 + 2 * c.recul : 11 + 2.5 * c.recul;
    const fx = clamp(c.f.x, -6, 6), fz = clamp(c.f.z, -lim, lim);
    voulu.x = large ? 21 : 15.5; voulu.y = large ? 12.5 : 11; voulu.z = fz;
    let rx = fx * 0.3 + (large ? -1 : 0.6);
    if (!large) {
      // au téléphone, le panneau proche (x = +10) reste au-dessus de 72 % de la hauteur de l'écran (au-dessus du
      // pouce) quand la balle s'en approche : le foyer glisse vers lui, au même ressort (aucune secousse)
      const H = voulu.y, f = (E.fov * Math.PI) / 360;
      const ap = Math.atan2(H, voulu.x - 10), a0 = ap - Math.atan(0.44 * Math.tan(f));
      const rxMin = voulu.x - H / Math.tan(a0);
      const k = smooth(c.f.x, 2, 7.5);
      rx = Math.max(rx, rx + (rxMin - rx) * k);
    }
    regard.x = rx; regard.y = 0; regard.z = fz;
    // le recul : ce qu'il faut pour tenir la balle et le but dans la largeur du cadre
    let k = 1;
    if (c.recul > 1e-3 && c.dernierBut != null) {
      const D = Math.hypot(voulu.x - regard.x, voulu.y - regard.y);
      const demi = D * Math.tan(Math.atan(Math.tan((E.fov * Math.PI) / 360) * E.aspect));
      const besoin = Math.abs(b.z - c.dernierBut) / 2 + 1.6;
      k = 1 + (clamp(besoin / Math.max(1, demi), 1, 1.7) - 1) * c.recul;
    }
    // le duel près d'un but : un peu plus serré (le recul d'une frappe l'emporte)
    ressortCritique(c.zoom, 's', E.duel && zBut == null ? P.serre : 1, 2.2, dt);
    k *= c.zoom.s;
    voulu.x = regard.x + (voulu.x - regard.x) * k; voulu.y = regard.y + (voulu.y - regard.y) * k;
  }
  // la place et le regard de la caméra : des ressorts critiques aussi (une frappe : le cadre rejoint le but plus vite) ;
  // la vitesse du cadre ne casse jamais, même quand la cible change d'un coup (frappe, but, célébration)
  const w = face ? P.wFace : c.recul > 0.05 ? P.wCadreTir : P.wCadre;
  for (const k of ['x', 'y', 'z']) { ressortCritique(c.pos, k, voulu[k], w, dt); ressortCritique(c.regard, k, regard[k], w * 1.15, dt); }
  return c;
}

/** Un porteur pressé (adversaire à moins de 2 m) à moins de 8 m d'une ligne de but : le cadre se resserre. */
export function duelPresDuBut(M, porteur, ligne = 15) {
  if (!porteur) return false;
  if (ligne - Math.abs(porteur.p.z) > 8) return false;
  for (const o of M.joueurs) if (o.e !== porteur.e && !o.absent && Math.hypot(o.p.x - porteur.p.x, o.p.z - porteur.p.z) < 2) return true;
  return false;
}
