"use client";

// Atelier des cartes — page de travail, non reliée à la navigation. Toutes
// les matières de la carte joueur (finitions-carte.ts), sur un vrai joueur et
// avec les vrais composants : la carte de saison, les trois cartes à titre
// (MVP, Impact, Défensive), les skins du Passe Bola dans l'ordre des
// paliers (lib/sfl/passe.ts : givre, carbone, nuit, marbre, tes couleurs,
// chrome, néon, aurore, ki, animée, onyx, météorite) et trois habillages
// (signes, crans, rang), chacune de face et de dos, puis en petit (compacte,
// réduite, pastille). Puis l'édition d'époque de la saison 0 (sa carte de
// saison et ses trois cartes Boost), quand l'appareil a l'archive de la
// saison 0.
// `?joueur=Nom` choisit le joueur ; par défaut, soi. `?trois=mvp` (ou base,
// impact, def, givre, carbone, nuit, marbre, couleurs, couleurs-br, chrome,
// neon, aurore, ki, animee, onyx, meteorite, recruteur, filigrane,
// fondateur, h1, h2, h3, s0, s0-mvp,
// s0-impact, s0-def) montre d'abord cette carte en 3D, à tourner ; `&dos=1`
// la pose sur son dos. `?seul=h1,h2` ne montre que ces cartes-là.

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Card3D } from "@/components/sfl/card-3d";
import { DosCarte } from "@/components/sfl/dos-carte";
import { matiereDe, type EditionCarte, type HabillageCarte } from "@/components/sfl/finitions-carte";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { PlayerCard } from "@/components/sfl/player-card";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { cartesDeCarriere } from "@/lib/sfl/carriere";
import { rankPlayers } from "@/lib/sfl/engine";

const LOOKS: { cle: string; titre: string; edition: EditionCarte; habillage?: HabillageCarte; saison?: number }[] = [
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
  { cle: "verre", titre: "Verre (offerte)", edition: "base", habillage: { finition: "verre" } },
  { cle: "pepite", titre: "Pépite d'or (offerte, Ilyes)", edition: "base", habillage: { finition: "pepite" } },
  { cle: "palestine", titre: "Palestine (offerte, Ilyes)", edition: "base", habillage: { finition: "palestine" } },
  { cle: "meteorite", titre: "Météorite · palier 17", edition: "base", habillage: { finition: "meteorite" } },
  { cle: "recruteur", titre: "Recruteur · 3 recrues", edition: "base", habillage: { finition: "recruteur" } },
  { cle: "filigrane", titre: "Filigrane · 5 recrues", edition: "base", habillage: { finition: "filigrane" } },
  { cle: "fondateur", titre: "Fondateur · 10 recrues · n° 97", edition: "base", habillage: { finition: "fondateur", fondateur: 97 } },
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
  { cle: "s0", titre: "Saison 0 · carte de saison (Standard parchemin, 12/07)", edition: "base", saison: 0 },
  { cle: "s0-mvp", titre: "Saison 0 · MVP du match", edition: "mvp", saison: 0 },
  { cle: "s0-impact", titre: "Saison 0 · Joueur Impact", edition: "impact", saison: 0 },
  { cle: "s0-def", titre: "Saison 0 · Défensive", edition: "def", saison: 0 },
];

function Atelier() {
  const { players, allPlayers, saison: brute, saisonTitree, evolution } = useSeason();
  const saison = saisonTitree ?? brute;
  const { me } = useMyPlayer();
  const params = useSearchParams();
  const demande = params.get("joueur");
  const seul = params.get("seul")?.split(",");
  const classes = useMemo(() => rankPlayers(players), [players]);
  // Un joueur masqué (Sabri) se demande aussi : c'est une page de travail.
  const player =
    allPlayers.find((p) => p.name.toLowerCase() === (demande ?? me ?? "").toLowerCase()) ?? classes[0];
  // Ses cartes d'une saison close : le joueur tel qu'il était alors, et la journée d'une carte à titre.
  const carriere = useMemo(() => (player ? cartesDeCarriere(saison, player.name, evolution) : []), [saison, player, evolution]);
  const version = (l: (typeof LOOKS)[number]) => {
    if (l.saison == null) return player ? { player, journee: undefined } : null;
    const s = carriere.find((c) => c.numero === l.saison && !c.enCours);
    if (!s) return null;
    if (l.edition === "base") return { player: s.player, journee: undefined };
    const c = s.speciales.find((x) => x.carte.type === l.edition);
    return c ? { player: c.player, journee: c.j } : null;
  };
  const looks = LOOKS.filter((l) => version(l));
  const trois = looks.find((l) => l.cle === params.get("trois"));
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
                player={version(trois)!.player}
                size={s}
                distinction={trois.edition === "base" ? undefined : trois.edition}
                habillage={trois.habillage}
                saison={trois.saison}
                journee={version(trois)!.journee}
              />
            )}
          />
        </section>
      )}
      {looks.filter((l) => !seul || seul.includes(l.cle)).map((l) => {
        const distinction = l.edition === "base" ? undefined : l.edition;
        const habillage = l.habillage;
        const { player: joueur, journee } = version(l)!;
        const epoque = { saison: l.saison, journee };
        return (
          <section key={l.titre} className="flex flex-col gap-3">
            <h2 className="mono-label text-muted-foreground">{l.titre}</h2>
            <div className="flex flex-wrap items-start gap-3">
              <PlayerCard player={joueur} size={taille} distinction={distinction} habillage={habillage} {...epoque} />
              <DosCarte matiere={matiereDe(l.edition, habillage, l.saison)} nom={player.name} size={taille} habillage={habillage} />
            </div>
            <div className="flex items-end gap-3">
              <PlayerCard player={joueur} size={FORMAT_CARTE.grande} distinction={distinction} habillage={habillage} {...epoque} />
              <PlayerCard player={joueur} size={FORMAT_CARTE.moyenne} distinction={distinction} habillage={habillage} vertical {...epoque} />
              <PlayerCard player={joueur} size={FORMAT_CARTE.moyenne} distinction={distinction} habillage={habillage} {...epoque} />
              <PlayerCard player={joueur} size={FORMAT_CARTE.petite} distinction={distinction} habillage={habillage} {...epoque} />
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
