"use client";

// Les cinématiques des Actus — une par genre de publication, et plusieurs
// variantes pour les genres qui reviennent (Sabri, 22/10 : « beaucoup de
// cinématiques différentes, les cartes dans différents formats, de vraies
// cinématiques »). Ce sont les vraies cartes des joueurs (MiniCarte : la
// toucher l'ouvre en grand), dans leurs trois formats au nombre d'or et en
// très grand (la carte complète), mises en mouvement :
//   · l'homme du dimanche : le projecteur (la carte se retourne sous la
//     lumière), le zoom arrière (on part collé à la carte), la vitesse (elle
//     entre en trombe, ses chiffres claquent) ;
//   · le score : le tableau d'affichage (rouleaux, buteurs en cartes), le choc
//     (les deux meilleurs se rentrent dedans, le score jaillit entre eux) ;
//     toujours les Noirs contre les Blancs, aux couleurs des maillots
//     (lib/sfl/maillots.ts : côté Blancs une lueur, côté Noirs plus de noir) ;
//   · le badge : la chute (il tombe, rebondit, l'onde du métal), la
//     révélation (il sort de derrière la carte) ;
//   · l'équipe type : la donne (les cinq partent du paquet vers leur poste) ;
//   · le duo : la passe (le ballon voyage d'une carte à l'autre) ;
//   · ils montent : l'ascenseur (le rang défile, les autres suivent) ;
//   · le podium : les marches poussent, les cartes y tombent ;
//   · la course : les barres partent ensemble, l'écart s'affiche ;
//   · dans la surface : l'anneau qui se remplit jusqu'au dernier pas ;
//   · le récap : le terrain se dessine, les chiffres du dimanche défilent ;
//   · ton dimanche : ta carte fait un tour et se pose, tes chiffres.
// Au repos, les cartes sont de face et entières (règle de la Ligue, 18/10).

import type { CSSProperties, ReactNode } from "react";
import { Badge3D } from "@/components/sfl/badge-3d";
import { LISERE_CAMP, PastilleCamp } from "@/components/sfl/camp";
import { MiniCarte } from "@/components/sfl/mini-carte";
import { useSeason } from "@/components/sfl/season-provider";
import { useIdentites } from "@/hooks/use-identites";
import { buteursDe } from "@/lib/sfl/actus";
import type { Decroche, Honneur, Surface } from "@/lib/sfl/a-l-honneur";
import { rankPlayers, type JourneeMatch, type Player } from "@/lib/sfl/engine";
import { MAILLOTS, type Maillot } from "@/lib/sfl/maillots";
import { metal, NOM_METAL, TROPHEES, type Metal } from "@/lib/sfl/trophees";
import { cn } from "@/lib/utils";
import { ANTON, Compte, Lettres, Rouleau, t } from "./ecran";

const PHI = (1 + Math.sqrt(5)) / 2;
/** Les formats de carte, en fraction de 254 px : le très grand, puis la hiérarchie φ. */
export const TAILLE = { geante: 0.85, grande: 0.5, moyenne: 0.5 / PHI, petite: 0.5 / (PHI * PHI) } as const;
export const L = (s: number) => 254 * s;
export const H = (s: number) => 254 * s * PHI;

/**
 * Le voile d'un camp sur le fond sombre des Actus, `force` de 0 à 1 : une
 * lueur blanche côté Blancs, une ombre plus noire que le fond côté Noirs.
 */
const voile = (m: Maillot, force: number) =>
  m === MAILLOTS.blancs ? `rgba(244,243,239,${force})` : `rgba(0,0,0,${Math.min(1, force * 3)})`;

export const LUEUR: Record<Metal, string> = { bronze: "#d39a6a", argent: "#dfe3ea", or: "#f4cd6a", legende: "#ef5a4c" };
export const DEF = Object.fromEntries(TROPHEES.map((d) => [d.id, d]));

/** Le joueur d'un nom, dans la saison lue (en cours ou archivée). */
export function useJoueurs() {
  const { players, allPlayers } = useSeason();
  return (nom: string): Player | undefined => players.find((p) => p.name === nom) ?? allPlayers.find((p) => p.name === nom);
}

export function Carte({ p, size, detail, className, style }: { p: Player; size: number; detail?: string; className?: string; style?: CSSProperties }) {
  return (
    <div className={cn("relative", className)} style={{ width: L(size), height: H(size), ...style }}>
      <MiniCarte player={p} size={size} detail={detail} />
    </div>
  );
}

/** Le reflet qui traverse une carte, une fois. */
export function Reflet({ a, largeur, hauteur }: { a: number; largeur: number; hauteur: number }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ width: largeur, height: hauteur, borderRadius: largeur * 0.06 }}>
      <span
        className="a-reflet absolute inset-y-0 left-0 w-1/2"
        style={{ ...t(a, 1.1), background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)", mixBlendMode: "overlay" }}
      />
    </span>
  );
}

/** L'ombre d'une carte posée. */
function Ombre({ largeur, a = 0 }: { largeur: number; a?: number }) {
  return (
    <span
      aria-hidden
      className="a-fondu pointer-events-none absolute left-1/2 -translate-x-1/2"
      style={{ ...t(a, 0.8), bottom: -10, width: largeur * 1.15, height: 22, background: "radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.7), transparent)" }}
    />
  );
}

export function Etiquette({ children, a, className }: { children: ReactNode; a: number; className?: string }) {
  return (
    <span className={cn("a-fondu mono-label absolute text-[9.5px] text-white/50", className)} style={t(a, 0.6)}>
      {children}
    </span>
  );
}

/** Le grand chiffre d'une scène, en Anton. */
export function Gros({ children, taille, className, style }: { children: ReactNode; taille: number; className?: string; style?: CSSProperties }) {
  return (
    <span className={cn("block leading-[0.85] tabular-nums", className)} style={{ fontFamily: ANTON, fontSize: taille, ...style }}>
      {children}
    </span>
  );
}

export const pl = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);

/* ============================ L'homme du dimanche ============================ */

type Mvp = Honneur["mvp"][number];

export function CineMvp({ mvp, j, variante }: { mvp: Mvp; j: number; variante: number }) {
  const joueur = useJoueurs()(mvp.nom);
  const nom = useIdentites().nom(mvp.nom);
  if (!joueur) return null;
  const v = variante % 4;
  if (v === 1) return <MvpZoom mvp={mvp} p={joueur} nom={nom} j={j} />;
  if (v === 2) return <MvpVitesse mvp={mvp} p={joueur} nom={nom} j={j} />;
  if (v === 3) return <MvpProjecteur mvp={mvp} p={joueur} nom={nom} j={j} />;
  return <MvpReel mvp={mvp} p={joueur} nom={nom} j={j} />;
}

/** Le format d'image de chaque variante de l'homme du dimanche (largeur ÷ hauteur). */
export const FORMAT_MVP = [9 / 16, 4 / 5, 1, 4 / 5] as const;

/**
 * Le reel, en 9:16 plein écran : un éclair, « MVP » qui claque en or, la carte
 * en très grand qui se retourne ; elle s'incline à peine pendant qu'on fait
 * défiler et se pose à plat au centre. Ses chiffres en rouleaux, son nom en
 * bas, immense.
 */
