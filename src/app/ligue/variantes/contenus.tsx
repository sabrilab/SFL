"use client";

// Les six façons de remplir l'onglet League, à l'essai (Sabri, 22/10 :
// « donner des variantes de ce que ça peut représenter »). Toutes lisent la
// vraie saison (useSeason) et montrent des cartes, jamais une liste de noms :
// grande pour celui qu'on regarde, moyennes autour, petites pour le reste.
//   2 · Classement d'abord — le podium, puis le classement, le dernier dimanche en une ligne ;
//   3 · La saison — le calendrier des journées, la prochaine en avant, le haut du classement ;
//   4 · Ma place — ma carte, ceux juste au-dessus et en dessous, ma courbe ;
//   5 · Les ligues — une tuile par ligue (SFL, Bola ; Région et Monde à venir) ;
//   6 · Le match d'après — la convocation (qui vient, je viens), le dernier résultat, le classement.
// Le fil (1) est celui de /ligue, tel quel (page.tsx).

import Link from "next/link";
import { useMemo } from "react";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { carteNeutre } from "@/components/sfl/qui-vient";
import { useSeason } from "@/components/sfl/season-provider";
import { PresencePanel } from "@/components/sfl/presence-panel";
import { Nom } from "@/components/sfl/nom";
import { rankPlayers, type Player, type RankedPlayer } from "@/lib/sfl/engine";
import { classementAVie, compterMatchs, type Classe } from "@/lib/sfl/ligue-vierge";
import { DEMO_LIGUE_VIERGE, demoMatchs } from "@/lib/sfl/ligue-vierge-demo";
import { aujourdhuiIso } from "@/lib/sfl/matchs";
import { computeStandings } from "@/lib/sfl/saisie/engine";
import { activeConvocation, journeeJouee, terrainDeJournee } from "@/lib/sfl/saisie/mutations";
import { numeroSaison } from "@/lib/sfl/saisie/types";
import { cn } from "@/lib/utils";
import type { Ligue } from "./titres";


const rang = (n: number) => (n === 1 ? "1er" : `${n}e`);

/* --------------------------------- Données --------------------------------- */

/** Le classement Pépite d'Or de la saison : ceux qui ont joué. */
function useClassementSfl(): RankedPlayer[] {
  const { players } = useSeason();
  return useMemo(() => rankPlayers(players.filter((p) => p.matchs > 0)), [players]);
}

/** Le classement à vie de Bola (en aperçu, les matchs de démonstration). */
function useClassementBola(): Classe[] {
  const { allPlayers } = useSeason();
  return useMemo(() => {
    const noms = allPlayers.filter((p) => p.matchs > 0).map((p) => p.name);
    if (!DEMO_LIGUE_VIERGE || noms.length < 10) return [];
    return classementAVie(compterMatchs(demoMatchs(noms, aujourdhuiIso())));
  }, [allPlayers]);
}

interface JourneeCal {
  j: number;
  date: string;
  jouee: boolean;
  score: string | null;
  mvp: string | null;
  heure: string | null;
  terrain: string | null;
}

/** Les journées de la saison, jouées ou non, et la prochaine. */
function useCalendrier() {
  const { saison, journees } = useSeason();
  return useMemo(() => {
    const conv = activeConvocation(saison);
    const liste: JourneeCal[] = [...saison.journees]
      .sort((a, b) => a.j - b.j)
      .map((m) => {
        const jouee = journeeJouee(saison, m.j);
        const d = journees.find((x) => x.j === m.j);
        return {
          j: m.j,
          date: m.date,
          jouee,
          // Chaque match du dimanche, son score : « 7–5 · 4–6 ».
          score: jouee && d?.matches?.length ? d.matches.map((x) => `${x.teamA.score}–${x.teamB.score}`).join(" · ") : null,
          mvp: saison.entries.find((e) => e.j === m.j && e.mvp)?.player ?? null,
          heure: m.heure ?? conv?.heure ?? null,
          terrain: terrainDeJournee(saison, m, conv?.lieu)?.nom ?? conv?.lieu ?? null,
        };
      });
    const jouees = liste.filter((x) => x.jouee);
    const derniere = jouees[jouees.length - 1] ?? null;
    const aVenir = liste.find((x) => !x.jouee) ?? null;
    // La convocation ouverte fait foi pour la prochaine, même sans journée créée.
    const prochaine = conv
      ? { date: conv.date, heure: conv.heure, terrain: aVenir?.terrain ?? conv.lieu, j: aVenir?.j ?? (derniere?.j ?? 0) + 1 }
      : aVenir && { date: aVenir.date, heure: aVenir.heure, terrain: aVenir.terrain, j: aVenir.j };
    return { liste, derniere, prochaine: prochaine || null };
  }, [saison, journees]);
}

