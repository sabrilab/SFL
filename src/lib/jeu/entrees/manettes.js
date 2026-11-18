// Les manettes du jeu Bola (bola-app#23) : la Gamepad API, une ou deux manettes en local.
//
//   · Lecture : navigator.getGamepads() une fois par image (lire), avant les pas de simulation. Chaque manette a sa
//     place, retrouvée par son index et son id (ou par son id seul si elle revient sous un autre index : elle retrouve
//     son équipe), oubliée une minute après son débranchement ; celles en mapping « standard » sont lues telles
//     quelles, l'ancienne DualShock 4 (054c-05c4, 054c-09cc) et la Xbox 360 / One (pilote xpad) de Firefox sous Linux,
//     sans mapping, passent par une table de secours (leurs gâchettes ne sont lues qu'une fois vues au repos) ; les
//     autres sont « non reconnues » : l'écran Manettes les montre barrées, le jeu les ignore.
//   · Marque : 054c, PlayStation, DualSense, DualShock, « Wireless Controller » → PlayStation (✕ ○ □ △) ; 045e, Xbox,
//     XInput → Xbox (A B X Y) ; les autres prennent les icônes Xbox.
//   · Salon (l'écran Manettes, avant le match) : A / ✕ rejoint (la 1re chez les Noirs, la 2e chez les Blancs), stick
//     gauche ou croix pour changer de côté, B / ○ pour revenir au milieu, deux manettes du même côté : refusé (un petit
//     choc de l'icône, compteur « choc ») ; Menu / Options lance le match (surDemarrer) ; Vue / Share ouvre ou ferme
//     le schéma des touches, aux boutons de cette manette (surTouches, bola-app#26 lot 3).
//   · Repos (avant « Jouer », après la fin) : A / ✕ ou Menu / Options ouvre le salon (surSalon).
//   · Match : chaque manette rangée dans une équipe écrit l'intention de cette équipe (entrees/commande.js). Débranchée,
//     son équipe repasse à l'IA au pas suivant (la page lit equipes() à chaque image), sans pause ni plantage ;
//     rebranchée, A / ✕ la remet dans son équipe ; une manette qui arrive pendant le match entre avec A / ✕ dans
//     l'équipe que tient l'IA. Menu / Options : pause (surPause).
//   · Vibrations : vibrationActuator.playEffect('dual-rumble') (Chrome, Edge), sinon hapticActuators[0].pulse
//     (Firefox), sinon rien ; dans un try/catch, et seulement page visible.
//
// L'écran (src/app/jouer/manettes.tsx) s'abonne par abonner / instantane (useSyncExternalStore) : l'instantané ne
// change d'objet que lorsque quelque chose de visible change.
import { creerCommande, lireManette, intentionDe, oublier, BOUTONS as K } from './commande.js';

const RE_PS = /054c|playstation|dualsense|dualshock|wireless controller/i;
const RE_XBOX = /045e|xbox|xinput/i;
const RE_DS4_BRUT = /054c.*(05c4|09cc)|(05c4|09cc).*054c/i;
// la Xbox 360 / One sans mapping (pilote xpad de Linux, sous Firefox) : A B X Y LB RB Back Start Guide L3 R3 ; axes
// LX LY LT RX RY RT croixX croixY
const RE_XPAD = /045e|xbox|x-box|xinput|xpad/i;

/** La marque d'une manette d'après son id. */
export function marqueDe(id = '') {
  // (Xbox d'abord : « Xbox Wireless Controller » contient aussi « Wireless Controller »)
  if (RE_XBOX.test(id)) return 'xbox';
  if (RE_PS.test(id)) return 'playstation';
  return 'generique';
}

/**
 * Une gâchette lue sur un axe (−1 au repos, 1 enfoncée), seulement une fois qu'on l'a vue au repos : certains
 * navigateurs rendent 0 avant le premier appui, ce qui la ferait lire à moitié enfoncée (protéger et contenir tenus,
 * sprint à 46 %). vu : l'état de la manette (vu.repos[k] passe à vrai au premier −1).
 */
function gachetteAxe(x, vu, k) {
  if (x == null) return 0;
  if (!vu) return x <= -0.9 ? 0 : (x + 1) / 2;
  if (x <= -0.9) vu.repos[k] = true;
  return vu.repos[k] ? (x + 1) / 2 : 0;
}

