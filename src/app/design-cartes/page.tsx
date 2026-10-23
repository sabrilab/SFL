"use client";

// Atelier des cartes — page de travail, non reliée à la navigation. Toutes
// les matières de la carte joueur (finitions-carte.ts), sur un vrai joueur et
// avec les vrais composants : la carte de saison, les trois cartes à titre
// (MVP, Impact, Défensive), les trois finitions de la passe (nuit, chrome,
// animée) et trois habillages (signes, crans, rang, photo traitée), chacune
// de face et de dos, puis en petit (compacte, réduite, pastille).
// `?joueur=Nom` choisit le joueur ; par défaut, soi. `?trois=mvp` (ou base,
// impact, def, nuit, chrome, animee, h1, h2, h3) montre d'abord cette carte
// en 3D, à tourner ; `&dos=1` la pose sur son dos. `?seul=h1,h2` ne montre
// que ces cartes-là.

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Card3D } from "@/components/sfl/card-3d";
import { DosCarte } from "@/components/sfl/dos-carte";
import { matiereDe, type EditionCarte, type HabillageCarte } from "@/components/sfl/finitions-carte";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { PlayerCard } from "@/components/sfl/player-card";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { rankPlayers } from "@/lib/sfl/engine";

const LOOKS: { cle: string; titre: string; edition: EditionCarte; habillage?: HabillageCarte }[] = [
  { cle: "base", titre: "Carte de saison", edition: "base" },
  { cle: "mvp", titre: "MVP", edition: "mvp" },
  { cle: "impact", titre: "Impact", edition: "impact" },
  { cle: "def", titre: "Défensive", edition: "def" },
  { cle: "nuit", titre: "Finition nuit · palier 4", edition: "base", habillage: { finition: "nuit" } },
  { cle: "chrome", titre: "Finition chrome · palier 10", edition: "base", habillage: { finition: "chrome" } },
  { cle: "animee", titre: "Finition animée · palier 16", edition: "base", habillage: { finition: "animee" } },
  {
    cle: "h1",
    titre: "Habillage · liseré argent, photo argentique, 1 cran, rang B",
    edition: "base",
    habillage: { signes: ["lisere-argent"], traitement: "argentique", cran: 1, rang: "B" },
  },
  {
    cle: "h2",
    titre: "Habillage · nuit, sceau, gravure, 3 crans, rang A",
    edition: "base",
    habillage: { finition: "nuit", signes: ["lisere-argent", "sceau"], traitement: "gravure", cran: 3, rang: "A" },
  },
  {
    cle: "h3",
    titre: "Habillage · MVP, liseré or, marbre, puce dorée, nom gravé, cadre complet, rang S",
    edition: "mvp",
    habillage: {
      signes: ["lisere-argent", "lisere-or", "sceau", "puce-or", "nom-grave"],
      traitement: "marbre",
      cran: 4,
      rang: "S",
    },
  },
];

function Atelier() {
  const { players } = useSeason();
  const { me } = useMyPlayer();
  const params = useSearchParams();
  const demande = params.get("joueur");
  const trois = LOOKS.find((l) => l.cle === params.get("trois"));
  const seul = params.get("seul")?.split(",");
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
      {trois && (
        <section className="flex flex-col items-center gap-3">
          <h2 className="mono-label self-start text-muted-foreground">{trois.titre} · en 3D</h2>
          <Card3D
            cacheKey={`atelier-${trois.cle}-${player.name}`}
            size={1.5}
            startFace={params.get("dos") ? "back" : "front"}
            apercu
            render={(s) => (
              <PlayerCard
                player={player}
                size={s}
                distinction={trois.edition === "base" ? undefined : trois.edition}
                habillage={trois.habillage}
              />
            )}
          />
        </section>
      )}
      {LOOKS.filter((l) => !seul || seul.includes(l.cle)).map((l) => {
        const distinction = l.edition === "base" ? undefined : l.edition;
        const habillage = l.habillage;
        return (
          <section key={l.titre} className="flex flex-col gap-3">
            <h2 className="mono-label text-muted-foreground">{l.titre}</h2>
            <div className="flex flex-wrap items-start gap-3">
              <PlayerCard player={player} size={taille} distinction={distinction} habillage={habillage} />
              <DosCarte matiere={matiereDe(l.edition, habillage)} nom={player.name} size={taille} habillage={habillage} />
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
