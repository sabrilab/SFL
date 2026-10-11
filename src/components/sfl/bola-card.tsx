"use client";

// La carte joueur Bola — gris et blanc.
//
// Le mélange de deux cartes : la carte officielle de l'app iPhone Bola
// (Composants/Carte/CarteDessin.swift, elle-même reprise du site) — papier
// blanc cassé, microtexte gravé et lignes de scan, logo et « carte
// officielle » en tête, cadre blanc à repères d'angle, puce argent, note en
// italique à frange, six stats, filet pointillé et numéro de série — et la
// carte SFL d'avant : rayures diagonales, grand chiffre en filigrane, nom en
// Anton. Le cadre porte la photo du joueur s'il en a posé une ; sinon les
// rayures et la note en filigrane.
//
// Mêmes proportions et mêmes calques que la carte éditoriale (1024 × 1536,
// `data-card-part` body / player / stats) : la 3D de card-3d.tsx la prend
// telle quelle, avec sa parallaxe — le cadre flotte au-dessus du papier,
// le texte au-dessus du cadre.

import { STAT_KEYS, type StatKey, type Stats } from "@/lib/sfl/engine";

export type BolaEdition = "base" | "rare";

const W = 1024;
const H = 1536;
const PAD = 64;
const ENCRE = (a: number) => `rgba(8,9,11,${a})`;
const ANTON = "var(--font-anton), Anton, sans-serif";
const SANS = "var(--font-inter), Inter, system-ui, sans-serif";
const MONO = "var(--font-jbmono), ui-monospace, monospace";

// Le cadre du portrait, et les lignes sous lui (cotes dans le repère 1024 × 1536).
const CADRE = { x: PAD, y: 150, w: W - PAD * 2, h: 760 };
const LIGNE_NOTE = 1118;
const STATS_Y = [1196, 1262];
const FILET = 1320;
const MICRO = 1376;

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

