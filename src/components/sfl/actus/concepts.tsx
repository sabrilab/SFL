"use client";

// Quatre concepts de l'onglet Actus, en-tête compris (Sabri, 22/10 : « fous
// encore plus loin la réflexion […] de vraies variantes, pas de petites
// variantes légères »). Page d'essai : /ligue/fil?c=a..d ; /ligue ne change pas.
//
// Ce que disent les 14 derniers jours du journal d'activité (admins exclus) :
// Ma carte est la page où l'on passe le plus de temps, la convocation est le
// geste le plus fréquent, les trois quarts du temps passé tombent du lundi au
// mercredi, et le vote ou les duels ne retiennent presque personne. Chaque
// concept part d'un de ces endroits où l'attention se pose :
//   A · Toi d'abord     : l'en-tête, c'est ta place (carte, rang, écart,
//                         forme) ; le fil parle de toi avant la ligue ;
//   B · Dimanche        : l'en-tête, c'est le prochain match (compte à
//                         rebours, ta réponse, qui vient) et la frise des
//                         journées ; puis ce qui s'y joue, puis le dernier ;
//   C · La course       : l'en-tête, c'est le classement en direct, en
//                         cartes qu'on fait défiler, par catégorie ; le fil,
//                         ce qui le fait bouger ;
//   D · L'édition       : un journal du lundi : la une, toi, le carnet en
//                         grille, le classement et les matchs en rubriques.
// Les classements complets et les matchs restent à un toucher dans chacun
// (vues.tsx). Les modules nouveaux : lib/sfl/actus-toi.ts, cine-toi.tsx.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { BoutonRecherche } from "@/components/layout/bouton-recherche";
import { SigleLigue } from "@/components/sfl/choix-ligue";
import { CarteJournee } from "@/components/sfl/carte-journee";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { QuiVient } from "@/components/sfl/qui-vient";
import { Nom } from "@/components/sfl/nom";
import { usePresence } from "@/hooks/use-presence";
import { filDeSaison, type Actu } from "@/lib/sfl/actus";
import {
  enjeux,
  joues,
  partenaires,
  prochainCap,
  serie,
  trajectoire,
  voisins,
} from "@/lib/sfl/actus-toi";
import { prochainDimanche } from "@/lib/sfl/convocation-temps";
import { rankByMetric } from "@/lib/sfl/engine";
import { RANKINGS } from "@/lib/sfl/rankings";
import { cn } from "@/lib/utils";
import { ANTON, Ecran } from "./ecran";
import {
  CineCap,
  CineEnjeux,
  CinePartenaires,
  CineRival,
  CineTrajectoire,
} from "./cine-toi";
import { ModeFil, PublicationActu, TonDimanche } from "./fil";
import { VueClassements, VueMatchs } from "./vues";

export const CONCEPTS = [
  { id: "a", nom: "Toi d'abord" },
  { id: "b", nom: "Dimanche" },
  { id: "c", nom: "La course" },
  { id: "d", nom: "L'édition" },
] as const;
export type ConceptId = (typeof CONCEPTS)[number]["id"];

type Vue = "fil" | "classements" | "matchs";

/* --------------------------------- communs --------------------------------- */

function useToi() {
  const { saison, journees } = useSeason();
  const { me } = useMyPlayer();
  return useMemo(() => {
    const fil = filDeSaison(saison, journees, me, true);
    const dernier = joues(saison).at(-1) ?? 0;
    return {
      me,
      fil,
      dernier,
      dernierFil: fil.filter((a) => a.j === dernier),
      voisins: voisins(saison, me),
      trajectoire: trajectoire(saison, me),
      cap: prochainCap(saison, me),
      serie: serie(saison, me),
      partenaires: partenaires(saison, me),
      enjeux: enjeux(saison),
    };
  }, [saison, journees, me]);
}

/** Une scène du fil, sans en-tête de publication : l'image, puis une ligne. */
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

