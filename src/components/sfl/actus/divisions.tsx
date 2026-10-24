"use client";

// Les divisions dans les Actus, en classement. Sabri, 24/10 : « Fais-nous une
// interface où on voit un classement, limite avec des divisions […]
// surlignés d'une autre couleur. Je veux comprendre que c'est un classement
// […] le classement pépites d'or, bien sûr ».
//
// Le Pépite d'Or de la saison, du premier au dernier classé, coupé en trois
// bandes : la D1 à l'or, la D2 à l'argent, la D3 au bronze (les métaux des
// trophées, badge-3d.tsx). Chaque division compte ses places depuis 1 : le
// premier de la D2 est 1er, pas 31e (Sabri, 24/10 : « chaque division a son
// premier, son deuxième, son troisième, et c'est sa récompense à elle ») ;
// ses trois premiers, son podium, portent leur place sur le métal de leur
// division. Chaque ligne : la place, la carte (petite), le nom, les points ;
// la tienne se détache. Repliée, chaque division montre son podium, toi, et
// sa dernière place, celle qu'on défend ; entre les deux, combien on en
// saute, et « Tout le classement » déplie le reste. Une D1 ou une D2 pas
// encore pleine compte ses places libres.
//
// Trois temps, ceux du moteur (lib/sfl/divisions.ts) :
//   · jusqu'au soir de la J3, l'annonce : « Dernier dimanche sans
//     divisions », le classement de ce soir coupé comme il le serait (le
//     dimanche même, la feuille le refait à mesure qu'elle se remplit) ;
//   · la J3 jouée, jusqu'à la J4 : « Trois divisions pour la J4 » ;
//   · chaque dimanche joué en divisions, le bilan : « Les divisions après la
//     J4 », le classement du soir. Ceux qui viennent de changer de division
//     sont montrés d'office, leur flèche (↑ ↓) et leurs points du dimanche
//     sous le nom.
// Pas de plage ni de seuil (Sabri, 24/10) : chaque dimanche, le classement
// refait les divisions. Dessous, ce qui se joue dès la J4, puis chaque
// dimanche.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import {
  decoupageAnnonce,
  decouper,
  dernierBilan,
  DIVISIONS,
  editionAnnonce,
  enPoints,
  etatDivisions,
  J_DECOUPAGE,
  nomDivision,
  phraseAnnonce,
  phraseBilan,
  rangDansDivision,
  REGLES_DIVISIONS,
  type BilanDivisions,
  type Decoupage,
  type Division,
  type PlaceDecoupage,
} from "@/lib/sfl/divisions";
import { isHidden } from "@/lib/sfl/hidden";
import { preparerPiece, type PieceLigue } from "@/lib/sfl/vestiaire";
import { cn } from "@/lib/utils";
import { ANTON } from "./ecran";
import { pl, useJoueurs } from "./cinematiques";

/** Le podium de chaque division, toujours montré : ses trois premiers. */
const TETE = 3;
/** Au bilan, ceux qui viennent d'arriver dans une division, montrés d'office (les mieux classés). */
const ARRIVEES = 3;
/** Sur grand écran, le classement et ses règles dessous ne font qu'une carte. */
const CADRE = "scroll-mt-4 md:overflow-hidden md:rounded-3xl";

/**
 * Le métal de chaque division : son dégradé poli (badge-3d.tsx, POLI), son
 * encre, et le voile de sa bande, plus vif en haut, avec son liseré, en clair
 * comme en sombre.
 */