/* ------------------------------ Petites pièces ------------------------------ */

function Section({ titre, children, className }: { titre: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 px-5", className)}>
      <h2 className="mono-label text-foreground/45">{titre}</h2>
      {children}
    </section>
  );
}

function useJoueur() {
  const { allPlayers } = useSeason();
  const parNom = useMemo(() => new Map(allPlayers.map((p) => [p.name, p])), [allPlayers]);
  return (nom: string): Player => parNom.get(nom) ?? carteNeutre(nom);
}

/** Une ligne du classement : le rang, la petite carte, le nom, les points. */
function Ligne({ n, joueur, nom, points, moi }: { n: number; joueur: Player; nom: string; points: number; moi?: boolean }) {
  return (
    <li className={cn("flex items-center gap-3 rounded-[18px] py-1.5 pr-3 pl-1.5", moi && "glass")}>
      <span className="w-7 text-right text-[13px] font-bold text-foreground/45 tabular-nums">{n}</span>
      <MiniCarte player={joueur} size={FORMAT_CARTE.petite} />
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
        <Nom n={nom} />
      </span>
      <span className="text-[15px] font-bold tabular-nums">{points}</span>
    </li>
  );
}

/** Le podium : le premier en grand au milieu, deuxième et troisième en moyen. */
function Podium({ trois }: { trois: { joueur: Player; nom: string; points: number }[] }) {
  const ordre = [trois[1], trois[0], trois[2]];
  return (
    <div className="flex items-end justify-center gap-3 px-3">
      {ordre.map((x, i) =>
        x ? (
          <div key={x.nom} className="flex min-w-0 flex-col items-center gap-1.5">
            <MiniCarte player={x.joueur} size={i === 1 ? FORMAT_CARTE.grande : FORMAT_CARTE.moyenne} />
            <span className="max-w-[127px] truncate text-[13px] font-bold">
              <Nom n={x.nom} />
            </span>
            <span className="text-[12px] font-semibold text-foreground/50 tabular-nums">
              {rang(i === 1 ? 1 : i === 0 ? 2 : 3)} · {x.points} pts
            </span>
          </div>
        ) : (
          <span key={i} className="w-[78px]" />
        )
      )}
    </div>
  );
}

function ClassementSfl({ depuis = 0, moi }: { depuis?: number; moi?: string }) {
  const classement = useClassementSfl();
  return (
    <ol className="flex flex-col gap-1">
      {classement.slice(depuis).map((p) => (
        <Ligne key={p.name} n={p.rank} joueur={p} nom={p.name} points={p.pp} moi={p.name === moi} />
      ))}
    </ol>
  );
}

