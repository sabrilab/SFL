"use client";

// L'onglet Actus : la course (Sabri, 22/10, parmi quatre concepts : « C'est
// très bien, la course », et il garde les terrains et les cartes d'avant les
// Actus). Pourquoi la course : le journal d'activité montre que les joueurs
// viennent surtout se situer (Ma carte est la page où ils restent le plus).
//   · l'en-tête : le sigle SFL (qui déroule Bola et Bola Team), le choix de
//     la saison et la loupe (EnteteLigue, epoques.tsx), puis trois onglets
//     côte à côte (Sabri, 24/10 : moins de boutons, « le classement Pépite
//     d'Or comme ça, juste à côté, un onglet Classement, juste à côté,
//     l'onglet Match ») :
//       Pépite d'Or — son classement en cartes qu'on fait défiler, centré
//       sur toi, lui seul (plus de Buteurs, Passeurs, MVP ni « Tout » ici),
//       puis le fil ci-dessous. Sous chaque carte, ▲ ou ▼ depuis la semaine
//       passée, et à l'ouverture les cartes glissent de leur ancienne place
//       à la nouvelle ;
//       Classement — tous les classements (Buteurs, Passeurs, MVP… ; vues.tsx) ;
//       Match — les journées jouées (vues.tsx).
//     L'onglet est dans l'adresse (?vue=classements, ?vue=matchs ;
//     page-actus.tsx), et l'en-tête ne bouge pas d'un onglet à l'autre ;
//   · le fil : le jour du match, la feuille en direct ; les divisions
//     (divisions.tsx : leur annonce jusqu'à la J4, puis le bilan de chaque
//     dimanche) ; ton dimanche (ta carte, tes chiffres, tes places) ; la
//     convocation (la météo de ton match, meteo-match.tsx ; qui vient, Je viens / Je passe ; « Dernier dimanche sans
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
// Actu », avec de quoi voir « le passé ou le présent ») : le bouton de la
// saison, à côté de la loupe (epoques.tsx), déroule la saison en cours, les
// saisons closes et le Wall of Fame. Une saison close se lit avec les mêmes
// onglets : sa rangée de cartes, figée sur son classement final, son
// palmarès, puis chacun de ses dimanches ; ses classements ; ses matchs. Le
// Wall of Fame met la rangée sur la Pépite d'Or de toute la carrière, puis
// les saisons et ton parcours ; son onglet Classement a toutes les légendes,
// et il n'a pas d'onglet Match (wall-of-fame.tsx). Chaque époque a son
// adresse (page-actus.tsx).
//
// Sur tablette et ordinateur (dès 768 px ; Sabri, 23/10 : « rends-le
// responsive pour le desktop […] et réadapte toutes les dispositions »), le
// fil devient une grille, deux colonnes puis trois dès 1280 px (.actus-gabarit,
// actus.css). À gauche, ce qui se joue : le direct, le vote, la convocation et
// tes missions ; à droite, tes rubriques côte à côte ; dessous, les contrats
// en jeu de toute la ligue, sur toute la largeur. Puis chaque dimanche : son
// terrain à gauche, qui reste à l'écran pendant qu'on parcourt ses rubriques
// à droite. Les onglets restent à gauche ; la course garde sa rangée, avec
// deux flèches pour la souris (les contrats en jeu aussi). Tout est en
// classes md: / xl: : sous 768 px, le téléphone garde son fil tel quel (sur
// téléphone, l'ordre des blocs de la semaine vient des classes order-*).

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useJoueurBola, useMyPlayer } from "@/components/sfl/player-provider";
import { SaisonArchiveProvider, useSeason } from "@/components/sfl/season-provider";
import { EnteteLigue } from "@/components/sfl/choix-ligue";
import { CarteJournee } from "@/components/sfl/carte-journee";
import { Classements } from "@/components/sfl/classements";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { QuiVient } from "@/components/sfl/qui-vient";
import { useCollant } from "@/hooks/use-collant";
import { usePresence } from "@/hooks/use-presence";
import { MeteoMatch } from "@/components/sfl/meteo-match";
import { dateIsoDuLibelle } from "@/lib/sfl/meteo";
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
import { RANKINGS, unite, type Categorie } from "@/lib/sfl/rankings";
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
import { PronosBola } from "./pronos";
import { VideosDuFil } from "./video";
import { VueClassements, VueMatchs } from "./vues";
import { ChoixEpoque, useEpoques, type ChoixDEpoque, type Epoque, type Vue } from "./epoques";
import { CarteSaison, categoriesLegendes, Compteurs, LeMur } from "./wall-of-fame";

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

