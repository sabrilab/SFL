"use client";

// Les deux visuels du trash talk (lib/sfl/trash-talk.ts), mis en page par le
// code, sans aucune génération :
//   · le tweet : noir, encre blanche ; la carte du joueur en avatar, son nom
//     et son pseudo, le logo BOLA en face, la phrase, puis la journée, le match, le jour et l'heure ;
//   · la une : papier, encre noire, le métier d'impression des cartes
//     (filets, microtexte, coins de repère) ; la manchette BOLA, la ligne
//     d'édition, la phrase en titre entre guillemets, la carte en signature.
// Les deux se comprennent hors de Bola : le symbole et getbola.app au pied.
// Aucun signe d'un réseau existant, aucun nom de journal réel ; ni or, ni
// bleu, ni rouge (réservés aux cartes MVP, Défensive et Impact).
//
// Ce sont des objets, comme les cartes : ils ne suivent pas le thème de
// l'app (les mêmes en clair et en sombre). Tout est dessiné pour une largeur
// de 360, en styles en ligne, pour que html-to-image photographie exactement
// ce qu'on voit (lib/sfl/image-a-partager.ts) :
//   · « fil »   360 × 450 (4:5), dans les Actus et la saisie ;
//   · « post »  360 × 450, l'image à partager 1080 × 1350 ;
//   · « story » 360 × 640, l'image à partager 1080 × 1920, plus d'air en haut
//     et en bas (là où une story pose ses propres boutons).
// La phrase tient toujours dans sa place : son corps part de sa longueur et
// se réduit tant qu'un mot dépasse la ligne ou que les lignes débordent
// (corpsDuTexte, lib/sfl/trash-talk.ts). La une, en capitales accentuées,
// garde de l'air entre ses lignes et entre ses mots ; un joueur cité y est
// souligné d'un filet fin, décollé des lettres. Aucune ligne ne commence par
// un deux-points ou un point d'interrogation (espacesInsecables).
// CadreVisuel met un visuel à la largeur de sa place.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PlayerCard } from "@/components/sfl/player-card";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { useSeason } from "@/components/sfl/season-provider";
import { useIdentites } from "@/hooks/use-identites";
import {
  corpsDuTexte,
  decouperCitations,
  espacesInsecables,
  INTERLIGNE,
  ligneDEdition,
  ligneDuPost,
  type FormatTrashTalk,
  type GabaritTrashTalk,
} from "@/lib/sfl/trash-talk";
import { cn } from "@/lib/utils";

export interface SujetVisuel {
  format: FormatTrashTalk;
  texte: string;
  /** Le nom de saison de l'auteur (la clé de sa carte). */
  nom: string;
  pseudo: string;
  j: number;
  match: number | null;
  at: number;
  /** Le numéro du post (0 : pas encore publié). */
  id: number;
  /** La phrase n'est pas encore écrite : ce qu'on lit à sa place est éteint. */
  eteint?: boolean;
}

export const LARGEUR_VISUEL = 360;
export const HAUTEUR_VISUEL: Record<GabaritTrashTalk, number> = { fil: 450, post: 450, story: 640 };

const INTER = "var(--font-inter), Inter, system-ui, sans-serif";
const NOIR = "#08090b";
const BLANC = "#ffffff";
const PAPIER = "#f4f3ef";
const ENCRE = "#0a0b0d";
const COTE_CARTE = Math.round(254 * FORMAT_CARTE.petite);

const etiquette = (couleur: string, taille = 9): CSSProperties => ({
  font: `700 ${taille}px/1.2 ${INTER}`,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontVariantNumeric: "tabular-nums",
  color: couleur,
});

/** La carte de l'auteur, en petit : sa vraie carte ; sans carte (un compte hors saison), son initiale au même format. */
function Carte({ nom, affiche, clair }: { nom: string; affiche: string; clair: boolean }) {
  const { allPlayers } = useSeason();
  const player = allPlayers.find((p) => p.name.toLowerCase() === nom.trim().toLowerCase());
  if (player) return <PlayerCard player={player} size={FORMAT_CARTE.petite} />;
  return (
    <span
      style={{
        width: COTE_CARTE,
        height: COTE_CARTE,
        borderRadius: COTE_CARTE * 0.24,
        display: "grid",
        placeItems: "center",
        background: clair ? "rgba(10,11,13,0.08)" : "rgba(255,255,255,0.12)",
        color: clair ? "rgba(10,11,13,0.55)" : "rgba(255,255,255,0.7)",
        font: `800 19px/1 ${INTER}`,
      }}
    >
      {affiche.trim()[0]?.toUpperCase()}
    </span>
  );
}

