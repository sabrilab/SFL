"use client";

// La Ligue vierge — les matchs Bola, ceux que les joueurs ouvrent eux-mêmes
// hors de la SFL, comptés à vie (Sabri, 22/10) : pas de saison, pas de
// trophée de fin de saison, ni Impact ni Défensive ; seulement le MVP que
// l'app désigne à chaque match (ex æquo compris). Le barème et les règles
// sont dans lib/sfl/ligue-vierge.ts.
//
// Le même dessin que Bola Team (Sabri, 26/10 : « quand on va dans Bola, il
// faut que ce soit le même design que l'équipe ») : sous l'en-tête, Ma carte
// / Classement comme Mon équipe / Championnat.
//   · Ma carte : ma carte et mon nom comme l'écusson et le nom de l'équipe,
//     mes chiffres, ma place (elle mène au classement), mes feuilles à tenir
//     (les matchs que j'organise, coup d'envoi passé, encore corrigeables),
//     mes derniers matchs ;
//   · Classement : « À vie », les divisions, le tableau des points comme
//     celui du championnat (rang, carte, J, V, MVP, Pts ; podium en or,
//     argent, bronze), puis les buteurs et les passeurs et les derniers
//     matchs avec leur score et leurs MVP.
//
// Sur tablette et ordinateur (dès 768 px), la largeur des Actus
// (.gabarit-ligue) et deux colonnes au nombre d'or : le classement dans la
// grande, qui reste à l'écran s'il y tient (useCollant), les derniers matchs
// dans la petite ; dès 1024 px, les cartes prennent un cran de plus
// (useFormatCarte) ; dès 1280 px, la suite du classement sur deux colonnes.
// Sous 768 px, rien ne bouge.
//
// Passe du 24/10 (Sabri : « le classement des buteurs, des passeurs, et un
// semi-classement Pépite d'Or qui intègre les victoires, les nuls, les
// défaites et la carte MVP sélectionnée automatiquement ») : Points (le
// barème de Bola, MVP compris), Buteurs et Passeurs (classementBola). « Des divisions une fois qu'on a assez d'utilisateurs […] au
// nombre de points » : dès que le classement des points remplit deux
// divisions de 30, il se découpe en D1, D2… (divisionsBola), recoupées à
// chaque match, sans règle de montée ni de descente ; chaque division compte
// ses places à partir de 1. En aperçu, des divisions de 12 pour les voir
// (sur une préversion, ?apercu=1 force la démonstration). Et pour qui n'a pas d'équipe, la vitrine
// de Bola Team en une ligne (equipe/vitrine-team.tsx).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { LIGNE_PODIUM, RangMetal } from "@/components/sfl/rang-metal";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { VitrineBola } from "@/components/sfl/equipe/vitrine-team";
import { useMonEquipe } from "@/hooks/use-mon-equipe";
import { carteNeutre } from "@/components/sfl/qui-vient";
import { useSeason } from "@/components/sfl/season-provider";
import { FeuilleBola } from "@/components/sfl/matchs/feuille-bola";
import { Nom } from "@/components/sfl/nom";
import { EnteteLigue } from "@/components/sfl/choix-ligue";
import { useSession } from "@/hooks/use-session";
import { useCollant } from "@/hooks/use-collant";
import { useFormatCarte } from "@/hooks/use-format-carte";
import {
  DIVISIONS_BOLA,
  classementAVie,
  classementBola,
  compterMatchs,
  coupDEnvoiPasse,
  divisionsBola,
  feuilleOuverte,
  type ClassementBola,
  type LigneBolaClassee,
  type MatchCompte,
} from "@/lib/sfl/ligue-vierge";
import { DEMO_LIGUE_VIERGE, demoFeuille, demoMatchs } from "@/lib/sfl/ligue-vierge-demo";
import { aujourdhuiIso, libelleJour, listerMesDerniers, lireLigueVierge, monId, type Partie } from "@/lib/sfl/matchs";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { isHidden } from "@/lib/sfl/hidden";

/** La carte d'un joueur de Bola : sa carte de la SFL s'il en a une, sinon une carte neutre. */
function Carte({ name, size, detail }: { name: string; size: number; detail?: string }) {
  const { allPlayers } = useSeason();
  const p = allPlayers.find((x) => x.name.toLowerCase() === name.trim().toLowerCase()) ?? carteNeutre(name);
  return <MiniCarte player={p} size={size} detail={detail} cle={`lv-${name}`} />;
}

