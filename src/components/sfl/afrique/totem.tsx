"use client";

// Le totem d'une nation (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 : « rajoute
// un animal totem. On ne veut pas un animal mal fait : une belle silhouette,
// un beau truc de chaque équipe »). Le surnom animal de la sélection quand il
// existe, sinon l'animal national : jamais écrit sur la carte.
//
// Ce fichier pose le totem ; le dessin est dans totems/<nation>.tsx
// (TotemNation, types.ts). Trois places :
//   · le dos : le héros, grand, avec la rosace et la lune (cx 512, cy 738).
//     TotemDos est rendu dans le motif (motifs-afrique.tsx), donc SOUS le
//     logo que dos-carte.tsx dessine ensuite : couche « dos ». Avec
//     pose.dos.devant, le registre retire ce logo (matiere.dos.logo = false)
//     et TotemDos le redessine lui-même, dans cet ordre : la rosace (sauf
//     pose.dos.rosace = false), la couche « dos », la lune (à pose.dos.lune
//     si on la déplace), la couche « dos-devant », le logotype (cy 1222) ;
//   · la face, la marge : TotemFace est rendu dans le motif, sous le
//     portrait (942 de côté, à 41 du bord) : couche « face-cadre », qui ne
//     se voit que dans la marge (41 tout autour, 983 → 1024 sous le
//     portrait) ; une silhouette coupée par le bord, ton sur ton ;
//   · la face, le portrait : TotemPortrait est rendu par bola-card.tsx
//     par-dessus la photo (ou les rayures), coupé au portrait, sur la carte
//     complète seulement : couche « face-portrait », un gaufrage (une arête
//     de lumière, une ombre) dans un coin bas du portrait. Le sceau et les
//     cartons, tamponnés dans ce même coin (x 96 → 286, y 736 → 926), passent
//     avant lui : bola-card.tsx ne pose pas le totem quand l'un d'eux est porté.
// Jamais sur le visage (ZONES_TOTEM.visage), jamais sur la bande du bas
// (dès 1024 : nom, note, stats), ni sur le symbole et l'étiquette (en haut à
// gauche), le numéro (en haut à droite), la puce (en bas à droite) :
// controlerPose() le dit, et le banc de capture l'écrit.
//
// Mode d'emploi pour dessiner un totem (totems/<nation>.tsx) :
//   1. les tracés, à la main, en béziers (C, Q, S), dans la boîte du totem
//      (0 0 boite.w boite.h ; 1000 × 1000 par défaut) : des constantes de
//      chaînes `d`, pas de génération au hasard pour la silhouette ;
//   2. Dessin({ couche, tons, graine, photo, id }) rend des éléments SVG
//      dans la boîte, ou null pour une couche dont on ne veut pas ; tons :
//      l'encre de la carte (« r,g,b »), le clair et le foncé du motif,
//      sombre ; les ids des <linearGradient>/<clipPath> se suffixent de id ;
//   3. les poses (types.ts, PoseTotem) dans le repère de la carte :
//      pose.dos (devant, lune), pose.face.cadre, pose.face.portrait ;
//   4. dessine: true, une phrase (quoi), les sources (anatomie, objets).
// Interdits : <image>, filtre (filter=, <filter>), police, adresse http, texte.

import type { ReactNode } from "react";
import { LOGO_BOLA } from "@/components/sfl/finitions-carte";
import { RosaceBola } from "@/components/sfl/motif-carte";
import type { CodeNation } from "@/lib/sfl/pack-afrique";
import { SKINS_AFRIQUE } from "./registre";
import { TOTEMS } from "./totems";
import { BANDE, PORTRAIT } from "./outils";
import type { CoucheTotem, PoseTotem, TonsTotem, TotemNation } from "./types";

// Le logo du dos, recopié de dos-carte.tsx (ROSACE, LUNE, LOGOTYPE, BOITE_*) :
// changer l'original et cette copie ensemble.
const ROSACE = { cx: 512, cy: 738, r1: 236, r2: 318 };
const LUNE = 300;
const LOGOTYPE = { cy: 1222, h: 104 };
const BOITE_SYMBOLE = { x: 17, y: 103.485, c: 112.373 };
const BOITE_LOGOTYPE = { x: 150.41, y: 32.445, l: 783.3, h: 183.7 };