/** L'état rangé dans l'ordre standard, ou null si la manette n'est pas reconnue. vu : { repos: [] } par manette. */
export function normaliser(g, out, vu = null) {
  const val = (x) => (x == null ? 0 : typeof x === 'number' ? x : x.value ?? (x.pressed ? 1 : 0));
  if (g.mapping === 'standard') {
    for (let i = 0; i < 17; i++) out.b[i] = val(g.buttons[i]);
    for (let i = 0; i < 4; i++) out.ax[i] = g.axes[i] ?? 0;
    return out;
  }
  if (RE_DS4_BRUT.test(g.id ?? '')) {
    // hid-sony sous Linux (Firefox) : ✕ ○ △ □ L1 R1 L2 R2 Share Options PS L3 R3 ; axes LX LY L2 RX RY R2 croixX croixY
    const bt = g.buttons, a = g.axes;
    const brut = [0, 1, 3, 2, 4, 5, -1, -1, 8, 9, 11, 12];
    for (let i = 0; i < 12; i++) out.b[i] = brut[i] >= 0 ? val(bt[brut[i]]) : 0;
    out.b[6] = Math.max(val(bt[6]), gachetteAxe(a[2], vu, 0));
    out.b[7] = Math.max(val(bt[7]), gachetteAxe(a[5], vu, 1));
    const hx = a[6] ?? 0, hy = a[7] ?? 0;
    out.b[12] = hy < -0.5 ? 1 : 0; out.b[13] = hy > 0.5 ? 1 : 0; out.b[14] = hx < -0.5 ? 1 : 0; out.b[15] = hx > 0.5 ? 1 : 0;
    out.b[16] = val(bt[10]);
    out.ax[0] = a[0] ?? 0; out.ax[1] = a[1] ?? 0; out.ax[2] = a[3] ?? 0; out.ax[3] = a[4] ?? 0;
    return out;
  }
  if (RE_XPAD.test(g.id ?? '') && (g.buttons?.length ?? 0) >= 11 && (g.axes?.length ?? 0) >= 6) {
    const bt = g.buttons, a = g.axes;
    // A B X Y LB RB (LT RT sur les axes) Back Start L3 R3 (croix sur les axes) Guide
    const brut = [0, 1, 2, 3, 4, 5, -1, -1, 6, 7, 9, 10];
    for (let i = 0; i < 12; i++) out.b[i] = brut[i] >= 0 ? val(bt[brut[i]]) : 0;
    out.b[6] = gachetteAxe(a[2], vu, 0);
    out.b[7] = gachetteAxe(a[5], vu, 1);
    const hx = a[6] ?? 0, hy = a[7] ?? 0;
    out.b[12] = hy < -0.5 ? 1 : 0; out.b[13] = hy > 0.5 ? 1 : 0; out.b[14] = hx < -0.5 ? 1 : 0; out.b[15] = hx > 0.5 ? 1 : 0;
    out.b[16] = val(bt[8]);
    out.ax[0] = a[0] ?? 0; out.ax[1] = a[1] ?? 0; out.ax[2] = a[3] ?? 0; out.ax[3] = a[4] ?? 0;
    return out;
  }
  return null;
}

/** Les effets de vibration (ms, fort, faible), comme dans la conception. */
export const EFFETS = {
  frappe: (p = 0.5) => ({ duree: 90 + 60 * p, fort: 0.5 * p, faible: 0.3 }),
  chute: () => ({ duree: 220, fort: 0.8, faible: 0.5 }),
  tacle: () => ({ duree: 90, fort: 0.35, faible: 0.6 }),
  epaule: () => ({ duree: 60, fort: 0.3, faible: 0.2 }),
  poteau: () => ({ duree: 140, fort: 0.4, faible: 0.8 }),
  surpuissance: () => ({ duree: 260, fort: 1, faible: 0.8 }),
  percee: () => ({ duree: 110, fort: 0.25, faible: 0.7 }),
  charge: () => ({ duree: 180, fort: 0.9, faible: 0.6 }),
  but: () => ({ duree: 120, fort: 0.7, faible: 0.7, puis: { pause: 80, duree: 260, fort: 0.7, faible: 0.7 } }),
};

