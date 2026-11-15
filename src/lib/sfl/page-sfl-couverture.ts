// GÉNÉRÉ par tools/page-sfl-couverture.ts : ne pas modifier à la main.
//
// Les images de la couverture du haut de getbola.app/sfl, une entrée par
// variante : a « La cage » et c « Les ombres », deux photos du moodboard des
// Actus (en production depuis le 24/10), recadrées ; b « Les cartes », le mur
// des vraies cartes de l'instantané (joueurs d'ACCORDS seulement, nommés dans
// `cartes`) ; d, d2, d3, des FIGURANTS GÉNÉRÉS (Higgsfield, projet Bola),
// aucun joueur de la SFL, aucun visage réel (`figurants` : le PNG et son
// empreinte). Le téléphone a deux largeurs (srcset), l'ordinateur une bande.
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

/** Une variante : son nom, sa source (la photo des Actus, ou null), les figurants générés, les joueurs du mur. */
export interface VarianteCouverture {
  nom: string;
  source: string | null;
  figurants: { fichier: string; sha256: string } | null;
  cartes: readonly string[];
  telephone: readonly ImageCouverture[];
  ordinateur: ImageCouverture;
}

export const VARIANTES_COUVERTURE = {
  "a": {
    "nom": "La cage",
    "source": "/actus/couvertures/cage-2-1200.webp",
    "figurants": null,
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
    "figurants": null,
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
    "figurants": null,
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
  },
  "d": {
    "nom": "L'équipe",
    "source": null,
    "figurants": {
      "fichier": "d1.png",
      "sha256": "e696e5a90499260fa09b555197b31432f7b0a35b2a9a995242b469adef6faa9c"
    },
    "cartes": [],
    "telephone": [
      {
        "src": "/sfl/couverture/d-720.webp",
        "largeur": 720,
        "hauteur": 1560,
        "sha256": "512d01c92709ff38916c9c6f839e1c6fe259a0fe59be0fab2f706cd18e0394d2",
        "octets": 65040
      },
      {
        "src": "/sfl/couverture/d-1029.webp",
        "largeur": 1029,
        "hauteur": 2229,
        "sha256": "247c8ce413040e6a2b36366df9bccfdafcd07eef8357848eabe5bae922c0075e",
        "octets": 118574
      }
    ],
    "ordinateur": {
      "src": "/sfl/couverture/d-ordinateur.webp",
      "largeur": 1520,
      "hauteur": 855,
      "sha256": "7c6b44903cf1bb9b1d217178cf47e7365410c5c9c68279559703b0f46fb773e3",
      "octets": 100156
    }
  },
  "d2": {
    "nom": "Le face-à-face",
    "source": null,
    "figurants": {
      "fichier": "d2.png",
      "sha256": "d0abb9d5f3d9d94aabc38a68066c80bb7e9899eabf66fbe9f969612b7332aa8e"
    },
    "cartes": [],
    "telephone": [
      {
        "src": "/sfl/couverture/d2-720.webp",
        "largeur": 720,
        "hauteur": 1560,
        "sha256": "adb90e1cac8aa55ff5ce0a8cb54f4cfd932d7b25d8f4199a160a468f46d0d882",
        "octets": 41880
      },
      {
        "src": "/sfl/couverture/d2-1029.webp",
        "largeur": 1029,
        "hauteur": 2229,
        "sha256": "8279e4be273f642949cdf2f2ef3157921bb986a990f9480d97a25bfabff220c3",
        "octets": 74716
      }
    ],
    "ordinateur": {
      "src": "/sfl/couverture/d2-ordinateur.webp",
      "largeur": 1600,
      "hauteur": 900,
      "sha256": "8b675798a2ec4744d4de2cdbbf32bfff53d8f7c6123a2e28215e0151e62f1690",
      "octets": 39686
    }
  },
  "d3": {
    "nom": "Le pied sur le ballon",
    "source": null,
    "figurants": {
      "fichier": "d3.png",
      "sha256": "c0282078a573448b3e0dcea9c811211c926cb9cab5788bef630aec61ed72dde3"
    },
    "cartes": [],
    "telephone": [
      {
        "src": "/sfl/couverture/d3-720.webp",
        "largeur": 720,
        "hauteur": 1560,
        "sha256": "80e3d0eece6bec81515819a4ba00d0b372cdd95f75b161f0022a02519d86e165",
        "octets": 25410
      },
      {
        "src": "/sfl/couverture/d3-1029.webp",
        "largeur": 1029,
        "hauteur": 2229,
        "sha256": "2287d6975c31a6238a041d742c20e0f23b69ef86a4b8fa7fdba4862579b6ec44",
        "octets": 42968
      }
    ],
    "ordinateur": {
      "src": "/sfl/couverture/d3-ordinateur.webp",
      "largeur": 1600,
      "hauteur": 900,
      "sha256": "9c6a48e270b85a203d4d91e67a8f540b4c46bbb01b491701660513ec2a3600cb",
      "octets": 25880
    }
  }
} as const satisfies Record<"a" | "b" | "c" | "d" | "d2" | "d3", VarianteCouverture>;

export type CleCouverture = keyof typeof VARIANTES_COUVERTURE;
