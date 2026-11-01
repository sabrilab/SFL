"use client";

// La carte joueur Bola — version finale (validée le 15/10), affinée le 23/10.
//
// Toujours le papier de la carte officielle de l'app iPhone
// (Composants/Carte/CarteDessin.swift) — microtexte gravé, lignes de scan,
// reflet, repères d'angle, puce, note en italique à frange, filet pointillé
// et numéro de série — et le nom en Anton de la carte SFL d'avant. La carte
// est construite au nombre d'or, et le visage passe devant tout le reste.
//
// La construction (repère 1024 × 1656, soit 1 × φ) :
//   - le portrait est un carré de 942, bord à bord à une marge de 41 ;
//   - la bande du dessous fait 581 = 942 ÷ φ : la note occupe son carré de
//     gauche (581 × 581), le nom et les stats la colonne de droite (361 =
//     581 ÷ φ), elle-même coupée en un rectangle pour le nom (220 = 361 ÷ φ)
//     et un carré pour les six stats ;
//   - les yeux tombent à 0,382 de la hauteur du portrait (le recadrage de
//     recadrer-photo.tsx porte ce repère) ;
//   - les coins : 92 = 1024 ÷ φ⁵, le portrait concentrique (Sabri, 23/10 :
//     « un peu plus fine et un peu plus belle, avec des bords arrondis ») ;
//     les traits sont plus fins, et un rebord de lumière en haut à gauche,
//     d'ombre en bas à droite, arrondit la tranche.
//
// Belle en petit : au lieu de rétrécir tout, la carte retire des couches
// selon sa largeur à l'écran (254 px × size) :
//   - complète  (≥ 170 px) : tout ;
//   - compacte  (100–170)  : portrait resserré sur le visage, note, nom, poste ;
//   - réduite   (70–100)   : portrait, note centrée, numéro ;
//   - pastille  (< 70)     : un carré, le visage et la note dans un onglet
//                            (classements, plan, listes).
//
// La matière (finitions-carte.ts) : la carte de saison sur son papier blanc
// cassé, ou la finition que le joueur porte (nuit, chrome, animée) ; une
// carte à titre dans la sienne, MVP (or, rayons), Impact (rouge, ondes de
// choc) ou Défensive (cobalt, alvéoles). Le motif est gravé ton sur ton
// (motif-carte.tsx), le dos est de la même matière (dos-carte.tsx).
//
// Le numéro de maillot s'affiche en haut à droite du portrait quand le joueur
// en a un ; sinon, sur la carte complète, son poste prend la place.
//
// Avec `badge` (les cartes de la ligue, PlayerCard), le badge que le joueur a
// choisi est dans la bande, au-dessus de la note et à gauche du nom : une
// bulle imprimée à l'encre de la carte qui le dit en toutes lettres, son
// objet 3D au bout (insigne-carte.tsx ; Sabri, 24/10 : « essaie de le mettre
// juste au-dessus de la grande note […] une espèce de bulle et, peut-être au
// bout, le badge »). Il était en haut à droite du portrait depuis le 17/10,
// dans un écusson, et on ne le reconnaissait pas. Les coins du portrait
// reprennent l'étiquette et le numéro (ou le poste).
//
// La ligne de série, en bas : le numéro de la carte, puis le sigle SFL de la
// ligue (sfl.svg), à la place de « lot s1 ». « Sunday Five League » n'est
// plus écrit sur la carte (Sabri, 23/10). Elle est rentrée de 92 ÷ φ aux
// deux bouts, pour rester loin des coins arrondis.
//
// L'habillage (habillage-carte.tsx, ce que le joueur porte de la passe) : la
// photo traitée (argentique, gravure, marbre), le liseré d'argent ou platine
// autour du portrait et ses coins un par cran, le sceau sur la photo, la
// puce noire, son nom gravé dans le microtexte, l'insigne de son rang après
// l'étiquette. `data-habillage` le redit au dos de la 3D.
//
// Une carte d'époque (`epoque`, la carte d'une saison close qui a son
// édition d'époque, Sabri 24/10 ; finitions-carte.ts, lib/sfl/epoques.ts)
// garde cette disposition dans les visuels de son temps : la saison 0, son
// papier et ses coups de pinceau, ou sa carte Boost, son cadre de métal et
// sa lumière ; le sigle SFL souligné de sa barre à la place du symbole, le
// poste dans l'accent d'alors (ou l'emblème d'une carte Boost), la frange de
// la note dans cet accent, les libellés en capitales, le losange au ballon à
// la place de la puce, et sa date d'émission et son numéro dans la ligne de
// série. Ni badge, ni habillage : elle est restée telle qu'elle a été émise.
//
// La carte d'un gardien (poste G, Sabri 31/10) : la même carte, ses six cases
// sous des stats de gardien (plo, réf, dég, jma, pla, phy ; lib/sfl/gardien.ts)
// et « gardien » dans l'étiquette. Sans icônes : Sabri a essayé au trait puis en
// plein, et préféré les mots (31/10).
//
// La carte d'un arbitre (`edition="arbitre"`, `arbitre` ; carte-arbitre.tsx,
// Sabri 24/10) garde toute cette disposition, dans le jaune fluo de sa chasuble
// (skins-arbitre.ts) ou le skin qu'il porte : sa satisfaction à la place de la note, ses chiffres
// (matchs arbitrés, notes reçues…) à la place des six stats.
//
// Mêmes calques que la carte éditoriale (`data-card-part` body / player /
// stats) : la 3D de card-3d.tsx mesure la carte et la prend telle quelle,
// avec sa parallaxe — le portrait flotte au-dessus du papier, le texte
// au-dessus du portrait. `data-matiere` et `data-nom` lui disent quel dos
// dessiner, `data-emission` ce qu'une carte d'époque y écrit.

