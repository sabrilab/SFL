"use client";

// À l'honneur — le haut de la vue Journée de la Ligue : les joueurs d'abord,
// en cartes, mis en scène (calcul : lib/sfl/a-l-honneur).
// Demandes de Sabri, 18/10 : la Ligue est l'endroit où l'on vient voir ce
// qu'on a gagné, ce que les autres ont gagné, et ce qui va tomber, sans que
// rien ne l'explique ; puis « de vraies scènes 3D, avec de la perspective, la
// carte sur le côté, un peu de data ».
//
// Chaque section est une petite scène sur un plateau (sol qui fuit vers
// l'horizon, projecteur, pelouse en perspective) : un studio noir en mode
// sombre, un studio blanc en mode clair (globals.css, --studio-*). Les cartes, elles, sont toujours de face, à
// leur vrai rapport 1 × φ : jamais tournées au repos, jamais écrasées ni
// coupées (Sabri, 18/10 : « ne déforme pas la carte »).
//   · l'homme du dimanche : la grande carte sous un projecteur, les chiffres
//     du jour à côté en grand ;
//   · ils ont décroché    : une vitrine par joueur, la carte et son badge qui
//     flotte à côté, la lumière du métal au sol ;
//   · l'équipe type       : les cinq sur la pelouse, le meilleur du jour au
//     centre en carte moyenne ;
//   · le duo              : les deux cartes, la trajectoire du ballon ;
//   · ils montent         : des marches, plus haute est la remontée ;
//   · dans la surface     : devant le but, le badge en verre au-dessus de
//     chaque joueur qui l'attend.
// Trois tailles de carte, au nombre d'or : la grande, la moyenne = grande ÷ φ,
// la petite = moyenne ÷ φ. Toucher une carte l'ouvre en grand. Une section
// sans rien à montrer ne s'affiche pas. « Réduire les animations » coupe le
// flottement lent des cartes et des badges (globals.css, .honneur-*).
// Les cartes en vedette (homme du dimanche, badges décrochés, duo) se font
// tourner au doigt, avec un peu d'élan, puis reviennent à leur pose (Sabri,
// 18/10 : « rendre certaines cartes un peu manipulables »).

import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { AuVestiaireRond } from "@/components/sfl/au-vestiaire";
import { Badge3D, Objet3D, OBJET_PALIER } from "@/components/sfl/badge-3d";
import { EMBLEMES } from "@/components/sfl/emblemes";
import { MiniCarte } from "@/components/sfl/mini-carte";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { honneurDe } from "@/lib/sfl/a-l-honneur";
import type { Player } from "@/lib/sfl/engine";
import { metal, NOM_METAL, TROPHEES, type TropheeId } from "@/lib/sfl/trophees";
import type { PieceLigue } from "@/lib/sfl/vestiaire";
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


/* ------------------------------- Le plateau ------------------------------- */

