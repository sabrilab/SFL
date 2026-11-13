// GÉNÉRÉ par tools/page-sfl-instantane.ts : ne pas modifier à la main.
//
// L'instantané de la page publique getbola.app/sfl : les vraies cartes de la
// ligue, celles des joueurs dont l'accord hors-app était enregistré « oui » à
// la lecture de la base (LU_LE), et rien d'autre. Les blocs (la compo, la
// carte qui a monté, le haut des divisions, les trois titres) ont été tirés
// de la saison par le moteur de l'app, avec leurs règles (l'outil, choisirBlocs) ;
// chaque carte est une image de public/sfl/cartes, dessinée par le vrai
// composant, à l'empreinte écrite ici. ACCORDS : les noms affichés des
// joueurs montrés ; tools/page-sfl-check.ts refuse tout autre nom.
// Pour rafraîchir : refaire la lecture, relancer l'outil, relire les images.
// Pour vérifier qu'aucun accord ne s'est retiré : l'outil, --verifier.
//
// Pur : des données, ni React, ni base.

/** Une carte, en image : son adresse, sa taille en pixels, son empreinte, son poids, ce qu'en dit un lecteur d'écran. */
export interface ImageCarte {
  src: string;
  largeur: number;
  hauteur: number;
  sha256: string;
  octets: number;
  lue: string;
}

/** L'heure de la lecture de la base (UTC). */
export const LU_LE = "2026-11-13T01:15:00.000Z";

/** Les noms affichés des joueurs montrés : chacun avait dit oui. */
export const ACCORDS = [
  "Abdel",
  "Afid",
  "Billal",
  "Coucoupop’s",
  "Gaïl",
  "Ibrahim",
  "Ilyes",
  "Jouneiid",
  "Selim L",
  "Sidali",
  "Souley",
  "Yamin",
  "Youss’"
] as const;

/** Noirs contre Blancs : un vrai match, ses dix joueurs et son score. */
export const COMPO = {
  "journee": 4,
  "date": "1 nov.",
  "match": 1,
  "camps": [
    {
      "camp": "Noirs",
      "score": 8,
      "joueurs": [
        {
          "nom": "Coucoupop’s",
          "note": 86,
          "image": {
            "src": "/sfl/cartes/coucoupops-compo.webp",
            "largeur": 192,
            "hauteur": 192,
            "sha256": "1d451760bb912a5ebb486cbd87f97b081b77fb12243b167014ea7f5e23ee7282",
            "octets": 8354,
            "lue": "Coucoupop’s"
          }
        },
        {
          "nom": "Ilyes",
          "note": 85,
          "image": {
            "src": "/sfl/cartes/ilyes-compo.webp",
            "largeur": 192,
            "hauteur": 192,
            "sha256": "972bea5fbd2e776b0d313970739a9f41242b1be8f03e4aebb387376f97fbb911",
            "octets": 8220,
            "lue": "Ilyes"
          }
        },
        {
          "nom": "Souley",
          "note": 83,
          "image": {
            "src": "/sfl/cartes/souley-compo.webp",
            "largeur": 192,
            "hauteur": 192,
            "sha256": "0f29ec6f053fb9cb5deca9873093cbcfd8b9150f832e850860f2f48320d65ed5",
            "octets": 8472,
            "lue": "Souley"
          }
        },
        {
          "nom": "Yamin",
          "note": 83,
          "image": {
            "src": "/sfl/cartes/yamin-compo.webp",
            "largeur": 192,
            "hauteur": 192,
            "sha256": "55f7904b0cd28a5fc207c235afa8936e49d5dcec96b42261bb09d21e34df0061",
            "octets": 7150,
            "lue": "Yamin"
          }
        },
        {
          "nom": "Youss’",
          "note": 81,
          "image": {
            "src": "/sfl/cartes/youss-compo.webp",
            "largeur": 192,
            "hauteur": 192,
            "sha256": "5c4987eebcd074b62d67c7c11524a181b80f9884a74700f6525004254f75b05b",
            "octets": 7014,
            "lue": "Youss’"
          }
        }
      ]
    },
    {
      "camp": "Blancs",
      "score": 12,
      "joueurs": [
        {
          "nom": "Abdel",
          "note": 83,
          "image": {
            "src": "/sfl/cartes/abdel-compo.webp",
            "largeur": 192,
            "hauteur": 192,
            "sha256": "fcf8ff57d5f14307949d749b49cf2193559c418612bd76d44327b61a09340c25",
            "octets": 8818,
            "lue": "Abdel"
          }
        },
        {
          "nom": "Ibrahim",
          "note": 81,
          "image": {
            "src": "/sfl/cartes/ibrahim-compo.webp",
            "largeur": 192,
            "hauteur": 192,
            "sha256": "3ed21d73960f01d3c487c2c280e7b2d5d041890ad161be9801b34e9526cad592",
            "octets": 8036,
            "lue": "Ibrahim"
          }
        },
        {
          "nom": "Jouneiid",
          "note": 87,
          "image": {
            "src": "/sfl/cartes/jouneiid-compo.webp",
            "largeur": 192,
            "hauteur": 192,
            "sha256": "bc028a33a8f8caa079429ecb86f547a6dc3044765a84aa63c04a216254bccf18",
            "octets": 9222,
            "lue": "Jouneiid"
          }
        },
        {
          "nom": "Selim L",
          "note": 82,
          "image": {
            "src": "/sfl/cartes/selim-l-compo.webp",
            "largeur": 192,
            "hauteur": 192,
            "sha256": "36498e12dc4062a9408acd6e03479fe1c719309febc5abb650f0b62bb5d8e98d",
            "octets": 7660,
            "lue": "Selim L"
          }
        },
        {
          "nom": "Sidali",
          "note": 83,
          "image": {
            "src": "/sfl/cartes/sidali-compo.webp",
            "largeur": 192,
            "hauteur": 192,
            "sha256": "a9d4a47b1e5ec3df14212b09f3a58808a7280b1ece60ce542d23b13c1a7fdf00",
            "octets": 8156,
            "lue": "Sidali"
          }
        }
      ]
    }
  ]
} as const;

