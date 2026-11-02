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
//       Actus — le fil ci-dessous (Sabri, 26/10 : « quand je clique dans
//       Actu, il faut qu'on voie les dernières actus ») ;
//       Classement — d'abord le podium de la Pépite d'Or et ses pépites qui
//       flottent, puis son classement en cartes qu'on fait défiler, centré
//       sur toi, ▲ ou ▼ depuis la semaine passée (Sabri, 26/10 : le podium
//       « il faudrait [le] voir quand on va dans le classement ») ; puis tous
//       les classements (Buteurs, Passeurs, MVP… ; vues.tsx) ;
//       Match — les journées jouées (vues.tsx).
//     L'onglet est dans l'adresse (?vue=classements, ?vue=matchs ;
//     page-actus.tsx), et l'en-tête ne bouge pas d'un onglet à l'autre ;
//   · le fil (Sabri, 31/10 : « plus je scrolle, plus je découvre », pas
//     revenir sur ce qu'on connaît déjà) : le rail des journées, collé en
//     haut ; le jour du match, la feuille en direct ; puis, du dimanche soir
//     au mercredi, le dernier dimanche joué d'abord (sa couverture, ses
//     vidéos, son terrain, le vote du soir, ton dimanche, ton Flair, ses
//     rubriques), et la semaine qui se prépare ensuite ; du jeudi au matin
//     du match, la semaine d'abord. La semaine : la convocation (la météo de
//     ton match, meteo-match.tsx ; qui vient, Je viens / Je passe ; ta
//     division), tant que son dimanche n'est pas joué ; le vendredi et le
//     samedi, le contrat à la une : un seul rang S, signé par un bon joueur
//     (contrat-a-la-une.tsx ; Sabri, 27/10 : « Tu mets pas les missions. Tu
//     mets juste des missions de rang S […] acceptées par de bons joueurs ») ;
//     ce qui se joue dimanche (les places à un ou deux points), ton rival et
//     ce qu'il te faut pour le passer. Les missions, les miennes, celles des
//     autres et l'outsider de l'arc 1, vivent dans Ma carte → Niveau XP
//     (mode-passe.tsx). Enfin les journées d'avant, repliées, une ligne
//     chacune (JourneeDAvant) : la toucher la déplie sur place. Le fil a une
//     fin. Chaque rubrique est un terrain avec ses petites cartes
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
// la vidéo ; à droite, le contrat à la une et tes rubriques. Puis chaque dimanche : son
// terrain à gauche, qui reste à l'écran pendant qu'on parcourt ses rubriques
// à droite. Les onglets restent à gauche ; la course garde sa rangée, avec
// deux flèches pour la souris. Tout est en
// classes md: / xl: : sous 768 px, le téléphone garde son fil tel quel (sur
// téléphone, l'ordre des blocs de la semaine vient des classes order-*).

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { Repere } from "@/components/sfl/pepites-flottantes";
import { useJoueurBola, useMyPlayer } from "@/components/sfl/player-provider";
import { SaisonArchiveProvider, useSeason } from "@/components/sfl/season-provider";
import { EnteteLigue } from "@/components/sfl/choix-ligue";
import { CarteJournee } from "@/components/sfl/carte-journee";
import { Classements } from "@/components/sfl/classements";
import { useJourneesDuClassement } from "@/hooks/use-blessures";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { QuiVient } from "@/components/sfl/qui-vient";
import { useCollant } from "@/hooks/use-collant";
import { usePresence } from "@/hooks/use-presence";
import { ReponseScellee } from "@/components/sfl/reponse-scellee";
import { MeteoMatch } from "@/components/sfl/meteo-match";
import { dateIsoDuLibelle, joursJusquA } from "@/lib/sfl/meteo";
import { estLeJour } from "@/lib/sfl/convocation-temps";
import { journeeComptee } from "@/lib/sfl/revelation";
import { annonceEnCours, J_DECOUPAGE, nomDivision, type Division } from "@/lib/sfl/divisions";
import { METAL, PastilleDivision, parDivision, useDecoupageClassement } from "@/components/sfl/metal-division";
import { divisionsDeLaJournee } from "@/lib/sfl/equipes-division";
import { isHidden } from "@/lib/sfl/hidden";
import { standingsJusqua } from "@/lib/sfl/rangs";
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
import { VoteDuJour } from "./fil";
import { DivisionsApres } from "./divisions-apres";
import { CouvertureRubrique, RubriqueActu, RubriqueBesoin, RubriqueEnjeux, RubriqueRival, RubriqueToi } from "./pelouse";
import { couverturesDuDimanche, sources, type Couverture } from "@/lib/sfl/couvertures";
import { ContratALaUne } from "./contrat-a-la-une";
import { RubriqueFlair } from "@/components/sfl/flair/mon-flair";
import { journeeDeLaVideo, useVideos, VideosDuFil } from "./video";
import type { Video } from "@/lib/sfl/videos";
import { VueClassements, VueMatchs } from "./vues";
import { ChoixEpoque, useEpoques, type ChoixDEpoque, type Epoque, type Vue } from "./epoques";
import { CarteSaison, categoriesLegendes, Compteurs, LeMur } from "./wall-of-fame";
import { Suspendu } from "@/components/sfl/cartons/mes-cartons";

