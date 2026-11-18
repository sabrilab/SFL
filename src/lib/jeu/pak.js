// Chargement des fichiers .pak du jeu (public/jeu) : GLB brouillés (voir pakcodec.js), débrouillés en mémoire.
// Les personnages et animations Adobe Mixamo ne doivent jamais être servis en .glb en clair : la licence permet
// de les intégrer au jeu, pas de les proposer au téléchargement. Repris de sabrilab/bola-game.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { unpak } from './pakcodec.js';

let loader = null;
const cache = new Map();

export function loadPak(url) {
  loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  if (!cache.has(url)) {
    const p = (async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url} : ${r.status}`);
      const name = url.split('/').pop().replace(/\.pak$/, '');
      const glb = unpak(new Uint8Array(await r.arrayBuffer()), name);
      return loader.parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
    })();
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return cache.get(url);
}
