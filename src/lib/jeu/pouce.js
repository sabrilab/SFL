// Le pouce : toute la commande du jeu, d'une seule main, dans le bas de l'écran (les 45 % du bas).
//   · posé puis glissé : un stick qui naît sous le doigt ; la direction fait courir, la distance règle l'allure
//     (au-delà de 85 % du rayon : le sprint) ;
//   · un coup sec puis lâché : la frappe (surLancer, avec la direction et la vivacité du dernier mouvement) ;
//   · touché bref sans bouger : le dribble (surTouche).
//   · (bola-app#26, lot 3) un second doigt posé pendant que le premier tient le stick : c'est le stick droit des gestes
//     techniques (geste : { x, y } de -1 à 1, son déplacement depuis son point de pose, 46 px = poussé à fond ; mêmes
//     motifs qu'à la manette, lus par match.js avec entrees/geste-stick.js) ; touché sans bouger, c'est R3, la semelle
//     (surSemelle).
// À la souris, c'est pareil (cliquer-glisser). Le clavier est à part depuis le lot 3 (entrees/clavier.js : une manette
// faite de touches). « utilise » passe à vrai au premier vrai geste de jeu (stick poussé au-delà de 30 %, frappe,
// touche), pas à un simple toucher ; « vu » garde l'instant du dernier geste : quand des manettes jouent, le pouce ne
// prend les Noirs que s'il sert (match.js les rend à l'IA après 2 s sans geste).
import { stickDoigt } from './entrees/geste-stick.js';

const ZONE = 0.55; // le pouce se pose sous cette fraction de la hauteur
const RAYON = 58; // px : le stick plein
const VIF = 900; // px/s : au-delà, un lâcher est une frappe
const VIF_MAX = 2600;

export function creerPouce(el) {
  const parent = el.parentElement;
  // le stick dessiné : un anneau et un point, en blanc
  const anneau = document.createElement('div');
  const point = document.createElement('div');
  Object.assign(anneau.style, {
    position: 'absolute', width: RAYON * 2 + 'px', height: RAYON * 2 + 'px', marginLeft: -RAYON + 'px', marginTop: -RAYON + 'px',
    borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)',
    pointerEvents: 'none', opacity: '0', transition: 'opacity .15s', left: '0', top: '0',
  });
  Object.assign(point.style, {
    position: 'absolute', width: '38px', height: '38px', marginLeft: '-19px', marginTop: '-19px', borderRadius: '50%',
    background: 'rgba(255,255,255,0.9)', boxShadow: '0 2px 12px rgba(0,0,0,.35)', pointerEvents: 'none', opacity: '0',
    transition: 'opacity .15s', left: '0', top: '0',
  });
  parent.appendChild(anneau);
  parent.appendChild(point);

  const p = {
    stick: { x: 0, y: 0 },
    surTouche: null,
    surLancer: null,
    surSemelle: null,
    geste: { x: 0, y: 0, actif: false },
    actif: false,
    utilise: false,
    vu: -1e9,
  };
  const servir = () => { p.utilise = true; p.vu = performance.now(); };
  let id = null, ox = 0, oy = 0, debut = 0, bouge = 0;
  const trace = []; // derniers points { x, y, t }

  // le second doigt : le stick droit
  let id2 = null, ox2 = 0, oy2 = 0, debut2 = 0, bouge2 = 0;
  function poser(e) {
    if (id !== null) {
      if (id2 !== null || e.pointerType === 'mouse') return;
      id2 = e.pointerId;
      try { el.setPointerCapture(id2); } catch {}
      ox2 = e.clientX; oy2 = e.clientY; debut2 = performance.now(); bouge2 = 0;
      p.geste.actif = true; p.geste.x = p.geste.y = 0;
      e.preventDefault();
      return;
    }
    const r = el.getBoundingClientRect();
    if (e.clientY - r.top < r.height * ZONE && e.pointerType !== 'mouse') return;
    id = e.pointerId;
    try { el.setPointerCapture(id); } catch {}
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    debut = performance.now(); bouge = 0;
    trace.length = 0;
    trace.push({ x: e.clientX, y: e.clientY, t: debut });
    p.actif = true;
    anneau.style.left = point.style.left = ox + 'px';
    anneau.style.top = point.style.top = oy + 'px';
    anneau.style.opacity = point.style.opacity = '1';
    e.preventDefault();
  }
  function glisser(e) {
    if (e.pointerId === id2) {
      const dx = e.clientX - ox2, dy = e.clientY - oy2;
      bouge2 = Math.max(bouge2, Math.hypot(dx, dy));
      const g = stickDoigt(dx, dy);
      p.geste.x = g.x; p.geste.y = g.y;
      if (bouge2 > 14) servir();
      return;
    }
    if (e.pointerId !== id) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let dx = x - ox, dy = y - oy;
    const L = Math.hypot(dx, dy);
    bouge = Math.max(bouge, L);
    // le stick suit le doigt s'il dépasse le rayon (l'anneau glisse avec lui)
    if (L > RAYON) { ox += (dx / L) * (L - RAYON); oy += (dy / L) * (L - RAYON); dx = x - ox; dy = y - oy; }
    p.stick.x = dx / RAYON; p.stick.y = -dy / RAYON;
    if (Math.hypot(p.stick.x, p.stick.y) > 0.3) servir();
    anneau.style.left = ox + 'px'; anneau.style.top = oy + 'px';
    point.style.left = x + 'px'; point.style.top = y + 'px';
    const t = performance.now();
    trace.push({ x: e.clientX, y: e.clientY, t });
    while (trace.length > 2 && t - trace[0].t > 90) trace.shift();
  }
  function lacher(e) {
    if (e.pointerId === id2) {
      id2 = null;
      p.geste.actif = false; p.geste.x = p.geste.y = 0;
      if (performance.now() - debut2 < 260 && bouge2 < 12) { servir(); p.surSemelle?.(); }
      return;
    }
    if (e.pointerId !== id) return;
    id = null;
    p.actif = false;
    p.stick.x = p.stick.y = 0;
    anneau.style.opacity = point.style.opacity = '0';
    const t = performance.now();
    // la vivacité du dernier mouvement
    const a = trace[0], z = trace[trace.length - 1];
    const dt = Math.max(1, z.t - a.t) / 1000;
    const vx = (z.x - a.x) / dt, vy = (z.y - a.y) / dt;
    const v = Math.hypot(vx, vy);
    if (v > VIF && t - z.t < 80) {
      servir();
      p.surLancer?.(vx, -vy, Math.min(1, (v - VIF) / (VIF_MAX - VIF)));
      return;
    }
    if (t - debut < 260 && bouge < 14) { servir(); p.surTouche?.(); }
  }
  el.addEventListener('pointerdown', poser);
  el.addEventListener('pointermove', glisser);
  el.addEventListener('pointerup', lacher);
  el.addEventListener('pointercancel', lacher);

  p.servir = servir;

  p.detruire = () => {
    el.removeEventListener('pointerdown', poser);
    el.removeEventListener('pointermove', glisser);
    el.removeEventListener('pointerup', lacher);
    el.removeEventListener('pointercancel', lacher);
    anneau.remove(); point.remove();
  };
  return p;
}