function Pied({ clair }: { clair: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- photographié par html-to-image */}
      <img src={clair ? "/bola/symbole-noir.svg" : "/bola/symbole-blanc.svg"} alt="" width={18} height={18} />
      <span style={{ font: `600 11px/1 ${INTER}`, letterSpacing: "0.04em", color: clair ? "rgba(10,11,13,0.6)" : "rgba(255,255,255,0.6)" }}>getbola.app</span>
    </div>
  );
}

function Tweet({ s, gabarit, affiche }: { s: SujetVisuel; gabarit: GabaritTrashTalk; affiche: string }) {
  const story = gabarit === "story";
  const corps = corpsDuTexte(s.texte, "tweet", gabarit);
  return (
    <div
      style={{
        width: LARGEUR_VISUEL,
        height: HAUTEUR_VISUEL[gabarit],
        boxSizing: "border-box",
        padding: story ? "84px 28px 72px" : "26px 26px 22px",
        background: NOIR,
        color: BLANC,
        fontFamily: INTER,
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Carte nom={s.nom} affiche={affiche} clair={false} />
        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ font: `800 17px/1.1 ${INTER}`, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{affiche}</span>
          <span style={{ font: `500 13px/1.1 ${INTER}`, color: "rgba(255,255,255,0.5)" }}>@{s.pseudo}</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- photographié par html-to-image */}
        <img src="/bola/logo-blanc.svg" alt="Bola" width={58} height={14} style={{ marginLeft: "auto", alignSelf: "flex-start", objectFit: "contain", objectPosition: "right top", flexShrink: 0 }} />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", padding: "14px 0" }}>
        <p
          style={{
            margin: 0,
            font: `600 ${corps}px/${INTERLIGNE.tweet} ${INTER}`,
            letterSpacing: "-0.03em",
            color: "rgba(255,255,255,0.86)",
            opacity: s.eteint ? 0.28 : 1,
            overflowWrap: "anywhere",
          }}
        >
          {decouperCitations(espacesInsecables(s.texte)).map((m, i) =>
            m.cite ? (
              <span key={i} style={{ color: BLANC, fontWeight: 800 }}>
                {m.texte}
              </span>
            ) : (
              m.texte
            )
          )}
        </p>
      </div>
      <div style={etiquette("rgba(255,255,255,0.5)")}>{ligneDuPost(s)}</div>
      <div style={{ height: 1, background: "rgba(255,255,255,0.14)", margin: "13px 0 13px" }} />
      <Pied clair={false} />
    </div>
  );
}

/** Un coin de repère, comme au bord d'une planche d'impression. */
function Coin({ haut, gauche, marge }: { haut: boolean; gauche: boolean; marge: number }) {
  const trait = "0.75px solid rgba(10,11,13,0.5)";
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        width: 9,
        height: 9,
        [haut ? "top" : "bottom"]: marge,
        [gauche ? "left" : "right"]: marge,
        [haut ? "borderTop" : "borderBottom"]: trait,
        [gauche ? "borderLeft" : "borderRight"]: trait,
      }}
    />
  );
}