import { BulleBadge } from "@/components/sfl/insigne-carte";
import {
  graine,
  lisereDe,
  MATIERES,
  matiereDe,
  microtexte,
  microtexteGrave,
  PUCE_NOIRE,
  RAYON_CARTE,
  RAYON_PORTRAIT,
  serieDe,
  type HabillageCarte,
  type Traitement,
} from "@/components/sfl/finitions-carte";
import { Cartons, Crans, filtrePhoto, InsigneRang, Lisere, Sceau, Sifflet, VoileTraitement, type Boite } from "@/components/sfl/habillage-carte";
import { GRADES, type FinitionArbitre, type GradeArbitre } from "@/components/sfl/skins-arbitre";
import { BordEpoque, EmblemeEpoque, LosangeBallon, SigleSfl, SigleSouligne } from "@/components/sfl/marques-carte";
import { MotifCarte } from "@/components/sfl/motif-carte";
import type { BadgeCarte } from "@/lib/sfl/badge-carte";
import { STAT_KEYS, type StatKey, type Stats } from "@/lib/sfl/engine";
import { abrege, estGardien } from "@/lib/sfl/gardien";
import { ligneDEmission, type EmissionCarte } from "@/lib/sfl/epoques";

export type BolaEdition = "base" | "rare" | "mvp" | "impact" | "def" | "arbitre";

/**
 * La carte d'un arbitre (carte-arbitre.tsx) : sa satisfaction à la place de
 * la note de joueur, et ses chiffres à la place des six stats.
 */
export interface FaceArbitre {
  /** La satisfaction, de 0 à 99 ; « – » tant qu'il n'a pas de note. */
  note: string;
  /** Ses chiffres, deux par rangée : [« mat », 12]. */
  stats: [string, string | number][];
  /** Le skin de tenue qu'il porte (skins-arbitre.ts), et son grade dans l'étiquette (passe-arbitre.ts). */
  finition?: FinitionArbitre | null;
  grade?: GradeArbitre | null;
}
type Palier = "complete" | "compacte" | "reduite" | "pastille";

const W = 1024;
const H = 1656;
const M = 41;
const ANTON = "var(--font-anton), Anton, sans-serif";
const SANS = "var(--font-inter), Inter, system-ui, sans-serif";
const MONO = "var(--font-inter), system-ui, sans-serif";

// Le nombre d'or, cote par cote (repère 1024 × 1656).
const PHI = (1 + Math.sqrt(5)) / 2;
const PORTRAIT = { x: M, y: M, c: W - M * 2 }; // 942
const BANDE = PORTRAIT.y + PORTRAIT.c + M; // 1024
const NOTE_C = 581; // 942 ÷ φ
const COL_X = M + NOTE_C; // 622, colonne de droite (361 de large)
const NOM_H = 220; // 361 ÷ φ
const FILET = BANDE + NOTE_C; // 1605
const SERIE = 1621;
const SERIE_X = RAYON_CARTE / PHI; // 57 : la série rentrée, loin des coins
// La bulle du badge : son objet à la marge, entre le bas du portrait (983)
// et le haut des chiffres de la note (~1160) ; elle s'arrête avant la colonne du nom.
const BULLE = { x: M, centre: 1078, fin: COL_X - 22 };
// Le cadre du portrait (liseré, crans) : 12 autour, concentrique.
const CADRE: Boite = {
  x: PORTRAIT.x - 12,
  y: PORTRAIT.y - 12,
  w: PORTRAIT.c + 24,
  h: PORTRAIT.c + 24,
  r: RAYON_PORTRAIT + 12,
};

/** Le palier d'une carte selon sa largeur à l'écran. */
export function palierCarte(largeurPx: number): Palier {
  if (largeurPx < 70) return "pastille";
  if (largeurPx < 100) return "reduite";
  if (largeurPx < 170) return "compacte";
  return "complete";
}

