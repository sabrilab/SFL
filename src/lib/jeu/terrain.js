// Le terrain du jeu : un five de nuit (20 × 36 m), gazon tondu en bandes, palissade noire, buts de five, projecteurs,
// et autour l'anneau de colonnes de marbre du stade Bola (« Olympe », validé par Sabri le 30/10 pour ses vidéos).
// Le jeu se joue en vertical : on attaque vers le but du haut (z négatif).
import * as THREE from 'three';

export const LARGEUR = 20; // x ∈ [-10, 10]
export const LONGUEUR = 36; // z ∈ [-18, 18]
export const BUT = { demiLargeur: 2.5, hauteur: 2, z: -18, profondeur: 1.2 };

function texturePelouse() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 1024;
  const g = c.getContext('2d');
  // bandes de tonte, dans le sens de la longueur du terrain
  const bandes = 12;
  for (let i = 0; i < bandes; i++) {
    g.fillStyle = i % 2 ? '#24452a' : '#2b5232';
    g.fillRect(0, (i * c.height) / bandes, c.width, c.height / bandes + 1);
  }
  // grain du gazon
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n;
  }
  g.putImageData(d, 0, 0);
  // les lignes (un peu usées)
  g.strokeStyle = 'rgba(240,240,236,0.85)';
  g.lineWidth = 5;
  const m = 6, W = c.width - 2 * m, H = c.height - 2 * m;
  g.strokeRect(m, m, W, H);
  g.beginPath(); g.moveTo(m, c.height / 2); g.lineTo(c.width - m, c.height / 2); g.stroke();
  g.beginPath(); g.arc(c.width / 2, c.height / 2, (3 / LARGEUR) * c.width, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(240,240,236,0.9)';
  g.beginPath(); g.arc(c.width / 2, c.height / 2, 6, 0, Math.PI * 2); g.fill();
  // surfaces : demi-cercles de 6 m devant chaque but
  const r = (6 / LARGEUR) * c.width;
  g.beginPath(); g.arc(c.width / 2, m, r, 0, Math.PI); g.stroke();
  g.beginPath(); g.arc(c.width / 2, c.height - m, r, Math.PI, Math.PI * 2); g.stroke();
  // points de penalty
  g.beginPath(); g.arc(c.width / 2, m + (7 / LONGUEUR) * c.height, 5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(c.width / 2, c.height - m - (7 / LONGUEUR) * c.height, 5, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function creerBut(z, sens) {
  const g = new THREE.Group();
  const blanc = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.35, metalness: 0.2 });
  const r = 0.05, w = BUT.demiLargeur, h = BUT.hauteur;
  const poteau = new THREE.CylinderGeometry(r, r, h, 12);
  for (const x of [-w, w]) {
    const p = new THREE.Mesh(poteau, blanc);
    p.position.set(x, h / 2, z);
    p.castShadow = true;
    g.add(p);
  }
  const barre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2 * w + 2 * r, 12), blanc);
  barre.rotation.z = Math.PI / 2;
  barre.position.set(0, h, z);
  barre.castShadow = true;
  g.add(barre);
  // le filet : des fils fins, en lignes
  const pts = [];
  const d = BUT.profondeur * sens;
  const pas = 0.25;
  for (let x = -w; x <= w + 1e-3; x += pas) { pts.push(x, h, z, x, h * 0.7, z + d, x, h * 0.7, z + d, x, 0, z + d); }
  for (let y = 0; y <= h + 1e-3; y += pas) { const dz = y > h * 0.7 ? d * (1 - (y - h * 0.7) / (h * 0.3)) : d; pts.push(-w, y, z + dz, w, y, z + dz); }
  for (let k = 0; k <= d * sens + 1e-3; k += pas) { const zz = z + k * sens; pts.push(-w, 0, zz, -w, h * 0.7, zz, w, 0, zz, w, h * 0.7, zz); }
  for (const x of [-w, w]) for (let y = 0; y <= h * 0.7 + 1e-3; y += pas) pts.push(x, y, z, x, y, z + d);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xdedede, transparent: true, opacity: 0.45 })));
  return g;
}

