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
//   · le fil : le jour du match, la feuille en direct ; les divisions
//     (divisions.tsx : leur annonce jusqu'à la J4, puis le bilan de chaque
//     dimanche) ; ton dimanche (ta carte, tes chiffres, tes places) ; la
//     convocation (qui vient, Je viens / Je passe ; « Dernier dimanche sans
//     divisions » sur celle de la J3, ta division dès la J4) ; tes missions,
//     dès que la feuille est faite (missions.tsx), puis les contrats en jeu
//     de toute la ligue (contrats-en-jeu.tsx) ; ce qui se joue dimanche (les
//     places à un ou deux points), ton rival et ce qu'il te faut pour le
//     passer ; puis chaque dimanche joué,
//     du plus récent : son terrain avec les cartes des joueurs (CarteJournee),
//     et ses rubriques. Chaque rubrique est un terrain avec ses petites cartes
//     près du but, qui s'anime au défilement, sans carrousel (pelouse.tsx ;
//     Sabri, 22/10 : « que tout se fasse en scroll et qu'il y ait plus de vie »).
// Les modules « toi » : lib/sfl/actus-toi.ts et cine-toi.tsx.
// ?exploit=… (la notification d'une félicitation) descend jusqu'à sa rubrique,
// #j2 (un dimanche touché dans Ma saison) jusqu'à ce dimanche.
//
// Le présent et le passé (Sabri, 24/10 : le Wall of Fame « dans la section
// Actu », avec de quoi voir « le passé ou le présent ») : sous les sigles, la
// rangée des époques (epoques.tsx) choisit la saison en cours, une saison
// close ou le Wall of Fame. Une saison close se lit avec les mêmes gestes :
// la rangée de cartes, figée sur son classement final, son palmarès, puis
// chacun de ses dimanches. Le Wall of Fame met la rangée sur toute la
// carrière, puis les saisons et ton parcours (wall-of-fame.tsx). Chaque
// époque a son adresse (page-actus.tsx).
//
// Sur tablette et ordinateur (dès 768 px ; Sabri, 23/10 : « rends-le
// responsive pour le desktop […] et réadapte toutes les dispositions »), le
// fil devient une grille, deux colonnes puis trois dès 1280 px (.actus-gabarit,
// actus.css). À gauche, ce qui se joue : le direct, le vote, la convocation et
// tes missions ; à droite, tes rubriques côte à côte ; dessous, les contrats
// en jeu de toute la ligue, sur toute la largeur. Puis chaque dimanche : son
// terrain à gauche, qui reste à l'écran pendant qu'on parcourt ses rubriques
// à droite. La course garde sa rangée, avec deux flèches pour la souris (les
// contrats en jeu aussi). Tout est en classes md: / xl: : sous 768 px, le
// téléphone garde son fil tel quel (sur téléphone, l'ordre des blocs de la
// semaine vient des classes order-*).

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { SaisonArchiveProvider, useSeason } from "@/components/sfl/season-provider";
import { EnteteLigue } from "@/components/sfl/choix-ligue";
import { CarteJournee } from "@/components/sfl/carte-journee";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { QuiVient } from "@/components/sfl/qui-vient";
import { useCollant } from "@/hooks/use-collant";
import { usePresence } from "@/hooks/use-presence";
import { voteOuvert } from "@/lib/sfl/convocation-temps";
import { annonceEnCours, J_DECOUPAGE, nomDivision } from "@/lib/sfl/divisions";
import { divisionsDeLaJournee } from "@/lib/sfl/equipes-division";
import { isHidden } from "@/lib/sfl/hidden";
import { computeStandings } from "@/lib/sfl/saisie/engine";
import { journeeJouee, saisonDepuisArchive } from "@/lib/sfl/saisie/mutations";
import { Nom } from "@/components/sfl/nom";
import { filDeSaison, type Actu } from "@/lib/sfl/actus";
import type { Journee, Player } from "@/lib/sfl/engine";
import { enjeux, voisins } from "@/lib/sfl/actus-toi";
import { rankByMetric } from "@/lib/sfl/engine";
import { RANKINGS } from "@/lib/sfl/rankings";
import { ligneDuRendezVous } from "@/lib/sfl/matchs-du-jour";
import { legendes, saisonsPalmares, type SaisonPalmares } from "@/lib/sfl/palmares";
import { cn } from "@/lib/utils";
import { ANTON } from "./ecran";
import { RubriqueDivisions } from "./divisions";
import { RubriqueOutsider } from "./outsider";
import { VoteDuJour } from "./fil";
import { RubriqueActu, RubriqueBesoin, RubriqueEnjeux, RubriqueRival, RubriqueToi } from "./pelouse";
import { ContratsEnJeu } from "./contrats-en-jeu";
import { MissionsBola } from "./missions";
import { VueClassements, VueMatchs } from "./vues";
import { ChoixEpoque, useEpoques, type ChoixDEpoque, type Epoque } from "./epoques";
import { CarteSaison, categoriesLegendes, Compteurs, LeMur, unite, type Categorie } from "./wall-of-fame";

