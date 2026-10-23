"use client";

// L'onglet Actus : la course (Sabri, 22/10, parmi quatre concepts : « C'est
// très bien, la course », et il garde les terrains et les cartes d'avant les
// Actus). Pourquoi la course : le journal d'activité montre que les joueurs
// viennent surtout se situer (Ma carte est la page où ils restent le plus).
//   · l'en-tête : SFL · Bola · Bola Team en sigles et la loupe (EnteteLigue), puis le
//     classement en cartes qu'on fait défiler, centré sur toi, par catégorie
//     (Pépite d'Or, Buteurs, Passeurs, MVP) ; « Tout » ouvre les classements
//     complets, « Match » les journées (vues.tsx) ;
//     Sous chaque carte, ▲ ou ▼ depuis la semaine passée, et à l'ouverture
//     les cartes glissent de leur ancienne place à la nouvelle ;
//   · le fil : le jour du match, la feuille en direct ; ton dimanche (ta
//     carte, tes chiffres, tes places) ; la convocation (qui vient, Je viens /
//     Je passe) ; ce qui se joue dimanche (les places à un ou deux points),
//     ton rival et ce qu'il te faut pour le passer ; puis chaque dimanche joué,
//     du plus récent : son terrain avec les cartes des joueurs (CarteJournee),
//     et ses rubriques. Chaque rubrique est un terrain avec ses petites cartes
//     près du but, qui s'anime au défilement, sans carrousel (pelouse.tsx ;
//     Sabri, 22/10 : « que tout se fasse en scroll et qu'il y ait plus de vie »).
// Les modules « toi » : lib/sfl/actus-toi.ts et cine-toi.tsx.
// ?exploit=… (la notification d'une félicitation) descend jusqu'à sa rubrique.

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { EnteteLigue } from "@/components/sfl/choix-ligue";
import { CarteJournee } from "@/components/sfl/carte-journee";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { QuiVient } from "@/components/sfl/qui-vient";
import { usePresence } from "@/hooks/use-presence";
import { voteOuvert } from "@/lib/sfl/convocation-temps";
import { computeStandings } from "@/lib/sfl/saisie/engine";
import { journeeJouee } from "@/lib/sfl/saisie/mutations";
import { Nom } from "@/components/sfl/nom";
import { filDeSaison, type Actu } from "@/lib/sfl/actus";
import { enjeux, voisins } from "@/lib/sfl/actus-toi";
import { rankByMetric } from "@/lib/sfl/engine";
import { RANKINGS } from "@/lib/sfl/rankings";
import { cn } from "@/lib/utils";
import { ANTON } from "./ecran";
import { VoteDuJour } from "./fil";
import { RubriqueActu, RubriqueBesoin, RubriqueEnjeux, RubriqueRival, RubriqueToi } from "./pelouse";
import { VueClassements, VueMatchs } from "./vues";

export type Vue = "fil" | "classements" | "matchs";

/** Les scènes d'un dimanche qui font bouger la course. */
const SCENES: Actu["type"][] = ["mvp", "chiffre", "duo", "montent", "badge", "badges", "equipe"];

function Rubrique({
  id,
  titre,
  children,
  plus,
}: {
  id?: string;
  titre: string;
  children: ReactNode;
  plus?: ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-3">
      <div className="flex items-end justify-between px-5">
        <h2
          className="text-[22px] leading-none tracking-tight"
          style={{ fontFamily: ANTON }}
        >
          {titre}
        </h2>
        {plus}
      </div>
      {children}
    </section>
  );
}

const METRIQUES = ["pp", "buts", "passes", "mvp"] as const;

/** L'écart d'une carte à l'autre dans la rangée, pour les faire glisser de leur ancienne place. */
const PAS = 87;

