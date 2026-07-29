"use client";

// Atelier de design des cartes — page de travail, pas une page produit.
// Elle affiche la VRAIE carte (le composant PlayerCard utilisé partout dans
// l'app, pas une maquette simplifiée) sous plusieurs dispositions du bloc de
// stats, pour pouvoir comparer à l'œil sur un vrai joueur.

import { useState } from "react";
import { PlayerCard, type CardMode } from "@/components/sfl/player-card";
import { type StatsLayout } from "@/components/sfl/card-shell";
import { useSeason } from "@/components/sfl/season-provider";
import { rankPlayers } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

const LAYOUTS: { id: StatsLayout; nom: string; note: string }[] = [
  {
    id: "row",
    nom: "Actuel — 6 sur une ligne",
    note: "Six colonnes de 42 px. Les libellés se touchent, les nombres n'ont plus de place pour respirer, et l'œil doit balayer horizontalement une information qui n'a pas d'ordre naturel.",
  },
  {
    id: "fut",
    nom: "Deux colonnes — libellé / valeur",
    note: "La convention des vraies cartes de foot. Trois stats par colonne, libellé à gauche, valeur à droite, alignées sur la même ligne de base. Chaque nombre gagne le double de largeur.",
  },
  {
    id: "stack",
    nom: "Deux colonnes — empilé",
    note: "Même grille, mais le libellé reste au-dessus de la valeur comme aujourd'hui. Plus proche de l'existant, moins lisible que la version alignée.",
  },
  {
    id: "bars",
    nom: "Deux colonnes — avec jauges",
    note: "Ajoute une micro-jauge sous chaque stat, calibrée de 50 à 99 (sinon toutes les barres sont pleines et ne distinguent rien). Rend le profil du joueur lisible d'un coup d'œil.",
  },
];

const OBSERVATIONS = [
  {
    titre: "Tout est centré",
    texte:
      "Nom centré, OVR centré, poste centré, stats centrées. Rien n'accroche l'œil parce que tout a le même poids. Les cartes qui fonctionnent posent une hiérarchie franche : un élément domine, le reste se tait.",
  },
  {
    titre: "Trop d'effets simultanés",
    texte:
      "Grain, lueur, dégradé sur le nom, coups de pinceau, particules, fondu photo, ombre portée — tous actifs en même temps. C'est le marqueur le plus fiable d'un visuel généré : l'accumulation plutôt que le choix.",
  },
  {
    titre: "Les nombres ne sont pas tabulaires",
    texte:
      "Sans chasse fixe, un 1 est plus étroit qu'un 8 et les colonnes de stats ne s'alignent jamais vraiment. Corrigé dans les variantes en deux colonnes.",
  },
  {
    titre: "Aucune photo",
    texte:
      "Un seul fichier existe dans public/players (Yacine.png). Toutes les autres cartes affichent un fond vide. Aucun travail de design ne compensera ça : la photo est l'élément le plus identitaire d'une carte.",
  },
];

export default function DesignCartes() {
  const { players } = useSeason();
  const classes = rankPlayers(players);
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<CardMode>("rare");

  const player = classes[idx] ?? classes[0];
  if (!player) return null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-bold">Atelier — design des cartes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          La carte réelle de l&apos;app, sous quatre dispositions du bloc de stats.
          Page de travail, non reliée à la navigation.
        </p>
      </header>

      {/* Contrôles */}
      <div className="glass mb-6 rounded-2xl p-3">
        <div className="mb-3 flex gap-2">
          {(["rare", "simple"] as CardMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                mode === m ? "bg-foreground text-background" : "bg-foreground/10"
              )}
            >
              {m === "rare" ? "Rare" : "Standard"}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {classes.slice(0, 12).map((p, i) => (
            <button
              key={p.name}
              onClick={() => setIdx(i)}
              className={cn(
                "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                i === idx ? "bg-foreground text-background" : "bg-foreground/10"
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Variantes */}
      <div className="grid gap-6 sm:grid-cols-2">
        {LAYOUTS.map((l) => (
          <section key={l.id} className="glass rounded-2xl p-4">
            <h2 className="font-heading text-base font-semibold">{l.nom}</h2>
            <p className="mt-1 mb-4 text-[13px] leading-snug text-muted-foreground">
              {l.note}
            </p>
            <div className="flex justify-center">
              <PlayerCard player={player} mode={mode} size={1} statsLayout={l.id} />
            </div>
          </section>
        ))}
      </div>

      {/* Analyse */}
      <section className="mt-8">
        <h2 className="font-heading mb-1 text-lg font-bold">
          Ce qui fait « généré par IA »
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Au-delà de la disposition des stats — les quatre points qui trahissent
          le plus un visuel, par ordre d&apos;impact.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {OBSERVATIONS.map((o) => (
            <div key={o.titre} className="glass rounded-2xl p-4">
              <h3 className="text-[15px] font-semibold">{o.titre}</h3>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
                {o.texte}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
