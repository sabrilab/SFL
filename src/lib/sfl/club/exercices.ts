// Bola Club : la bibliothèque d'exercices de Bola, celle que chaque club
// trouve en arrivant, et le programme d'une séance (une suite d'exercices,
// chacun avec ses minutes). Tous les textes sont écrits pour Bola : aucun
// n'est repris d'un livre, d'un site ou d'un dépôt (le 27/11/2026, aucune base
// ouverte d'exercices de foot ne se réutilisait dans une app payante sans
// partager à son tour ce qu'on en tire, CC BY-SA). Une idée d'exercice ne se
// protège pas, un texte si : ceux-ci appartiennent à Bola.
//
// Un club ajoute les siens (club.exercices, mutations.ts : creerExercice) ;
// ils se lisent à côté de ceux de Bola, dans la même liste. Pur.

import type { Club, Exercice, Qualite, ThemeExercice } from "./types";

export const THEMES: { id: ThemeExercice; label: string }[] = [
  { id: "echauffement", label: "Échauffement" },
  { id: "technique", label: "Technique" },
  { id: "jeu", label: "Jeu réduit" },
  { id: "finition", label: "Finition" },
  { id: "motricite", label: "Motricité" },
  { id: "physique", label: "Vitesse et endurance" },
  { id: "renforcement", label: "Renforcement" },
  { id: "gardien", label: "Gardiens" },
  { id: "retour", label: "Récupération" },
];

export const QUALITES: { id: Qualite; label: string }[] = [
  { id: "technique", label: "Technique" },
  { id: "tactique", label: "Jeu collectif" },
  { id: "finition", label: "Finition" },
  { id: "motricite", label: "Motricité" },
  { id: "vitesse", label: "Vitesse" },
  { id: "vma", label: "VMA" },
  { id: "endurance", label: "Endurance" },
  { id: "renforcement", label: "Renforcement" },
  { id: "prevention", label: "Prévention" },
  { id: "bienetre", label: "Bien-être" },
];

/** Les qualités d'un thème, pour un exercice qui ne dit pas les siennes (ceux qu'un club écrit). */
const PAR_THEME: Record<ThemeExercice, Qualite[]> = {
  echauffement: ["technique", "prevention"],
  motricite: ["motricite"],
  technique: ["technique"],
  jeu: ["tactique", "endurance"],
  finition: ["finition"],
  physique: ["vitesse", "endurance"],
  renforcement: ["renforcement", "prevention"],
  gardien: ["technique"],
  retour: ["bienetre"],
};
export const qualitesDe = (e: Exercice): Qualite[] => e.qualites ?? PAR_THEME[e.theme];
export const agesDe = (e: Exercice): [number, number] => e.ages ?? [6, 99];

/**
 * Ce que chaque exercice de Bola travaille, à quel âge, et s'il « tape »
 * (sauts, sprints à fond, frappes puissantes). Les âges suivent les repères
 * réunis le 27/11/2026 (doc « Espace entraîneur Bola Club ») : endurance par le
 * jeu avant 12 ans, VMA par intermittent à partir de 12, renforcement au poids
 * du corps avant la fin de la croissance, charges légères et encadrées à partir de 16.
 */
const META: Record<string, Pick<Exercice, "ages" | "qualites" | "impact">> = {
  "b-rondo-4c1": { ages: [8, 99], qualites: ["technique", "tactique"] },
  "b-passe-et-suis": { ages: [7, 99], qualites: ["technique"] },
  "b-mobilite-ballon": { ages: [6, 99], qualites: ["motricite", "prevention"] },
  "b-chat-ballon": { ages: [6, 13], qualites: ["technique", "motricite"] },
  "b-controle-oriente": { ages: [9, 99], qualites: ["technique"] },
  "b-conduite-slalom": { ages: [6, 12], qualites: ["technique", "motricite"] },
  "b-une-deux": { ages: [9, 99], qualites: ["technique", "tactique"] },
  "b-jeu-long": { ages: [12, 99], qualites: ["technique"] },
  // Peu de jeu de tête chez les jeunes (UEFA) : à partir de 14 ans dans les séances proposées.
  "b-tete": { ages: [14, 99], qualites: ["technique"] },
  "b-dribble-1c1": { ages: [7, 99], qualites: ["technique", "vitesse"] },
  "b-conservation-5c5": { ages: [10, 99], qualites: ["tactique", "endurance"] },
  "b-match-4-buts": { ages: [8, 99], qualites: ["tactique", "endurance"] },
  "b-transition-3c2": { ages: [10, 99], qualites: ["tactique", "vitesse", "finition"] },
  "b-pressing-6s": { ages: [12, 99], qualites: ["tactique", "endurance"] },
  "b-match-theme": { ages: [6, 99], qualites: ["tactique"] },
  "b-sortie-de-balle": { ages: [12, 99], qualites: ["tactique", "technique"] },
  "b-frappe-apres-controle": { ages: [8, 99], qualites: ["finition", "technique"], impact: true },
  "b-centre-reprise": { ages: [10, 99], qualites: ["finition"], impact: true },
  "b-face-au-gardien": { ages: [8, 99], qualites: ["finition"] },
  "b-duel-surface": { ages: [10, 99], qualites: ["finition", "tactique"] },
  "b-vitesse-reaction": { ages: [8, 99], qualites: ["vitesse"], impact: true },
  "b-intermittent": { ages: [12, 99], qualites: ["vma", "endurance"] },
  "b-appuis-echelle": { ages: [8, 99], qualites: ["motricite", "vitesse"] },
  "b-gainage": { ages: [11, 99], qualites: ["renforcement", "prevention"] },
  "b-gardien-prise": { ages: [8, 99], qualites: ["technique"] },
  "b-gardien-sorties": { ages: [10, 99], qualites: ["technique"], impact: true },
  "b-gardien-relance": { ages: [10, 99], qualites: ["technique"] },
  "b-etirements": { ages: [6, 99], qualites: ["bienetre"] },
  "b-tirs-au-but": { ages: [6, 99], qualites: ["finition", "bienetre"] },
  "b-cercle": { ages: [6, 99], qualites: ["bienetre"] },
};