const METAL: Record<Division, { poli: string; encre: string; voile: string }> = {
  1: {
    poli: "linear-gradient(140deg, #f7e3a6 0%, #b8862b 48%, #f3d48a 72%, #8a6416 100%)",
    encre: "#2b1d02",
    voile:
      "bg-[linear-gradient(180deg,rgba(217,165,49,0.24),rgba(217,165,49,0.07))] ring-[#d9a531]/30 dark:bg-[linear-gradient(180deg,rgba(255,200,80,0.17),rgba(255,200,80,0.04))] dark:ring-[#f4cd6a]/20",
  },
  2: {
    poli: "linear-gradient(140deg, #ffffff 0%, #8f959d 48%, #e9ebee 72%, #6d737b 100%)",
    encre: "#15171a",
    voile:
      "bg-[linear-gradient(180deg,rgba(130,140,155,0.22),rgba(130,140,155,0.06))] ring-[#8f959d]/30 dark:bg-[linear-gradient(180deg,rgba(214,224,240,0.13),rgba(214,224,240,0.03))] dark:ring-[#dfe3ea]/15",
  },
  3: {
    poli: "linear-gradient(140deg, #f0c09a 0%, #8f4f22 48%, #e2a77c 72%, #6a3815 100%)",
    encre: "#2a1608",
    voile:
      "bg-[linear-gradient(180deg,rgba(194,110,55,0.22),rgba(194,110,55,0.06))] ring-[#c27a43]/30 dark:bg-[linear-gradient(180deg,rgba(226,128,64,0.17),rgba(226,128,64,0.04))] dark:ring-[#d9773a]/20",
  },
};

/** « 1er », « 17e » : une place au classement. */
const rangTexte = (n: number) => (n === 1 ? "1er" : `${n}e`);
/** Les places d'une division : 30 pour la D1 et la D2, la D3 prend les autres. */
const placesDe = (x: Division) => (x < 3 ? `${REGLES_DIVISIONS.taille} places` : "les autres");
/** Sous une division : ses joueurs ; vide, ses places. */
const quiDans = (x: Division, n: number) => (n > 0 ? `${n} ${pl(n, "joueur", "joueurs")}` : placesDe(x));
/** « +9 », « −2 », « 0 » : les points d'un dimanche. */
const signe = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

/**
 * Les places encore libres d'une division : ce qu'il lui manque pour faire
 * ses 30. Les ex æquo de la 30e place, tous en D1, en prennent à la D2 ; la
 * D3 n'a pas de places à compter.
 */
function libres(d: Decoupage, x: Division): number {
  if (x === 3) return 0;
  const { taille } = REGLES_DIVISIONS;
  const devant = DIVISIONS.filter((y) => y < x).reduce((n, y) => n + d.divisions[y].length, 0);
  return Math.max(0, Math.min(taille, x * taille - devant) - d.divisions[x].length);
}

type Ligne = { place: PlaceDecoupage } | { saut: number };

/**
 * Une division repliée : son podium, ex æquo compris, sa dernière place et
 * ceux qu'on garde (toi, les arrivées), et entre eux combien on en saute. Un
 * seul à sauter se montre : un « ⋮ 1 autre » ne fait rien gagner.
 */
function replier(liste: PlaceDecoupage[], garder: Set<string>): Ligne[] {
  const lignes: Ligne[] = [];
  let sautes: PlaceDecoupage[] = [];
  const vider = () => {
    if (sautes.length === 1) lignes.push({ place: sautes[0] });
    else if (sautes.length > 1) lignes.push({ saut: sautes.length });
    sautes = [];
  };
  liste.forEach((place, i) => {
    // Sa place dans la division (rangDansDivision) : liste[0] est son premier.
    if (place.rang - liste[0].rang < TETE || i === liste.length - 1 || garder.has(place.nom)) {
      vider();
      lignes.push({ place });
    } else sautes.push(place);
  });
  vider();
  return lignes;
}

