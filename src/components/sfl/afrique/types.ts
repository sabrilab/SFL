// Le contrat d'un skin de nation (PACK AFRIQUE 2027, lib/sfl/pack-afrique.ts).
// Un skin = un fichier, components/sfl/afrique/<nation>.tsx, qui exporte par
// défaut un SkinNation. Le registre (registre.ts) en fait une matière
// (MATIERES, finitions-carte.ts) et un motif (motif-carte.tsx) : la face
// (bola-card.tsx), la carte photo (carte-photo.tsx), le dos (dos-carte.tsx)
// et la 3D (card-3d-canvas.tsx : tranche, reflet) les lisent sans autre
// branchement.
//
// Règles d'un fichier de nation :
//   · il n'importe de finitions-carte.ts que des TYPES (sinon : cycle, la
//     matière serait lue avant d'exister) ; les outils sont dans outils.ts ;
//   · tout se dessine en code, en SVG, dans le repère de la carte
//     (1024 × 1656) : ni image, ni filtre, ni police téléchargée, rien de
//     généré (la capture de la 3D, html-to-image, doit le prendre tel quel
//     sur iPhone) ; le motif est stable pour une même graine ;
//   · le motif laisse lire la carte : le portrait (41 → 983) reste calme,
//     la bande du bas (dès 1024 : nom, note, stats) ne porte qu'un motif de
//     force faible ;
//   · ni or, ni bleu cobalt, ni rouge laqué (DA : réservés aux cartes MVP,
//     Défensive, Impact) ; le drapeau, s'il apparaît, en filet discret au dos ;
//   · aucun nom, sigle, trophée, mascotte, logo de la CAF ; ni écusson ni
//     surnom de sélection écrit ; aucun objet sacré, aucune figure ; un seul
//     animal admis : le totem de la nation (Ilyes, 02/11/2026 : « rajoute un
//     animal totem […] une belle silhouette, un beau truc de chaque équipe »),
//     dessiné dans totems/<nation>.tsx et posé par totem.tsx, jamais nommé
//     sur la carte.
//
// Le totem (TotemNation, plus bas) : un fichier totems/<nation>.tsx, des
// tracés à la main (béziers) dans le repère propre du totem (boite), posés
// par totem.tsx au dos (le héros, avec la rosace et la lune) et à la face
// (dans la marge sous le portrait, ou gaufré sur le portrait, hors du
// visage et de la bande du bas). Mêmes règles que le motif : du SVG pur,
// sans filtre ni image, stable pour une même graine.

import type { ReactNode } from "react";
import type { Matiere } from "@/components/sfl/finitions-carte";
import type { CodeNation } from "@/lib/sfl/pack-afrique";

export type FinitionAfrique = `afrique-${CodeNation}`;

/** Le motif d'une matière de nation : le registre retrouve son dessin par la nation. */
export type MotifAfrique = { type: "afrique"; nation: CodeNation };

export interface PropsMotifNation {
  /** La face, ou le dos (où la rosace et la lune sont au centre, cx 512). */
  cote: "face" | "dos";
  /** Les deux tons du motif (matiere.motif). */
  m: { clair: string; fonce: string };
  /** Stable par joueur (graine(nom)) : un tissage propre à chaque carte, si on le veut. */
  graine: number;
  /** Le nom du joueur (comme le filigrane), s'il entre dans le motif. */
  nom?: string;
  /** Un identifiant unique, pour les <pattern> et <clipPath> (useId nettoyé). */
  id: string;
}

export interface SourceSkin {
  titre: string;
  url?: string;
}

export interface SkinNation {
  nation: CodeNation;
  /** Le nom du skin, court : « Lamu », « Écorce », « Zellige »… */
  nom: string;
  /** Une phrase qui dit son inspiration, sans texte d'aide : « Les portes sculptées de la vieille ville de Lamu. » */
  quoi: string;
  /** Les sources de la recherche (patrimoine, musées, études) : relues avant validation. */
  sources: SourceSkin[];
  /** false : le gabarit (jamais tiré ni montré à un joueur). */
  dessine: boolean;
  /**
   * La matière, sans son nom ni le type du motif (le registre les pose) :
   * papier, encre, étiquette, rebord, cadre de la carte photo, tranche et
   * reflet de la 3D, et `dos` si le dos change d'encre ou de papier.
   */
  matiere: Omit<Matiere, "nom" | "motif"> & { motif: { clair: string; fonce: string } };
  /** Le motif gravé : des éléments SVG dans le repère 1024 × 1656 (le registre pose le <svg>). */
  Motif: (p: PropsMotifNation) => ReactNode;
}