/** Le classement de la rangée de cartes : la Pépite d'Or de la saison. */
const PEPITE: Categorie = RANKINGS.find((r) => r.id === "pp")!;

/**
 * Toutes les cartes de la rangée au même format, debout, celui du premier
 * (Sabri, 24/10 : « il n'y a pas de raison […] tous au même format que le
 * premier »). Le podium se lit à l'écrin de la carte, pas à sa taille.
 */
const TAILLE = FORMAT_CARTE.moyenne;

/** L'écart d'une carte à l'autre dans la rangée (carte, écrin, espace), pour les faire glisser de leur ancienne place. */
const PAS = Math.round(254 * TAILLE) + 16 + 12;

/**
 * L'écrin d'une place du podium, dans le vocabulaire de la carte imprimée
 * (Sabri, 24/10 : « un embellissement du fond ou bien du liseré ») : à
 * l'encre seule, sans or ni couleur, il s'enrichit d'une marche à l'autre.
 *   · 3e — un filet ;
 *   · 2e — le double filet, comme sur un billet ;
 *   · 1er — le double filet sur un fond guilloché, les vagues de l'onyx
 *     (motif-carte.tsx) : deux familles de vagues en opposition de phase,
 *     de longueurs d'onde voisines, qui s'entrelacent en moire.
 */
const GUILLOCHE = (() => {
  let d = "";
  for (const [lambda, phase] of [[52, 0], [47, Math.PI]] as const)
    for (let y0 = -6; y0 <= 246; y0 += 7) {
      for (let x = 0; x <= 100; x += 2.5) {
        const y = y0 + 3.2 * Math.sin((2 * Math.PI * x) / lambda + phase + y0 / 30);
        d += `${x === 0 ? "M" : "L"}${x} ${Math.round(y * 10) / 10}`;
      }
    }
  return d;
})();

function Ecrin({ rang }: { rang: number }) {
  if (rang > 3) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
      {rang === 1 && (
        <>
          <span className="absolute inset-0 bg-foreground/[0.05]" />
          <svg viewBox="0 0 100 240" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full text-foreground/[0.13]">
            <path d={GUILLOCHE} fill="none" stroke="currentColor" strokeWidth={0.45} />
          </svg>
        </>
      )}
      <span
        className={cn(
          "absolute inset-0 rounded-2xl ring-1 ring-inset",
          rang === 1 ? "ring-foreground/40" : rang === 2 ? "ring-foreground/30" : "ring-foreground/20",
        )}
      />
      {rang <= 2 && (
        <span
          className={cn(
            "absolute inset-[3px] rounded-[13px] ring-1 ring-inset",
            rang === 1 ? "ring-foreground/20" : "ring-foreground/12",
          )}
        />
      )}
    </span>
  );
}

/**
 * La rangée de cartes : la Pépite d'Or, centrée sur toi, et elle seule (les
 * autres classements sont dans l'onglet Classement). Par défaut, les joueurs
 * de la saison lue, avec ▲ ou ▼ depuis le dimanche d'avant. `figee` (une
 * saison close, la carrière) : le classement ne bouge plus. Le Wall of Fame
 * passe sa Pépite d'Or de carrière (`def`, `joueurs`).
 */
function Ticker({
  moi,
  def = PEPITE,
  joueurs,
  figee = false,
  cle,
}: {
  moi: string;
  def?: Categorie;
  /** Les joueurs classés ; par défaut, ceux de la saison. */
  joueurs?: Player[];
  figee?: boolean;
  /** La clé 3D de cartes qui ne sont pas les actuelles (une saison close, la carrière). */
  cle?: string;
}) {
  const { players, saison } = useSeason();
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
  // Les cartes partent de leur place de la semaine passée, puis glissent à la
  // nouvelle : dès que la saison est là (elle peut arriver après la rangée).
  const pret = rang.length > 0;
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
  }, [pret]);
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
    // Remesuré quand la rangée change de longueur sans changer de taille.
  }, [rang.length]);
  const defiler = (sens: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: sens * el.clientWidth * 0.8, behavior: calme ? "auto" : "smooth" });
  };
  return (
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
            key={p.name}
            data-moi={p.name === moi ? "" : undefined}
            className={cn(
              "isolate flex shrink-0 flex-col items-center gap-1 rounded-2xl p-2",
              p.name === moi && "bg-foreground/10",
              pose && "transition-transform duration-[1200ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
              "relative",
              p.name === moi && "z-10",
            )}
            style={{ transform: pose || !a ? undefined : `translateX(${(a.i - i) * PAS}px)` }}
          >
            <Ecrin rang={p.rank} />
            <span
              className="text-[20px] leading-none"
              style={{ fontFamily: ANTON }}
            >
              {p.rank}
            </span>
            <MiniCarte
              player={p}
              size={TAILLE}
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
  );
}

