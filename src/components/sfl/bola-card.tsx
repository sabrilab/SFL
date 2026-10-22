"use client";

// La carte joueur Bola — gris et blanc, version finale (validée le 15/10).
//
// Toujours le papier blanc cassé de la carte officielle de l'app iPhone
// (Composants/Carte/CarteDessin.swift) — microtexte gravé, lignes de scan,
// reflet argent, repères d'angle, puce, note en italique à frange, filet
// pointillé et numéro de série — et le nom en Anton de la carte SFL d'avant.
// Ce qui change : la carte est construite au nombre d'or, et le visage passe
// devant tout le reste.
//
// La construction (repère 1024 × 1656, soit 1 × φ) :
//   - le portrait est un carré de 942, bord à bord à une marge de 41 ;
//   - la bande du dessous fait 581 = 942 ÷ φ : la note occupe son carré de
//     gauche (581 × 581), le nom et les stats la colonne de droite (361 =
//     581 ÷ φ), elle-même coupée en un rectangle pour le nom (220 = 361 ÷ φ)
//     et un carré pour les six stats ;
//   - les yeux tombent à 0,382 de la hauteur du portrait (le recadrage de
//     recadrer-photo.tsx porte ce repère).
//
// Belle en petit : au lieu de rétrécir tout, la carte retire des couches
// selon sa largeur à l'écran (254 px × size) :
//   - complète  (≥ 170 px) : tout ;
//   - compacte  (100–170)  : portrait resserré sur le visage, note, nom, poste ;
//   - réduite   (70–100)   : portrait, note centrée, numéro ;
//   - pastille  (< 70)     : un carré, le visage et la note dans un onglet
//                            (classements, plan, listes).
//
// Les éditions : base (papier blanc), rare (argent, repères pleins), et les
// trois cartes à titre en couleur (Sabri, 22/10) : mvp (papier or), impact
// (papier rouge) et def (papier bleu), teintes de teinte-carte.ts. Le numéro de maillot s'affiche en haut à
// droite du portrait quand le joueur en a un ; sinon, sur la carte complète,
// son poste prend la place.
//
// Avec `badge` (les cartes de la ligue, PlayerCard), le haut à droite est au
// badge que le joueur a choisi, un objet en 3D (badge-3d.tsx, demandes de Sabri,
// 17 et 18/10), et le poste passe en haut à gauche, à la place de l'étiquette
// d'édition. `badge: null` : le coin reste vide.
//
// Mêmes calques que la carte éditoriale (`data-card-part` body / player /
// stats) : la 3D de card-3d.tsx mesure la carte et la prend telle quelle,
// avec sa parallaxe — le portrait flotte au-dessus du papier, le texte
// au-dessus du portrait.

import { Badge3D } from "@/components/sfl/badge-3d";
import { TEINTES } from "@/components/sfl/teinte-carte";
import type { BadgeCarte } from "@/lib/sfl/badge-carte";
import { STAT_KEYS, type StatKey, type Stats } from "@/lib/sfl/engine";

export type BolaEdition = "base" | "rare" | "mvp" | "impact" | "def";
type Palier = "complete" | "compacte" | "reduite" | "pastille";

const W = 1024;
const H = 1656;
const M = 41;
const ANTON = "var(--font-anton), Anton, sans-serif";
const SANS = "var(--font-inter), Inter, system-ui, sans-serif";
const MONO = "var(--font-jbmono), ui-monospace, monospace";

// Le nombre d'or, cote par cote (repère 1024 × 1656).
const PHI = (1 + Math.sqrt(5)) / 2;
const PORTRAIT = { x: M, y: M, c: W - M * 2 }; // 942
const BANDE = PORTRAIT.y + PORTRAIT.c + M; // 1024
const NOTE_C = 581; // 942 ÷ φ
const COL_X = M + NOTE_C; // 622, colonne de droite (361 de large)
const NOM_H = 220; // 361 ÷ φ
const FILET = BANDE + NOTE_C; // 1605
const SERIE = 1621;

/** Le palier d'une carte selon sa largeur à l'écran. */
export function palierCarte(largeurPx: number): Palier {
  if (largeurPx < 70) return "pastille";
  if (largeurPx < 100) return "reduite";
  if (largeurPx < 170) return "compacte";
  return "complete";
}

