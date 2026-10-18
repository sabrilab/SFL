"use client";

// À l'honneur — le haut de la vue Journée de la Ligue : les joueurs d'abord,
// en cartes, mis en scène (calcul : lib/sfl/a-l-honneur).
// Demandes de Sabri, 18/10 : la Ligue est l'endroit où l'on vient voir ce
// qu'on a gagné, ce que les autres ont gagné, et ce qui va tomber, sans que
// rien ne l'explique ; puis « de vraies scènes 3D, avec de la perspective, la
// carte sur le côté, un peu de data ».
//
// Chaque section est une petite scène en CSS 3D (perspective, sans WebGL) sur
// un plateau sombre, comme la carte, qui ne suit pas le thème de l'app :
//   · l'homme du dimanche : la carte de biais sous un projecteur, les
//     chiffres du jour à côté en grand ;
//   · ils ont décroché    : une vitrine par joueur, la carte tournée vers son
//     badge qui flotte devant, la lumière du métal au sol ;
//   · l'équipe type       : les cinq debout sur un terrain en perspective, leur
//     nom peint sur la pelouse comme à la télé ;
//   · le duo              : les deux cartes face à face, la trajectoire du ballon ;
//   · ils montent         : des marches, plus haute est la remontée ;
//   · dans la surface     : la surface de réparation, le badge en verre au-dessus
//     de chaque joueur qui l'attend.
// Trois tailles de carte, au nombre d'or : la grande, la moyenne = grande ÷ φ,
// la petite = moyenne ÷ φ. Toucher une carte l'ouvre en grand. Une section
// sans rien à montrer ne s'affiche pas. « Réduire les animations » coupe le
// balancement lent des cartes et des badges (globals.css, .honneur-*).

import { Fragment, useMemo, type CSSProperties, type ReactNode } from "react";
import { Badge3D, Objet3D, OBJET_PALIER } from "@/components/sfl/badge-3d";
import { EMBLEMES } from "@/components/sfl/emblemes";
import { MiniCarte } from "@/components/sfl/mini-carte";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { honneurDe } from "@/lib/sfl/a-l-honneur";
import type { Player } from "@/lib/sfl/engine";
import { metal, NOM_METAL, TROPHEES, type Metal, type TropheeId } from "@/lib/sfl/trophees";
import { cn } from "@/lib/utils";

const PHI = (1 + Math.sqrt(5)) / 2;
/** La carte fait 254 × 411 px × size (1 × φ). */
const LARGEUR = 254;
const GRANDE = 0.85;
const MOYENNE = GRANDE / PHI;
const PETITE = MOYENNE / PHI;
const W = (size: number) => LARGEUR * size;
const H = (size: number) => LARGEUR * size * PHI;

const ANTON = "var(--font-anton), Anton, sans-serif";
const DEF = Object.fromEntries(TROPHEES.map((t) => [t.id, t]));
const unite = (id: TropheeId, n: number) => (n > 1 ? DEF[id].unite[1] : DEF[id].unite[0]);

/** La lumière de chaque métal, pour le sol et les chiffres. */
const TEINTE: Record<Metal, string> = {
  bronze: "#e9925a",
  argent: "#d5dcf5",
  or: "#ffc75a",
  legende: "#ff5a4a",
};

/* ------------------------------- Le plateau ------------------------------- */