/** Le dernier dimanche, en une ligne : la journée, le score, le MVP. */
function DernierDimanche() {
  const { derniere } = useCalendrier();
  const joueur = useJoueur();
  if (!derniere) return null;
  return (
    <Link href={`/ligue/journee?j=${derniere.j}`} className="glass mx-5 flex items-center gap-3 rounded-[22px] py-2 pr-4 pl-2">
      {derniere.mvp && <MiniCarte player={joueur(derniere.mvp)} size={FORMAT_CARTE.petite} distinction="mvp" />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-bold">
          J{derniere.j} · {derniere.date}
        </span>
        {derniere.mvp && (
          <span className="truncate text-[13px] font-medium text-foreground/55">
            MVP <Nom n={derniere.mvp} />
          </span>
        )}
      </span>
      {derniere.score && <span className="text-[20px] font-bold tracking-tight tabular-nums">{derniere.score}</span>}
    </Link>
  );
}

/** La ligue Bola, quand on la choisit dans l'en-tête : son classement à vie. */
function ContenuBola() {
  const classement = useClassementBola();
  const joueur = useJoueur();
  const { me } = useMyPlayer();
  if (classement.length === 0) return null;
  return (
    <>
      <Podium trois={classement.slice(0, 3).map((c) => ({ joueur: joueur(c.name), nom: c.name, points: c.points }))} />
      <Section titre="À vie">
        <ol className="flex flex-col gap-1">
          {classement.slice(3).map((c) => (
            <Ligne key={c.id} n={c.rank} joueur={joueur(c.name)} nom={c.name} points={c.points} moi={c.name === me} />
          ))}
        </ol>
      </Section>
    </>
  );
}

/* --------------------------------- Variantes --------------------------------- */

/** V2 · Classement d'abord. */
export function ClassementDabord({ ligue }: { ligue: Ligue }) {
  const classement = useClassementSfl();
  const { me } = useMyPlayer();
  if (ligue === "bola") return <ContenuBola />;
  return (
    <>
      <Podium trois={classement.slice(0, 3).map((p) => ({ joueur: p, nom: p.name, points: p.pp }))} />
      <DernierDimanche />
      <Section titre="Pépite d'Or">
        <ClassementSfl depuis={3} moi={me} />
      </Section>
    </>
  );
}

/** V3 · La saison : les journées, la prochaine en avant. */
export function LaSaison({ ligue }: { ligue: Ligue }) {
  const { liste, prochaine } = useCalendrier();
  const classement = useClassementSfl();
  const { saison } = useSeason();
  const joueur = useJoueur();
  if (ligue === "bola") return <ContenuBola />;
  const jouees = [...liste.filter((x) => x.jouee)].reverse();
  return (
    <>
      {prochaine && (
        <div className="mx-5 flex flex-col gap-1 rounded-[26px] bg-foreground px-5 py-4 text-background">
          <span className="mono-label opacity-55">J{prochaine.j}</span>
          <span className="text-[26px] leading-tight font-bold tracking-tight">{prochaine.date}</span>
          <span className="text-[15px] font-semibold opacity-70">
            {[prochaine.heure, prochaine.terrain].filter(Boolean).join(" · ")}
          </span>
        </div>
      )}
      <Section titre={`Saison ${numeroSaison(saison)}`}>
        <ol className="flex flex-col gap-1">
          {jouees.map((x) => (
            <li key={x.j}>
              <Link href={`/ligue/journee?j=${x.j}`} className="flex items-center gap-3 rounded-[18px] py-1.5 pr-3 pl-1.5">
                <span className="w-9 text-[13px] font-bold text-foreground/45 tabular-nums">J{x.j}</span>
                {x.mvp ? (
                  <MiniCarte player={joueur(x.mvp)} size={FORMAT_CARTE.petite} distinction="mvp" />
                ) : (
                  <span className="size-12 rounded-[12px] border-[1.5px] border-dashed border-foreground/15" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-semibold">{x.date}</span>
                  {x.mvp && (
                    <span className="truncate text-[12px] font-medium text-foreground/50">
                      MVP <Nom n={x.mvp} />
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[14px] font-bold tabular-nums">{x.score ?? "–"}</span>
              </Link>
            </li>
          ))}
        </ol>
      </Section>
      <Section titre="Pépite d'Or">
        <div className="flex justify-between">
          {classement.slice(0, 5).map((p) => (
            <div key={p.name} className="flex flex-col items-center gap-1">
              <MiniCarte player={p} size={FORMAT_CARTE.petite} />
              <span className="text-[11px] font-bold tabular-nums">{rang(p.rank)}</span>
              <span className="text-[11px] font-medium text-foreground/50 tabular-nums">{p.pp} pts</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

/** Mon rang après chaque journée jouée. */
function useMaCourbe(me: string) {
  const { saison } = useSeason();
  return useMemo(() => {
    const js = [...new Set(saison.entries.filter((e) => journeeJouee(saison, e.j)).map((e) => e.j))].sort((a, b) => a - b);
    return js
      .map((j) => {
        const r = rankPlayers(computeStandings({ ...saison, entries: saison.entries.filter((e) => e.j <= j) }).filter((p) => p.matchs > 0));
        return { j, rank: r.find((p) => p.name === me)?.rank ?? null };
      })
      .filter((x): x is { j: number; rank: number } => x.rank !== null);
  }, [saison, me]);
}

/** La courbe de mon rang : en haut, la tête du classement. */
function Courbe({ points }: { points: { j: number; rank: number }[] }) {
  if (points.length < 2) return null;
  const W = 350;
  const H = 96;
  const max = Math.max(...points.map((p) => p.rank), 3);
  const x = (i: number) => 14 + (i * (W - 28)) / (points.length - 1);
  const y = (r: number) => 14 + ((r - 1) * (H - 40)) / Math.max(1, max - 1);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.rank).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Mon rang, journée après journée">
      <path d={d} fill="none" stroke="currentColor" strokeOpacity={0.85} strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={p.j}>
          <circle cx={x(i)} cy={y(p.rank)} r={i === points.length - 1 ? 4.5 : 3} fill="currentColor" />
          <text x={x(i)} y={H - 4} textAnchor="middle" className="fill-current text-[10px] font-semibold opacity-45">
            J{p.j}
          </text>
          <text x={x(i)} y={y(p.rank) - 8} textAnchor="middle" className="fill-current text-[10px] font-bold opacity-80">
            {p.rank}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** V4 · Ma place : ma carte, mes voisins, ma courbe, puis la ligue. */
export function MaPlace({ ligue }: { ligue: Ligue }) {
  const { me, player } = useMyPlayer();
  const classes = useClassementSfl();
  // Pas encore joué : je suis au bout, à zéro.
  const classement = useMemo(
    () => (classes.some((p) => p.name === me) || !player ? classes : [...classes, { ...player, rank: classes.length + 1 }]),
    [classes, me, player]
  );
  const courbe = useMaCourbe(me);
  if (ligue === "bola") return <ContenuBola />;
  const i = classement.findIndex((p) => p.name === me);
  const moi = classement[i];
  if (!moi) return null;
  const dessus = classement[i - 1];
  const dessous = classement[i + 1];
  const ecart = (p?: RankedPlayer) => (p ? p.pp - moi.pp : 0);
  return (
    <>
      <div className="flex flex-col items-center gap-2 px-5">
        <MiniCarte player={moi} size={FORMAT_CARTE.grande} />
        <span className="text-[40px] leading-none font-bold tracking-tight tabular-nums">{rang(moi.rank)}</span>
        <span className="text-[14px] font-semibold text-foreground/55 tabular-nums">{moi.pp} pts</span>
      </div>
      <div className="flex justify-center gap-10 px-5">
        {[dessus, dessous].map((p, k) =>
          p ? (
            <div key={p.name} className="flex flex-col items-center gap-1.5">
              <MiniCarte player={p} size={FORMAT_CARTE.moyenne} />
              <span className="max-w-[96px] truncate text-[13px] font-bold">
                <Nom n={p.name} />
              </span>
              <span className="text-[12px] font-semibold text-foreground/50 tabular-nums">
                {rang(p.rank)} · {k === 0 ? `+${ecart(p)}` : ecart(p)} pts
              </span>
            </div>
          ) : null
        )}
      </div>
      {courbe.length > 1 && (
        <Section titre="Mon rang">
          <Courbe points={courbe} />
        </Section>
      )}
      <Section titre="Pépite d'Or">
        <ol className="flex flex-col gap-1">
          {classement.map((p) => (
            <Ligne key={p.name} n={p.rank} joueur={p} nom={p.name} points={p.pp} moi={p.name === me} />
          ))}
        </ol>
      </Section>
    </>
  );
}

/** V5 · Les ligues : une tuile par ligue. */
export function LesLigues() {
  const { me } = useMyPlayer();
  const { saison } = useSeason();
  const sfl = useClassementSfl();
  const bola = useClassementBola();
  const joueur = useJoueur();
  const moiSfl = sfl.find((p) => p.name === me);
  const moiBola = bola.find((c) => c.name === me);
  const tuiles = [
    {
      href: "/ligue",
      logo: "/bola/sfl.svg",
      l: 70,
      libelle: "SFL",
      quoi: `Saison ${numeroSaison(saison)}`,
      moi: moiSfl ? `${rang(moiSfl.rank)} · ${moiSfl.pp} pts` : null,
      tete: sfl.slice(0, 3).map((p) => p.name),
    },
    {
      href: "/ligue-vierge",
      logo: "/bola/logo-blanc.svg",
      l: 74,
      libelle: "Bola",
      quoi: "À vie",
      moi: moiBola ? `${rang(moiBola.rank)} · ${moiBola.points} pts` : null,
      tete: bola.slice(0, 3).map((c) => c.name),
    },
  ];
  return (
    <div className="flex flex-col gap-3 px-4">
      {tuiles.map((t) => (
        <Link key={t.href} href={t.href} className="glass flex flex-col gap-4 rounded-[28px] p-5">
          <div className="flex items-start justify-between">
            <span
              role="img"
              aria-label={t.libelle}
              className="block h-[26px] bg-current"
              style={{ width: Math.round((t.l * 26) / 18), mask: `url(${t.logo}) left center / contain no-repeat`, WebkitMask: `url(${t.logo}) left center / contain no-repeat` }}
            />
            <span className="mono-label text-foreground/45">{t.quoi}</span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="flex gap-1.5">
              {t.tete.map((n) => (
                <MiniCarte key={n} player={joueur(n)} size={FORMAT_CARTE.petite} />
              ))}
            </div>
            {t.moi && <span className="text-[22px] leading-none font-bold tracking-tight tabular-nums">{t.moi}</span>}
          </div>
        </Link>
      ))}
      <div className="grid grid-cols-2 gap-3">
        {["Région", "Monde"].map((n) => (
          <div key={n} aria-disabled className="glass flex h-[88px] flex-col justify-between rounded-[24px] p-4 opacity-35">
            <span className="text-[19px] font-bold tracking-tight">{n}</span>
            <span className="mono-label">Bientôt</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** V6 · Le match d'après : qui vient (la convocation, ses cartes), le dernier résultat, le classement. */
export function MatchDapres({ ligue }: { ligue: Ligue }) {
  const { me } = useMyPlayer();
  if (ligue === "bola") return <ContenuBola />;
  return (
    <>
      <div className="px-4">
        <PresencePanel compact />
      </div>
      <DernierDimanche />
      <Section titre="Pépite d'Or">
        <ClassementSfl moi={me} />
      </Section>
    </>
  );
}
