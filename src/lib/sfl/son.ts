"use client";

// Sound design des cartes — tout est SYNTHÉTISÉ en Web Audio, zéro fichier.
//
// Trois gestes sonores, courts et doux :
//   · la déchirure : un souffle de bruit filtré qui monte (ouvrir un pack) ;
//   · la révélation : un fond grave + un petit arpège dont la couleur suit le
//     type de carte — plus la carte est rare, plus l'arpège monte ;
//   · le scintillement : trois harmoniques aiguës, réservées aux MVP.
//
// Règle du navigateur : l'AudioContext ne démarre qu'après un geste de
// l'utilisateur. Toutes ces fonctions sont appelées depuis un « touche pour
// révéler » — jamais à l'ouverture seule — donc jamais bloquées. Et si le
// contexte échoue (vieux navigateur, autoplay strict), tout se tait sans
// jamais casser l'app.

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Une note enveloppée : attaque brève, extinction exponentielle. */
function note(
  c: AudioContext,
  freq: number,
  t0: number,
  dur: number,
  peak: number,
  type: OscillatorType = "sine"
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Un souffle : bruit blanc dans un passe-bande dont la fréquence glisse. */
function souffle(c: AudioContext, t0: number, dur: number, de: number, vers: number, peak: number) {
  const len = Math.ceil(c.sampleRate * dur);
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filtre = c.createBiquadFilter();
  filtre.type = "bandpass";
  filtre.Q.value = 1.1;
  filtre.frequency.setValueAtTime(de, t0);
  filtre.frequency.exponentialRampToValueAtTime(vers, t0 + dur);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + dur * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filtre).connect(gain).connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

/** Ouvrir un pack : la déchirure. */
export function sonDechirure() {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  souffle(c, t, 0.5, 300, 3600, 0.16);
  note(c, 88, t + 0.32, 0.3, 0.12, "sine");
}

/** L'arpège de chaque famille de cartes — la rareté monte dans l'aigu. */
const ARPEGES: Record<string, number[]> = {
  simple: [440, 659.3], // la · mi
  rare: [523.3, 784], // do · sol
  def: [587.3, 880], // ré · la
  impact: [659.3, 987.8], // mi · si
  mvp: [659.3, 987.8, 1318.5], // mi · si · mi aigu
};

/**
 * La révélation d'une carte. `kind` accepte les types de collection
 * (simple/rare/def/impact/mvp) — tout autre libellé retombe sur « rare ».
 */
export function sonRevelation(kind: string) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const arpege = ARPEGES[kind] ?? ARPEGES.rare;
  const majeur = kind === "mvp" || kind === "impact";

  // Le fond : un grave bref qui donne du poids.
  note(c, 110, t, 0.35, majeur ? 0.16 : 0.12, "sine");
  // L'arpège, égrené.
  arpege.forEach((f, i) => {
    note(c, f, t + 0.06 + i * 0.11, 0.55, 0.11, "triangle");
  });
  // Le scintillement des MVP : trois harmoniques très aiguës, très douces.
  if (kind === "mvp") {
    [2637, 3136, 3951].forEach((f, i) => {
      note(c, f, t + 0.42 + i * 0.07, 0.5, 0.035, "sine");
    });
    souffle(c, t + 0.1, 0.7, 2000, 6000, 0.05);
  }
}