/** Un plateau : fond de studio, projecteur, sol quadrillé qui fuit vers l'horizon. */
function Scene({
  hauteur,
  lumiere = "rgba(255,255,255,0.16)",
  horizon = 0.62,
  sol = true,
  className,
  style,
  children,
}: {
  hauteur: number;
  lumiere?: string;
  /** Hauteur de l'horizon, de 0 (haut) à 1 (bas). */
  horizon?: number;
  sol?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("relative isolate overflow-hidden rounded-[26px] text-white", className)}
      style={{
        height: hauteur,
        perspective: 900,
        perspectiveOrigin: `50% ${Math.round(horizon * 100) - 22}%`,
        background: `radial-gradient(120% 70% at 50% 0%, ${lumiere} 0%, transparent 60%), linear-gradient(180deg, #17181d 0%, #0b0c0f 62%, #050506 100%)`,
        ...style,
      }}
    >
      {sol && (
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: "-60%",
            width: "220%",
            top: `${horizon * 100}%`,
            height: 700,
            transformOrigin: "50% 0%",
            transform: "rotateX(84deg)",
            background: `radial-gradient(40% 30% at 50% 6%, ${lumiere} 0%, transparent 100%), repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 44px), repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 44px)`,
            maskImage: "linear-gradient(180deg, #000 0%, transparent 70%)",
            WebkitMaskImage: "linear-gradient(180deg, #000 0%, transparent 70%)",
          }}
        />
      )}
      {children}
    </div>
  );
}

/** Le titre d'une scène, posé en haut à gauche sur le plateau. */
function Titre({ children, j }: { children: string; j?: number }) {
  return (
    <h2 className="absolute top-[var(--fib-13)] left-[var(--fib-21)] z-10 text-[15px] font-bold tracking-tight text-white/90">
      {children}
      {j != null && <span className="text-white/40"> · J{j}</span>}
    </h2>
  );
}

/** Un chiffre du jour : le nombre en Anton, son unité en dessous. */
function Chiffre({ n, label, taille = 55, couleur }: { n: ReactNode; label: string; taille?: number; couleur?: string }) {
  return (
    <div className="flex flex-col items-end">
      <span style={{ fontFamily: ANTON, fontSize: taille, lineHeight: 0.9, color: couleur }} className="tabular-nums">
        {n}
      </span>
      <span className="mono-label mt-1 text-[9px] text-white/45">{label}</span>
    </div>
  );
}

/** L'ombre de contact sous une carte posée. */
function Ombre({ largeur }: { largeur: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 -translate-x-1/2"
      style={{
        bottom: -largeur * 0.06,
        width: largeur * 1.2,
        height: largeur * 0.16,
        background: "radial-gradient(closest-side, rgba(0,0,0,0.75), transparent)",
      }}
    />
  );
}