/** Les scènes d'un dimanche qui font bouger la course. */
const SCENES: Actu["type"][] = ["titres", "mvp", "chiffre", "podium-jour", "duo", "montent", "badge", "badges", "equipe"];

/**
 * Un dimanche joué : sa couverture (une photo du moodboard, J8 et sa date,
 * lib/sfl/couvertures.ts), son terrain, ses rubriques, dont une sur trois
 * posée sur une photo plutôt que sur le gazon : le fil respire (Sabri,
 * 24/10). Sur grand écran, la couverture en bandeau, le terrain à gauche,
 * qui reste à l'écran tant qu'il y tient, et les rubriques à droite, une
 * colonne puis deux dès 1280 px. Son ancre, #j8, y mène depuis Ma saison
 * (useAncre).
 */
function Dimanche({
  j,
  journee,
  scenes,
  ouvrir,
  videos = [],
  avant,
  depliee = false,
}: {
  j: number;
  journee?: Journee;
  scenes: Actu[];
  ouvrir: () => void;
  /** Les vidéos de ce dimanche (Sabri, 26/10 : « la vidéo […] de la journée 3 dans le feed de la journée 3 »). */
  videos?: Video[];
  /** Ce qui ouvre ses rubriques : ton dimanche, pour le dernier joué. */
  avant?: React.ReactNode;
  /** Déplié depuis sa ligne (JourneeDAvant) : la ligne porte l'ancre et tient lieu de couverture. */
  depliee?: boolean;
}) {
  const [terrain, terrainCollant] = useCollant();
  const { chapitre, rubriques } = useMemo(() => couverturesDuDimanche(j, scenes.map((a) => a.type)), [j, scenes]);
  return (
    <section
      id={depliee ? undefined : `j${j}`}
      className={cn(
        "flex scroll-mt-[60px] flex-col gap-3 md:grid md:grid-cols-2 md:items-start md:gap-x-[var(--fib-21)] md:gap-y-[var(--fib-21)] xl:grid-cols-3",
        !depliee && "md:border-t md:border-contraste/[0.08] md:pt-[var(--fib-34)]",
      )}
    >
      {!depliee && <CouvertureDimanche j={j} journee={journee} c={chapitre} />}
      {videos.length > 0 && <VideosDuFil videos={videos} className="md:col-span-full md:mx-auto md:w-full md:max-w-[560px]" />}
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
        {avant}
        {scenes.map((a, i) => (
          <CouvertureRubrique.Provider key={a.id} value={rubriques[i]}>
            <RubriqueActu a={a} />
          </CouvertureRubrique.Provider>
        ))}
      </div>
    </section>
  );
}

/**
 * La couverture d'un dimanche, bord à bord : la photo, et dessus, en bas,
 * J8 en grand, sa date, ses matchs et ses buts. Rien d'autre : c'est la
 * respiration entre deux dimanches. Toujours sur le noir de la photo, en
 * mode clair aussi.
 */
function CouvertureDimanche({ j, journee, c }: { j: number; journee?: Journee; c: Couverture }) {
  const { src, srcSet } = sources(c);
  const matchs = journee?.matches ?? [];
  const buts = matchs.reduce((s, m) => s + m.teamA.score + m.teamB.score, 0);
  const ligne = matchs.length ? `${matchs.length} ${matchs.length > 1 ? "matchs" : "match"} · ${buts} ${buts > 1 ? "buts" : "but"}` : null;
  return (
    <header className="dark relative isolate mb-2 flex aspect-[4/5] max-h-[76svh] w-full flex-col justify-end overflow-hidden bg-black text-white md:col-span-full md:mb-0 md:aspect-[21/8] md:max-h-none md:rounded-3xl">
      {/* eslint-disable-next-line @next/next/no-img-element -- une image fixe du moodboard, en srcset */}
      <img
        src={src}
        srcSet={srcSet}
        sizes="(min-width: 1280px) 1320px, 100vw"
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 -z-10 size-full object-cover"
        style={{ objectPosition: c.point }}
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0)_45%,rgba(0,0,0,0.85)_100%)]" />
      <div className="flex items-end justify-between gap-4 px-5 pb-5 md:px-8 md:pb-7">
        <h2 className="text-[88px] leading-[0.8] tracking-tight md:text-[120px]" style={{ fontFamily: ANTON }}>
          {`J${j}`}
        </h2>
        <div className="flex flex-col items-end gap-1 pb-1 text-right">
          <span className="mono-label text-white/70">{journee?.date}</span>
          {ligne && <span className="mono-label text-white/45">{ligne}</span>}
        </div>
      </div>
    </header>
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

