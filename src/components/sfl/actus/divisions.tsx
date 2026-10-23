"use client";

// L'annonce des divisions dans les Actus (Sabri, 23/10 : « dimanche, c'est le
// dernier jour sans division. Battez-vous pour qu'au terme de ce dimanche-là,
// on découpe la ligue en trois divisions »).
//
// Jusqu'au soir de la J3 : la ligue coupée en divisions de 30 joueurs si on
// coupait ce soir, sur le terrain des rubriques (pelouse.tsx). La D1 au fond,
// près du but, la D3 devant : plus on est près du but, plus on est haut. Puis
// ce qui change dès la J4 : 30 joueurs par division, la plage de points qui
// fait monter ou descendre, le MVP, l'Impact et la Défensive élus à chaque
// journée, les équipes faites par division. La J3 jouée, les mêmes rangs
// donnent les divisions de la J4, jusqu'à ce qu'elle se joue.
//
// Chaque rang montre trois cartes, son étiquette à gauche : la division, et
// pendant l'annonce ses places (« 30 places », « les autres »), ensuite son
// nombre de joueurs. Le tien : toi et les deux qui te précèdent. Au-dessus
// de toi, les derniers de la division (ceux qu'il faut passer) ; en dessous,
// les premiers (ceux qui te chassent). Qui n'est pas classé voit les premiers
// de chaque division.
//
// Puis, chaque dimanche joué en divisions, le bilan : les divisions du
// dimanche suivant, et sur chaque rang ceux qui viennent d'y monter (↑) ou d'y
// descendre (↓), leurs points de la journée en pastille sur la carte (le nom
// n'a plus la place à trois par rang) ; toi d'abord dans le tien.
//
// Le découpage, le bilan et leurs phrases : lib/sfl/divisions.ts.

import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import {
  decoupageAnnonce,
  decouper,
  dernierBilan,
  DIVISIONS,
  editionAnnonce,
  etatDivisions,
  J_DECOUPAGE,
  nomDivision,
  phraseAnnonce,
  phraseBilan,
  REGLES_DIVISIONS,
  type BilanDivisions,
  type Decoupage,
  type Division,
  type EtatDivisions,
  type PlaceDecoupage,
} from "@/lib/sfl/divisions";
import { isHidden } from "@/lib/sfl/hidden";
import { cn } from "@/lib/utils";
import { ANTON } from "./ecran";
import { pl } from "./cinematiques";
import { Bulle, MILIEU, Pastille, Scene, T, tour, type Place } from "./pelouse";

/**
 * Les rangs, du but vers l'avant : la D1, puis la D2, la D3. La D1 se tient
 * devant le but, pas sur sa ligne : il reste entier au-dessus de ses cartes,
 * au lieu de dépasser entre ses prénoms. Chaque rang assez loin de celui de
 * derrière pour que ses cartes ne touchent pas les prénoms du rang du fond.
 */
const RANGS: Record<Division, number> = { 1: 161, 2: 277, 3: 385 };
/** Ceux du bilan, un peu plus espacés : les points débordent du coin haut de chaque carte. */
const RANGS_BILAN: Record<Division, number> = { 1: 168, 2: 290, 3: 403 };
/** Trois cartes par rang, à droite de l'étiquette. */
const PAR_RANG = 3;
const ECART = 60;
const CENTRE = MILIEU + 37;
/**
 * L'étiquette : au bord gauche, à mi-hauteur des cartes, loin des prénoms.
 * Celle de la D3, la plus près de l'œil, rentre un peu vers le milieu pour ne
 * pas sortir du cadre d'un téléphone.
 */
const ETIQUETTE = { u: { 1: 34, 2: 34, 3: 45 } as Record<Division, number>, w: 92 } as const;
/** Sur grand écran, le terrain et ses règles dessous ne font qu'une carte. */
const CADRE = "scroll-mt-4 md:overflow-hidden md:rounded-3xl";

/** Les places d'une division : 30 pour la D1 et la D2, la D3 prend les autres. */
const placesDe = (division: Division) => (division < 3 ? `${REGLES_DIVISIONS.taille} places` : "les autres");

/** Sous une division : ses joueurs ; vide, ses places. */
const quiDans = (division: Division, n: number) => (n > 0 ? `${n} ${pl(n, "joueur", "joueurs")}` : placesDe(division));

