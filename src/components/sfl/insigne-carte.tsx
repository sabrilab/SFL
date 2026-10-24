"use client";

// Le badge que le joueur porte sur sa carte (lib/sfl/badge-carte.ts), refait
// deux fois le 24/10. Sabri, d'abord : « Si je vais sur la carte d'Ilyes, son
// badge en haut à droite, c'est un écusson simple. On ne reconnaît pas très
// bien le diamant qui est à l'intérieur […] Il faudrait quelque chose de plus
// visible, plus reconnaissable, plus stylé », et : « essaie de le mettre juste
// au-dessus de la grande note […] à la gauche du prénom […] une espèce de
// bulle et, peut-être au bout, le badge ». Puis, sur la première version
// (des insignes plats, taillés en facettes) : « on dirait des trucs de
// ressources que je télécharge gratuitement sur FreePic […] il faut que
// t'aies vu comment on a poussé les badges, etc., dans les cartes, et il faut
// retrouver la même inspiration […] il ne faut pas que ça fasse AI slop. »
//
// D'où, aujourd'hui :
//   · l'objet est celui des badges de palier, que Sabri aime (« on peut les
//     garder comme ça, c'est plutôt cool ») : le vrai objet 3D en chrome
//     irisé, dans son métal (badge-3d.tsx). La pierre de la Pépite d'Or est
//     vue de profil, sa table, sa couronne et sa culasse, éclairée par le
//     studio du joaillier (rendu.ts) : on la reconnaît même à 20 px, là où,
//     vue d'en haut, elle ressemblait à un œil ;
//   · la bulle est imprimée comme le reste de la carte, à son encre et sur
//     son papier, comme l'étiquette, le sceau ou le microtexte : un filet,
//     puis une ligne de microtexte qui en fait le tour en répétant le nom du
//     badge (« PÉPITE D'OR · 1ER · SAISON 0 · », à lire de près, comme sur
//     un billet), le titre au lettrage de l'app (Inter 900), le rang et la saison
//     en mono dessous. Aucune couleur de métal dans la bulle : l'or, le bleu
//     et le rouge sont aux cartes MVP, Défensive et Impact (Sabri, 24/10),
//     seul l'objet porte son métal.
// L'objet est posé au bout de la bulle, à la marge de la carte : la bulle
// part de son centre, et sa ligne de microtexte commence sous lui (la
// jointure ne se voit pas).
//
// Sur la petite carte (carte-photo.tsx) et dans la feuille de choix, l'objet
// est seul (ObjetBadge). Tout est peint, sans filtre CSS ni flou
// d'arrière-plan dans la carte : html-to-image la capture telle quelle pour
// la 3D, et attend l'image de l'objet (data-attente-3d, badge-3d.tsx).

import { useId } from "react";
import { metalBadge, Objet3D, objetBadge } from "@/components/sfl/badge-3d";
import { EMBLEMES, EMBLEMES_SAISON } from "@/components/sfl/emblemes";
import type { BadgeCarte } from "@/lib/sfl/badge-carte";
import type { Objet } from "@/lib/sfl/badges-3d/objets";
import { CLASSEMENTS, ordinal } from "@/lib/sfl/fin-de-saison";
import { metal, NOM_METAL, TROPHEES, type TropheeId } from "@/lib/sfl/trophees";

const MONO = "var(--font-jbmono), ui-monospace, monospace";

/* ---------------------------------- L'objet ---------------------------------- */

/**
 * La place de chaque objet dans son image (mesurée le 24/10 : le ballon
 * occupe 0,67 du carré en hauteur, la pierre de profil 0,46, le crampon
 * couché 0,34, le terrain 0,49) : `e` agrandit l'image pour que les objets
 * aient tous à peu près la hauteur du ballon, sans qu'un objet couché
 * dépasse sa boîte en largeur ; `dy` recentre l'objet en hauteur (en
 * fraction de l'image, vers le haut).
 */
const EMPRISE: Partial<Record<Objet, { e: number; dy?: number }>> = {
  pepite: { e: 1.42 },
  crampon: { e: 1.45, dy: 0.05 },
  eclair: { e: 1.12 },
  terrain: { e: 1.2, dy: 0.025 },
  trophee: { e: 1, dy: 0.015 },
};

function emprise(objet: Objet) {
  const p = EMPRISE[objet];
  return { e: p?.e ?? 1, dy: p?.dy ?? 0 };
}

/** L'objet d'un badge dans une boîte de `largeur`, centré, à la même taille apparente quel que soit l'objet. */
function Objet({ badge, largeur, ombre }: { badge: BadgeCarte; largeur: number; ombre: boolean }) {
  const objet = objetBadge(badge);
  const { e, dy } = emprise(objet);
  const D = largeur * e;
  const Embleme = badge.famille === "saison" ? EMBLEMES_SAISON[badge.id] : EMBLEMES[badge.id];
  return (
    <span aria-hidden className="pointer-events-none absolute" style={{ left: (largeur - D) / 2, top: (largeur - D) / 2 - D * dy }}>
      <Objet3D objet={objet} matiere={metalBadge(badge)} taille={D} embleme={Embleme} ombre={ombre} />
    </span>
  );
}

