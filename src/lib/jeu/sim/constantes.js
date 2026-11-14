// Les constantes de la simulation du jeu Bola (bola-app#23, « jeu plus réaliste »), toutes au même endroit, avec leur
// unité. Repère du jeu : x = largeur (±10 m aux panneaux), z = longueur (±15 m aux lignes de but, ±16 m aux panneaux
// du fond), y = haut ; mètres, secondes, kilogrammes. Les Noirs (équipe 0) attaquent vers -z.
//
// C'est le seul fichier à régler : la sensation (inertie, virages, rebonds, force des frappes) se change ici, et le
// banc (tools/jeu-banc.ts) dit tout de suite ce que le réglage casse. Valeurs tirées de la conception (§2.1, §4.1).

/** Pas de la simulation (s) : fixe, la boucle d'affichage l'enchaîne avec un accumulateur. */
export const PAS = 1 / 120;
export const G = 9.81;

// ── le terrain (repris de plateau.js, DIM ; recopié ici pour que la simulation tourne sans three) ──
export const TERRAIN = {
  L: 30, l: 18,          // aire de jeu
  TL: 32, Tl: 20,        // gazon jusqu'aux panneaux
  panneau: 0.95,         // hauteur des panneaux
  filet: 5.2,            // hauteur du filet au-dessus des panneaux
  but: [3, 2, 0.9],      // largeur, hauteur, profondeur du but
  surface: 6,            // rayon de la surface du gardien (l'arc peint)
};
export const LB = TERRAIN.L / 2;          // ligne de but : 15 m
export const BX = TERRAIN.Tl / 2;         // panneaux de côté : 10 m
export const BZ = TERRAIN.TL / 2;         // panneaux du fond : 16 m
export const BUT_DL = TERRAIN.but[0] / 2; // demi-largeur du but
export const BUT_H = TERRAIN.but[1];
export const BUT_P = TERRAIN.but[2];
export const HAUT_FILET = TERRAIN.panneau + TERRAIN.filet; // 6,15 m

// ── les corps ──
export const CORPS = {
  masse: 75, masseGardien: 82,      // kg
  rayon: 0.30,                      // m : le cylindre au sol, pour les contacts corps à corps
  rayonJambes: 0.22,                // m : les jambes, pour les tacles
  vMarche: 1.8, vTrot: 4.6, vCourse: 6.0, vSprint: 7.4, // m/s
  vSprintBalle: 6.6,                // m/s : balle au pied, au plus
  vArriere: 3.0, vChasse: 3.2,      // m/s : course arrière, pas chassés (contenir)
  vProtege: 2.2,                    // m/s : en protégeant la balle
  a0: 6.5,                          // m/s² : poussée d'accélération à l'arrêt, a(v) = a0 (1 − v / (1,08 v_cible))
  frein: 6.0, freinPlante: 8.5,     // m/s² : freinage normal, sur appuis plantés
  aLat: 7.5,                        // m/s² : accélération latérale max ; rayon r(v) = v² / aLat
  lacetMax: 9,                      // rad/s : rotation de la course à l'arrêt ; ω = min(9, aLat / v)
  capMax: 6,                        // rad/s : rotation du buste (orientation), indépendante de la vitesse
  pivotAngle: (110 * Math.PI) / 180, pivotVitesse: 2.8, pivotEntree: 2.2,
  balleV: 0.90, balleLat: 0.85,     // pénalités balle au pied (vitesse max, accélération latérale)
  retourDes: 1.5,                   // 1/s : le déséquilibre revient vers 0
  impDes: 1.6,                      // m/s : impulsion (par unité de masse) d'un déséquilibre complet
  trebuche: 0.65, chute: 1.0,       // seuils de déséquilibre
  solChute: 0.9,                    // s au sol après une chute, avant le relevé
  forceEpaule: 900,                 // N
  restitution: 0.15, frottementCorps: 0.3,
  hanche: 0.957,                    // m : hanche du footballeur Ch38 (clips en hanches)
};

// ── le ballon ──
export const BALLON = {
  masse: 0.43, R: 0.11, section: 0.038,
  air: 1.20,                        // kg/m³
  cdBas: 0.45, cdHaut: 0.25, vCrise1: 9, vCrise2: 13, // traînée, crise de traînée
  clMax: 0.22, clPente: 0.7,       // portance de Magnus : C_L = min(0,22 ; 0,7 S), S = R|ω| / |v|
  tauRotation: 6,                   // s : amortissement de la rotation en l'air
  enBase: 0.70, enPente: 0.012, enMin: 0.45, // rebond sur le gazon : e = clamp(0,70 − 0,012 |v_n|)
  mu: 0.45,                         // frottement au contact d'un rebond
  finRebond: 0.5,                   // m/s : sous cette vitesse verticale, le ballon roule
  muGlisse: 0.40, muRoule: 0.11,    // glissement → roulement ; résistance au roulement (synthétique)
  panneauE: 0.66, panneauPente: 0.006, panneauMin: 0.45, panneauT: 0.15,
  filetE: 0.15, filetT: 0.5,
  filetBut: 0.10,
  poteauR: 0.05, poteauE: 0.55,
  vMax: 30,
};
BALLON.inertie = (2 / 3) * BALLON.masse * BALLON.R * BALLON.R; // sphère creuse
BALLON.kAir = (BALLON.air * BALLON.section) / (2 * BALLON.masse); // k_d = ρ A / 2m (× C_d)

// ── le jeu de balle ──
export const JEU = {
  porteeFrappe: 0.30, porteeTouche: 0.38, porteeControle: 0.55, // m
  touche: { thetaMax: [35, 25, 18, 12] }, // écart max de la touche à la course de la balle : pas, trot, course, sprint (°)
  passeV0: [6, 12],                 // v0 = 6 + 12 p
  frappeV0: [14, 16],               // v0 = 14 + 16 p
  finesseV0: [12, 8],
  jauge: 0.9,                       // s : la jauge de puissance monte de 0 à 1
  aide: { pouce: 1, manette: 0.5, ia: 0 },
  coneAide: { pouce: (45 * Math.PI) / 180, manette: (30 * Math.PI) / 180 },
  duree: 150,                       // s : un match
  engagement: 1.1, intro: 1.6, butPause: 3.2,
};

export const ROLES = ['G', 'D', 'L', 'R', 'A'];
/** la formation : x (m) et profondeur f (-1 = sa ligne de but, 1 = celle d'en face), sans la balle */
export const FORMATION = { D: [0, -0.56], L: [-4.6, -0.12], R: [4.6, -0.12], A: [0, 0.32] };
export const ENGAGEMENT = { D: [0, -0.62], L: [-5, -0.28], R: [5, -0.28], A: [0, -0.24] };

/** le sens d'attaque d'une équipe, en z : les Noirs (0) montent vers -z, les Blancs (1) descendent vers +z */
export const sens = (e) => (e === 0 ? -1 : 1);
/** le z de la ligne du but que défend l'équipe e */
export const butDe = (e) => -sens(e) * LB;