/** SFL · Bola · Team, en sigles : le plein est la ligue où l'on est. */
function Sigles({
  taille = 14,
  className,
}: {
  taille?: number;
  className?: string;
}) {
  const liens = [
    { href: "/ligue", ligue: "sfl" as const, on: true },
    { href: "/ligue-vierge", ligue: "bola" as const, on: false },
    { href: "/bola-team", ligue: "team" as const, on: false },
  ];
  return (
    <nav
      aria-label="Ligue"
      className={cn("flex items-center gap-4", className)}
    >
      {liens.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.on ? "page" : undefined}
          className={cn(
            "py-1.5 transition-colors",
            l.on ? "text-foreground" : "text-foreground/30",
          )}
        >
          <SigleLigue ligue={l.ligue} hauteur={taille} />
        </Link>
      ))}
    </nav>
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

function Forme({
  forme,
  className,
}: {
  forme: ("V" | "N" | "D")[];
  className?: string;
}) {
  return (
    <span className={cn("flex gap-1", className)}>
      {forme.slice(-5).map((r, i) => (
        <span
          key={i}
          className={cn(
            "grid size-[18px] place-items-center rounded-[5px] text-[9px] font-bold",
            r === "V"
              ? "bg-primary text-black"
              : r === "N"
                ? "bg-foreground/20"
                : "bg-foreground/[0.07] text-foreground/40",
          )}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

/** Les modules « toi », dans l'ordre où ils comptent. */
function ModulesToi({
  toi,
  sans = [],
}: {
  toi: ReturnType<typeof useToi>;
  sans?: string[];
}) {
  return (
    <>
      {!sans.includes("rival") && toi.voisins && (
        <Plan
          ratio={4 / 5}
          duree={2.6}
          titre={
            toi.voisins.devant
              ? `Ton rival : ${toi.voisins.devant.name}`
              : "Personne devant toi"
          }
        >
          <CineRival v={toi.voisins} />
        </Plan>
      )}
      {!sans.includes("trajectoire") && toi.trajectoire.length > 1 && (
        <Plan
          ratio={16 / 10}
          duree={3}
          titre="Ta saison, dimanche après dimanche"
        >
          <CineTrajectoire pas={toi.trajectoire} />
        </Plan>
      )}
      {!sans.includes("cap") && toi.cap && (
        <Plan
          ratio={16 / 10}
          duree={2.6}
          titre={`Ton prochain badge : ${toi.cap.def.nom}`}
        >
          <CineCap cap={toi.cap} />
        </Plan>
      )}
      {!sans.includes("partenaires") && toi.partenaires.filter((x) => x.ensemble >= 2).length >= 2 && (
        <Plan ratio={1} duree={2.4} titre="Tes partenaires">
          <CinePartenaires liste={toi.partenaires} />
        </Plan>
      )}
    </>
  );
}

function Pubs({
  items,
  mode = "film",
}: {
  items: Actu[];
  mode?: "film" | "post";
}) {
  return (
    <ModeFil.Provider value={{ mode }}>
      {items.map((a) => (
        <PublicationActu key={a.id} a={a} enCours onClassements={() => {}} />
      ))}
    </ModeFil.Provider>
  );
}

/** La vue complète (classements ou matchs), avec son retour. */
function Complet({
  vue,
  retour,
}: {
  vue: Exclude<Vue, "fil">;
  retour: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={retour}
        className="flex items-center gap-1 px-4 text-[15px] font-semibold text-foreground/70"
      >
        <ChevronLeft className="size-5" /> Actus
      </button>
      {vue === "classements" ? <VueClassements /> : <VueMatchs />}
    </div>
  );
}

function useVue() {
  const [vue, setVue] = useState<Vue>("fil");
  const aller = (v: Vue) => {
    setVue(v);
    document.getElementById("app-scroll")?.scrollTo({ top: 0 });
  };
  return [vue, aller] as const;
}

/** Une scène ouverte en grand, par-dessus tout. */
function Modale({
  contenu,
  fermer,
}: {
  contenu: ReactNode;
  fermer: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [fermer]);
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md"
      onClick={fermer}
    >
      <div
        className="relative w-full max-w-[470px]"
        onClick={(e) => e.stopPropagation()}
      >
        {contenu}
      </div>
      <button
        type="button"
        aria-label="Fermer"
        onClick={fermer}
        className="glass absolute right-4 grid size-11 place-items-center rounded-full"
        style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <X className="size-5" />
      </button>
    </div>,
    document.body,
  );
}

/* ============================== A · Toi d'abord ============================== */

function ConceptToi() {
  const toi = useToi();
  const { player } = useMyPlayer();
  const [vue, aller] = useVue();
  const v = toi.voisins;
  const delta =
    toi.trajectoire.length > 1
      ? toi.trajectoire.at(-2)!.rang - toi.trajectoire.at(-1)!.rang
      : 0;
  if (vue !== "fil") return <Complet vue={vue} retour={() => aller("fil")} />;
  const reste = toi.dernierFil.filter(
    (a) =>
      a.type === "mvp" ||
      a.type === "score" ||
      a.type === "badge" ||
      a.type === "montent",
  );
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 px-5">
        <div className="flex items-center justify-between">
          <Sigles />
          <BoutonRecherche className="size-10" />
        </div>
        {/* Ta place : la première chose qu'un joueur vient chercher. */}
        <div className="flex items-center gap-4">
          {player && (
            <MiniCarte
              player={player}
              size={FORMAT_CARTE.moyenne}
              detail={v ? `${v.moi.rank}e · ${v.moi.pp} pts` : undefined}
            />
          )}
          <button
            type="button"
            onClick={() => aller("classements")}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="mono-label text-foreground/45">
                Pépite d&apos;Or
              </span>
              <span className="flex items-baseline gap-2">
                <span
                  className="text-[56px] leading-[0.8]"
                  style={{ fontFamily: ANTON }}
                >
                  {v?.moi.rank ?? "–"}
                  <span className="text-[24px] text-foreground/40">e</span>
                </span>
                {delta !== 0 && (
                  <span
                    className={cn(
                      "mono-label",
                      delta > 0 ? "text-primary" : "text-foreground/45",
                    )}
                  >
                    {delta > 0 ? `▲ ${delta}` : `▼ ${-delta}`}
                  </span>
                )}
              </span>
              <span className="text-[13px] text-foreground/55 tabular-nums">
                {v?.moi.pp ?? 0} pts
                {v?.devant
                  ? ` · ${v.devant.pp - v.moi.pp} derrière ${v.devant.name}`
                  : ""}
              </span>
              <Forme forme={toi.serie.forme} />
            </span>
            <ChevronRight className="size-5 shrink-0 text-foreground/40" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => aller("classements")}
            className="glass rounded-full py-2.5 text-[14px] font-semibold"
          >
            Classement
          </button>
          <button
            type="button"
            onClick={() => aller("matchs")}
            className="glass rounded-full py-2.5 text-[14px] font-semibold"
          >
            Match
          </button>
        </div>
      </header>
      <div className="flex flex-col">
        {toi.dernier > 0 && (
          <ModeFil.Provider value={{ mode: "film" }}>
            <TonDimanche j={toi.dernier} date={toi.dernierFil[0]?.date ?? ""} />
          </ModeFil.Provider>
        )}
        <ModulesToi toi={toi} />
      </div>
      <Rubrique titre={`La ligue · J${toi.dernier}`}>
        <div className="flex flex-col">
          <Pubs items={reste} />
        </div>
      </Rubrique>
    </div>
  );
}

/* ================================ B · Dimanche ================================ */

function joursAvant(d: Date) {
  const n = Math.round(
    (new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) /
      86400000,
  );
  return n <= 0 ? "aujourd'hui" : n === 1 ? "demain" : `dans ${n} jours`;
}

function ConceptDimanche() {
  const toi = useToi();
  const router = useRouter();
  const { saison } = useSeason();
  const p = usePresence();
  const [vue, aller] = useVue();
  const frise = useRef<HTMLDivElement>(null);
  const [quand] = useState(() =>
    joursAvant(prochainDimanche(new Date(Date.now() - 86400000))),
  );
  const jouees = joues(saison);
  useEffect(() => {
    frise.current?.scrollTo({ left: frise.current.scrollWidth });
  }, []);
  if (vue !== "fil") return <Complet vue={vue} retour={() => aller("fil")} />;
  const repondre = (r: "present" | "absent") =>
    p.answer(p.mine === r ? null : r);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-5">
          <Sigles />
          <BoutonRecherche className="size-10" />
        </div>
        {/* Le prochain dimanche : le compte à rebours et ta réponse, d'un geste. */}
        <div className="mx-4 overflow-hidden rounded-[28px] bg-black text-white">
          <Ecran
            duree={1.4}
            ratio={2}
            fond="radial-gradient(90% 90% at 80% 0%, rgba(255,255,255,0.14), transparent 60%), #000"
          >
            <div className="absolute inset-0 flex flex-col justify-between p-5">
              <span className="a-fondu mono-label text-white/50">
                {p.heure} · {p.lieu}
              </span>
              <span className="flex items-end gap-4">
                <span
                  className="a-claque origin-left text-[88px] leading-[0.78]"
                  style={{ fontFamily: ANTON }}
                >
                  J{p.journee}
                </span>
                <span
                  className="a-fondu flex flex-col pb-1"
                  style={{ ["--t" as string]: "0.3s" }}
                >
                  <span className="text-[17px] font-bold">{p.jour}</span>
                  <span className="text-[13px] text-white/55">
                    {quand} · {p.presents.length}{" "}
                    {p.presents.length > 1 ? "viennent" : "vient"}
                  </span>
                </span>
              </span>
            </div>
          </Ecran>
          <div className="grid grid-cols-2 gap-2 p-3 pt-0">
            {(["present", "absent"] as const).map((r) => (
              <button
                key={r}
                type="button"
                disabled={!p.reponsesOuvertes}
                onClick={() => repondre(r)}
                className={cn(
                  "rounded-full py-3 text-[14px] font-bold transition-colors disabled:opacity-40",
                  p.mine === r
                    ? r === "present"
                      ? "bg-primary text-black"
                      : "bg-white text-black"
                    : "bg-white/10",
                )}
              >
                {r === "present" ? "Je viens" : "Je passe"}
              </button>
            ))}
          </div>
        </div>
        {/* La frise des journées : chaque dimanche joué s'ouvre. */}
        <div
          ref={frise}
          className="flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]"
        >
          {jouees.map((j) => (
            <button
              key={j}
              type="button"
              onClick={() => router.push(`/ligue/journee?j=${j}`)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold",
                j === toi.dernier ? "bg-foreground text-background" : "glass",
              )}
            >
              J{j}
            </button>
          ))}
          <span className="shrink-0 rounded-full border border-dashed border-foreground/30 px-3.5 py-2 text-[13px] font-semibold text-foreground/50">
            J{p.journee}
          </span>
          <button
            type="button"
            onClick={() => aller("classements")}
            className="glass shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold"
          >
            Classement
          </button>
        </div>
      </header>
      {p.presents.length > 0 && (
        <Rubrique
          titre="Ils viennent"
          plus={
            <span className="mono-label text-foreground/40">
              {p.presents.length}
            </span>
          }
        >
          <QuiVient
            noms={p.presents}
            size={FORMAT_CARTE.petite * 1.3}
            className="px-5"
          />
        </Rubrique>
      )}
      {toi.enjeux.length > 0 && (
        <Plan
          ratio={4 / 5}
          duree={2.4}
          titre="Les places qui se jouent à un ou deux points"
        >
          <CineEnjeux liste={toi.enjeux} moi={toi.me} />
        </Plan>
      )}
      <div className="flex flex-col">
        <ModulesToi toi={toi} sans={["trajectoire", "partenaires"]} />
      </div>
      <Rubrique
        titre={`Dimanche dernier · J${toi.dernier}`}
        plus={
          <button
            type="button"
            onClick={() => aller("matchs")}
            className="mono-label text-foreground/50"
          >
            Tous les matchs ›
          </button>
        }
      >
        <div className="flex flex-col">
          <Pubs
            items={toi.dernierFil.filter(
              (a) =>
                a.type === "recap" || a.type === "score" || a.type === "mvp",
            )}
          />
        </div>
      </Rubrique>
    </div>
  );
}