/**
 * Le badge en objet seul : la petite carte, la feuille de choix. `ombre` :
 * son ombre portée (un filtre CSS : jamais dans la grande carte, que la 3D
 * capture).
 */
export function ObjetBadge({ badge, largeur, ombre = false }: { badge: BadgeCarte; largeur: number; ombre?: boolean }) {
  return (
    <span role="img" aria-label={`Badge : ${nomInsigne(badge)}`} className="relative block shrink-0" style={{ width: largeur, height: largeur }}>
      <Objet badge={badge} largeur={largeur} ombre={ombre} />
    </span>
  );
}

/* ---------------------------------- Les mots ---------------------------------- */

/** Le nom d'un badge, en toutes lettres : « Pépite d'Or, 1er, Saison 0 », « Buts, Or ». */
export function nomInsigne(b: BadgeCarte): string {
  if (b.famille === "saison") {
    const nom = CLASSEMENTS.find((c) => c.id === b.id)!.nom;
    return `${nom}, ${ordinal(b.rang)}${b.saison ? `, ${b.saison}` : ""}`;
  }
  const m = metal(b.palier)!;
  return `${TROPHEES.find((t) => t.id === b.id)!.nom}, ${NOM_METAL[m]}`;
}

/** Ce qu'un palier dit sur la carte : le seuil atteint (« 25 buts », « MVP ×3 »). */
function titrePalier(id: TropheeId, palier: number): string {
  const def = TROPHEES.find((t) => t.id === id)!;
  const seuil = def.paliers[Math.min(palier, def.paliers.length) - 1];
  switch (id) {
    case "buts":
    case "passes":
    case "matchs":
    case "victoires":
      return `${seuil} ${seuil > 1 ? def.unite[1] : def.unite[0]}`;
    case "mvp":
      return seuil > 1 ? `MVP ×${seuil}` : "MVP du match";
    case "mur":
      return seuil > 1 ? `Le Mur ×${seuil}` : "Le Mur";
    case "impact":
      return seuil > 1 ? `Impact ×${seuil}` : "Impact";
  }
}

/**
 * Ce que la bulle écrit : le classement (« Pépite d'Or », « Buteur »), puis
 * le rang et la saison (« 1er · saison 0 ») ; pour un palier, le seuil
 * atteint, puis le métal (« palier or »).
 */
export function libelleInsigne(b: BadgeCarte): { titre: string; detail: string } {
  if (b.famille === "saison") {
    const nom = CLASSEMENTS.find((c) => c.id === b.id)!.nom;
    return { titre: nom, detail: b.saison ? `${ordinal(b.rang)} · ${b.saison.toLowerCase()}` : ordinal(b.rang) };
  }
  return { titre: titrePalier(b.id, b.palier), detail: `palier ${NOM_METAL[metal(b.palier)!].toLowerCase()}` };
}

/** La chasse des capitales d'une police, de A à Z puis de 0 à 9, en centièmes d'em (mesurées le 24/10). */
function table(az: string, chiffres: string): Record<string, number> {
  const t: Record<string, number> = {};
  az.split(" ").forEach((w, i) => (t[String.fromCharCode(65 + i)] = Number(w) / 100));
  chiffres.split(" ").forEach((w, i) => (t[String(i)] = Number(w) / 100));
  return t;
}

/**
 * La lettre du titre de la bulle : le lettrage de l'app (« MERCREDI » sur la
 * Map, les titres de Ma carte), Inter au plus gras en capitales serrées.
 * L'Anton du nom n'a pas plu à Sabri (24/10). `pas` : l'interlettrage, en
 * em ; `max` : la taille du titre, dans le repère de la carte ; `chasse` : la
 * largeur des capitales, en em, pour calculer la bulle sans la mesurer.
 */
type Lettre = { famille: string; poids: number; italique: boolean; pas: number; max: number; hauteur: number; chasse: Record<string, number>; blanc: number };

const LETTRE: Lettre = {
  famille: "var(--font-inter), Inter, system-ui, sans-serif",
  poids: 900,
  italique: false,
  pas: -0.03,
  max: 37,
  hauteur: 0.9,
  chasse: table("79 67 75 72 61 58 75 75 29 60 76 57 96 77 78 66 79 67 67 69 72 79 108 79 78 69", "71 45 65 67 70 65 67 59 68 67"),
  blanc: 0.25,
};

/** La largeur d'un titre en capitales, en em, interlettrage compris. */
function chasse(texte: string, l: Lettre): number {
  let w = 0;
  for (const c of texte.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) {
    w += l.chasse[c] ?? (c === "×" ? 0.6 : c === " " ? l.blanc : 0.3);
  }
  return w + texte.length * l.pas;
}

/* ---------------------------------- La bulle ---------------------------------- */