function MvpReel({ mvp, p, nom, j }: { mvp: Mvp; p: Player; nom: string; j: number }) {
  const s = 0.95;
  const chiffres = [
    mvp.buts > 0 && { n: mvp.buts, l: pl(mvp.buts, "but", "buts") },
    mvp.passes > 0 && { n: mvp.passes, l: pl(mvp.passes, "passe", "passes") },
    { n: mvp.pp, l: "pts", plus: true },
  ].filter(Boolean) as { n: number; l: string; plus?: boolean }[];
  return (
    <>
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(70% 40% at 50% 38%, rgba(255,199,90,0.16), transparent 70%)" }} />
      <div aria-hidden className="a-rayons absolute top-[40%] left-1/2 size-[180%] -translate-x-1/2 -translate-y-1/2" style={{ ...t(0.5, 3), background: "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.06) 0 4deg, transparent 4deg 14deg)", maskImage: "radial-gradient(closest-side, #000 10%, transparent 70%)", WebkitMaskImage: "radial-gradient(closest-side, #000 10%, transparent 70%)" }} />
      <span aria-hidden className="a-eclair absolute inset-0 bg-white" style={t(0.05, 0.6)} />
      <div className="absolute inset-x-0 top-[4.5%] flex flex-col items-center">
        <span className="a-claque leading-none text-[#ffc75a]" style={{ ...t(0.25, 0.5), fontFamily: ANTON, fontSize: 54, letterSpacing: "0.04em" }}>MVP</span>
        <span className="a-fondu mono-label mt-1 text-[9.5px] text-white/50" style={t(0.6)}>L&apos;homme du dimanche · J{j}</span>
      </div>
      <div className="absolute top-[18%] left-1/2 -translate-x-1/2">
        <div className="defile-incline">
          <Ombre largeur={L(s)} a={1.1} />
          <div className="a-flip relative" style={t(0.5, 1.3)}>
            <Carte p={p} size={s} detail={`MVP · J${j}`} />
            <Reflet a={1.8} largeur={L(s)} hauteur={H(s)} />
          </div>
        </div>
      </div>
      <div className="absolute inset-x-[8%] top-[77%] flex justify-around">
        {chiffres.map((c, i) => (
          <span key={c.l} className="a-monte flex flex-col items-center" style={t(1.7 + i * 0.15)}>
            <span className="flex items-center leading-none" style={{ fontFamily: ANTON, fontSize: 44 }}>
              {c.plus && <span className="mr-0.5 text-[28px] leading-none text-white/60">+</span>}
              <Rouleau n={c.n} a={1.8 + i * 0.15} du={1.1} />
            </span>
            <span className="mono-label text-[9px] text-white/50">{c.l}</span>
          </span>
        ))}
      </div>
      <div className="defile-parallaxe absolute inset-x-0 bottom-[2.5%] overflow-hidden text-center leading-none whitespace-nowrap uppercase" style={{ fontFamily: ANTON, fontSize: Math.min(64, 520 / Math.max(4, nom.length)) }}>
        <Lettres texte={nom} a={2.3} pas={0.05} />
      </div>
    </>
  );
}

