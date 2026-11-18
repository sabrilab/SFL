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
  rayon: 0.33,                      // m : le cylindre des épaules, pour les contacts corps à corps (0,30 laissait
                                    // les bras d'un clip entrer dans le dos de l'autre)
  rayonJambes: 0.22,                // m : les jambes, pour les tacles
  // (bola-app#32, lot A : « du peps, comme des sportifs de haut niveau » ; avant : trot 4,6, sprint 7,4, balle 6,6,
  // a0 6,5, frein 6, planté 8,5, aLat 7,5, lacet 9, cap 6, entrée du pivot 2,2 ; mesures avant / après :
  // tools/jeu-mesures.ts)
  vMarche: 1.8, vTrot: 5.0, vCourse: 6.2, vSprint: 7.8, // m/s
  vSprintBalle: 7.1,                // m/s : balle au pied, au plus
  vArriere: 3.4, vChasse: 3.6,      // m/s : course arrière, pas chassés (contenir)
  vProtege: 2.4,                    // m/s : en protégeant la balle
  a0: 9,                            // m/s² : poussée d'accélération à l'arrêt, a(v) = a0 (1 − v / (1,08 v_cible))
  frein: 16, freinPlante: 16,       // m/s² : arrêt au relâché du stick (net), freinage sur appuis plantés (coupe, demi-tour)
  freinGeste: 9,                    // m/s² : un geste sur place (passe, frappe, contrôle arrêtés) : l'ancien freinage planté
  aLat: 18,                         // m/s² : accélération latérale max ; rayon r(v) = v² / aLat
  lacetMax: 16,                     // rad/s : rotation de la course à l'arrêt ; ω = min(16, aLat / v)
  capMax: 12,                       // rad/s : rotation du buste (orientation), indépendante de la vitesse
  pivotAngle: (110 * Math.PI) / 180, pivotVitesse: 2.8, pivotEntree: 3.4,
  pivotTaux: 2.2, pivotSortie: 4.2, // le demi-tour lancé : turn180 joué 2,2 fois (0,3 s), reparti à 4,2 m/s (avant 1,3 et 2,5)
  balleV: 0.90, balleLat: 0.85,     // pénalités balle au pied (vitesse max, accélération latérale)
  retourDes: 1.5,                   // 1/s : le déséquilibre revient vers 0
  impDes: 1.6,                      // m/s : impulsion (par unité de masse) d'un déséquilibre complet
  trebuche: 0.65, chute: 1.0,       // seuils de déséquilibre
  solChute: 0.9,                    // s au sol après une chute, avant le relevé
  freinGlissade: 7.5,               // m/s² : le tacle glissé sur le gazon (bola-app#26 ; correctifs : 4,5 → 7,5, ~0,9 s et ~3 m au lieu de 1,3 s et 5,4 m)
  vGlissade: [3.2, 7.6],               // m/s : la vitesse de la glissade au départ (bornes ; bola-app#32, lot A2 : 1,2 + 0,95 × la course, 7 avant)
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

// ── le ballon contre les corps (personne n'est traversé : jambes, buste, corps au sol) ──
export const BALLE_CORPS = {
  jambes: [0, 0.9, 0.14],           // capsule verticale : du sol à 0,9 m, rayon 0,14 m
  buste: [0.9, 1.6, 0.2],           // de 0,9 à 1,6 m, rayon 0,2 m
  sol: [0.8, 0.15, 0.15],           // au sol : couché le long du cap, demi-longueur 0,8 m, à 0,15 m de haut, rayon 0,15 m
  releve: [0, 0.7, 0.18],           // pendant le relevé
  e: 0.3, mu: 0.5,                  // restitution, frottement tangent (part de l'impulsion normale)
  ignore: 0.15,                     // s : le joueur qui vient de toucher la balle ne la gêne pas
};

