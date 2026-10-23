"use client";

// Atelier des cartes — page de travail, non reliée à la navigation. Toutes
// les matières de la carte joueur (finitions-carte.ts), sur un vrai joueur et
// avec les vrais composants : la carte de saison, les trois cartes à titre
// (MVP, Impact, Défensive) et les trois finitions de la passe (nuit, chrome,
// animée), chacune de face et de dos, puis en petit (compacte, réduite,
// pastille). `?joueur=Nom` choisit le joueur ; par défaut, soi.

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { DosCarte } from "@/components/sfl/dos-carte";
import { matiereDe, type EditionCarte, type Finition } from "@/components/sfl/finitions-carte";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { PlayerCard } from "@/components/sfl/player-card";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { rankPlayers } from "@/lib/sfl/engine";

const LOOKS: { titre: string; edition: EditionCarte; finition?: Finition }[] = [
  { titre: "Carte de saison", edition: "base" },
  { titre: "MVP", edition: "mvp" },
  { titre: "Impact", edition: "impact" },
  { titre: "Défensive", edition: "def" },
  { titre: "Finition nuit · palier 4", edition: "base", finition: "nuit" },
  { titre: "Finition chrome · palier 10", edition: "base", finition: "chrome" },
  { titre: "Finition animée · palier 16", edition: "base", finition: "animee" },
];

function Atelier() {
  const { players } = useSeason();
  const { me } = useMyPlayer();
  const demande = useSearchParams().get("joueur");
  const classes = useMemo(() => rankPlayers(players), [players]);
  const player =
    players.find((p) => p.name.toLowerCase() === (demande ?? me ?? "").toLowerCase()) ?? classes[0];
  if (!player) return null;
  const taille = 0.68;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-[var(--fib-34)] px-4 pt-6 pb-40">
      <header className="flex flex-col gap-1">
        <h1 className="titre-lettrage text-[24px]">Atelier des cartes</h1>
        <p className="font-mono text-[12px] text-foreground/45">{player.name} · page de travail</p>
      </header>
      {LOOKS.map((l) => {
        const distinction = l.edition === "base" ? undefined : l.edition;
        const habillage = l.finition ? { finition: l.finition } : undefined;
        return (
          <section key={l.titre} className="flex flex-col gap-3">
            <h2 className="mono-label text-muted-foreground">{l.titre}</h2>
            <div className="flex flex-wrap items-start gap-3">
              <PlayerCard player={player} size={taille} distinction={distinction} habillage={habillage} />
              <DosCarte matiere={matiereDe(l.edition, habillage)} nom={player.name} size={taille} />
            </div>
            <div className="flex items-end gap-3">
              <PlayerCard player={player} size={FORMAT_CARTE.grande} distinction={distinction} habillage={habillage} />
              <PlayerCard player={player} size={FORMAT_CARTE.moyenne} distinction={distinction} habillage={habillage} vertical />
              <PlayerCard player={player} size={FORMAT_CARTE.moyenne} distinction={distinction} habillage={habillage} />
              <PlayerCard player={player} size={FORMAT_CARTE.petite} distinction={distinction} habillage={habillage} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function DesignCartes() {
  return (
    <Suspense>
      <Atelier />
    </Suspense>
  );
}