function Ticker({ moi, onTout }: { moi: string; onTout: () => void }) {
  const { players, saison } = useSeason();
  const [id, setId] = useState<(typeof METRIQUES)[number]>("pp");
  const def = RANKINGS.find((r) => r.id === id)!;
  const rang = rankByMetric(players, def.value).filter(
    (p) => def.showAll || p.value > 0,
  );
  // Le classement d'avant le dernier dimanche joué : d'où chacun vient.
  const avant = useMemo(() => {
    const d = Math.max(0, ...saison.journees.map((m) => m.j).filter((j) => journeeJouee(saison, j)));
    return d ? computeStandings({ ...saison, entries: saison.entries.filter((e) => e.j !== d) }) : null;
  }, [saison]);
  const noms = new Set(rang.map((p) => p.name));
  const ancien = avant ? new Map(rankByMetric(avant.filter((p) => noms.has(p.name)), def.value).map((p, i) => [p.name, { rank: p.rank, i }])) : null;
  // Les cartes partent de leur place de la semaine passée, puis glissent à la nouvelle.
  const [pose, setPose] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = ref.current?.querySelector<HTMLElement>("[data-moi]");
    if (el && ref.current)
      ref.current.scrollTo({
        left: el.offsetLeft - ref.current.clientWidth / 2 + el.clientWidth / 2,
        behavior: "smooth",
      });
    const a = setTimeout(() => setPose(false), 0);
    const b = setTimeout(() => setPose(true), calme ? 0 : 500);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [id]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 px-5">
        {METRIQUES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={id === m}
            onClick={() => setId(m)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap",
              id === m ? "bg-foreground text-background" : "text-foreground/50",
            )}
          >
            {RANKINGS.find((r) => r.id === m)!.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onTout}
          className="mono-label ml-auto text-foreground/50"
        >
          Tout ›
        </button>
      </div>
      <div
        ref={ref}
        className="flex items-end gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]"
      >
        {rang.map((p, i) => {
          const a = ancien?.get(p.name);
          const delta = a ? a.rank - p.rank : 0;
          return (
          <div
            key={`${id}-${p.name}`}
            data-moi={p.name === moi ? "" : undefined}
            className={cn(
              "flex shrink-0 flex-col items-center gap-1 rounded-2xl p-1.5",
              p.name === moi && "bg-foreground/10",
              pose && "transition-transform duration-[1200ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
              p.name === moi && "relative z-10",
            )}
            style={{ transform: pose || !a ? undefined : `translateX(${(a.i - i) * PAS}px)` }}
          >
            <span
              className="text-[20px] leading-none"
              style={{ fontFamily: ANTON }}
            >
              {p.rank}
            </span>
            <MiniCarte
              player={p}
              size={
                p.rank === 1 ? FORMAT_CARTE.moyenne : FORMAT_CARTE.petite * 1.3
              }
              detail={`${p.rank}e · ${p.value} ${def.unit}`}
            />
            <span className="max-w-[80px] truncate text-[11px] font-semibold">
              <Nom n={p.name} />
            </span>
            <span className="mono-label text-[10px] text-foreground/50 tabular-nums">
              {p.value} {def.unit}
            </span>
            <span
              className={cn(
                "mono-label h-3 text-[10px] tabular-nums transition-opacity delay-700 duration-500",
                delta > 0 ? "text-primary" : "text-foreground/40",
                pose ? "opacity-100" : "opacity-0",
              )}
            >
              {delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${-delta}` : ""}
            </span>
          </div>
          );
        })}
      </div>
    </div>
  );
}

/** La convocation du prochain dimanche, dans le fil : qui vient, et ta réponse d'un geste. */
function Convocation() {
  const p = usePresence();
  const repondre = (r: "present" | "absent") => p.answer(p.mine === r ? null : r);
  return (
    <section className="mx-4 flex flex-col gap-4 overflow-hidden rounded-[28px] bg-black p-5 text-white">
      <div className="flex items-end gap-4">
        <span className="text-[64px] leading-[0.8]" style={{ fontFamily: ANTON }}>
          J{p.journee}
        </span>
        <span className="flex min-w-0 flex-col pb-0.5">
          <span className="text-[16px] font-bold">{p.jour}</span>
          <span className="truncate text-[12.5px] text-white/55">
            {p.heure} · {p.lieu}
          </span>
        </span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="mono-label text-white/50">
          {p.presents.length} {p.presents.length > 1 ? "viennent" : "vient"}
        </span>
      </div>
      {p.presents.length > 0 && <QuiVient noms={p.presents} size={FORMAT_CARTE.petite * 1.2} />}
      <div className="grid grid-cols-2 gap-2">
        {(["present", "absent"] as const).map((r) => (
          <button
            key={r}
            type="button"
            disabled={!p.reponsesOuvertes}
            onClick={() => repondre(r)}
            className={cn(
              "rounded-full py-3 text-[14px] font-bold transition-colors disabled:opacity-40",
              p.mine === r ? (r === "present" ? "bg-primary text-black" : "bg-white text-black") : "bg-white/10",
            )}
          >
            {r === "present" ? "Je viens" : "Je passe"}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Le dimanche en direct : le jour du match, la feuille se remplit sous tes yeux (la base pousse chaque saisie). */
function EnDirect({ ouvrir }: { ouvrir: (j: number) => void }) {
  const { journees } = useSeason();
  const [maintenant] = useState(() => new Date());
  const live = journees.find((j) => (j.matches?.length ?? 0) > 0 && voteOuvert(j.date, maintenant));
  if (!live) return null;
  return (
    <section className="flex flex-col gap-3 px-5">
      <span className="flex items-center gap-2">
        <span className="relative flex size-2.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-70 motion-reduce:animate-none" />
          <span className="relative size-2.5 rounded-full bg-red-500" />
        </span>
        <span className="mono-label text-foreground/70">En direct · J{live.j}</span>
      </span>
      <CarteJournee journee={live} onOuvrir={() => ouvrir(live.j)} />
    </section>
  );
}

export function LaCourse({ vueDepart = "fil", exploit }: { vueDepart?: Vue; exploit?: string | null }) {
  const { saison, journees } = useSeason();
  const { me } = useMyPlayer();
  const router = useRouter();
  const [vue, setVue] = useState<Vue>(vueDepart);
  // La rubrique d'un exploit, une fois les terrains mesurés.
  useEffect(() => {
    if (!exploit) return;
    const t = setTimeout(() => {
      const el = [...document.querySelectorAll<HTMLElement>("[data-exploits]")].find((x) => x.dataset.exploits?.split("|").includes(exploit));
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 450);
    return () => clearTimeout(t);
  }, [exploit]);
  const aller = (v: Vue) => {
    setVue(v);
    document.getElementById("app-scroll")?.scrollTo({ top: 0 });
  };
  const { fil, v, duels } = useMemo(
    () => ({ fil: filDeSaison(saison, journees, me, true), v: voisins(saison, me), duels: enjeux(saison) }),
    [saison, journees, me]
  );
  // Les dimanches joués, du plus récent : le terrain, puis les scènes.
  const dimanches = useMemo(() => {
    const js = [...new Set(fil.map((a) => a.j))];
    return js.map((j) => ({ j, journee: journees.find((x) => x.j === j), scenes: fil.filter((a) => a.j === j && SCENES.includes(a.type)) }));
  }, [fil, journees]);

  const dernier = dimanches[0]?.j ?? 0;

  if (vue !== "fil")
    return (
      <div className="flex flex-col gap-5">
        <button type="button" onClick={() => aller("fil")} className="flex items-center gap-1 px-4 text-[15px] font-semibold text-foreground/70">
          <ChevronLeft className="size-5" /> Actus
        </button>
        {vue === "classements" ? <VueClassements vote={<VoteDuJour me={me} />} /> : <VueMatchs />}
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <h1 className="sr-only">Actus</h1>
        <EnteteLigue actif="/ligue" className="px-5" />
        <Ticker moi={me} onTout={() => aller("classements")} />
        <div className="px-5">
          <button type="button" onClick={() => aller("matchs")} className="glass w-full rounded-full py-2.5 text-[14px] font-semibold">
            Match
          </button>
        </div>
      </header>
      <EnDirect ouvrir={(j) => router.push(`/ligue/journee?j=${j}`)} />
      <VoteDuJour me={me} />
      {dernier > 0 && <RubriqueToi j={dernier} date={journees.find((x) => x.j === dernier)?.date ?? ""} />}
      <Convocation />
      <div className="flex flex-col gap-1">
        {duels.length > 0 && <RubriqueEnjeux liste={duels} moi={me} />}
        {v && <RubriqueRival v={v} />}
        {v?.devant && <RubriqueBesoin v={v} />}
      </div>
      {dimanches.map((d) => (
        <Rubrique key={d.j} titre={`J${d.j}`} plus={<span className="mono-label text-foreground/45">{d.journee?.date}</span>}>
          {d.journee && (
            <div className="px-5">
              <CarteJournee journee={d.journee} onOuvrir={() => router.push(`/ligue/journee?j=${d.j}`)} />
            </div>
          )}
          <div className="flex flex-col gap-1">
            {d.scenes.map((a) => (
              <RubriqueActu key={a.id} a={a} />
            ))}
          </div>
        </Rubrique>
      ))}
    </div>
  );
}