// ── le jeu de balle ──
export const JEU = {
  porteeFrappe: 0.30,               // m : du pied qui frappe au centre du ballon, à l'impact
  porteeTouche: 0.25,               // m : du pied prévu (table des pieds du clip de course) au centre du ballon
  porteeControle: 0.35,             // m : du pied (ou de la cuisse, du buste) le plus proche au centre du ballon
  touche: { thetaMax: [35, 25, 18, 12] }, // écart max de la touche à la course de la balle : pas, trot, course, sprint (°)
  passeV0: [6, 12],                 // v0 = 6 + 12 p
  frappeV0: [14, 16],               // v0 = 14 + 16 p
  finesseV0: [12, 8],
  exterieurV0: [13, 11],            // (bola-app#26) la frappe de l'extérieur du pied : un peu moins forte, l'effet inverse
  jauge: 0.9,                       // s : la jauge de puissance monte de 0 à 1
  // (bola-app#32, lot A) l'appui bref, l'élan et la charge : un appui de moins de 0,15 s part avec la puissance juste ;
  // l'élan démarre à l'appui, son impact tombe 0,13 s après (rapide), ou 0,05 s après le relâché d'une charge (l'élan
  // est tenu armé tant que la touche est tenue) ; frappe parfaite : un second appui de la frappe à 0,07 s de l'impact
  bref: 0.15, rapide: 0.13, arme: 0.05, parfait: 0.07,
  // (lot A) les passes au sol dosées sur la distance : elles arrivent au receveur à 9 m/s (v0 = √(va² + 2 a d), a le
  // roulement et l'air) ; chargées, la jauge règle la dose de 0,6 à 1,6 fois ; la passe puissante 1,4 fois
  passeArrivee: 9, passeRoule: 1.35, passeDose: [0.6, 1.0], passePuissante: 1.4,
  // (lot A) la balle aimantée : tenue à un point devant le pied (0,36 m arrêté + 0,06 s × v), dans la direction du
  // stick ; ce point tourne autour du joueur à 14 rad/s au plus, la balle y est ramenée par un ressort (16/s) ; elle se
  // perd au-delà de 1,4 m ; une balle libre au sol se prend à 1,2 m (l'IA d'elle-même, l'humain avec ○ / B, 2,5 m)
  aimant: { pres: 0.36, loin: 0.06, rotation: 14, raideur: 16, ecart: 5, rayon: 1.4, prise: 1.2, prendre: 2.5, garde: 1.0 },
  aide: { pouce: 1, manette: 0.5, ia: 0 },
  coneAide: { pouce: (45 * Math.PI) / 180, manette: (30 * Math.PI) / 180 },
  duree: 150,                       // s : un match
  engagement: 1.1, intro: 1.6, butPause: 3.2,
  // (bola-app#26, lot 2) les fautes légères, avec l'avantage : RÈGLE BOLA À FAIRE VALIDER PAR SABRI (jusqu'ici, aucune
  // faute sifflée, décision de #23). false = plus aucune faute (le jeu redevient celui de #23 : la chute suffit).
  fautes: true,
  avantage: 2.5,                    // s : l'équipe fautée garde (ou reprend) la balle dans ce délai : l'avantage joue
  coupFranc: { pause: 1.2, distance: 3, garde: 2.5 }, // s de pause balle posée ; m des adversaires ; s au plus pour les tenir à distance
};

// ── les duels (bola-app#26, lot 2) ──
export const DUELS = {
  // le tirage de maillot : un défenseur collé derrière le porteur (moins de 0,75 m entre les centres) qui le tient
  tirage: { portee: 0.78, frein: 0.15, desPorteur: 2.0, desTireur: 1.8, faute: 0.8, repos: 1.5 }, // (des : par seconde, contre le retour de 1,5/s)
  // la protection : le porteur qui protège recule dans le défenseur collé dans son dos (N), et le déséquilibre un peu
  dos: { force: 420, des: 2.2 },     // (des : par seconde)
  // le tacle debout contré : la balle sous le pied du porteur (moins de 0,42 m), les deux pieds la touchent ensemble
  // (bola-app#32 : la balle aimantée se tient à 0,36-0,5 m devant le pied au pas ; « sous le pied » va jusqu'à 0,52 m, avant
  // 0,42 ; lot A2, point 15 : l'issue ne se tire plus au sort (une fois sur deux avant) — le défenseur pile dans l'axe du
  // porteur, à moins de 10° (axe : cosinus), rencontre son pied sur la balle : contrée ; un peu de côté, il la prend)
  contre: { pied: 0.52, axe: 0.985 },
};

export const ROLES = ['G', 'D', 'L', 'R', 'A'];
/** la formation : x (m) et profondeur f (-1 = sa ligne de but, 1 = celle d'en face), sans la balle */
export const FORMATION = { D: [0, -0.56], L: [-4.6, -0.12], R: [4.6, -0.12], A: [0, 0.32] };
export const ENGAGEMENT = { D: [0, -0.62], L: [-5, -0.28], R: [5, -0.28], A: [0, -0.24] };

/** le sens d'attaque d'une équipe, en z : les Noirs (0) montent vers -z, les Blancs (1) descendent vers +z */
export const sens = (e) => (e === 0 ? -1 : 1);
/** le z de la ligne du but que défend l'équipe e */
export const butDe = (e) => -sens(e) * LB;