/** Un plateau : fond de studio, projecteur, sol quadrillé qui fuit vers l'horizon. */
function Scene({
  hauteur,
  lumiere = "var(--studio-lumiere)",
  horizon = 0.62,
  sol = true,
  className,
  style,
  children,
}: {
  /** Sans hauteur, la scène prend celle de son contenu. */
  hauteur?: number;
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
      className={cn("relative isolate overflow-hidden rounded-[26px] text-contraste", className)}
      style={{
        height: hauteur,
        perspective: 900,
        perspectiveOrigin: `50% ${Math.round(horizon * 100) - 22}%`,
        background: `radial-gradient(120% 70% at 50% 0%, ${lumiere} 0%, transparent 60%), var(--studio-fond)`,
        boxShadow: "var(--studio-cadre)",
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
            background: `radial-gradient(40% 30% at 50% 6%, ${lumiere} 0%, transparent 100%), repeating-linear-gradient(90deg, var(--studio-grille-1) 0 1px, transparent 1px 44px), repeating-linear-gradient(0deg, var(--studio-grille-2) 0 1px, transparent 1px 44px)`,
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
/** Le titre d'une scène, et en face le bouton rond qui la partage au Vestiaire. */
function Titre({ children, j, partage }: { children: string; j?: number; partage?: PieceLigue["lignes"] }) {
  return (
    <>
      <h2 className="absolute top-[var(--fib-13)] left-[var(--fib-21)] z-10 text-[15px] font-bold tracking-tight text-contraste/90">
        {children}
        {j != null && <span className="text-contraste/40"> · J{j}</span>}
      </h2>
      {partage && partage.length > 0 && (
        <AuVestiaireRond
          piece={{ type: "ligue", titre: children, j, lignes: partage.slice(0, 6) }}
          className="absolute top-[var(--fib-8)] right-[var(--fib-13)] z-10"
        />
      )}
    </>
  );
}

/** Un chiffre du jour : le nombre en Anton, son unité en dessous. */
function Chiffre({ n, label, taille = 55, couleur }: { n: ReactNode; label: string; taille?: number; couleur?: string }) {
  return (
    <div className="flex flex-col items-end">
      <span style={{ fontFamily: ANTON, fontSize: taille, lineHeight: 0.9, color: couleur }} className="tabular-nums">
        {n}
      </span>
      <span className="mono-label mt-1 text-[9px] text-contraste/45">{label}</span>
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
        background: "radial-gradient(closest-side, var(--studio-ombre), transparent)",
      }}
    />
  );
}

/** Une rangée de scènes qui défile sur téléphone et passe à la ligne sur ordinateur. */
function Rangee({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-[var(--fib-13)] overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

/* ------------------------------- La pelouse ------------------------------ */

/**
 * La pelouse en perspective, dessinée à plat (SVG) : le terrain fuit vers le
 * haut, tondu en bandes, tracé à la craie. Les cartes se posent devant, de
 * face, sans jamais être déformées ni coupées (le 18/10, la vraie 3D les
 * écrasait et Safari les tranchait dans le plan).
 */
function Pelouse({ surface = false, haut = "72%" }: { surface?: boolean; haut?: string }) {
  // Le trapèze : 22 → 78 en haut, -6 → 106 en bas (repère 100 × 100).
  const x = (u: number, v: number) => 22 - 28 * v + u * (56 + 56 * v);
  const ligne = (u0: number, v0: number, u1: number, v1: number) => `M ${x(u0, v0)} ${v0 * 100} L ${x(u1, v1)} ${v1 * 100}`;
  const cadre = (u0: number, v0: number, u1: number, v1: number) =>
    `${ligne(u0, v0, u1, v0)} ${ligne(u1, v0, u1, v1)} ${ligne(u1, v1, u0, v1)} ${ligne(u0, v1, u0, v0)}`;
  // Les bandes de tonte s'élargissent vers nous.
  const bandes = Array.from({ length: 8 }, (_, i) => {
    const v0 = (i / 8) ** 1.35;
    const v1 = ((i + 1) / 8) ** 1.35;
    return { d: `M ${x(0, v0)} ${v0 * 100} L ${x(1, v0)} ${v0 * 100} L ${x(1, v1)} ${v1 * 100} L ${x(0, v1)} ${v1 * 100} Z`, clair: i % 2 === 0 };
  });
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 w-full"
      style={{ height: haut, maskImage: "var(--studio-pelouse-masque)", WebkitMaskImage: "var(--studio-pelouse-masque)" }}
    >
      <defs>
        <linearGradient id="pelouse-fondu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--studio-fondu-haut)", stopOpacity: "var(--studio-fondu-haut-a)" }} />
          <stop offset="0.3" stopColor="#0b0c0f" stopOpacity="0" />
          <stop offset="0.85" stopColor="#050506" stopOpacity="0" />
          <stop offset="1" style={{ stopColor: "var(--studio-fondu-bas)", stopOpacity: "var(--studio-fondu-bas-a)" }} />
        </linearGradient>
      </defs>
      {bandes.map((b, i) => (
        <path key={i} d={b.d} style={{ fill: b.clair ? "var(--studio-herbe-1)" : "var(--studio-herbe-2)" }} />
      ))}
      <g fill="none" strokeWidth="1.2" vectorEffect="non-scaling-stroke" style={{ stroke: "var(--studio-craie)" }}>
        <path d={cadre(0.02, 0.02, 0.98, 1.2)} vectorEffect="non-scaling-stroke" />
        {surface ? (
          <>
            <path d={cadre(0.14, 0.02, 0.86, 0.62)} vectorEffect="non-scaling-stroke" />
            <path d={cadre(0.34, 0.02, 0.66, 0.24)} vectorEffect="non-scaling-stroke" />
          </>
        ) : (
          <>
            <path d={cadre(0.27, 0.02, 0.73, 0.2)} vectorEffect="non-scaling-stroke" />
            <path d={ligne(0.02, 0.9, 0.98, 0.9)} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </g>
      <rect x="-10" y="0" width="120" height="100" fill="url(#pelouse-fondu)" />
    </svg>
  );
}

/** Un joueur posé sur la pelouse : sa carte de face, son ombre, son nom en entier. */
function Joueur({ p, size, moi, detail, chiffre, dessus }: { p: Player; size: number; moi: boolean; detail: string; chiffre?: string; dessus?: ReactNode }) {
  return (
    <div className="flex flex-col items-center" style={{ width: W(size) + 21 }}>
      {dessus}
      <div className={cn("relative flex rounded-[6px]", moi && "ring-2 ring-primary ring-offset-2 ring-offset-transparent")}>
        <Ombre largeur={W(size)} />
        <MiniCarte player={p} size={size} detail={detail} />
      </div>
      <span
        className={cn("titre-lettrage mt-[var(--fib-8)] w-full text-center leading-[1.05] tracking-[-0.02em] break-words", moi ? "text-primary" : "text-contraste")}
        style={{ fontSize: size >= MOYENNE ? 13 : 10.5 }}
      >
        {p.name}
      </span>
      {chiffre && <span className="mono-label mt-0.5 text-[9px] text-contraste/55 tabular-nums">{chiffre}</span>}
    </div>
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

/* ------------------------------ Au doigt ------------------------------- */

function mouvementReduit() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Une carte qu'on fait tourner au doigt : glisser à l'horizontale la fait
 * pivoter sur elle-même (le défilement vertical reste à la page), lâcher lui
 * laisse son élan, puis un ressort la ramène à sa pose. Un vrai glissé n'ouvre
 * pas la carte ; un simple toucher, si.
 */
function Manipulable({ pose, children, className }: { pose: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let angle = pose;
    let vitesse = 0;
    let doigt: { x: number; angle: number; t: number; dernier: number } | null = null;
    let glisse = false;
    let raf = 0;
    const poser = () => {
      el.style.transform = `rotateY(${angle}deg)`;
    };
    const ressort = () => {
      cancelAnimationFrame(raf);
      if (mouvementReduit()) {
        angle = pose;
        poser();
        return;
      }
      const pas = () => {
        // Ressort amorti vers la pose (60 i/s).
        vitesse += (pose - angle) * 0.045;
        vitesse *= 0.9;
        angle += vitesse;
        poser();
        if (Math.abs(vitesse) > 0.02 || Math.abs(pose - angle) > 0.05) raf = requestAnimationFrame(pas);
        else {
          angle = pose;
          poser();
        }
      };
      raf = requestAnimationFrame(pas);
    };
    const bas = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      doigt = { x: e.clientX, angle, t: performance.now(), dernier: e.clientX };
      glisse = false;
      vitesse = 0;
    };
    const bouge = (e: PointerEvent) => {
      if (!doigt) return;
      const dx = e.clientX - doigt.x;
      if (!glisse && Math.abs(dx) < 6) return;
      if (!glisse) el.setPointerCapture?.(e.pointerId);
      glisse = true;
      const t = performance.now();
      const neuf = doigt.angle + dx * 0.6;
      vitesse = ((e.clientX - doigt.dernier) * 0.6 * 16) / Math.max(8, t - doigt.t);
      doigt.t = t;
      doigt.dernier = e.clientX;
      angle = neuf;
      poser();
    };
    const haut = () => {
      if (!doigt) return;
      doigt = null;
      if (glisse) ressort();
    };
    // Un glissé n'est pas un toucher : on avale le clic qui le suit.
    const clic = (e: MouseEvent) => {
      if (glisse) {
        e.stopPropagation();
        e.preventDefault();
        glisse = false;
      }
    };
    poser();
    el.addEventListener("pointerdown", bas);
    el.addEventListener("pointermove", bouge);
    el.addEventListener("pointerup", haut);
    el.addEventListener("pointercancel", haut);
    el.addEventListener("click", clic, true);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", bas);
      el.removeEventListener("pointermove", bouge);
      el.removeEventListener("pointerup", haut);
      el.removeEventListener("pointercancel", haut);
      el.removeEventListener("click", clic, true);
    };
  }, [pose]);
  return (
    <div ref={ref} className={cn("relative flex cursor-grab touch-pan-y select-none active:cursor-grabbing", className)} style={{ transformStyle: "preserve-3d", transform: `rotateY(${pose}deg)` }}>
      {children}
    </div>
  );
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
        <section className="flex flex-col gap-[var(--fib-13)]">
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="text-[17px] font-bold tracking-tight">
              Ils ont décroché <span className="text-foreground/40">· J{j}</span>
            </h2>
            <AuVestiaireRond
              piece={{
                type: "ligue",
                titre: "Ils ont décroché",
                j,
                lignes: decroches.slice(0, 6).map((d) => ({
                  n: d.nom,
                  v: `${DEF[d.id].nom} · ${NOM_METAL[metal(d.palier)!]}`,
                })),
              }}
            />
          </div>
          <Rangee>
            {decroches.map((d) => (
              <Vitrine key={`${d.nom}-${d.id}`} d={d} p={carte(d.nom)!} />
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

/** Les chiffres du jour d'un MVP, en une ligne. */
const chiffresMvp = (m: Mvp) =>
  [m.buts > 0 && `${m.buts} ${unite("buts", m.buts)}`, m.passes > 0 && `${m.passes} ${unite("passes", m.passes)}`, `+${m.pp} pts`]
    .filter(Boolean)
    .join(" · ");

/** La carte de face, sous le projecteur ; les chiffres du jour à droite. */
function HommeDuDimanche({ j, m, p, moi }: { j: number; m: Mvp; p: Player; moi: string }) {
  const largeur = W(GRANDE);
  const hauteur = H(GRANDE);
  return (
    <section>
      <Scene hauteur={hauteur + 110} horizon={(hauteur + 62) / (hauteur + 110)}>
        <Titre j={j} partage={[{ n: m.nom, v: chiffresMvp(m) }]}>
          L&apos;homme du dimanche
        </Titre>
        {/* Le cône du projecteur, sur la carte. */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0"
          style={{
            left: 0,
            width: largeur + 60,
            height: "100%",
            background: "linear-gradient(180deg, var(--studio-cone) 0%, transparent 85%)",
            clipPath: "polygon(38% 0, 62% 0, 100% 100%, 0 100%)",
          }}
        />
        <div className="absolute" style={{ left: 14, bottom: 48, transformStyle: "preserve-3d" }}>
          <Manipulable pose={0}>
            <div className="honneur-flotte relative flex" style={{ transformStyle: "preserve-3d" }}>
              <Ombre largeur={largeur} />
              <MiniCarte player={p} size={GRANDE} detail={`MVP · J${j}`} distinction="mvp" />
            </div>
          </Manipulable>
        </div>
        {/* Les chiffres du jour. */}
        <div className="absolute flex flex-col items-end gap-[var(--fib-13)]" style={{ right: 20, top: 52 }}>
          <span className="mono-label text-[9px] text-[#9a6b12] dark:text-[#ffc75a]">MVP</span>
          {m.buts > 0 && <Chiffre n={m.buts} label={unite("buts", m.buts)} />}
          {m.passes > 0 && <Chiffre n={m.passes} label={unite("passes", m.passes)} taille={m.buts ? 34 : 55} />}
          <Chiffre n={`+${m.pp}`} label="pts" taille={34} couleur="rgb(var(--contraste-rgb) / 0.55)" />
        </div>
        <span
          className={cn("titre-lettrage absolute right-5 bottom-[var(--fib-13)] max-w-[40%] text-[16px] leading-none break-words text-right", m.nom === moi ? "text-primary" : "text-contraste")}
        >
          {m.nom}
        </span>
      </Scene>
    </section>
  );
}

/** Plusieurs matchs, plusieurs MVP : côte à côte, chacun ses chiffres. */
function HommesDuDimanche({ j, mvp, moi }: { j: number; mvp: (Mvp & { p: Player })[]; moi: string }) {
  const deux = mvp.slice(0, 2);
  const hauteur = H(MOYENNE);
  return (
    <section>
      <Scene hauteur={hauteur + 150} horizon={(hauteur + 96) / (hauteur + 150)}>
        <Titre j={j} partage={deux.map((m) => ({ n: m.nom, v: chiffresMvp(m) }))}>
          Les hommes du dimanche
        </Titre>
        <div className="absolute inset-x-0 flex justify-center gap-[var(--fib-34)]" style={{ bottom: 58, transformStyle: "preserve-3d" }}>
          {deux.map((m) => (
            <Manipulable key={m.nom} pose={0}>
              <Ombre largeur={W(MOYENNE)} />
              <MiniCarte player={m.p} size={MOYENNE} detail={`MVP · J${j}`} distinction="mvp" />
            </Manipulable>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-[var(--fib-13)] flex justify-center gap-[var(--fib-34)]">
          {deux.map((m) => (
            <div key={m.nom} className="flex flex-col items-center" style={{ width: W(MOYENNE) }}>
              <span className={cn("titre-lettrage max-w-full text-center text-[13px] leading-none tracking-[-0.02em] break-words", m.nom === moi ? "text-primary" : "text-contraste")}>
                {m.nom}
              </span>
              <span className="mono-label text-[9px] text-contraste/45 tabular-nums">
                {[m.buts && `${m.buts} ${unite("buts", m.buts)}`, m.passes && `${m.passes} ${unite("passes", m.passes)}`, `+${m.pp} pts`].filter(Boolean).join(" · ")}
              </span>
            </div>
          ))}
        </div>
      </Scene>
    </section>
  );
}

/**
 * Un badge tombé ce dimanche. Noir mat, sans décor (Sabri, 18/10 : la
 * vitrine voûtée ne lui plaisait pas) : la carte à gauche, le badge et son
 * chiffre à droite. Noir et blanc strict, seul le badge garde son métal.
 * Blanc mat en mode clair, comme le studio (globals.css, .vitrine-mate).
 */
function Vitrine({ d, p }: { d: { nom: string; id: TropheeId; palier: number }; p: Player }) {
  const def = DEF[d.id];
  const m = metal(d.palier)!;
  const seuil = def.paliers[d.palier - 1];
  const largeur = W(MOYENNE);
  const hauteur = H(MOYENNE);
  const badge = largeur / PHI;
  return (
    <div
      className="vitrine-mate relative flex shrink-0 snap-start gap-[var(--fib-21)] rounded-[21px] p-[var(--fib-21)]"
      style={{ height: hauteur + 42 }}
    >
      <Manipulable pose={0}>
        <MiniCarte player={p} size={MOYENNE} detail={`${def.nom} · ${NOM_METAL[m]} · ${seuil} ${unite(d.id, seuil)}`} />
      </Manipulable>
      <div className="flex flex-col justify-between" style={{ width: badge * 1.2 }}>
        <span className="honneur-flotte pointer-events-none block self-center">
          <Badge3D badge={{ famille: "palier", id: d.id, palier: d.palier }} largeur={badge} />
        </span>
        <div className="flex flex-col border-t border-contraste/10 pt-[var(--fib-13)]">
          <span style={{ fontFamily: ANTON, fontSize: 55, lineHeight: 0.85 }} className="tabular-nums">
            {seuil}
          </span>
          <span className="mono-label mt-[var(--fib-8)] text-[9px] text-contraste/55">{unite(d.id, seuil)}</span>
          <span className="mono-label text-[9px] text-contraste/30">{NOM_METAL[m]}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Les cinq du jour sur la pelouse : deux devant le but adverse, trois plus
 * près de nous ; le meilleur du jour au centre, en carte moyenne, les autres
 * en petites. Toutes de face, rien n'est coupé.
 */
function EquipeType({ j, equipe, moi }: { j: number; equipe: { nom: string; pp: number; p: Player }[]; moi: string }) {
  const meilleur = equipe.reduce((a, b) => (b.pp > a.pp ? b : a));
  const autres = equipe.filter((e) => e !== meilleur);
  const fond = autres.slice(0, 2);
  const [gauche, droite] = autres.slice(2);
  const joueur = (e: { nom: string; pp: number; p: Player }, size: number) => (
    <Joueur key={e.nom} p={e.p} size={size} moi={e.nom === moi} detail={`Équipe type · J${j} · ${e.pp} pts`} chiffre={`+${e.pp} pts`} />
  );
  return (
    <section>
      <Scene sol={false} lumiere="var(--studio-lumiere-verte)">
        <Pelouse haut="86%" />
        <Titre j={j} partage={[...equipe].sort((a, b) => b.pp - a.pp).map((e) => ({ n: e.nom, v: `+${e.pp} pts` }))}>
          L&apos;équipe type
        </Titre>
        <div className="relative flex flex-col items-center gap-[var(--fib-13)] px-[var(--fib-13)] pt-[var(--fib-55)] pb-[var(--fib-21)]">
          <div className="flex justify-center gap-[var(--fib-55)]">{fond.map((e) => joueur(e, PETITE))}</div>
          <div className="flex items-end justify-center gap-[var(--fib-8)]">
            {gauche && joueur(gauche, PETITE)}
            {joueur(meilleur, MOYENNE)}
            {droite && joueur(droite, PETITE)}
          </div>
        </div>
      </Scene>
    </section>
  );
}

/** La passe et le but : les deux cartes, la courbe du ballon entre elles. */
function Duo({ j, duo, passeur, buteur, moi }: { j: number; duo: { passeur: string; buteur: string; n: number }; passeur: Player; buteur: Player; moi: string }) {
  const hauteur = H(MOYENNE);
  return (
    <section>
      <Scene hauteur={hauteur + 150} horizon={(hauteur + 96) / (hauteur + 150)}>
        <Titre
          j={j}
          partage={[
            { n: duo.passeur, v: `${duo.n} ${unite("passes", duo.n)}` },
            { n: duo.buteur, v: `${duo.n} ${unite("buts", duo.n)}` },
          ]}
        >
          Le duo
        </Titre>
        <svg aria-hidden viewBox="0 0 100 40" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-[18%] top-[50px] h-[70px] text-contraste/50">
          <path d="M 4 38 Q 50 -14 96 38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute top-[46px] left-1/2 -translate-x-1/2 tabular-nums" style={{ fontFamily: ANTON, fontSize: 34, lineHeight: 1 }}>
          ×{duo.n}
        </span>
        <div className="absolute inset-x-0 flex justify-center gap-[var(--fib-55)]" style={{ bottom: 58, transformStyle: "preserve-3d" }}>
          {[passeur, buteur].map((p) => (
            <Manipulable key={p.name} pose={0}>
              <Ombre largeur={W(MOYENNE)} />
              <MiniCarte player={p} size={MOYENNE} detail={`Le duo · J${j}`} />
            </Manipulable>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-[var(--fib-13)] flex justify-center gap-[var(--fib-55)]">
          {[
            { nom: duo.passeur, label: unite("passes", duo.n) },
            { nom: duo.buteur, label: unite("buts", duo.n) },
          ].map((x) => (
            <div key={x.nom} className="flex flex-col items-center" style={{ width: W(MOYENNE) }}>
              <span className={cn("titre-lettrage max-w-full text-center text-[13px] leading-none tracking-[-0.02em] break-words", x.nom === moi ? "text-primary" : "text-contraste")}>
                {x.nom}
              </span>
              <span className="mono-label text-[9px] text-contraste/45">{x.label}</span>
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
        <Titre partage={montent.map((m) => ({ n: m.nom, v: `▲ ${m.gain} · ${m.rang}e` }))}>Ils montent</Titre>
        <div
          className="absolute inset-x-0 flex items-end justify-center gap-[var(--fib-8)]"
          style={{ bottom: 22 }}
        >
          {marches.map((m) => {
            const haut = 55 + (m.gain / max) * 34;
            return (
              <div key={m.nom} className="flex flex-col items-center" style={{ width: largeur + 4, transformStyle: "preserve-3d" }}>
                <MiniCarte player={m.p} size={PETITE} detail={`${m.rang}e · ▲ ${m.gain}`} />
                {/* La marche, où le gain est gravé. */}
                <div className="relative w-full">
                  <div
                    className="flex w-full flex-col items-center justify-start pt-1.5"
                    style={{ height: haut, background: "var(--studio-marche)", boxShadow: "var(--studio-marche-reflet)" }}
                  >
                    <span className="text-primary tabular-nums" style={{ fontFamily: ANTON, fontSize: 21, lineHeight: 1 }}>
                      ▲{m.gain}
                    </span>
                    <span className={cn("mt-0.5 max-w-full px-1 text-center text-[10px] leading-tight font-semibold break-words", m.nom === moi ? "text-primary" : "text-contraste/75")}>{m.nom}</span>
                    <span className="mono-label text-[8.5px] text-contraste/40 tabular-nums">{m.rang}e</span>
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

/** Dans la surface : devant le but, le prochain badge en verre au-dessus de chacun. */
function Surface({ surface, moi }: { surface: { nom: string; id: TropheeId; reste: number; p: Player }[]; moi: string }) {
  return (
    <section>
      <Scene sol={false} lumiere="var(--studio-lumiere-surface)">
        <Pelouse surface />
        <Titre partage={surface.map((s) => ({ n: s.nom, v: `${DEF[s.id].nom} dans ${s.reste} ${unite(s.id, s.reste)}` }))}>
          Dans la surface
        </Titre>
        {/* Le but, au fond de la surface. */}
        <div
          aria-hidden
          className="absolute left-1/2 h-[34px] w-[89px] -translate-x-1/2 rounded-t-[2px] border-[2.5px] border-b-0"
          style={{
            top: 52,
            borderColor: "var(--studio-but)",
            filter: "var(--studio-but-cerne)",
            background: "repeating-linear-gradient(90deg, var(--studio-filet) 0 1px, transparent 1px 6px), repeating-linear-gradient(0deg, var(--studio-filet) 0 1px, transparent 1px 6px)",
          }}
        />
        <div className="relative flex items-end justify-center gap-[var(--fib-13)] px-[var(--fib-13)] pt-[118px] pb-[var(--fib-21)]">
          {surface.map((s) => {
            const def = DEF[s.id];
            return (
              <Joueur
                key={`${s.nom}-${s.id}`}
                p={s.p}
                size={PETITE}
                moi={s.nom === moi}
                detail={`${def.nom} · encore ${s.reste} ${unite(s.id, s.reste)}`}
                chiffre={`${s.reste} ${unite(s.id, s.reste)}`}
                dessus={
                  <span className="honneur-flotte mb-[var(--fib-8)] block">
                    <Objet3D objet={OBJET_PALIER[s.id]} matiere="fantome" taille={W(PETITE) / PHI} embleme={EMBLEMES[s.id]} />
                  </span>
                }
              />
            );
          })}
        </div>
      </Scene>
    </section>
  );
}
