"use client";

// L'onglet Actus : la course (Sabri, 22/10, parmi quatre concepts : « C'est
// très bien, la course », et il garde les terrains et les cartes d'avant les
// Actus). Pourquoi la course : le journal d'activité montre que les joueurs
// viennent surtout se situer (Ma carte est la page où ils restent le plus).
//   · l'en-tête : SFL · Bola · Bola Team en sigles et la loupe (EnteteLigue), puis le
//     classement en cartes qu'on fait défiler, centré sur toi, par catégorie
//     (Pépite d'Or, Buteurs, Passeurs, MVP) ; « Tout » ouvre les classements
//     complets, « Match » les journées (vues.tsx) ;
//   · le fil : ce qui se joue dimanche (les places à un ou deux points), ton
//     rival, puis chaque dimanche joué, du plus récent : son terrain avec les
//     cartes des joueurs (CarteJournee), et ses scènes en motion design.
// Les modules « toi » : lib/sfl/actus-toi.ts et cine-toi.tsx.

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { EnteteLigue } from "@/components/sfl/choix-ligue";
import { CarteJournee } from "@/components/sfl/carte-journee";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { filDeSaison, type Actu } from "@/lib/sfl/actus";
import { enjeux, voisins } from "@/lib/sfl/actus-toi";
import { rankByMetric } from "@/lib/sfl/engine";
import { RANKINGS } from "@/lib/sfl/rankings";
import { cn } from "@/lib/utils";
import { ANTON, Ecran } from "./ecran";
import { CineEnjeux, CineRival } from "./cine-toi";
import { ModeFil, PublicationActu, VoteDuJour } from "./fil";
import { VueClassements, VueMatchs } from "./vues";

export type Vue = "fil" | "classements" | "matchs";

/** Les scènes d'un dimanche qui font bouger la course. */
const SCENES: Actu["type"][] = ["mvp", "chiffre", "duo", "montent", "badge", "badges", "equipe"];

function Plan({
  ratio = 4 / 5,
  duree,
  titre,
  children,
  className,
}: {
  ratio?: number;
  duree: number;
  titre?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("flex flex-col", className)}>
      <Ecran duree={duree} ratio={ratio}>
        {children}
      </Ecran>
      {titre && (
        <figcaption className="bg-black px-4 py-2.5 text-[13.5px] font-semibold">
          {titre}
        </figcaption>
      )}
    </figure>
  );
}

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

function Ticker({ moi, onTout }: { moi: string; onTout: () => void }) {
  const { players } = useSeason();
  const [id, setId] = useState<(typeof METRIQUES)[number]>("pp");
  const def = RANKINGS.find((r) => r.id === id)!;
  const rang = rankByMetric(players, def.value).filter(
    (p) => def.showAll || p.value > 0,
  );
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>("[data-moi]");
    if (el && ref.current)
      ref.current.scrollTo({
        left: el.offsetLeft - ref.current.clientWidth / 2 + el.clientWidth / 2,
        behavior: "smooth",
      });
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
        {rang.map((p) => (
          <div
            key={p.name}
            data-moi={p.name === moi ? "" : undefined}
            className={cn(
              "flex shrink-0 flex-col items-center gap-1 rounded-2xl p-1.5",
              p.name === moi && "bg-foreground/10",
            )}
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
          </div>
        ))}
      </div>
    </div>
  );
}

export function LaCourse({ vueDepart = "fil" }: { vueDepart?: Vue }) {
  const { saison, journees } = useSeason();
  const { me } = useMyPlayer();
  const router = useRouter();
  const [vue, setVue] = useState<Vue>(vueDepart);
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
      <VoteDuJour me={me} />
      <div className="flex flex-col">
        {duels.length > 0 && (
          <Plan ratio={4 / 5} duree={2.4} titre="Dimanche, ça peut basculer">
            <CineEnjeux liste={duels} moi={me} />
          </Plan>
        )}
        {v && (
          <Plan ratio={4 / 5} duree={2.6} titre={v.devant ? `Ton rival : ${v.devant.name}` : "Personne devant toi"}>
            <CineRival v={v} />
          </Plan>
        )}
      </div>
      {dimanches.map((d) => (
        <Rubrique key={d.j} titre={`J${d.j}`} plus={<span className="mono-label text-foreground/45">{d.journee?.date}</span>}>
          {d.journee && (
            <div className="px-5">
              <CarteJournee journee={d.journee} onOuvrir={() => router.push(`/ligue/journee?j=${d.j}`)} />
            </div>
          )}
          <div className="flex flex-col">
            <ModeFil.Provider value={{ mode: "film" }}>
              {d.scenes.map((a) => (
                <PublicationActu key={a.id} a={a} enCours onClassements={() => aller("classements")} />
              ))}
            </ModeFil.Provider>
          </div>
        </Rubrique>
      ))}
    </div>
  );
}
