"use client";

// Les nouveaux arrivants, sous Activité (Sabri, 31/10/2026 : « voir
// visuellement les nouveaux utilisateurs Bola dans l'admin », SFL et Bola
// séparés, « quand ils sont venus, qu'est-ce qu'ils ont fait, combien de temps
// ils sont restés » ; « c'est ici qu'on va voir les nouveaux arrivants »).
//
// Les comptes créés depuis 30 jours, les plus récents d'abord, en deux
// onglets : SFL (le nom est dans l'effectif de la saison) et Bola (les
// autres : venus par un lien de parrainage, ou inscrits seuls). Pour chacun,
// sa carte (la toucher l'ouvre dans la visionneuse, card-viewer.tsx, comme
// dans la Recherche), son arrivée et son parrain, puis ce que le journal dit
// de lui (lib/sfl/suivi-joueur.ts) : sessions, temps passé, dernière venue,
// les pages vues et ses gestes. Le reste de la ligne ouvre sa fiche
// (./fiche.tsx). Les admins n'y sont pas.
//
// Sous chaque joueur Bola, son parcours vers son premier match (Sabri, 31/10 :
// « pour voir le comportement de l'utilisateur […] on veut l'activer »),
// étape par étape (./parcours.ts) : franchie en encre pleine, à venir en
// creux. En tête de l'onglet, combien en sont à chaque étape.

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { DAY, duree, KIND_FR, type Evenement, type Profil } from "@/lib/sfl/retention";
import { ficheJoueur, type Fiche } from "@/lib/sfl/suivi-joueur";
import { useSeason } from "@/components/sfl/season-provider";
import { useCardViewer } from "@/components/sfl/card-viewer";
import { PlayerCard } from "@/components/sfl/player-card";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { prechaufferCarte } from "@/components/sfl/card-3d";
import { carteNeutre } from "@/components/sfl/qui-vient";
import { cn } from "@/lib/utils";
import { ETAPES, type Parcours } from "./parcours";

function Etapes({ p }: { p: Parcours }) {
  return (
    <span className="flex flex-wrap gap-1 pt-1.5">
      {ETAPES.map((e) => {
        const faite = e.faite(p);
        const refus = e.id === "position" && p.position === "non";
        return (
          <span
            key={e.id}
            className={cn(
              "rounded-full px-2 py-[3px] text-[10.5px] leading-none font-semibold",
              faite ? "bg-foreground text-background" : "border border-foreground/15 text-encre-3",
              refus && "line-through"
            )}
          >
            {e.label}
            {e.id === "vu" && p.vu > 1 && ` ×${p.vu}`}
            {e.id === "organise" && p.organise > 1 && ` ×${p.organise}`}
          </span>
        );
      })}
    </span>
  );
}

/** Depuis combien de temps un compte compte comme nouveau (la page ne lit le parcours que de ceux-là). */
export const FENETRE_NOUVEAUX = 30 * DAY;
const FENETRE = FENETRE_NOUVEAUX;

const QUAND = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function depuis(ts: number, now: number): string {
  const d = now - ts;
  if (d < 3600 * 1000) return `il y a ${Math.max(1, Math.round(d / 60000))} min`;
  if (d < DAY) return `il y a ${Math.round(d / (3600 * 1000))} h`;
  return `il y a ${Math.round(d / DAY)} j`;
}

/** Ses gestes, sans les connexions et les ouvertures, que tout le monde a. */
const gestes = (f: Fiche) =>
  f.gestes.filter((g) => g.label !== KIND_FR.login && g.label !== KIND_FR.open);