export function creerTerrain(scene) {
  const pelouse = new THREE.Mesh(
    new THREE.PlaneGeometry(LARGEUR, LONGUEUR),
    new THREE.MeshStandardMaterial({ map: texturePelouse(), roughness: 0.95 }),
  );
  pelouse.rotation.x = -Math.PI / 2;
  pelouse.receiveShadow = true;
  scene.add(pelouse);
  // l'herbe autour, plus sombre
  const autour = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x0c140e, roughness: 1 }));
  autour.rotation.x = -Math.PI / 2;
  autour.position.y = -0.01;
  autour.receiveShadow = true;
  scene.add(autour);

  // la palissade du five
  const bois = new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.6 });
  const hp = 0.9;
  const cotes = [
    [LARGEUR + 0.4, 0.2, 0, -LONGUEUR / 2 - 0.1], [LARGEUR + 0.4, 0.2, 0, LONGUEUR / 2 + 0.1],
    [0.2, LONGUEUR, -LARGEUR / 2 - 0.1, 0], [0.2, LONGUEUR, LARGEUR / 2 + 0.1, 0],
  ];
  for (const [sx, sz, x, z] of cotes) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, hp, sz), bois);
    m.position.set(x, hp / 2, z);
    m.receiveShadow = true;
    scene.add(m);
  }
  // le liseré blanc en haut de la palissade
  const lis = new THREE.MeshBasicMaterial({ color: 0xe8e8e4 });
  for (const [sx, sz, x, z] of cotes) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.01, 0.03, sz + 0.01), lis);
    m.position.set(x, hp + 0.015, z);
    scene.add(m);
  }

  scene.add(creerBut(-LONGUEUR / 2, -1));
  scene.add(creerBut(LONGUEUR / 2, 1));

  // l'anneau de colonnes de marbre, loin dans la nuit
  const marbre = new THREE.MeshStandardMaterial({ color: 0x8f8b84, roughness: 0.6 });
  const fut = new THREE.CylinderGeometry(0.9, 1.0, 16, 20);
  const chap = new THREE.BoxGeometry(2.4, 0.6, 2.4);
  const n = 20;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * 30, z = Math.sin(a) * 44;
    const c = new THREE.Mesh(fut, marbre);
    c.position.set(x, 8, z);
    scene.add(c);
    const k = new THREE.Mesh(chap, marbre);
    k.position.set(x, 16.3, z);
    scene.add(k);
  }

  // les projecteurs : quatre mâts aux coins, la lumière tombe en biais
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
  const lampe = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const [x, z] of [[-12.5, -20], [12.5, -20], [-12.5, 20], [12.5, 20]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 14, 8), mat);
    m.position.set(x, 7, z);
    scene.add(m);
    const l = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.2), lampe);
    l.position.set(x, 14, z);
    l.lookAt(0, 0, 0);
    scene.add(l);
  }
}

/** Le ballon : blanc, deux bandes noires courbes (le ballon Bola, en simplifié). */
export function creerBallon() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f2ef';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#121212';
  for (let k = 0; k < 2; k++) {
    g.beginPath();
    for (let x = 0; x <= 256; x += 4) {
      const y = 64 + Math.sin((x / 256) * Math.PI * 4 + k * Math.PI) * 26;
      if (x === 0) g.moveTo(x, y - 9); else g.lineTo(x, y - 9);
    }
    for (let x = 256; x >= 0; x -= 4) {
      const y = 64 + Math.sin((x / 256) * Math.PI * 4 + k * Math.PI) * 26;
      g.lineTo(x, y + 9);
    }
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 20), new THREE.MeshStandardMaterial({ map: t, roughness: 0.45 }));
  m.castShadow = true;
  return m;
}