export type Vue = "fil" | "classements" | "matchs";

/** Les scènes d'un dimanche qui font bouger la course. */
const SCENES: Actu["type"][] = ["mvp", "chiffre", "duo", "montent", "badge", "badges", "equipe"];

/**
 * Un dimanche joué : son titre (J8 · 9 août), son terrain, ses rubriques.
 * Sur grand écran, le terrain à gauche, qui reste à l'écran tant qu'il y
 * tient, et les rubriques à droite, une colonne puis deux dès 1280 px.
 * Son ancre, #j8, y mène depuis Ma saison (useAncre).
 */
function Dimanche({ j, journee, scenes, ouvrir }: { j: number; journee?: Journee; scenes: Actu[]; ouvrir: () => void }) {
  const [terrain, terrainCollant] = useCollant();
  return (
    <section id={`j${j}`} className="flex scroll-mt-4 flex-col gap-3 md:grid md:grid-cols-2 md:items-start md:gap-x-[var(--fib-21)] md:gap-y-[var(--fib-21)] md:border-t md:border-contraste/[0.08] md:pt-[var(--fib-34)] xl:grid-cols-3">
      <div className="flex items-end justify-between px-5 md:col-span-full md:justify-start md:gap-4 md:px-0">
        <h2
          className="text-[22px] leading-none tracking-tight md:text-[34px]"
          style={{ fontFamily: ANTON }}
        >
          {`J${j}`}
        </h2>
        <span className="mono-label text-foreground/45">{journee?.date}</span>
      </div>
      {journee && (
        <div ref={terrain} className={cn("px-5 md:px-0", terrainCollant && "md:sticky md:top-[var(--fib-21)]")}>
          <CarteJournee journee={journee} onOuvrir={ouvrir} />
        </div>
      )}
      <div
        className={cn(
          "flex flex-col gap-1 md:grid md:gap-[var(--fib-21)] xl:col-span-2 xl:grid-cols-2",
          !journee && "md:col-span-full md:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {scenes.map((a) => (
          <RubriqueActu key={a.id} a={a} />
        ))}
      </div>
    </section>
  );
}

/**
 * Une adresse en #j2 (un dimanche de Ma saison) : on descend jusqu'à ce
 * dimanche, d'un coup, une fois les terrains mesurés ; une seule fois, pas à
 * chaque mise à jour de la saison.
 */
function useAncre(pret: boolean) {
  useEffect(() => {
    if (!pret) return;
    const id = window.location.hash.slice(1);
    if (!/^j\d+$/.test(id)) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 450);
    return () => clearTimeout(t);
  }, [pret]);
}

const METRIQUES = ["pp", "buts", "passes", "mvp"] as const;
/** Les classements de la rangée dans une saison : Pépite d'Or, Buteurs, Passeurs, MVP. */
const DE_LA_SAISON: Categorie[] = METRIQUES.map((m) => RANKINGS.find((r) => r.id === m)!);

/** L'écart d'une carte à l'autre dans la rangée, pour les faire glisser de leur ancienne place. */
const PAS = 87;

/**
 * La rangée de cartes : le classement d'une catégorie, centré sur toi. Par
 * défaut, les joueurs et les classements de la saison lue, avec ▲ ou ▼
 * depuis le dimanche d'avant. `figee` (une saison close, la carrière) : le
 * classement ne bouge plus. Sans `onTout` ni `onMatch`, pas de bouton.
 */
