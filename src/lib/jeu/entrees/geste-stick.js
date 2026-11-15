// Le lecteur du stick droit des gestes techniques (bola-app#26, lot 3) : pur, sans DOM, le même pour la manette
// (entrees/commande.js), le clavier (I J K L, entrees/clavier.js, qui passe par la commande) et le pouce (second doigt,
// pouce.js et match.js). Le banc (tools/jeu-banc-manettes.ts) le nourrit d'échantillons inventés.
//
// Les motifs sont lus RELATIVEMENT AU CAP DU JOUEUR (et non à l'écran), comme dans les jeux de foot de rue console :
// « avant » est là où il regarde, « gauche » sa gauche. Le cap retenu est celui du début du geste (le joueur qui vire
// pendant le geste ne change pas le motif). Les motifs :
//   · coup sec  : poussé au-delà de 55 % puis relâché sous 30 % en 0,35 s au plus, sans tourner de plus de 60° ;
//                 sa direction (avant, arrière, gauche, droite) est la dernière vue avant le relâché ;
//   · maintenu  : poussé plus de 0,35 s sans tourner de plus de 40° (part dès les 0,35 s, sans attendre le relâché) ;
//   · quart     : tourné de 60 à 150° puis relâché en 0,7 s au plus (de : la direction de départ, vers : la dernière) ;
//   · demi      : tourné de 150° ou plus (part dès les 150°, sans attendre le relâché).
// Puis gesteDe traduit un motif en geste, selon la course et les modificateurs (LT / L2 : gestes fins ; R3 tenu ;
// un défenseur juste devant) — le tableau est dans entrees/touches.js, et le geste lui-même dans sim/monde.js.

const DEG = Math.PI / 180;
export const STICK = {
  pousse: 0.55, // au-delà : le stick est poussé
  relache: 0.3, // en deçà : il est revenu
  sec: 0.35, // s : la fenêtre du coup sec, et le seuil du maintenu
  quartMax: 0.7, // s
  quart: 60 * DEG,
  demi: 150 * DEG,
  tenuMax: 40 * DEG,
  arret: 1.2, // m/s : sous cette allure, un coup sec de côté est une feinte de corps (à l'arrêt)
};

export function creerLecteur() {
  return { actif: false, t0: 0, a: 0, balayage: 0, fait: false, cap0: 0, g0x: 0, g0z: 0, gx: 0, gz: 0 };
}

export function oublierLecteur(L) {
  L.actif = false; L.fait = false; L.balayage = 0;
}

/** La direction (gx, gz, repère du jeu) relativement au cap : 'avant' | 'arriere' | 'gauche' | 'droite', et ses composantes. */
export function relatif(cap, gx, gz) {
  const fx = Math.sin(cap), fz = Math.cos(cap);
  const av = fx * gx + fz * gz, ga = fz * gx - fx * gz; // ga > 0 : à gauche du cap
  const dir = Math.abs(av) >= Math.abs(ga) ? (av > 0 ? 'avant' : 'arriere') : ga > 0 ? 'gauche' : 'droite';
  return { dir, av, ga };
}

/**
 * Une lecture du stick : (gx, gz) sa direction dans le repère du jeu (unitaire), amp son amplitude (0 à 1), t l'heure
 * (s), cap celui du joueur. Renvoie un motif { type, dir | de/vers, sens, gx, gz, ga } au moment où il est reconnu,
 * sinon null.
 */
export function lireStick(L, gx, gz, amp, t, cap) {
  if (amp > STICK.pousse) {
    const a = Math.atan2(gx, gz);
    if (!L.actif) {
      L.actif = true; L.t0 = t; L.a = a; L.balayage = 0; L.fait = false; L.cap0 = cap;
      L.g0x = gx; L.g0z = gz; L.gx = gx; L.gz = gz;
      return null;
    }
    let d = a - L.a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    L.balayage += d; L.a = a; L.gx = gx; L.gz = gz;
    if (L.fait) return null;
    if (Math.abs(L.balayage) >= STICK.demi) {
      L.fait = true;
      return { type: 'demi', de: relatif(L.cap0, L.g0x, L.g0z).dir, vers: relatif(L.cap0, gx, gz).dir, sens: Math.sign(L.balayage), gx, gz, ga: 0 };
    }
    if (Math.abs(L.balayage) < STICK.tenuMax && t - L.t0 > STICK.sec) {
      L.fait = true;
      const r = relatif(L.cap0, gx, gz);
      return { type: 'tenu', dir: r.dir, sens: 0, gx, gz, ga: r.ga };
    }
    return null;
  }
  if (amp < STICK.relache && L.actif) {
    L.actif = false;
    if (L.fait) { L.fait = false; return null; }
    const dt = t - L.t0, bal = Math.abs(L.balayage);
    if (bal >= STICK.quart && dt <= STICK.quartMax) {
      return { type: 'quart', de: relatif(L.cap0, L.g0x, L.g0z).dir, vers: relatif(L.cap0, L.gx, L.gz).dir, sens: Math.sign(L.balayage), gx: L.gx, gz: L.gz, ga: 0 };
    }
    if (dt <= STICK.sec && bal < STICK.quart) {
      const r = relatif(L.cap0, L.gx, L.gz);
      return { type: 'sec', dir: r.dir, sens: 0, gx: L.gx, gz: L.gz, ga: r.ga };
    }
  }
  return null;
}