export const themeDit = (t: ThemeExercice) =>
  THEMES.find((x) => x.id === t)?.label ?? t;

const ex = (e: Omit<Exercice, "origine">): Exercice => ({ ...META[e.id], ...e, origine: "bola" });

/** La bibliothèque de Bola : 47 exercices, du plus simple au plus joué, thème par thème. */
export const BIBLIOTHEQUE: readonly Exercice[] = [
  // Échauffement
  ex({
    id: "b-rondo-4c1",
    nom: "Rondo 4 contre 1",
    theme: "echauffement",
    minutes: 10,
    joueurs: [5, 10],
    espace: "Carré de 8 × 8 m",
    materiel: "4 plots, 1 ballon par carré",
    but: "Toucher beaucoup de ballons, la tête haute, dès l'arrivée.",
    deroule: [
      "Quatre joueurs sur les côtés du carré, un au milieu.",
      "Deux touches au plus. Le milieu qui touche le ballon prend la place du passeur.",
      "Dix passes de suite : le milieu reste une fois de plus.",
    ],
    variante:
      "Une touche pour les plus à l'aise, deux joueurs au milieu à 5 contre 2.",
  }),
  ex({
    id: "b-passe-et-suis",
    nom: "Passe et suis en carré",
    theme: "echauffement",
    minutes: 10,
    joueurs: [8, 16],
    espace: "Carré de 12 × 12 m",
    materiel: "4 plots, 2 ballons",
    but: "Mettre le corps en route avec la passe, le contrôle et la course.",
    deroule: [
      "Une file à chaque plot, deux ballons qui partent de coins opposés.",
      "Je passe au plot suivant, je cours derrière mon ballon et je prends la file.",
      "Changer de sens toutes les deux minutes.",
    ],
    variante: "Contrôle orienté obligatoire, ou passe de l'autre pied.",
  }),
  ex({
    id: "b-mobilite-ballon",
    nom: "Mobilité avec ballon",
    theme: "echauffement",
    minutes: 8,
    joueurs: [1, 30],
    espace: "Une largeur de terrain",
    materiel: "1 ballon par joueur",
    but: "Ouvrir les hanches et les chevilles sans perdre le contact du ballon.",
    deroule: [
      "Aller en conduite légère, retour en pas chassés en roulant le ballon sous la semelle.",
      "Ouverture et fermeture de hanche à chaque plot.",
      "Finir par deux accélérations de 10 m, ballon au pied.",
    ],
  }),
  ex({
    id: "b-chat-ballon",
    nom: "Le chat au ballon",
    theme: "echauffement",
    minutes: 8,
    joueurs: [8, 20],
    espace: "Rectangle de 20 × 20 m",
    materiel: "1 ballon par joueur, 3 chasubles",
    but: "Conduire en levant les yeux, protéger son ballon.",
    deroule: [
      "Chaque joueur conduit son ballon ; trois chats en chasuble, sans ballon.",
      "Un chat qui sort un ballon du carré prend la chasuble de sa victime.",
      "Manches de 90 secondes.",
    ],
    variante:
      "Chats avec ballon : ils doivent toucher le ballon adverse avec le leur.",
  }),

  // Technique
  ex({
    id: "b-controle-oriente",
    nom: "Contrôle orienté en triangle",
    theme: "technique",
    minutes: 12,
    joueurs: [6, 12],
    espace: "Triangle de 10 m de côté",
    materiel: "3 plots, 1 ballon par triangle",
    but: "Recevoir déjà tourné vers la suite du jeu.",
    deroule: [
      "Deux joueurs par plot. Je reçois, je contrôle vers le plot suivant, je passe.",
      "Le contrôle et la passe se font en deux touches, jamais trois.",
      "Changer de sens et de pied à la moitié.",
    ],
    variante:
      "Un défenseur passif au milieu qui ferme un côté : je contrôle de l'autre.",
  }),
  ex({
    id: "b-conduite-slalom",
    nom: "Conduite et slalom en relais",
    theme: "technique",
    minutes: 10,
    joueurs: [6, 20],
    espace: "Couloirs de 20 m",
    materiel: "6 plots par couloir, 1 ballon par équipe",
    but: "Garder le ballon près du pied en changeant de direction.",
    deroule: [
      "Une équipe par couloir. Slalom à l'aller, conduite rapide au retour.",
      "Le ballon passe à la main du suivant : pas de départ avant.",
      "Trois manches, l'équipe qui perd range les plots.",
    ],
    variante:
      "Pied faible seulement, ou intérieur puis extérieur à chaque plot.",
  }),
  ex({
    id: "b-une-deux",
    nom: "Une-deux et appel",
    theme: "technique",
    minutes: 12,
    joueurs: [6, 14],
    espace: "Couloir de 25 × 10 m",
    materiel: "Plots, 2 ballons",
    but: "Donner et partir aussitôt dans le dos.",
    deroule: [
      "Un appui fixe au milieu du couloir.",
      "Je passe à l'appui, je pars en course, il me remet dans la course.",
      "Je finis par une passe au premier de la file d'en face.",
    ],
    variante: "Appui actif qui choisit : remise ou passe dans la course.",
  }),
  ex({
    id: "b-jeu-long",
    nom: "Jeu long sur zone",
    theme: "technique",
    minutes: 12,
    joueurs: [6, 12],
    espace: "Deux carrés de 10 m à 30 m l'un de l'autre",
    materiel: "8 plots, 3 ballons",
    but: "Changer le jeu de loin, et recevoir un ballon qui tombe du ciel.",
    deroule: [
      "Trois joueurs par carré.",
      "Deux passes courtes dans mon carré, puis un ballon long vers l'autre.",
      "Le ballon long doit tomber dans le carré : un point par ballon contrôlé dedans.",
    ],
  }),
  ex({
    id: "b-tete",
    nom: "Jeu de tête à trois",
    theme: "technique",
    minutes: 8,
    joueurs: [3, 15],
    espace: "Un coin de terrain",
    materiel: "1 ballon par trio",
    but: "Frapper le ballon du front, les yeux ouverts.",
    deroule: [
      "Un lanceur, un joueur de tête, un receveur en ligne.",
      "Le lanceur sert à la main, la tête remet au receveur.",
      "Rotation tous les huit ballons.",
    ],
    variante: "Tête en suspension après deux pas d'élan.",
  }),
  ex({
    id: "b-dribble-1c1",
    nom: "1 contre 1 face à face",
    theme: "technique",
    minutes: 12,
    joueurs: [6, 16],
    espace: "Couloir de 15 × 10 m, deux mini-buts",
    materiel: "2 mini-buts, plots, ballons",
    but: "Oser éliminer, et défendre sans se jeter.",
    deroule: [
      "Une file de chaque côté. Le défenseur passe le ballon à l'attaquant et sort.",
      "L'attaquant marque dans le mini-but, le défenseur dans celui d'en face s'il récupère.",
      "On garde son rôle trois fois puis on change.",
    ],
  }),

  // Jeu réduit
  ex({
    id: "b-conservation-5c5",
    nom: "Conservation 5 contre 5 + 2 jokers",
    theme: "jeu",
    minutes: 15,
    joueurs: [10, 14],
    espace: "Rectangle de 30 × 25 m",
    materiel: "Chasubles de 3 couleurs, ballons",
    but: "Garder le ballon en équipe : appuis, soutiens, écarter.",
    deroule: [
      "Deux équipes de cinq, deux jokers qui jouent avec celle qui a le ballon.",
      "Dix passes de suite : un point.",
      "Les jokers jouent en deux touches, les autres sont libres.",
    ],
    variante:
      "Le point compte seulement si le ballon passe par les deux jokers.",
  }),
  ex({
    id: "b-match-4-buts",
    nom: "Match à quatre buts",
    theme: "jeu",
    minutes: 15,
    joueurs: [8, 14],
    espace: "Terrain de 35 × 25 m, deux mini-buts par côté",
    materiel: "4 mini-buts, chasubles",
    but: "Voir le côté libre et changer de côté vite.",
    deroule: [
      "Chaque équipe attaque deux mini-buts, aux deux coins d'en face.",
      "Un but marqué après un changement de côté vaut double.",
      "Manches de quatre minutes, une minute de repos.",
    ],
  }),
  ex({
    id: "b-transition-3c2",
    nom: "3 contre 2, puis 2 contre 1 au retour",
    theme: "jeu",
    minutes: 15,
    joueurs: [9, 15],
    espace: "Demi-terrain, deux buts",
    materiel: "2 buts, 2 gardiens, ballons",
    but: "Finir vite le surnombre, puis se replacer.",
    deroule: [
      "Trois attaquants partent contre deux défenseurs.",
      "Dès que l'action finit, les deux défenseurs repartent à 2 contre 1 vers l'autre but.",
      "Le premier attaquant qui a tiré redescend défendre.",
    ],
  }),
  ex({
    id: "b-pressing-6s",
    nom: "Récupérer en six secondes",
    theme: "jeu",
    minutes: 15,
    joueurs: [10, 16],
    espace: "Rectangle de 30 × 30 m",
    materiel: "Chasubles, ballons",
    but: "Presser tout de suite à la perte du ballon.",
    deroule: [
      "Jeu à 5 contre 5 sans but : on garde le ballon.",
      "Une équipe qui récupère le ballon moins de six secondes après l'avoir perdu marque un point.",
      "L'entraîneur compte à voix haute.",
    ],
  }),
  ex({
    id: "b-match-theme",
    nom: "Match à thème",
    theme: "jeu",
    minutes: 20,
    joueurs: [10, 22],
    espace: "Demi-terrain ou terrain réduit",
    materiel: "2 buts, chasubles",
    but: "Remettre dans le jeu ce qu'on vient de travailler.",
    deroule: [
      "Match libre, avec une seule consigne : celle de la séance.",
      "Un but qui suit la consigne vaut double (une-deux, centre, récupération haute…).",
      "Arrêter le jeu au plus deux fois pour corriger.",
    ],
  }),
  ex({
    id: "b-sortie-de-balle",
    nom: "Sortie de balle à 4 contre 3",
    theme: "jeu",
    minutes: 15,
    joueurs: [8, 12],
    espace: "Tiers de terrain, une ligne à atteindre",
    materiel: "1 but, 1 gardien, plots",
    but: "Relancer proprement depuis le gardien malgré la pression.",
    deroule: [
      "Le gardien et quatre joueurs contre trois attaquants.",
      "Un point en passant la ligne ballon au pied ; trois attaquants qui marquent valent deux.",
      "Changer les rôles toutes les cinq minutes.",
    ],
  }),

  // Finition
  ex({
    id: "b-frappe-apres-controle",
    nom: "Contrôle et frappe",
    theme: "finition",
    minutes: 12,
    joueurs: [6, 14],
    espace: "Entrée de la surface",
    materiel: "1 but, 1 gardien, ballons",
    but: "Cadrer après un contrôle qui ouvre l'angle.",
    deroule: [
      "Un passeur dos au but, une file face à lui à 20 m du but.",
      "Je demande, je reçois, je contrôle d'un côté et je frappe en deux touches.",
      "Changer de côté pour frapper de l'autre pied.",
    ],
  }),
  ex({
    id: "b-centre-reprise",
    nom: "Centre et reprise",
    theme: "finition",
    minutes: 15,
    joueurs: [8, 16],
    espace: "Un côté du terrain et la surface",
    materiel: "1 but, 1 gardien, ballons",
    but: "Centrer en retrait et attaquer les deux poteaux.",
    deroule: [
      "Un ailier part du rond central, deux attaquants partent du milieu.",
      "L'ailier déborde et centre ; un attaquant au premier poteau, l'autre au second.",
      "Ajouter un défenseur passif quand ça marche.",
    ],
  }),
  ex({
    id: "b-face-au-gardien",
    nom: "Face au gardien",
    theme: "finition",
    minutes: 10,
    joueurs: [6, 16],
    espace: "Demi-terrain",
    materiel: "1 but, 1 gardien, ballons",
    but: "Garder son calme seul face au gardien.",
    deroule: [
      "Départ du rond central en conduite, le gardien sort.",
      "Un défenseur part trois mètres derrière pour mettre de la pression.",
      "Dribbler le gardien ou frapper : le joueur choisit.",
    ],
  }),
  ex({
    id: "b-duel-surface",
    nom: "Duels dans la surface",
    theme: "finition",
    minutes: 12,
    joueurs: [8, 16],
    espace: "Surface de réparation",
    materiel: "1 but, 1 gardien, chasubles, ballons",
    but: "Frapper vite dans un petit espace.",
    deroule: [
      "2 contre 2 dans la surface, l'entraîneur sert de l'extérieur.",
      "Une frappe en moins de cinq secondes après la passe, sinon le ballon passe à l'autre équipe.",
      "Manches d'une minute, on tourne.",
    ],
  }),

  // Physique
  ex({
    id: "b-vitesse-reaction",
    nom: "Vitesse de réaction",
    theme: "physique",
    minutes: 10,
    joueurs: [2, 20],
    espace: "Couloirs de 15 m",
    materiel: "Plots",
    but: "Partir au signal, le plus vite possible.",
    deroule: [
      "Deux joueurs côte à côte, assis, couchés ou dos à la course.",
      "Au signal de l'entraîneur (voix, main levée), sprint jusqu'au plot.",
      "Huit départs, une récupération complète à chaque fois.",
    ],
  }),
  ex({
    id: "b-intermittent",
    nom: "Intermittent 15-15",
    theme: "physique",
    minutes: 12,
    joueurs: [1, 30],
    espace: "Une largeur de terrain",
    materiel: "Plots tous les 10 m",
    but: "Tenir l'effort du match, par vagues courtes.",
    deroule: [
      "15 secondes de course rapide, 15 secondes de marche.",
      "Deux blocs de cinq minutes, trois minutes de repos entre les deux.",
      "Chacun choisit son plot d'arrivée et le garde tout le bloc.",
    ],
    variante:
      "Avec ballon pour les plus jeunes : conduite rapide au lieu de la course.",
  }),
  ex({
    id: "b-appuis-echelle",
    nom: "Appuis et changements de direction",
    theme: "physique",
    minutes: 10,
    joueurs: [1, 20],
    espace: "Parcours de 15 m",
    materiel: "Échelle de rythme ou plots, cerceaux",
    but: "Des pieds rapides et des appuis propres.",
    deroule: [
      "Échelle en pas courts, puis slalom serré entre quatre plots.",
      "Finir par une passe dans un mini-but.",
      "Marche retour : c'est la récupération.",
    ],
  }),
  ex({
    id: "b-gainage",
    nom: "Gainage et prévention",
    theme: "renforcement",
    minutes: 10,
    joueurs: [1, 30],
    espace: "Au bord du terrain",
    materiel: "Aucun",
    but: "Protéger le dos, les genoux et les adducteurs.",
    deroule: [
      "Planche, planche de côté, pont fessier : 30 secondes chacun.",
      "Fentes avant et latérales, dix de chaque côté.",
      "Deux tours. Pas pour les moins de 11 ans : jeux d'équilibre à la place.",
    ],
  }),

  // Gardiens
  ex({
    id: "b-gardien-prise",
    nom: "Prise de balle et plongeon",
    theme: "gardien",
    minutes: 15,
    joueurs: [1, 3],
    espace: "Le but",
    materiel: "Ballons, plots",
    but: "Bloquer le ballon, puis plonger sur les côtés.",
    deroule: [
      "Ballons à la main : ventre, poitrine, au-dessus de la tête.",
      "Tirs au sol à un mètre, puis à deux mètres, de chaque côté.",
      "Se relever vite après chaque plongeon.",
    ],
  }),
  ex({
    id: "b-gardien-sorties",
    nom: "Sorties aériennes",
    theme: "gardien",
    minutes: 12,
    joueurs: [1, 3],
    espace: "La surface",
    materiel: "Ballons, un joueur qui centre",
    but: "Sortir au bon moment et capter au point le plus haut.",
    deroule: [
      "Centres à la main, puis au pied, des deux côtés.",
      "Le gardien annonce « Gardien ! » à chaque sortie.",
      "Ajouter un attaquant qui gêne quand la prise est sûre.",
    ],
  }),
  ex({
    id: "b-gardien-relance",
    nom: "Relance au pied et à la main",
    theme: "gardien",
    minutes: 10,
    joueurs: [1, 6],
    espace: "Demi-terrain",
    materiel: "Ballons, 3 mini-buts ou plots",
    but: "Relancer juste et vite après un arrêt.",
    deroule: [
      "Trois cibles à 15, 25 et 40 m.",
      "L'entraîneur tire, le gardien capte et relance vers la cible qu'il annonce.",
      "À la main pour la cible courte, au pied pour les autres.",
    ],
  }),

  // Retour au calme
  ex({
    id: "b-etirements",
    nom: "Étirements doux",
    theme: "retour",
    minutes: 8,
    joueurs: [1, 30],
    espace: "Au centre du terrain",
    materiel: "Aucun",
    but: "Faire redescendre le cœur et relâcher les jambes.",
    deroule: [
      "Footing très lent sur une largeur, puis marche.",
      "Mollets, cuisses, adducteurs : 20 secondes chacun, sans à-coups.",
      "Respiration lente pour finir.",
    ],
  }),
  ex({
    id: "b-tirs-au-but",
    nom: "Concours de tirs au but",
    theme: "retour",
    minutes: 8,
    joueurs: [6, 30],
    espace: "Le point de penalty",
    materiel: "1 but, 1 gardien, ballons",
    but: "Finir la séance sur un sourire.",
    deroule: [
      "Chacun tire une fois ; celui qui marque reste en course.",
      "Le dernier en course choisit le jeu de la prochaine séance.",
    ],
  }),
  ex({
    id: "b-cercle",
    nom: "Le mot de la fin",
    theme: "retour",
    minutes: 5,
    joueurs: [1, 30],
    espace: "En cercle",
    materiel: "Aucun",
    but: "Dire ce qu'on a appris et ce qui vient.",
    deroule: [
      "Un joueur dit ce qu'il retient de la séance.",
      "L'entraîneur donne le rendez-vous suivant : jour, heure, lieu.",
    ],
  }),

  // Prévention, motricité
  ex({
    id: "b-echauffement-prevention",
    nom: "Échauffement prévention",
    theme: "echauffement",
    minutes: 15,
    joueurs: [1, 30],
    espace: "Deux lignes de plots à 20 m",
    materiel: "Plots",
    but: "Préparer genoux, chevilles et cuisses avant l'effort : moins de blessures.",
    deroule: [
      "Course lente aller-retour, avec ouverture et fermeture de hanche, pas chassés, talons-fesses.",
      "Gainage : 2 × 20 secondes face au sol, puis de chaque côté.",
      "Équilibre sur une jambe, genou au-dessus du pied, 20 secondes par jambe, puis en se passant un ballon.",
      "Petits sauts avec réception douce, genoux qui ne rentrent pas ; finir par deux accélérations progressives.",
    ],
    variante: "Pour les 7-12 ans : en jeu, sur des parcours, avec un ballon à chaque atelier.",
    ages: [7, 99],
    qualites: ["prevention", "motricite"],
  }),
  ex({
    id: "b-parcours-motricite",
    nom: "Parcours de motricité",
    theme: "motricite",
    minutes: 12,
    joueurs: [4, 16],
    espace: "Un parcours de 15 m",
    materiel: "Cerceaux, plots, haies basses, ballons",
    but: "Courir, sauter, tourner, s'équilibrer : les bases de tous les gestes.",
    deroule: [
      "Cerceaux à cloche-pied, slalom, passage sous une haie basse, roulade ou appui au sol.",
      "Finir par une passe dans un mini-but.",
      "Changer l'ordre des ateliers à chaque passage.",
    ],
    variante: "Ballon à la main, puis au pied sur tout le parcours.",
    ages: [6, 10],
    qualites: ["motricite"],
  }),
  ex({
    id: "b-jonglerie-defis",
    nom: "Défis de jonglerie",
    theme: "motricite",
    minutes: 8,
    joueurs: [1, 30],
    espace: "Libre",
    materiel: "1 ballon par joueur",
    but: "Apprivoiser le ballon avec toutes les surfaces.",
    deroule: [
      "Pied droit, pied gauche, cuisse, tête : un rebond au sol permis pour les plus jeunes.",
      "Chacun note son record et essaie de le battre.",
    ],
    ages: [6, 15],
    qualites: ["motricite", "technique"],
  }),
  ex({
    id: "b-equilibre-duels",
    nom: "Duels d'équilibre",
    theme: "motricite",
    minutes: 8,
    joueurs: [2, 30],
    espace: "Par deux",
    materiel: "Aucun",
    but: "Tenir ses appuis au contact, sans se blesser.",
    deroule: [
      "Face à face sur une jambe, mains contre mains : faire poser le pied de l'autre.",
      "Épaule contre épaule, en marchant, puis en trottinant.",
    ],
    ages: [7, 14],
    qualites: ["motricite", "prevention"],
  }),

  // Vitesse et endurance
  ex({
    id: "b-test-vma",
    nom: "Test VMA de 6 minutes",
    theme: "physique",
    minutes: 15,
    joueurs: [1, 30],
    espace: "Une piste ou un tour de terrain balisé tous les 25 m",
    materiel: "Plots, chronomètre",
    but: "Mesurer la VMA de chacun pour régler les allures de l'intermittent.",
    deroule: [
      "Dix minutes d'échauffement progressif.",
      "Six minutes de course, le plus loin possible, à allure régulière.",
      "VMA en km/h = distance en mètres ÷ 100. La noter sur la fiche du joueur.",
    ],
    variante: "Deux à trois fois par saison : reprise, mi-saison, fin de saison.",
    ages: [12, 99],
    qualites: ["vma"],
  }),
  ex({
    id: "b-intermittent-30-30",
    nom: "Intermittent 30-30 à la VMA",
    theme: "physique",
    minutes: 15,
    joueurs: [1, 30],
    espace: "Une ligne droite, un plot par joueur à sa distance",
    materiel: "Plots, sifflet",
    but: "Élever la VMA en tenant des courses à vitesse maximale aérobie.",
    deroule: [
      "30 secondes à 100 % de sa VMA (distance = VMA en km/h × 8,3 m), 30 secondes de marche.",
      "Deux séries de 6 minutes, 3 minutes de récupération entre les deux.",
      "Chacun court jusqu'à son plot : les plus rapides ne tirent pas les autres.",
    ],
    ages: [13, 99],
    qualites: ["vma", "endurance"],
    impact: true,
  }),
  ex({
    id: "b-repetition-sprints",
    nom: "Répétition de sprints à 5",
    theme: "physique",
    minutes: 12,
    joueurs: [2, 20],
    espace: "20 m, deux changements de direction",
    materiel: "Plots",
    but: "Répéter les efforts courts du foot à 5, 6 ou 7.",
    deroule: [
      "Sprint de 20 m avec un demi-tour au milieu, 25 secondes de récupération active.",
      "Six répétitions, trois minutes de pause, puis une seconde série.",
    ],
    ages: [14, 99],
    qualites: ["vitesse", "vma"],
    impact: true,
  }),
  ex({
    id: "b-jeu-endurance",
    nom: "Jeu d'endurance à 4 contre 4",
    theme: "jeu",
    minutes: 20,
    joueurs: [8, 12],
    espace: "Terrain de 30 × 20 m, deux buts",
    materiel: "2 buts ou mini-buts, chasubles",
    but: "Travailler l'endurance avec le ballon, sans courir pour courir.",
    deroule: [
      "Quatre périodes de 4 minutes, 2 minutes de récupération.",
      "Ballons tout autour pour relancer vite : le jeu ne s'arrête pas.",
      "Les remplaçants font les appuis sur les côtés.",
    ],
    ages: [10, 99],
    qualites: ["endurance", "tactique"],
  }),
  ex({
    id: "b-relais-vitesse",
    nom: "Relais de vitesse",
    theme: "physique",
    minutes: 10,
    joueurs: [6, 24],
    espace: "Couloirs de 15 m",
    materiel: "Plots, ballons",
    but: "Aller vite en jouant, sans s'épuiser.",
    deroule: [
      "Équipes de 3 ou 4. Aller en sprint, retour en conduite de balle.",
      "Départs variés : assis, dos tourné, au signal visuel.",
      "Une récupération complète entre deux passages.",
    ],
    ages: [7, 14],
    qualites: ["vitesse", "motricite"],
  }),
  ex({
    id: "b-match-5c5-intermittent",
    nom: "Foot à 5 en blocs courts",
    theme: "jeu",
    minutes: 20,
    joueurs: [10, 15],
    espace: "Terrain de foot à 5 (40 × 20 m)",
    materiel: "2 buts, chasubles",
    but: "Jouer à l'intensité d'un vrai match à 5.",
    deroule: [
      "Blocs de 3 minutes à fond, 2 minutes de récupération.",
      "Une équipe de trois sort et entre à chaque bloc.",
      "Règles du foot à 5 : pas de contact au gardien, rentrée au pied.",
    ],
    ages: [14, 99],
    qualites: ["tactique", "vma"],
  }),

  // Renforcement
  ex({
    id: "b-circuit-poids-corps",
    nom: "Circuit au poids du corps",
    theme: "renforcement",
    minutes: 15,
    joueurs: [1, 30],
    espace: "Six ateliers au bord du terrain",
    materiel: "Plots",
    but: "Renforcer tout le corps, sans charge.",
    deroule: [
      "Squats, fentes, pompes (genoux au sol si besoin), gainage, pont fessier, montées de genoux.",
      "30 secondes par atelier, 30 secondes pour changer : deux tours.",
      "Le geste propre avant la vitesse.",
    ],
    ages: [11, 99],
    qualites: ["renforcement", "prevention"],
  }),
  ex({
    id: "b-ischios-nordiques",
    nom: "Ischios nordiques",
    theme: "renforcement",
    minutes: 8,
    joueurs: [2, 30],
    espace: "Par deux, sur l'herbe ou un tapis",
    materiel: "Aucun",
    but: "Protéger l'arrière des cuisses, la blessure la plus fréquente en foot.",
    deroule: [
      "À genoux, un partenaire tient les chevilles. Descendre le buste lentement, le dos droit.",
      "Se rattraper avec les mains, remonter en poussant.",
      "3 à 5 répétitions au début, jusqu'à 2 × 8 en quelques semaines.",
    ],
    ages: [14, 99],
    qualites: ["renforcement", "prevention"],
  }),
  ex({
    id: "b-pliometrie-basse",
    nom: "Sauts bas et réceptions",
    theme: "renforcement",
    minutes: 10,
    joueurs: [1, 30],
    espace: "Une ligne de haies basses",
    materiel: "Haies basses ou plots",
    but: "Apprendre à sauter et à atterrir proprement : explosivité et genoux protégés.",
    deroule: [
      "Sauts pieds joints au-dessus des haies, réception silencieuse, genoux dans l'axe.",
      "Puis sur une jambe, trois haies seulement.",
      "Pas plus de 40 sauts par séance.",
    ],
    ages: [12, 99],
    qualites: ["renforcement", "vitesse"],
    impact: true,
  }),
  ex({
    id: "b-musculation-encadree",
    nom: "Musculation encadrée",
    theme: "renforcement",
    minutes: 20,
    joueurs: [1, 12],
    espace: "Salle ou bord de terrain",
    materiel: "Haltères ou kettlebells légers, élastiques",
    but: "Gagner en force avec des charges légères, sous les yeux de l'entraîneur.",
    deroule: [
      "Squat gobelet, soulevé de terre jambes tendues, tirage à l'élastique, développé haltères.",
      "Trois séries de 8 à 12, la dernière répétition encore propre.",
      "Monter la charge d'une séance à l'autre, jamais la même semaine qu'un test.",
    ],
    ages: [16, 99],
    qualites: ["renforcement"],
  }),

  // Récupération et bien-être
  ex({
    id: "b-mobilite-respiration",
    nom: "Mobilité et respiration",
    theme: "retour",
    minutes: 10,
    joueurs: [1, 30],
    espace: "Au centre du terrain",
    materiel: "Aucun",
    but: "Relâcher le corps et faire redescendre le cœur.",
    deroule: [
      "Postures de mobilité : hanches, dos, chevilles, 40 secondes chacune.",
      "Respiration lente : 4 secondes pour inspirer, 6 pour expirer, pendant 2 minutes.",
      "Chacun dit son ressenti de séance, de 1 à 10.",
    ],
    ages: [8, 99],
    qualites: ["bienetre", "prevention"],
  }),
  ex({
    id: "b-auto-massage",
    nom: "Auto-massage au rouleau",
    theme: "retour",
    minutes: 8,
    joueurs: [1, 20],
    espace: "Vestiaire ou bord de terrain",
    materiel: "Rouleaux de massage",
    but: "Récupérer plus vite après une séance chargée.",
    deroule: [
      "Mollets, cuisses, fessiers : 45 secondes par zone, lentement.",
      "S'arrêter sur un point sensible, jamais sur une douleur vive.",
    ],
    ages: [14, 99],
    qualites: ["bienetre"],
  }),
  ex({
    id: "b-gardien-appuis",
    nom: "Appuis et réflexes du gardien",
    theme: "gardien",
    minutes: 10,
    joueurs: [1, 3],
    espace: "Le but",
    materiel: "Plots, ballons",
    but: "Se placer vite et réagir aux frappes proches.",
    deroule: [
      "Pas chassés entre deux plots, arrêt sur un tir au sol au signal.",
      "Frappes rapprochées à 6 m, le gardien relevé entre chaque.",
    ],
    ages: [10, 99],
    qualites: ["technique", "vitesse"],
  }),
];