/** Ce qu'un dimanche a fait d'un joueur, sous son nom : sa flèche s'il change de division, ses points. */
function SousLeNom({ bilan, nom }: { bilan: BilanDivisions; nom: string }) {
  const m = bilan.parNom.get(nom);
  if (!m || (!m.joue && m.de === m.vers)) return null;
  const fleche = m.vers < m.de ? "↑" : m.vers > m.de ? "↓" : null;
  return (
    <span className="mono-label flex items-center gap-1.5 text-[9.5px] text-foreground/50 dark:text-white/50">
      {fleche && (
        <span className={fleche === "↑" ? "text-[#1f8a4c] dark:text-[#84d68c]" : "text-[#c8352b] dark:text-[#FF6B5E]"}>
          {`${fleche} de la ${nomDivision(m.de)}`}
        </span>
      )}
      {fleche && m.joue && <span aria-hidden>·</span>}
      {m.joue && <span className="tabular-nums">{`${signe(m.points)} à la J${bilan.j}`}</span>}
    </span>
  );
}

/** La place dans la division : sur le métal de la division pour son podium, en chiffre pour les autres. */
function Place({ x, rang }: { x: Division; rang: number }) {
  if (rang > TETE)
    return <span className="w-7 shrink-0 text-center text-[15px] font-bold text-foreground/40 tabular-nums dark:text-white/40">{rang}</span>;
  return (
    <span className="grid w-7 shrink-0 place-items-center">
      <span
        className="grid size-[26px] place-items-center rounded-full pt-px text-[15px] leading-none shadow-[0_1px_5px_rgba(0,0,0,0.22)]"
        style={{ background: METAL[x].poli, color: METAL[x].encre, fontFamily: ANTON }}
      >
        {rang}
      </span>
    </span>
  );
}

