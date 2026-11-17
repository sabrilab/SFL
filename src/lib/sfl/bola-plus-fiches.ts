// Les fiches de Bola Plus (Sabri, 16/11/2026, 19:33) : « quand on clique sur
// la section en question, on [a] tout le détail de ce que ça inclut ». Une
// carte du carrousel (maillots, matchs filmés, cadeaux, cérémonies, « Ramène 5
// abonnés ») s'ouvre sur sa fiche.
//
// Depuis 20:54 (sa capture de Bola Studio : « c'est comme ça que je voulais
// le design des carrousels sous-jacents »), une fiche a la forme du panneau
// Bola Studio (studio-bola.tsx) : une feuille du bas, son titre, une phrase,
// puis un rail de vignettes en 4:5 (l'image, son nom et un détail sur le tiers
// bas ; dessous, une ligne et parfois une mention). Toucher une vignette
// l'ouvre en grand, dans la même feuille.
//
// D'où viennent les images (public/bola-plus-fiches/, deux largeurs) :
//   - les maillots : photos produit générées (Higgsfield, 16/11 20:55, à la
//     demande de Sabri : « de belles images e-commerce Pinterest style »)
//     d'après les rendus 3D du vrai patron (bola-site, /sponsoring) ; sans
//     joueur ;
//   - les matchs filmés : le kit Twitch, YouTube et Instagram de la SFL
//     (sfl-content, reseaux/kit-chrome, décision D5 : le direct sur Twitch et
//     YouTube en même temps) ;
//   - les pépites et les trophées : générés (Higgsfield, 16/11), sans joueur ;
//   - Bola 27 (Sabri, 17/11 11:36 : l'accès anticipé au jeu, un joueur à ton
//     image et à ton niveau) : des images de ce que sera le jeu, générées
//     (Higgsfield, 17/11) d'après l'arène du prototype ; personne de réel.
// Rien de payant, rien d'envoyé : de la lecture.

/** Une vignette d'une fiche. */
export interface CarteFiche {
  /** Son nom dans public/bola-plus-fiches/ (sans image : une étape de « Ramène 5 »). */
  image?: string;
  alt: string;
  /** Largeur × hauteur de l'original. */
  largeur: number;
  hauteur: number;
  /** Une image plus large que 4:5 (bandeau, 16:9) : montrée entière sur le noir, jamais recadrée. */
  entiere?: boolean;
  /** Sur la vignette : le nom, et un détail en Anton (« 3 g · 2 g · 1 g »). */
  nom: string;
  detail?: string;
  /** Sous la vignette : une ligne, et une mention courte (« YouTube »). */
  texte: string;
  mention?: string;
  /** « Ramène 5 » : combien des cinq ronds sont pleins. */
  pleins?: number;
}

export interface Fiche {
  id: string;
  titre: string;
  phrase: string;
  cartes: readonly CarteFiche[];
}

const CARRE = { largeur: 896, hauteur: 1120 };
const kit = (image: string, alt: string, nom: string, texte: string): CarteFiche => ({ image, alt, nom, texte, ...CARRE });
const trophee = (image: string, alt: string, nom: string, texte: string): CarteFiche => ({ image, alt, nom, texte, mention: "Trophée", ...CARRE });
const etape = (n: number, nom: string, texte: string, pleins: number): CarteFiche => ({ alt: "", nom, detail: String(n).padStart(2, "0"), texte, pleins, largeur: 4, hauteur: 5 });

