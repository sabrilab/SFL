// Les tables des clips pour la simulation du jeu (public/jeu/anims/mesures.pak, chargé par src/lib/jeu/sim/clips.js),
// lues dans les .pak d'animation.
//
// La simulation ne lit jamais le squelette animé (elle tourne aussi sans navigateur, dans le banc) : ce qu'elle doit
// savoir des clips Mixamo est mesuré ici, une fois, hors navigateur. Le .pak est débrouillé en mémoire (pakcodec.js),
// le GLB n'est jamais écrit sur disque, aucun FBX n'est lu. Pour chaque clip des paquets « player », « keeper »,
// « player2 », « keeper2 » et « celeb2 » (bola-app#26, tools/jeu-anims.mjs) :
//   dur, hit (part du clip à l'impact, index.json), turn (courbe de lacet fournie, index.json) ;
//   root : le déplacement horizontal de la racine (root motion), en mètres, à 30 images/s (x, z alternés) ;
//   pieds : la position du milieu de chaque pied (entre cheville et orteil) dans le repère du joueur, sans le root
//           motion, en centimètres, à 30 images/s : [gx, gy, gz, dx, dy, dz] par image ;
//   appuis : pour les cycles et les gestes du joueur, les intervalles (part du clip) [début, fin] où chaque pied est
//            posé ;
//   hanche : la hauteur des hanches (cm) par image ; tete : pour les clips de tête, la tête (cm, repère du joueur) ;
//   mains : pour le gardien, le milieu des deux mains (cm), hanches comprises (ses plongeons n'ont pas de racine) ;
//   piedImpact : à l'impact, le pied qui frappe (« g » ou « d ») et sa position (m).
// Unités : la hanche du footballeur Ch38 mesurée dans le jeu vaut 0,957 m (le squelette de référence a une hanche de 1).
//
// Les mesures ne sont plus en clair dans le dépôt (décision 2 de bola-app#25) : elles sont écrites en JSON brouillé
// (pak(), nom « mesures ») dans public/jeu/anims/mesures.pak, avec l'empreinte FNV-1a de chaque paquet mesuré
// (sources) et celle du JSON (empreinte) ; la page les charge avant de créer le monde, le banc les lit sur disque et
// refuse des mesures plus vieilles que les paquets.
//
//   node tools/jeu-clips.mjs        écrit public/jeu/anims/mesures.pak
//   node tools/jeu-clips.mjs --voir imprime le résumé sans rien écrire
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.resolve(ici, '..');
const THREE = await import('three');
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
const { unpak, pak } = await import(path.join(racine, 'src/lib/jeu/pakcodec.js'));
const { empreinteOctets } = await import(path.join(racine, 'src/lib/jeu/sim/clips.js'));

const HANCHE = 0.957;
const FPS = 30;
const index = JSON.parse(fs.readFileSync(path.join(racine, 'public/jeu/anims/index.json'), 'utf8'));
const voir = process.argv.includes('--voir');

