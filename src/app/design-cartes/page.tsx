"use client";

// Atelier des cartes — page de travail, non reliée à la navigation. Toutes
// les matières de la carte joueur (finitions-carte.ts), sur un vrai joueur et
// avec les vrais composants : la carte de saison, les trois cartes à titre
// (MVP, Impact, Défensive), les skins du Passe Bola dans l'ordre des
// paliers (lib/sfl/passe.ts : givre, carbone, nuit, marbre, tes couleurs,
// chrome, néon, aurore, ki, animée, onyx, météorite) et trois habillages
// (signes, crans, rang), chacune de face et de dos, puis en petit (compacte,
// réduite, pastille).
// `?joueur=Nom` choisit le joueur ; par défaut, soi. `?trois=mvp` (ou base,
// impact, def, givre, carbone, nuit, marbre, couleurs, couleurs-br, chrome,
// neon, aurore, ki, animee, onyx, meteorite, h1, h2, h3) montre d'abord cette
// carte en 3D, à tourner ; `&dos=1` la pose sur son dos. `?seul=h1,h2` ne
// montre que ces cartes-là.

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
  { cle: "givre", titre: "Givre · palier 2", edition: "base", habillage: { finition: "givre" } },
  { cle: "carbone", titre: "Carbone · palier 4", edition: "base", habillage: { finition: "carbone" } },
  { cle: "nuit", titre: "Nuit · palier 5", edition: "base", habillage: { finition: "nuit" } },
  { cle: "marbre", titre: "Marbre · palier 7", edition: "base", habillage: { finition: "marbre" } },
  {
    cle: "couleurs",
    titre: "Tes couleurs · palier 8 · Algérie",
    edition: "base",
    habillage: { finition: "couleurs", pays: "dz" },
  },
  {
    cle: "couleurs-br",
    titre: "Tes couleurs · palier 8 · Brésil",
    edition: "base",
    habillage: { finition: "couleurs", pays: "br" },
  },
  { cle: "chrome", titre: "Chrome · palier 10", edition: "base", habillage: { finition: "chrome" } },
  { cle: "neon", titre: "Néon · palier 11", edition: "base", habillage: { finition: "neon" } },
  { cle: "aurore", titre: "Aurore · palier 12", edition: "base", habillage: { finition: "aurore" } },
  { cle: "ki", titre: "Ki · palier 14", edition: "base", habillage: { finition: "ki" } },
  { cle: "animee", titre: "Animée · palier 15", edition: "base", habillage: { finition: "animee" } },
  { cle: "onyx", titre: "Onyx · palier 16 (offerte)", edition: "base", habillage: { finition: "onyx" } },
  { cle: "meteorite", titre: "Météorite · palier 17", edition: "base", habillage: { finition: "meteorite" } },
  {
    cle: "h1",
    titre: "Habillage · liseré argent, 1 cran, rang B",
    edition: "base",
    habillage: { signes: ["lisere-argent"], cran: 1, rang: "B" },
  },
  {
    cle: "h2",
    titre: "Habillage · nuit, sceau, 3 crans, rang A",
    edition: "base",
    habillage: { finition: "nuit", signes: ["lisere-argent", "sceau"], cran: 3, rang: "A" },
  },
  {
    cle: "h3",
    titre: "Habillage · MVP, liseré platine, puce noire, nom gravé, cadre complet, rang S",
    edition: "mvp",
    habillage: {
      signes: ["lisere-argent", "lisere-platine", "sceau", "puce-noire", "nom-grave"],
      cran: 4,
      rang: "S",
    },
  },
];

function Atelier() {
  const { players, allPlayers } = useSeason();
  const { me } = useMyPlayer();
  const params = useSearchParams();
  const demande = params.get("joueur");
  const trois = LOOKS.find((l) => l.cle === params.get("trois"));
  const seul = params.get("seul")?.split(",");
  const classes = useMemo(() => rankPlayers(players), [players]);
  // Un joueur masqué (Sabri) se demande aussi : c'est une page de travail.
  const player =
    allPlayers.find((p) => p.name.toLowerCase() === (demande ?? me ?? "").toLowerCase()) ?? classes[0];
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
