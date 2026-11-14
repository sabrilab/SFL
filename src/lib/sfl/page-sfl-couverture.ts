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
        "sha256": "8b279fb38cbe3a40d6ab65e7d4c3e8246bcb1352cf77fb41b3b23bb2b54d01b8",
        "octets": 73592
      },
      {
        "src": "/sfl/couverture/b-1029.webp",
        "largeur": 1029,
        "hauteur": 1600,
        "sha256": "2ee052ef5d7bcc0ddb187c796ecb6b503aba9ab13afa180d7fd234e828ee27ce",
        "octets": 111604
      }
    ],
    "ordinateur": {
      "src": "/sfl/couverture/b-ordinateur.webp",
      "largeur": 1600,
      "hauteur": 900,
      "sha256": "45be42d81137dc20361d8f0b703e7d7f6c5d5dbfc12ea2e6a000b66bac7b9f5a",
      "octets": 140732
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
        "sha256": "2cfcfbb7ba8ddc533724f527aa883411ecf79badfa6a993ba173baedc7b17094",
        "octets": 188898
      },
      {
        "src": "/sfl/couverture/c-1029.webp",
        "largeur": 1029,
        "hauteur": 1600,
        "sha256": "b028e752195ff2fdbd44e51ee5f2f8548264ba532e7f67f712095abd34011acb",
        "octets": 239326
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