function Une({ s, gabarit, affiche }: { s: SujetVisuel; gabarit: GabaritTrashTalk; affiche: string }) {
  const story = gabarit === "story";
  const corps = corpsDuTexte(s.texte, "une", gabarit);
  const marge = story ? 14 : 10;
  const micro = `BOLA · TRASH TALK · J${s.j} · `.repeat(14);
  return (
    <div
      style={{
        position: "relative",
        width: LARGEUR_VISUEL,
        height: HAUTEUR_VISUEL[gabarit],
        boxSizing: "border-box",
        padding: story ? "84px 30px 72px" : "28px 28px 22px",
        background: PAPIER,
        color: ENCRE,
        fontFamily: INTER,
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Coin haut gauche marge={marge} />
      <Coin haut gauche={false} marge={marge} />
      <Coin haut={false} gauche marge={marge} />
      <Coin haut={false} gauche={false} marge={marge} />
      <div style={{ display: "flex", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- photographié par html-to-image */}
        <img src="/bola/logo-noir.svg" alt="Bola" width={92} height={22} style={{ objectFit: "contain" }} />
      </div>
      {/* Le filet double de la manchette. */}
      <div style={{ marginTop: 11, borderTop: `2px solid ${ENCRE}`, borderBottom: `0.75px solid ${ENCRE}`, height: 2 }} />
      <div style={{ ...etiquette("rgba(10,11,13,0.62)", 8), textAlign: "center", padding: "7px 0 6px", whiteSpace: "nowrap", overflow: "hidden" }}>{ligneDEdition(s)}</div>
      <div style={{ borderTop: `0.75px solid ${ENCRE}` }} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", padding: "12px 0" }}>
        <p
          style={{
            margin: 0,
            font: `900 ${corps}px/${INTERLIGNE.une} ${INTER}`,
            letterSpacing: "-0.03em",
            wordSpacing: "0.14em",
            textTransform: "uppercase",
            opacity: s.eteint ? 0.22 : 1,
            overflowWrap: "anywhere",
          }}
        >
          «&nbsp;
          {decouperCitations(espacesInsecables(s.texte)).map((m, i) =>
            m.cite ? (
              <span
                key={i}
                style={{
                  textDecorationLine: "underline",
                  textDecorationThickness: Math.max(1.5, Math.round(corps * 0.05 * 2) / 2),
                  textUnderlineOffset: Math.max(2, Math.round(corps * 0.07)),
                  textDecorationSkipInk: "none",
                }}
              >
                {m.texte}
              </span>
            ) : (
              m.texte
            )
          )}
          &nbsp;»
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <Carte nom={s.nom} affiche={affiche} clair />
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ font: `800 15px/1.1 ${INTER}`, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{affiche}</span>
          <span style={{ font: `500 12px/1.1 ${INTER}`, color: "rgba(10,11,13,0.55)" }}>@{s.pseudo}</span>
        </div>
      </div>
      {/* Le microtexte, entre deux filets : la ligne de sécurité d'une carte. */}
      <div
        aria-hidden
        style={{
          margin: "12px 0 11px",
          padding: "2.5px 0",
          borderTop: `0.75px solid ${ENCRE}`,
          borderBottom: `0.75px solid ${ENCRE}`,
          font: `700 3.6px/1 ${INTER}`,
          letterSpacing: "0.14em",
          color: "rgba(10,11,13,0.6)",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {micro}
      </div>
      <Pied clair />
    </div>
  );
}

/** Le visuel à sa taille de dessin (360 de large) : c'est lui qu'on photographie. */
export function VisuelTrashTalk({ sujet, gabarit = "fil" }: { sujet: SujetVisuel; gabarit?: GabaritTrashTalk }) {
  const identite = useIdentites();
  const affiche = identite.nom(sujet.nom);
  return sujet.format === "une" ? <Une s={sujet} gabarit={gabarit} affiche={affiche} /> : <Tweet s={sujet} gabarit={gabarit} affiche={affiche} />;
}

/**
 * Le visuel à la largeur de sa place : le même dessin, mis à l'échelle. Tant
 * que la place n'est pas mesurée, elle garde sa forme, dans le fond du visuel.
 */
export function CadreVisuel({ sujet, gabarit = "fil", className, style }: { sujet: SujetVisuel; gabarit?: GabaritTrashTalk; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [echelle, setEchelle] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mesurer = () => el.clientWidth && setEchelle(el.clientWidth / LARGEUR_VISUEL);
    mesurer();
    const o = new ResizeObserver(mesurer);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      style={{ aspectRatio: `${LARGEUR_VISUEL} / ${HAUTEUR_VISUEL[gabarit]}`, background: sujet.format === "une" ? PAPIER : NOIR, ...style }}
    >
      {echelle !== null && (
        <div style={{ position: "absolute", top: 0, left: 0, width: LARGEUR_VISUEL, transform: `scale(${echelle})`, transformOrigin: "0 0" }}>
          <VisuelTrashTalk sujet={sujet} gabarit={gabarit} />
        </div>
      )}
    </div>
  );
}
