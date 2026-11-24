"use client";

// La fréquentation de chaque rubrique (Bola, 24/11/2026 : « la fréquentation
// de chaque chose qu'on va mettre en place et l'intérêt que ça gagne ») :
// pour chaque rubrique de l'app, combien de joueurs l'ont ouverte ces 7
// derniers jours, sur l'effectif, et l'écart avec les 7 jours d'avant. Une
// rubrique toute neuve dit « neuf ». Lu dans le journal (kind = view, ses
// adresses), déjà chargé et filtré sur le public choisi par la page (vue.tsx).
// Les gestes à l'intérieur d'une page ne sont pas dans le journal : on compte
// les pages ouvertes, rien de plus. Les vues des photos et vidéos, elles,
// sont dans le bloc Vidéos (videos.tsx).

import { useMemo } from "react";
import type { Evenement } from "@/lib/sfl/retention";

/** Les rubriques, de la plus précise à la plus large : la première qui colle l'emporte. */
const RUBRIQUES: { nom: string; colle: (chemin: string) => boolean }[] = [
  { nom: "Photos et vidéos d'Actus", colle: (c) => c.startsWith("/ligue/videos") },
  { nom: "Récap d'une journée", colle: (c) => c.startsWith("/ligue/journee") },
  { nom: "Actus", colle: (c) => c === "/ligue" || c.startsWith("/saisons") || c === "/palmares" },
  { nom: "Bola Plus", colle: (c) => c.startsWith("/profil/bola-plus") },
  { nom: "Badges", colle: (c) => c.startsWith("/profil/badges") },
  { nom: "Ma saison", colle: (c) => c.startsWith("/profil/saison") },
  { nom: "Ma carte", colle: (c) => c === "/profil" || c.startsWith("/profil/") },
  { nom: "Map", colle: (c) => c === "/" || c.startsWith("/map") },
  { nom: "Vestiaire", colle: (c) => c.startsWith("/vestiaire") },
  { nom: "Messages", colle: (c) => c.startsWith("/messages") },
  { nom: "Bola Team", colle: (c) => c.startsWith("/bola-team") },
  { nom: "Bola Agent", colle: (c) => c.startsWith("/agent") },
  { nom: "Recherche", colle: (c) => c.startsWith("/recherche") },
];

const JOUR = 86_400_000;

function rubriqueDe(path: string | null): string | null {
  if (!path) return null;
  const c = path.split(/[?#]/)[0] || "/";
  return RUBRIQUES.find((r) => r.colle(c))?.nom ?? null;
}

export function Rubriques({ evenements, effectif, now }: { evenements: Evenement[]; effectif: number; now: number }) {
  const lignes = useMemo(() => {
    const cette = new Map<string, Set<string>>();
    const avant = new Map<string, Set<string>>();
    const premiere = new Map<string, number>();
    for (const e of evenements) {
      if (e.kind !== "view") continue;
      const r = rubriqueDe(e.path);
      if (!r) continue;
      premiere.set(r, Math.min(premiere.get(r) ?? Infinity, e.at));
      const age = now - e.at;
      const m = age < 7 * JOUR ? cette : age < 14 * JOUR ? avant : null;
      if (!m) continue;
      if (!m.has(r)) m.set(r, new Set());
      m.get(r)!.add(e.name);
    }
    return RUBRIQUES.map(({ nom }) => {
      const n = cette.get(nom)?.size ?? 0;
      const a = avant.get(nom)?.size ?? 0;
      // Neuve : rien d'elle avant ces 7 jours.
      const neuve = (premiere.get(nom) ?? Infinity) >= now - 7 * JOUR;
      return { nom, n, a, neuve };
    })
      .filter((l) => l.n > 0 || l.a > 0)
      .sort((x, y) => y.n - x.n);
  }, [evenements, now]);

  if (lignes.length === 0) return <p className="text-[12.5px] text-foreground/55">Rien dans le journal ces deux dernières semaines.</p>;
  const base = Math.max(1, effectif);
  return (
    <div className="flex flex-col">
      <div className="mono-label flex items-center gap-3 pb-1.5 text-[8.5px] text-foreground/45">
        <span className="min-w-0 flex-1">Rubrique</span>
        <span className="w-[34px] text-right">7 j</span>
        <span className="w-[52px] text-right">vs avant</span>
      </div>
      {lignes.map((l) => {
        const d = l.n - l.a;
        return (
          <div key={l.nom} className="flex items-center gap-3 border-t border-foreground/8 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold">{l.nom}</p>
              <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-foreground/8">
                <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.min(1, l.n / base) * 100}%` }} />
              </div>
            </div>
            <span className="w-[34px] text-right text-[13px] font-bold tabular-nums">{l.n}</span>
            <span className="w-[52px] text-right text-[12px] text-foreground/55 tabular-nums">
              {l.neuve ? "neuf" : d === 0 ? "=" : `${d > 0 ? "▲" : "▼"} ${Math.abs(d)}`}
            </span>
          </div>
        );
      })}
      <p className="mt-2 text-[11.5px] leading-snug text-foreground/45">
        Joueurs différents qui ont ouvert la rubrique sur les 7 derniers jours, sur {effectif} comptes ; l&apos;écart avec les 7 jours
        d&apos;avant.
      </p>
    </div>
  );
}
