// Les tables des clips Mixamo que lit la simulation (durées, root motion, pieds, appuis, impacts, mains du gardien),
// mesurées hors navigateur par tools/jeu-clips.mjs. Elles ne sont plus en clair dans ce dépôt public (décision 2 de
// bola-app#25) : elles sont rangées en JSON brouillé dans public/jeu/anims/mesures.pak (même brouillage que les
// paquets d'animation, pakcodec.js), et chargées une fois avant de créer un monde :
//   · page : await chargerMesuresUrl() (match.js, avant creerMonde et les animateurs) ;
//   · banc : chargerMesures(fs.readFileSync('public/jeu/anims/mesures.pak')) (tools/jeu-banc*.ts).
// Sans mesures, creerMonde refuse de démarrer (exigerMesures) : une simulation sans clips n'est pas le jeu. L'empreinte
// (FNV-1a du JSON) est vérifiée au chargement ; celles des paquets mesurés (sources) le sont par le banc.
// Le registre CLIPS est rempli en place : les modules qui l'importent voient les mesures dès qu'elles sont chargées.
import { unpak } from '../pakcodec.js';

export const FPS_CLIPS = 30;
export const HANCHE = 0.957;
export const CLIPS = {};
export const MESURES = { pret: false, empreinte: null, sources: null };

/** L'empreinte FNV-1a (8 chiffres hexadécimaux) d'une suite d'octets. */
export function empreinteOctets(octets) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < octets.length; i++) { h ^= octets[i]; h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** Débrouille et installe les mesures (octets du .pak). Lève une erreur si le fichier est faux ou abîmé. */
export function chargerMesures(octets) {
  const brut = unpak(octets instanceof Uint8Array ? octets : new Uint8Array(octets), 'mesures');
  const donnees = JSON.parse(new TextDecoder().decode(brut));
  const { empreinte, ...corps } = donnees;
  if (empreinte !== empreinteOctets(new TextEncoder().encode(JSON.stringify(corps)))) throw new Error('mesures.pak : empreinte fausse');
  if (corps.fps !== FPS_CLIPS || corps.hanche !== HANCHE) throw new Error('mesures.pak : unités inattendues');
  for (const k of Object.keys(CLIPS)) delete CLIPS[k];
  Object.assign(CLIPS, corps.clips);
  MESURES.pret = true; MESURES.empreinte = empreinte; MESURES.sources = corps.sources;
  return MESURES;
}

let enCours = null;
/** Charge les mesures depuis le site (une fois). */
export function chargerMesuresUrl(url = '/jeu/anims/mesures.pak') {
  if (MESURES.pret) return Promise.resolve(MESURES);
  enCours ??= fetch(url).then((r) => { if (!r.ok) throw new Error(`${url} : ${r.status}`); return r.arrayBuffer(); }).then((b) => chargerMesures(new Uint8Array(b)));
  enCours.catch(() => { enCours = null; });
  return enCours;
}

/** Refuse une simulation sans mesures. */
export function exigerMesures() {
  if (!MESURES.pret) throw new Error('mesures des clips absentes : chargerMesures() avant creerMonde()');
}

/** Pour le banc : oublie les mesures (contrôle du refus). */
export function oublierMesures() {
  for (const k of Object.keys(CLIPS)) delete CLIPS[k];
  MESURES.pret = false; MESURES.empreinte = null; MESURES.sources = null;
}
