"use client";

// Tous les classements de la saison, sur une seule vue : la Ligue les montre
// directement (onglet Classements), sans page intermédiaire.
//
// Un sélecteur de classement (Pépite d'Or, Buteurs, Passeurs… : une rangée
// qui défile sur téléphone, toutes les pastilles sur grand écran), puis le
// podium en cartes de tailles différentes — le n°1 avec sa carte actuelle,
// φ fois plus grande que celles de ses dauphins — et la suite en lignes,
// chacune avec sa carte en vignette. Toucher une carte l'ouvre en grand.
// C'est l'onglet Classement des Actus, à chaque époque (actus/course.tsx) :
// la saison en cours, une saison close (son archive), et le Wall of Fame,
// où `joueurs` et `categories` sont les légendes de toute la carrière
// (sans badges de saison ni partage au Vestiaire).
//
// À côté des points, les journées jouées de chacun, comme la colonne J d'un
// classement de Ligue 1 (Sabri, 26/10 : « s'il y a un joueur qui est blessé
// et qui a manqué un match […] tout le monde va savoir qu'il y a une journée
// en moins »), en tableau : chaque colonne sous son intitulé, J puis PTS
// (sa capture, 26/10). Blessé en ce moment, sa carte porte le sigle
// « Blessé » (mini-carte.tsx).

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { BadgesLigne } from "@/components/sfl/distinctions";
import { useSaisonClose, useSeason } from "@/components/sfl/season-provider";
import { rankByMetric, type Player } from "@/lib/sfl/engine";
import { RANKINGS, unite, type Categorie } from "@/lib/sfl/rankings";
import { distinctions } from "@/lib/sfl/distinctions";
import { journeeJouee } from "@/lib/sfl/saisie/mutations";
import { Nom } from "@/components/sfl/nom";
import { AuVestiaire } from "@/components/sfl/au-vestiaire";
import { METAL, PastilleDivision, PlaceMetal, parDivision, useDecoupageClassement } from "@/components/sfl/metal-division";
import { nomDivision, type Division } from "@/lib/sfl/divisions";
import { useJourneesDuClassement } from "@/hooks/use-blessures";

const DAUPHIN = FORMAT_CARTE.moyenne;
const CHAMPION = FORMAT_CARTE.grande;


type Classe = Player & { rank: number; value: number };

/** Ses journées jouées : « 3 J ». */
function Journees({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("shrink-0 text-right font-semibold tabular-nums text-foreground/60", className)} aria-label={`${n} ${n > 1 ? "journées jouées" : "journée jouée"}`}>
      {n}
      <span className="mono-label ml-0.5 text-foreground/40">J</span>
    </span>
  );
}

/** « Blessé » sous le nom, à l'encre : ni rouge ni bleu, réservés aux cartes Impact et Défensive. */
function Blesse() {
  return (
    <span className="shrink-0 rounded-full bg-foreground px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-background uppercase">
      Blessé
    </span>
  );
}

/** Une colonne du tableau, comme au classement de la Ligue 1 : l'intitulé au-dessus, le chiffre dessous. */
function Colonne({ titre, valeur, fort, label }: { titre: string; valeur: number; fort?: boolean; label: string }) {
  return (
    <span className="flex w-12 shrink-0 flex-col items-center gap-1 border-l border-foreground/10 py-0.5" aria-label={label}>
      <span className="mono-label text-[10px] text-foreground/40 uppercase">{titre}</span>
      <span className={cn("leading-none font-bold tracking-tight tabular-nums", fort ? "text-[19px]" : "text-[17px] text-foreground/75")}>
        {valeur}
      </span>
    </span>
  );
}