/**
 * Le geste d'un motif (balle au pied). ctx : { s (m/s, allure du porteur), fin (LT / L2 tenu : gestes fins), r3 (R3
 * tenu), devant (un défenseur à moins de 1,2 m devant), proche (un défenseur à moins de 3 m devant) }.
 * Renvoie l'action de la simulation, ou null.
 */
export function gesteDe(mo, ctx) {
  if (!mo) return null;
  const { gx: dx, gz: dz } = mo;
  const cote = (d) => d === 'gauche' || d === 'droite';
  switch (mo.type) {
    case 'sec':
      if (cote(mo.dir)) return ctx.s < STICK.arret && !ctx.fin ? { type: 'feinte', dx, dz } : { type: 'crochet', dx, dz, court: !!ctx.fin };
      if (mo.dir === 'avant') {
        if (ctx.r3 || (ctx.fin && ctx.proche)) return { type: 'sombrero' };
        if (ctx.devant) return { type: 'petitPont' };
        return { type: 'pousser', dx, dz };
      }
      return { type: 'talonnade', cote: ctx.fin && Math.abs(mo.ga) > 0.25 ? Math.sign(mo.ga) : 0 };
    case 'tenu':
      return mo.dir === 'arriere' ? { type: 'tirerArriere', dx, dz } : null;
    case 'quart':
      if (mo.de === 'avant' && cote(mo.vers)) return { type: 'passement', dx, dz, double: !!ctx.fin };
      return { type: 'crochet', dx, dz, court: !!ctx.fin };
    case 'demi':
      return { type: 'roulette', dx, dz, inverse: !!ctx.fin };
    default:
      return null;
  }
}

/** Le contexte d'un geste pour le joueur j dans le monde M (défenseurs devant), avec les modificateurs. */
export function contexteGeste(M, j, fin = false, r3 = false) {
  const fx = Math.sin(j.cap), fz = Math.cos(j.cap);
  let devant = false, proche = false;
  for (const o of M.joueurs) {
    if (o.e === j.e || o.gardien || o.absent) continue;
    const rx = o.p.x - j.p.x, rz = o.p.z - j.p.z, d = Math.hypot(rx, rz);
    if (rx * fx + rz * fz < 0.3 * d) continue;
    if (d < 1.2) devant = true;
    if (d < 3) proche = true;
  }
  return { s: Math.hypot(j.v.x, j.v.z), fin, r3, devant, proche };
}

/** Zone morte radiale (0,18) remise à l'échelle, puis courbe s^1,4 : { x, y, amp } (amp de 0 à 1). */
export function zoneMorte(x, y, mort = 0.18) {
  const L = Math.hypot(x, y);
  if (!(L > mort)) return { x: 0, y: 0, amp: 0 };
  const s = Math.min(1, (L - mort) / (1 - mort - 0.05));
  const amp = Math.pow(s, 1.4);
  return { x: x / L, y: y / L, amp };
}

/**
 * Tout le chemin d'un stick droit d'écran (sx vers la droite, sy vers le haut, de -1 à 1) jusqu'au geste du joueur j :
 * zone morte 0,25, repère du jeu (versJeu), motif relatif à son cap, geste. Le même pour la manette, le clavier (par la
 * commande) et le second doigt du pouce : à séquence égale, geste égal. Renvoie l'action ou null.
 */
export function lireGesteStick(L, sx, sy, t, M, j, versJeu, fin = false, r3 = false) {
  const rs = zoneMorte(sx, sy, 0.25);
  const g = rs.amp > 0 ? versJeu(rs.x, rs.y) : { x: 0, z: 0 };
  const mo = lireStick(L, g.x, g.z, rs.amp, t, j.cap);
  return mo ? gesteDe(mo, contexteGeste(M, j, fin, r3)) : null;
}

/** Le stick d'un doigt (pouce, second doigt) : son déplacement en px depuis son point de pose, ramené à un stick. */
export function stickDoigt(dx, dy, rayon = 46) {
  const L = Math.hypot(dx, dy);
  if (L < 1e-6) return { x: 0, y: 0 };
  const a = Math.min(1, L / rayon);
  return { x: (dx / L) * a, y: (-dy / L) * a };
}