export function NouveauxArrivants({
  evenements,
  profiles,
  parrains,
  parcours,
  now,
  onFiche,
}: {
  evenements: Evenement[];
  profiles: Profil[];
  /** Le parrain de chaque filleul, par nom ; null si la lecture a échoué. */
  parrains: ReadonlyMap<string, string> | null;
  /** Le parcours de chacun, par nom ; null si la lecture a échoué. */
  parcours: ReadonlyMap<string, Parcours> | null;
  now: number;
  onFiche: (name: string) => void;
}) {
  const { allPlayers } = useSeason();
  const { open } = useCardViewer();
  const [onglet, setOnglet] = useState<"sfl" | "bola">("bola");

  const { sfl, bola } = useMemo(() => {
    const effectif = new Set(allPlayers.map((p) => p.name.toLowerCase()));
    const lignes = profiles
      .filter((p) => !p.admin && p.created_at !== null && now - p.created_at <= FENETRE)
      .sort((a, b) => b.created_at! - a.created_at!)
      .map((p) => ({
        name: p.name,
        arrive: p.created_at!,
        parrain: parrains?.get(p.name) ?? null,
        fiche: ficheJoueur(evenements, p.name),
        sfl: effectif.has(p.name.toLowerCase()),
      }));
    return { sfl: lignes.filter((l) => l.sfl), bola: lignes.filter((l) => !l.sfl) };
  }, [allPlayers, profiles, parrains, evenements, now]);

  const carte = (name: string) =>
    allPlayers.find((p) => p.name.toLowerCase() === name.toLowerCase()) ?? carteNeutre(name);
  const ouvrir = (name: string) => {
    const player = carte(name);
    open({
      cacheKey: `nouveaux-${name}`,
      mode: "simple",
      title: name,
      joueur: name,
      render: (s) => <PlayerCard player={player} size={s} />,
    });
  };

  const liste = onglet === "sfl" ? sfl : bola;
  // Combien de joueurs Bola en sont à chaque étape.
  const entonnoir =
    parcours && bola.length > 0
      ? ETAPES.map((e) => ({ ...e, n: bola.filter((l) => { const p = parcours.get(l.name); return !!p && e.faite(p); }).length }))
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {(
          [
            ["bola", `Bola · ${bola.length}`],
            ["sfl", `SFL · ${sfl.length}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setOnglet(id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-corps font-semibold transition-colors",
              onglet === id ? "bg-foreground text-background" : "glass-soft text-encre-2"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {onglet === "bola" && entonnoir && (
        <div className="grid grid-cols-4 gap-x-2 gap-y-2.5 rounded-2xl border border-foreground/8 px-3 py-3">
          {entonnoir.map((e) => (
            <div key={e.id} className="flex flex-col">
              <span className="text-[20px] leading-none font-extrabold tabular-nums">
                {e.n}
                <span className="text-[12px] font-semibold text-encre-3">/{bola.length}</span>
              </span>
              <span className="pt-1 text-[10.5px] leading-tight text-encre-3">{e.label}</span>
            </div>
          ))}
        </div>
      )}

      {liste.length === 0 ? (
        <p className="py-6 text-center text-corps text-encre-3">Personne depuis 30 jours.</p>
      ) : (
        <div className="flex flex-col">
          {liste.map((l) => (
            <div key={l.name} className="flex items-center gap-3 border-b border-foreground/6 py-2.5 last:border-0">
              <button
                type="button"
                onPointerDown={(e) => prechaufferCarte(e.currentTarget)}
                onClick={() => ouvrir(l.name)}
                aria-label={`Voir la carte de ${l.name}`}
                className="shrink-0 transition-transform active:scale-[0.96]"
              >
                <PlayerCard player={carte(l.name)} size={FORMAT_CARTE.petite} />
              </button>
              <button onClick={() => onFiche(l.name)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ligne font-semibold">{l.name}</span>
                  <span className="block text-petit text-encre-3">
                    arrivé le {QUAND.format(l.arrive)}
                    {l.parrain && ` · par ${l.parrain}`}
                  </span>
                  <span className="block text-petit text-encre-3">
                    {l.fiche
                      ? `${l.fiche.sessions.length} session${l.fiche.sessions.length > 1 ? "s" : ""} · ${duree(l.fiche.temps)} · vu ${depuis(l.fiche.last, now)}`
                      : "aucune activité enregistrée"}
                  </span>
                  {l.fiche && l.fiche.pages.length > 0 && (
                    <span className="block truncate text-petit text-encre-3">
                      {l.fiche.pages
                        .slice(0, 4)
                        .map((g) => `${g.label} ×${g.value}`)
                        .join(" · ")}
                    </span>
                  )}
                  {l.fiche && gestes(l.fiche).length > 0 && (
                    <span className="block truncate text-petit text-encre-3">
                      {gestes(l.fiche)
                        .slice(0, 3)
                        .map((g) => `${g.label} ×${g.value}`)
                        .join(" · ")}
                    </span>
                  )}
                  {onglet === "bola" && parcours?.get(l.name) && <Etapes p={parcours.get(l.name)!} />}
                </span>
                <ChevronRight className="size-4 shrink-0 text-encre-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