function Podium({
  def,
  top,
  me,
  cle,
  journees,
}: {
  def: Categorie;
  top: Classe[];
  me: string;
  cle?: string;
  journees: (p: Classe) => number;
}) {
  const [premier, deuxieme, troisieme] = [top[0], top[1] ?? null, top[2] ?? null];
  // Le podium classique : le 2e à gauche, le champion au milieu, le 3e à droite.
  const marches = [
    { p: deuxieme, size: DAUPHIN },
    { p: premier, size: CHAMPION },
    { p: troisieme, size: DAUPHIN },
  ];
  return (
    <div className="flex items-end justify-center gap-3 sm:gap-5">
      {marches.map(({ p, size }, i) =>
        p ? (
          <div key={p.name} className="flex min-w-0 flex-col items-center gap-1.5">
            {/* Le champion aussi en carte photo : la toucher l'ouvre en grand, en classique. */}
            <MiniCarte player={p} size={size} detail={`${def.label} · ${p.value} ${unite(def, p.value)}`} cle={cle && `${cle}-${p.name}`} />
            <span
              className={cn(
                "max-w-[120px] truncate font-semibold",
                p === premier ? "text-[15px]" : "text-[12.5px] text-foreground/70",
                p.name === me && "text-primary"
              )}
            >
              <span className="text-foreground/40 tabular-nums">{p.rank}</span> <Nom n={p.name} />
            </span>
            <span className={cn("font-bold tabular-nums", p === premier ? "text-[20px]" : "text-[15px]")}>
              {p.value}
              <span className="mono-label ml-1 text-foreground/40">{unite(def, p.value)}</span>
              <Journees n={journees(p)} className={cn("ml-1.5", p === premier ? "text-[14px]" : "text-[12px]")} />
            </span>
          </div>
        ) : (
          <span key={i} style={{ width: 255 * size }} />
        )
      )}
    </div>
  );
}

/**
 * `joueurs` : les légendes de la carrière (le Wall of Fame) à la place des
 * joueurs de la saison ; ni badges ni statut de la saison, ni partage.
 * `cle` : la clé 3D des cartes qui ne sont pas les actuelles (une saison
 * close, la carrière).
 */