/** La carte qui a monté : celle de départ, puis l'officielle. */
export const CARTE_MONTEE = {
  "nom": "Billal",
  "de": 79,
  "a": 81,
  "depart": {
    "src": "/sfl/cartes/billal-depart.webp",
    "largeur": 450,
    "hauteur": 729,
    "sha256": "b609e4fa814c0ff96405dc99b50f6dfbb0e8a571a91c1de5d7d004a2fd9f766c",
    "octets": 27688,
    "lue": "Billal, 79"
  },
  "officielle": {
    "src": "/sfl/cartes/billal-officielle.webp",
    "largeur": 960,
    "hauteur": 1557,
    "sha256": "8aa3a343db4baec0919ae01875b667f0b388f344c37110b1a6c0f6e00ee3bca3",
    "octets": 80010,
    "lue": "Billal, 81"
  }
} as const;

/** Le haut de chaque division (D3 : personne n'y est encore classé, ou personne ne passe). */
export const PODIUMS = [
  {
    "division": "D1",
    "places": [
      {
        "nom": "Jouneiid",
        "place": 1,
        "points": 43,
        "image": {
          "src": "/sfl/cartes/jouneiid-d1.webp",
          "largeur": 450,
          "hauteur": 729,
          "sha256": "46b3ab4e72898c2330d06683166c164097f33a7871af644090e914f4629b6968",
          "octets": 32308,
          "lue": "Jouneiid, 1er, 43 pts"
        }
      },
      {
        "nom": "Selim L",
        "place": 2,
        "points": 41,
        "image": {
          "src": "/sfl/cartes/selim-l-d1.webp",
          "largeur": 450,
          "hauteur": 732,
          "sha256": "2f857cdf45a73943791d198ac6d3804ed15abbd6bc7c4acb27d000b1c1529222",
          "octets": 27976,
          "lue": "Selim L, 2e, 41 pts"
        }
      },
      {
        "nom": "Coucoupop’s",
        "place": 3,
        "points": 39,
        "image": {
          "src": "/sfl/cartes/coucoupops-d1.webp",
          "largeur": 450,
          "hauteur": 729,
          "sha256": "ddb30ab36287822644ee695b29f3f8788e5985fd9e4c2bb4917f329c37b3d833",
          "octets": 32148,
          "lue": "Coucoupop’s, 3e, 39 pts"
        }
      }
    ]
  },
  {
    "division": "D2",
    "places": [
      {
        "nom": "Afid",
        "place": 1,
        "points": 10,
        "image": {
          "src": "/sfl/cartes/afid-d2.webp",
          "largeur": 450,
          "hauteur": 732,
          "sha256": "a25305641ffa7873b4ddc4e78ea3017d1d70297837a9773dfdc0e6cd95750f7d",
          "octets": 40414,
          "lue": "Afid, 1er, 10 pts"
        }
      },
      {
        "nom": "Gaïl",
        "place": 1,
        "points": 10,
        "image": {
          "src": "/sfl/cartes/gail-d2.webp",
          "largeur": 450,
          "hauteur": 729,
          "sha256": "049a21bb3f5deb27cdda4d61029c5e3dd77615b4b86b888004e00abec415b76b",
          "octets": 41956,
          "lue": "Gaïl, 1er, 10 pts"
        }
      }
    ]
  },
  {
    "division": "D3",
    "places": []
  }
] as const;