export function BolaCard({
  name,
  username,
  position,
  overall,
  stats,
  edition = "base",
  highlightStats,
  size = 1,
  photo,
}: {
  name: string;
  username?: string;
  position: string;
  overall: number;
  stats: Stats;
  edition?: BolaEdition;
  highlightStats?: StatKey[];
  size?: number;
  /** La photo posée par le joueur (URL ou data URL), recadrée en carré. */
  photo?: string | null;
}) {
  // 254 px de large à taille 1, comme les autres cartes de l'app.
  const u = (n: number) => n * size * (254 / W);
  const rare = edition === "rare";
  const seed = graine(name);
  const numero = (seed % 900) + 100;
  const serie = `bola-fr-${String(seed % 1000000).padStart(6, "0")}`;
  const nomUp = name.toUpperCase();
  const tailleNom = Math.min(118, (W - PAD * 2 - 330) / (0.5 * Math.max(4, nomUp.length)));

  const mono = (fs: number, ls = 0, a = 1, w = 500) => ({
    fontFamily: MONO,
    fontSize: u(fs),
    letterSpacing: u(ls),
    fontWeight: w,
    color: ENCRE(a),
    lineHeight: 1,
  });

  // L-shapes des quatre coins du cadre (repères d'angle de la carte officielle).
  const coin = (pos: React.CSSProperties, rot: number) => (
    <div
      style={{
        position: "absolute",
        width: u(46),
        height: u(46),
        borderTop: `${u(4)}px solid ${ENCRE(rare ? 1 : 0.6)}`,
        borderLeft: `${u(4)}px solid ${ENCRE(rare ? 1 : 0.6)}`,
        transform: `rotate(${rot}deg)`,
        ...pos,
      }}
    />
  );

  return (
    <div
      data-card-part="body"
      style={{
        position: "relative",
        width: u(W),
        height: u(H),
        borderRadius: u(62),
        overflow: "hidden",
        background: rare
          ? "linear-gradient(160deg, #f6f6f3 0%, #e4e5e1 55%, #cfd0cb 100%)"
          : "linear-gradient(160deg, #fbfbf9 0%, #eeeeea 100%)",
        boxShadow: `inset 0 0 0 ${u(3)}px ${ENCRE(0.18)}, 0 14px 38px rgba(0,0,0,0.5)`,
        fontFamily: SANS,
        color: ENCRE(1),
      }}
    >
      {/* Le papier : microtexte gravé et lignes de scan */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: u(18),
          overflow: "hidden",
          ...mono(24, 2, rare ? 0.06 : 0.04, 400),
          lineHeight: `${u(25)}px`,
          wordBreak: "break-all",
        }}
      >
        {microtexte(seed, 2400)}
      </div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-linear-gradient(0deg, ${ENCRE(0.022)} 0 ${u(3)}px, transparent ${u(3)}px ${u(9)}px)`,
        }}
      />
      {/* Le reflet argent : une bande diagonale, à peine (plus marquée en rare). */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(115deg, transparent 30%, rgba(255,255,255,${rare ? 0.55 : 0.35}) 45%, transparent 60%)`,
        }}
      />

      {/* Le cadre : rayures, chiffre en filigrane, repères, étiquette, puce */}
      <div data-card-part="player" style={{ position: "absolute", inset: 0 }}>
        <div
          style={{
            position: "absolute",
            left: u(CADRE.x),
            top: u(CADRE.y),
            width: u(CADRE.w),
            height: u(CADRE.h),
            borderRadius: u(40),
            overflow: "hidden",
            background: "#ffffff",
            boxShadow: `inset 0 0 0 ${u(3)}px ${ENCRE(0.2)}`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `repeating-linear-gradient(45deg, transparent 0 ${u(34)}px, ${ENCRE(rare ? 0.07 : 0.05)} ${u(34)}px ${u(64)}px)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.95), rgba(255,255,255,0) 62%)",
            }}
          />
          {/* Le grand chiffre, gris, en filigrane */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: u(70),
              textAlign: "center",
              fontFamily: ANTON,
              fontSize: u(600),
              lineHeight: 1,
              color: ENCRE(rare ? 0.13 : 0.09),
              letterSpacing: u(-6),
            }}
          >
            {overall}
          </div>
          {photo && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
                  objectPosition: "50% 20%",
                }}
              />
              {/* Un voile clair en haut et en bas : l'étiquette et le poste restent lisibles. */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 22%, rgba(255,255,255,0) 75%, rgba(255,255,255,0.6) 100%)",
                }}
              />
            </>
          )}
          {coin({ left: u(26), top: u(26) }, 0)}
          {coin({ right: u(26), top: u(26) }, 90)}
          {coin({ right: u(26), bottom: u(26) }, 180)}
          {coin({ left: u(26), bottom: u(26) }, 270)}
          {/* L'étiquette d'édition */}
          <div
            style={{
              position: "absolute",
              left: u(92),
              top: u(40),
              height: u(46),
              padding: `0 ${u(18)}px`,
              borderRadius: u(10),
              display: "flex",
              alignItems: "center",
              background: rare ? ENCRE(1) : "transparent",
              border: `${u(3)}px solid ${ENCRE(rare ? 1 : 0.55)}`,
              ...mono(24, 2, 1, 700),
              color: rare ? "#f4f5f2" : ENCRE(0.75),
            }}
          >
            {rare ? "rare" : "base"}
          </div>
          {/* La puce argent */}
          <div
            style={{
              position: "absolute",
              right: u(40),
              bottom: u(46),
              width: u(88),
              height: u(68),
              borderRadius: u(12),
              background: "linear-gradient(135deg, #f3f3f1, #b9bab5 45%, #e6e6e3 70%, #a7a8a3)",
              boxShadow: `inset 0 0 0 ${u(2)}px ${ENCRE(0.25)}`,
            }}
          >
            <div style={{ position: "absolute", left: "50%", top: u(8), bottom: u(8), width: u(2), background: ENCRE(0.25) }} />
            <div style={{ position: "absolute", top: "50%", left: u(8), right: u(8), height: u(2), background: ENCRE(0.25) }} />
          </div>
          {/* Le poste, comme sur la carte d'avant */}
          <div style={{ position: "absolute", left: u(44), bottom: u(46), ...mono(30, 6, 0.8, 700) }}>
            {position.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Le texte, au premier plan */}
      <div data-card-part="stats" style={{ position: "absolute", inset: 0 }}>
        {/* En-tête : le logo, « carte officielle » */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/bola/logo-noir.svg"
          alt=""
          style={{ position: "absolute", left: u(PAD), top: u(64), height: u(46), width: "auto" }}
        />
        <div style={{ position: "absolute", right: u(PAD), top: u(76), ...mono(30, 0, 1, 500) }}>carte officielle</div>

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
              left: u(PAD - 6 + dx),
              top: u(LIGNE_NOTE - 186),
              fontFamily: SANS,
              fontWeight: 900,
              fontStyle: "italic",
              fontSize: u(210),
              letterSpacing: u(-8),
              lineHeight: 1,
              color: ENCRE(a),
            }}
          >
            {overall}
          </div>
        ))}

        {/* Qui : le nom en Anton, le pseudo et la ligue, alignés à droite */}
        <div
          style={{
            position: "absolute",
            right: u(PAD),
            top: u(LIGNE_NOTE - 150),
            width: u(W - PAD * 2 - 300),
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
        <div style={{ position: "absolute", right: u(PAD), top: u(LIGNE_NOTE - 22), textAlign: "right", ...mono(28, 0, 0.85, 500) }}>
          {username ? `${username} · ` : ""}sfl
        </div>

        {/* Les six stats, trois par rangée : « vit 84 » */}
        {STAT_KEYS.map((k, i) => {
          const col = (W - PAD * 2) / 3;
          const actif = highlightStats?.includes(k);
          return (
            <div
              key={k}
              style={{
                position: "absolute",
                left: u(PAD + (i % 3) * col),
                top: u(STATS_Y[Math.floor(i / 3)]),
                display: "flex",
                alignItems: "baseline",
                gap: u(12),
              }}
            >
              <span style={mono(30, 1, 0.7, 500)}>{k.toLowerCase()}</span>
              <span
                style={{
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: u(46),
                  lineHeight: 1,
                  color: ENCRE(1),
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

        {/* Le filet pointillé, puis la série */}
        <div
          style={{
            position: "absolute",
            left: u(PAD),
            right: u(PAD),
            top: u(FILET),
            height: u(3),
            backgroundImage: `repeating-linear-gradient(90deg, ${ENCRE(0.45)} 0 ${u(10)}px, transparent ${u(10)}px ${u(20)}px)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: u(PAD),
            right: u(PAD),
            top: u(MICRO),
            display: "flex",
            justifyContent: "space-between",
            ...mono(24, 0.5, 0.8, 500),
          }}
        >
          <span>{serie}</span>
          <span>n° {numero} / ∞</span>
          <span>lot s1</span>
        </div>
      </div>
    </div>
  );
}
