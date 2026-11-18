// Copié de sabrilab/bola-game (src/pakcodec.mjs) : même format, mêmes fichiers.
// Brouillage des fichiers sous licence Mixamo (personnages et animations).
// La licence permet de les intégrer au jeu, pas de les proposer seuls au téléchargement :
// ils sont rangés en .pak (en-tête « BPAK1 » + XOR par un flux pseudo-aléatoire dérivé du nom),
// et le jeu les débrouille en mémoire. Module partagé navigateur / Node.
export const MAGIC = [66, 80, 65, 75, 49]; // « BPAK1 »

function seedOf(name) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h || 1;
}

function xorStream(bytes, name) {
  const out = new Uint8Array(bytes.length);
  let s = seedOf(name);
  for (let i = 0; i < bytes.length; i++) {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    out[i] = bytes[i] ^ (s & 255);
  }
  return out;
}

// nom = nom de fichier sans extension (ex. « player »)
export function pak(bytes, name) {
  const body = xorStream(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), name);
  const out = new Uint8Array(MAGIC.length + body.length);
  out.set(MAGIC, 0); out.set(body, MAGIC.length);
  return out;
}

export function unpak(bytes, name) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!MAGIC.every((c, i) => b[i] === c)) throw new Error(`pas un .pak : ${name}`);
  return xorStream(b.subarray(MAGIC.length), name);
}