/** La hauteur du sigle SFL d'une carte d'époque, en haut à gauche du portrait. */
const SIGLE_H = 46;

/** Une couleur « #rrggbb » à l'opacité voulue. */
const opaque = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;

/** Le portrait : la photo du joueur, ou à défaut son initiale en filigrane sur les rayures. */
function Portrait({
  photo,
  nom,
  resserre,
  encre,
  rayures,
  lueur,
  pas,
  cote,
  traitement,
  u,
}: {
  photo?: string | null;
  nom: string;
  /** Resserré sur le visage (cartes petites). */
  resserre: boolean;
  encre: string;
  rayures: number;
  lueur: string;
  /** Largeur d'une rayure, en px à l'écran. */
  pas: number;
  /** Le côté du portrait, en px à l'écran. */
  cote: number;
  /** Le traitement de la photo (habillage), et l'échelle de la carte. */
  traitement?: Traitement;
  u: (n: number) => number;
}) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-linear-gradient(45deg, transparent 0 ${pas}px, rgba(${encre},${rayures}) ${pas}px ${pas * 1.9}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 40%, ${lueur}, rgba(255,255,255,0) 62%)`,
        }}
      />
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          crossOrigin={photo.startsWith("data:") ? undefined : "anonymous"}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "50% 38%",
            transform: resserre ? "scale(1.24)" : undefined,
            transformOrigin: "50% 36%",
            filter: filtrePhoto(traitement),
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            fontFamily: ANTON,
            fontSize: cote * 0.62,
            lineHeight: 1,
            color: `rgba(${encre},0.1)`,
          }}
        >
          {nom.slice(0, 1).toUpperCase()}
        </div>
      )}
      {photo && <VoileTraitement traitement={traitement} u={u} />}
    </>
  );
}

/**
 * La note taillée en biseau (matières à `chiffres: "biseau"`, le verre) : un
 * chiffre creux dans la plaque. Son ombre tombe dans l'épaisseur (en bas à
 * droite), une arête de lumière le borde en haut à gauche, et sa face est
 * taillée en deux facettes : celle du haut prend la lumière, celle du bas
 * reste dans le verre. Même place, même taille que la note ordinaire.
 */
function NoteBiseau({
  note,
  place,
  u,
  encre,
}: {
  note: number | string;
  place: { left: number; top: number; width: number; align: "left" | "center"; fs: number };
  u: (n: number) => number;
  encre: (a: number) => string;
}) {
  const base = {
    position: "absolute" as const,
    top: u(place.top),
    width: u(place.width),
    textAlign: place.align,
    fontFamily: SANS,
    fontWeight: 900,
    fontStyle: "italic" as const,
    fontSize: u(place.fs),
    letterSpacing: u(-18),
    lineHeight: 1,
  };
  const couches = [
    // L'ombre, dans l'épaisseur du verre.
    { dx: 7, dy: 9, color: "rgba(0,0,0,0.24)", stroke: `${u(5)}px rgba(0,0,0,0.42)` },
    // L'arête de lumière.
    { dx: -3, dy: -3, color: "transparent", stroke: `${u(3)}px rgba(255,255,255,0.42)` },
    // La face, et son contour.
    { dx: 0, dy: 0, color: encre(0.08), stroke: `${u(3.5)}px ${encre(0.96)}` },
  ];
  return (
    <>
      {couches.map((c, i) => (
        <div key={i} style={{ ...base, left: u(place.left + c.dx), marginTop: u(c.dy), color: c.color, WebkitTextStroke: c.stroke }}>
          {note}
        </div>
      ))}
      {/* La facette du haut, qui prend la lumière : la face, coupée en biais. */}
      <div
        style={{
          ...base,
          left: u(place.left),
          color: encre(0.34),
          clipPath: "polygon(0 0, 100% 0, 100% 34%, 0 60%)",
        }}
      >
        {note}
      </div>
    </>
  );
}

export function BolaCard({
  name,
  affiche,
  username,
  position,
  overall,
  stats,
  edition = "base",
  highlightStats,
  size = 1,
  photo,
  numero,
  onglet,
  badge,
  habillage: habillageDemande,
  epoque,
  arbitre,
}: {
  name: string;
  /** Le nom montré sur la carte, s'il diffère du nom de saison (voir lib/sfl/identites). */
  affiche?: string;
  username?: string;
  position: string;
  overall: number;
  stats: Stats;
  edition?: BolaEdition;
  highlightStats?: StatKey[];
  size?: number;
  /** La photo posée par le joueur (URL ou data URL), recadrée en carré. */
  photo?: string | null;
  /** Le numéro de maillot, quand le joueur en a un. */
  numero?: number | null;
  /** Pastille seulement : l'onglet de la note aux couleurs d'une équipe (feuille de match). */
  onglet?: { fond: string; encre: string };
  /** Le badge choisi, dans sa bulle au-dessus de la note (carte complète) ; null ou absent : pas de bulle. */
  badge?: BadgeCarte | null;
  /** Ce que le joueur porte sur sa carte (finitions-carte.ts). */
  habillage?: HabillageCarte;
  /** Une carte d'une saison close qui a son édition d'époque : sa saison, sa date d'émission, son numéro. */
  epoque?: EmissionCarte | null;
  /** La carte d'un arbitre : sa satisfaction et ses chiffres (avec l'édition « arbitre »). */
  arbitre?: FaceArbitre;
}) {
  // 254 px de large à taille 1, comme les autres cartes de l'app.
  const largeur = 254 * size;
  const u = (n: number) => n * size * (254 / W);
  const palier = palierCarte(largeur);
  // L'arbitre a sa matière à lui (ou le skin de tenue qu'il porte), sans époque.
  const p = edition === "arbitre" ? MATIERES[arbitre?.finition ?? "arbitre"] : matiereDe(edition, habillageDemande, epoque?.saison);
  const note = arbitre ? arbitre.note : overall;
  // Un gardien (poste G) : les mêmes six cases, sous des stats de gardien (lib/sfl/gardien.ts).
  const gardien = !arbitre && estGardien(position);
  // Une carte d'époque est restée telle qu'elle a été émise : sans habillage ni badge.
  const era = p.epoque;
  const habillage = era ? undefined : habillageDemande;
  const encre = (a: number) => `rgba(${p.encre},${a})`;
  const seed = graine(name);
  const { serie, numero: numeroSerie } = serieDe(name, p.nom === "fondateur" ? habillage : undefined);
  const emission = p.epoque ? ligneDEmission(epoque ?? { saison: p.epoque.saison, le: null, n: null, sur: null }) : null;
  const nomUp = (affiche ?? name).toUpperCase();

  // La pastille : un carré, le visage, la note dans un onglet.
  if (palier === "pastille") {
    return (
      <div
        data-card-part="body"
        data-matiere={p.nom}
        style={{
          position: "relative",
          width: largeur,
          height: largeur,
          borderRadius: "24%",
          overflow: "hidden",
          background: p.papier,
          boxShadow: `inset 0 0 0 1px ${encre(0.16)}, 0 2px 6px rgba(0,0,0,0.28)`,
        }}
      >
        <div
          data-card-part="player"
          style={{
            position: "absolute",
            inset: "7%",
            borderRadius: "20%",
            overflow: "hidden",
            isolation: "isolate",
            background: p.fond,
          }}
        >
          <Portrait
            photo={photo}
            nom={name}
            resserre
            encre={p.encre}
            rayures={p.rayures}
            lueur={p.lueur}
            pas={Math.max(2, largeur / 18)}
            cote={largeur * 0.86}
            traitement={habillage?.traitement}
            u={u}
          />
        </div>
        <div
          data-card-part="stats"
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            minWidth: "48%",
            height: "36%",
            padding: "0 7%",
            boxSizing: "border-box",
            borderTopLeftRadius: largeur * 0.12,
            background: onglet?.fond ?? encre(1),
            color: onglet?.encre ?? (p.sombre ? "#08090b" : "#f4f5f2"),
            // Un onglet clair sur le papier clair : un filet le détache.
            boxShadow: onglet ? `inset 1px 1px 0 ${onglet.encre}33` : undefined,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: SANS,
            fontWeight: 900,
            fontStyle: "italic",
            fontSize: largeur * 0.25,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          {note}
        </div>
      </div>
    );
  }

  const complete = palier === "complete";
  const compacte = palier === "compacte";
  const reduite = palier === "reduite";

  const mono = (fs: number, ls = 0, a = 1, w = 500) => ({
    fontFamily: MONO,
    fontSize: u(fs),
    letterSpacing: u(ls),
    fontWeight: w,
    color: encre(a),
    lineHeight: 1,
  });

  // Les repères d'angle du portrait (carte complète seulement), au trait fin.
  const coin = (pos: React.CSSProperties, rot: number) => (
    <div
      style={{
        position: "absolute",
        width: u(40),
        height: u(40),
        borderTop: `${u(3)}px solid ${encre(p.coins)}`,
        borderLeft: `${u(3)}px solid ${encre(p.coins)}`,
        borderTopLeftRadius: u(6),
        transform: `rotate(${rot}deg)`,
        ...pos,
      }}
    />
  );

  // Le haut à droite du portrait : le numéro de maillot ; sinon le poste, en grand format seulement.
  // Une carte d'époque : le poste, ou rien sous l'emblème d'une carte Boost.
  // Le badge n'est plus dans le coin : il est dans sa bulle, sur la bande.
  // Un arbitre n'a ni numéro ni poste : son étiquette le dit déjà.
  const marque = arbitre
    ? null
    : era
      ? era.embleme || !complete
        ? null
        : position.toUpperCase()
      : numero != null
        ? String(numero)
        : complete
          ? position.toUpperCase()
          : null;
  const portraitProps = {
    photo,
    nom: name,
    resserre: !complete,
    encre: p.encre,
    rayures: p.rayures,
    lueur: p.lueur,
    pas: u(34),
    cote: u(PORTRAIT.c),
    traitement: habillage?.traitement,
    u,
  };
  // L'habillage porté (habillage-carte.tsx).
  const signes = habillage?.signes ?? [];
  // La puce noire : ses contacts en argent ; sinon, des filets d'encre sur le métal de la carte.
  const puceNoire = signes.includes("puce-noire");
  const contacts = puceNoire ? "rgba(214,218,226,0.62)" : "rgba(8,9,11,0.22)";
  const lisere = lisereDe(habillage);
  const cran = habillage?.cran ?? 0;
  const sceau = complete && signes.includes("sceau");
  const nomGrave = complete && signes.includes("nom-grave");
  const sifflet = complete && signes.includes("sifflet");
  const cartons = complete && signes.includes("cartons");
  const tailleMarque = !era && numero != null ? (complete ? 164 : compacte ? 225 : 287) : 80;
  const halo = p.sombre ? "rgba(8,9,11,0.55)" : "rgba(255,255,255,0.7)";
  // La gravure en creux : l'ombre en haut à gauche, la lumière en bas à droite.
  const gravure = p.gravure
    ? `drop-shadow(-${u(2)}px -${u(2)}px 0 ${p.gravure.ombre}) drop-shadow(${u(2)}px ${u(3)}px 0 ${p.gravure.lumiere})`
    : null;

  // La note : dans son carré, centrée sur toute la largeur en réduite.
  const place = reduite
    ? { left: 0, top: 1065, width: W, align: "center" as const, fs: 512 }
    : { left: 26, top: complete ? 1101 : 1096, width: NOTE_C + 40, align: "left" as const, fs: complete ? 450 : 420 };

  const tailleNom = complete
    ? Math.min(118, (W - M - COL_X) / (0.46 * Math.max(4, nomUp.length)))
    : Math.min(150, (W - M - COL_X) / (0.54 * Math.max(4, nomUp.length)));

  return (
    <div
      data-card-part="body"
      data-matiere={p.nom}
      data-nom={name}
      data-habillage={habillage ? JSON.stringify(habillage) : undefined}
      data-emission={era && epoque ? JSON.stringify(epoque) : undefined}
      style={{
        position: "relative",
        width: u(W),
        height: u(H),
        borderRadius: u(RAYON_CARTE),
        overflow: "hidden",
        background: p.papier,
        // Le rebord : un filet, la lumière en haut à gauche, l'ombre en bas à droite.
        boxShadow: [
          `inset 0 0 0 ${u(2)}px ${encre(0.12)}`,
          `inset ${u(3)}px ${u(4)}px ${u(3)}px -${u(1)}px ${p.rebord.lumiere}`,
          `inset -${u(3)}px -${u(5)}px ${u(5)}px -${u(1)}px ${p.rebord.ombre}`,
          // Le verre : son épaisseur, une arête claire tout autour et la lumière prise dans la masse.
          ...(p.transparente
            ? [`inset 0 0 0 ${u(7)}px rgba(214,255,232,0.1)`, `inset 0 0 ${u(46)}px rgba(214,255,232,0.14)`]
            : []),
          "0 14px 38px rgba(0,0,0,0.5)",
        ].join(", "),
        // Ce qu'il y a derrière le verre, un peu flou (la 3D, elle, le laisse net).
        ...(p.transparente && { backdropFilter: `blur(${u(14)}px) saturate(1.2)`, WebkitBackdropFilter: `blur(${u(14)}px) saturate(1.2)` }),
        fontFamily: SANS,
        color: encre(1),
      }}
    >
      {/* La matière : le motif gravé ton sur ton (or, rouge, cobalt, nuit) */}
      {p.motif && <MotifCarte motif={p.motif} graine={seed} eclats={false} nom={affiche ?? name} />}
      {/* Le papier : microtexte gravé et lignes de scan */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: u(18),
          overflow: "hidden",
          ...mono(24, 2, complete ? p.micro : p.micro * 0.6, 400),
          lineHeight: `${u(25)}px`,
          wordBreak: "break-all",
        }}
      >
        {nomGrave
          ? microtexteGrave(seed, 2600, name).map((m, i) =>
              m.nom ? (
                <span key={i} style={{ color: encre(Math.min(0.4, p.micro * 2.6)), fontWeight: 700 }}>
                  {m.texte}
                </span>
              ) : (
                m.texte
              )
            )
          : microtexte(seed, 2600)}
      </div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-linear-gradient(0deg, ${encre(0.022)} 0 ${u(3)}px, transparent ${u(3)}px ${u(9)}px)`,
        }}
      />
      {/* Le reflet : une bande diagonale, à peine (qui passe d'elle-même sur la finition animée). */}
      {p.anime ? (
        <div
          aria-hidden
          className="carte-lumiere"
          data-card-part="lumiere"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "-60%",
            width: "220%",
            background: `linear-gradient(105deg, transparent 38%, rgba(255,255,255,${p.reflet}) 47%, rgba(214,236,255,0.5) 50%, rgba(255,214,236,0.4) 53%, transparent 62%)`,
          }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(115deg, transparent 30%, rgba(255,255,255,${p.reflet}) 45%, transparent 60%)`,
          }}
        />
      )}

      {/* Le verre : la lumière qui se décompose au bas de la plaque, en bandes arc-en-ciel qui s'effacent vers le haut */}
      {p.irise && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: u(560),
            background: [
              "linear-gradient(104deg, rgba(255,110,140,0) 2%, rgba(255,120,150,0.62) 12%, rgba(255,214,120,0.62) 21%, rgba(170,255,170,0.55) 30%, rgba(110,220,255,0.62) 39%, rgba(176,140,255,0.6) 48%, rgba(255,140,220,0) 58%, rgba(255,140,170,0.42) 68%, rgba(255,230,140,0.42) 76%, rgba(140,240,255,0.42) 84%, rgba(190,150,255,0.36) 91%, rgba(190,150,255,0) 99%)",
            ].join(", "),
            maskImage: "linear-gradient(0deg, #000 0%, rgba(0,0,0,0.55) 38%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(0deg, #000 0%, rgba(0,0,0,0.55) 38%, transparent 100%)",
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* Le cadre de métal d'une carte d'époque, et le filet des cartes Boost */}
      {era && <BordEpoque epoque={era} />}

      {/* Le cadre du portrait que le joueur a gagné : le liseré, puis ses coins un par cran */}
      {complete && lisere && <Lisere metal={lisere} boite={CADRE} />}
      {complete && cran > 0 && <Crans cran={cran} metal={lisere ?? "argent"} boite={CADRE} />}

      {/* Le portrait : photo carrée, repères, symbole, étiquette, numéro, puce */}
      <div data-card-part="player" style={{ position: "absolute", inset: 0 }}>
        <div
          style={{
            position: "absolute",
            left: u(PORTRAIT.x),
            top: u(PORTRAIT.y),
            width: u(PORTRAIT.c),
            height: u(PORTRAIT.c),
            borderRadius: u(RAYON_PORTRAIT),
            overflow: "hidden",
            isolation: "isolate",
            background: p.fond,
            // Le serti : un filet d'encre dedans, un liseré de lumière autour.
            boxShadow: `inset 0 0 0 ${u(2)}px ${encre(0.16)}, 0 0 0 ${u(2)}px ${p.rebord.lumiere}`,
          }}
        >
          <Portrait {...portraitProps} />
          {photo && (
            // Un voile en haut : le symbole, l'étiquette et le numéro restent lisibles.
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  p.sombre
                    ? "linear-gradient(180deg, rgba(8,9,11,0.5) 0%, rgba(8,9,11,0) 24%)"
                    : "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 20%)",
              }}
            />
          )}
          {marque && (
            <div
              style={{
                position: "absolute",
                right: u(51),
                top: u(31),
                fontFamily: ANTON,
                fontSize: u(tailleMarque),
                lineHeight: 1,
                letterSpacing: u(-2),
                color: era?.accent ?? (p.chiffres ? encre(0.14) : encre(1)),
                ...(p.chiffres && { WebkitTextStroke: `${u(3)}px ${encre(0.95)}` }),
                textShadow: p.chiffres
                  ? `${u(3)}px ${u(4)}px 0 rgba(0,0,0,0.45), -${u(2)}px -${u(2)}px 0 rgba(255,255,255,0.35)`
                  : photo
                    ? `0 0 ${u(18)}px ${halo}`
                    : undefined,
                ...(gravure && { filter: gravure }),
              }}
            >
              {marque}
            </div>
          )}
          {era?.embleme && complete && (
            <span className="absolute flex" style={{ right: u(46), top: u(40) }}>
              <EmblemeEpoque cote={u(124)} epoque={era} />
            </span>
          )}
          {complete && (
            <>
              {coin({ left: u(31), top: u(31) }, 0)}
              {coin({ right: u(31), top: u(31) }, 90)}
              {coin({ right: u(31), bottom: u(31) }, 180)}
              {!sceau && coin({ left: u(31), bottom: u(31) }, 270)}
              {era ? (
                // Le sigle SFL souligné de sa barre, comme le logo des cartes d'alors.
                <span style={{ position: "absolute", left: u(61), top: u(56), display: "flex" }}>
                  <SigleSouligne hauteur={u(SIGLE_H)} epoque={era} />
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.symbole}
                  alt=""
                  style={{ position: "absolute", left: u(61), top: u(61), width: u(51), height: u(51), ...(gravure && { filter: gravure }) }}
                />
              )}
              {/* Après le symbole : l'étiquette d'édition (base, ou le titre de la carte), puis le rang */}
              <div
                style={{
                  position: "absolute",
                  left: u(era ? 61 + (SIGLE_H * 735) / 237 + 24 : 133),
                  top: u(56),
                  height: u(62),
                  display: "flex",
                  alignItems: "center",
                  gap: u(18),
                }}
              >
                <div
                  style={{
                    height: u(51),
                    padding: `0 ${u(18)}px`,
                    boxSizing: "border-box",
                    borderRadius: u(10),
                    display: "flex",
                    alignItems: "center",
                    background: p.etiquette.fond,
                    border: `${u(2)}px solid ${p.etiquette.bord}`,
                    ...mono(26, 2.5, 1, 700),
                    color: p.etiquette.texte,
                  }}
                >
                  {p.titre}
                </div>
                {habillage?.rang && <InsigneRang rang={habillage.rang} hauteur={u(82)} />}
                {arbitre?.grade && (
                  <div
                    style={{
                      height: u(51),
                      padding: `0 ${u(16)}px`,
                      boxSizing: "border-box",
                      borderRadius: u(10),
                      display: "flex",
                      alignItems: "center",
                      border: `${u(2)}px solid ${encre(0.7)}`,
                      ...mono(26, 2.5, 1, 700),
                      color: encre(0.92),
                    }}
                  >
                    {GRADES[arbitre.grade]}
                  </div>
                )}
              </div>
              {era ? (
                /* Le losange au ballon, qui pointait sous les cartes d'alors */
                <span style={{ position: "absolute", right: u(48), bottom: u(46), display: "flex" }}>
                  <LosangeBallon cote={u(104)} epoque={era} />
                </span>
              ) : (
                /* La puce, dans le métal de la carte */
                <div
                  style={{
                    position: "absolute",
                    right: u(56),
                    bottom: u(61),
                    width: u(87),
                    height: u(67),
                    borderRadius: u(14),
                    background: puceNoire ? PUCE_NOIRE : p.puce,
                    boxShadow: `inset 0 0 0 ${u(2)}px ${contacts}`,
                  }}
                >
                  <div style={{ position: "absolute", left: "50%", top: u(8), bottom: u(8), width: u(2), background: contacts }} />
                  <div style={{ position: "absolute", top: "50%", left: u(8), right: u(8), height: u(2), background: contacts }} />
                </div>
              )}
            </>
          )}
          {/* Les signes d'arbitre : le sifflet au coin haut droit, les cartons au bas de la photo */}
          {sifflet && (
            <span style={{ position: "absolute", right: u(40), top: u(46), width: u(190), height: u(121) }}>
              <Sifflet encre={p.encre} papier={p.sombre ? "rgba(8,9,11,0.35)" : "rgba(255,255,255,0.5)"} largeur={u(190)} />
            </span>
          )}
          {cartons && (
            <span style={{ position: "absolute", left: u(55), top: u(695) }}>
              <Cartons encre={p.encre} papier={p.sombre ? "rgba(8,9,11,0.35)" : "rgba(255,255,255,0.5)"} cote={u(190)} />
            </span>
          )}
          {/* Le sceau, tamponné sur le bas de la photo */}
          {sceau && (
            <span style={{ position: "absolute", left: u(55), top: u(695) }}>
              <Sceau nom={affiche ?? name} encre={p.encre} papier={p.sombre ? "rgba(8,9,11,0.28)" : "rgba(255,255,255,0.4)"} cote={u(190)} />
            </span>
          )}
        </div>
      </div>

      {/* Le texte, au premier plan (gravé en creux dans l'or de la pépite) */}
      <div
        data-card-part="stats"
        style={{
          position: "absolute",
          inset: 0,
          // Sur le verre, ce qu'il y a derrière peut être clair : un halo sombre garde l'encre blanche lisible.
          ...(p.transparente && { filter: `drop-shadow(0 0 ${u(5)}px rgba(0,0,0,0.38))` }),
          ...(gravure && { filter: gravure }),
        }}
      >
        {/* La note, en italique avec sa frange */}
        {p.chiffres === "biseau" && !era ? (
          <NoteBiseau note={note} place={place} u={u} encre={encre} />
        ) : ((era
          ? [
              { dx: -8, a: 0.42 },
              { dx: 6, a: 0.2 },
              { dx: 0, a: 1 },
            ]
          : [
              { dx: -5, a: 0.24 },
              { dx: 5, a: 0.13 },
              { dx: 0, a: 1 },
            ]
        ).map(({ dx, a }, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: u(place.left + dx),
              top: u(place.top),
              width: u(place.width),
              textAlign: place.align,
              fontFamily: SANS,
              fontWeight: 900,
              fontStyle: "italic",
              fontSize: u(place.fs),
              letterSpacing: u(-18),
              lineHeight: 1,
              // Une carte d'époque : la frange dans l'accent d'alors, comme un repérage décalé.
              color: era && a < 1 ? opaque(era.accent, a) : encre(a),
            }}
          >
            {note}
          </div>
        )))}

        {/* Le badge choisi : sa bulle, au-dessus de la note */}
        {complete && badge && !era && <BulleBadge badge={badge} u={u} x={BULLE.x} centre={BULLE.centre} fin={BULLE.fin} encre={p.encre} sombre={p.sombre} />}

        {/* Qui : le nom en Anton, puis le pseudo et le poste (ou le poste seul, en compacte) */}
        {!reduite && (
          <>
            <div
              style={{
                position: "absolute",
                right: u(M),
                top: u(complete ? BANDE + 36 : BANDE + 133),
                width: u(W - M - COL_X + 24),
                textAlign: "right",
                fontFamily: ANTON,
                fontSize: u(tailleNom),
                lineHeight: 1,
                letterSpacing: u(1),
                whiteSpace: "nowrap",
                overflow: "hidden",
                color: era?.nom,
              }}
            >
              {nomUp}
            </div>
            <div
              style={{
                position: "absolute",
                right: u(M),
                top: u(complete ? BANDE + 164 : BANDE + 333),
                textAlign: "right",
                ...(complete ? mono(27, 0, 0.8, 500) : mono(51, 1, 0.8, 700)),
                ...(era && { color: era.libelle }),
              }}
            >
              {complete ? `${username ? `${username} · ` : ""}${gardien ? "gardien" : position.toLowerCase()}` : position.toUpperCase()}
            </div>
          </>
        )}

        {complete && (
          <>
            {/* Les six stats, deux par rangée, dans le carré sous le nom : « vit 84 » (« réf 89 » pour un gardien) */}
            <div
              style={{
                position: "absolute",
                left: u(COL_X + 20),
                top: u(BANDE + NOM_H + 36),
                width: u(W - M - COL_X - 20),
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                rowGap: u(36),
                columnGap: u(16),
              }}
            >
              {(arbitre?.stats ?? STAT_KEYS.map((k) => [k, stats[k]] as const)).map(([k, valeur]) => {
                const actif = highlightStats?.includes(k as StatKey);
                const libelle = gardien ? abrege(k as StatKey, true) : k;
                return (
                  <div key={k} style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: u(12) }}>
                    {era ? (
                      // Les libellés d'alors : en capitales, dans le brun (ou le métal) de l'édition.
                      <span style={{ ...mono(23, 2.5, 1, 700), color: era.libelle }}>{libelle.toUpperCase()}</span>
                    ) : (
                      <span style={mono(26, 1, 0.62, 500)}>{libelle.toLowerCase()}</span>
                    )}
                    <span
                      style={{
                        fontFamily: SANS,
                        fontWeight: 800,
                        fontSize: u(56),
                        lineHeight: 1,
                        minWidth: u(70),
                        textAlign: "right",
                        color: encre(1),
                        textDecoration: actif ? "underline" : "none",
                        textDecorationThickness: u(4),
                        textUnderlineOffset: u(8),
                      }}
                    >
                      {valeur}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Le filet pointillé, puis la série et le sigle de la ligue */}
            <div
              style={{
                position: "absolute",
                left: u(M),
                right: u(M),
                top: u(FILET),
                height: u(2),
                backgroundImage: `repeating-linear-gradient(90deg, ${era ? opaque(era.libelle, 0.6) : encre(0.4)} 0 ${u(10)}px, transparent ${u(10)}px ${u(20)}px)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: u(SERIE_X),
                right: u(SERIE_X),
                top: u(SERIE),
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                ...mono(19, 0.5, 0.75, 500),
                ...(era && { color: era.libelle }),
              }}
            >
              {/* Une carte d'époque : sa date d'émission et son numéro dans la saison */}
              <span>{emission?.date ?? serie}</span>
              <span>{emission ? emission.numero : numeroSerie}</span>
              <SigleSfl hauteur={u(17)} couleur={era ? era.libelle : encre(0.75)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
