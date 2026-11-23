"use client";

// Le coup de sifflet du chrono (chrono-match.ts), joué par le navigateur
// lui-même : aucun fichier son, rien à télécharger. Un sifflet d'arbitre,
// c'est une note aiguë (vers 2,9 kHz) que la bille fait trembler une
// trentaine de fois par seconde, et un peu de souffle : un oscillateur, un
// trémolo, un vibrato et un bruit filtré suffisent.
//
// La mi-temps : deux coups, un court et un long. La fin : trois coups, deux
// courts et un long.
//
// Safari ne joue un son qu'après un geste de l'utilisateur : `deverrouiller`
// ouvre le contexte audio au premier toucher (le Direct l'appelle sur chaque
// geste du chrono et de la feuille). Sur iPhone, `audioSession.type =
// "playback"` le fait entendre même interrupteur silencieux baissé.

import type { Sifflet } from "./chrono-match";

type AudioCtx = AudioContext;
let ctx: AudioCtx | null = null;

function contexte(): AudioCtx | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) {
      try {
        session.type = "playback";
      } catch {
        /* réglage refusé : le son passe quand même, sauf en silencieux */
      }
    }
    ctx = new C();
    return ctx;
  } catch {
    return null;
  }
}

/** À appeler dans un geste (toucher, clic) : ouvre le son pour la suite. */
export function deverrouiller(): void {
  const c = contexte();
  if (!c || c.state === "running") return;
  void c.resume().catch(() => {});
  try {
    // Un silence d'un échantillon : Safari tient le contexte pour ouvert.
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  } catch {
    /* rien */
  }
}

let bruit: AudioBuffer | null = null;
function souffle(c: AudioCtx): AudioBuffer {
  if (bruit && bruit.sampleRate === c.sampleRate) return bruit;
  const b = c.createBuffer(1, Math.floor(c.sampleRate * 1.5), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  bruit = b;
  return b;
}

/** Un coup de sifflet de `duree` secondes, à partir de `t` (horloge du contexte). */
function coup(c: AudioCtx, sortie: AudioNode, t: number, duree: number) {
  const fin = t + duree;
  const enveloppe = c.createGain();
  enveloppe.gain.setValueAtTime(0, t);
  enveloppe.gain.linearRampToValueAtTime(1, t + 0.025);
  enveloppe.gain.setValueAtTime(1, fin - 0.06);
  enveloppe.gain.linearRampToValueAtTime(0, fin);
  enveloppe.connect(sortie);

  // La bille : un trémolo à ~32 Hz, qui fait le « roulement ».
  const trem = c.createGain();
  trem.gain.value = 0.6;
  trem.connect(enveloppe);
  const bille = c.createOscillator();
  bille.frequency.value = 32;
  const profondeur = c.createGain();
  profondeur.gain.value = 0.4;
  bille.connect(profondeur);
  profondeur.connect(trem.gain);

  // La note, qui vibre avec la bille et monte un peu à l'attaque.
  const note = c.createOscillator();
  note.type = "sine";
  note.frequency.setValueAtTime(2650, t);
  note.frequency.linearRampToValueAtTime(2900, t + 0.06);
  const vibrato = c.createGain();
  vibrato.gain.value = 90;
  bille.connect(vibrato);
  vibrato.connect(note.frequency);
  note.connect(trem);

  // Une harmonique, plus faible.
  const harmo = c.createOscillator();
  harmo.type = "sine";
  harmo.frequency.setValueAtTime(5300, t);
  harmo.frequency.linearRampToValueAtTime(5800, t + 0.06);
  const harmoGain = c.createGain();
  harmoGain.gain.value = 0.12;
  harmo.connect(harmoGain);
  harmoGain.connect(trem);

  // Le souffle, autour de la note.
  const air = c.createBufferSource();
  air.buffer = souffle(c);
  const filtre = c.createBiquadFilter();
  filtre.type = "bandpass";
  filtre.frequency.value = 2900;
  filtre.Q.value = 4;
  const airGain = c.createGain();
  airGain.gain.value = 0.25;
  air.connect(filtre);
  filtre.connect(airGain);
  airGain.connect(trem);

  for (const s of [bille, note, harmo, air]) {
    s.start(t);
    s.stop(fin + 0.02);
  }
}

/** Siffle la mi-temps ou la fin. Sans son possible (aucun geste encore, pas d'audio) : rien, sans erreur. */
export function siffler(quoi: Sifflet): void {
  const c = contexte();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => {});
  try {
    const sortie = c.createGain();
    sortie.gain.value = 0.55;
    const comp = c.createDynamicsCompressor();
    sortie.connect(comp);
    comp.connect(c.destination);
    const t = c.currentTime + 0.05;
    const coups = quoi === "mi-temps" ? [0.35, 1.1] : [0.3, 0.3, 1.4];
    let a = t;
    for (const d of coups) {
      coup(c, sortie, a, d);
      a += d + 0.18;
    }
  } catch {
    /* pas de son ici */
  }
}