/** Une rangée de scènes qui défile sur téléphone et passe à la ligne sur ordinateur. */
function Rangee({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 flex snap-x snap-mandatory gap-[var(--fib-13)] overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

/* --------------------------- Le terrain en 3D ---------------------------- */

const INCLINAISON = 60;

/**
 * Un plan de pelouse couché en perspective. Ses enfants y sont posés par leurs
 * coordonnées (x, y en px sur le plan) ; `Debout` les relève face à nous.
 */
function Pelouse({ largeur, profondeur, bas, children }: { largeur: number; profondeur: number; bas: number; children: ReactNode }) {
  return (
    <div
      className="absolute left-1/2"
      style={{
        width: largeur,
        height: profondeur,
        bottom: bas,
        marginLeft: -largeur / 2,
        transformStyle: "preserve-3d",
        transformOrigin: "50% 100%",
        transform: `rotateX(${INCLINAISON}deg)`,
      }}
    >
      {children}
    </div>
  );
}

function Debout({ x, y, children, className }: { x: number; y: number; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("absolute flex flex-col items-center", className)}
      style={{ left: x, top: y, transformOrigin: "0 0", transform: `rotateX(${-INCLINAISON}deg) translate(-50%, -100%)`, transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}

/** Ce qu'on peint sur la pelouse, au pied d'un joueur. */
function Peint({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center text-center" style={{ left: x, top: y + 8 }}>
      {children}
    </div>
  );
}

/** L'ombre d'un joueur debout, sur la pelouse. */
function OmbrePelouse({ x, y }: { x: number; y: number }) {
  return (
    <span
      aria-hidden
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: x, top: y, width: W(PETITE) * 1.4, height: W(PETITE) * 0.8, background: "radial-gradient(closest-side, rgba(0,0,0,0.7), transparent)" }}
    />
  );
}

/** Le gazon, tondu en bandes, qui se perd dans le noir. */
function Gazon({ bande }: { bande: number }) {
  return (
    <div
      aria-hidden
      className="absolute -inset-x-20 -inset-y-12"
      style={{
        background: `repeating-linear-gradient(180deg, #15301d 0 ${bande}px, #19381f ${bande}px ${bande * 2}px)`,
        maskImage: "radial-gradient(70% 70% at 50% 55%, #000 50%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(70% 70% at 50% 55%, #000 50%, transparent 100%)",
      }}
    />
  );
}

// Les postes d'attaque devant, puis le milieu, la défense, le gardien.
function rangPoste(poste: string): number {
  const p = poste.toUpperCase();
  if (/^(AT|AD|AG|BU)/.test(p)) return 0;
  if (/^(MC|MO|MD)/.test(p)) return 1;
  if (/^G$/.test(p)) return 3;
  return 2;
}

/* -------------------------------- Les scènes ------------------------------ */

export function ALHonneur({ j }: { j: number }) {
  const { saison, players } = useSeason();
  const { player: moi } = useMyPlayer();
  const h = useMemo(() => honneurDe(saison, j, moi.name), [saison, j, moi.name]);
  const parNom = useMemo(() => new Map(players.map((p) => [p.name, p])), [players]);
  const carte = (nom: string): Player | undefined => parNom.get(nom);

  const mvp = h.mvp.filter((m) => carte(m.nom));
  const decroches = h.decroches.filter((d) => carte(d.nom));
  const equipe = h.equipeType
    .map((e) => ({ ...e, p: carte(e.nom) }))
    .filter((e): e is typeof e & { p: Player } => !!e.p)
    .sort((a, b) => rangPoste(a.p.poste) - rangPoste(b.p.poste));
  const montent = h.montent.filter((m) => carte(m.nom)).slice(0, 4);
  const surface = h.surface.filter((s) => carte(s.nom)).slice(0, 3);
  const duo = h.duo && carte(h.duo.passeur) && carte(h.duo.buteur) ? h.duo : null;

  if (!mvp.length && !decroches.length && equipe.length < 5 && !montent.length && !surface.length && !duo) return null;

  return (
    <div className="flex flex-col gap-[var(--fib-21)]">
      {mvp.length === 1 && <HommeDuDimanche j={j} m={mvp[0]} p={carte(mvp[0].nom)!} moi={moi.name} />}
      {mvp.length > 1 && <HommesDuDimanche j={j} mvp={mvp.map((m) => ({ ...m, p: carte(m.nom)! }))} moi={moi.name} />}

      {decroches.length > 0 && (
        <section>
          <Rangee>
            {decroches.map((d, i) => (
              <Vitrine key={`${d.nom}-${d.id}`} premier={i === 0} d={d} p={carte(d.nom)!} moi={moi.name} />
            ))}
          </Rangee>
        </section>
      )}

      {equipe.length === 5 && <EquipeType j={j} equipe={equipe} moi={moi.name} />}

      {duo && <Duo j={j} duo={duo} passeur={carte(duo.passeur)!} buteur={carte(duo.buteur)!} moi={moi.name} />}

      {montent.length > 0 && <IlsMontent montent={montent.map((m) => ({ ...m, p: carte(m.nom)! }))} moi={moi.name} />}

      {surface.length > 0 && <Surface surface={surface.map((s) => ({ ...s, p: carte(s.nom)! }))} moi={moi.name} />}
    </div>
  );
}

type Mvp = { nom: string; buts: number; passes: number; pp: number };

/** La carte de biais, sous le projecteur ; les chiffres du jour à droite. */
function HommeDuDimanche({ j, m, p, moi }: { j: number; m: Mvp; p: Player; moi: string }) {
  const largeur = W(GRANDE);
  const hauteur = H(GRANDE);
  return (
    <section>
      <Scene hauteur={hauteur + 110} horizon={(hauteur + 62) / (hauteur + 110)}>
        <Titre j={j}>L&apos;homme du dimanche</Titre>
        {/* Le cône du projecteur, sur la carte. */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0"
          style={{
            left: 0,
            width: largeur + 60,
            height: "100%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0) 85%)",
            clipPath: "polygon(38% 0, 62% 0, 100% 100%, 0 100%)",
          }}
        />
        <div className="absolute" style={{ left: 14, bottom: 48, transformStyle: "preserve-3d", transform: "rotateY(22deg)" }}>
          <div className="honneur-balance relative flex" style={{ transformStyle: "preserve-3d" }}>
            <Ombre largeur={largeur} />
            <MiniCarte player={p} size={GRANDE} detail={`MVP · J${j}`} />
          </div>
        </div>
        {/* Les chiffres du jour. */}
        <div className="absolute flex flex-col items-end gap-[var(--fib-13)]" style={{ right: 20, top: 52 }}>
          <span className="mono-label text-[9px] text-[#ffc75a]">MVP</span>
          {m.buts > 0 && <Chiffre n={m.buts} label={unite("buts", m.buts)} />}
          {m.passes > 0 && <Chiffre n={m.passes} label={unite("passes", m.passes)} taille={m.buts ? 34 : 55} />}
          <Chiffre n={`+${m.pp}`} label="pts" taille={34} couleur="rgba(255,255,255,0.55)" />
        </div>
        <span
          className={cn("absolute right-5 bottom-[var(--fib-13)] max-w-[40%] truncate text-right uppercase", m.nom === moi ? "text-primary" : "text-white")}
          style={{ fontFamily: ANTON, fontSize: 21, letterSpacing: "0.01em" }}
        >
          {m.nom}
        </span>
      </Scene>
    </section>
  );
}

/** Plusieurs matchs, plusieurs MVP : les cartes se font face, chacune ses chiffres. */
function HommesDuDimanche({ j, mvp, moi }: { j: number; mvp: (Mvp & { p: Player })[]; moi: string }) {
  const deux = mvp.slice(0, 2);
  const hauteur = H(MOYENNE);
  return (
    <section>
      <Scene hauteur={hauteur + 150} horizon={(hauteur + 96) / (hauteur + 150)}>
        <Titre j={j}>Les hommes du dimanche</Titre>
        <div className="absolute inset-x-0 flex justify-center gap-[var(--fib-34)]" style={{ bottom: 58, transformStyle: "preserve-3d" }}>
          {deux.map((m, i) => (
            <div key={m.nom} className="relative flex" style={{ transform: `rotateY(${i === 0 ? 26 : -26}deg)`, transformStyle: "preserve-3d" }}>
              <Ombre largeur={W(MOYENNE)} />
              <MiniCarte player={m.p} size={MOYENNE} detail={`MVP · J${j}`} />
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-[var(--fib-13)] flex justify-center gap-[var(--fib-34)]">
          {deux.map((m) => (
            <div key={m.nom} className="flex flex-col items-center" style={{ width: W(MOYENNE) }}>
              <span className={cn("max-w-full truncate uppercase", m.nom === moi ? "text-primary" : "text-white")} style={{ fontFamily: ANTON, fontSize: 17 }}>
                {m.nom}
              </span>
              <span className="mono-label text-[9px] text-white/45 tabular-nums">
                {[m.buts && `${m.buts} ${unite("buts", m.buts)}`, m.passes && `${m.passes} ${unite("passes", m.passes)}`, `+${m.pp} pts`].filter(Boolean).join(" · ")}
              </span>
            </div>
          ))}
        </div>
      </Scene>
    </section>
  );
}

/** Un badge tombé ce dimanche : la carte tournée vers lui, lui qui flotte devant. */
function Vitrine({ d, p, moi, premier }: { d: { nom: string; id: TropheeId; palier: number }; p: Player; moi: string; premier: boolean }) {
  const def = DEF[d.id];
  const m = metal(d.palier)!;
  const seuil = def.paliers[d.palier - 1];
  const largeur = W(MOYENNE);
  const hauteur = H(MOYENNE);
  const badge = largeur / PHI;
  return (
    <Scene
      hauteur={hauteur + 112}
      horizon={(hauteur + 58) / (hauteur + 112)}
      lumiere={`${TEINTE[m]}33`}
      className="shrink-0 snap-start"
      style={{ width: largeur + badge + 70 }}
    >
      {premier && <Titre>Ils ont décroché</Titre>}
      <div className="absolute" style={{ left: 16, bottom: 46, transformStyle: "preserve-3d" }}>
        <div className="relative flex" style={{ transform: "rotateY(28deg)", transformStyle: "preserve-3d" }}>
          <Ombre largeur={largeur} />
          <MiniCarte player={p} size={MOYENNE} detail={`${def.nom} · ${NOM_METAL[m]} · ${seuil} ${unite(d.id, seuil)}`} />
        </div>
      </div>
      {/* Le badge, devant, qui flotte au-dessus de son halo. */}
      <div className="pointer-events-none absolute" style={{ right: 18, bottom: 64 }}>
        <span
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2"
          style={{ bottom: -30, width: badge * 1.3, height: badge * 0.3, background: `radial-gradient(closest-side, ${TEINTE[m]}66, transparent)` }}
        />
        <span className="honneur-flotte block">
          <Badge3D badge={{ famille: "palier", id: d.id, palier: d.palier }} largeur={badge} />
        </span>
      </div>
      <div className="absolute flex flex-col items-end text-right" style={{ right: 18, top: premier ? 44 : 18 }}>
        <span style={{ fontFamily: ANTON, fontSize: 44, lineHeight: 0.9, color: TEINTE[m] }} className="tabular-nums">
          {seuil}
        </span>
        <span className="mono-label mt-1 text-[9px] text-white/50">{unite(d.id, seuil)}</span>
        <span className="mono-label text-[9px]" style={{ color: TEINTE[m] }}>
          {NOM_METAL[m]}
        </span>
      </div>
      <span
        className={cn("absolute bottom-[var(--fib-13)] left-[var(--fib-21)] max-w-[70%] truncate uppercase", d.nom === moi ? "text-primary" : "text-white")}
        style={{ fontFamily: ANTON, fontSize: 17 }}
      >
        {d.nom}
      </span>
    </Scene>
  );
}

/** Les cinq du jour, debout sur la pelouse, leur nom peint à leurs pieds. */
function EquipeType({ j, equipe, moi }: { j: number; equipe: { nom: string; pp: number; p: Player }[]; moi: string }) {
  const L = 330;
  const P = 470;
  // Deux devant le but adverse (au fond), trois plus près de nous.
  const places = [
    [L * 0.3, P * 0.3],
    [L * 0.7, P * 0.3],
    [L * 0.16, P * 0.76],
    [L * 0.5, P * 0.82],
    [L * 0.84, P * 0.76],
  ];
  return (
    <section>
      <Scene hauteur={480} horizon={0.3} sol={false} lumiere="rgba(160,255,190,0.10)">
        <Titre j={j}>L&apos;équipe type</Titre>
        <Pelouse largeur={L} profondeur={P} bas={44}>
          <Gazon bande={40} />
          <svg aria-hidden viewBox={`0 0 ${L} ${P}`} className="absolute inset-0 size-full text-white/35">
            <g fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width={L - 8} height={P - 8} rx="3" />
              <rect x={L * 0.26} y="4" width={L * 0.48} height={P * 0.17} />
              <path d={`M ${L * 0.4} ${P * 0.17 + 4} A ${L * 0.12} ${L * 0.12} 0 0 0 ${L * 0.6} ${P * 0.17 + 4}`} />
              <path d={`M ${L * 0.35} ${P - 4} A ${L * 0.15} ${L * 0.15} 0 0 1 ${L * 0.65} ${P - 4}`} />
            </g>
          </svg>
          {equipe.map((e, i) => {
            const [x, y] = places[i];
            return (
              <Fragment key={e.nom}>
                <OmbrePelouse x={x} y={y} />
                <Peint x={x} y={y}>
                  <span className={cn("max-w-[100px] truncate uppercase", e.nom === moi ? "text-primary" : "text-white/90")} style={{ fontFamily: ANTON, fontSize: 19, letterSpacing: "0.02em" }}>
                    {e.nom}
                  </span>
                  <span className="mono-label text-[10px] text-white/55 tabular-nums">+{e.pp} pts</span>
                </Peint>
                <Debout x={x} y={y}>
                  <MiniCarte player={e.p} size={PETITE} detail={`Équipe type · J${j} · ${e.pp} pts`} />
                </Debout>
              </Fragment>
            );
          })}
        </Pelouse>
      </Scene>
    </section>
  );
}

/** La passe et le but : les cartes face à face, la courbe du ballon entre elles. */
function Duo({ j, duo, passeur, buteur, moi }: { j: number; duo: { passeur: string; buteur: string; n: number }; passeur: Player; buteur: Player; moi: string }) {
  const hauteur = H(MOYENNE);
  return (
    <section>
      <Scene hauteur={hauteur + 150} horizon={(hauteur + 96) / (hauteur + 150)}>
        <Titre j={j}>Le duo</Titre>
        <svg aria-hidden viewBox="0 0 100 40" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-[18%] top-[50px] h-[70px] text-white/50">
          <path d="M 4 38 Q 50 -14 96 38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute top-[46px] left-1/2 -translate-x-1/2 tabular-nums" style={{ fontFamily: ANTON, fontSize: 34, lineHeight: 1 }}>
          ×{duo.n}
        </span>
        <div className="absolute inset-x-0 flex justify-center gap-[var(--fib-55)]" style={{ bottom: 58, transformStyle: "preserve-3d" }}>
          {[passeur, buteur].map((p, i) => (
            <div key={p.name} className="relative flex" style={{ transform: `rotateY(${i === 0 ? 32 : -32}deg)`, transformStyle: "preserve-3d" }}>
              <Ombre largeur={W(MOYENNE)} />
              <MiniCarte player={p} size={MOYENNE} detail={`Le duo · J${j}`} />
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-[var(--fib-13)] flex justify-center gap-[var(--fib-55)]">
          {[
            { nom: duo.passeur, label: unite("passes", duo.n) },
            { nom: duo.buteur, label: unite("buts", duo.n) },
          ].map((x) => (
            <div key={x.nom} className="flex flex-col items-center" style={{ width: W(MOYENNE) }}>
              <span className={cn("max-w-full truncate uppercase", x.nom === moi ? "text-primary" : "text-white")} style={{ fontFamily: ANTON, fontSize: 17 }}>
                {x.nom}
              </span>
              <span className="mono-label text-[9px] text-white/45">{x.label}</span>
            </div>
          ))}
        </div>
      </Scene>
    </section>
  );
}

/** Ils montent : chacun sur sa marche, d'autant plus haute que la remontée est belle. */
function IlsMontent({ montent, moi }: { montent: { nom: string; gain: number; rang: number; p: Player }[]; moi: string }) {
  // Les marches montent de gauche à droite : la plus belle remontée au sommet.
  const marches = [...montent].reverse();
  const max = Math.max(...montent.map((m) => m.gain));
  const largeur = W(PETITE);
  return (
    <section>
      <Scene hauteur={H(PETITE) + 160} horizon={0.84}>
        <Titre>Ils montent</Titre>
        <div
          className="absolute inset-x-0 flex items-end justify-center gap-[var(--fib-8)]"
          style={{ bottom: 22, transformStyle: "preserve-3d", transform: "rotateY(-16deg)" }}
        >
          {marches.map((m) => {
            const haut = 34 + (m.gain / max) * 55;
            return (
              <div key={m.nom} className="flex flex-col items-center" style={{ width: largeur + 4, transformStyle: "preserve-3d" }}>
                <MiniCarte player={m.p} size={PETITE} detail={`${m.rang}e · ▲ ${m.gain}`} />
                {/* La marche : son dessus, puis sa face où le gain est gravé. */}
                <div className="relative w-full" style={{ transformStyle: "preserve-3d" }}>
                  <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-[30px]"
                    style={{ transformOrigin: "50% 0%", transform: "rotateX(90deg)", background: "linear-gradient(180deg, #3a3d45, #24262c)" }}
                  />
                  <div
                    className="flex w-full flex-col items-center justify-start pt-1.5"
                    style={{ height: haut, background: "linear-gradient(180deg, #2a2c33 0%, #101115 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22)" }}
                  >
                    <span className="text-primary tabular-nums" style={{ fontFamily: ANTON, fontSize: 21, lineHeight: 1 }}>
                      ▲{m.gain}
                    </span>
                    <span className={cn("mt-0.5 max-w-full truncate px-1 text-[10px] font-semibold", m.nom === moi ? "text-primary" : "text-white/75")}>{m.nom}</span>
                    <span className="mono-label text-[8.5px] text-white/40 tabular-nums">{m.rang}e</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Scene>
    </section>
  );
}

/** Dans la surface : debout dans la surface de réparation, le prochain badge en verre au-dessus d'eux. */
function Surface({ surface, moi }: { surface: { nom: string; id: TropheeId; reste: number; p: Player }[]; moi: string }) {
  const L = 340;
  const P = 230;
  const n = surface.length;
  return (
    <section>
      <Scene hauteur={410} horizon={0.4} sol={false} lumiere="rgba(160,255,190,0.08)">
        <Titre>Dans la surface</Titre>
        <Pelouse largeur={L} profondeur={P} bas={40}>
          <Gazon bande={36} />
          {/* La ligne de but au fond, la surface, le point de penalty. */}
          <svg aria-hidden viewBox={`0 0 ${L} ${P}`} overflow="visible" className="absolute inset-0 size-full text-white/40">
            <g fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="-80" y1="4" x2={L + 80} y2="4" />
              <rect x="10" y="4" width={L - 20} height={P - 30} />
              <rect x={L * 0.3} y="4" width={L * 0.4} height={P * 0.3} />
              <path d={`M ${L * 0.38} ${P - 26} A ${L * 0.14} ${L * 0.14} 0 0 0 ${L * 0.62} ${P - 26}`} />
            </g>
            <circle cx={L / 2} cy={P * 0.55} r="3" fill="currentColor" />
          </svg>
          {/* Le but, debout sur sa ligne. */}
          <Debout x={L / 2} y={4} className="pointer-events-none">
            <div
              className="h-[50px] w-[150px] rounded-t-[3px] border-[3px] border-b-0 border-white/85"
              style={{ background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.14) 0 1px, transparent 1px 8px), repeating-linear-gradient(0deg, rgba(255,255,255,0.14) 0 1px, transparent 1px 8px)" }}
            />
          </Debout>
          {surface.map((s, i) => {
            const x = (L / (n + 1)) * (i + 1);
            const y = P * 0.74;
            const def = DEF[s.id];
            return (
              <Fragment key={`${s.nom}-${s.id}`}>
                <OmbrePelouse x={x} y={y} />
                <Peint x={x} y={y}>
                  <span className={cn("max-w-[84px] truncate uppercase", s.nom === moi ? "text-primary" : "text-white/90")} style={{ fontFamily: ANTON, fontSize: 16 }}>
                    {s.nom}
                  </span>
                </Peint>
                <Debout x={x} y={y}>
                  <span className="honneur-flotte mb-1 block">
                    <Objet3D objet={OBJET_PALIER[s.id]} matiere="fantome" taille={W(PETITE) / PHI} embleme={EMBLEMES[s.id]} />
                  </span>
                  <span className="mono-label mb-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[9px] text-white/85 tabular-nums">
                    {s.reste} {unite(s.id, s.reste)}
                  </span>
                  <span className={cn("block rounded-[7px]", s.nom === moi && "ring-2 ring-primary")}>
                    <MiniCarte player={s.p} size={PETITE} detail={`${def.nom} · encore ${s.reste} ${unite(s.id, s.reste)}`} />
                  </span>
                </Debout>
              </Fragment>
            );
          })}
        </Pelouse>
      </Scene>
    </section>
  );
}
