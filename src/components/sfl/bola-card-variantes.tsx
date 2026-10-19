"use client";

// Les variantes épurées de la carte joueur (Sabri, 19/10 : « une esthétique
// différente, minimaliste ou épurée, mais toujours dans cette même vibe. Tu ne
// laisses que le plus important et, parfois, du plein écran »).
//
// Toujours le repère de la carte classique, 1024 × 1656 (1 × φ), et rien que
// l'essentiel : la photo, la note, le nom, le poste, le badge du coin. Plus
// de microtexte, de lignes de scan, de repères, de puce ni de série.
//
//   · Épurée — papier blanc. La photo est un carré bord à bord (1024), la
//     bande du dessous fait 632 = 1024 ÷ φ : le nom en haut, le poste et la
//     note en bas.
//   · Nuit — la même construction en noir, à la façon d'Apple : la photo se
//     fond dans le noir sur son dernier 1/φ³, le nom en casse normale, la
//     note en maigre.
//   · Plein écran — la photo occupe toute la carte. Une photo carrée posée
//     sur une carte 1 × φ garde ses yeux à 0,382 de la hauteur (le repère de
//     recadrer-photo.tsx) : ils tombent pile sur la section d'or de la carte.
//     Un voile léger, seulement sous 1/φ de la hauteur, porte le texte blanc.
//   · Verre — la photo pleine carte aussi, et l'information sur une plaque de
//     verre dépoli en bas (632 ÷ φ = 391 de haut, à 632 ÷ φ⁵ = 57 des bords).
//     Le verre est une copie floutée de la photo, pas un backdrop-filter :
//     la capture 3D (html-to-image) le garde, comme le badge en verre.
//
// Mêmes calques que la classique (`data-card-part` body / player / stats),
// et les mêmes paliers selon la largeur à l'écran (palierCarte) : en compacte
// la photo, le nom et la note ; en réduite la photo et la note ; en pastille
// un carré, le visage et la note dans un onglet.

import { Badge3D } from "@/components/sfl/badge-3d";
import { palierCarte } from "@/components/sfl/bola-card";
import type { BadgeCarte } from "@/lib/sfl/badge-carte";
import type { StyleCarte } from "@/lib/sfl/style-carte";

export type StyleVariante = Exclude<StyleCarte, "classique">;

const W = 1024;
const H = 1656;
const PHI = (1 + Math.sqrt(5)) / 2;
const BANDE = H - W; // 632 = 1024 ÷ φ
const P = W / PHI ** 5; // 92, la marge
const NOTE = BANDE / PHI ** 2; // 241
const VERRE_H = BANDE / PHI; // 391
const VERRE_M = BANDE / PHI ** 5; // 57
const BADGE = 942 / PHI ** 4; // 137, comme la classique
const BADGE_M = BADGE / PHI; // 85
const SANS = "var(--font-inter), Inter, system-ui, sans-serif";
const MONO = "var(--font-jbmono), ui-monospace, monospace";

const NOIR = "#08090b";
const BLANC = "#f5f5f3";

const TONS: Record<
  StyleVariante,
  { fond: string; encre: string; douce: string; photoFond: string; plein: boolean; symbole: string }
> = {
  epuree: { fond: "#fbfbf9", encre: NOIR, douce: "rgba(8,9,11,0.5)", photoFond: "#ececea", plein: false, symbole: "/bola/symbole-noir.svg" },
  nuit: { fond: "#000000", encre: BLANC, douce: "rgba(245,245,243,0.5)", photoFond: "#151517", plein: false, symbole: "/bola/symbole-blanc.svg" },
  plein: { fond: "#1a1b1e", encre: "#ffffff", douce: "rgba(255,255,255,0.72)", photoFond: "#2a2b2f", plein: true, symbole: "/bola/symbole-blanc.svg" },
  verre: { fond: "#d9dad6", encre: NOIR, douce: "rgba(8,9,11,0.55)", photoFond: "#c9cac5", plein: true, symbole: "/bola/symbole-blanc.svg" },
};

function Photo({
  photo,
  nom,
  encre,
  taille,
  style,
}: {
  photo?: string | null;
  nom: string;
  encre: string;
  /** Côté de référence pour l'initiale, en px à l'écran. */
  taille: number;
  style?: React.CSSProperties;
}) {
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
          color: encre,
          opacity: 0.12,
          ...style,
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
        ...style,
      }}
    />
  );
}

