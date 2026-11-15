// Le son du jeu (bola-app#26, lot 4) : tout est SYNTHÉTISÉ par WebAudio (oscillateurs, bruit, filtres), aucun fichier
// chargé ni enregistré. Deux parties :
//
//   - planSons (pur, lu par le banc) : les événements de la simulation → des sons { s, g, pan } ; et niveauFoule, la
//     rumeur de la salle qui monte avec le danger (balle près d'un but, frappe en l'air) ;
//   - creerSon (navigateur) : le moteur. L'AudioContext n'est créé qu'au premier geste (toucher, clic, touche) — la règle
//     des navigateurs ; s'il reste bloqué, le jeu est muet, sans rien demander. « Réduire les animations » : aucun son
//     (le moteur n'est jamais créé). M au clavier coupe et rend le son. Volume général bas, compresseur en sortie (rien
//     ne sature quand tout arrive ensemble), 14 voix au plus, deux sons du même genre à moins de 45 ms : un seul.
//
// Les sons : la frappe (impulsion basse qui descend + claquement de cuir filtré, plus fort et plus clair avec la
// puissance), la passe et le contrôle (un toc sourd), le rebond au sol (sinus amorti), le panneau (coup sourd et
// vibration de la planche), le poteau (quatre partiels inharmoniques qui sonnent ~1 s : le métal), le filet (souffle de
// bruit aigu), le tacle et la chute (bruit grave étouffé), le sifflet (deux sinus voisins, trille) à l'engagement, aux
// fautes et à la fin (trois coups), la foule (bruit rose filtré en boucle, qui enfle avec le danger, et la clameur du but).

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** La rumeur (0..1) : balle près d'un but, frappe en vol. Pur. */
export function niveauFoule(M) {
  const b = M.balle;
  const pres = clamp(1 - (15 - Math.abs(b.p.z)) / 9, 0, 1); // à moins de 9 m d'une ligne
  const tir = b.tir ? 0.5 : 0;
  return clamp(0.18 + pres * 0.45 + tir, 0, 1);
}

/**
 * Les sons d'une liste d'événements (M.evts). Pur. pan : -1 (gauche de l'écran) .. 1 (droite) ; à l'écran, la droite
 * est le but attaqué par les Noirs (z = -15).
 */
export function planSons(evts, M, out = []) {
  out.length = 0;
  const panDe = (z) => clamp(-z / 16, -1, 1) * 0.6;
  const bz = M.balle.p.z;
  for (const e of evts) {
    switch (e.type) {
      case 'frappe': out.push({ s: 'frappe', g: clamp(0.45 + (e.p ?? 0.5) * 0.55, 0, 1), pan: panDe(bz) }); break;
      case 'passe': case 'centre': out.push({ s: 'passe', g: clamp(0.35 + (e.p ?? 0.4) * 0.4, 0, 0.8), pan: panDe(bz) }); break;
      case 'controle': out.push({ s: 'controle', g: clamp(0.2 + (e.vin ?? 5) / 30, 0.2, 0.6), pan: panDe(bz) }); break;
      case 'balleChoc':
        if (e.genre === 'rebond') { if (e.f > 2.5) out.push({ s: 'rebond', g: clamp(e.f / 14, 0.1, 0.8), pan: panDe(e.z) }); }
        else if (e.genre === 'panneau') out.push({ s: 'panneau', g: clamp(e.f / 18, 0.15, 1), pan: panDe(e.z) });
        else if (e.genre === 'poteau') out.push({ s: 'poteau', g: clamp(e.f / 14, 0.25, 1), pan: panDe(e.z) });
        else if (e.genre === 'filet') out.push({ s: 'filet', g: clamp(e.f / 16, 0.2, 1), pan: panDe(e.z) });
        break;
      case 'tacleBalle': case 'tacleJambes': out.push({ s: 'tacle', g: 0.55, pan: panDe(bz) }); break;
      case 'chute': out.push({ s: 'chute', g: 0.45, pan: panDe(bz) }); break;
      case 'arret': case 'capte': out.push({ s: 'controle', g: 0.55, pan: panDe(bz) }); break;
      case 'but': out.push({ s: 'clameur', g: 1, pan: 0 }); break;
      case 'engagement': out.push({ s: 'sifflet', g: 0.5, n: 1, pan: 0 }); break;
      case 'coupFranc': out.push({ s: 'sifflet', g: 0.55, n: 1, pan: 0 }); break;
      case 'fin': out.push({ s: 'sifflet', g: 0.7, n: 3, pan: 0 }); break;
      default: break;
    }
  }
  return out;
}