await MeshoptDecoder.ready;
const sortie = {}, sources = {};
const PAQUETS = ['player', 'keeper', 'player2', 'keeper2', 'celeb2'];
for (const pack of PAQUETS) {
  const brut = fs.readFileSync(path.join(racine, `public/jeu/anims/${pack}.pak`));
  sources[pack] = empreinteOctets(brut);
  const glb = unpak(brut, pack);
  const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
  const scene = g.scene;
  const os = (n) => scene.getObjectByName(n);
  const R = os('Root'), H = os('Hips');
  const pieds = ['Left', 'Right'].map((c) => [os(`${c}Foot`), os(`${c}ToeBase`)]);
  const mains = [os('LeftHand'), os('RightHand')];
  const mixer = new THREE.AnimationMixer(scene);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), r0 = new THREE.Vector3();
  for (const clip of g.animations) {
    const meta = index[pack]?.[clip.name] ?? {};
    mixer.stopAllAction();
    const act = mixer.clipAction(clip);
    act.reset().play();
    const n = Math.max(2, Math.round(clip.duration * FPS) + 1);
    const root = [], pd = [], mn = [], hy = [], tt = [];
    const tete = /head/.test(clip.name) ? os('Head') : null;
    for (let i = 0; i < n; i++) {
      const t = Math.min(clip.duration, i / FPS);
      act.time = t; mixer.update(0);
      scene.updateMatrixWorld(true);
      R.getWorldPosition(r0);
      root.push(+(r0.x * HANCHE).toFixed(3), +(r0.z * HANCHE).toFixed(3));
      for (const [f, o] of pieds) {
        f.getWorldPosition(a); o.getWorldPosition(b);
        a.add(b).multiplyScalar(0.5).sub(r0).multiplyScalar(HANCHE * 100);
        pd.push(Math.round(a.x), Math.round(a.y), Math.round(a.z));
      }
      H.getWorldPosition(a); hy.push(Math.round(a.y * HANCHE * 100));
      if (tete) { tete.getWorldPosition(a); a.sub(r0).multiplyScalar(HANCHE * 100); tt.push(Math.round(a.x), Math.round(a.y), Math.round(a.z)); }
      if (pack.startsWith('keeper')) {
        mains[0].getWorldPosition(a); mains[1].getWorldPosition(b);
        a.add(b).multiplyScalar(0.5).sub(r0).multiplyScalar(HANCHE * 100);
        mn.push(Math.round(a.x), Math.round(a.y), Math.round(a.z));
      }
    }
    const e = { dur: +clip.duration.toFixed(4), n, root, pieds: pd, hanche: hy };
    if (tt.length) e.tete = tt;
    if (meta.hit != null) e.hit = meta.hit;
    if (meta.loop) e.boucle = true;
    if (meta.source) e.source = meta.source;
    if (meta.turn) e.turn = meta.turn.map((x) => +(+x).toFixed(4));
    if (mn.length) e.mains = mn;
    // les appuis d'un cycle : pied à moins de 7 cm du sol et lent (dans le repère du clip, qui avance avec la racine)
    // (bola-app#26 : aussi pour les gestes, le graphe d'animation y cale la sortie d'un geste sur un appui)
    if (meta.loop || pack.startsWith('player')) {
      const v = Math.hypot(root[(n - 1) * 2] - root[0], root[(n - 1) * 2 + 1] - root[1]) / clip.duration;
      if (meta.loop) e.vitesse = +v.toFixed(3);
      e.appuis = [0, 1].map((p) => {
        const pose = [];
        for (let i = 0; i < n - 1; i++) {
          const y = pd[i * 6 + p * 3 + 1] / 100;
          // vitesse du pied dans le monde : son mouvement propre plus l'avance de la racine
          const j = i + 1;
          const wx = (pd[j * 6 + p * 3] - pd[i * 6 + p * 3]) / 100 + (root[j * 2] - root[i * 2]);
          const wz = (pd[j * 6 + p * 3 + 2] - pd[i * 6 + p * 3 + 2]) / 100 + (root[j * 2 + 1] - root[i * 2 + 1]);
          pose.push(y < 0.085 && Math.hypot(wx, wz) * FPS < 1.2);
        }
        const iv = [];
        const L = pose.length, cyc = !!meta.loop;
        for (let i = 0; i < L; i++) if (pose[i] && (cyc ? !pose[(i - 1 + L) % L] : i === 0 || !pose[i - 1])) {
          let k = i; while ((cyc || k + 1 < L) && pose[(k + 1) % L] && k - i < L) k++;
          iv.push([+(i / (n - 1)).toFixed(3), +(((k + 1) / (n - 1)) % 1.0001).toFixed(3)]);
        }
        return iv;
      });
    }
    if (meta.hit != null) {
      const i0 = Math.round(meta.hit * (n - 1));
      // le pied qui frappe : celui qui va le plus vite à l'impact marqué
      const vitesse = (p, i) => {
        const a0 = Math.max(0, i - 1), a1 = Math.min(n - 1, i + 1);
        return Math.hypot(pd[a1 * 6 + p * 3] - pd[a0 * 6 + p * 3], pd[a1 * 6 + p * 3 + 1] - pd[a0 * 6 + p * 3 + 1], pd[a1 * 6 + p * 3 + 2] - pd[a0 * 6 + p * 3 + 2]) / 100 * FPS / ((a1 - a0) || 1);
      };
      const p = vitesse(0, i0) > vitesse(1, i0) ? 0 : 1;
      // l'impact marqué tombe parfois après le contact (pied déjà haut) : on prend, de 0,2 s avant à 0,05 s après,
      // l'image où ce pied est le plus bas en allant vite vers l'avant (le contact avec une balle au sol)
      // (un impact imposé au manifeste, hitFixe : amorti, sombrero, tête, est gardé tel quel)
      let i = i0, best = Infinity;
      for (let k = Math.max(0, i0 - 6); k <= Math.min(n - 1, i0 + 1) && !meta.hitFixe; k++) {
        const y = pd[k * 6 + p * 3 + 1] / 100, v = vitesse(p, k);
        if (v < 2.5) continue;
        const s = y - 0.02 * v;
        if (s < best) { best = s; i = k; }
      }
      e.impact = +(i / (n - 1)).toFixed(4);
      e.piedImpact = { pied: p === 0 ? 'g' : 'd', x: pd[i * 6 + p * 3] / 100, y: pd[i * 6 + p * 3 + 1] / 100, z: pd[i * 6 + p * 3 + 2] / 100, vitesse: +vitesse(p, i).toFixed(2) };
    }
    sortie[clip.name] = e;
    if (voir) console.log(pack, clip.name, e.dur, 'n', n, e.vitesse ?? '', JSON.stringify(e.appuis ?? ''), JSON.stringify(e.piedImpact ?? ''), e.impact ?? '');
  }
}

if (!voir) {
  const cible = path.join(racine, 'public/jeu/anims/mesures.pak');
  const corps = { fps: FPS, hanche: HANCHE, sources, clips: sortie };
  const texte = JSON.stringify(corps);
  const octets = new TextEncoder().encode(JSON.stringify({ empreinte: empreinteOctets(new TextEncoder().encode(texte)), ...corps }));
  fs.writeFileSync(cible, pak(octets, 'mesures'));
  console.log('écrit', path.relative(racine, cible), (octets.length / 1024).toFixed(1), 'Ko,', Object.keys(sortie).length, 'clips');
}