const PALETTES: Record<
  BolaEdition,
  {
    encre: string;
    papier: string;
    fond: string;
    lueur: string;
    rayures: number;
    micro: number;
    reflet: number;
    coins: number;
    etiquette: { fond: string; bord: string; texte: string };
    symbole: string;
    /** Papier sombre : voile et ombres du texte en sombre. */
    sombre: boolean;
    /** Le texte de l'étiquette d'édition. */
    nom: string;
  }
> = {
  base: {
    encre: "8,9,11",
    papier: "linear-gradient(160deg, #fbfbf9 0%, #eeeeea 100%)",
    fond: "#ffffff",
    lueur: "rgba(255,255,255,0.95)",
    rayures: 0.05,
    micro: 0.04,
    reflet: 0.35,
    coins: 0.6,
    etiquette: { fond: "transparent", bord: "rgba(8,9,11,0.55)", texte: "rgba(8,9,11,0.75)" },
    symbole: "/bola/symbole-noir.svg",
    sombre: false,
    nom: "base",
  },
  rare: {
    encre: "8,9,11",
    papier: "linear-gradient(160deg, #f6f6f3 0%, #e4e5e1 55%, #cfd0cb 100%)",
    fond: "#ffffff",
    lueur: "rgba(255,255,255,0.95)",
    rayures: 0.07,
    micro: 0.06,
    reflet: 0.55,
    coins: 1,
    etiquette: { fond: "#08090b", bord: "#08090b", texte: "#f4f5f2" },
    symbole: "/bola/symbole-noir.svg",
    sombre: false,
    nom: "rare",
  },
  // Or : le papier métal, l'encre noire.
  mvp: {
    encre: "28,20,4",
    papier: TEINTES.mvp.cadre,
    fond: "#f1dfa6",
    lueur: "rgba(255,248,220,0.95)",
    rayures: 0.07,
    micro: 0.07,
    reflet: 0.6,
    coins: 1,
    etiquette: { fond: "#1c1404", bord: "#1c1404", texte: "#f2d687" },
    symbole: "/bola/symbole-noir.svg",
    sombre: false,
    nom: "MVP",
  },
  // Rouge et bleu : le papier en couleur, l'encre blanche.
  impact: {
    encre: "255,247,246",
    papier: TEINTES.impact.cadre,
    fond: "#b3161e",
    lueur: "rgba(255,140,140,0.35)",
    rayures: 0.07,
    micro: 0.07,
    reflet: 0.28,
    coins: 1,
    etiquette: { fond: "#fff7f6", bord: "#fff7f6", texte: "#9a0f16" },
    symbole: "/bola/symbole-blanc.svg",
    sombre: true,
    nom: "IMPACT",
  },
  def: {
    encre: "244,248,255",
    papier: TEINTES.def.cadre,
    fond: "#1a4cb5",
    lueur: "rgba(150,190,255,0.35)",
    rayures: 0.07,
    micro: 0.07,
    reflet: 0.28,
    coins: 1,
    etiquette: { fond: "#f4f8ff", bord: "#f4f8ff", texte: "#123c96" },
    symbole: "/bola/symbole-blanc.svg",
    sombre: true,
    nom: "DÉFENSIVE",
  },
};

/** Un entier stable tiré d'un texte (la même carte garde le même microtexte et le même numéro). */
function graine(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ (c.codePointAt(0) ?? 0), 16777619) >>> 0;
  return h;
}