export function creerManettes({ versJeu = (sx, sy) => ({ x: -sy, z: -sx }) } = {}) {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const places = []; // { cle, index, id, marque, reconnue, branchee, equipe, ancienne, cmd, etat, prec, gx, choc }
  let mode = 'repos';
  let version = 0, instant = null;
  const abonnes = new Set();
  const api = { surSalon: null, surDemarrer: null, surPause: null, surTouches: null, surPasser: null };

  const changer = () => { version++; instant = null; for (const f of abonnes) f(); };

  function lirePads() {
    try { return nav?.getGamepads ? Array.from(nav.getGamepads() ?? []) : []; } catch { return []; }
  }

  const minuteurs = new Set();
  function place(g, t) {
    let p = places.find((q) => q.index === g.index && q.id === g.id);
    // (rebranchée sous un autre index : on retrouve sa place, et son équipe d'avant)
    if (!p) p = places.find((q) => !q.branchee && q.id === g.id && !places.some((r) => r !== q && r.branchee && r.index === g.index && r.id === g.id));
    if (p && p.index !== g.index) { p.index = g.index; p.cle = `${g.index}:${g.id}`; changer(); }
    if (!p) {
      p = {
        cle: `${g.index}:${g.id}`, index: g.index, id: g.id, marque: marqueDe(g.id), reconnue: false, branchee: true,
        equipe: null, ancienne: null, cmd: creerCommande(),
        etat: { b: new Float64Array(17), ax: new Float64Array(4) }, prec: new Float64Array(17), vu: false, gx: 0, choc: 0,
        repos: { repos: [false, false] }, debrancheT: t,
      };
      places.push(p);
      changer();
    }
    return p;
  }

  const libre = (e, sauf) => !places.some((q) => q !== sauf && q.branchee && q.equipe === e);
  function poser(p, e) {
    if (p.equipe === e) return;
    if (e != null && !libre(e, p)) { p.choc++; changer(); return; }
    p.equipe = e; oublier(p.cmd); changer();
  }

  function salon(p, bas, gauche, droite) {
    if (bas(K.A) && p.equipe == null) { const e = libre(0, p) ? 0 : libre(1, p) ? 1 : null; if (e == null) { p.choc++; changer(); } else poser(p, e); }
    if (bas(K.B)) poser(p, null);
    if (gauche) { if (p.equipe === 1) poser(p, null); else if (p.equipe == null) poser(p, 0); else { p.choc++; changer(); } }
    if (droite) { if (p.equipe === 0) poser(p, null); else if (p.equipe == null) poser(p, 1); else { p.choc++; changer(); } }
    if (bas(K.MENU)) api.surDemarrer?.();
    if (bas(K.VUE)) api.surTouches?.(p.marque);
  }

  /** Une image : lit les manettes, tient le salon, nourrit les commandes. t en secondes, M le monde. */
  function lire(t, M) {
    const pads = lirePads();
    const vues = new Set();
    for (const g of pads) {
      if (!g || g.connected === false) continue;
      const p = place(g, t);
      vues.add(p);
      if (!p.branchee) { p.branchee = true; changer(); }
      const ok = !!normaliser(g, p.etat, p.repos);
      if (ok !== p.reconnue) { p.reconnue = ok; changer(); }
      if (!ok) continue;
      const b = p.etat.b;
      if (!p.vu) { p.prec.set(b); p.vu = true; }
      const bas = (i) => b[i] > 0.5 && p.prec[i] <= 0.5;
      // le stick gauche en crans (salon) : -1, 0, 1, avec hystérésis
      const lx = p.etat.ax[0];
      const gx = lx < -0.6 ? -1 : lx > 0.6 ? 1 : Math.abs(lx) < 0.3 ? 0 : p.gx;
      const gauche = bas(K.GAUCHE) || (gx === -1 && p.gx !== -1);
      const droite = bas(K.DROITE) || (gx === 1 && p.gx !== 1);
      p.gx = gx;
      if (mode === 'salon') salon(p, bas, gauche, droite);
      else if (mode === 'repos') { if (bas(K.A) || bas(K.MENU)) api.surSalon?.(); }
      else if (mode === 'match' && M) {
        // (bola-app#26, lot 4) A / ✕ passe le ralenti du but (match.js ne l'écoute que pendant le ralenti)
        if (bas(K.A)) api.surPasser?.();
        if (p.equipe != null) {
          // (hors du jeu, but, ralenti, engagement, fin : rien n'est gardé pour plus tard, sinon le A qui passe le
          // ralenti deviendrait une passe au coup d'envoi ; comme le clavier, la commande est oubliée)
          if (M.phase === 'jeu') lireManette(p.cmd, p.etat, t, M, p.equipe, versJeu);
          else if (p.cmd.vu) oublier(p.cmd);
          if (bas(K.MENU)) api.surPause?.();
        } else if (bas(K.A)) {
          const e = p.ancienne != null && libre(p.ancienne, p) ? p.ancienne : libre(0, p) ? 0 : libre(1, p) ? 1 : null;
          if (e != null) poser(p, e);
        }
      }
      p.prec.set(b);
    }
    for (const p of places) {
      if (vues.has(p) || !p.branchee) continue;
      p.branchee = false; p.vu = false; p.debrancheT = t;
      if (p.equipe != null) { p.ancienne = p.equipe; p.equipe = null; }
      oublier(p.cmd);
      changer();
    }
    // (une place débranchée depuis plus d'une minute est oubliée)
    for (let i = places.length - 1; i >= 0; i--) if (!places[i].branchee && t - places[i].debrancheT > 60) places.splice(i, 1);
  }

  /** La manette de chaque équipe (null = l'IA, ou le pouce pour les Noirs). */
  function equipes() {
    const r = [null, null];
    for (const p of places) if (p.branchee && p.reconnue && p.equipe != null) r[p.equipe] = p;
    return r;
  }

  function vibrerPlace(p, ef) {
    if (!p || !ef) return;
    try {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const g = lirePads().find((q) => q && q.index === p.index && q.id === p.id);
      if (!g) return;
      const a = g.vibrationActuator;
      if (a && typeof a.playEffect === 'function') {
        const r = a.playEffect('dual-rumble', { startDelay: 0, duration: Math.round(ef.duree), strongMagnitude: Math.min(1, ef.fort), weakMagnitude: Math.min(1, ef.faible) });
        r?.catch?.(() => {});
      } else g.hapticActuators?.[0]?.pulse?.(Math.min(1, Math.max(ef.fort, ef.faible)), Math.round(ef.duree))?.catch?.(() => {});
      if (ef.puis) { const h = setTimeout(() => { minuteurs.delete(h); vibrerPlace(p, { ...ef.puis, puis: null }); }, ef.duree + ef.puis.pause); minuteurs.add(h); }
    } catch { /* une manette qui ne sait pas vibrer : rien */ }
  }

  function instantane() {
    if (!instant) {
      instant = {
        version, mode,
        pads: places.filter((p) => p.branchee).map((p) => ({ cle: p.cle, marque: p.marque, reconnue: p.reconnue, equipe: p.equipe, choc: p.choc, numero: p.index + 1 })),
      };
    }
    return instant;
  }

  const onCo = () => changer();
  if (typeof window !== 'undefined') { addEventListener('gamepadconnected', onCo); addEventListener('gamepaddisconnected', onCo); }

  return Object.assign(api, {
    lire, equipes,
    intention: (e) => { const p = equipes()[e]; return p ? intentionDe(p.cmd) : null; },
    jauge: (e) => equipes()[e]?.cmd.p ?? 0,
    vibrer: (e, ef) => vibrerPlace(equipes()[e], ef),
    /** 'repos' | 'salon' | 'match' */
    mode: (m) => { if (m && m !== mode) { mode = m; for (const p of places) oublier(p.cmd); changer(); } return mode; },
    reconnues: () => places.filter((p) => p.branchee && p.reconnue).length,
    abonner: (f) => { abonnes.add(f); return () => abonnes.delete(f); },
    instantane,
    /** une manette rangée dans une équipe est-elle branchée ? (sinon la pause ne peut pas être levée par elle) */
    rangees: () => places.filter((p) => p.branchee && p.reconnue && p.equipe != null).length,
    detruire: () => { if (typeof window !== 'undefined') { removeEventListener('gamepadconnected', onCo); removeEventListener('gamepaddisconnected', onCo); } abonnes.clear(); for (const h of minuteurs) clearTimeout(h); minuteurs.clear(); },
  });
}