/** Une ligne du classement : la place dans la division, la carte, le nom, les points. */
function LigneJoueur({
  x,
  rang,
  place,
  moi,
  bilan,
  ordre,
}: {
  x: Division;
  /** Sa place dans la division (rangDansDivision). */
  rang: number;
  place: PlaceDecoupage;
  moi: boolean;
  bilan: BilanDivisions | null;
  ordre: number;
}) {
  const joueur = useJoueurs()(place.nom);
  const calme = useReducedMotion();
  if (!joueur) return null;
  return (
    <motion.li
      initial={calme ? false : { opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -24px 0px" }}
      transition={{ duration: 0.32, delay: Math.min(ordre, 6) * 0.04, ease: [0.2, 0.7, 0.2, 1] }}
      className={cn(
        "flex items-center gap-3 rounded-[16px] px-2.5 py-1.5",
        moi && "bg-white/80 shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:bg-white/[0.12] dark:shadow-none",
      )}
    >
      <Place x={x} rang={rang} />
      <MiniCarte player={joueur} size={FORMAT_CARTE.petite} detail={`${rangTexte(rang)} de la ${nomDivision(x)} · ${enPoints(place.pp)}`} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("truncate text-[15px]", moi ? "font-bold" : "font-semibold")}>
          <Nom n={place.nom} />
        </span>
        {bilan && <SousLeNom bilan={bilan} nom={place.nom} />}
      </span>
      <span className="shrink-0 text-right text-[17px] font-bold tracking-tight tabular-nums">
        {place.pp < 0 ? `−${-place.pp}` : place.pp}
        <span className="mono-label ml-1 text-foreground/40 dark:text-white/40">{Math.abs(place.pp) > 1 ? "pts" : "pt"}</span>
      </span>
    </motion.li>
  );
}

/** Ce qu'on saute dans une division repliée : le toucher déplie tout. */
function Saut({ n, deplier }: { n: number; deplier: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={deplier}
        className="flex w-full items-center gap-3 rounded-[14px] px-2.5 py-1 text-left text-foreground/45 transition-colors active:bg-foreground/[0.05] dark:text-white/45 dark:active:bg-white/[0.06]"
      >
        <span className="w-7 shrink-0 text-center text-[15px] leading-none font-bold">⋮</span>
        <span className="mono-label text-[10px]">{`${n} ${pl(n, "autre", "autres")}`}</span>
      </button>
    </li>
  );
}

/** Une division : son métal, ce qu'elle compte, ses places, puis ses lignes. */
function Bande({
  x,
  d,
  lignes,
  entete,
  moi,
  bilan,
  deplier,
}: {
  x: Division;
  d: Decoupage;
  lignes: Ligne[];
  entete: string;
  moi: string | undefined;
  bilan: BilanDivisions | null;
  deplier: () => void;
}) {
  const vides = libres(d, x);
  return (
    <div className={cn("flex flex-col rounded-[22px] pb-1.5 ring-1 ring-inset", METAL[x].voile)}>
      <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-1.5">
        <span
          className="grid h-[28px] min-w-[42px] place-items-center rounded-[9px] px-2 text-[18px] leading-none shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
          style={{ background: METAL[x].poli, color: METAL[x].encre, fontFamily: ANTON }}
        >
          {nomDivision(x)}
        </span>
        <span className="text-[13px] font-semibold text-foreground/75 dark:text-white/75">{entete}</span>
      </div>
      {lignes.length > 0 && (
        <ol className="flex flex-col px-1">
          {lignes.map((l, i) =>
            "saut" in l ? (
              <Saut key={`saut-${i}`} n={l.saut} deplier={deplier} />
            ) : (
              <LigneJoueur
                key={l.place.nom}
                x={x}
                rang={rangDansDivision(d, l.place)}
                place={l.place}
                moi={l.place.nom === moi}
                bilan={bilan}
                ordre={i}
              />
            ),
          )}
        </ol>
      )}
      {(vides > 0 || (x === 3 && lignes.length === 0)) && (
        <span className="mx-3.5 mt-1 mb-2 rounded-[14px] border border-dashed border-foreground/20 px-3 py-2.5 text-[13px] font-semibold text-foreground/55 dark:border-white/20 dark:text-white/55">
          {vides > 0 ? `${vides} ${pl(vides, "place libre", "places libres")}` : "Qui n'a pas encore joué"}
        </span>
      )}
    </div>
  );
}

/**
 * La rubrique : le petit titre et le titre, le classement en divisions, sa
 * ligne (ta place) et le partage au Vestiaire. Le fond est celui des
 * rubriques sur terrain (pelouse.tsx, Scene), en clair comme en sombre.
 */
function Classement({
  sur,
  titre,
  quand,
  d,
  coupe,
  moi,
  bilan,
  texte,
  partage,
}: {
  sur: ReactNode;
  titre: ReactNode;
  /** Le moment du classement : « ce soir », « après la J3 ». */
  quand: string;
  d: Decoupage;
  /** La ligue est coupée : chaque division dit ses joueurs ; avant, ses places. */
  coupe: boolean;
  moi: string | undefined;
  bilan: BilanDivisions | null;
  texte?: ReactNode;
  partage: Omit<PieceLigue, "type">;
}) {
  const router = useRouter();
  const [tout, setTout] = useState(false);
  const deplier = () => setTout(true);
  const parDivision = DIVISIONS.map((x) => {
    const liste = d.divisions[x];
    if (tout) return liste.map((place): Ligne => ({ place }));
    // Toi, et au bilan ceux qui viennent d'arriver dans la division.
    const garder = new Set<string>(moi ? [moi] : []);
    if (bilan)
      liste
        .filter((p) => {
          const m = bilan.parNom.get(p.nom);
          return !!m && m.de !== m.vers;
        })
        .slice(0, ARRIVEES)
        .forEach((p) => garder.add(p.nom));
    return replier(liste, garder);
  });
  const replie = parDivision.some((lignes) => lignes.some((l) => "saut" in l));

  return (
    <section className="relative flex flex-col overflow-hidden bg-[radial-gradient(120%_70%_at_50%_30%,#ffffff_0%,#e8eae5_75%)] text-foreground dark:bg-[radial-gradient(120%_70%_at_50%_30%,#1d2024_0%,#0c0d0f_75%)] dark:text-white">
      <header className="flex flex-col gap-1 px-5 pt-5">
        <span className="mono-label text-[10px] text-foreground/50 dark:text-white/50">{sur}</span>
        <h3 className="titre-lettrage text-[24px] leading-[0.95]">{titre}</h3>
      </header>
      <div className="flex flex-col gap-2 px-3 pt-4">
        <span className="mono-label px-2 text-[10px] text-foreground/50 dark:text-white/50">{`Classement Pépite d'Or · ${quand}`}</span>
        {DIVISIONS.map((x, i) => (
          <Bande
            key={x}
            x={x}
            d={d}
            lignes={parDivision[i]}
            entete={coupe ? quiDans(x, d.divisions[x].length) : placesDe(x)}
            moi={moi}
            bilan={bilan}
            deplier={deplier}
          />
        ))}
        {(replie || tout) && (
          <button type="button" onClick={() => setTout((t) => !t)} className="bouton-discret self-center px-5 py-2.5 text-[13px] font-semibold">
            {tout ? "Replier" : "Tout le classement"}
          </button>
        )}
      </div>
      <div className="flex min-h-11 items-center gap-2 pt-1 pr-1.5 pb-2 pl-5">
        <span className="min-w-0 flex-1 text-[13px] leading-snug text-foreground/70 dark:text-white/70">{texte}</span>
        <button
          type="button"
          aria-label="Partager au Vestiaire"
          onClick={() => {
            preparerPiece({ type: "ligue", ...partage, lignes: partage.lignes.slice(0, 6) });
            router.push("/vestiaire");
          }}
          className="grid size-9 shrink-0 place-items-center rounded-full text-foreground/60 transition-transform active:scale-90 dark:text-white/60"
        >
          <MessageCircle className="size-[18px]" strokeWidth={1.8} />
        </button>
      </div>
    </section>
  );
}

/** Une règle des divisions : un chiffre en grand, ce qu'il veut dire dessous. */
function Regle({ n, quoi }: { n: string; quoi: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-foreground/[0.06] px-3 pt-2.5 pb-3 dark:bg-white/[0.06]">
      <span className="text-[28px] leading-none" style={{ fontFamily: ANTON }}>
        {n}
      </span>
      <span className="text-[12px] leading-tight font-semibold text-foreground/65 dark:text-white/65">{quoi}</span>
    </div>
  );
}

/**
 * Ce qui change dès la J4, sous le classement ; une fois la J4 jouée, ce qui
 * se joue chaque dimanche. Sur le fond du bas de la rubrique, en clair comme
 * en sombre : le classement et ses règles ne font qu'une carte.
 */
function DesLaJ4({ chaqueDimanche = false }: { chaqueDimanche?: boolean }) {
  const { depuis, taille } = REGLES_DIVISIONS;
  return (
    <div className="flex flex-col gap-3 bg-[#e8eae5] px-5 pt-1 pb-6 text-foreground dark:bg-[#0c0d0f] dark:text-white">
      <span className="mono-label text-[10px] text-foreground/50 dark:text-white/50">{chaqueDimanche ? "Chaque dimanche" : `Dès la J${depuis}`}</span>
      {/* Deux par ligne même sur ordinateur : la rubrique y tient dans une colonne d'Actus. */}
      <div className="grid grid-cols-2 gap-2">
        <Regle n={String(taille)} quoi="joueurs par division, les meilleurs en D1" />
        <Regle n="MVP" quoi="Impact et Défensive élus à chaque journée" />
      </div>
      <p className="text-[13px] leading-snug text-foreground/70 dark:text-white/70">
        Après chaque dimanche, le classement refait les divisions : tes points et ceux de tes voisins décident. Tu joues dans ta
        division, les équipes se font toutes seules, au niveau de chacun.
      </p>
    </div>
  );
}

export function RubriqueDivisions({ className }: { className?: string }) {
  const { saison } = useSeason();
  const { me } = useMyPlayer();
  const [maintenant] = useState(() => new Date());
  const edition = editionAnnonce(saison, maintenant);
  const coupee = decoupageAnnonce(saison, maintenant);
  // Après chaque dimanche joué en divisions : le bilan, sur le classement du soir.
  const etat = useMemo(() => (edition || coupee ? null : etatDivisions(saison)), [saison, edition, coupee]);
  const bilan = useMemo(() => dernierBilan(etat), [etat]);
  const d = useMemo(
    () => (bilan && etat ? etat.decoupage : edition || coupee ? decouper(saison, coupee ? J_DECOUPAGE : undefined) : null),
    [saison, edition, coupee, bilan, etat],
  );
  const ref = useRef<HTMLDivElement>(null);
  const present = !!d && d.classes > 0;
  // La notification et l'écran de l'ouverture mènent à /ligue#divisions.
  useEffect(() => {
    if (present && window.location.hash === "#divisions") ref.current?.scrollIntoView({ block: "start" });
  }, [present]);
  if (!d || !present) return null;

  const moi = isHidden(me) || !d.parNom.has(me) ? undefined : me;
  const ma = moi ? d.parNom.get(moi)?.division : undefined;
  const repartition = DIVISIONS.map((x) => ({ l: nomDivision(x), v: quiDans(x, d.divisions[x].length) }));

  if (bilan && etat) {
    const jour = saison.journees.find((m) => m.j === bilan.j);
    const mouvements = `${bilan.montees} ${pl(bilan.montees, "monte", "montent")}, ${bilan.descentes} ${pl(bilan.descentes, "descend", "descendent")}`;
    return (
      <div id="divisions" ref={ref} className={cn(CADRE, className)}>
        <Classement
          sur={`J${bilan.j} · ${jour?.date ?? "dimanche"}`}
          titre={`Les divisions après la J${bilan.j}`}
          quand={`après la J${bilan.j}`}
          d={d}
          coupe
          moi={moi}
          bilan={bilan}
          texte={phraseBilan(etat, bilan, me) ?? mouvements}
          partage={{
            titre: `Les divisions après la J${bilan.j}`,
            j: bilan.j,
            lignes: [...(ma ? [{ n: me, v: nomDivision(ma) }] : []), { l: "Mouvements", v: mouvements }, ...repartition],
          }}
        />
        <DesLaJ4 chaqueDimanche />
      </div>
    );
  }

  const j3 = saison.journees.find((m) => m.j === J_DECOUPAGE);
  const texte = isHidden(me)
    ? undefined
    : coupee
      ? `Tu joues la J${REGLES_DIVISIONS.depuis} en ${nomDivision(ma ?? 3)}`
      : (phraseAnnonce(saison, d, me, edition ?? "avant") ?? undefined);

  return (
    <div id="divisions" ref={ref} className={cn(CADRE, className)}>
      <Classement
        sur={coupee ? `Après la J${J_DECOUPAGE}` : edition === "jour" ? `J${J_DECOUPAGE} · aujourd'hui` : `J${J_DECOUPAGE} · ${j3?.date ?? "dimanche"}`}
        titre={coupee ? `Trois divisions pour la J${REGLES_DIVISIONS.depuis}` : "Dernier dimanche sans divisions"}
        quand={coupee ? `après la J${J_DECOUPAGE}` : edition === "jour" ? "aujourd'hui" : "ce soir"}
        d={d}
        coupe={coupee}
        moi={moi}
        bilan={null}
        texte={texte}
        partage={{
          titre: coupee ? `Les divisions de la J${REGLES_DIVISIONS.depuis}` : "Si on coupait ce soir",
          j: J_DECOUPAGE,
          lignes: [...(ma ? [{ n: me, v: nomDivision(ma) }] : []), ...repartition],
        }}
      />
      <DesLaJ4 />
    </div>
  );
}