/** La convocation du prochain dimanche, dans le fil : qui vient, et ta réponse d'un geste. */
function Convocation({ className }: { className?: string }) {
  const p = usePresence();
  const { saison } = useSeason();
  const { me } = useMyPlayer();
  // Un joueur Bola (hors de la saison) n'est pas convoqué.
  const bola = useJoueurBola();
  const [maintenant] = useState(() => new Date());
  const derniere = p.journee === J_DECOUPAGE && annonceEnCours(saison, maintenant);
  // Dès la J4, la division où l'on joue ce dimanche-là.
  const etat = useMemo(() => divisionsDeLaJournee(saison, p.journee), [saison, p.journee]);
  const division = etat && !isHidden(me) ? (etat.actuelle.get(me) ?? 3) : null;
  const repondre = (r: "present" | "absent") => p.answer(p.mine === r ? null : r);
  // La météo de mon match : son lieu (celui de la ligue qui porte ce nom, sinon le terrain habituel).
  const [aujourdhui] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()));
  const terrains = saison.terrains ?? [];
  const lieu = terrains.find((t) => t.nom === p.rendezVous.lieu) ?? terrains.find((t) => t.defaut) ?? terrains[0] ?? null;
  if (bola) return null;
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
      {lieu && (
        <MeteoMatch
          taille="ligne"
          lat={lieu.lat}
          lng={lieu.lng}
          date={dateIsoDuLibelle(p.jour, aujourdhui)}
          heure={p.rendezVous.heure}
          aujourdhui={aujourdhui}
          className="border-t border-foreground/10 pt-3.5 dark:border-white/10"
        />
      )}
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
 * Les onglets d'une époque, côte à côte (Sabri, 24/10 : « le classement
 * Pépite d'Or comme ça, juste à côté, un onglet Classement, juste à côté,
 * l'onglet Match »).
 */
const VUES: { id: Vue; label: string }[] = [
  { id: "fil", label: "Pépite d'Or" },
  { id: "classements", label: "Classement" },
  { id: "matchs", label: "Match" },
];

/** Les pages de l'onglet, d'une époque à l'autre et d'un onglet à l'autre : l'en-tête reste à sa place. */
const GABARIT = "actus-gabarit flex flex-col gap-6 md:gap-[var(--fib-34)] md:pt-4 lg:pt-[var(--fib-34)]";

/**
 * L'en-tête d'une époque, le même sous chaque onglet : le sigle de la ligue,
 * le bouton de la saison et la loupe, puis les onglets. Sous la Pépite d'Or,
 * sa rangée de cartes (`children`). Sans `vues`, pas d'onglets (une saison
 * introuvable).
 */