const CLASSEMENTS: { id: ClassementBola; label: string; unite: string }[] = [
  { id: "points", label: "Points", unite: "pts" },
  { id: "buts", label: "Buteurs", unite: "buts" },
  { id: "passes", label: "Passeurs", unite: "pd" },
];

function Ligne({ c, rang, moi, cle, unite }: { c: LigneBolaClassee; rang?: number; moi: string | null; cle: ClassementBola; unite: string }) {
  const format = useFormatCarte();
  // Ce que la valeur ne dit pas : les matchs, et les MVP, les passes ou les buts.
  const detail = [
    `${c.matchs} match${c.matchs > 1 ? "s" : ""}`,
    cle === "points" && c.mvp > 0 && `${c.mvp} MVP`,
    cle === "buts" && c.passes > 0 && `${c.passes} pd`,
    cle === "passes" && c.buts > 0 && `${c.buts} but${c.buts > 1 ? "s" : ""}`,
  ].filter(Boolean);
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[18px] bg-card px-3 py-2",
        (rang ?? c.place) <= 3 && LIGNE_PODIUM[(rang ?? c.place) as 1 | 2 | 3],
        c.id === moi && "bg-primary/10"
      )}
    >
      <RangMetal rang={rang ?? c.place} />
      <Carte name={c.name} size={format.petite} detail={`Bola · ${c.valeur} ${unite}`} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold"><Nom n={c.name} /></span>
        <span className="mono-label text-foreground/40">{detail.join(" · ")}</span>
      </span>
      <span className="w-16 text-right text-lg font-bold tracking-tight tabular-nums">
        {c.valeur}
        <span className="mono-label ml-1 text-foreground/40">{unite}</span>
      </span>
    </div>
  );
}

/**
 * Le classement des points en tableau, comme celui du championnat de Bola
 * Team (equipe/championnat.tsx) : rang, carte et nom, matchs, MVP, points ;
 * le podium en or, argent et bronze, ma ligne surlignée.
 */
