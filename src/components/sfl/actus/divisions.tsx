"use client";

// L'annonce des divisions dans les Actus (Sabri, 23/10 : « dimanche, c'est le
// dernier jour sans division. Battez-vous pour qu'au terme de ce dimanche-là,
// on découpe la ligue en trois divisions »).
//
// Jusqu'au soir de la J3 : la ligue coupée en trois si on coupait ce soir,
// sur le terrain des rubriques (pelouse.tsx). La D1 au fond, près du but, la
// D3 devant : plus on est près du but, plus on est haut. Puis ce qui change
// dès la J4 : la plage de points qui fait monter ou descendre, le MVP,
// l'Impact et la Défensive élus à chaque journée, les équipes faites par
// division. La J3 jouée, les mêmes rangs donnent les divisions de la J4,
// jusqu'à ce qu'elle se joue.
//
// Chaque rang montre trois cartes, son étiquette à gauche (la division, son
// nombre de joueurs). Le tien : toi et les deux qui te précèdent. Au-dessus
// de toi, les derniers de la division (ceux qu'il faut passer) ; en dessous,
// les premiers (ceux qui te chassent). Qui n'est pas classé voit les premiers
// de chaque division.
//
// Le découpage et ses phrases : lib/sfl/divisions.ts.

import { useEffect, useMemo, useRef, useState } from "react";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import {
  decoupageAnnonce,
  decouper,
  DIVISIONS,
  editionAnnonce,
  J_DECOUPAGE,
  nomDivision,
  phraseAnnonce,
  REGLES_DIVISIONS,
  type Decoupage,
  type Division,
  type PlaceDecoupage,
} from "@/lib/sfl/divisions";
import { isHidden } from "@/lib/sfl/hidden";
import { ANTON } from "./ecran";
import { pl } from "./cinematiques";
import { Bulle, MILIEU, Pastille, Scene, T, tour, type Place } from "./pelouse";

/** Les rangs, du but vers l'avant : la D1 sur la ligne de but, puis la D2, la D3. */
const RANGS: Record<Division, number> = { 1: 26, 2: 150, 3: 272 };
/** Trois cartes par rang, à droite de l'étiquette. */
const PAR_RANG = 3;
const ECART = 60;
const CENTRE = MILIEU + 37;
/** L'étiquette : au bord gauche, à mi-hauteur des cartes, loin des prénoms. */
const ETIQUETTE = { u: 34, w: 80 } as const;

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

/** Une règle de la J4 : un chiffre en grand, ce qu'il veut dire dessous. */
function Regle({ n, quoi }: { n: string; quoi: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white/[0.06] px-3 pt-2.5 pb-3">
      <span className="text-[28px] leading-none" style={{ fontFamily: ANTON }}>
        {n}
      </span>
      <span className="text-[12px] leading-tight font-semibold text-white/65">{quoi}</span>
    </div>
  );
}

/** Ce qui change dès la J4, sous le terrain. */
function DesLaJ4() {
  const { montee, descente, depuis } = REGLES_DIVISIONS;
  return (
    <div className="flex flex-col gap-3 bg-[#0c0d0f] px-5 pt-1 pb-6 text-white">
      <span className="mono-label text-[10px] text-white/50">Dès la J{depuis}</span>
      <div className="grid grid-cols-3 gap-2">
        <Regle n={`${montee} pts`} quoi="ou plus sur la journée : tu montes" />
        <Regle n={`${descente} pts`} quoi="ou moins : tu descends" />
        <Regle n="MVP" quoi="Impact et Défensive élus à chaque journée" />
      </div>
      <p className="text-[13px] leading-snug text-white/70">
        Tu joues dans ta division. Les équipes se font toutes seules, au niveau de chacun.
      </p>
    </div>
  );
}

export function RubriqueDivisions() {
  const { saison } = useSeason();
  const { me } = useMyPlayer();
  const [maintenant] = useState(() => new Date());
  const edition = editionAnnonce(saison, maintenant);
  const coupee = decoupageAnnonce(saison, maintenant);
  const d = useMemo(
    () => (edition || coupee ? decouper(saison, coupee ? J_DECOUPAGE : undefined) : null),
    [saison, edition, coupee]
  );
  const ref = useRef<HTMLDivElement>(null);
  const present = !!d && d.classes > 0;
  // La notification et l'écran de l'ouverture mènent à /ligue#divisions.
  useEffect(() => {
    if (present && window.location.hash === "#divisions") ref.current?.scrollIntoView({ block: "start" });
  }, [present]);
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
    <div id="divisions" ref={ref} className="scroll-mt-4">
      <Scene
        sur={coupee ? `Après la J${J_DECOUPAGE}` : edition === "jour" ? `J${J_DECOUPAGE} · aujourd'hui` : `J${J_DECOUPAGE} · ${j3?.date ?? "dimanche"}`}
        titre={coupee ? `Trois divisions pour la J${REGLES_DIVISIONS.depuis}` : "Dernier dimanche sans divisions"}
        places={places}
        jusqua={305}
        texte={texte}
        partage={{
          titre: coupee ? `Les divisions de la J${REGLES_DIVISIONS.depuis}` : "Si on coupait ce soir",
          j: J_DECOUPAGE,
          lignes: [
            ...(moi ? [{ n: me, v: nomDivision(moi.division) }] : []),
            ...DIVISIONS.map((x) => ({ l: nomDivision(x), v: `${d.divisions[x].length} ${pl(d.divisions[x].length, "joueur", "joueurs")}` })),
          ],
        }}
      >
        {DIVISIONS.map((division, r) => (
          <Bulle key={division} u={ETIQUETTE.u} v={RANGS[division]} w={ETIQUETTE.w} d={0.1 + r * 0.16}>
            <Pastille
              petit
              n={nomDivision(division)}
              quoi={`${d.divisions[division].length} ${pl(d.divisions[division].length, "joueur", "joueurs")}`}
              clair={moi?.division === division}
            />
          </Bulle>
        ))}
      </Scene>
      <DesLaJ4 />
    </div>
  );
}