function EnTete({
  titre,
  epoque,
  epoques,
  vue,
  onVue,
  vues = VUES,
  children,
}: {
  titre: string;
  epoque: Epoque;
  epoques: ChoixDEpoque[];
  vue: Vue;
  onVue: (v: Vue) => void;
  vues?: { id: Vue; label: string }[];
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 md:gap-[var(--fib-21)]">
      <h1 className="sr-only">{titre}</h1>
      <EnteteLigue actif="/ligue" className="px-5 md:px-0">
        <ChoixEpoque epoque={epoque} epoques={epoques} vue={vue} />
      </EnteteLigue>
      {vues.length > 0 && (
        <div role="tablist" aria-label="Vue" className="glass mx-5 flex gap-1 rounded-full p-1 md:mx-0 md:self-start">
          {vues.map((o) => (
            <button
              key={o.id}
              type="button"
              role="tab"
              aria-selected={vue === o.id}
              onClick={() => onVue(o.id)}
              className={cn(
                "flex-1 px-4 py-2 text-[13px] font-semibold whitespace-nowrap md:flex-none md:px-6",
                vue === o.id ? "bouton-principal" : "bouton-discret text-muted-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {children}
    </header>
  );
}

/**
 * L'onglet, à l'époque choisie (epoques.tsx) : la saison en cours (/ligue),
 * une saison close (/saisons/N) ou le Wall of Fame (/palmares), sous
 * l'onglet `vue` ; `onVue` en change (page-actus.tsx le garde dans
 * l'adresse). `classement` : celui qu'ouvre l'onglet Classement
 * (?classement=buts).
 */
export function LaCourse({
  epoque = "present",
  vue = "fil",
  onVue,
  classement,
  exploit,
}: {
  epoque?: Epoque;
  vue?: Vue;
  onVue: (v: Vue) => void;
  classement?: string | null;
  exploit?: string | null;
}) {
  const epoques = useEpoques();
  if (epoque === "palmares") return <EpoqueWallOfFame epoques={epoques} vue={vue} onVue={onVue} classement={classement} />;
  if (typeof epoque === "number")
    return <EpoqueSaisonClose numero={epoque} epoques={epoques} vue={vue} onVue={onVue} classement={classement} />;
  return <EpoqueEnCours epoques={epoques} vue={vue} onVue={onVue} classement={classement} exploit={exploit} />;
}

interface PropsEpoque {
  epoques: ChoixDEpoque[];
  vue: Vue;
  onVue: (v: Vue) => void;
  classement?: string | null;
}

/** La saison en cours : la course, la semaine, puis chaque dimanche joué. */
function EpoqueEnCours({ epoques, vue, onVue, classement, exploit }: PropsEpoque & { exploit?: string | null }) {
  const { saison, journees } = useSeason();
  const { me } = useMyPlayer();
  const router = useRouter();
  // La rubrique d'un exploit, une fois les terrains mesurés.
  useEffect(() => {
    if (!exploit) return;
    const t = setTimeout(() => {
      const el = [...document.querySelectorAll<HTMLElement>("[data-exploits]")].find((x) => x.dataset.exploits?.split("|").includes(exploit));
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 450);
    return () => clearTimeout(t);
  }, [exploit]);
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

  return (
    <div className={GABARIT}>
      <EnTete titre="Actus" epoque="present" epoques={epoques} vue={vue} onVue={onVue}>
        {vue === "fil" && <Ticker moi={me} />}
      </EnTete>
      {vue === "classements" ? (
        <VueClassements vote={<VoteDuJour me={me} />} classement={classement} />
      ) : vue === "matchs" ? (
        <VueMatchs />
      ) : (
        <>
          {/* La semaine. Sur téléphone, un seul fil (l'ordre vient des order-*) :
              la vidéo de Bola, le direct, le vote, les divisions, l'outsider, ton dimanche, la
              convocation, tes missions, tes pronos, les contrats en jeu, puis ce qui se joue.
              Sur grand écran, deux colonnes : à gauche ce qui se joue (vidéo, direct,
              vote, convocation, missions, pronos), à droite les divisions, l'outsider et
              tes rubriques ; dessous, les contrats en jeu sur toute la largeur. */}
          <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-[var(--fib-21)] xl:grid-cols-3">
            <div
              ref={semaine}
              className={cn("contents md:flex md:flex-col md:gap-[var(--fib-21)]", semaineCollante && "md:sticky md:top-[var(--fib-21)]")}
            >
              <VideosDuFil />
              <EnDirect ouvrir={(j) => router.push(`/ligue/journee?j=${j}`)} />
              <VoteDuJour me={me} />
              <Convocation className="order-2 md:order-none" />
              <MissionsBola className="order-2 md:order-none" />
              <PronosBola className="order-2 md:order-none" />
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
            <ContratsEnJeu apercu className="order-2 md:order-none md:col-span-full" />
          </div>
          {dimanches.map((d) => (
            <Dimanche key={d.j} j={d.j} journee={d.journee} scenes={d.scenes} ouvrir={() => router.push(`/ligue/journee?j=${d.j}`)} />
          ))}
        </>
      )}
    </div>
  );
}

/**
 * Une saison close, relue dans son archive comme la saison en cours (tout ce
 * qui lit useSeason dessous voit l'archive) : son classement final en cartes,
 * qui ne bouge plus, son palmarès, puis chacun de ses dimanches avec son
 * terrain et ses rubriques, sans Bravo ni partage (useSaisonClose) ; ses
 * classements ; ses matchs. Toucher un terrain ouvre le récap de ce
 * dimanche-là (/ligue/journee?saison=N&j=…).
 */
function EpoqueSaisonClose({ numero, epoques, vue, onVue, classement }: PropsEpoque & { numero: number }) {
  const { saison } = useSeason();
  const archive = saison.archives?.find((a) => a.numero === numero);
  const relue = useMemo(() => (archive ? saisonDepuisArchive(archive) : null), [archive]);
  const palmares = useMemo(
    () => (archive ? (saisonsPalmares(saison).find((s) => s.cloturee && s.numero === numero) ?? null) : null),
    [saison, archive, numero],
  );
  if (!archive || !relue)
    return (
      <div className={GABARIT}>
        <EnTete titre="Actus" epoque={numero} epoques={epoques} vue={vue} onVue={onVue} vues={[]} />
        <p className="px-5 text-[14px] text-muted-foreground md:px-0">Cette saison n&apos;est pas dans les archives.</p>
      </div>
    );
  return (
    <SaisonArchiveProvider saison={relue}>
      <LectureSaison numero={numero} nom={archive.nom} epoques={epoques} palmares={palmares} vue={vue} onVue={onVue} classement={classement} />
    </SaisonArchiveProvider>
  );
}

function LectureSaison({
  numero,
  nom,
  epoques,
  palmares,
  vue,
  onVue,
  classement,
}: PropsEpoque & { numero: number; nom: string; palmares: SaisonPalmares | null }) {
  const { saison, journees } = useSeason();
  const { me } = useMyPlayer();
  const router = useRouter();
  const recap = (j: number) => router.push(`/ligue/journee?saison=${numero}&j=${j}`);
  // Ses dimanches, du dernier au premier : le terrain, puis les scènes.
  const dimanches = useMemo(() => {
    const fil = filDeSaison(saison, journees, me, false);
    const js = [...new Set(fil.map((a) => a.j))];
    return js.map((j) => ({ j, journee: journees.find((x) => x.j === j), scenes: fil.filter((a) => a.j === j && SCENES.includes(a.type)) }));
  }, [saison, journees, me]);
  useAncre(vue === "fil" && dimanches.length > 0);

  return (
    <div className={GABARIT}>
      <EnTete titre={nom} epoque={numero} epoques={epoques} vue={vue} onVue={onVue}>
        {vue === "fil" && <Ticker moi={me} figee cle={`saison-${numero}`} />}
      </EnTete>
      {vue === "classements" ? (
        <VueClassements classement={classement} cle={`saison-${numero}`} />
      ) : vue === "matchs" ? (
        <VueMatchs ouvrir={recap} />
      ) : (
        <>
          {palmares && <CarteSaison s={palmares} titre="Le palmarès" lien={false} className="mx-5 md:mx-auto md:w-full md:max-w-[560px]" />}
          {dimanches.map((d) => (
            <Dimanche key={d.j} j={d.j} journee={d.journee} scenes={d.scenes} ouvrir={() => recap(d.j)} />
          ))}
        </>
      )}
    </div>
  );
}

/**
 * Le Wall of Fame : toutes les saisons, sous deux onglets (pas de matchs) :
 * la Pépite d'Or de la carrière en cartes, centrée sur toi, ses chiffres,
 * puis les saisons et ton parcours ; Classement, toutes les légendes
 * (wall-of-fame.tsx).
 */
function EpoqueWallOfFame({ epoques, vue, onVue, classement }: PropsEpoque) {
  const { saison } = useSeason();
  const { me } = useMyPlayer();
  const saisons = useMemo(() => saisonsPalmares(saison), [saison]);
  const { categories, joueurs } = useMemo(() => categoriesLegendes(legendes(saisons)), [saisons]);
  const ici = vue === "classements" ? vue : "fil";
  return (
    <div className={GABARIT}>
      <EnTete titre="Wall of Fame" epoque="palmares" epoques={epoques} vue={ici} onVue={onVue} vues={VUES.filter((o) => o.id !== "matchs")}>
        {ici === "fil" && joueurs.length > 0 && <Ticker moi={me} def={categories[0]} joueurs={joueurs} figee cle="carriere" />}
      </EnTete>
      {ici === "classements" ? (
        <div className="px-5 md:px-0">
          <Classements me={me} initial={classement} categories={categories} joueurs={joueurs} cle="carriere" />
        </div>
      ) : (
        <>
          <Compteurs saisons={saisons} className="mx-5 md:mx-0 md:max-w-[480px]" />
          <LeMur saisons={saisons} moi={me} />
        </>
      )}
    </div>
  );
}
