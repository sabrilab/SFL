"use client";

// Le dos de la carte joueur (Sabri, 23/10 : « à l'arrière, on met Bola »,
// et « que le derrière des cartes suive aussi la même couleur que l'avant,
// que ce soit vraiment une carte full color »). Avant, le dos était noir
// pour toutes, avec « sunday five league » sous le symbole : la ligue n'est
// plus écrite sur la carte.
//
// Même matière que la face (finitions-carte.ts) : le papier blanc cassé de
// la carte de saison, l'or du MVP, le rouge d'Impact, le cobalt de la
// Défensive, la nuit, le chrome, la nacre ; même motif gravé, même
// microtexte, mêmes lignes de scan, même rebord. Au centre, le logo Bola en
// deux étages : la lune dans une rosace guillochée, comme le sceau d'un
// billet, puis le logotype. En bas, comme sur la face, le filet pointillé et
// le numéro de série de la carte.
//
// L'habillage du joueur s'y retrouve : son nom gravé dans le microtexte, le
// liseré d'argent ou d'or et ses coins par cran, en cadre intérieur, à la
// même distance du bord que celui du portrait sur la face.
//
// Le dos d'une carte d'époque (la saison 0, Sabri 24/10) est de sa matière
// lui aussi : le parchemin et ses coups de pinceau (en haut, loin du logo),
// ou le fond de sa carte Boost, sa lumière, son cadre de métal et son filet.
// Sous le logotype, sa saison (et son titre) ; dans la ligne de série, sa
// date d'émission et son numéro, comme sur la face.
//
// Le dos d'un skin offert peut avoir son encre et son papier (Matiere.dos) :
// la palestine porte le drapeau au dos, la carte de saison devant, et son
// motif dessine lui-même la lune et le logotype sur la bande blanche.
//
// Repère 1024 × 1656, comme la face : card-3d.tsx le photographie pour le
// dos de la 3D (data-card-part="body").

import {
  graine,
  lisereDe,
  LOGO_BOLA,
  microtexte,
  microtexteGrave,
  RAYON_CARTE,
  serieDe,
  type HabillageCarte,
  type Matiere,
} from "@/components/sfl/finitions-carte";
import { Crans, Lisere, type Boite } from "@/components/sfl/habillage-carte";
import { BordEpoque } from "@/components/sfl/marques-carte";
import { MotifCarte, RosaceBola } from "@/components/sfl/motif-carte";
import { ligneDEmission, type EmissionCarte } from "@/lib/sfl/epoques";

const W = 1024;
const H = 1656;
const M = 41;
const PHI = (1 + Math.sqrt(5)) / 2;
const SERIE_X = RAYON_CARTE / PHI; // la série rentrée, comme sur la face
// Le cadre intérieur (liseré, crans) : à 29 du bord, comme celui du portrait.
const CADRE: Boite = { x: 29, y: 29, w: W - 58, h: H - 58, r: RAYON_CARTE - 29 };
const MONO = "var(--font-inter), system-ui, sans-serif";

// La rosace et la lune, puis le logotype, centrés sur la hauteur.
const ROSACE = { cx: 512, cy: 738, r1: 236, r2: 318 };
const LUNE = 300; // le diamètre du symbole
const LOGOTYPE = { cy: 1222, h: 104 };
// Les coups de pinceau de la saison 0 : en haut à gauche, loin de la lune et du logotype.
const PINCEAU_DOS = { cx: 512, cy: 330 };
// Les boîtes des tracés dans le repère du logo (1000 × 237).
const BOITE_SYMBOLE = { x: 17, y: 103.485, c: 112.373 };
const BOITE_LOGOTYPE = { x: 150.41, y: 32.445, l: 783.3, h: 183.7 };