type Rect = { x: number; y: number; w: number; h: number };

/** Les zones que le totem laisse lire, dans le repère de la carte. */
export const ZONES_TOTEM = {
  /** La face : le visage du joueur (les yeux à 0,382 du portrait, y 401). */
  visage: { x: 262, y: 120, w: 500, h: 600 },
  /** La face : le symbole et l'étiquette (haut gauche), le numéro (haut droit), la puce (bas droit). */
  symbole: { x: 90, y: 90, w: 420, h: 80 },
  numero: { x: 760, y: 60, w: 200, h: 170 },
  puce: { x: 830, y: 845, w: 105, h: 85 },
  /** La face : la bande du bas (nom, note, stats). */
  bande: { x: 0, y: BANDE, w: 1024, h: 1656 - BANDE },
  /** Le dos : la lune (son disque), le logotype, la ligne de série. */
  lune: { x: ROSACE.cx - LUNE / 2, y: ROSACE.cy - LUNE / 2, w: LUNE, h: LUNE },
  logotype: { x: 160, y: LOGOTYPE.cy - LOGOTYPE.h / 2, w: 704, h: LOGOTYPE.h },
  serie: { x: 0, y: 1540, w: 1024, h: 116 },
} as const satisfies Record<string, Rect>;

/** La transformation d'une pose : la boîte posée en (x, y), à l'échelle, tournée et retournée autour de son centre. */
export function transformDePose(pose: PoseTotem, boite: { w: number; h: number }): string {
  const cx = boite.w / 2;
  const cy = boite.h / 2;
  const t = [`translate(${pose.x} ${pose.y})`, `scale(${pose.echelle})`];
  if (pose.rotation || pose.miroir) {
    t.push(`translate(${cx} ${cy})`);
    if (pose.rotation) t.push(`rotate(${pose.rotation})`);
    if (pose.miroir) t.push("scale(-1 1)");
    t.push(`translate(${-cx} ${-cy})`);
  }
  return t.join(" ");
}

/** La boîte englobante d'une pose dans le repère de la carte (la boîte entière, pas le tracé). */
export function boiteDePose(pose: PoseTotem, boite: { w: number; h: number }): Rect {
  const e = pose.echelle;
  const a = ((pose.rotation ?? 0) * Math.PI) / 180;
  const [cx, cy] = [pose.x + (boite.w * e) / 2, pose.y + (boite.h * e) / 2];
  const [hw, hh] = [(boite.w * e) / 2, (boite.h * e) / 2];
  const w = Math.abs(hw * Math.cos(a)) + Math.abs(hh * Math.sin(a));
  const h = Math.abs(hw * Math.sin(a)) + Math.abs(hh * Math.cos(a));
  return { x: cx - w, y: cy - h, w: 2 * w, h: 2 * h };
}

const croise = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Ce que les poses d'un totem recouvrent (la boîte entière : un tracé plus
 * petit que sa boîte peut passer quand même ; le dire, puis vérifier sur la
 * capture). Vide : rien à redire.
 */
export function controlerPose(t: TotemNation): string[] {
  const dit: string[] = [];
  const portrait = t.pose.face?.portrait;
  if (portrait) {
    const b = boiteDePose(portrait, t.boite);
    for (const z of ["visage", "symbole", "numero", "puce"] as const) if (croise(b, ZONES_TOTEM[z])) dit.push(`face-portrait : la boîte touche ${z}`);
  }
  const cadre = t.pose.face?.cadre;
  if (cadre && croise(boiteDePose(cadre, t.boite), ZONES_TOTEM.bande)) dit.push("face-cadre : la boîte entre dans la bande du bas (nom, note, stats)");
  const dos = boiteDePose(t.pose.dos, t.boite);
  for (const z of ["logotype", "serie"] as const) if (croise(dos, ZONES_TOTEM[z])) dit.push(`dos : la boîte touche ${z}`);
  return dit;
}

/** Les tons de la matière de la nation (au dos, son encre de dos si elle change). */
export function tonsDe(nation: CodeNation, dos: boolean): TonsTotem {
  const m = SKINS_AFRIQUE[nation].matiere;
  const d = dos ? m.dos : undefined;
  return { encre: d?.encre ?? m.encre, sombre: d?.sombre ?? m.sombre, clair: m.motif.clair, fonce: m.motif.fonce };
}