/* ------------------------------- Le totem ------------------------------- */

/**
 * Les couches où totem.tsx demande le dessin du totem :
 *   · « dos »           : au dos, sous la lune et le logotype (dans le motif) ;
 *   · « dos-devant »    : au dos, par-dessus la lune (seulement si pose.dos.devant :
 *                         totem.tsx redessine alors la rosace, la lune et le logotype) ;
 *   · « face-cadre »    : la face, sous le portrait : ne se voit que dans la marge
 *                         (41 autour, 983 → 1024 sous le portrait) ;
 *   · « face-portrait » : la face, par-dessus le portrait (photo ou rayures),
 *                         coupé au portrait ; carte complète seulement.
 */
export type CoucheTotem = "dos" | "dos-devant" | "face-cadre" | "face-portrait";

/** Les tons de la matière de la nation, que le totem reprend. */
export interface TonsTotem {
  /** L'encre de la carte, « r,g,b » (celle du dos au dos, si elle change). */
  encre: string;
  /** Les deux tons du motif (matiere.motif). */
  clair: string;
  fonce: string;
  /** La carte est sombre (encre claire sur papier foncé). */
  sombre: boolean;
}

export interface PropsTotem {
  couche: CoucheTotem;
  tons: TonsTotem;
  /** Stable par joueur : une usure, un grain propre à chaque carte, si on le veut. */
  graine: number;
  /** « face-portrait » : une photo est dessous (sinon : les rayures et l'initiale). */
  photo: boolean;
  /** Un identifiant unique, pour les <linearGradient>, <pattern>, <clipPath>. */
  id: string;
}

/**
 * Une pose : la boîte du totem (0 0 boite.w boite.h) posée dans le repère de
 * la carte (1024 × 1656) : son coin haut gauche en (x, y), mise à l'échelle,
 * retournée (miroir horizontal) ou tournée (degrés, autour de son centre).
 */
export interface PoseTotem {
  x: number;
  y: number;
  echelle: number;
  miroir?: boolean;
  rotation?: number;
}

export interface PoseDos extends PoseTotem {
  /**
   * true : le totem passe devant la lune. totem.tsx retire alors le logo du
   * dos de dos-carte.tsx (matiere.dos.logo = false, via le registre) et
   * redessine la rosace, la lune (à `lune`, si on la déplace) et le
   * logotype, dans cet ordre : rosace, couche « dos », lune, couche
   * « dos-devant », logotype.
   */
  devant?: boolean;
  /** La lune et sa rosace déplacées (seulement avec devant) ; d : diamètre de la lune (300). */
  lune?: { cx: number; cy: number; d?: number };
  /**
   * false : pas de rosace guillochée autour de la lune (seulement avec
   * devant), quand le totem sertit la lune lui-même et que le halo
   * brouillerait son dessin (l'Algérie : la lune en cabochon dans l'anneau).
   */
  rosace?: boolean;
}

export interface TotemNation {
  nation: CodeNation;
  /** L'animal, pour l'équipe seulement (jamais écrit sur la carte). */
  animal: string;
  /** Une phrase interne : la pose et le traitement retenus. */
  quoi: string;
  /** Les références consultées (anatomie, photos, objets) : jamais téléchargées. */
  sources: SourceSkin[];
  /** false : pas encore dessiné, totem.tsx ne pose rien. */
  dessine: boolean;
  /** Le repère du dessin : 0 0 w h. */
  boite: { w: number; h: number };
  pose: {
    dos: PoseDos;
    /** La face : l'une, l'autre ou les deux ; absente, rien sur la face. */
    face?: { cadre?: PoseTotem; portrait?: PoseTotem };
  };
  /** Le dessin, dans le repère de la boîte, selon la couche demandée ; null : rien sur cette couche. */
  Dessin: (p: PropsTotem) => ReactNode;
}