export function DosCarte({
  matiere,
  nom,
  size = 1,
  habillage: habillageDemande,
  emission,
}: {
  matiere: Matiere;
  nom: string;
  size?: number;
  habillage?: HabillageCarte;
  /** Une carte d'époque : sa date d'émission et son numéro (lib/sfl/epoques.ts). */
  emission?: EmissionCarte | null;
}) {
  const u = (n: number) => n * size * (254 / W);
  // Un dos qui n'a pas l'encre ou le papier de la face (la palestine : le drapeau).
  const p: Matiere = matiere.dos ? { ...matiere, ...matiere.dos } : matiere;
  const encre = (a: number) => `rgba(${p.encre},${a})`;
  const seed = graine(nom);
  const era = p.epoque;
  const habillage = era ? undefined : habillageDemande;
  const ligne = era ? ligneDEmission(emission ?? { saison: era.saison, le: null, n: null, sur: null }) : null;
  const { serie, numero } = ligne ? { serie: ligne.date, numero: ligne.numero } : serieDe(nom, p.nom === "fondateur" ? habillage : undefined);
  const sLune = LUNE / BOITE_SYMBOLE.c;
  const lisere = lisereDe(habillage);
  const cran = habillage?.cran ?? 0;
  const nomGrave = !!nom && !!habillage?.signes?.includes("nom-grave");
  const sLogo = LOGOTYPE.h / BOITE_LOGOTYPE.h;

  return (
    <div
      data-card-part="body"
      data-matiere={p.nom}
      style={{
        position: "relative",
        width: u(W),
        height: u(H),
        borderRadius: u(RAYON_CARTE),
        overflow: "hidden",
        background: p.papier,
        boxShadow: [
          `inset 0 0 0 ${u(2)}px ${encre(0.12)}`,
          `inset ${u(3)}px ${u(4)}px ${u(3)}px -${u(1)}px ${p.rebord.lumiere}`,
          `inset -${u(3)}px -${u(5)}px ${u(5)}px -${u(1)}px ${p.rebord.ombre}`,
        ].join(", "),
      }}
    >
      {p.motif && (
        <MotifCarte motif={p.motif} graine={seed} nom={nom} centre={p.motif.type === "pinceau" ? PINCEAU_DOS : { cx: ROSACE.cx, cy: ROSACE.cy }} />
      )}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: u(18),
          overflow: "hidden",
          fontFamily: MONO,
          fontSize: u(24),
          letterSpacing: u(2),
          fontWeight: 400,
          lineHeight: `${u(25)}px`,
          color: encre(p.micro),
          wordBreak: "break-all",
        }}
      >
        {nomGrave
          ? microtexteGrave(seed ^ 0x5f3759df, 2600, nom).map((m, i) =>
              m.nom ? (
                <span key={i} style={{ color: encre(Math.min(0.4, p.micro * 2.6)), fontWeight: 700 }}>
                  {m.texte}
                </span>
              ) : (
                m.texte
              )
            )
          : microtexte(seed ^ 0x5f3759df, 2600)}
      </div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-linear-gradient(0deg, ${encre(0.022)} 0 ${u(3)}px, transparent ${u(3)}px ${u(9)}px)`,
        }}
      />
      {/* Le reflet, en miroir de la face ; sur la finition animée, la lumière qui passe. */}
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
            background: `linear-gradient(245deg, transparent 30%, rgba(255,255,255,${p.reflet}) 45%, transparent 60%)`,
          }}
        />
      )}

      {era && <BordEpoque epoque={era} />}
      {lisere && <Lisere metal={lisere} boite={CADRE} />}
      {cran > 0 && <Crans cran={cran} metal={lisere ?? "argent"} boite={CADRE} />}

      {/* Bola : la lune dans sa rosace, puis le logotype (gravés en creux dans l'or de la pépite) ; le drapeau dessine les siens */}
      {matiere.dos?.logo !== false && (
      <svg
        role="img"
        aria-label="Bola"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          ...(p.gravure && { filter: `drop-shadow(-${u(2)}px -${u(2)}px 0 ${p.gravure.ombre}) drop-shadow(${u(2)}px ${u(3)}px 0 ${p.gravure.lumiere})` }),
        }}
      >
        {/* Un disque de papier sous la lune : la rosace s'arrête net autour. */}
        <RosaceBola {...ROSACE} couleur={encre(0.2)} epaisseur={1.8} />
        <path
          d={LOGO_BOLA.symbole}
          fill={encre(1)}
          fillRule="evenodd"
          transform={`translate(${ROSACE.cx - (BOITE_SYMBOLE.x + BOITE_SYMBOLE.c / 2) * sLune} ${ROSACE.cy - (BOITE_SYMBOLE.y + BOITE_SYMBOLE.c / 2) * sLune}) scale(${sLune})`}
        />
        <path
          d={LOGO_BOLA.logotype}
          fill={encre(1)}
          fillRule="evenodd"
          transform={`translate(${W / 2 - (BOITE_LOGOTYPE.x + BOITE_LOGOTYPE.l / 2) * sLogo} ${LOGOTYPE.cy - (BOITE_LOGOTYPE.y + BOITE_LOGOTYPE.h / 2) * sLogo}) scale(${sLogo})`}
        />
      </svg>
      )}

      {/* Une carte d'époque : sa saison (et son titre), sous le logotype */}
      {era && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: u(LOGOTYPE.cy + LOGOTYPE.h / 2 + 70),
            textAlign: "center",
            fontFamily: MONO,
            fontSize: u(30),
            letterSpacing: u(6),
            fontWeight: 700,
            lineHeight: 1,
            textTransform: "uppercase",
            color: era.libelle,
          }}
        >
          {`saison ${era.saison}${era.embleme ? ` · ${p.titre}` : ""}`}
        </div>
      )}

      {/* Le filet pointillé et la série, comme sur la face */}
      <div
        style={{
          position: "absolute",
          left: u(M),
          right: u(M),
          top: u(1605),
          height: u(2),
          backgroundImage: `repeating-linear-gradient(90deg, ${era ? `${era.libelle}99` : encre(0.4)} 0 ${u(10)}px, transparent ${u(10)}px ${u(20)}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: u(SERIE_X),
          right: u(SERIE_X),
          top: u(1621),
          display: "flex",
          justifyContent: "space-between",
          fontFamily: MONO,
          fontSize: u(19),
          letterSpacing: u(0.5),
          fontWeight: 500,
          lineHeight: 1,
          color: era ? era.libelle : encre(0.75),
        }}
      >
        <span>{serie}</span>
        <span>{numero}</span>
      </div>
    </div>
  );
}