export function CarteVariante({
  variante,
  name,
  affiche,
  username,
  position,
  overall,
  size = 1,
  photo,
  onglet,
  badge,
}: {
  variante: StyleVariante;
  name: string;
  affiche?: string;
  username?: string;
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
  const t = TONS[variante];
  const nuit = variante === "nuit";
  const nom = affiche ?? name;

  // La pastille : un carré, le visage, la note dans un onglet.
  if (palier === "pastille") {
    const cadre = !t.plein;
    return (
      <div
        data-card-part="body"
        style={{
          position: "relative",
          width: largeur,
          height: largeur,
          borderRadius: "24%",
          overflow: "hidden",
          background: t.fond,
          boxShadow: `inset 0 0 0 1px ${nuit ? "rgba(255,255,255,0.14)" : "rgba(8,9,11,0.14)"}, 0 2px 6px rgba(0,0,0,0.28)`,
        }}
      >
        <div
          data-card-part="player"
          style={{
            position: "absolute",
            inset: cadre ? "6%" : 0,
            borderRadius: cadre ? "20%" : 0,
            overflow: "hidden",
            background: t.photoFond,
          }}
        >
          <Photo photo={photo} nom={name} encre={t.encre} taille={largeur * 1.6} style={{ transform: "scale(1.2)", transformOrigin: "50% 36%" }} />
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
            background: onglet?.fond ?? (nuit ? BLANC : NOIR),
            color: onglet?.encre ?? (nuit ? NOIR : BLANC),
            boxShadow: onglet ? `inset 1px 1px 0 ${onglet.encre}33` : undefined,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: SANS,
            fontWeight: nuit ? 500 : 800,
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

  const complete = palier === "complete";
  const reduite = palier === "reduite";
  // En petit, le texte grossit au lieu de rétrécir avec la carte.
  const k = complete ? 1 : reduite ? 1.9 : 1.25;

  // Le nom : en capitales serrées (casse normale en Nuit), ajusté à la place qui reste.
  const nomTexte = nuit ? nom : nom.toUpperCase();
  const place = W - P * 2 - (complete && !t.plein ? 0 : NOTE * k * 1.45) - (variante === "verre" ? (P / PHI) * 2 : 0);
  const tailleNom = Math.min(
    (BANDE / PHI ** 3) * (complete ? 1 : 1.15),
    place / ((nuit ? 0.56 : 0.66) * Math.max(4, nomTexte.length))
  );
  const sousTitre = `${position.toUpperCase()}${username && complete ? `  ·  ${username}` : ""}`;

  const badgeCoin = badge && !reduite ? badge : null;
  const ombre = t.plein && variante === "plein" ? `0 ${u(2)}px ${u(24)}px rgba(0,0,0,0.35)` : undefined;

  const texteNom: React.CSSProperties = {
    fontFamily: SANS,
    fontWeight: nuit ? 600 : 800,
    fontSize: u(tailleNom),
    letterSpacing: nuit ? "-0.025em" : "-0.035em",
    lineHeight: 1,
    whiteSpace: "nowrap",
    color: t.encre,
    textShadow: ombre,
  };
  const texteNote: React.CSSProperties = {
    fontFamily: SANS,
    fontWeight: nuit ? 200 : 800,
    fontSize: u(NOTE * k),
    letterSpacing: nuit ? "-0.07em" : "-0.06em",
    lineHeight: 0.74,
    color: t.encre,
    fontVariantNumeric: "tabular-nums",
    textShadow: ombre,
  };
  const texteSous: React.CSSProperties = {
    fontFamily: MONO,
    fontWeight: 600,
    fontSize: u(30 * (complete ? 1 : 1.5)),
    letterSpacing: u(4),
    lineHeight: 1,
    color: t.douce,
    whiteSpace: "nowrap",
    textShadow: ombre,
  };

  // Où vit le texte : la bande sous la photo, le bas de la photo ou la plaque de verre.
  const zone: React.CSSProperties =
    variante === "verre"
      ? { left: VERRE_M + P / PHI, right: VERRE_M + P / PHI, top: H - VERRE_M - VERRE_H + P / PHI, bottom: VERRE_M + P / PHI }
      : variante === "plein"
        ? { left: P, right: P, top: H - BANDE + P, bottom: P }
        : { left: P, right: P, top: W + P * 0.85, bottom: P };

  return (
    <div
      data-card-part="body"
      style={{
        position: "relative",
        width: u(W),
        height: u(H),
        borderRadius: u(61),
        overflow: "hidden",
        background: t.fond,
        boxShadow: `inset 0 0 0 ${u(3)}px ${nuit ? "rgba(255,255,255,0.1)" : "rgba(8,9,11,0.12)"}, 0 14px 38px rgba(0,0,0,0.5)`,
        fontFamily: SANS,
        color: t.encre,
        textAlign: "left",
      }}
    >
      {/* La photo : un carré bord à bord, ou toute la carte */}
      <div data-card-part="player" style={{ position: "absolute", inset: 0 }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: u(W),
            height: u(t.plein ? H : W),
            overflow: "hidden",
            background: t.photoFond,
          }}
        >
          <Photo
            photo={photo}
            nom={name}
            encre={t.encre}
            taille={u(W)}
            style={!complete ? { transform: "scale(1.12)", transformOrigin: "50% 36%" } : undefined}
          />
          {nuit && (
            // Le bas de la photo se fond dans le noir (son dernier 1/φ³).
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(180deg, rgba(0,0,0,0) ${100 - 100 / PHI ** 3}%, #000 100%)`,
              }}
            />
          )}
          {variante === "epuree" && (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: u(2), background: "rgba(8,9,11,0.08)" }} />
          )}
          {variante === "plein" && (
            // Un voile léger, seulement sous la section d'or.
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(180deg, rgba(0,0,0,0) ${100 / PHI}%, rgba(0,0,0,0.42) 100%)`,
              }}
            />
          )}
        </div>

        {variante === "verre" && (
          // La plaque de verre : la même photo, floutée, éclaircie, cadrée au même endroit.
          <div
            style={{
              position: "absolute",
              left: u(VERRE_M),
              right: u(VERRE_M),
              bottom: u(VERRE_M),
              height: u(reduite ? VERRE_H / PHI : VERRE_H),
              borderRadius: u(44),
              overflow: "hidden",
              background: "rgba(245,245,243,0.6)",
              boxShadow: `inset 0 0 0 ${u(2)}px rgba(255,255,255,0.55), 0 ${u(10)}px ${u(40)}px rgba(0,0,0,0.12)`,
            }}
          >
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt=""
                crossOrigin={photo.startsWith("data:") ? undefined : "anonymous"}
                style={{
                  position: "absolute",
                  left: u(-VERRE_M),
                  bottom: u(-VERRE_M),
                  width: u(W),
                  height: u(H),
                  maxWidth: "none",
                  objectFit: "cover",
                  objectPosition: "50% 38%",
                  filter: `blur(${u(30)}px) saturate(1.15)`,
                  transform: !complete ? "scale(1.12)" : undefined,
                  transformOrigin: `50% ${36}%`,
                }}
              />
            )}
            <div style={{ position: "absolute", inset: 0, background: "rgba(250,250,248,0.5)" }} />
          </div>
        )}

        {complete && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.symbole}
            alt=""
            style={{
              position: "absolute",
              left: u(BADGE_M),
              top: u(BADGE_M),
              width: u(56),
              height: u(56),
              opacity: variante === "verre" || variante === "plein" ? 0.9 : 0.85,
              filter: t.plein ? `drop-shadow(0 ${u(2)}px ${u(10)}px rgba(0,0,0,0.3))` : undefined,
            }}
          />
        )}
        {badgeCoin && (
          <span className="absolute" style={{ left: u(W - BADGE_M - BADGE), top: u(BADGE_M) }}>
            <Badge3D badge={badgeCoin} largeur={u(BADGE)} socle />
          </span>
        )}
      </div>

      {/* Le texte : le nom, le poste, la note */}
      <div data-card-part="stats" style={{ position: "absolute", inset: 0 }}>
        <div
          style={{
            position: "absolute",
            left: u(zone.left as number),
            right: u(zone.right as number),
            top: u(reduite ? H - P - NOTE * k * 0.8 - (variante === "verre" ? P / PHI : 0) : (zone.top as number)),
            bottom: u(zone.bottom as number),
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {reduite ? (
            <div style={{ ...texteNote, textAlign: "center" }}>{overall}</div>
          ) : complete && !t.plein ? (
            <>
              <div style={texteNom}>{nomTexte}</div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: u(24) }}>
                <div style={{ ...texteSous, paddingBottom: u(6) }}>{sousTitre}</div>
                <div style={texteNote}>{overall}</div>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: u(24), marginTop: "auto" }}>
              <div style={{ minWidth: 0 }}>
                {complete ? (
                  <>
                    <div style={texteNom}>{nomTexte}</div>
                    <div style={{ ...texteSous, marginTop: u(26), paddingBottom: u(6) }}>{sousTitre}</div>
                  </>
                ) : (
                  <>
                    <div style={{ ...texteSous, marginBottom: u(22) }}>{position.toUpperCase()}</div>
                    <div style={texteNom}>{nomTexte}</div>
                  </>
                )}
              </div>
              <div style={texteNote}>{overall}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