function Ticker({
  moi,
  onTout,
  onMatch,
  categories = DE_LA_SAISON,
  joueurs,
  figee = false,
  cle,
}: {
  moi: string;
  onTout?: () => void;
  onMatch?: () => void;
  categories?: Categorie[];
  /** Les joueurs classés ; par défaut, ceux de la saison. */
  joueurs?: Player[];
  figee?: boolean;
  /** La clé 3D de cartes qui ne sont pas les actuelles (une saison close, la carrière). */
  cle?: string;
}) {
  const { players, saison } = useSeason();
  const [id, setId] = useState(categories[0].id);
  const def = categories.find((c) => c.id === id) ?? categories[0];
  const rang = rankByMetric(joueurs ?? players, def.value).filter(
    (p) => def.showAll || p.value > 0,
  );
  // Le classement d'avant le dernier dimanche joué : d'où chacun vient.
  const avant = useMemo(() => {
    if (figee) return null;
    const d = Math.max(0, ...saison.journees.map((m) => m.j).filter((j) => journeeJouee(saison, j)));
    return d ? computeStandings({ ...saison, entries: saison.entries.filter((e) => e.j !== d) }) : null;
  }, [saison, figee]);
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
  // À la souris, on ne glisse pas la rangée du doigt : deux flèches la font
  // défiler, chacune effacée quand ce côté est au bout.
  const [bouts, setBouts] = useState({ debut: true, fin: true });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Un nouvel état seulement quand un bout change : pas de rendu à chaque pas du défilement.
    const mesurer = () => {
      const debut = el.scrollLeft <= 4;
      const fin = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      setBouts((b) => (b.debut === debut && b.fin === fin ? b : { debut, fin }));
    };
    const o = new ResizeObserver(mesurer);
    o.observe(el);
    el.addEventListener("scroll", mesurer, { passive: true });
    return () => {
      o.disconnect();
      el.removeEventListener("scroll", mesurer);
    };
    // Remesuré à chaque classement : la rangée change de longueur sans changer de taille.
  }, [id, rang.length]);
  const defiler = (sens: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: sens * el.clientWidth * 0.8, behavior: calme ? "auto" : "smooth" });
  };
  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "flex items-center gap-1 px-5 md:px-0",
          // Plus de quatre classements (la carrière) : la ligne défile.
          categories.length > DE_LA_SAISON.length && "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={id === c.id}
            onClick={() => setId(c.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap",
              id === c.id ? "bg-foreground text-background" : "text-foreground/50",
            )}
          >
            {c.label}
          </button>
        ))}
        {/* Sur grand écran, « Match » rejoint la ligne des classements. */}
        {onMatch && (
          <button
            type="button"
            onClick={onMatch}
            className="glass hidden rounded-full px-5 py-1.5 text-[13px] font-semibold md:ml-auto md:inline-flex"
          >
            Match
          </button>
        )}
        {onTout && (
          <button
            type="button"
            onClick={onTout}
            className="mono-label ml-auto text-foreground/50 md:ml-5"
          >
            Tout ›
          </button>
        )}
      </div>
      <div className="md:relative">
      {(["debut", "fin"] as const).map((bout) => (
        <button
          key={bout}
          type="button"
          aria-label={bout === "debut" ? "Défiler vers la gauche" : "Défiler vers la droite"}
          onClick={() => defiler(bout === "debut" ? -1 : 1)}
          className={cn(
            "glass absolute top-1/2 z-20 hidden size-10 -translate-y-1/2 place-items-center rounded-full transition-opacity duration-300 pointer-fine:md:grid",
            bout === "debut" ? "left-0" : "right-0",
            bouts[bout] && "pointer-events-none opacity-0",
          )}
        >
          {bout === "debut" ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
        </button>
      ))}
      <div
        ref={ref}
        className="flex items-end gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:px-14 md:[mask-image:linear-gradient(90deg,transparent,#000_56px,#000_calc(100%-56px),transparent)]"
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
              detail={`${p.rank}e · ${p.value} ${unite(def, p.value)}`}
              cle={cle && `${cle}-${p.name}`}
            />
            <span className="max-w-[80px] truncate text-[11px] font-semibold">
              <Nom n={p.name} />
            </span>
            <span className="mono-label text-[10px] text-foreground/50 tabular-nums">
              {p.value} {unite(def, p.value)}
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
    </div>
  );
}