// La toile des pépites (three.js) : chargée à part, seulement sur le client.
const PepitesFlottantes = dynamic(() => import("@/components/sfl/pepites-flottantes").then((m) => m.PepitesFlottantes), {
  ssr: false,
});

/**
 * Le podium de la Pépite d'Or, en tête de l'onglet (Sabri, 26/10 : « le
 * délire des pépites d'or […] il ne faut pas le perdre de vue ») : les trois
 * premiers (de la D1 quand la ligue a ses divisions), le premier en grande
 * carte au milieu, le deuxième et le troisième en moyennes de part et
 * d'autre (le nombre d'or), et autour d'eux de vraies pépites d'or qui
 * flottent sur des anneaux gravés (pepites-flottantes.tsx). La rangée qui
 * suit reste centrée sur toi : le podium est toujours à l'écran, elle non.
 */
function PodiumPepite({
  podium,
  def,
  division,
  journees,
  cle,
}: {
  podium: (Player & { value: number; place: number })[];
  def: Categorie;
  division?: Division;
  cle?: string;
  /** Ses journées jouées, à côté des points (comme la colonne J de la Ligue 1). */
  journees: (p: Player) => number;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const premier = useRef<HTMLDivElement>(null);
  const [repere, setRepere] = useState<Repere | null>(null);
  useEffect(() => {
    const b = boite.current;
    const c = premier.current;
    if (!b || !c) return;
    const mesurer = () => {
      const rb = b.getBoundingClientRect();
      const rc = c.getBoundingClientRect();
      const r = { x: rc.left - rb.left + rc.width / 2, y: rc.top - rb.top + rc.height / 2, demiHauteur: rc.height / 2 };
      setRepere((v) => (v && Math.abs(v.x - r.x) < 0.5 && Math.abs(v.y - r.y) < 0.5 && v.demiHauteur === r.demiHauteur ? v : r));
    };
    const o = new ResizeObserver(mesurer);
    o.observe(b);
    o.observe(c);
    return () => o.disconnect();
  }, []);
  // Le deuxième à gauche, le premier au milieu, le troisième à droite.
  const ordre = [podium[1], podium[0], podium[2]].filter(Boolean);
  return (
    <div ref={boite} className="relative isolate mx-5 pt-[60px] md:mx-0">
      {repere && <PepitesFlottantes repere={repere} className="absolute inset-0 -z-10" />}
      <div className="flex items-end justify-center gap-[var(--fib-13,13px)]">
        {ordre.map((p) => {
          const un = p === podium[0];
          const rang = `${p.place === 1 ? "1er" : `${p.place}e`}`;
          return (
            <div key={p.name} className="flex flex-col items-center gap-1">
              <div ref={un ? premier : undefined}>
                <MiniCarte
                  player={p}
                  size={un ? FORMAT_CARTE.grande : FORMAT_CARTE.moyenne}
                  detail={`${division ? `${rang} de la ${nomDivision(division)}` : rang} · ${p.value} ${unite(def, p.value)}`}
                  cle={cle && `${cle}-${p.name}`}
                />
              </div>
              <span className={cn("leading-none", un ? "text-titre-g" : "text-titre-fort")} style={{ fontFamily: ANTON }}>
                {p.place}
              </span>
              <span className={cn("truncate font-semibold", un ? "max-w-[127px] text-corps" : "max-w-[80px] text-legende")}>
                <Nom n={p.name} />
              </span>
              <span className="mono-label text-etiquette text-encre-3 tabular-nums">
                {p.value} {unite(def, p.value)} · {journees(p)} J
              </span>
            </div>
          );
        })}
      </div>
    </div>
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
  avecPodium = true,
}: {
  moi: string;
  def?: Categorie;
  /** Les joueurs classés ; par défaut, ceux de la saison. */
  joueurs?: Player[];
  figee?: boolean;
  /** La clé 3D de cartes qui ne sont pas les actuelles (une saison close, la carrière). */
  cle?: string;
  /** Le podium et ses pépites au-dessus de la rangée (l'onglet Classement) ; le fil des Actus n'a que la rangée. */
  avecPodium?: boolean;
}) {
  const { players, saison, evolution } = useSeason();
  const rang = rankByMetric(joueurs ?? players, def.value).filter(
    (p) => def.showAll || p.value > 0,
  );
  // Les journées jouées de chacun, à côté des points ; dans la carrière, ses matchs.
  const { journees: parJoueur } = useJourneesDuClassement();
  const journees = (p: Player) => (joueurs ? p.matchs : (parJoueur.get(p.name) ?? 0));
  // La Pépite d'Or de la saison, coupée en divisions dès qu'elle en a (Sabri,
  // 25/10 : « il faut que les divisions soient visibles ») : chaque division
  // sur son métal, ses places comptées depuis 1, son podium à l'écrin.
  const decoupage = useDecoupageClassement();
  const groupes = decoupage && !joueurs && def.id === PEPITE.id ? parDivision(decoupage, rang) : null;
  // L'ordre des cartes à l'écran, d'une division à l'autre : d'où chacune glisse.
  const ordre = new Map((groupes?.flatMap((g) => g.joueurs) ?? []).map((p, i) => [p.name, i]));
  // Le classement d'avant le dernier dimanche joué : d'où chacun vient.
  const avant = useMemo(() => {
    if (figee) return null;
    // La même saison et la même règle que le classement (rangs.ts) : sinon la
    // flèche compte comme une place gagnée un titre voté ou un masqué.
    const jouees = saison.journees.map((m) => m.j).filter((j) => journeeJouee(saison, j));
    const d = Math.max(0, ...jouees);
    if (!d) return null;
    const precedente = Math.max(0, ...jouees.filter((j) => j < d));
    return standingsJusqua(saison, precedente, evolution);
  }, [saison, figee, evolution]);
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
        // Mesuré à l'écran : dans une division, la carte n'est plus un enfant direct de la rangée.
        left:
          el.getBoundingClientRect().left -
          ref.current.getBoundingClientRect().left +
          ref.current.scrollLeft -
          ref.current.clientWidth / 2 +
          el.clientWidth / 2,
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
  // Une carte de la rangée : sa place (dans sa division, s'il y en a), la carte, le nom, les points.
  const carte = (p: (typeof rang)[number], i: number, place: number | null, x?: Division) => {
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
      {place != null && <Ecrin rang={place} />}
      <span
        className="text-titre-fort leading-none"
        style={{ fontFamily: ANTON }}
      >
        {place ?? "–"}
      </span>
      <MiniCarte
        player={p}
        size={TAILLE}
        detail={`${place == null ? nomDivision(x ?? 3) : x ? `${place === 1 ? "1er" : `${place}e`} de la ${nomDivision(x)}` : `${place}e`} · ${p.value} ${unite(def, p.value)}`}
        cle={cle && `${cle}-${p.name}`}
      />
      <span className="max-w-[80px] truncate text-legende font-semibold">
        <Nom n={p.name} />
      </span>
      <span className="mono-label text-etiquette text-encre-3 tabular-nums">
        {p.value} {unite(def, p.value)} · {journees(p)} J
      </span>
      <span
        className={cn(
          "mono-label h-3 text-etiquette tabular-nums transition-opacity delay-700 duration-500",
          delta > 0 ? "text-primary" : "text-encre-3",
          pose ? "opacity-100" : "opacity-0",
        )}
      >
        {delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${-delta}` : ""}
      </span>
    </div>
    );
  };
  // Le podium : les trois premiers de la D1, ou de tout le classement.
  const podium = (groupes ? groupes[0].joueurs : rang.map((p) => ({ ...p, place: p.rank })))
    .filter((p): p is typeof p & { place: number } => p.place != null && p.place <= 3)
    .slice(0, 3);
  return (
    <>
    {avecPodium && podium.length === 3 && <PodiumPepite podium={podium} def={def} division={groupes?.[0].x} cle={cle} journees={journees} />}
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
        {groupes
          ? groupes.map((g) => (
              // Une division : son métal, ce qu'elle compte, puis ses cartes.
              <div
                key={g.x}
                className={cn("flex shrink-0 flex-col gap-1 rounded-[22px] px-1 pt-2.5 pb-0.5 ring-1 ring-inset", METAL[g.x].voile)}
              >
                {/* « D1 · 31 joueurs » reste à l'écran tant qu'on parcourt sa division. */}
                <div className="sticky left-2 flex w-fit items-center gap-2 px-2">
                  <PastilleDivision x={g.x} className="h-[24px] min-w-[36px] text-lecture" />
                  <span className="mono-label text-etiquette text-encre-2 tabular-nums">
                    {g.joueurs.length} {g.joueurs.length > 1 ? "joueurs" : "joueur"}
                  </span>
                </div>
                <div className="flex items-end gap-1">{g.joueurs.map((p) => carte(p, ordre.get(p.name) ?? 0, p.place, g.x))}</div>
              </div>
            ))
          : rang.map((p, i) => carte(p, i, p.rank))}
      </div>
    </div>
    </>
  );
}

/** La convocation du prochain dimanche, dans le fil : qui vient, et ta réponse d'un geste. */
function Convocation({ p, className }: { p: ReturnType<typeof usePresence>; className?: string }) {
  const { saison, divisions } = useSeason();
  const { me } = useMyPlayer();
  // Un joueur Bola (hors de la saison) n'est pas convoqué.
  const bola = useJoueurBola();
  const [maintenant] = useState(() => new Date());
  const derniere = p.journee === J_DECOUPAGE && annonceEnCours(saison, maintenant);
  // Dès la J4, la division où l'on joue ce dimanche-là.
  const etat = useMemo(() => divisionsDeLaJournee(saison, p.journee, divisions), [saison, p.journee, divisions]);
  const division = etat && !isHidden(me) ? (etat.actuelle.get(me) ?? 3) : null;
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
          {derniere && <span className="mono-label mb-1 text-etiquette text-encre-2 dark:text-white/60">Dernier dimanche sans divisions</span>}
          {division && <span className="mono-label mb-1 text-etiquette text-encre-2 dark:text-white/60">Tu joues en {nomDivision(division)}</span>}
          <span className="text-titre font-bold">{p.jour}</span>
          <span className="truncate text-corps text-encre-3 dark:text-white/55">
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
        <span className="mono-label text-encre-3 dark:text-white/50">
          {p.presents.length} {p.presents.length > 1 ? "viennent" : "vient"}
        </span>
      </div>
      {p.presents.length > 0 && <QuiVient noms={p.presents} size={FORMAT_CARTE.petite * 1.2} />}
      {/* Ta réponse, d'un glissé jusqu'au bout : elle se scelle (reponse-scellee.tsx). */}
      {p.suspendu ? (
        <Suspendu j={p.suspendu.j} taille="sm" />
      ) : (
        <ReponseScellee
          taille="sm"
          mine={p.mine}
          ouvert={p.reponsesOuvertes}
          libelles={{ absent: "Je passe" }}
          onRepondre={p.answer}
        />
      )}
    </section>
  );
}

/**
 * Le dimanche en direct : le jour du match, la feuille se remplit sous tes
 * yeux (la base pousse chaque saisie). Lue sur le direct (journeesDirect),
 * elle reste là tant que la journée jouée ne compte pas (revelation.ts).
 */
function EnDirect({ ouvrir, sauf }: { ouvrir: (j: number) => void; sauf?: number }) {
  const { journeesDirect: journees, saisonLue } = useSeason();
  const [maintenant] = useState(() => new Date());
  const live = journees.find(
    (j) =>
      (j.matches?.length ?? 0) > 0 &&
      (estLeJour(j.date, maintenant) || (journeeJouee(saisonLue, j.j) && !journeeComptee(saisonLue, j.j, maintenant)))
  );
  // Le dimanche en tête du fil a déjà son terrain, qui se remplit de même.
  if (!live || live.j === sauf) return null;
  return (
    <section className="flex flex-col gap-3 px-5 md:px-0">
      <span className="flex items-center gap-2">
        <span className="relative flex size-2.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-70 motion-reduce:animate-none" />
          <span className="relative size-2.5 rounded-full bg-red-500" />
        </span>
        <span className="mono-label text-encre-2">En direct · J{live.j}</span>
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
  { id: "fil", label: "Actus" },
  { id: "classements", label: "Classement" },
  { id: "matchs", label: "Match" },
];

/** Le Wall of Fame n'a pas de matchs, et son premier onglet est la Pépite d'Or de la carrière. */
const VUES_WOF: { id: Vue; label: string }[] = [
  { id: "fil", label: "Pépite d'Or" },
  { id: "classements", label: "Classement" },
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
                "flex-1 px-4 py-2 text-corps font-semibold whitespace-nowrap md:flex-none md:px-6",
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

/** Une étape du fil : le dimanche qui se prépare, puis chaque dimanche joué. */
interface Etape {
  /** L'ancre de sa section (#j4). */
  id: string;
  label: string;
  /** « à venir », ou la date du dimanche. */
  sous: string | null;
}

/**
 * Le rail des journées, collé en haut pendant qu'on parcourt le fil (Sabri,
 * 26/10 : que ce soit « facile […] de bien s'y retrouver », « en
 * reconnaissance des différentes journées ») : J4 à venir, puis J3, J2, J1.
 * Celle qu'on lit est à l'encre pleine ; en toucher une y descend.
 */
function RailJournees({ etapes, deplier }: { etapes: Etape[]; deplier?: (id: string) => void }) {
  const [active, setActive] = useState(etapes[0]?.id);
  const rail = useRef<HTMLDivElement>(null);
  const cles = etapes.map((e) => e.id).join("|");
  useEffect(() => {
    const scroll = document.getElementById("app-scroll");
    if (!scroll) return;
    let image = 0;
    const lire = () => {
      image = 0;
      // La dernière section dont le haut est passé sous le rail.
      const haut = scroll.getBoundingClientRect().top + 72;
      let ici = cles.split("|")[0];
      for (const id of cles.split("|")) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= haut) ici = id;
      }
      setActive((a) => (a === ici ? a : ici));
    };
    const surDefilement = () => {
      if (!image) image = requestAnimationFrame(lire);
    };
    lire();
    scroll.addEventListener("scroll", surDefilement, { passive: true });
    return () => {
      scroll.removeEventListener("scroll", surDefilement);
      if (image) cancelAnimationFrame(image);
    };
  }, [cles]);
  // La puce de la journée lue reste dans le rail.
  useEffect(() => {
    const r = rail.current;
    const b = r?.querySelector<HTMLElement>(`[data-etape="${active}"]`);
    if (!r || !b) return;
    const gauche = b.offsetLeft - 20;
    const droite = b.offsetLeft + b.offsetWidth + 20 - r.clientWidth;
    if (r.scrollLeft > gauche) r.scrollTo({ left: gauche, behavior: "smooth" });
    else if (r.scrollLeft < droite) r.scrollTo({ left: droite, behavior: "smooth" });
  }, [active]);
  const aller = (id: string) => {
    const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Une journée d'avant se déplie d'abord : on arrive sur elle, et on peut la parcourir.
    deplier?.(id);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start", behavior: calme ? "auto" : "smooth" })),
    );
  };
  if (etapes.length < 2) return null;
  return (
    <nav
      aria-label="Journées"
      className="sticky top-0 z-30 -my-3 border-b border-foreground/[0.08] bg-background/85 backdrop-blur-xl md:-my-[var(--fib-13,13px)] md:rounded-full md:border md:px-1.5"
    >
      <div ref={rail} className="flex gap-1.5 overflow-x-auto px-5 py-2 [scrollbar-width:none] md:px-0">
        {etapes.map((e) => {
          const ici = e.id === active;
          return (
            <button
              key={e.id}
              type="button"
              data-etape={e.id}
              aria-current={ici ? "true" : undefined}
              onClick={() => aller(e.id)}
              className={cn(
                "flex h-9 shrink-0 items-baseline gap-1.5 rounded-full px-3.5 pt-[7px] transition-colors duration-300",
                ici ? "bg-foreground text-background" : "text-encre-3 ring-1 ring-foreground/[0.12] ring-inset",
              )}
            >
              <span className="text-titre leading-none" style={{ fontFamily: ANTON }}>
                {e.label}
              </span>
              {e.sous && <span className={cn("mono-label text-etiquette", ici ? "text-background/65" : "text-encre-3")}>{e.sous}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Vendredi ou samedi, heure de Paris : les deux jours avant le match. */
function veilleDuMatch(d: Date): boolean {
  const jour = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", weekday: "short" }).format(d);
  return jour === "Fri" || jour === "Sat";
}

/**
 * La saison en cours : la course, la semaine, puis chaque dimanche joué.
 *
 * Sabri, 26/10, pour ranger les Actus :
 *   · on arrive toujours en haut de l'onglet : les trois onglets, la rangée
 *     de la Pépite d'Or, puis la convocation et sa météo, la première chose
 *     du fil ;
 *   · le grand classement en divisions et ses règles sortent du fil : la
 *     rangée de la Pépite d'Or garde « D1 · 31 joueurs » sur chaque division ;
 *   · des missions, le fil ne garde que le contrat à la une (un seul rang S
 *     signé par un bon joueur, le vendredi et le samedi ; Sabri, 27/10) ; le
 *     reste, l'outsider compris, est dans le Mode Passe (Ma carte, Niveau XP,
 *     Missions et Les autres) ;
 *   · chaque vidéo se range dans le fil de son dimanche (journeeDeLaVideo).
 */
function EpoqueEnCours({ epoques, vue, onVue, classement, exploit }: PropsEpoque & { exploit?: string | null }) {
  const { saison, saisonTitree, journees } = useSeason();
  const { me } = useMyPlayer();
  const router = useRouter();
  // On arrive en haut de l'onglet, sauf quand l'adresse vise un endroit du fil.
  useEffect(() => {
    if (exploit || /^#(j\d+|divisions)$/.test(window.location.hash)) return;
    document.getElementById("app-scroll")?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [exploit]);
  // La rubrique d'un exploit, une fois les terrains mesurés.
  useEffect(() => {
    if (!exploit) return;
    const t = setTimeout(() => {
      const el = [...document.querySelectorAll<HTMLElement>("[data-exploits]")].find((x) => x.dataset.exploits?.split("|").includes(exploit));
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 450);
    return () => clearTimeout(t);
  }, [exploit]);
  const titree = saisonTitree ?? saison;
  const { fil, v, duels } = useMemo(
    () => ({ fil: filDeSaison(titree, journees, me, true), v: voisins(saison, me), duels: enjeux(saison) }),
    [saison, titree, journees, me]
  );
  // Les dimanches joués, du plus récent : le terrain, puis les scènes.
  const dimanches = useMemo(() => {
    const js = [...new Set(fil.map((a) => a.j))];
    return js.map((j) => ({ j, journee: journees.find((x) => x.j === j), scenes: fil.filter((a) => a.j === j && SCENES.includes(a.type)) }));
  }, [fil, journees]);
  // Chaque vidéo dans le fil de son dimanche ; celles d'aucun dimanche joué, en tête.
  const videos = useVideos();
  const videosDe = useMemo(() => {
    const m = new Map<number | null, Video[]>();
    const joues = new Set(dimanches.map((d) => d.j));
    for (const x of videos) {
      const j = journeeDeLaVideo(x, saison.journees);
      const cle = j != null && joues.has(j) ? j : null;
      m.set(cle, [...(m.get(cle) ?? []), x]);
    }
    return m;
  }, [videos, dimanches, saison.journees]);
  const [maintenant] = useState(() => new Date());
  const veille = veilleDuMatch(maintenant);

  const dernier = dimanches[0]?.j ?? 0;
  const une = dimanches[0];
  const avantes = dimanches.slice(1);
  const [semaine, semaineCollante] = useCollant();
  // Les journées d'avant, repliées ; dépliées une à une (leur ligne, le rail, #j2, un exploit).
  const [ouvertes, setOuvertes] = useState<ReadonlySet<number>>(() => new Set());
  const deplier = (id: string) => {
    const m = /^j(\d+)$/.exec(id);
    const j = m ? Number(m[1]) : null;
    if (j == null || !avantes.some((d) => d.j === j)) return;
    setOuvertes((o) => (o.has(j) ? o : new Set(o).add(j)));
  };
  const basculer = (j: number) =>
    setOuvertes((o) => {
      const n = new Set(o);
      if (!n.delete(j)) n.add(j);
      return n;
    });
  // Une adresse en #j2 déplie ce dimanche avant que useAncre y descende.
  useEffect(() => {
    const m = /^#j(\d+)$/.exec(window.location.hash);
    if (!m) return;
    const t = setTimeout(() => setOuvertes((o) => new Set(o).add(Number(m[1]))), 0);
    return () => clearTimeout(t);
  }, []);
  // La félicitation d'un exploit peut viser une journée d'avant : tout est déplié.
  const deplie = (j: number) => !!exploit || ouvertes.has(j);
  useAncre(vue === "fil" && dimanches.length > 0);
  // Le dimanche qui se prépare (celui de la convocation), s'il n'est pas déjà joué.
  const presence = usePresence();
  const prochain = presence.journee;
  const aVenir = prochain > 0 && !dimanches.some((d) => d.j === prochain);
  // Le dimanche soir et jusqu'au mercredi, le dernier dimanche passe devant : on vient voir ce qui
  // s'est passé (le journal d'activité : trois quarts du temps passé dans l'app, du lundi au
  // mercredi). Du jeudi au dimanche du match, la semaine qui se prépare passe devant.
  const [aujourdhui] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date()));
  const isoDernier = une?.journee?.date ? dateIsoDuLibelle(une.journee.date, aujourdhui) : null;
  const ecart = isoDernier ? joursJusquA(isoDernier, aujourdhui) : null;
  const recapDabord = ecart != null && ecart <= 0 && ecart >= -3;
  const etapeSemaine: Etape = { id: aVenir ? `j${prochain}` : "semaine", label: aVenir ? `J${prochain}` : "Semaine", sous: aVenir ? "à venir" : null };
  const etapeUne: Etape[] = une ? [{ id: `j${une.j}`, label: `J${une.j}`, sous: une.journee?.date ?? null }] : [];
  const etapes: Etape[] = [
    ...(recapDabord ? [...etapeUne, etapeSemaine] : [etapeSemaine, ...etapeUne]),
    ...avantes.map((d) => ({ id: `j${d.j}`, label: `J${d.j}`, sous: d.journee?.date ?? null })),
  ];

  const leDernier = une && (
    <Dimanche
      j={une.j}
      journee={une.journee}
      scenes={une.scenes}
      videos={videosDe.get(une.j)}
      avant={
        <>
          {/* Le soir du match, le vote est dans son dimanche, juste après la feuille. */}
          {recapDabord && <VoteDuJour me={me} />}
          {/* Le vote fini, la révélation : les divisions après la journée (revelation.ts). */}
          <DivisionsApres j={une.j} me={me} />
          <RubriqueToi j={dernier} date={une.journee?.date ?? ""} />
          {/* Mon Flair de ce dimanche, jugé (Sabri, 30/10). */}
          <RubriqueFlair j={une.j} />
        </>
      }
      ouvrir={() => router.push(`/ligue/journee?j=${une.j}`)}
    />
  );
  // Le dimanche qui se prépare. Sur téléphone, un seul fil : la convocation et sa météo (tant
  // que son dimanche n'est pas joué), le vote, la vidéo sans dimanche, le contrat à la une
  // (vendredi et samedi, s'il y en a un), puis ce qui se joue. Sur grand écran, deux colonnes :
  // à gauche ce qui se joue, à droite le contrat à la une et les enjeux.
  const laSemaine = (
    <div
      id={etapeSemaine.id}
      className="flex scroll-mt-[60px] flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-[var(--fib-21)] xl:grid-cols-3"
    >
      <div
        ref={semaine}
        className={cn("contents md:flex md:flex-col md:gap-[var(--fib-21)]", semaineCollante && "md:sticky md:top-[var(--fib-21)]")}
      >
        {aVenir && <Convocation p={presence} />}
        {!recapDabord && <VoteDuJour me={me} />}
        <VideosDuFil videos={videosDe.get(null) ?? []} />
      </div>
      <div className="contents md:grid md:gap-[var(--fib-21)] xl:col-span-2 xl:grid-cols-2">
        {veille && <ContratALaUne />}
        <div className="flex flex-col gap-1 md:contents">
          {duels.length > 0 && <RubriqueEnjeux liste={duels} moi={me} />}
          {v && <RubriqueRival v={v} />}
          {v?.devant && <RubriqueBesoin v={v} />}
        </div>
      </div>
    </div>
  );

  return (
    <div className={GABARIT}>
      <EnTete titre="Actus" epoque="present" epoques={epoques} vue={vue} onVue={onVue}>
        {/* La rangée de la Pépite d'Or reste en tête du fil (Sabri, 26/10 : « remettre le classement qu'on avait tout en
            haut avec toutes les cartes ») ; son podium et ses pépites, en tête de Classement. */}
        {vue === "fil" && <Ticker moi={me} avecPodium={false} />}
        {vue === "classements" && <Ticker moi={me} />}
      </EnTete>
      {vue === "classements" ? (
        <VueClassements vote={<VoteDuJour me={me} />} classement={classement} />
      ) : vue === "matchs" ? (
        <VueMatchs />
      ) : (
        <>
          <RailJournees etapes={etapes} deplier={deplier} />
          {/* Le jour du match, la feuille qui se remplit, avant tout le reste. */}
          {/* Son lien mène à la feuille en direct (la Map), pas au récap, qui attend la révélation. */}
          <EnDirect ouvrir={() => router.push("/map")} sauf={recapDabord ? une?.j : undefined} />
          {recapDabord ? (
            <>
              {leDernier}
              {laSemaine}
            </>
          ) : (
            <>
              {laSemaine}
              {leDernier}
            </>
          )}
          {avantes.length > 0 && (
            <section aria-label="Les journées d'avant" className="flex flex-col md:border-t md:border-contraste/[0.08] md:pt-[var(--fib-34)]">
              <h2 className="mono-label px-5 pb-2 text-encre-3 md:px-0">Les journées d&apos;avant</h2>
              {avantes.map((d) => (
                <JourneeDAvant
                  key={d.j}
                  d={d}
                  ouverte={deplie(d.j)}
                  basculer={() => basculer(d.j)}
                  videos={videosDe.get(d.j)}
                  ouvrir={() => router.push(`/ligue/journee?j=${d.j}`)}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Une journée d'avant, repliée sur une ligne (Sabri, 31/10 : « plus je
 * scrolle, plus je découvre », pas revenir sur ce qu'on connaît déjà) : J4,
 * sa date, ses matchs et ses buts. La toucher la déplie sur place, avec son
 * terrain, ton Flair et ses rubriques ; la retoucher la replie. La ligne
 * porte l'ancre (#j4) que visent le rail et Ma saison.
 */
function JourneeDAvant({
  d,
  ouverte,
  basculer,
  videos,
  ouvrir,
}: {
  d: { j: number; journee?: Journee; scenes: Actu[] };
  ouverte: boolean;
  basculer: () => void;
  videos?: Video[];
  ouvrir: () => void;
}) {
  const matchs = d.journee?.matches ?? [];
  const buts = matchs.reduce((n, m) => n + m.teamA.score + m.teamB.score, 0);
  const ligne = matchs.length ? `${matchs.length} ${matchs.length > 1 ? "matchs" : "match"} · ${buts} ${buts > 1 ? "buts" : "but"}` : null;
  return (
    <div id={`j${d.j}`} className="flex scroll-mt-[60px] flex-col">
      <button
        type="button"
        aria-expanded={ouverte}
        onClick={basculer}
        className="mx-5 flex items-end gap-4 border-t border-foreground/[0.08] py-3.5 text-left md:mx-0"
      >
        <span className="w-[72px] text-[44px] leading-[0.8] tracking-tight" style={{ fontFamily: ANTON }}>
          {`J${d.j}`}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1 pb-0.5">
          <span className="mono-label text-encre-2">{d.journee?.date}</span>
          {ligne && <span className="mono-label text-encre-3">{ligne}</span>}
        </span>
        <ChevronDown
          aria-hidden
          className={cn("mb-1 size-5 shrink-0 text-encre-3 transition-transform duration-300 motion-reduce:transition-none", ouverte && "rotate-180")}
          strokeWidth={1.8}
        />
      </button>
      {ouverte && (
        <div className="pb-6">
          <Dimanche
            j={d.j}
            journee={d.journee}
            scenes={d.scenes}
            videos={videos}
            depliee
            avant={<RubriqueFlair j={d.j} />}
            ouvrir={ouvrir}
          />
        </div>
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
        <p className="px-5 text-ligne text-muted-foreground md:px-0">Cette saison n&apos;est pas dans les archives.</p>
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
        {vue === "fil" && <Ticker moi={me} figee cle={`saison-${numero}`} avecPodium={false} />}
        {vue === "classements" && <Ticker moi={me} figee cle={`saison-${numero}`} />}
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
      <EnTete titre="Wall of Fame" epoque="palmares" epoques={epoques} vue={ici} onVue={onVue} vues={VUES_WOF}>
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
