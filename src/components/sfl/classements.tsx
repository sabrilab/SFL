"use client";

// Tous les classements de la saison, sur une seule vue : la Ligue les montre
// directement (onglet Classements), sans page intermédiaire.
//
// Un sélecteur de classement (Pépite d'Or, Buteurs, Passeurs…), puis le
// podium en cartes de tailles différentes — le n°1 dans le design de son
// classement, φ fois plus grand que ses dauphins — et la suite en lignes,
// chacune avec sa carte en vignette. Toucher une carte l'ouvre en grand.

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PlayerCard } from "@/components/sfl/player-card";
import { RankingCard, RANKING_THEMES } from "@/components/sfl/boost-card";
import { ViewableCard } from "@/components/sfl/card-viewer";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { BadgesLigne } from "@/components/sfl/distinctions";
import { useSeason } from "@/components/sfl/season-provider";
import { rankByMetric, type Player } from "@/lib/sfl/engine";
import { RANKINGS, type RankingDef } from "@/lib/sfl/rankings";
import { distinctions } from "@/lib/sfl/distinctions";
import { journeeJouee } from "@/lib/sfl/saisie/mutations";
import { Nom } from "@/components/sfl/nom";
import { AuVestiaire } from "@/components/sfl/au-vestiaire";

const DAUPHIN = FORMAT_CARTE.moyenne;
const CHAMPION = FORMAT_CARTE.grande;

// Mini badges "cartes" — un coup d'œil suffit pour voir quels types de
// cartes hors-série (MVP, Impact, Défensive) un joueur a décrochés.
const BADGE_STYLES: [key: "mvp" | "impact" | "def", label: string, cls: string][] = [
  ["mvp", "M", "bg-gradient-to-b from-[#FFF3C6] via-[#F4C542] to-[#8A5A12] text-[#3a2703]"],
  ["impact", "I", "bg-gradient-to-b from-[#FFB88A] via-[#FF5A1F] to-[#7A1E05] text-[#2b0a01]"],
  ["def", "D", "bg-gradient-to-b from-[#D8F1FF] via-[#7FD4FF] to-[#1C4E77] text-[#06202f]"],
];

function CardBadges({ player }: { player: Player }) {
  const badges = BADGE_STYLES.filter(([key]) => player[key] > 0);
  if (badges.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {badges.map(([key, label, cls]) => (
        <span
          key={key}
          title={`Carte ${key === "mvp" ? "MVP" : key === "impact" ? "Impact" : "Défensive"} ×${player[key]}`}
          className={cn(
            "flex h-5 w-3.5 items-center justify-center rounded-[3px] text-[8px] font-black shadow-sm ring-1 ring-black/20",
            cls
          )}
        >
          {label}
        </span>
      ))}
    </span>
  );
}

// La carte du n°1 de chaque classement s'affiche avec le design distinct
// correspondant (un thème par classement), pas la carte Standard.
function leaderCard(defId: string, leader: Player, size: number) {
  if (RANKING_THEMES[defId]) {
    return <RankingCard rankingId={defId} player={leader} size={size} />;
  }
  return <PlayerCard player={leader} mode="simple" size={size} />;
}

type Classe = Player & { rank: number; value: number };

function Podium({ def, top, me }: { def: RankingDef; top: Classe[]; me: string }) {
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
            {p === premier ? (
              <ViewableCard
                cacheKey={`rank-${def.id}-${p.name}`}
                mode={RANKING_THEMES[def.id] ? "rare" : "simple"}
                size={size}
                title={p.name}
                subtitle={`${def.label} · ${p.value} ${def.unit}`}
                render={(s) => leaderCard(def.id, p, s)}
              />
            ) : (
              <MiniCarte player={p} size={size} detail={`${def.label} · ${p.value} ${def.unit}`} />
            )}
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
              <span className="mono-label ml-1 text-foreground/40">{def.unit}</span>
            </span>
          </div>
        ) : (
          <span key={i} style={{ width: 255 * size }} />
        )
      )}
    </div>
  );
}

function Liste({ def, me }: { def: RankingDef; me: string }) {
  const { players, saison } = useSeason();
  // Pas de badges tant que la saison n'a rien de joué : tout le monde serait à égalité.
  const parNom = useMemo(
    () => (saison.journees.some((m) => journeeJouee(saison, m.j)) ? distinctions(players) : new Map()),
    [players, saison]
  );
  const ranked: Classe[] = rankByMetric(players, def.value).filter((p) => def.showAll || p.value > 0);

  if (ranked.length === 0) {
    return (
      <div className="glass-soft rounded-3xl px-6 py-10 text-center text-sm text-foreground/45">
        Personne dans ce classement pour l&apos;instant.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Podium def={def} top={ranked.slice(0, 3)} me={me} />
      <AuVestiaire
        className="self-center"
        piece={{ type: "classement", id: def.id, top: ranked.slice(0, 3).map((p) => ({ n: p.name, v: p.value })) }}
      />

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
            <MiniCarte player={p} size={FORMAT_CARTE.petite} detail={`${def.label} · ${p.value} ${def.unit}`} />
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-[15px] font-semibold"><Nom n={p.name} /></span>
              <BadgesLigne ds={parNom.get(p.name)} />
              {p.statut !== "Actif" && (
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
            <CardBadges player={p} />
            <span className="w-16 text-right text-lg font-bold tracking-tight tabular-nums">
              {p.value}
              <span className="mono-label ml-1 text-foreground/40">{def.unit}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Classements({ me }: { me: string }) {
  const [id, setId] = useState<string>("pp");
  const def = RANKINGS.find((r) => r.id === id) ?? RANKINGS[0];

  return (
    <section className="flex flex-col gap-4">
      <div
        className="-mx-5 flex gap-2 overflow-x-auto overscroll-x-contain px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Classement"
      >
        {RANKINGS.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={id === r.id}
            onClick={() => setId(r.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors",
              id === r.id ? "bg-foreground text-background" : "glass-soft text-foreground/60"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <Liste key={def.id} def={def} me={me} />
    </section>
  );
}