/** Tous les exercices qu'un club lit : ceux de Bola, puis les siens. */
export const exercicesDuClub = (club: Pick<Club, "exercices">): Exercice[] => [
  ...BIBLIOTHEQUE,
  ...club.exercices,
];

export const exerciceDe = (club: Pick<Club, "exercices">, id: string) =>
  exercicesDuClub(club).find((e) => e.id === id) ?? null;

/** La durée d'un programme, en minutes. */
export const dureeProgramme = (p: readonly { minutes: number }[] | undefined) =>
  (p ?? []).reduce((t, l) => t + l.minutes, 0);

/** « 4 exercices · 85 min » ; null pour un programme vide. */
export function programmeDit(
  p: readonly { minutes: number }[] | undefined,
): string | null {
  const n = p?.length ?? 0;
  if (!n) return null;
  return `${n} ${n > 1 ? "exercices" : "exercice"} · ${dureeProgramme(p)} min`;
}

/**
 * Les programmes de la démo : une séance de mercredi, quatre ou cinq
 * exercices dans l'ordre d'une vraie séance (échauffement, technique, jeu,
 * finition ou physique, retour au calme), qui tournent d'une semaine à
 * l'autre. Sans hasard : le club de démonstration reste le même à chaque tirage.
 */
export const PROGRAMMES_DEMO: readonly (readonly [string, number])[][] = [
  [
    ["b-rondo-4c1", 10],
    ["b-controle-oriente", 15],
    ["b-conservation-5c5", 20],
    ["b-frappe-apres-controle", 15],
    ["b-etirements", 8],
  ],
  [
    ["b-passe-et-suis", 10],
    ["b-une-deux", 15],
    ["b-transition-3c2", 20],
    ["b-match-theme", 20],
    ["b-cercle", 5],
  ],
  [
    ["b-chat-ballon", 8],
    ["b-dribble-1c1", 15],
    ["b-match-4-buts", 15],
    ["b-face-au-gardien", 12],
    ["b-tirs-au-but", 8],
  ],
  [
    ["b-mobilite-ballon", 8],
    ["b-jeu-long", 12],
    ["b-pressing-6s", 15],
    ["b-intermittent", 12],
    ["b-etirements", 8],
  ],
];
