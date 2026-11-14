// GÉNÉRÉ par tools/page-sfl-couverture.ts : ne pas modifier à la main.
//
// Les images de la couverture du haut de getbola.app/sfl, une entrée par
// variante : a « La cage » et c « Les ombres », deux photos du moodboard des
// Actus (en production depuis le 24/10), recadrées ; b « Les cartes », le mur
// des vraies cartes de l'instantané (joueurs d'ACCORDS seulement, nommés dans
// `cartes`). Le téléphone a deux largeurs (srcset), l'ordinateur une bande.
// tools/page-sfl-check.ts relit chaque fichier (empreinte, taille, poids).
//
// Pur : des données, ni React, ni base.

/** Une image de la couverture : son adresse, sa taille en pixels, son empreinte, son poids. */
export interface ImageCouverture {
  src: string;
  largeur: number;
  hauteur: number;
  sha256: string;
  octets: number;
}

/** Une variante : son nom, sa source (la photo des Actus, ou null pour le mur), les joueurs du mur. */
export interface VarianteCouverture {
  nom: string;
  source: string | null;
  cartes: readonly string[];
  telephone: readonly ImageCouverture[];
  ordinateur: ImageCouverture;
}

export const VARIANTES_COUVERTURE = {
  "a": {
    "nom": "La cage",
    "source": "/actus/couvertures/cage-2-1200.webp",
    "cartes": [],
    "telephone": [
      {
        "src": "/sfl/couverture/a-720.webp",
        "largeur": 720,
        "hauteur": 1120,
        "sha256": "532b62fd0609db5632e9d20ccc5c57c353392c9539340f958b58193abbebb656",
        "octets": 123502
      },
      {
        "src": "/sfl/couverture/a-1029.webp",
        "largeur": 1029,
        "hauteur": 1600,
        "sha256": "78fcbf3cb9360f47d8e97134f31c73fa3dbdc07cdd6172e5903206ffbee2da33",
        "octets": 236690
      }
    ],
    "ordinateur": {
      "src": "/sfl/couverture/a-ordinateur.webp",
      "largeur": 1200,
      "hauteur": 675,
      "sha256": "8dea3730a5ba50c1fd6d8d20a7fc32a253ef36c472c3c6408549304b1db4e0c2",
      "octets": 95508
    }
  },
  "b": {
    "nom": "Les cartes",
    "source": null,
    "cartes": [
      "Afid",
      "Billal",
      "Coucoupop’s",
      "Gaïl",
      "Jouneiid",
      "Selim L",
      "Sidali",
      "Youss’"
    ],
    "telephone": [
      {
        "src": "/sfl/couverture/b-720.webp",
        "largeur": 720,
        "hauteur": 1120,
        "sha256": "69a25539573a1649d4cc9d485dd1698561533d7d16dd7fffb9f63c14a9eaa244",
        "octets": 61154
      },
      {
        "src": "/sfl/couverture/b-1029.webp",
        "largeur": 1029,
        "hauteur": 1600,
        "sha256": "004fa5bed53a30791958efdd2e0ef10ff638355ed8c0d8c97957af21a590ade8",
        "octets": 93792
      }
    ],
    "ordinateur": {
      "src": "/sfl/couverture/b-ordinateur.webp",
      "largeur": 1600,
      "hauteur": 900,
      "sha256": "94f74251a7be25b4dc49eeaaa88a116728d9aae1399fab70fda5217f9aee3a58",
      "octets": 115876
    }
  },
  "c": {
    "nom": "Les ombres",
    "source": "/actus/couvertures/ombres-1-1200.webp",
    "cartes": [],
    "telephone": [
      {
        "src": "/sfl/couverture/c-720.webp",
        "largeur": 720,
        "hauteur": 1120,
        "sha256": "8195a977e15625ded40220ca5dda258ab826dfb678828ff3e7d0b3799ef87bf3",
        "octets": 191252
      },
      {
        "src": "/sfl/couverture/c-1029.webp",
        "largeur": 1029,
        "hauteur": 1600,
        "sha256": "977b04ab3315464cf73b1c5714ab65a7392d3fc3b5dfa19f4030d07d36a62856",
        "octets": 243920
      }
    ],
    "ordinateur": {
      "src": "/sfl/couverture/c-ordinateur.webp",
      "largeur": 1200,
      "hauteur": 675,
      "sha256": "b7006def9309e74cde0263dc6dba82cea8623cd826b2d6596132048fb4bfb342",
      "octets": 191792
    }
  }
} as const satisfies Record<"a" | "b" | "c", VarianteCouverture>;

export type CleCouverture = keyof typeof VARIANTES_COUVERTURE;
