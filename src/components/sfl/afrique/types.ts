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
//     surnom de sélection ; aucun objet sacré, aucune figure, aucun animal.

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
