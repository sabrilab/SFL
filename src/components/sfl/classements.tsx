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

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { BadgesLigne } from "@/components/sfl/distinctions";
import { useSeason } from "@/components/sfl/season-provider";
import { rankByMetric, type Player } from "@/lib/sfl/engine";
import { RANKINGS, unite, type Categorie } from "@/lib/sfl/rankings";
import { distinctions } from "@/lib/sfl/distinctions";
import { journeeJouee } from "@/lib/sfl/saisie/mutations";
import { Nom } from "@/components/sfl/nom";
import { AuVestiaire } from "@/components/sfl/au-vestiaire";

const DAUPHIN = FORMAT_CARTE.moyenne;
const CHAMPION = FORMAT_CARTE.grande;


type Classe = Player & { rank: number; value: number };

function Podium({ def, top, me, cle }: { def: Categorie; top: Classe[]; me: string; cle?: string }) {
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

  if (ranked.length === 0) {
    return (
      <div className="glass-soft rounded-3xl px-6 py-10 text-center text-sm text-foreground/45">
        Personne dans ce classement pour l&apos;instant.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Podium def={def} top={ranked.slice(0, 3)} me={me} cle={cle} />
      {!carriere && (
        <AuVestiaire
          className="self-center"
          piece={{ type: "classement", id: def.id, top: ranked.slice(0, 3).map((p) => ({ n: p.name, v: p.value })) }}
        />
      )}

      <div className="flex flex-col gap-1.5">
        {ranked.slice(3).map((p) => (
          <div
            key={p.name}
            className={cn(
              "glass-soft flex items-center gap-3 rounded-[18px] px-3.5 py-2.5",
              p.name === me && "bg-primary/10"
            )}
          >
            <span className="w-7 text-[15px] font-bold text-foreground/40 tabular-nums">{p.rank}</span>
            <MiniCarte player={p} size={FORMAT_CARTE.petite} detail={`${def.label} · ${p.value} ${unite(def, p.value)}`} cle={cle && `${cle}-${p.name}`} />
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-[15px] font-semibold"><Nom n={p.name} /></span>
              <BadgesLigne ds={parNom.get(p.name)} />
              {!carriere && p.statut !== "Actif" && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase",
                    p.statut === "Suspendu"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                  )}
                >
                  {p.statut}
                </span>
              )}
            </span>
            <span className="w-16 text-right text-lg font-bold tracking-tight tabular-nums">
              {p.value}
              <span className="mono-label ml-1 text-foreground/40">{unite(def, p.value)}</span>
            </span>
          </div>
        ))}
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

  return (
    <section className="flex flex-col gap-4">
      <div
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
