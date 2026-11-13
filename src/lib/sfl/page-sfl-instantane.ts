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
            "sha256": "5a1187477810ba2b2fded36ed2e7e383629c605334c430de1b66889f74e7bd2f",
            "octets": 8050,
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
            "sha256": "36c8a8447257a1e14206453f6a9b277fc5970122ebeb241daf85a291193a4013",
            "octets": 7886,
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
            "sha256": "9d7d2d3f56f61857a68bfb38b68bdc59a2bee3e6737b5857bdf14f6302b47027",
            "octets": 8102,
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
            "sha256": "1bc870330728c4d1b368c1aef2699b46ba1b5f722164923072b5fb72c774c8ad",
            "octets": 6714,
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
            "sha256": "ce8a5ccc12f39ad5c6d25ab709528b3eee201711042e5d78b8eb99040a5954e5",
            "octets": 6662,
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
            "sha256": "042ca217f0b2cce4162bab1c1cfd3a47a933a7711224c5ba71c18b79be0139b9",
            "octets": 8402,
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
            "sha256": "9707e27747f2972838c18e65a74db9022f27a4b90a6989d2f708dd9bac3cc925",
            "octets": 7676,
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
            "sha256": "f05d743a03992ea82183a42b7eedf2528658fc7928e62383612c6240c3c7e968",
            "octets": 8894,
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
            "sha256": "d9f52e7559209fbda73498db41540ebf48704f09f3895281d552e3410fccd70d",
            "octets": 7150,
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
            "sha256": "937750e965ebc910bdb6523638b96b0a36be585119dfb949b24b05846a66f4d6",
            "octets": 7814,
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
    "hauteur": 726,
    "sha256": "b0ce8eac61d906b7db0813480a9afbcd36ca50b582fca228e29d91f4afc050a8",
    "octets": 27360,
    "lue": "Billal, 79"
  },
  "officielle": {
    "src": "/sfl/cartes/billal-officielle.webp",
    "largeur": 960,
    "hauteur": 1551,
    "sha256": "e0f621097017b1f3ab3ffbacf16ca62f03ad6331c185c00a7e6dbe32fc0e426e",
    "octets": 75902,
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
          "hauteur": 726,
          "sha256": "9be8a2289d328b202abe664ee0084f7e2479624090a93f772f16123c30a303d1",
          "octets": 31944,
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
          "hauteur": 726,
          "sha256": "7214925fdabf4c9cb9c92dbf85a04cd8adff7da761674b9ca8191af5db2dc9d2",
          "octets": 26374,
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
          "hauteur": 726,
          "sha256": "e679cb611dc8969d0730613f3011168f4cf0ef2ea07ec6809b069f5b2e977f69",
          "octets": 31848,
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
          "hauteur": 726,
          "sha256": "02dc0b3dd2be592821e3cc4e1fdbd4168d99d25a155bb931e8b35c13621e4d96",
          "octets": 39886,
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
          "hauteur": 726,
          "sha256": "8a362423a6ce9a75abb36689cb0d2b7122a318c12c1850a31d361630b726e763",
          "octets": 41518,
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
        "hauteur": 726,
        "sha256": "db9b745eb4b5a660077081fdb919626674728a96d64fecf7b53f64e56ef67201",
        "octets": 28108,
        "lue": "Selim L, carte MVP"
      },
      "complete": {
        "src": "/sfl/cartes/selim-l-mvp.webp",
        "largeur": 660,
        "hauteur": 1065,
        "sha256": "f15ba82eba665191a67b31ab869fc39a962c912d490d8017615aa81312e36c90",
        "octets": 65894,
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
        "hauteur": 726,
        "sha256": "6469f6b2e9903f95829eb4582c50d7fe55336dc878dd7b9bf2e62e886d8e3737",
        "octets": 36752,
        "lue": "Youss’, carte Impact"
      },
      "complete": {
        "src": "/sfl/cartes/youss-impact.webp",
        "largeur": 660,
        "hauteur": 1065,
        "sha256": "576a492ca6920a77a087f177bb14267941678dc28a4a48d46484fa28a21a5f6f",
        "octets": 80208,
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
        "hauteur": 726,
        "sha256": "eb270d52d5f1ec484b315b3cfe0735674b450315c4fcc112a4281e0099a6bd94",
        "octets": 33718,
        "lue": "Sidali, carte Défensive"
      },
      "complete": {
        "src": "/sfl/cartes/sidali-def.webp",
        "largeur": 660,
        "hauteur": 1065,
        "sha256": "ec2ff0f3b9f33fccc1bd61aeb827b4657c886ca44c0f226d8ad45f3951c3768d",
        "octets": 77044,
        "lue": "Sidali, carte Défensive"
      }
    }
  ]
} as const;