/* ================================ C · La course ================================ */

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

function ConceptCourse() {
  const toi = useToi();
  const [vue, aller] = useVue();
  if (vue !== "fil") return <Complet vue={vue} retour={() => aller("fil")} />;
  // Le fil de la course : ce qui fait bouger le classement, du plus fort au plus fin.
  const bouge = toi.fil
    .filter((a) =>
      ["montent", "mvp", "chiffre", "duo", "badge", "badges"].includes(a.type),
    )
    .slice(0, 8);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-5">
          <Sigles taille={16} />
          <BoutonRecherche className="size-10" />
        </div>
        <Ticker moi={toi.me} onTout={() => aller("classements")} />
        <div className="px-5">
          <button
            type="button"
            onClick={() => aller("matchs")}
            className="glass w-full rounded-full py-2.5 text-[14px] font-semibold"
          >
            Match
          </button>
        </div>
      </header>
      <div className="flex flex-col">
        {toi.enjeux.length > 0 && (
          <Plan ratio={4 / 5} duree={2.4} titre="Dimanche, ça peut basculer">
            <CineEnjeux liste={toi.enjeux} moi={toi.me} />
          </Plan>
        )}
        {toi.voisins && (
          <Plan
            ratio={4 / 5}
            duree={2.6}
            titre={
              toi.voisins.devant
                ? `Ton rival : ${toi.voisins.devant.name}`
                : "Personne devant toi"
            }
          >
            <CineRival v={toi.voisins} />
          </Plan>
        )}
        <Pubs items={bouge} />
      </div>
    </div>
  );
}

