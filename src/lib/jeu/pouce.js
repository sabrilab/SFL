// Le pouce : toute la commande du jeu, d'une seule main, dans le bas de l'écran (les 45 % du bas).
//   · posé puis glissé : un stick qui naît sous le doigt ; la direction fait courir, la distance règle l'allure
//     (au-delà de 85 % du rayon : le sprint) ;
//   · un coup sec puis lâché : la frappe (surLancer, avec la direction et la vivacité du dernier mouvement) ;
//   · touché bref sans bouger : le dribble (surTouche).
// À la souris, c'est pareil (cliquer-glisser) ; au clavier, flèches pour courir, Espace pour frapper, D pour dribbler.

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
    actif: false,
  };
  let id = null, ox = 0, oy = 0, debut = 0, bouge = 0;
  const trace = []; // derniers points { x, y, t }

  function poser(e) {
    if (id !== null) return;
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
    if (e.pointerId !== id) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let dx = x - ox, dy = y - oy;
    const L = Math.hypot(dx, dy);
    bouge = Math.max(bouge, L);
    // le stick suit le doigt s'il dépasse le rayon (l'anneau glisse avec lui)
    if (L > RAYON) { ox += (dx / L) * (L - RAYON); oy += (dy / L) * (L - RAYON); dx = x - ox; dy = y - oy; }
    p.stick.x = dx / RAYON; p.stick.y = -dy / RAYON;
    anneau.style.left = ox + 'px'; anneau.style.top = oy + 'px';
    point.style.left = x + 'px'; point.style.top = y + 'px';
    const t = performance.now();
    trace.push({ x: e.clientX, y: e.clientY, t });
    while (trace.length > 2 && t - trace[0].t > 90) trace.shift();
  }
  function lacher(e) {
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
      p.surLancer?.(vx, -vy, Math.min(1, (v - VIF) / (VIF_MAX - VIF)));
      return;
    }
    if (t - debut < 260 && bouge < 14) p.surTouche?.();
  }
  el.addEventListener('pointerdown', poser);
  el.addEventListener('pointermove', glisser);
  el.addEventListener('pointerup', lacher);
  el.addEventListener('pointercancel', lacher);

  // clavier (ordinateur)
  const touches = new Set();
  let espace = 0;
  const majClavier = () => {
    if (p.actif) return;
    p.stick.x = (touches.has('ArrowRight') ? 1 : 0) - (touches.has('ArrowLeft') ? 1 : 0);
    p.stick.y = (touches.has('ArrowUp') ? 1 : 0) - (touches.has('ArrowDown') ? 1 : 0);
    const L = Math.hypot(p.stick.x, p.stick.y);
    const amp = touches.has('Shift') ? 1 : 0.7;
    if (L) { p.stick.x *= amp / L; p.stick.y *= amp / L; }
  };
  const bas = (e) => {
    if (e.repeat) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (e.key === ' ') { espace = performance.now(); return; }
    if (e.key === 'd' || e.key === 'D') { p.surTouche?.(); return; }
    touches.add(e.key); majClavier();
  };
  const haut = (e) => {
    if (e.key === ' ' && espace) {
      // Espace : maintenu = plus fort ; droit au but, infléchi par les flèches haut et bas
      const f = Math.min(1, (performance.now() - espace) / 700);
      espace = 0;
      p.surLancer?.(1, p.stick.y * 0.6, f); // vers la droite : le but attaqué, vu de la tribune
      return;
    }
    touches.delete(e.key); majClavier();
  };
  addEventListener('keydown', bas);
  addEventListener('keyup', haut);

  p.detruire = () => {
    el.removeEventListener('pointerdown', poser);
    el.removeEventListener('pointermove', glisser);
    el.removeEventListener('pointerup', lacher);
    el.removeEventListener('pointercancel', lacher);
    removeEventListener('keydown', bas);
    removeEventListener('keyup', haut);
    anneau.remove(); point.remove();
  };
  return p;
}