/** Le moteur (navigateur). Renvoie un objet qui ne fait rien si reduit, ou tant qu'aucun geste n'a ouvert le son. */
export function creerSon({ reduit = false } = {}) {
  const vide = { jouer() {}, foule() {}, basculer() {}, get actif() { return false; }, get muet() { return true; }, detruire() {} };
  if (reduit || typeof window === 'undefined') return vide;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return vide;
  let ctx = null, sortie = null, bruit = null, rose = null, foule = null, fouleG = null, muet = false, voix = 0;
  const derniers = {};

  function ouvrir() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = null; return; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    sortie = ctx.createGain(); sortie.gain.value = muet ? 0 : 0.55;
    sortie.connect(comp); comp.connect(ctx.destination);
    // 1 s de bruit blanc, 4 s de bruit rose (filtre de Paul Kellet), faits une fois
    const sr = ctx.sampleRate;
    bruit = ctx.createBuffer(1, sr, sr); { const d = bruit.getChannelData(0); let s = 12345; for (let i = 0; i < d.length; i++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; d[i] = (s / 2147483648) - 1; } }
    rose = ctx.createBuffer(1, sr * 4, sr);
    { const d = rose.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, s = 999;
      for (let i = 0; i < d.length; i++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; const w = (s / 2147483648) - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + w * 0.5362) * 0.11; } }
    // la foule : le bruit rose en boucle, filtré comme une salle (un murmure de voix, pas un souffle)
    foule = ctx.createBufferSource(); foule.buffer = rose; foule.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.55;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    fouleG = ctx.createGain(); fouleG.gain.value = 0;
    foule.connect(bp); bp.connect(lp); lp.connect(fouleG); fouleG.connect(sortie); foule.start();
  }
  const geste = () => ouvrir();
  const touche = (e) => { if (e.key === 'm' || e.key === 'M') { if (!e.repeat) basculer(); } else ouvrir(); };
  addEventListener('pointerdown', geste, { passive: true }); addEventListener('keydown', touche);
  function basculer() { muet = !muet; if (sortie) sortie.gain.setTargetAtTime(muet ? 0 : 0.55, ctx.currentTime, 0.03); }

  const pret = () => ctx && ctx.state === 'running' && !muet;
  const env = (g, t, a, d, v) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function voie(pan) {
    const g = ctx.createGain();
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan || 0; g.connect(p); p.connect(sortie); } else g.connect(sortie);
    return g;
  }
  function osc(type, f0, f1, t, d, v, out) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + d);
    env(g, t, 0.003, d, v); o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.05);
    voix++; o.onended = () => { voix--; };
  }
  function souffle(t, d, v, filtre, f, q, out, attaque = 0.002) {
    const s = ctx.createBufferSource(); s.buffer = bruit; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = ctx.createBiquadFilter(); fl.type = filtre; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); env(g, t, attaque, d, v);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + attaque + d + 0.05);
    voix++; s.onended = () => { voix--; };
  }
  function son({ s, g, pan, n }) {
    const t = ctx.currentTime + 0.005, out = voie(pan);
    switch (s) {
      case 'frappe':
        osc('sine', 150, 48, t, 0.16, 0.9 * g, out);
        souffle(t, 0.06, 0.55 * g, 'bandpass', 900 + 1600 * g, 1.1, out);
        break;
      case 'passe': osc('sine', 170, 70, t, 0.09, 0.6 * g, out); souffle(t, 0.035, 0.25 * g, 'bandpass', 1100, 1.4, out); break;
      case 'controle': osc('sine', 130, 80, t, 0.07, 0.5 * g, out); souffle(t, 0.03, 0.15 * g, 'lowpass', 900, 0.7, out); break;
      case 'rebond': osc('sine', 105, 60, t, 0.08, 0.6 * g, out); break;
      case 'panneau':
        osc('sine', 72, 55, t, 0.22, 0.8 * g, out);
        souffle(t, 0.28, 0.45 * g, 'bandpass', 380, 1.2, out);
        osc('triangle', 212, 205, t, 0.18, 0.12 * g, out);
        break;
      case 'poteau':
        for (const [f, d, v] of [[523, 1.1, 0.5], [1347, 0.7, 0.32], [2310, 0.42, 0.2], [3410, 0.25, 0.14]]) osc('sine', f, f * 0.998, t, d, v * g, out);
        souffle(t, 0.02, 0.4 * g, 'highpass', 3000, 0.7, out);
        break;
      case 'filet': souffle(t, 0.38, 0.5 * g, 'highpass', 2600, 0.6, out, 0.03); break;
      case 'tacle': souffle(t, 0.22, 0.45 * g, 'lowpass', 520, 0.8, out, 0.01); break;
      case 'chute': souffle(t, 0.18, 0.5 * g, 'lowpass', 300, 0.8, out, 0.005); osc('sine', 80, 50, t, 0.12, 0.4 * g, out); break;
      case 'sifflet': {
        for (let k = 0; k < (n || 1); k++) {
          const t0 = t + k * 0.32, d = k === (n || 1) - 1 && n > 1 ? 0.7 : 0.24;
          for (const f of [2870, 3010]) {
            const o = ctx.createOscillator(), gg = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
            o.frequency.value = f; lfo.frequency.value = 28; lg.gain.value = 60; lfo.connect(lg); lg.connect(o.frequency);
            gg.gain.setValueAtTime(0.0001, t0); gg.gain.exponentialRampToValueAtTime(0.18 * g, t0 + 0.02); gg.gain.setValueAtTime(0.18 * g, t0 + d - 0.04); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
            o.connect(gg); gg.connect(out); o.start(t0); lfo.start(t0); o.stop(t0 + d + 0.02); lfo.stop(t0 + d + 0.02);
          }
        }
        break;
      }
      case 'clameur':
        if (fouleG) { fouleG.gain.cancelScheduledValues(t); fouleG.gain.setTargetAtTime(0.55, t, 0.12); fouleG.gain.setTargetAtTime(0.08, t + 1.2, 1.1); }
        souffle(t, 2.4, 0.22, 'bandpass', 1150, 0.5, out, 0.25);
        break;
      default: break;
    }
  }
  let clameurJusque = 0;
  return {
    /** les sons d'une image (planSons) */
    jouer(liste) {
      if (!pret()) return;
      const now = ctx.currentTime;
      for (const x of liste) {
        if (voix > 14) break;
        if (now - (derniers[x.s] ?? -1) < 0.045) continue;
        derniers[x.s] = now;
        if (x.s === 'clameur') clameurJusque = now + 3;
        son(x);
      }
    },
    /** la rumeur de la salle (0..1), à chaque image */
    foule(niveau) {
      if (!pret() || !fouleG || ctx.currentTime < clameurJusque) return;
      fouleG.gain.setTargetAtTime(0.035 + niveau * 0.11, ctx.currentTime, 0.6);
    },
    basculer,
    get actif() { return !!ctx && ctx.state === 'running'; },
    get muet() { return muet || !ctx || ctx.state !== 'running'; },
    detruire() {
      removeEventListener('pointerdown', geste); removeEventListener('keydown', touche);
      try { foule?.stop(); } catch {}
      ctx?.close().catch(() => {});
    },
  };
}