// Les cotes de la bulle, dans le repère de la carte (1024 × 1656).
const R = 74; // la demi-boîte de l'objet : la bulle part de son centre
const OBJET = 168; // la boîte de l'objet (avant son emprise)
const H = 122; // la hauteur de la bulle
const BORD = 2.5; // son filet
const MICRO = 11.5; // la ligne de microtexte, depuis le bord
const MICRO_FS = 8.6;
const AVANT = R + 22; // du bord gauche de la bulle au texte
const APRES = 34;
const DETAIL = 23;
const ECART = 9; // entre le titre et le détail

/**
 * La bulle de la grande carte. `u` met les cotes à l'écran, `x` est le bord
 * gauche de l'objet (la marge de la carte), `centre` sa hauteur, `fin` la
 * limite à droite (la colonne du nom commence après) ; `encre` et `sombre`
 * viennent de la matière de la carte (finitions-carte.ts). Le titre se
 * resserre s'il est trop long pour la place. La largeur est calculée, pas
 * mesurée : le tracé du microtexte en dépend, et la capture 3D le reprend tel
 * quel.
 */
export function BulleBadge({
  badge,
  u,
  x,
  centre,
  fin,
  encre,
  sombre,
}: {
  badge: BadgeCarte;
  u: (n: number) => number;
  x: number;
  centre: number;
  fin: number;
  /** L'encre de la carte, « r,g,b ». */
  encre: string;
  sombre: boolean;
}) {
  const id = `b${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const ink = (a: number) => `rgba(${encre},${a})`;
  const cx = x + R;
  const { titre, detail } = libelleInsigne(badge);
  const place = fin - cx - AVANT - APRES;
  const taille = Math.min(LETTRE.max, place / chasse(titre, LETTRE));
  const texte = Math.max(chasse(titre, LETTRE) * taille, detail.length * (0.6 * DETAIL + 0.5));
  const L = Math.min(fin - cx, AVANT + texte + APRES);

  // La ligne de microtexte : partie de l'extrémité gauche (sous l'objet), elle
  // fait le tour dans le sens des aiguilles d'une montre, et le nom s'y répète
  // un nombre entier de fois.
  const r = H / 2 - MICRO;
  const trace = `M${MICRO} ${H / 2} A${r} ${r} 0 0 1 ${H / 2} ${MICRO} H${L - H / 2} A${r} ${r} 0 0 1 ${L - H / 2} ${H - MICRO} H${H / 2} A${r} ${r} 0 0 1 ${MICRO} ${H / 2} Z`;
  const tour = 2 * (L - H) + 2 * Math.PI * r;
  const motif = `${titre} · ${detail} · `.toUpperCase();
  const fois = Math.max(1, Math.round(tour / (motif.length * MICRO_FS * 0.72)));

  return (
    <>
      <div
        role="img"
        aria-label={`Badge : ${nomInsigne(badge)}`}
        style={{ position: "absolute", left: u(cx), top: u(centre - H / 2), width: u(L), height: u(H), pointerEvents: "none" }}
      >
        <svg aria-hidden viewBox={`0 0 ${L} ${H}`} width={u(L)} height={u(H)} style={{ position: "absolute", inset: 0, display: "block", overflow: "visible" }}>
          <defs>
            <path id={id} d={trace} />
          </defs>
          <rect
            x={BORD / 2}
            y={BORD / 2}
            width={L - BORD}
            height={H - BORD}
            rx={(H - BORD) / 2}
            fill={sombre ? "rgba(8,9,11,0.32)" : "rgba(255,255,255,0.5)"}
            stroke={ink(0.55)}
            strokeWidth={BORD}
          />
          <text fill={ink(0.42)} fontFamily={MONO} fontSize={MICRO_FS} fontWeight={600} dominantBaseline="central">
            <textPath href={`#${id}`} xlinkHref={`#${id}`} textLength={tour - 2} lengthAdjust="spacing">
              {motif.repeat(fois)}
            </textPath>
          </text>
        </svg>
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: u(AVANT),
            // Un peu plus bas que le milieu : l'accent des capitales dépasse en haut.
            top: u(5),
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: u(ECART),
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              fontFamily: LETTRE.famille,
              fontWeight: LETTRE.poids,
              fontStyle: LETTRE.italique ? "italic" : "normal",
              fontSize: u(taille),
              lineHeight: LETTRE.hauteur,
              letterSpacing: `${LETTRE.pas}em`,
              color: ink(0.94),
              textTransform: "uppercase",
            }}
          >
            {titre}
          </span>
          <span style={{ fontFamily: MONO, fontSize: u(DETAIL), fontWeight: 600, lineHeight: 1, letterSpacing: u(0.5), color: ink(0.62) }}>{detail}</span>
        </div>
      </div>
      <span aria-hidden className="pointer-events-none absolute" style={{ left: u(cx - OBJET / 2), top: u(centre - OBJET / 2), width: u(OBJET), height: u(OBJET) }}>
        <Objet badge={badge} largeur={u(OBJET)} ombre={false} />
      </span>
    </>
  );
}