/** Les cartes d'un rang, selon la place de celui qui regarde. */
function cartesDuRang(d: Decoupage, division: Division, moi: PlaceDecoupage | undefined): PlaceDecoupage[] {
  const liste = d.divisions[division];
  if (liste.length <= PAR_RANG) return liste;
  if (!moi) return liste.slice(0, PAR_RANG);
  if (moi.division === division) {
    const i = liste.findIndex((p) => p.nom === moi.nom);
    const debut = Math.max(0, Math.min(i - 2, liste.length - PAR_RANG));
    return liste.slice(debut, debut + PAR_RANG);
  }
  return division < moi.division ? liste.slice(-PAR_RANG) : liste.slice(0, PAR_RANG);
}

/**
 * Les cartes d'un rang après un dimanche : toi d'abord dans ta division, puis
 * ceux qui viennent d'y arriver, puis les meilleurs de la journée.
 */
function cartesDuBilan(etat: EtatDivisions, bilan: BilanDivisions, division: Division, moi: string): { nom: string; badge?: string }[] {
  const ici = [...etat.actuelle].filter(([n, d]) => d === division && !isHidden(n)).map(([n]) => n);
  const m = (n: string) => bilan.parNom.get(n);
  const arrive = (n: string) => (m(n) && m(n)!.de !== m(n)!.vers ? 1 : 0);
  return ici
    .sort(
      (a, b) =>
        Number(b === moi) - Number(a === moi) ||
        arrive(b) - arrive(a) ||
        (m(b)?.points ?? -99) - (m(a)?.points ?? -99) ||
        a.localeCompare(b, "fr")
    )
    .slice(0, PAR_RANG)
    .map((nom) => {
      const x = m(nom);
      // Les points de la journée sur la carte, flèche en tête pour qui change de division.
      const points = x ? (x.points < 0 ? `−${-x.points}` : String(x.points)) : null;
      return { nom, badge: x ? `${x.vers < x.de ? "↑ " : x.vers > x.de ? "↓ " : ""}${points}` : undefined };
    });
}

/** Une règle de la J4 : un chiffre en grand, ce qu'il veut dire dessous. */
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
 * Ce qui change dès la J4, sous le terrain ; une fois la J4 jouée, ce qui se
 * joue chaque dimanche. Sur le fond du bas du terrain (pelouse.tsx, Scene),
 * en clair comme en sombre : le terrain et ses règles ne font qu'une carte.
 */