/** Le projecteur : la lumière s'ouvre, la carte (en très grand) se retourne dessous, ses chiffres défilent. */
function MvpProjecteur({ mvp, p, nom, j }: { mvp: Mvp; p: Player; nom: string; j: number }) {
  const s = TAILLE.geante;
  return (
    <>
      {/* Le nom en fond, immense, au trait. */}
      <div aria-hidden className="absolute inset-x-0 top-[6%] overflow-hidden text-center leading-none whitespace-nowrap uppercase" style={{ fontFamily: ANTON, fontSize: 118, color: "transparent", WebkitTextStroke: "1px rgba(255,255,255,0.16)" }}>
        <Lettres texte={nom} a={1.3} pas={0.06} anim="a-descend" du={0.7} />
      </div>
      <div
        aria-hidden
        className="a-cone pointer-events-none absolute top-0 left-[4%] h-full w-[70%]"
        style={{ ...t(0.1, 1.1), background: "linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0) 88%)", clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)" }}
      />
      <div className="absolute bottom-[9%] left-[5%]">
        <Ombre largeur={L(s)} a={1.2} />
        <div className="a-flip relative" style={t(0.45, 1.3)}>
          <Carte p={p} size={s} detail={`MVP · J${j}`} />
          <Reflet a={1.8} largeur={L(s)} hauteur={H(s)} />
        </div>
      </div>
      <div className="absolute top-[12%] right-[6%] flex flex-col items-end gap-4 text-right">
        <span className="a-fondu mono-label text-[10px] text-[#ffc75a]" style={t(1.6)}>MVP</span>
        {mvp.buts > 0 && (
          <span className="a-monte" style={t(1.8)}>
            <Gros taille={64}><Compte n={mvp.buts} a={1.8} du={0.9} /></Gros>
            <span className="mono-label text-[9px] text-white/50">{pl(mvp.buts, "but", "buts")}</span>
          </span>
        )}
        {mvp.passes > 0 && (
          <span className="a-monte" style={t(2.1)}>
            <Gros taille={mvp.buts ? 40 : 64}><Compte n={mvp.passes} a={2.1} du={0.8} /></Gros>
            <span className="mono-label text-[9px] text-white/50">{pl(mvp.passes, "passe", "passes")}</span>
          </span>
        )}
        <span className="a-monte" style={t(2.4)}>
          <Gros taille={34} className="text-white/60"><Compte n={mvp.pp} a={2.4} du={0.8} prefixe="+" /></Gros>
          <span className="mono-label text-[9px] text-white/40">pts</span>
        </span>
      </div>
      <Etiquette a={3} className="right-[6%] bottom-[9%]">J{j}</Etiquette>
    </>
  );
}

/** Le zoom arrière : on part collé à la carte, flou ; on recule, les rayons tournent, le nom tombe. */
function MvpZoom({ mvp, p, nom, j }: { mvp: Mvp; p: Player; nom: string; j: number }) {
  const s = TAILLE.grande;
  const chiffres = [
    mvp.buts > 0 && { n: mvp.buts, l: pl(mvp.buts, "but", "buts") },
    mvp.passes > 0 && { n: mvp.passes, l: pl(mvp.passes, "passe", "passes") },
    { n: mvp.pp, l: "pts", plus: true },
  ].filter(Boolean) as { n: number; l: string; plus?: boolean }[];
  return (
    <>
      <div
        aria-hidden
        className="a-rayons absolute top-[38%] left-1/2 size-[150%] -translate-x-1/2 -translate-y-1/2"
        style={{ ...t(0.6, 3.2), background: "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.075) 0 6deg, transparent 6deg 18deg)", maskImage: "radial-gradient(closest-side, #000 20%, transparent 80%)", WebkitMaskImage: "radial-gradient(closest-side, #000 20%, transparent 80%)" }}
      />
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2">
        <div className="a-zoom relative" style={t(0.15, 1.5)}>
          <Carte p={p} size={s} detail={`MVP · J${j}`} />
          <Reflet a={1.7} largeur={L(s)} hauteur={H(s)} />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-[21%] text-center leading-none uppercase" style={{ fontFamily: ANTON, fontSize: 40 }}>
        <Lettres texte={nom} a={1.4} pas={0.05} />
      </div>
      <div className="absolute inset-x-0 bottom-[8%] flex justify-center gap-2.5">
        {chiffres.map((c, i) => (
          <span key={c.l} className="a-pop flex items-baseline gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 backdrop-blur-sm" style={t(2.1 + i * 0.18, 0.5)}>
            <span className="text-[19px] font-bold tabular-nums"><Compte n={c.n} a={2.2 + i * 0.18} du={0.6} prefixe={c.plus ? "+" : ""} /></span>
            <span className="mono-label text-[9px] text-white/55">{c.l}</span>
          </span>
        ))}
      </div>
      <Etiquette a={0.9} className="top-[4%] left-1/2 -translate-x-1/2 text-[#ffc75a]">MVP · J{j}</Etiquette>
    </>
  );
}

/** La vitesse : la carte entre en trombe, traînées derrière ; ses chiffres claquent un à un. */
function MvpVitesse({ mvp, p, nom, j }: { mvp: Mvp; p: Player; nom: string; j: number }) {
  const s = TAILLE.grande;
  return (
    <>
      {[12, 26, 41, 57, 70, 84].map((y, i) => (
        <span key={y} aria-hidden className="a-trainee absolute right-0 h-px w-2/3 bg-gradient-to-r from-transparent via-white/70 to-transparent" style={{ ...t(0.1 + i * 0.05, 0.7), top: `${y}%` }} />
      ))}
      <div className="absolute top-[11%] right-[7%]">
        <Ombre largeur={L(s)} a={0.8} />
        <div className="a-glisse-d relative" style={t(0.2, 0.7)}>
          <Carte p={p} size={s} detail={`MVP · J${j}`} />
          <Reflet a={1} largeur={L(s)} hauteur={H(s)} />
        </div>
      </div>
      <div className="absolute top-[11%] left-[7%] flex flex-col gap-5">
        <span className="a-fondu mono-label text-[10px] text-[#ffc75a]" style={t(0.9)}>MVP · J{j}</span>
        {mvp.buts > 0 && (
          <span className="a-claque origin-left" style={t(1.1, 0.5)}>
            <Gros taille={88}>{mvp.buts}</Gros>
            <span className="mono-label text-[9px] text-white/55">{pl(mvp.buts, "but", "buts")}</span>
          </span>
        )}
        {mvp.passes > 0 && (
          <span className="a-claque origin-left" style={t(1.5, 0.5)}>
            <Gros taille={mvp.buts ? 52 : 88}>{mvp.passes}</Gros>
            <span className="mono-label text-[9px] text-white/55">{pl(mvp.passes, "passe", "passes")}</span>
          </span>
        )}
      </div>
      <div className="absolute inset-x-[7%] bottom-[8%] flex items-end justify-between">
        <span className="max-w-[62%] leading-[0.9] break-words uppercase" style={{ fontFamily: ANTON, fontSize: 34 }}>
          <Lettres texte={nom} a={1.9} pas={0.04} anim="a-glisse-g" du={0.5} />
        </span>
        <span className="a-claque text-right" style={t(2.5, 0.5)}>
          <Gros taille={30} className="text-white/60">+{mvp.pp}</Gros>
          <span className="mono-label text-[9px] text-white/40">pts</span>
        </span>
      </div>
    </>
  );
}

/* ================================== Le score ================================== */

export function CineScore({ match, j, variante }: { match: JourneeMatch; j: number; variante: number }) {
  const v = variante % 3;
  if (v === 0) return <ScoreTele match={match} j={j} />;
  return v === 1 ? <ScoreChoc match={match} j={j} /> : <ScoreTableau match={match} j={j} />;
}

/** Le format d'image de chaque variante du score : la télé en 16:9, puis le choc et le tableau. */
export const FORMAT_SCORE = [16 / 9, 4 / 5, 4 / 5] as const;

/**
 * La télé, en 16:9 : le bandeau de score d'une retransmission entre par les
 * deux côtés, « Fin » s'allume, la lumière balaie le bandeau, puis les buteurs
 * défilent dessous comme un bandeau d'info.
 */
function ScoreTele({ match, j }: { match: JourneeMatch; j: number }) {
  const id = useIdentites();
  const { a, b } = buteursDe(match);
  const buteurs = [...a, ...b].map((x) => `${id.nom(x.nom).toUpperCase()}${x.buts > 1 ? ` ×${x.buts}` : ""}`);
  const cote = (tm: JourneeMatch["teamA"], m: Maillot, droite: boolean) => (
    <div className={cn("flex h-full flex-1 items-center gap-2.5 px-3", droite ? "a-glisse-d flex-row-reverse" : "a-glisse-g")} style={t(0.25, 0.7)}>
      <span className="h-full w-1.5 shrink-0" style={{ background: m.fond, boxShadow: LISERE_CAMP }} />
      <span className="min-w-0 flex-1 truncate text-[13px] font-bold tracking-wide uppercase" style={{ textAlign: droite ? "right" : "left" }}>{m.nom}</span>
      <span className="leading-none tabular-nums" style={{ fontFamily: ANTON, fontSize: 34 }}>
        <Rouleau n={tm.score} a={0.7} du={1.2} />
      </span>
    </div>
  );
  return (
    <>
      <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(60% 80% at 15% 100%, ${voile(MAILLOTS.noirs, 0.13)}, transparent 70%), radial-gradient(60% 80% at 85% 100%, ${voile(MAILLOTS.blancs, 0.13)}, transparent 70%)` }} />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 opacity-60" style={{ background: "repeating-linear-gradient(90deg, rgba(110,190,110,0.12) 0 30px, rgba(110,190,110,0.06) 30px 60px)", maskImage: "linear-gradient(180deg, transparent, #000)", WebkitMaskImage: "linear-gradient(180deg, transparent, #000)" }} />
      <Etiquette a={0.1} className="top-[9%] left-[5%]">SFL · J{j} · {match.label}</Etiquette>
      <span className="a-pop absolute top-[7%] right-[5%] rounded-[5px] bg-white px-2 py-0.5 text-[11px] font-bold text-black" style={t(1.6, 0.4)}>FIN</span>
      <div className="absolute inset-x-[5%] top-[32%] h-[30%] overflow-hidden rounded-[10px] bg-black/70 backdrop-blur-md">
        <div className="relative flex h-full items-stretch">
          {cote(match.teamA, MAILLOTS.noirs, false)}
          <span className="a-fondu w-px self-stretch bg-white/15" style={t(0.6)} />
          {cote(match.teamB, MAILLOTS.blancs, true)}
          <span aria-hidden className="a-reflet absolute inset-y-0 left-0 w-1/3" style={{ ...t(1.4, 1.2), background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)" }} />
        </div>
      </div>
      {buteurs.length > 0 && (
        <div className="absolute inset-x-[5%] bottom-[12%] flex h-[14%] items-center overflow-hidden rounded-[6px] bg-white text-black">
          <span className="a-glisse-g flex h-full shrink-0 items-center bg-black px-2.5 text-[10px] font-bold text-white" style={t(1.8, 0.5)}>BUTS</span>
          <div className="relative h-full min-w-0 flex-1 overflow-hidden">
            <span className="a-ticker absolute top-1/2 left-0 -translate-y-1/2 pl-3 text-[11.5px] font-bold whitespace-nowrap" style={t(2, Math.max(4, buteurs.length * 1.1))}>
              {buteurs.join("   ·   ")}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

/** Le tableau d'affichage : les Noirs à gauche, les Blancs à droite, deux rouleaux, les buteurs en petites cartes. */
function ScoreTableau({ match, j }: { match: JourneeMatch; j: number }) {
  const joueur = useJoueurs();
  const { a, b } = buteursDe(match);
  const cotes = [
    { t: match.teamA, m: MAILLOTS.noirs, buteurs: a },
    { t: match.teamB, m: MAILLOTS.blancs, buteurs: b },
  ];
  const gagnant = match.teamA.score === match.teamB.score ? null : match.teamA.score > match.teamB.score ? 0 : 1;
  return (
    <>
      {cotes.map((c, i) => (
        <div
          key={c.t.id}
          aria-hidden
          className="a-hausse absolute inset-y-0 w-1/2"
          style={{ ...t(0.05 + i * 0.12, 0.8), left: i === 0 ? 0 : "50%", background: `linear-gradient(180deg, ${voile(c.m, gagnant === i ? 0.25 : 0.12)} 0%, transparent 70%)` }}
        />
      ))}
      <span aria-hidden className="a-hausse absolute top-[8%] bottom-[8%] left-1/2 w-px bg-white/15" style={t(0.5, 0.8)} />
      <Etiquette a={0.4} className="top-[5%] left-1/2 -translate-x-1/2">J{j} · {match.label}</Etiquette>
      {cotes.map((c, i) => (
        <div key={c.t.id} className="absolute top-[13%] flex w-1/2 flex-col items-center gap-3" style={{ left: i === 0 ? 0 : "50%" }}>
          <PastilleCamp maillot={c.m} className="a-fondu text-[13px]" style={t(0.6)} />
          <Rouleau n={c.t.score} a={0.8 + i * 0.25} du={1.5} className={gagnant === null || gagnant === i ? "text-white" : "text-white/45"} style={{ fontFamily: ANTON, fontSize: 104 }} />
          <div className="mt-1 flex max-w-[92%] flex-wrap justify-center gap-x-2 gap-y-2.5">
            {c.buteurs.slice(0, 6).map((bt, k) => {
              const p = joueur(bt.nom);
              if (!p) return null;
              return (
                <div key={bt.nom} className="a-pop relative" style={t(2.3 + k * 0.12 + i * 0.06, 0.5)}>
                  <Carte p={p} size={TAILLE.petite} detail={`J${j} · ${bt.buts} ${pl(bt.buts, "but", "buts")}`} />
                  <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[10.5px] font-bold text-black tabular-nums">
                    {bt.buts}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {gagnant !== null && (
        <span
          className="a-claque absolute bottom-[7%] left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-[12px] font-bold whitespace-nowrap"
          style={{ ...t(3.2, 0.5), background: cotes[gagnant].m.fond, color: cotes[gagnant].m.encre, boxShadow: LISERE_CAMP }}
        >
          Victoire {cotes[gagnant].m.des}
        </span>
      )}
    </>
  );
}

/**
 * Le choc : le meilleur de chaque équipe entre par son côté ; ils se rentrent
 * dedans, le score jaillit. Le score des Noirs est un chiffre noir cerclé de
 * blanc, celui des Blancs un chiffre blanc.
 */
function ScoreChoc({ match, j }: { match: JourneeMatch; j: number }) {
  const joueur = useJoueurs();
  const meilleur = (tm: JourneeMatch["teamA"]) =>
    [...tm.players].sort((x, y) => y.buts * 2 + y.passes - (x.buts * 2 + x.passes)).map((l) => joueur(l.name)).find(Boolean);
  const pa = meilleur(match.teamA);
  const pb = meilleur(match.teamB);
  const s = TAILLE.grande;
  const gagnant = match.teamA.score === match.teamB.score ? null : match.teamA.score > match.teamB.score ? MAILLOTS.noirs : MAILLOTS.blancs;
  return (
    <>
      <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(105deg, ${voile(MAILLOTS.noirs, 0.15)} 0%, transparent 45%, transparent 55%, ${voile(MAILLOTS.blancs, 0.15)} 100%)` }} />
      <span aria-hidden className="a-onde absolute top-[42%] left-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70" style={t(0.62, 0.9)} />
      <span aria-hidden className="a-onde absolute top-[42%] left-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" style={t(0.78, 1.1)} />
      <div className="absolute top-[14%] left-[5%]">
        {pa && (
          <div className="a-choc-g" style={t(0, 1.2)}>
            <Carte p={pa} size={s} detail={`J${j} · ${MAILLOTS.noirs.nom}`} />
          </div>
        )}
      </div>
      <div className="absolute top-[14%] right-[5%]">
        {pb && (
          <div className="a-choc-d" style={t(0, 1.2)}>
            <Carte p={pb} size={s} detail={`J${j} · ${MAILLOTS.blancs.nom}`} />
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 top-[62%] flex items-center justify-center gap-4 leading-none" style={{ fontFamily: ANTON }}>
        <span className="a-claque text-[76px]" style={{ ...t(0.9, 0.5), color: MAILLOTS.noirs.fond, WebkitTextStroke: `2px ${MAILLOTS.noirs.encre}` }}>{match.teamA.score}</span>
        <span className="a-fondu text-[40px] text-white/40" style={t(1.1)}>–</span>
        <span className="a-claque text-[76px]" style={{ ...t(1.05, 0.5), color: MAILLOTS.blancs.fond }}>{match.teamB.score}</span>
      </div>
      <div className="absolute inset-x-[6%] bottom-[7%] flex items-end justify-between gap-2">
        <PastilleCamp maillot={MAILLOTS.noirs} className="a-glisse-g" style={t(1.5, 0.6)} />
        <span className="a-fondu mono-label pb-1 text-[9.5px] text-white/45" style={t(1.8)}>
          {gagnant ? `Victoire ${gagnant.des}` : "Match nul"} · J{j}
        </span>
        <PastilleCamp maillot={MAILLOTS.blancs} className="a-glisse-d" style={t(1.5, 0.6)} />
      </div>
    </>
  );
}

/* ================================== Le badge ================================== */

export function CineBadge({ d, j, variante }: { d: Decroche; j: number; variante: number }) {
  const p = useJoueurs()(d.nom);
  const nom = useIdentites().nom(d.nom);
  if (!p) return null;
  return variante % 2 === 1 ? <BadgeRevelation d={d} p={p} nom={nom} j={j} /> : <BadgeChute d={d} p={p} nom={nom} j={j} />;
}

function infosBadge(d: Decroche) {
  const def = DEF[d.id];
  const m = metal(d.palier)!;
  const seuil = def.paliers[d.palier - 1];
  return { def, m, seuil, unite: seuil > 1 ? def.unite[1] : def.unite[0] };
}

/** La chute : le badge tombe, rebondit, l'onde du métal part ; la carte glisse à côté. */
function BadgeChute({ d, p, nom, j }: { d: Decroche; p: Player; nom: string; j: number }) {
  const { def, m, seuil, unite } = infosBadge(d);
  const s = TAILLE.grande;
  return (
    <>
      <div aria-hidden className="a-fondu absolute inset-0" style={{ ...t(1.1, 1.2), background: `radial-gradient(60% 45% at 70% 42%, ${LUEUR[m]}33, transparent 70%)` }} />
      <div className="absolute top-[18%] left-[6%]">
        <Ombre largeur={L(s)} a={0.6} />
        <div className="a-glisse-g" style={t(0.2, 0.8)}>
          <Carte p={p} size={s} detail={`${def.nom} · ${NOM_METAL[m]}`} />
        </div>
      </div>
      <div className="absolute top-[14%] right-[8%] flex flex-col items-center">
        <span aria-hidden className="a-onde absolute top-[44%] left-1/2 size-32 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ ...t(1.05, 1), borderColor: LUEUR[m] }} />
        <span aria-hidden className="a-onde absolute top-[44%] left-1/2 size-32 -translate-x-1/2 -translate-y-1/2 rounded-full border" style={{ ...t(1.25, 1.2), borderColor: LUEUR[m] }} />
        <div className="a-tombe" style={t(0.5, 1.4)}>
          <Badge3D badge={{ famille: "palier", id: d.id, palier: d.palier }} largeur={124} />
        </div>
        <span className="a-monte mt-3" style={t(1.6)}>
          <Gros taille={60} className="text-center"><Compte n={seuil} a={1.6} du={0.9} /></Gros>
        </span>
        <span className="a-fondu mono-label mt-1 text-[9px] text-white/55" style={t(1.9)}>{unite}</span>
      </div>
      <div className="absolute inset-x-[6%] bottom-[7%] flex items-end justify-between gap-3">
        <span className="a-monte leading-[0.9] uppercase" style={{ ...t(2.1), fontFamily: ANTON, fontSize: 28 }}>{nom}</span>
        <span className="a-fondu text-right" style={t(2.3)}>
          <span className="block text-[14px] font-bold">{def.nom}</span>
          <span className="mono-label text-[9px]" style={{ color: LUEUR[m] }}>{NOM_METAL[m]} · J{j}</span>
        </span>
      </div>
    </>
  );
}

/** La révélation : la carte au centre ; le badge sort de derrière elle et monte au-dessus. */
function BadgeRevelation({ d, p, nom, j }: { d: Decroche; p: Player; nom: string; j: number }) {
  const { def, m, seuil, unite } = infosBadge(d);
  const s = TAILLE.moyenne;
  return (
    <>
      <div aria-hidden className="a-rayons absolute top-[30%] left-1/2 size-[130%] -translate-x-1/2 -translate-y-1/2" style={{ ...t(0.9, 2.6), background: `repeating-conic-gradient(from 0deg, ${LUEUR[m]}22 0 5deg, transparent 5deg 15deg)`, maskImage: "radial-gradient(closest-side, #000 15%, transparent 75%)", WebkitMaskImage: "radial-gradient(closest-side, #000 15%, transparent 75%)" }} />
      <div className="absolute top-[6%] left-1/2 -translate-x-1/2">
        <div className="a-monte" style={t(0.9, 1.2)}>
          <Badge3D badge={{ famille: "palier", id: d.id, palier: d.palier }} largeur={112} />
        </div>
      </div>
      <div className="absolute top-[38%] left-1/2 -translate-x-1/2">
        <Ombre largeur={L(s)} a={0.4} />
        <div className="a-pop" style={t(0.15, 0.6)}>
          <Carte p={p} size={s} detail={`${def.nom} · ${NOM_METAL[m]}`} />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-[8%] flex flex-col items-center gap-1 text-center">
        <span className="leading-none uppercase" style={{ fontFamily: ANTON, fontSize: 30 }}>
          <Lettres texte={nom} a={1.8} pas={0.04} />
        </span>
        <span className="a-fondu text-[13px] font-semibold text-white/75" style={t(2.4)}>
          {def.nom} · {seuil} {unite}
        </span>
        <span className="a-fondu mono-label text-[9px]" style={{ ...t(2.6), color: LUEUR[m] }}>{NOM_METAL[m]} · J{j}</span>
      </div>
    </>
  );
}

/* ================================ L'équipe type ================================ */

export function CineEquipe({ equipe, j, variante = 0 }: { equipe: Honneur["equipeType"]; j: number; variante?: number }) {
  return variante % 2 === 1 ? <EquipeMosaique equipe={equipe} j={j} /> : <EquipeDonne equipe={equipe} j={j} />;
}

/** Le format de chaque variante de l'équipe type : la donne en 4:5, la mosaïque en carré. */
export const FORMAT_EQUIPE = [4 / 5, 1] as const;

/**
 * La mosaïque, en carré : le meilleur du jour en grand à gauche, les quatre
 * autres en petites cases ; chaque case se retourne à son tour, puis les
 * points du jour s'allument.
 */
function EquipeMosaique({ equipe, j }: { equipe: Honneur["equipeType"]; j: number }) {
  const joueur = useJoueurs();
  const cinq = equipe.map((e) => ({ ...e, p: joueur(e.nom) })).filter((e) => e.p).slice(0, 5) as { nom: string; pp: number; p: Player }[];
  const [tete, ...autres] = cinq;
  if (!tete) return null;
  return (
    <>
      <div className="absolute inset-[5%] grid grid-cols-[1.618fr_1fr] gap-[3%]">
        <div className="a-flip relative grid place-items-center overflow-hidden rounded-[14px] bg-white/[0.06]" style={t(0.2, 1)}>
          <Carte p={tete.p} size={TAILLE.grande} detail={`Équipe type · J${j} · +${tete.pp} pts`} />
          <span className="a-claque absolute right-2.5 bottom-2 leading-none" style={{ ...t(1.6, 0.5), fontFamily: ANTON, fontSize: 30 }}>+{tete.pp}</span>
          <span className="a-fondu mono-label absolute top-2.5 left-3 text-[9px] text-white/55" style={t(0.9)}>L&apos;équipe type · J{j}</span>
        </div>
        <div className="grid grid-rows-4 gap-[6%]">
          {autres.map((e, i) => (
            <div key={e.nom} className="a-flip flex items-center gap-2 overflow-hidden rounded-[12px] bg-white/[0.06] px-2" style={t(0.6 + i * 0.18, 0.8)}>
              <Carte p={e.p} size={TAILLE.petite * 0.92} detail={`Équipe type · J${j} · +${e.pp} pts`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-bold"><NomDe n={e.nom} /></span>
                <span className="a-fondu block text-[11px] text-white/55 tabular-nums" style={t(1.4 + i * 0.1)}>+{e.pp} pts</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** La donne : les cinq partent du paquet, au pied de l'image, vers leur poste sur la pelouse. */
function EquipeDonne({ equipe, j }: { equipe: Honneur["equipeType"]; j: number }) {
  const joueur = useJoueurs();
  const cinq = equipe.map((e) => ({ ...e, p: joueur(e.nom) })).filter((e) => e.p) as { nom: string; pp: number; p: Player }[];
  // 2 devant, le meilleur au centre, 2 derrière : en % de l'image (centre de la carte).
  const postes = [
    { x: 50, y: 40, s: TAILLE.moyenne },
    { x: 24, y: 22, s: TAILLE.petite },
    { x: 76, y: 22, s: TAILLE.petite },
    { x: 22, y: 64, s: TAILLE.petite },
    { x: 78, y: 64, s: TAILLE.petite },
  ];
  return (
    <>
      {/* La pelouse en perspective, ses lignes qui se dessinent. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[78%]" style={{ perspective: 600 }}>
        <div className="absolute inset-x-[-20%] top-0 bottom-[-30%]" style={{ transform: "rotateX(58deg)", transformOrigin: "50% 100%", background: "repeating-linear-gradient(180deg, rgba(110,190,110,0.16) 0 34px, rgba(110,190,110,0.1) 34px 68px)", maskImage: "linear-gradient(180deg, transparent, #000 35%, #000 80%, transparent)", WebkitMaskImage: "linear-gradient(180deg, transparent, #000 35%, #000 80%, transparent)" }}>
          <svg className="absolute inset-[8%]" viewBox="0 0 100 140" preserveAspectRatio="none" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6">
            <rect className="a-trace" style={t(0.1, 1.4)} pathLength={1} x="1" y="1" width="98" height="138" />
            <path className="a-trace" style={t(0.4, 1)} pathLength={1} d="M1 70H99" />
            <circle className="a-trace" style={t(0.6, 1)} pathLength={1} cx="50" cy="70" r="13" />
            <path className="a-trace" style={t(0.8, 1)} pathLength={1} d="M30 1v18h40V1M30 139v-18h40v18" />
          </svg>
        </div>
      </div>
      <Etiquette a={0.3} className="top-[4%] left-[6%]">L&apos;équipe type · J{j}</Etiquette>
      {cinq.slice(0, 5).map((e, i) => {
        const poste = postes[i];
        const st: CSSProperties = {
          ...t(1 + (i === 0 ? 4 : i - 1) * 0.22, 0.9),
          ["--dx" as string]: `${(50 - poste.x) * 3.6}px`,
          ["--dy" as string]: `${(96 - poste.y) * 4.4}px`,
          ["--r" as string]: `${(i % 2 ? 1 : -1) * (12 + i * 4)}deg`,
          left: `${poste.x}%`,
          top: `${poste.y}%`,
        };
        return (
          <div key={e.nom} className="a-donne absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={st}>
            <Carte p={e.p} size={poste.s} detail={`Équipe type · J${j} · +${e.pp} pts`} />
            <span className={cn("rounded-full bg-black/55 px-2 py-0.5 font-bold tabular-nums backdrop-blur-sm", i === 0 ? "text-[13px]" : "text-[11px]")}>+{e.pp}</span>
          </div>
        );
      })}
    </>
  );
}

/* =================================== Le duo =================================== */

/** La passe : deux cartes, le ballon qui voyage de l'une à l'autre, le compte des passes. */
export function CineDuo({ duo, j }: { duo: NonNullable<Honneur["duo"]>; j: number }) {
  const joueur = useJoueurs();
  const id = useIdentites();
  const passeur = joueur(duo.passeur);
  const buteur = joueur(duo.buteur);
  if (!passeur || !buteur) return null;
  const s = TAILLE.grande;
  return (
    <>
      <div className="absolute bottom-[14%] left-[6%]">
        <Ombre largeur={L(s)} a={0.5} />
        <div className="a-glisse-g" style={t(0.1, 0.8)}>
          <Carte p={passeur} size={s} detail={`Le duo · J${j} · passeur`} />
        </div>
      </div>
      <div className="absolute top-[7%] right-[6%]">
        <div className="a-glisse-d" style={t(0.35, 0.8)}>
          <Carte p={buteur} size={s} detail={`Le duo · J${j} · buteur`} />
        </div>
      </div>
      {/* La trajectoire, du haut de la carte du passeur au pied de celle du buteur.
          L'image fait 100 × 125 : une unité y vaut une unité x, soit 1 cqw. */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 125" preserveAspectRatio="none" fill="none">
        <path className="a-trace" style={t(1.1, 1)} pathLength={1} d="M34 55 Q 50 5 66 50" stroke="rgba(255,255,255,0.6)" strokeWidth="0.5" strokeLinecap="round" />
      </svg>
      <span
        aria-hidden
        className="a-ballon absolute top-0 left-0 size-4 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.9)]"
        style={{ ...t(1.1, 1), ["--x1" as string]: "calc(34cqw - 8px)", ["--y1" as string]: "calc(55cqw - 8px)", ["--cx" as string]: "calc(50cqw - 8px)", ["--cy" as string]: "calc(28.75cqw - 8px)", ["--x2" as string]: "calc(66cqw - 8px)", ["--y2" as string]: "calc(50cqw - 8px)" }}
      />
      <Etiquette a={0.4} className="top-[5%] left-[6%]">Le duo · J{j}</Etiquette>
      <div className="absolute right-[7%] bottom-[8%] flex flex-col items-end text-right">
        <span className="a-claque block origin-right" style={t(2.1, 0.5)}>
          <Gros taille={84}>×{duo.n}</Gros>
        </span>
        <span className="a-fondu mono-label text-[9px] text-white/55" style={t(2.4)}>la même passe</span>
        <span className="a-fondu mt-2 block text-[13px] font-bold" style={t(2.6)}>{id.nom(duo.passeur)} → {id.nom(duo.buteur)}</span>
      </div>
    </>
  );
}

/* ================================= Ils montent ================================= */

/** L'ascenseur : le rang défile de l'ancien au nouveau, la carte grimpe ; les autres suivent en petit. */
export function CineMontent({ montent, j }: { montent: Honneur["montent"]; j: number }) {
  const joueur = useJoueurs();
  const id = useIdentites();
  const [tete, ...autres] = montent.map((m) => ({ ...m, p: joueur(m.nom) })).filter((m) => m.p) as (Honneur["montent"][number] & { p: Player })[];
  if (!tete) return null;
  const s = TAILLE.grande;
  return (
    <>
      <div className="absolute top-[9%] left-[6%]">
        <div className="a-monte" style={t(0.2, 1.6)}>
          <Carte p={tete.p} size={s} detail={`${tete.rang}e au Pépite d'Or · +${tete.gain} places`} />
        </div>
      </div>
      <div className="absolute top-[9%] right-[7%] flex flex-col items-end text-right">
        <span className="a-fondu mono-label text-[9.5px] text-white/50" style={t(0.5)}>Pépite d&apos;Or</span>
        <span className="flex items-start leading-none" style={{ fontFamily: ANTON }}>
          <Rouleau n={tete.rang} de={tete.rang + tete.gain} a={0.7} du={1.6} style={{ fontSize: 96 }} />
          <span className="a-fondu mt-2 text-[28px] text-white/50" style={t(1.6)}>e</span>
        </span>
        <span className="a-claque mt-2 rounded-full bg-white px-3 py-1 text-[13px] font-bold text-black" style={t(2, 0.5)}>
          ▲ {tete.gain} {pl(tete.gain, "place", "places")}
        </span>
        <span className="a-fondu mt-2 text-[12.5px] text-white/60" style={t(2.2)}>
          {tete.rang + tete.gain}e → {tete.rang}e
        </span>
      </div>
      <div className="absolute inset-x-[6%] bottom-[7%] flex flex-col gap-2">
        <span className="a-monte leading-none uppercase" style={{ ...t(1.4), fontFamily: ANTON, fontSize: 26 }}>{id.nom(tete.nom)}</span>
        {autres.length > 0 && (
          <div className="flex gap-3">
            {autres.slice(0, 4).map((m, i) => (
              <div key={m.nom} className="a-monte flex items-center gap-1.5" style={t(2.5 + i * 0.15)}>
                <Carte p={m.p} size={TAILLE.petite} detail={`${m.rang}e · +${m.gain}`} />
                <span className="text-[12px] font-bold tabular-nums">▲{m.gain}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <Etiquette a={2.8} className="top-[4%] left-1/2 -translate-x-1/2">J{j}</Etiquette>
    </>
  );
}

/* ================================== Le podium ================================== */

/** Les marches poussent (3e, 2e, 1re), les cartes y tombent, les rayons derrière le premier. */
export function CinePodium({ j }: { j: number }) {
  const { players } = useSeason();
  const top = rankPlayers(players).slice(0, 3);
  if (top.length === 0) return null;
  const ordre = [
    { p: top[1], h: 22, s: TAILLE.moyenne, a: 0.9, x: "17%" },
    { p: top[0], h: 34, s: TAILLE.grande, a: 1.6, x: "50%" },
    { p: top[2], h: 14, s: TAILLE.moyenne, a: 0.4, x: "83%" },
  ];
  return (
    <>
      <div aria-hidden className="a-rayons absolute top-[26%] left-1/2 size-[120%] -translate-x-1/2 -translate-y-1/2" style={{ ...t(1.9, 2.2), background: "repeating-conic-gradient(from 0deg, rgba(255,214,120,0.1) 0 6deg, transparent 6deg 16deg)", maskImage: "radial-gradient(closest-side, #000 15%, transparent 75%)", WebkitMaskImage: "radial-gradient(closest-side, #000 15%, transparent 75%)" }} />
      <Etiquette a={0.2} className="top-[4%] left-1/2 -translate-x-1/2">Pépite d&apos;Or · après J{j}</Etiquette>
      {ordre.map(({ p, h, s, a, x }, i) =>
        p ? (
          <div key={p.name} className="absolute bottom-0 flex w-[30%] -translate-x-1/2 flex-col items-center" style={{ left: x }}>
            <div className="a-tombe mb-2" style={t(a, 1.2)}>
              <Carte p={p} size={s} detail={`${p.rank}e au Pépite d'Or · ${p.pp} pts`} />
            </div>
            <div className="a-hausse flex w-full flex-col items-center justify-start rounded-t-[10px] bg-gradient-to-b from-white/[0.16] to-white/[0.03] pt-2" style={{ ...t(0.1 + (2 - i) * 0.15, 0.8), height: `${h}cqh`, minHeight: h * 4 }}>
              <span className="leading-none" style={{ fontFamily: ANTON, fontSize: i === 1 ? 44 : 32 }}>{p.rank}</span>
              <span className="mt-1 text-[12px] font-bold tabular-nums text-white/70"><Compte n={p.pp} a={a + 0.6} du={0.8} /> pts</span>
            </div>
          </div>
        ) : null
      )}
    </>
  );
}

/* ================================== La course ================================== */

/** Les barres partent ensemble, à l'échelle du premier ; l'écart claque à la fin. */
export function CineCourse({ moi }: { moi: string }) {
  const { players } = useSeason();
  const classes = rankPlayers(players);
  const tete = classes.slice(0, 5);
  const ici = classes.find((p) => p.name === moi);
  const lignes = ici && !tete.some((p) => p.name === moi) ? [...tete, ici] : tete;
  const max = Math.max(1, tete[0]?.pp ?? 1);
  const ecart = tete[0] && tete[1] ? tete[0].pp - tete[1].pp : 0;
  return (
    <>
      <Etiquette a={0.1} className="top-[5%] left-[6%]">La course au Pépite d&apos;Or</Etiquette>
      <div className="absolute inset-x-[6%] top-[12%] flex flex-col gap-[3.2%]">
        {lignes.map((p, i) => (
          <div key={p.name} className={cn("flex items-center gap-2.5", p.name === moi && i === lignes.length - 1 && lignes.length > tete.length && "mt-3")}>
            <span className="w-5 text-right text-[13px] font-bold text-white/45 tabular-nums">{p.rank}</span>
            <div className="a-pop" style={t(0.2 + i * 0.08, 0.5)}>
              <Carte p={p} size={TAILLE.petite} detail={`${p.rank}e · ${p.pp} pts`} />
            </div>
            <div className="relative h-7 flex-1">
              <span
                className={cn("a-barre absolute inset-y-0 left-0 rounded-full", p.name === moi ? "bg-white" : "bg-white/25")}
                style={{ ...t(0.6, 1.6 + i * 0.12), width: `${Math.max(6, (p.pp / max) * 100)}%` }}
              />
              <span className={cn("absolute inset-y-0 left-2.5 flex items-center text-[12.5px] font-bold tabular-nums", p.name === moi && "text-black")}>
                <Compte n={p.pp} a={0.6} du={1.6 + i * 0.12} />
              </span>
            </div>
          </div>
        ))}
      </div>
      {ecart > 0 && (
        <div className="absolute right-[6%] bottom-[7%] text-right">
          <span className="a-claque block origin-right" style={t(2.6, 0.5)}>
            <Gros taille={56}>+{ecart}</Gros>
          </span>
          <span className="a-fondu mono-label text-[9px] text-white/50" style={t(2.9)}>d&apos;avance pour le premier</span>
        </div>
      )}
    </>
  );
}

/* =============================== Dans la surface =============================== */

/** Chacun devant sa cage : l'anneau de son badge se remplit jusqu'au dernier pas. */
export function CineSurface({ surface, j }: { surface: Surface[]; j: number }) {
  const joueur = useJoueurs();
  const liste = surface.map((s) => ({ ...s, p: joueur(s.nom) })).filter((s) => s.p).slice(0, 3) as (Surface & { p: Player })[];
  return (
    <>
      <Etiquette a={0.1} className="top-[5%] left-[6%]">À un pas · après J{j}</Etiquette>
      <div className="absolute inset-x-[5%] top-[13%] bottom-[6%] flex flex-col justify-around">
        {liste.map((s, i) => {
          const def = DEF[s.id];
          const seuil = def.paliers[s.palier - 1];
          const m = metal(s.palier)!;
          const plein = (seuil - s.reste) / seuil;
          const a = 0.3 + i * 0.35;
          return (
            <div key={s.nom} className="flex items-center gap-4">
              <div className="a-glisse-g" style={t(a, 0.7)}>
                <Carte p={s.p} size={TAILLE.petite} detail={`${def.nom} · ${s.reste} de plus`} />
              </div>
              <div className="relative size-[64px] shrink-0">
                <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
                  <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                  <circle className="a-anneau" style={{ ...t(a + 0.4, 1.4), ["--plein" as string]: plein }} pathLength={1} cx="20" cy="20" r="17" fill="none" stroke={LUEUR[m]} strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 grid place-items-center opacity-60">
                  <Badge3D badge={{ famille: "palier", id: s.id, palier: s.palier }} largeur={34} />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <span className="a-fondu block truncate text-[15px] font-bold" style={t(a + 0.5)}><NomDe n={s.nom} /></span>
                <span className="a-fondu block text-[12.5px] text-white/60" style={t(a + 0.7)}>
                  {def.nom} {NOM_METAL[m].toLowerCase()} · plus que {s.reste} {s.reste > 1 ? def.unite[1] : def.unite[0]}
                </span>
              </div>
              <span className="a-claque text-[22px] tabular-nums" style={{ ...t(a + 1.6, 0.5), fontFamily: ANTON }}>
                {seuil - s.reste}/{seuil}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function NomDe({ n }: { n: string }) {
  return <>{useIdentites().nom(n)}</>;
}

/* =================================== Le récap =================================== */

/** Le terrain se dessine, le dimanche se résume en trois chiffres qui défilent. */
export function CineRecap({ j, date, buts, matchs, joueurs }: { j: number; date: string; buts: number; matchs: number; joueurs: number }) {
  return (
    <>
      <svg aria-hidden className="absolute inset-[7%] h-[86%] w-[86%]" viewBox="0 0 100 125" preserveAspectRatio="none" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.5">
        <rect className="a-trace" style={t(0, 1.6)} pathLength={1} x="0.5" y="0.5" width="99" height="124" rx="3" />
        <path className="a-trace" style={t(0.5, 1)} pathLength={1} d="M0.5 62.5H99.5" />
        <circle className="a-trace" style={t(0.8, 1)} pathLength={1} cx="50" cy="62.5" r="12" />
        <path className="a-trace" style={t(1, 1)} pathLength={1} d="M30 0.5v16h40v-16M30 124.5v-16h40v16" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
        <span className="a-fondu mono-label text-[10px] text-white/50" style={t(0.6)}>{date}</span>
        <span className="a-claque leading-none" style={{ ...t(0.8, 0.6), fontFamily: ANTON, fontSize: 120 }}>J{j}</span>
        <div className="mt-4 flex gap-8">
          {[
            { n: buts, l: pl(buts, "but", "buts") },
            { n: matchs, l: pl(matchs, "match", "matchs") },
            { n: joueurs, l: pl(joueurs, "joueur", "joueurs") },
          ].map((c, i) => (
            <span key={c.l} className="a-monte flex flex-col items-center" style={t(1.3 + i * 0.15)}>
              <Rouleau n={c.n} a={1.4 + i * 0.15} du={1.3} style={{ fontFamily: ANTON, fontSize: 40 }} />
              <span className="mono-label mt-1 text-[9px] text-white/50">{c.l}</span>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

/* ================================= Ton dimanche ================================= */

/** Ta carte fait un tour complet et se pose ; tes chiffres du jour s'allument autour. */
export function CineToi({ p, j, buts, passes, pp, delta, reel = false }: { p: Player; j: number; buts: number; passes: number; pp: number; delta: number; reel?: boolean }) {
  // En 9:16, la carte prend toute la largeur utile ; elle s'incline au défilement.
  const s = reel ? 0.95 : TAILLE.geante;
  // Les chiffres à zéro ne s'affichent pas : un dimanche se raconte par ce qu'il a donné.
  const places = ["left-[5%] top-[18%]", "right-[5%] top-[18%]", "left-[5%] bottom-[14%]"];
  const chiffres = [
    buts > 0 && { n: buts, l: pl(buts, "but", "buts") },
    passes > 0 && { n: passes, l: pl(passes, "passe", "passes") },
    { n: pp, l: "pts", plus: true },
  ]
    .filter((c): c is { n: number; l: string; plus?: boolean } => !!c)
    .map((c, i) => ({ ...c, x: places[i] }));
  return (
    <>
      <div aria-hidden className="a-fondu absolute inset-0" style={{ ...t(0.6, 1.4), background: "radial-gradient(55% 45% at 50% 48%, rgba(255,255,255,0.16), transparent 70%)" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className={reel ? "defile-incline" : undefined}>
          <div className="a-tour relative" style={t(0.1, 2)}>
            <Carte p={p} size={s} detail={`Ton dimanche · J${j}`} />
            <Reflet a={2} largeur={L(s)} hauteur={H(s)} />
          </div>
        </div>
      </div>
      {chiffres.map((c, i) => (
        <span key={c.l} className={cn("a-pop absolute flex flex-col items-center rounded-2xl bg-black/50 px-3 py-2 backdrop-blur-md", c.x)} style={t(2 + i * 0.2, 0.5)}>
          <Gros taille={34}><Compte n={c.n} a={2 + i * 0.2} du={0.6} prefixe={c.plus ? "+" : ""} /></Gros>
          <span className="mono-label text-[8.5px] text-white/55">{c.l}</span>
        </span>
      ))}
      {delta !== 0 && (
        <span className="a-pop absolute right-[5%] bottom-[14%] flex flex-col items-center rounded-2xl bg-white px-3 py-2 text-black" style={t(2.7, 0.5)}>
          <Gros taille={34}>{delta > 0 ? `▲${delta}` : `▼${-delta}`}</Gros>
          <span className="mono-label text-[8.5px] text-black/55">{pl(Math.abs(delta), "place", "places")}</span>
        </span>
      )}
      <Etiquette a={2.9} className="top-[5%] left-1/2 -translate-x-1/2">Ton dimanche · J{j}</Etiquette>
    </>
  );
}

/* ============================ Le chiffre du dimanche ============================ */

/**
 * La typo d'abord, en carré : le chiffre monte en géant derrière un cache,
 * l'unité tombe lettre à lettre, puis la carte de celui qui l'a fait.
 */
export function CineChiffre({ nom, n, quoi, j }: { nom: string; n: number; quoi: "buts" | "passes"; j: number }) {
  const p = useJoueurs()(nom);
  const id = useIdentites();
  const unite = quoi === "buts" ? pl(n, "but", "buts") : pl(n, "passe", "passes");
  return (
    <>
      <Etiquette a={0.1} className="top-[6%] left-[6%]">Le chiffre du dimanche · J{j}</Etiquette>
      <div className="absolute inset-x-[4%] top-[8%] h-[66%] overflow-hidden">
        <span className="a-monte absolute bottom-0 left-0 leading-none tabular-nums" style={{ ...t(0.3, 1), fontFamily: ANTON, fontSize: "62cqw" }}>
          {n}
        </span>
      </div>
      <div className="absolute right-[6%] top-[22%] text-right uppercase" style={{ fontFamily: ANTON, fontSize: 40, lineHeight: 0.9 }}>
        <Lettres texte={unite} a={0.9} pas={0.06} anim="a-descend" du={0.5} />
        <span className="a-fondu mono-label mt-2 block text-[9.5px] tracking-[0.1em] normal-case text-white/50" style={{ ...t(1.5), fontFamily: "inherit" }}>
          en un dimanche
        </span>
      </div>
      <div className="absolute inset-x-[6%] bottom-[6%] flex items-center gap-3">
        {p && (
          <div className="a-pop" style={t(1.6, 0.5)}>
            <Carte p={p} size={TAILLE.petite} detail={`${n} ${unite} · J${j}`} />
          </div>
        )}
        <span className="a-glisse-g leading-none uppercase" style={{ ...t(1.8, 0.6), fontFamily: ANTON, fontSize: 28 }}>{id.nom(nom)}</span>
      </div>
    </>
  );
}

/* ============================== Ils étaient là ============================== */

/**
 * Le paquet : toutes les cartes du dimanche partent du centre et s'ouvrent en
 * éventail ; le nombre défile au-dessus.
 */
export function CinePresents({ noms, j }: { noms: string[]; j: number }) {
  const joueur = useJoueurs();
  const cartes = noms.map((n) => joueur(n)).filter(Boolean).slice(0, 24) as Player[];
  const nb = cartes.length;
  const ouverture = Math.min(150, 40 + nb * 5.5);
  return (
    <>
      <div className="absolute inset-x-0 top-[8%] flex flex-col items-center">
        <Rouleau n={noms.length} a={0.3} du={1.4} style={{ fontFamily: ANTON, fontSize: 96 }} />
        <span className="a-fondu mono-label mt-1 text-[10px] text-white/55" style={t(1.2)}>sur le terrain · J{j}</span>
      </div>
      <div className="absolute bottom-[-30%] left-1/2 h-0 w-0">
        {cartes.map((p, i) => {
          const angle = nb > 1 ? -ouverture / 2 + (ouverture * i) / (nb - 1) : 0;
          return (
            <div
              key={p.name}
              className="a-donne absolute"
              style={{
                ...t(0.6 + i * 0.05, 0.8),
                left: -L(TAILLE.petite) / 2,
                bottom: 0,
                transformOrigin: "50% 100%",
                transform: `rotate(${angle}deg) translateY(-270px)`,
                ["--dx" as string]: "0px",
                ["--dy" as string]: "0px",
                ["--r" as string]: "0deg",
                zIndex: i,
              }}
            >
              <Carte p={p} size={TAILLE.petite} detail={`J${j}`} />
            </div>
          );
        })}
      </div>
    </>
  );
}