/** La convocation du prochain dimanche, dans le fil : qui vient, et ta réponse d'un geste. */
function Convocation({ className }: { className?: string }) {
  const p = usePresence();
  const { saison } = useSeason();
  const { me } = useMyPlayer();
  const [maintenant] = useState(() => new Date());
  const derniere = p.journee === J_DECOUPAGE && annonceEnCours(saison, maintenant);
  // Dès la J4, la division où l'on joue ce dimanche-là.
  const etat = useMemo(() => divisionsDeLaJournee(saison, p.journee), [saison, p.journee]);
  const division = etat && !isHidden(me) ? (etat.actuelle.get(me) ?? 3) : null;
  const repondre = (r: "present" | "absent") => p.answer(p.mine === r ? null : r);
  return (
    <section
      className={cn(
        "mx-4 flex flex-col gap-4 overflow-hidden rounded-[28px] bg-white p-5 text-foreground shadow-[0_14px_34px_-18px_rgba(20,12,4,0.35)] ring-1 ring-foreground/[0.05] md:mx-0 md:rounded-3xl dark:bg-black dark:text-white dark:shadow-none dark:ring-0",
        className,
      )}
    >
      <div className="flex items-end gap-4">
        <span className="text-[64px] leading-[0.8]" style={{ fontFamily: ANTON }}>
          J{p.journee}
        </span>
        <span className="flex min-w-0 flex-col pb-0.5">
          {derniere && <span className="mono-label mb-1 text-[10px] text-white/60">Dernier dimanche sans divisions</span>}
          {division && <span className="mono-label mb-1 text-[10px] text-white/60">Tu joues en {nomDivision(division)}</span>}
          <span className="text-[16px] font-bold">{p.jour}</span>
          <span className="truncate text-[12.5px] text-foreground/55 dark:text-white/55">
            {ligneDuRendezVous(p.rendezVous)}
          </span>
        </span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="mono-label text-foreground/50 dark:text-white/50">
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
              p.mine === r
                ? r === "present"
                  ? "bg-primary text-primary-foreground"
                  : "bg-foreground text-background"
                : "bg-foreground/[0.07] dark:bg-white/10",
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
    <section className="flex flex-col gap-3 px-5 md:px-0">
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

/**
 * Les classements ou les matchs d'une époque : le retour au fil, la rangée
 * des époques (changer de temps garde la vue : les classements de la saison
 * passée, puis ceux d'avant…), puis la vue elle-même.
 */
function SousVue({
  retour,
  onRetour,
  epoque,
  epoques,
  vue,
  children,
}: {
  retour: string;
  onRetour: () => void;
  epoque: Epoque;
  epoques: ChoixDEpoque[];
  vue: Vue;
  children: React.ReactNode;
}) {
  return (
    <div className="actus-gabarit flex flex-col gap-5 md:gap-[var(--fib-21)] md:pt-4 lg:pt-[var(--fib-34)]">
      <button type="button" onClick={onRetour} className="flex items-center gap-1 px-4 text-[15px] font-semibold text-foreground/70 md:self-start md:px-0">
        <ChevronLeft className="size-5" /> {retour}
      </button>
      <ChoixEpoque epoque={epoque} epoques={epoques} vue={vue} className="mx-5 md:mx-0" />
      {children}
    </div>
  );
}

/**
 * L'onglet, à l'époque choisie (epoques.tsx) : la saison en cours (/ligue),
 * une saison close (/saisons/N) ou le Wall of Fame (/palmares). `classement` :
 * celui qu'ouvrent les classements (?classement=buts).
 */
export function LaCourse({
  epoque = "present",
  vueDepart = "fil",
  classement,
  exploit,
}: {
  epoque?: Epoque;
  vueDepart?: Vue;
  classement?: string | null;
  exploit?: string | null;
}) {
  const epoques = useEpoques();
  if (epoque === "palmares") return <EpoqueWallOfFame epoques={epoques} />;
  if (typeof epoque === "number")
    return <EpoqueSaisonClose numero={epoque} epoques={epoques} vueDepart={vueDepart} classement={classement} />;
  return <EpoqueEnCours epoques={epoques} vueDepart={vueDepart} classement={classement} exploit={exploit} />;
}

/** La saison en cours : la course, la semaine, puis chaque dimanche joué. */
function EpoqueEnCours({
  epoques,
  vueDepart,
  classement,
  exploit,
}: {
  epoques: ChoixDEpoque[];
  vueDepart: Vue;
  classement?: string | null;
  exploit?: string | null;
}) {
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
  const [semaine, semaineCollante] = useCollant();
  useAncre(vue === "fil" && dimanches.length > 0);

  if (vue !== "fil")
    return (
      <SousVue retour="Actus" onRetour={() => aller("fil")} epoque="present" epoques={epoques} vue={vue}>
        {vue === "classements" ? <VueClassements vote={<VoteDuJour me={me} />} classement={classement} /> : <VueMatchs />}
      </SousVue>
    );

  return (
    <div className="actus-gabarit flex flex-col gap-6 md:gap-[var(--fib-34)] md:pt-4 lg:pt-[var(--fib-34)]">
      <header className="flex flex-col gap-4 md:gap-[var(--fib-21)]">
        <h1 className="sr-only">Actus</h1>
        <EnteteLigue actif="/ligue" className="px-5 md:px-0" />
        <ChoixEpoque epoque="present" epoques={epoques} className="mx-5 md:mx-0" />
        <Ticker moi={me} onTout={() => aller("classements")} onMatch={() => aller("matchs")} />
        <div className="px-5 md:hidden">
          <button type="button" onClick={() => aller("matchs")} className="glass w-full rounded-full py-2.5 text-[14px] font-semibold">
            Match
          </button>
        </div>
      </header>
      {/* La semaine. Sur téléphone, un seul fil (l'ordre vient des order-*) :
          le direct, le vote, les divisions, l'outsider, ton dimanche, la
          convocation, tes missions, les contrats en jeu, puis ce qui se joue.
          Sur grand écran, deux colonnes : à gauche ce qui se joue (direct,
          vote, convocation, missions), à droite les divisions, l'outsider et
          tes rubriques ; dessous, les contrats en jeu sur toute la largeur. */}
      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-[var(--fib-21)] xl:grid-cols-3">
        <div
          ref={semaine}
          className={cn("contents md:flex md:flex-col md:gap-[var(--fib-21)]", semaineCollante && "md:sticky md:top-[var(--fib-21)]")}
        >
          <EnDirect ouvrir={(j) => router.push(`/ligue/journee?j=${j}`)} />
          <VoteDuJour me={me} />
          <Convocation className="order-2 md:order-none" />
          <MissionsBola className="order-2 md:order-none" />
        </div>
        <div className="contents md:grid md:gap-[var(--fib-21)] xl:col-span-2 xl:grid-cols-2">
          <RubriqueDivisions className="order-1 md:order-none" />
          <RubriqueOutsider className="order-1 md:order-none" />
          {dernier > 0 && (
            <RubriqueToi className="order-1 md:order-none" j={dernier} date={journees.find((x) => x.j === dernier)?.date ?? ""} />
          )}
          <div className="order-3 flex flex-col gap-1 md:order-none md:contents">
            {duels.length > 0 && <RubriqueEnjeux liste={duels} moi={me} />}
            {v && <RubriqueRival v={v} />}
            {v?.devant && <RubriqueBesoin v={v} />}
          </div>
        </div>
        <ContratsEnJeu className="order-2 md:order-none md:col-span-full" />
      </div>
      {dimanches.map((d) => (
        <Dimanche key={d.j} j={d.j} journee={d.journee} scenes={d.scenes} ouvrir={() => router.push(`/ligue/journee?j=${d.j}`)} />
      ))}
    </div>
  );
}

/**
 * Une saison close, relue dans son archive comme la saison en cours (tout ce
 * qui lit useSeason dessous voit l'archive) : son classement final en cartes,
 * qui ne bouge plus, son palmarès, puis chacun de ses dimanches avec son
 * terrain et ses rubriques, sans Bravo ni partage (useSaisonClose). Toucher
 * un terrain ouvre le récap de ce dimanche-là (/ligue/journee?saison=N&j=…).
 */
function EpoqueSaisonClose({
  numero,
  epoques,
  vueDepart,
  classement,
}: {
  numero: number;
  epoques: ChoixDEpoque[];
  vueDepart: Vue;
  classement?: string | null;
}) {
  const { saison } = useSeason();
  const archive = saison.archives?.find((a) => a.numero === numero);
  const relue = useMemo(() => (archive ? saisonDepuisArchive(archive) : null), [archive]);
  const palmares = useMemo(
    () => (archive ? (saisonsPalmares(saison).find((s) => s.cloturee && s.numero === numero) ?? null) : null),
    [saison, archive, numero],
  );
  if (!archive || !relue)
    return (
      <div className="actus-gabarit flex flex-col gap-6 md:gap-[var(--fib-34)] md:pt-4 lg:pt-[var(--fib-34)]">
        <header className="flex flex-col gap-4 md:gap-[var(--fib-21)]">
          <EnteteLigue actif="/ligue" className="px-5 md:px-0" />
          <ChoixEpoque epoque={numero} epoques={epoques} className="mx-5 md:mx-0" />
        </header>
        <p className="px-5 text-[14px] text-muted-foreground md:px-0">Cette saison n&apos;est pas dans les archives.</p>
      </div>
    );
  return (
    <SaisonArchiveProvider saison={relue}>
      <LectureSaison numero={numero} nom={archive.nom} epoques={epoques} palmares={palmares} vueDepart={vueDepart} classement={classement} />
    </SaisonArchiveProvider>
  );
}

function LectureSaison({
  numero,
  nom,
  epoques,
  palmares,
  vueDepart,
  classement,
}: {
  numero: number;
  nom: string;
  epoques: ChoixDEpoque[];
  palmares: SaisonPalmares | null;
  vueDepart: Vue;
  classement?: string | null;
}) {
  const { saison, journees } = useSeason();
  const { me } = useMyPlayer();
  const router = useRouter();
  const [vue, setVue] = useState<Vue>(vueDepart);
  const aller = (v: Vue) => {
    setVue(v);
    document.getElementById("app-scroll")?.scrollTo({ top: 0 });
  };
  const recap = (j: number) => router.push(`/ligue/journee?saison=${numero}&j=${j}`);
  // Ses dimanches, du dernier au premier : le terrain, puis les scènes.
  const dimanches = useMemo(() => {
    const fil = filDeSaison(saison, journees, me, false);
    const js = [...new Set(fil.map((a) => a.j))];
    return js.map((j) => ({ j, journee: journees.find((x) => x.j === j), scenes: fil.filter((a) => a.j === j && SCENES.includes(a.type)) }));
  }, [saison, journees, me]);
  useAncre(vue === "fil" && dimanches.length > 0);

  if (vue !== "fil")
    return (
      <SousVue retour={nom} onRetour={() => aller("fil")} epoque={numero} epoques={epoques} vue={vue}>
        {vue === "classements" ? <VueClassements classement={classement} /> : <VueMatchs ouvrir={recap} />}
      </SousVue>
    );

  return (
    <div className="actus-gabarit flex flex-col gap-6 md:gap-[var(--fib-34)] md:pt-4 lg:pt-[var(--fib-34)]">
      <header className="flex flex-col gap-4 md:gap-[var(--fib-21)]">
        <h1 className="sr-only">{nom}</h1>
        <EnteteLigue actif="/ligue" className="px-5 md:px-0" />
        <ChoixEpoque epoque={numero} epoques={epoques} className="mx-5 md:mx-0" />
        <Ticker moi={me} figee cle={`saison-${numero}`} onTout={() => aller("classements")} onMatch={() => aller("matchs")} />
        <div className="px-5 md:hidden">
          <button type="button" onClick={() => aller("matchs")} className="glass w-full rounded-full py-2.5 text-[14px] font-semibold">
            Match
          </button>
        </div>
      </header>
      {palmares && <CarteSaison s={palmares} titre="Le palmarès" lien={false} className="mx-5 md:mx-auto md:w-full md:max-w-[560px]" />}
      {dimanches.map((d) => (
        <Dimanche key={d.j} j={d.j} journee={d.journee} scenes={d.scenes} ouvrir={() => recap(d.j)} />
      ))}
    </div>
  );
}

/**
 * Le Wall of Fame : toutes les saisons. Ses chiffres, les légendes dans la
 * rangée de cartes (la carrière, centrée sur toi), puis les saisons et ton
 * parcours (wall-of-fame.tsx).
 */
function EpoqueWallOfFame({ epoques }: { epoques: ChoixDEpoque[] }) {
  const { saison } = useSeason();
  const { me } = useMyPlayer();
  const saisons = useMemo(() => saisonsPalmares(saison), [saison]);
  const { categories, joueurs } = useMemo(() => categoriesLegendes(legendes(saisons)), [saisons]);
  return (
    <div className="actus-gabarit flex flex-col gap-6 md:gap-[var(--fib-34)] md:pt-4 lg:pt-[var(--fib-34)]">
      <header className="flex flex-col gap-4 md:gap-[var(--fib-21)]">
        <h1 className="sr-only">Wall of Fame</h1>
        <EnteteLigue actif="/ligue" className="px-5 md:px-0" />
        <ChoixEpoque epoque="palmares" epoques={epoques} className="mx-5 md:mx-0" />
        <Compteurs saisons={saisons} className="mx-5 md:mx-0 md:max-w-[480px]" />
        {joueurs.length > 0 && <Ticker moi={me} categories={categories} joueurs={joueurs} figee cle="carriere" />}
      </header>
      <LeMur saisons={saisons} moi={me} />
    </div>
  );
}
