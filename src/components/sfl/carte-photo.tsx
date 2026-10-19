"use client";

// La carte joueur en petit : la photo d'abord (Sabri, 19/10 : « dans
// l'onglet Ligue, quand on visionne les petits widgets, tu enlèves et tu
// rapproches. Ça agrandit l'image en laissant les infos en bas »).
//
// La carte classique (bola-card.tsx) reste celle de Ma carte et de tout ce
// qui s'affiche en grand (palier « complète », ≥ 170 px). En dessous, plus
// de papier ni de cadre : la photo remplit la carte, resserrée sur le
// visage, et seul l'essentiel reste en bas, en blanc sur un voile léger qui
// ne commence qu'à la section d'or (1/φ de la hauteur) :
//   · compacte (100–170 px) : le poste, le nom, la note ; le badge en haut ;
//   · réduite  (70–100)     : la note seule (dans l'onglet de l'équipe sur
//                             les terrains) ;
//   · pastille (< 70)       : un carré, le visage, la note dans un onglet
//                             (aux couleurs de l'équipe sur les terrains).
//
// Toujours le repère 1024 × 1656 (1 × φ) et les mêmes calques que la
// classique (`data-card-part` body / player / stats).

import { Badge3D } from "@/components/sfl/badge-3d";
import { palierCarte } from "@/components/sfl/bola-card";
import type { BadgeCarte } from "@/lib/sfl/badge-carte";

const W = 1024;
const H = 1656;
const PHI = (1 + Math.sqrt(5)) / 2;
const P = W / PHI ** 5; // 92, la marge
const BADGE = 942 / PHI ** 4; // 137, comme la classique
const BADGE_M = BADGE / PHI; // 85
const SANS = "var(--font-inter), Inter, system-ui, sans-serif";
const MONO = "var(--font-jbmono), ui-monospace, monospace";
const NOIR = "#08090b";
const BLANC = "#f5f5f3";
/** Rapprocher : la photo grossie, ancrée au-dessus des yeux. */
const ZOOM = { transform: "scale(1.28)", transformOrigin: "50% 30%" } as const;

function Photo({ photo, nom, taille }: { photo?: string | null; nom: string; taille: number }) {
  if (!photo)
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: taille * 0.5,
          letterSpacing: "-0.05em",
          lineHeight: 1,
          color: "rgba(255,255,255,0.14)",
        }}
      >
        {nom.slice(0, 1).toUpperCase()}
      </div>
    );
  return (
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
        ...ZOOM,
      }}
    />
  );
}

export function CartePhoto({
  name,
  affiche,
  position,
  overall,
  size = 1,
  photo,
  onglet,
  badge,
}: {
  name: string;
  affiche?: string;
  position: string;
  overall: number;
  size?: number;
  photo?: string | null;
  onglet?: { fond: string; encre: string };
  badge?: BadgeCarte | null;
}) {
  const largeur = 254 * size;
  const u = (n: number) => n * size * (254 / W);
  const palier = palierCarte(largeur);

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
          background: "#2a2b2f",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12), 0 2px 6px rgba(0,0,0,0.28)",
        }}
      >
        <div data-card-part="player" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <Photo photo={photo} nom={name} taille={largeur * 1.6} />
        </div>
        <div
          data-card-part="stats"
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            minWidth: "46%",
            height: "34%",
            padding: "0 7%",
            boxSizing: "border-box",
            borderTopLeftRadius: largeur * 0.12,
            background: onglet?.fond ?? NOIR,
            color: onglet?.encre ?? BLANC,
            boxShadow: onglet ? `inset 1px 1px 0 ${onglet.encre}33` : undefined,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: largeur * 0.23,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {overall}
        </div>
      </div>
    );
  }

  const reduite = palier === "reduite";
  // Le texte grossit quand la carte rétrécit.
  const tailleNote = reduite ? 470 : 300;
  const nom = (affiche ?? name).toUpperCase();
  const place = W - P * 2 - tailleNote * 1.45;
  const tailleNom = Math.min(170, place / (0.66 * Math.max(4, nom.length)));
  const ombre = `0 ${u(2)}px ${u(24)}px rgba(0,0,0,0.35)`;
  const note: React.CSSProperties = {
    fontFamily: SANS,
    fontWeight: 800,
    fontSize: u(tailleNote),
    letterSpacing: "-0.06em",
    lineHeight: 0.74,
    color: "#fff",
    fontVariantNumeric: "tabular-nums",
    textShadow: ombre,
  };

  return (
    <div
      data-card-part="body"
      style={{
        position: "relative",
        width: u(W),
        height: u(H),
        borderRadius: u(61),
        overflow: "hidden",
        background: "#2a2b2f",
        boxShadow: `inset 0 0 0 ${u(3)}px rgba(255,255,255,0.1), 0 10px 28px rgba(0,0,0,0.45)`,
        fontFamily: SANS,
        textAlign: "left",
      }}
    >
      <div data-card-part="player" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <Photo photo={photo} nom={name} taille={u(W)} />
        {/* Un voile léger, seulement sous la section d'or. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, rgba(0,0,0,0) ${100 / PHI}%, rgba(0,0,0,0.5) 100%)`,
          }}
        />
        {badge && !reduite && (
          <span className="absolute" style={{ left: u(W - BADGE_M - BADGE * 1.2), top: u(BADGE_M) }}>
            <Badge3D badge={badge} largeur={u(BADGE * 1.2)} socle />
          </span>
        )}
      </div>

      <div data-card-part="stats" style={{ position: "absolute", inset: 0 }}>
        {reduite && onglet ? (
          // Sur un terrain : la note dans l'onglet aux couleurs de l'équipe, comme la pastille.
          <div
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              minWidth: u(W * 0.46),
              height: u(W * 0.34),
              padding: `0 ${u(W * 0.07)}px`,
              boxSizing: "border-box",
              borderTopLeftRadius: u(W * 0.12),
              background: onglet.fond,
              color: onglet.encre,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: u(W * 0.23),
              letterSpacing: "-0.04em",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {overall}
          </div>
        ) : (
        <div
          style={{
            position: "absolute",
            left: u(P),
            right: u(P),
            bottom: u(P),
            display: "flex",
            alignItems: "flex-end",
            justifyContent: reduite ? "center" : "space-between",
            gap: u(24),
          }}
        >
          {!reduite && (
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: MONO,
                  fontWeight: 600,
                  fontSize: u(46),
                  letterSpacing: u(4),
                  lineHeight: 1,
                  color: "rgba(255,255,255,0.75)",
                  whiteSpace: "nowrap",
                  textShadow: ombre,
                  marginBottom: u(22),
                }}
              >
                {position.toUpperCase()}
              </div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: u(tailleNom),
                  letterSpacing: "-0.035em",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  color: "#fff",
                  textShadow: ombre,
                }}
              >
                {nom}
              </div>
            </div>
          )}
          <div style={note}>{overall}</div>
        </div>
        )}
      </div>
    </div>
  );
}