/* ================================ D · L'édition ================================ */

function ConceptEdition() {
  const toi = useToi();
  const { players, journees } = useSeason();
  const router = useRouter();
  const [vue, aller] = useVue();
  const [ouvert, setOuvert] = useState<ReactNode>(null);
  if (vue !== "fil") return <Complet vue={vue} retour={() => aller("fil")} />;
  const une = toi.dernierFil.find((a) => a.type === "mvp") ?? toi.dernierFil[0];
  const carnet = toi.dernierFil.filter((a) => a !== une && a.type !== "recap");
  const date = une?.date ?? "";
  const titreUne =
    une?.type === "mvp"
      ? `${une.mvp.nom}, l'homme du dimanche`
      : une?.type === "score"
        ? (([g, p]) =>
            g.score === p.score
              ? `${g.name} et ${p.name}, dos à dos`
              : `${g.name} l'emporte ${g.score} à ${p.score}`)(
            une.match.teamA.score >= une.match.teamB.score
              ? [une.match.teamA, une.match.teamB]
              : [une.match.teamB, une.match.teamA],
          )
        : `J${toi.dernier}`;
  const top = rankByMetric(players, (p) => p.pp).slice(0, 5);
  const jouees = journees
    .filter((j) => j.matches?.length && j.j <= toi.dernier)
    .slice(-2)
    .reverse();
  const v = toi.voisins;
  const aller2 = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-3 px-5">
        <div className="flex items-center justify-between">
          <Sigles taille={13} />
          <BoutonRecherche className="size-10" />
        </div>
        <div className="border-y border-foreground/15 py-3">
          <p className="mono-label text-foreground/45">
            Édition J{toi.dernier} · {date}
          </p>
          <p
            className="mt-1 text-[44px] leading-[0.9] tracking-tight"
            style={{ fontFamily: ANTON }}
          >
            Le Dimanche
          </p>
        </div>
        <nav
          aria-label="Sommaire"
          className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]"
        >
          {[
            ["une", "À la une"],
            ["toi", "Toi"],
            ["carnet", "Le carnet"],
            ["classement", "Classement"],
            ["matchs", "Match"],
          ].map(([id, l]) => (
            <button
              key={id}
              type="button"
              onClick={() => aller2(`ed-${id}`)}
              className="glass shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold"
            >
              {l}
            </button>
          ))}
        </nav>
      </header>
      {une && (
        <section id="ed-une" className="flex scroll-mt-4 flex-col gap-3">
          <h2
            className="px-5 text-[30px] leading-[0.95] tracking-tight"
            style={{ fontFamily: ANTON }}
          >
            {titreUne}
          </h2>
          <div className="flex flex-col">
            <Pubs items={[une]} />
          </div>
        </section>
      )}
      <Rubrique id="ed-toi" titre="Toi">
        <div className="grid grid-cols-3 gap-2 px-5">
          {[
            { k: "Rang", v: v ? `${v.moi.rank}e` : "–" },
            {
              k: v?.devant ? `Écart ${v.devant.name}` : "Écart",
              v: v?.devant ? `${v.devant.pp - v.moi.pp}` : "0",
            },
            {
              k: toi.cap ? `Avant ${toi.cap.def.nom}` : "Badge",
              v: toi.cap ? `${(toi.cap.cible ?? 0) - toi.cap.valeur}` : "–",
            },
          ].map((c) => (
            <div
              key={c.k}
              className="glass flex flex-col gap-1 rounded-2xl p-3"
            >
              <span
                className="text-[30px] leading-none"
                style={{ fontFamily: ANTON }}
              >
                {c.v}
              </span>
              <span className="mono-label truncate text-[9.5px] text-foreground/45">
                {c.k}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col">
          {toi.trajectoire.length > 1 && (
            <Plan
              ratio={16 / 10}
              duree={3}
              titre="Ta saison, dimanche après dimanche"
            >
              <CineTrajectoire pas={toi.trajectoire} />
            </Plan>
          )}
        </div>
      </Rubrique>
      <Rubrique id="ed-carnet" titre="Le carnet">
        <div className="columns-2 gap-3 px-4 [&>*]:mb-4">
          <ModeFil.Provider value={{ mode: "case", ouvrir: setOuvert }}>
            {carnet.map((a) => (
              <PublicationActu
                key={a.id}
                a={a}
                enCours
                onClassements={() => aller("classements")}
              />
            ))}
          </ModeFil.Provider>
        </div>
      </Rubrique>
      <Rubrique
        id="ed-classement"
        titre="Classement"
        plus={
          <button
            type="button"
            onClick={() => aller("classements")}
            className="mono-label text-foreground/50"
          >
            Tout ›
          </button>
        }
      >
        <ol className="flex flex-col gap-2 px-5">
          {top.map((p) => (
            <li
              key={p.name}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-2 py-1.5",
                p.name === toi.me && "bg-foreground/10",
              )}
            >
              <span
                className="w-6 text-right text-[20px] leading-none"
                style={{ fontFamily: ANTON }}
              >
                {p.rank}
              </span>
              <MiniCarte
                player={p}
                size={FORMAT_CARTE.petite}
                detail={`${p.rank}e · ${p.value} pts`}
              />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                <Nom n={p.name} />
              </span>
              <span className="text-[15px] font-bold tabular-nums">
                {p.value}
              </span>
            </li>
          ))}
        </ol>
      </Rubrique>
      <Rubrique
        id="ed-matchs"
        titre="Match"
        plus={
          <button
            type="button"
            onClick={() => aller("matchs")}
            className="mono-label text-foreground/50"
          >
            Tous ›
          </button>
        }
      >
        <div className="flex flex-col gap-3 px-5">
          {jouees.map((jn) => (
            <CarteJournee
              key={jn.j}
              journee={jn}
              onOuvrir={() => router.push(`/ligue/journee?j=${jn.j}`)}
            />
          ))}
        </div>
      </Rubrique>
      {ouvert && <Modale contenu={ouvert} fermer={() => setOuvert(null)} />}
    </div>
  );
}

export function Concept({ id }: { id: ConceptId }) {
  return (
    <div className="mx-auto flex w-full max-w-[470px] flex-col pt-2 pb-8 sm:pt-6">
      <h1 className="sr-only">Actus</h1>
      {id === "a" ? (
        <ConceptToi />
      ) : id === "b" ? (
        <ConceptDimanche />
      ) : id === "c" ? (
        <ConceptCourse />
      ) : (
        <ConceptEdition />
      )}
    </div>
  );
}