export const FICHES: Record<string, Fiche> = {
  "bola-27": {
    id: "bola-27",
    titre: "Bola 27",
    phrase: "Le jeu, avant tout le monde.",
    cartes: [
      kit("b27-terrain", "Image générée : un match à cinq contre cinq dans l'arène de Bola 27, maillots noirs contre maillots blancs", "Le jeu", "Le five de la SFL, en jeu vidéo."),
      kit("b27-scan", "Image générée : un selfie devient une tête en 3D, puis un joueur complet en maillot noir", "À ton image", "Ton visage et ta silhouette : ton joueur est modélisé d'après toi."),
      kit("b27-niveau", "Image générée : un joueur en 3D, maillot blanc, et sa note 77", "À ton niveau", "Ta note dans l'app devient ton niveau dans le jeu."),
      kit("b27-dribble", "Image générée : un joueur en noir dribble un défenseur en blanc, au ras du terrain", "Dans l'arène", "Les panneaux, les maillots, le terrain du dimanche."),
      kit("b27-but", "Image générée : un joueur en noir célèbre un but à genoux, ses coéquipiers arrivent", "Accès anticipé", "Tu y joues avant sa sortie."),
    ],
  },
  maillots: {
    id: "maillots",
    titre: "Tes maillots",
    phrase: "Deux jeux complets, à ton nom.",
    cartes: [
      kit("kit-noir", "Image générée : le jeu noir plié, maillot, short et chaussettes", "Le noir", "Maillot, short et chaussettes."),
      kit("kit-blanc", "Image générée : le jeu blanc plié, maillot, short et chaussettes", "Le blanc", "Le même jeu, en blanc."),
      kit("kit-dos", "Image générée : le dos du maillot noir, un nom et le numéro 10", "À ton nom", "Ton nom et ton numéro au dos."),
      kit("kit-duo", "Image générée : les maillots noir et blanc sur deux cintres", "Noirs contre Blancs", "Un jeu par équipe, chaque dimanche."),
      kit("kit-detail", "Image générée : l'écusson SFL et BOLA sur la poitrine du maillot blanc", "Les écussons", "SFL sur le cœur, BOLA en face."),
      kit("kit-chaussettes", "Image générée : chaussettes rayées noires et blanches, short noir numéroté, crampons", "Jusqu'aux chaussettes", "Chaussettes rayées, short numéroté."),
    ],
  },
  "matchs-filmes": {
    id: "matchs-filmes",
    titre: "Tes matchs filmés",
    phrase: "Twitch, YouTube, TikTok, Instagram.",
    cartes: [
      { image: "direct-live", alt: "Le direct de la SFL, le dimanche", largeur: 1200, hauteur: 480, entiere: true, nom: "En direct", texte: "En même temps sur les deux, chaque dimanche.", mention: "Twitch · YouTube" },
      { image: "resume", alt: "Le résumé d'une journée sur YouTube : Noirs 5, Blancs 4", largeur: 1280, hauteur: 720, entiere: true, nom: "Les résumés", texte: "Le résumé de la journée et les meilleurs moments.", mention: "YouTube" },
      { image: "story", alt: "Une story Instagram de la SFL : « Dimanche. »", largeur: 1080, hauteur: 1920, nom: "Tout mélangé", texte: "Le direct, les buts, les résumés.", mention: "TikTok · Instagram" },
    ],
  },
  cadeaux: {
    id: "cadeaux",
    titre: "Des cadeaux",
    phrase: "De l'or, du vrai, pour le podium.",
    cartes: [
      { image: "pepites", alt: "Image générée : trois pépites d'or de tailles différentes, chacune dans son écrin noir", ...CARRE, nom: "Le podium", detail: "3 g · 2 g · 1 g", texte: "Une pépite d'or pour les trois premiers de la Pépite d'Or.", mention: "1er · 2e · 3e" },
      { image: "pepite-ecrin", alt: "Image générée : une pépite d'or dans son écrin noir", ...CARRE, nom: "Dans son écrin", texte: "Remise à la cérémonie de fin de saison." },
    ],
  },
  ceremonies: {
    id: "ceremonies",
    titre: "Les cérémonies",
    phrase: "Cinq trophées à chaque fin de saison.",
    cartes: [
      { image: "trophees", alt: "Image générée : cinq trophées sur un podium de marbre, dans le stade de piliers", largeur: 1024, hauteur: 688, entiere: true, nom: "Le podium", texte: "Les cinq remis sur scène, en fin de saison." },
      trophee("trophee-pepite", "Image générée : le trophée de la Pépite d'Or, une pépite d'or sur un socle de marbre noir", "La Pépite d'Or", "Le premier du classement."),
      trophee("trophee-buteur", "Image générée : le trophée du meilleur buteur, un crampon chromé qui frappe le ballon", "Meilleur buteur", "Le plus de buts de la saison."),
      trophee("trophee-passeur", "Image générée : le trophée du meilleur passeur, un arc chromé qui suit le ballon", "Meilleur passeur", "Le plus de passes décisives."),
      trophee("trophee-defenseur", "Image générée : le trophée du meilleur défenseur, un mur de marbre blanc", "Meilleur défenseur", "Le Mur de la saison."),
      trophee("trophee-mvp", "Image générée : le trophée du MVP, un ballon de verre noir sur une colonne de marbre", "MVP", "Le plus de fois meilleur joueur du match."),
    ],
  },
  parrainage: {
    id: "parrainage",
    titre: "Ramène 5 abonnés",
    phrase: "5 abonnés = ton abonnement offert.",
    cartes: [
      etape(1, "Partage ton lien", "Ma carte, puis Inviter : ton lien, à qui tu veux.", 0),
      etape(2, "Ils s'inscrivent", "Avec ton lien, ils arrivent chez toi.", 2),
      etape(3, "Ils s'abonnent", "Chaque abonné compte. Il en faut cinq.", 4),
      etape(4, "Le tien est offert", "Tant qu'ils restent abonnés, ton abonnement ne te coûte rien.", 5),
    ],
  },
};

/** Le chemin d'une image de fiche, à 600 ou 1200 px de large. */
export const fichierFiche = (image: string, l: 600 | 1200) => `/bola-plus-fiches/${image}-${l}.webp`;
/** Le srcset d'une image de fiche (la grande ne dépasse pas l'original). */
export const sourcesFiche = (c: CarteFiche) => (c.image ? `${fichierFiche(c.image, 600)} 600w, ${fichierFiche(c.image, 1200)} ${Math.min(1200, c.largeur)}w` : "");