function Liste({ def, me, joueurs, cle }: { def: Categorie; me: string; joueurs?: Player[]; cle?: string }) {
  const { players, saison } = useSeason();
  const carriere = joueurs !== undefined;
  // Pas de badges tant que la saison n'a rien de joué : tout le monde serait à égalité.
  const parNom = useMemo(
    () => (!carriere && saison.journees.some((m) => journeeJouee(saison, m.j)) ? distinctions(players) : new Map()),
    [players, saison, carriere]
  );
  const ranked: Classe[] = rankByMetric(joueurs ?? players, def.value).filter((p) => def.showAll || p.value > 0);
  // Les journées de chacun : celles de la saison lue ; dans la carrière, ses matchs.
  const close = useSaisonClose();
  const { journees: parJoueur, blesses } = useJourneesDuClassement();
  const blesse = (p: Classe) => !carriere && !close && blesses.has(p.name);
  const journees = (p: Classe) => (carriere ? p.matchs : (parJoueur.get(p.name) ?? 0));

  // La Pépite d'Or de la saison, coupée en divisions dès qu'elle en a (Sabri,
  // 25/10 : « il faut que les divisions soient visibles ») : chaque division
  // sur son métal, ses places comptées depuis 1 ; le podium en cartes reste
  // celui de la D1, ceux de la D2 et de la D3 portent leur place sur leur métal.
  const decoupage = useDecoupageClassement();
  const groupes = decoupage && !carriere && def.id === "pp" ? parDivision(decoupage, ranked) : null;

  // Une ligne : la place (dans sa division, s'il y en a), la carte, le nom, les points.
  const ligne = (p: Classe, place: number | null, x?: Division) => (
    <div
      key={p.name}
      className={cn(
        "glass-soft flex items-center gap-3 rounded-[18px] px-3.5 py-2.5",
        p.name === me && "bg-primary/10"
      )}
    >
      {x && place != null && place <= 3 ? (
        <span className="grid w-7 shrink-0 place-items-center">
          <PlaceMetal x={x} rang={place} />
        </span>
      ) : (
        <span className="w-7 text-[15px] font-bold text-foreground/40 tabular-nums">{place ?? "–"}</span>
      )}
      <MiniCarte player={p} size={FORMAT_CARTE.petite} detail={`${x ? (place == null ? nomDivision(x) : `${place === 1 ? "1er" : `${place}e`} de la ${nomDivision(x)}`) : def.label} · ${p.value} ${unite(def, p.value)}`} cle={cle && `${cle}-${p.name}`} />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {/* « Blessé » sous le nom, en plus du sigle sur la carte : le nom garde toute la ligne. */}
        <span className="flex min-w-0 flex-col items-start gap-0.5">
          <span className="max-w-full truncate text-[15px] font-semibold"><Nom n={p.name} /></span>
          {blesse(p) && <Blesse />}
        </span>
        <BadgesLigne ds={parNom.get(p.name)} />
        {!carriere && p.statut === "Suspendu" && (
          <span
            className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[9px] font-bold tracking-wide text-destructive uppercase"
          >
            {p.statut}
          </span>
        )}
      </span>
      {/* Le tableau : J puis les points, chaque colonne sous son intitulé */}
      <span className="flex shrink-0 items-stretch">
        <Colonne titre="J" valeur={journees(p)} label={`${journees(p)} ${journees(p) > 1 ? "journées jouées" : "journée jouée"}`} />
        <Colonne titre={unite(def, p.value)} valeur={p.value} fort label={`${p.value} ${unite(def, p.value)}`} />
      </span>
    </div>
  );

  if (ranked.length === 0) {
    return (
      <div className="glass-soft rounded-3xl px-6 py-10 text-center text-sm text-foreground/45">
        Personne dans ce classement pour l&apos;instant.
      </div>
    );
  }

  const vestiaire = !carriere && (
    <AuVestiaire
      className="self-center"
      piece={{ type: "classement", id: def.id, top: ranked.slice(0, 3).map((p) => ({ n: p.name, v: p.value })) }}
    />
  );

  if (groupes)
    return (
      <div className="flex flex-col gap-4">
        {groupes.map((g) => (
          <div key={g.x} className={cn("flex flex-col gap-3 rounded-[24px] px-2 pt-3 pb-2 ring-1 ring-inset", METAL[g.x].voile)}>
            <div className="flex items-center gap-2.5 px-1.5">
              <PastilleDivision x={g.x} />
              <span className="text-[13px] font-semibold text-foreground/75">
                {g.joueurs.length} {g.joueurs.length > 1 ? "joueurs" : "joueur"}
              </span>
            </div>
            {g.x === 1 && (
              <>
                <Podium def={def} top={g.joueurs.slice(0, 3).map((p) => ({ ...p, rank: p.place ?? p.rank }))} me={me} cle={cle} journees={journees} />
                {vestiaire}
              </>
            )}
            {g.joueurs.length > (g.x === 1 ? 3 : 0) && (
              <div className="flex flex-col gap-1.5">
                {g.joueurs.slice(g.x === 1 ? 3 : 0).map((p) => ligne(p, p.place, g.x))}
              </div>
            )}
          </div>
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <Podium def={def} top={ranked.slice(0, 3)} me={me} cle={cle} journees={journees} />
      {vestiaire}

      <div className="flex flex-col gap-1.5">
        {ranked.slice(3).map((p) => ligne(p, p.rank))}
      </div>
    </div>
  );
}

/** Le même classement sous ses deux noms : « pp » dans la saison, « points » dans la carrière. */
const PEPITE = ["pp", "points"];

/**
 * `initial` : le classement qui s'ouvre (un id de `categories` ; « points »
 * et « pp » valent tous deux la Pépite d'Or). Par défaut, les classements
 * de la saison lue ; le Wall of Fame passe ses légendes (`categories`,
 * `joueurs`). `cle` : voir Liste.
 */
export function Classements({
  me,
  initial,
  categories = RANKINGS,
  joueurs,
  cle,
}: {
  me: string;
  initial?: string | null;
  categories?: Categorie[];
  joueurs?: Player[];
  cle?: string;
}) {
  const [id, setId] = useState<string>(
    () =>
      (
        categories.find((c) => c.id === initial) ??
        (PEPITE.includes(initial ?? "") ? categories.find((c) => PEPITE.includes(c.id)) : undefined) ??
        categories[0]
      ).id,
  );
  const def = categories.find((r) => r.id === id) ?? categories[0];
  // Ouvert sur un classement du bout de la rangée (un point fort de Ma saison,
  // ?classement=def) : la rangée défile jusqu'à lui, pour qu'on le voie choisi.
  const rangee = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const r = rangee.current;
    const b = r?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!r || !b) return;
    const rr = r.getBoundingClientRect();
    const bb = b.getBoundingClientRect();
    if (bb.right > rr.right || bb.left < rr.left) r.scrollLeft += bb.left - rr.left - (rr.width - bb.width) / 2;
  }, []);

  return (
    <section className="flex flex-col gap-4">
      <div
        ref={rangee}
        className="-mx-5 flex gap-2 overflow-x-auto overscroll-x-contain px-5 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Classement"
      >
        {categories.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={id === r.id}
            onClick={() => setId(r.id)}
            className={cn(
              "shrink-0 px-4 py-2 text-[13px] font-semibold whitespace-nowrap",
              id === r.id ? "bouton-principal" : "bouton-secondaire text-foreground/60"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <Liste key={def.id} def={def} me={me} joueurs={joueurs} cle={cle} />
    </section>
  );
}