function Pose({ totem, pose, couche, tons, graine, photo, id }: { totem: TotemNation; pose: PoseTotem; couche: CoucheTotem; tons: TonsTotem; graine: number; photo: boolean; id: string }) {
  const { Dessin } = totem;
  const dessin: ReactNode = Dessin({ couche, tons, graine, photo, id: `${id}${couche.replace("-", "")}` });
  if (dessin == null || dessin === false) return null;
  return <g transform={transformDePose(pose, totem.boite)}>{dessin}</g>;
}

const totemDessine = (nation: CodeNation): TotemNation | null => {
  const t = TOTEMS[nation];
  return t?.dessine ? t : null;
};

/** Le dos (dans le motif, motifs-afrique.tsx) : le totem, et le logo s'il passe devant la lune. */
export function TotemDos({ nation, graine, id }: { nation: CodeNation; graine: number; id: string }) {
  const t = totemDessine(nation);
  if (!t) return null;
  const tons = tonsDe(nation, true);
  const p = { totem: t, pose: t.pose.dos, tons, graine, photo: false, id };
  if (!t.pose.dos.devant) return <Pose {...p} couche="dos" />;
  const encre = (a: number) => `rgba(${tons.encre},${a})`;
  const lune = { cx: t.pose.dos.lune?.cx ?? ROSACE.cx, cy: t.pose.dos.lune?.cy ?? ROSACE.cy, d: t.pose.dos.lune?.d ?? LUNE };
  const k = lune.d / LUNE;
  const sLune = lune.d / BOITE_SYMBOLE.c;
  const sLogo = LOGOTYPE.h / BOITE_LOGOTYPE.h;
  return (
    <g>
      {t.pose.dos.rosace !== false && <RosaceBola cx={lune.cx} cy={lune.cy} r1={ROSACE.r1 * k} r2={ROSACE.r2 * k} couleur={encre(0.2)} epaisseur={1.8} />}
      <Pose {...p} couche="dos" />
      <path
        d={LOGO_BOLA.symbole}
        fill={encre(1)}
        fillRule="evenodd"
        transform={`translate(${lune.cx - (BOITE_SYMBOLE.x + BOITE_SYMBOLE.c / 2) * sLune} ${lune.cy - (BOITE_SYMBOLE.y + BOITE_SYMBOLE.c / 2) * sLune}) scale(${sLune})`}
      />
      <Pose {...p} couche="dos-devant" />
      <path
        d={LOGO_BOLA.logotype}
        fill={encre(1)}
        fillRule="evenodd"
        transform={`translate(${512 - (BOITE_LOGOTYPE.x + BOITE_LOGOTYPE.l / 2) * sLogo} ${LOGOTYPE.cy - (BOITE_LOGOTYPE.y + BOITE_LOGOTYPE.h / 2) * sLogo}) scale(${sLogo})`}
      />
    </g>
  );
}

/** La face, sous le portrait (dans le motif) : ne se voit que dans la marge. */
export function TotemFace({ nation, graine, id }: { nation: CodeNation; graine: number; id: string }) {
  const t = totemDessine(nation);
  const pose = t?.pose.face?.cadre;
  if (!t || !pose) return null;
  return <Pose totem={t} pose={pose} couche="face-cadre" tons={tonsDe(nation, false)} graine={graine} photo={false} id={id} />;
}

/**
 * La face, sur le portrait (bola-card.tsx, carte complète) : un <svg> posé
 * dans la boîte du portrait, au repère de la carte (viewBox 41 41 942 942),
 * coupé par le portrait.
 */
export function TotemPortrait({ nation, graine, photo, id }: { nation: CodeNation; graine: number; photo: boolean; id: string }) {
  const t = totemDessine(nation);
  const pose = t?.pose.face?.portrait;
  if (!t || !pose) return null;
  return (
    <svg
      aria-hidden
      viewBox={`${PORTRAIT.x} ${PORTRAIT.y} ${PORTRAIT.c} ${PORTRAIT.c}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <Pose totem={t} pose={pose} couche="face-portrait" tons={tonsDe(nation, false)} graine={graine} photo={photo} id={id} />
    </svg>
  );
}