function TableauPoints({ lignes, decalage, moi }: { lignes: LigneBolaClassee[]; decalage: number; moi: string | null }) {
  const col = "w-8 text-center tabular-nums";
  return (
    <div className="overflow-hidden rounded-[22px] bg-card">
      <div className="mono-label flex items-center gap-2 px-3 pt-3 pb-2 text-foreground/40">
        <span className="w-[26px] text-center">#</span>
        <span className="flex-1">Joueur</span>
        <span className={col}>J</span>
        <span className={cn(col, "hidden sm:block")}>V</span>
        <span className={col}>MVP</span>
        <span className={col}>Pts</span>
      </div>
      <ol>
        {lignes.map((l) => {
          const rang = l.place - decalage;
          const podium = rang <= 3 ? (rang as 1 | 2 | 3) : null;
          return (
            <li
              key={l.id}
              className={cn("flex items-center gap-2 border-t border-contraste/[0.06] px-3 py-2", podium && LIGNE_PODIUM[podium], l.id === moi && "bg-primary/10")}
            >
              <RangMetal rang={rang} />
              <Carte name={l.name} size={FORMAT_CARTE.petite} detail={`Bola · ${l.points} pts`} />
              <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">
                <Nom n={l.name} />
              </span>
              <span className={cn(col, "text-[14px] text-foreground/70")}>{l.matchs}</span>
              <span className={cn(col, "hidden text-[14px] text-foreground/70 sm:block")}>{l.victoires}</span>
              <span className={cn(col, "text-[14px] text-foreground/70")}>{l.mvp}</span>
              <span className={cn(col, "text-[16px] font-extrabold")}>{l.points}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Pilules<T extends string | number>({ choix, actif, onChange, label }: { choix: { id: T; label: string }[]; actif: T; onChange: (id: T) => void; label: string }) {
  return (
    <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label={label}>
      {choix.map((c) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={actif === c.id}
          onClick={() => onChange(c.id)}
          className={cn("shrink-0 px-4 py-2 text-[13px] font-semibold whitespace-nowrap", actif === c.id ? "bouton-principal" : "bouton-secondaire text-foreground/60")}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function MatchJoue({ m }: { m: MatchCompte }) {
  const format = useFormatCarte();
  const mvps = m.joueurs.filter((j) => j.mvp);
  return (
    <article className="glass flex flex-col gap-4 rounded-[26px] p-[18px]">
      <div className="flex items-baseline justify-between">
        <span className="mono-label text-foreground/40">
          {libelleJour(m.jour)} · {m.heure}
        </span>
        {!m.valide && <span className="mono-label text-foreground/40">Amical</span>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <span className="mono-label text-muted-foreground">Clairs</span>
        <span className="text-[36px] leading-none font-extrabold tracking-tight tabular-nums">
          {m.scoreClairs} <span className="text-foreground/25">–</span> {m.scoreFonces}
        </span>
        <span className="mono-label text-muted-foreground">Foncés</span>
      </div>
      {mvps.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <span className="mono-label text-foreground/40">{mvps.length > 1 ? "MVP ex æquo" : "MVP"}</span>
          <div className="flex flex-wrap justify-center gap-3">
            {mvps.map((j) => (
              <div key={j.id} className="flex flex-col items-center gap-1">
                <Carte name={j.name} size={format.moyenne} detail={`MVP · ${j.buts} but${j.buts > 1 ? "s" : ""}, ${j.passes} passe${j.passes > 1 ? "s" : ""}`} />
                <span className="text-[12.5px] font-semibold"><Nom n={j.name} /></span>
                <span className="mono-label text-foreground/40">
                  {j.buts} B · {j.passes} P
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function MesFeuilles({ parties, onSaisie, apercu }: { parties: Partie[]; onSaisie: () => void; apercu: boolean }) {
  const [ouverte, setOuverte] = useState<Partie | null>(null);
  if (parties.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-[var(--fib-13)] xl:grid-cols-3">
      {parties.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => setOuverte(p)}
          className="bouton-principal bouton--vert flex items-center gap-3 rounded-[22px] px-4 py-3.5 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold">{p.lieu}</span>
            <span className="mono-label bouton-sous">
              {libelleJour(p.jour)} · {p.heure}
            </span>
          </span>
          <span className="shrink-0 text-[14px] font-semibold">
            {p.saisiLe ? `${p.scoreClairs} – ${p.scoreFonces}` : "Feuille de match"}
          </span>
        </button>
      ))}
      {ouverte && (
        <FeuilleBola
          key={ouverte.id}
          partie={ouverte}
          open
          onOpenChange={(o) => !o && setOuverte(null)}
          onSaisie={onSaisie}
          apercu={apercu}
        />
      )}
    </section>
  );
}

export default function LigueViergePage() {
  const session = useSession();
  const actif = !!session?.server;
  const [matchs, setMatchs] = useState<MatchCompte[] | null>(null);
  const [mesParties, setMesParties] = useState<Partie[]>([]);
  const [moi, setMoi] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [tout, setTout] = useState(false);
  const [cle, setCle] = useState<ClassementBola>("buts");
  // Ma carte / Classement, comme Mon équipe / Championnat dans Bola Team.
  const [vue, setVue] = useState<"moi" | "classement">("moi");
  const [forceApercu, setForceApercu] = useState(false);
  const recharger = useCallback(() => setTick((n) => n + 1), []);

  // Sur une préversion, ?apercu=1 montre la démonstration même s'il y a déjà de vrais matchs.
  useEffect(() => {
    if (!DEMO_LIGUE_VIERGE || !new URLSearchParams(window.location.search).has("apercu")) return;
    const t = window.setTimeout(() => setForceApercu(true), 0);
    return () => window.clearTimeout(t);
  }, []);
  const { equipe, charge: equipeLue } = useMonEquipe();

  useEffect(() => {
    if (!actif) return;
    let fini = false;
    const charger = () => {
      lireLigueVierge()
        .then((m) => !fini && setMatchs(compterMatchs(m)))
        .catch(() => !fini && setMatchs((x) => x ?? []));
      listerMesDerniers()
        .then((p) => !fini && setMesParties(p))
        .catch(() => {});
    };
    void monId().then((id) => !fini && setMoi(id));
    charger();
    const sb = supabase();
    let canal: ReturnType<typeof sb.channel> | null = null;
    try {
      canal = sb
        .channel(`ligue-vierge-${tick}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "matchs" }, charger)
        .subscribe();
    } catch {}
    return () => {
      fini = true;
      if (canal) sb.removeChannel(canal);
    };
  }, [actif, tick]);

  // En aperçu, tant que rien n'est saisi : des matchs de démonstration.
  const { allPlayers } = useSeason();
  const noms = useMemo(() => allPlayers.filter((p) => p.matchs > 0).map((p) => p.name), [allPlayers]);
  const apercu = DEMO_LIGUE_VIERGE && (forceApercu || (matchs?.length ?? 0) === 0) && noms.length >= 10;
  const vus = useMemo(
    () => (apercu ? compterMatchs(demoMatchs(noms, aujourdhuiIso())) : matchs),
    [apercu, noms, matchs]
  );
  // Les masqués (Sabri, les arbitres) hors du classement, sauf soi-même.
  const classement = useMemo(() => (vus ? classementAVie(vus, (c) => c.id === moi || !isHidden(c.name)) : []), [vus, moi]);
  // Mes feuilles : j'organise, le coup d'envoi est passé, et la feuille reste ouverte (24 h après la saisie).
  const aTenir = mesParties.filter(
    (p) =>
      p.organisateurId === moi &&
      coupDEnvoiPasse(p.jour, p.heure) &&
      feuilleOuverte(p.saisiLe)
  );
  const demo = apercu ? demoFeuille(noms, aujourdhuiIso(), moi ?? "moi") : null;
  const feuilles = demo && aTenir.length === 0 ? [demo] : aTenir;
  const derniers = vus ? [...vus].reverse().slice(0, 12) : [];
  const [colonne, colonneCollante] = useCollant();

  // Ma place : dans le classement des points (en aperçu, la démonstration me
  // compte par mon nom), et ma division dès qu'il y en a.
  const { player } = useMyPlayer();
  const points = useMemo(() => classementBola(classement, "points"), [classement]);
  const divisionsPoints = useMemo(() => divisionsBola(points, apercu ? 12 : DIVISIONS_BOLA.taille), [points, apercu]);
  const mien = points.find((l) => l.id === moi || (apercu && l.name === player.name)) ?? null;
  const maDivision = mien ? (divisionsPoints.find((d) => d.lignes.includes(mien)) ?? null) : null;
  const maPlace = mien ? mien.place - (maDivision && maDivision.n > 1 ? maDivision.lignes[0].place - 1 : 0) : null;
  const [divisionVue, setDivisionVue] = useState<number | null>(null);
  const division = divisionsPoints.find((d) => d.n === (divisionVue ?? maDivision?.n ?? 1)) ?? null;
  const lignesTableau = division ? division.lignes : points;
  const decalage = division && division.n > 1 ? division.lignes[0].place - 1 : 0;
  const visiblesTableau = tout ? lignesTableau : lignesTableau.slice(0, 20);
  const mesDerniers = derniers.filter((m) => m.joueurs.some((j) => j.id === moi || (apercu && j.name === player.name)));

  const vide = (texte: string) => <div className="rounded-[22px] bg-card px-5 py-8 text-center text-[14px] text-muted-foreground">{texte}</div>;

  return (
    <div className="gabarit-ligue mx-auto flex w-full max-w-[470px] flex-col gap-7 px-5 pt-2 pb-8 sm:pt-6 md:gap-[var(--fib-34)] md:pt-4 lg:pt-[var(--fib-34)]">
      <h1 className="sr-only">Bola</h1>
      {/* Le même haut que Bola Team (Sabri, 26/10 : « le même design que
          l'équipe ») : l'en-tête, puis Ma carte / Classement comme Mon
          équipe / Championnat. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <EnteteLigue actif="/ligue-vierge" className="md:flex-1" />
        <div className="glass flex gap-1 rounded-full p-1 md:w-[340px]" role="tablist" aria-label="Vue">
          {(
            [
              ["moi", "Ma carte"],
              ["classement", "Classement"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={vue === id}
              onClick={() => setVue(id)}
              className={cn(
                "flex-1 px-4 py-2 text-[13.5px] font-semibold whitespace-nowrap",
                vue === id ? "bouton-principal bouton--vert" : "bouton-discret text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {vue === "moi" && (
        <section className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] md:items-start md:gap-[var(--fib-34)] min-[1440px]:gap-[var(--fib-55)]">
          <div className="contents md:flex md:min-w-0 md:flex-col md:gap-[var(--fib-21)]">
            {/* Comme l'écusson et le nom de mon équipe : ma carte et mon nom. */}
            <div className="flex items-center gap-4">
              <MiniCarte player={player} size={FORMAT_CARTE.petite * 1.25} cle="lv-moi" />
              <div className="flex min-w-0 flex-col gap-1.5">
                <Link href="/profil" className="flex min-w-0 items-center gap-1 transition-opacity active:opacity-60">
                  <h2 className="truncate text-[28px] leading-none font-bold tracking-tight md:text-[34px]">
                    <Nom n={player.name} />
                  </h2>
                  <ChevronRight className="size-5 shrink-0 text-foreground/35" strokeWidth={2.4} />
                </Link>
                <span className="mono-label text-muted-foreground">
                  {mien ? `${mien.matchs} match${mien.matchs > 1 ? "s" : ""} · ${mien.buts} but${mien.buts > 1 ? "s" : ""} · ${mien.passes} pd` : "Bola · à vie"}
                </span>
                {mien && maPlace && (
                  <button type="button" onClick={() => setVue("classement")} className="mono-label self-start text-left text-foreground">
                    {maDivision ? `${maDivision.nom} · ` : ""}
                    {maPlace === 1 ? "1er" : `${maPlace}e`} · {mien.points} pt{mien.points > 1 ? "s" : ""}
                    {mien.mvp > 0 ? ` · ${mien.mvp} MVP` : ""}
                  </button>
                )}
              </div>
            </div>
            <MesFeuilles parties={feuilles} onSaisie={recharger} apercu={apercu} />
            {vus !== null && mesDerniers.length === 0 && vide("Aucun match Bola pour l'instant.")}
            {mesDerniers.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="px-1 text-[17px] font-bold tracking-tight">Mes derniers matchs</h2>
                {mesDerniers.map((m) => (
                  <MatchJoue key={m.id} m={m} />
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 md:min-w-0">{!equipe && (equipeLue || apercu) && <VitrineBola />}</div>
        </section>
      )}

      {vue === "classement" &&
        (vus === null ? (
          actif ? null : vide("Connecte-toi pour voir le classement Bola.")
        ) : classement.length === 0 ? (
          vide("Aucun match Bola joué pour l'instant.")
        ) : (
          <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] md:items-start md:gap-[var(--fib-34)] min-[1440px]:gap-[var(--fib-55)]">
            <section
              ref={colonne}
              className={cn("flex flex-col gap-4 md:min-w-0 md:gap-[var(--fib-21)]", colonneCollante && "md:sticky md:top-[var(--fib-21)]")}
            >
              {/* Comme « Saison 1 » du championnat : Bola se compte à vie. */}
              <div className="flex items-end justify-between gap-3">
                <h2 className="text-[28px] leading-none font-bold tracking-tight">À vie</h2>
                <span className="mono-label text-muted-foreground">
                  {vus.length} match{vus.length > 1 ? "s" : ""} · {classement.length} joueur{classement.length > 1 ? "s" : ""}
                </span>
              </div>
              {divisionsPoints.length > 0 && (
                <Pilules
                  label="Division"
                  choix={divisionsPoints.map((d) => ({ id: d.n, label: d.nom }))}
                  actif={division?.n ?? 1}
                  onChange={(n) => {
                    setDivisionVue(n);
                    setTout(false);
                  }}
                />
              )}
              <TableauPoints lignes={visiblesTableau} decalage={decalage} moi={apercu ? (mien?.id ?? null) : moi} />
              {!tout && lignesTableau.length > 20 && (
                <button type="button" onClick={() => setTout(true)} className="bouton-secondaire self-center px-5 py-2.5 text-[13px] font-semibold">
                  Tout le classement · {lignesTableau.length}
                </button>
              )}
            </section>
            <section className="flex flex-col gap-4 md:min-w-0">
              <Pilules
                label="Classement"
                choix={CLASSEMENTS.filter((c) => c.id !== "points").map((c) => ({ id: c.id, label: c.label }))}
                actif={cle === "points" ? "buts" : cle}
                onChange={setCle}
              />
              {(() => {
                const c = cle === "points" ? "buts" : cle;
                const unite = CLASSEMENTS.find((x) => x.id === c)?.unite ?? "";
                const l = classementBola(classement, c).slice(0, 10);
                return l.length === 0 ? (
                  vide("Personne pour l'instant.")
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {l.map((x) => (
                      <Ligne key={x.id} c={x} moi={moi} cle={c} unite={unite} />
                    ))}
                  </div>
                );
              })()}
              <h2 className="px-1 pt-2 text-[17px] font-bold tracking-tight">Derniers matchs</h2>
              {derniers.map((m) => (
                <MatchJoue key={m.id} m={m} />
              ))}
            </section>
          </div>
        ))}
    </div>
  );
}