/** Les trois titres d'un vrai match : la carte compacte (téléphone) et la complète. */
export const TITRES = {
  "journee": 4,
  "date": "1 nov.",
  "match": 1,
  "cartes": [
    {
      "edition": "mvp",
      "nom": "Selim L",
      "note": 86,
      "petite": {
        "src": "/sfl/cartes/selim-l-mvp-petite.webp",
        "largeur": 450,
        "hauteur": 732,
        "sha256": "7d683ed54b29f43f12eb0fdbcdc9e36a4b537934577fef78376166ba84bead65",
        "octets": 29290,
        "lue": "Selim L, carte MVP"
      },
      "complete": {
        "src": "/sfl/cartes/selim-l-mvp.webp",
        "largeur": 660,
        "hauteur": 1071,
        "sha256": "07fc7cb2c6b3337e0afa2d95bd0ca25be308d1a9feb8947dc7521ecfa6031d75",
        "octets": 68128,
        "lue": "Selim L, carte MVP"
      }
    },
    {
      "edition": "impact",
      "nom": "Youss’",
      "note": 83,
      "petite": {
        "src": "/sfl/cartes/youss-impact-petite.webp",
        "largeur": 450,
        "hauteur": 729,
        "sha256": "e415b7f1395276127e2cac2c3bcd419e39ac4af9ab32fb64c0b28f9196d28ae7",
        "octets": 37062,
        "lue": "Youss’, carte Impact"
      },
      "complete": {
        "src": "/sfl/cartes/youss-impact.webp",
        "largeur": 660,
        "hauteur": 1071,
        "sha256": "5fa6d3eab91296c37a254d5fe4cb1fdab76c1c7192c7a6ed8ae49f4da38feb2b",
        "octets": 81404,
        "lue": "Youss’, carte Impact"
      }
    },
    {
      "edition": "def",
      "nom": "Sidali",
      "note": 86,
      "petite": {
        "src": "/sfl/cartes/sidali-def-petite.webp",
        "largeur": 450,
        "hauteur": 732,
        "sha256": "bcab0ae5e486a9157c82a6f89c434758bbfde9545c03c484fe0c70e318cc80f5",
        "octets": 34826,
        "lue": "Sidali, carte Défensive"
      },
      "complete": {
        "src": "/sfl/cartes/sidali-def.webp",
        "largeur": 660,
        "hauteur": 1071,
        "sha256": "acb6aea5b198657e0dfcbe7e36ef44c8e7c084f6a9187419b80c2e6fa0aa6990",
        "octets": 79090,
        "lue": "Sidali, carte Défensive"
      }
    }
  ]
} as const;