/** Le microtexte « Matrix » de la carte officielle : toujours le même pour un joueur. */
function microtexte(seed: number, n: number): string {
  const jeu = "0123456789bolaBOLA·/";
  let x = seed || 1;
  let s = "";
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    s += jeu[(x >>> 0) % jeu.length];
  }
  return s;
}

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
  /** Le badge du coin ; null = coin vide ; absent = l'ancienne mise en page (numéro ou poste). */
  badge?: BadgeCarte | null;
}) {
  // 254 px de large à taille 1, comme les autres cartes de l'app.
  const largeur = 254 * size;
  const u = (n: number) => n * size * (254 / W);
  const palier = palierCarte(largeur);
  const p = PALETTES[edition];
  const encre = (a: number) => `rgba(${p.encre},${a})`;
  const seed = graine(name);
  const serie = `bola-fr-${String(seed % 1000000).padStart(6, "0")}`;
  const nomUp = (affiche ?? name).toUpperCase();

  // La pastille : un carré, le visage, la note dans un onglet.
  if (palier === "pastille") {
    return (
      <div
        data-card-part="body"
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
          {overall}
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

  // Les repères d'angle du portrait (carte complète seulement).
  const coin = (pos: React.CSSProperties, rot: number) => (
    <div
      style={{
        position: "absolute",
        width: u(46),
        height: u(46),
        borderTop: `${u(4)}px solid ${encre(p.coins)}`,
        borderLeft: `${u(4)}px solid ${encre(p.coins)}`,
        transform: `rotate(${rot}deg)`,
        ...pos,
      }}
    />
  );

  // Le haut à droite du portrait : le numéro de maillot ; sinon le poste, en grand format seulement.
  const avecBadge = badge !== undefined;
  const marque = avecBadge ? null : numero != null ? String(numero) : complete ? position.toUpperCase() : null;
  // Le badge, au nombre d'or lui aussi : le portrait ÷ φ⁴ (137), et
  // autant ÷ φ jusqu'aux bords (85) ; rien en réduite. La complète était à
  // ÷ φ⁵ (85) : trop petit pour reconnaître son badge (Sabri, 19/10).
  const coteBadge = PORTRAIT.c / PHI ** 4;
  const margeBadge = coteBadge / PHI;
  const largeurBadge = u(coteBadge);
  const badgeCoin = badge && !reduite ? badge : null;
  const portraitProps = {
    photo,
    nom: name,
    resserre: !complete,
    encre: p.encre,
    rayures: p.rayures,
    lueur: p.lueur,
    pas: u(34),
    cote: u(PORTRAIT.c),
  };
  const tailleMarque = numero != null ? (complete ? 164 : compacte ? 225 : 287) : 80;

  // La note : dans son carré, centrée sur toute la largeur en réduite.
  const note = reduite
    ? { left: 0, top: 1065, width: W, align: "center" as const, fs: 512 }
    : { left: 26, top: complete ? 1101 : 1096, width: NOTE_C + 40, align: "left" as const, fs: complete ? 450 : 420 };

  const tailleNom = complete
    ? Math.min(118, (W - M - COL_X) / (0.46 * Math.max(4, nomUp.length)))
    : Math.min(150, (W - M - COL_X) / (0.54 * Math.max(4, nomUp.length)));

  return (
    <div
      data-card-part="body"
      style={{
        position: "relative",
        width: u(W),
        height: u(H),
        borderRadius: u(61),
        overflow: "hidden",
        background: p.papier,
        boxShadow: `inset 0 0 0 ${u(3)}px ${encre(0.18)}, 0 14px 38px rgba(0,0,0,0.5)`,
        fontFamily: SANS,
        color: encre(1),
      }}
    >
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
        {microtexte(seed, 2600)}
      </div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-linear-gradient(0deg, ${encre(0.022)} 0 ${u(3)}px, transparent ${u(3)}px ${u(9)}px)`,
        }}
      />
      {/* Le reflet argent : une bande diagonale, à peine (plus marquée en rare). */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(115deg, transparent 30%, rgba(255,255,255,${p.reflet}) 45%, transparent 60%)`,
        }}
      />

      {/* Le portrait : photo carrée, repères, symbole, étiquette, numéro, puce */}
      <div data-card-part="player" style={{ position: "absolute", inset: 0 }}>
        <div
          style={{
            position: "absolute",
            left: u(PORTRAIT.x),
            top: u(PORTRAIT.y),
            width: u(PORTRAIT.c),
            height: u(PORTRAIT.c),
            borderRadius: u(46),
            overflow: "hidden",
            background: p.fond,
            boxShadow: `inset 0 0 0 ${u(3)}px ${encre(0.2)}`,
          }}
        >
          <Portrait {...portraitProps} />
          {photo && (
            // Un voile clair en haut : le symbole, l'étiquette et le numéro restent lisibles.
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
                color: encre(1),
                textShadow: photo ? `0 0 ${u(18)}px ${p.sombre ? "rgba(8,9,11,0.55)" : "rgba(255,255,255,0.7)"}` : undefined,
              }}
            >
              {marque}
            </div>
          )}
          {badgeCoin && (
            <span className="absolute" style={{ left: u(PORTRAIT.c - margeBadge - coteBadge), top: u(margeBadge) }}>
              <Badge3D badge={badgeCoin} largeur={largeurBadge} socle />
            </span>
          )}
          {complete && (
            <>
              {coin({ left: u(31), top: u(31) }, 0)}
              {coin({ right: u(31), top: u(31) }, 90)}
              {coin({ right: u(31), bottom: u(31) }, 180)}
              {coin({ left: u(31), bottom: u(31) }, 270)}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.symbole}
                alt=""
                style={{ position: "absolute", left: u(61), top: u(61), width: u(51), height: u(51) }}
              />
              {/* Le poste, à la place de l'étiquette, quand le coin droit est au badge */}
              {avecBadge ? (
                <div
                  style={{
                    position: "absolute",
                    left: u(133),
                    top: u(56),
                    fontFamily: ANTON,
                    fontSize: u(62),
                    lineHeight: 1,
                    letterSpacing: u(1),
                    color: encre(1),
                    textShadow: photo ? `0 0 ${u(18)}px ${p.sombre ? "rgba(8,9,11,0.55)" : "rgba(255,255,255,0.7)"}` : undefined,
                  }}
                >
                  {position.toUpperCase()}
                </div>
              ) : (
              /* L'étiquette d'édition */
              <div
                style={{
                  position: "absolute",
                  left: u(133),
                  top: u(61),
                  height: u(51),
                  padding: `0 ${u(18)}px`,
                  boxSizing: "border-box",
                  borderRadius: u(10),
                  display: "flex",
                  alignItems: "center",
                  background: p.etiquette.fond,
                  border: `${u(3)}px solid ${p.etiquette.bord}`,
                  ...mono(26, 2.5, 1, 700),
                  color: p.etiquette.texte,
                }}
              >
                {p.nom}
              </div>
              )}
              {/* La puce argent */}
              <div
                style={{
                  position: "absolute",
                  right: u(56),
                  bottom: u(61),
                  width: u(87),
                  height: u(67),
                  borderRadius: u(13),
                  background: "linear-gradient(135deg, #f3f3f1, #b9bab5 45%, #e6e6e3 70%, #a7a8a3)",
                  boxShadow: `inset 0 0 0 ${u(2)}px rgba(8,9,11,0.25)`,
                }}
              >
                <div style={{ position: "absolute", left: "50%", top: u(8), bottom: u(8), width: u(2), background: "rgba(8,9,11,0.25)" }} />
                <div style={{ position: "absolute", top: "50%", left: u(8), right: u(8), height: u(2), background: "rgba(8,9,11,0.25)" }} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Le texte, au premier plan */}
      <div data-card-part="stats" style={{ position: "absolute", inset: 0 }}>
        {/* La note, en italique avec sa frange */}
        {[
          { dx: -5, a: 0.24 },
          { dx: 5, a: 0.13 },
          { dx: 0, a: 1 },
        ].map(({ dx, a }, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: u(note.left + dx),
              top: u(note.top),
              width: u(note.width),
              textAlign: note.align,
              fontFamily: SANS,
              fontWeight: 900,
              fontStyle: "italic",
              fontSize: u(note.fs),
              letterSpacing: u(-18),
              lineHeight: 1,
              color: encre(a),
            }}
          >
            {overall}
          </div>
        ))}

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
              }}
            >
              {complete ? `${username ? `${username} · ` : ""}${position.toLowerCase()}` : position.toUpperCase()}
            </div>
          </>
        )}

        {complete && (
          <>
            {/* Les six stats, deux par rangée, dans le carré sous le nom : « vit 84 » */}
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
              {STAT_KEYS.map((k) => {
                const actif = highlightStats?.includes(k);
                return (
                  <div key={k} style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: u(12) }}>
                    <span style={mono(26, 1, 0.62, 500)}>{k.toLowerCase()}</span>
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
                      {stats[k]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Le filet pointillé, puis la série */}
            <div
              style={{
                position: "absolute",
                left: u(M),
                right: u(M),
                top: u(FILET),
                height: u(3),
                backgroundImage: `repeating-linear-gradient(90deg, ${encre(0.45)} 0 ${u(10)}px, transparent ${u(10)}px ${u(20)}px)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: u(M),
                right: u(M),
                top: u(SERIE),
                display: "flex",
                justifyContent: "space-between",
                ...mono(19, 0.5, 0.75, 500),
              }}
            >
              <span>{serie}</span>
              <span>n° {(seed % 900) + 100} / ∞</span>
              <span>lot s1</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