function DesLaJ4({ chaqueDimanche = false }: { chaqueDimanche?: boolean }) {
  const { montee, descente, depuis, taille } = REGLES_DIVISIONS;
  return (
    <div className="flex flex-col gap-3 bg-[#e8eae5] px-5 pt-1 pb-6 text-foreground dark:bg-[#0c0d0f] dark:text-white">
      <span className="mono-label text-[10px] text-foreground/50 dark:text-white/50">{chaqueDimanche ? "Chaque dimanche" : `Dès la J${depuis}`}</span>
      {/* Deux par ligne même sur ordinateur : la rubrique y tient dans une colonne d'Actus, quatre y serraient le texte. */}
      <div className={cn("grid gap-2", chaqueDimanche ? "grid-cols-3" : "grid-cols-2")}>
        {!chaqueDimanche && <Regle n={String(taille)} quoi="joueurs par division, les meilleurs en D1" />}
        <Regle n={`${montee} pts`} quoi="ou plus sur la journée : tu montes" />
        <Regle n={`${descente} pts`} quoi="ou moins : tu descends" />
        <Regle n="MVP" quoi="Impact et Défensive élus à chaque journée" />
      </div>
      <p className="text-[13px] leading-snug text-foreground/70 dark:text-white/70">
        Tu joues dans ta division. Les équipes se font toutes seules, au niveau de chacun.
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
  const d = useMemo(
    () => (edition || coupee ? decouper(saison, coupee ? J_DECOUPAGE : undefined) : null),
    [saison, edition, coupee]
  );
  // Après chaque dimanche joué en divisions : le bilan.
  const etat = useMemo(() => (edition || coupee ? null : etatDivisions(saison)), [saison, edition, coupee]);
  const bilan = useMemo(() => dernierBilan(etat), [etat]);
  const ref = useRef<HTMLDivElement>(null);
  const present = (!!d && d.classes > 0) || !!bilan;
  // La notification et l'écran de l'ouverture mènent à /ligue#divisions.
  useEffect(() => {
    if (present && window.location.hash === "#divisions") ref.current?.scrollIntoView({ block: "start" });
  }, [present]);
  if (etat && bilan) return <Bilan ref={ref} etat={etat} bilan={bilan} me={me} className={className} />;
  if (!d || !present) return null;

  const moi = isHidden(me) ? undefined : d.parNom.get(me);
  const places: Place[] = DIVISIONS.flatMap((division, r) => {
    const cartes = cartesDuRang(d, division, moi);
    return cartes.map((p, i) => ({
      nom: p.nom,
      u: CENTRE + (i - (cartes.length - 1) / 2) * ECART,
      v: RANGS[division],
      taille: T.petite,
      d: tour(i, 0.16 + r * 0.16, 0.05),
      moi: p.nom === me,
    }));
  });

  const j3 = saison.journees.find((m) => m.j === J_DECOUPAGE);
  const texte = isHidden(me)
    ? undefined
    : coupee
      ? `Tu joues la J${REGLES_DIVISIONS.depuis} en ${nomDivision(moi?.division ?? 3)}`
      : (phraseAnnonce(saison, d, me, edition ?? "avant") ?? undefined);

  return (
    <div id="divisions" ref={ref} className={cn(CADRE, className)}>
      <Scene
        className="md:rounded-none"
        sur={coupee ? `Après la J${J_DECOUPAGE}` : edition === "jour" ? `J${J_DECOUPAGE} · aujourd'hui` : `J${J_DECOUPAGE} · ${j3?.date ?? "dimanche"}`}
        titre={coupee ? `Trois divisions pour la J${REGLES_DIVISIONS.depuis}` : "Dernier dimanche sans divisions"}
        places={places}
        jusqua={418}
        texte={texte}
        partage={{
          titre: coupee ? `Les divisions de la J${REGLES_DIVISIONS.depuis}` : "Si on coupait ce soir",
          j: J_DECOUPAGE,
          lignes: [
            ...(moi ? [{ n: me, v: nomDivision(moi.division) }] : []),
            ...DIVISIONS.map((x) => ({ l: nomDivision(x), v: quiDans(x, d.divisions[x].length) })),
          ],
        }}
      >
        {DIVISIONS.map((division, r) => (
          <Bulle key={division} u={ETIQUETTE.u[division]} v={RANGS[division]} w={ETIQUETTE.w} d={0.1 + r * 0.16}>
            <Pastille
              petit
              n={nomDivision(division)}
              quoi={coupee ? quiDans(division, d.divisions[division].length) : placesDe(division)}
              clair={moi?.division === division}
            />
          </Bulle>
        ))}
      </Scene>
      <DesLaJ4 />
    </div>
  );
}

/** Le bilan du dernier dimanche joué en divisions. */
function Bilan({
  ref,
  etat,
  bilan,
  me,
  className,
}: {
  ref: Ref<HTMLDivElement>;
  etat: EtatDivisions;
  bilan: BilanDivisions;
  me: string;
  className?: string;
}) {
  const { saison } = useSeason();
  const taille = (x: Division) => [...etat.actuelle].filter(([n, d]) => d === x && !isHidden(n)).length;
  const places: Place[] = DIVISIONS.flatMap((division, r) => {
    const cartes = cartesDuBilan(etat, bilan, division, me);
    return cartes.map((p, i) => ({
      nom: p.nom,
      u: CENTRE + (i - (cartes.length - 1) / 2) * ECART,
      v: RANGS_BILAN[division],
      taille: T.petite,
      d: tour(i, 0.16 + r * 0.16, 0.05),
      moi: p.nom === me,
      badge: p.badge,
    }));
  });
  const jour = saison.journees.find((m) => m.j === bilan.j);
  const ma = isHidden(me) ? undefined : etat.actuelle.get(me);
  const mouvements = `${bilan.montees} ${pl(bilan.montees, "monte", "montent")}, ${bilan.descentes} ${pl(bilan.descentes, "descend", "descendent")}`;
  return (
    <div id="divisions" ref={ref} className={cn(CADRE, className)}>
      <Scene
        className="md:rounded-none"
        sur={`J${bilan.j} · ${jour?.date ?? "dimanche"}`}
        titre={`Les divisions après la J${bilan.j}`}
        places={places}
        jusqua={436}
        texte={phraseBilan(etat, bilan, me) ?? mouvements}
        partage={{
          titre: `Les divisions après la J${bilan.j}`,
          j: bilan.j,
          lignes: [
            ...(ma ? [{ n: me, v: nomDivision(ma) }] : []),
            { l: "Mouvements", v: mouvements },
            ...DIVISIONS.map((x) => ({ l: nomDivision(x), v: quiDans(x, taille(x)) })),
          ],
        }}
      >
        {DIVISIONS.map((division, r) => (
          <Bulle key={division} u={ETIQUETTE.u[division]} v={RANGS_BILAN[division]} w={ETIQUETTE.w} d={0.1 + r * 0.16}>
            <Pastille petit n={nomDivision(division)} quoi={quiDans(division, taille(division))} clair={ma === division} />
          </Bulle>
        ))}
      </Scene>
      <DesLaJ4 chaqueDimanche />
    </div>
  );
}
