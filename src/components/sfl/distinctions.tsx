"use client";

// Les badges des classements, et la rangée « Ils se démarquent » : la carte
// de chaque joueur distingué, son badge au-dessus. Toucher une carte l'ouvre
// en grand (en 3D), comme partout ailleurs dans l'app.
//
// Tant que la saison en cours n'a rien de joué, la rangée montre les
// distinctions de la saison passée, annoncées comme telles.

import { useMemo } from "react";
import { Award, Crown, Flame, Medal, Shield, Target, Repeat, Zap } from "lucide-react";
import { PlayerCard } from "@/components/sfl/player-card";
import { useCardViewer } from "@/components/sfl/card-viewer";
import { useSeason } from "@/components/sfl/season-provider";
import { deriveSeason } from "@/lib/sfl/saisie/engine";
import { journeeJouee, saisonDepuisArchive } from "@/lib/sfl/saisie/mutations";
import { demarques, type Distinction, type DistinctionId } from "@/lib/sfl/distinctions";
import type { Player } from "@/lib/sfl/engine";
import { publicOnly } from "@/lib/sfl/hidden";
import { cn } from "@/lib/utils";

const ICONES: Record<DistinctionId, typeof Crown> = {
  pepite: Crown,
  podium: Medal,
  buteur: Target,
  passeur: Repeat,
  mvp: Award,
  muraille: Shield,
  impact: Zap,
  fidele: Flame,
};

/** Une pastille de distinction. Pleine pour le Pépite d'Or, en contour sinon. */
export function Badge({ d, compact = false }: { d: Distinction; compact?: boolean }) {
  const Icone = ICONES[d.id];
  const fort = d.id === "pepite";
  return (
    <span
      title={d.detail}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-semibold whitespace-nowrap",
        compact ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-[11px]",
        fort ? "bg-foreground text-background" : "border border-foreground/25 bg-foreground/[0.06] text-foreground/85"
      )}
    >
      <Icone className={compact ? "size-3" : "size-3.5"} strokeWidth={2.4} aria-hidden />
      {compact && !fort ? <span className="sr-only">{d.titre}</span> : d.titre}
    </span>
  );
}

/** Les badges d'une ligne de classement : le principal en clair, les autres en icône. */
export function BadgesLigne({ ds }: { ds: Distinction[] | undefined }) {
  if (!ds?.length) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {ds.slice(0, 3).map((d, i) => (
        <Badge key={d.id + d.titre} d={d} compact={i > 0} />
      ))}
    </span>
  );
}

/** La rangée des cartes de ceux qui se démarquent. */
export function IlsSeDemarquent({ className }: { className?: string }) {
  const { players, saison } = useSeason();
  const { open } = useCardViewer();

  const { liste, source } = useMemo(() => {
    // La saison en cours ne compte qu'une fois ses journées jouées (un résultat,
    // un but ou une passe saisi) ; avant, ce sont les distinctions de la passée.
    const jouee = saison.journees.some((m) => journeeJouee(saison, m.j));
    const actuels = jouee ? demarques(players) : [];
    if (actuels.length) return { liste: actuels, source: null as string | null };
    const derniere = saison.archives?.[saison.archives.length - 1];
    if (!derniere) return { liste: [], source: null };
    const passes = publicOnly(deriveSeason(saisonDepuisArchive(derniere)).players);
    return { liste: demarques(passes), source: derniere.nom };
  }, [players, saison]);

  if (!liste.length) return null;

  const ouvrir = (p: Player, d: Distinction) =>
    open({
      cacheKey: `distinction-${source ?? "s"}-${p.name}`,
      mode: d.id === "pepite" ? "rare" : "simple",
      title: p.name,
      subtitle: d.detail,
      render: (s) => <PlayerCard player={p} mode={d.id === "pepite" ? "rare" : "simple"} size={s} />,
    });

  return (
    <section className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[17px] font-bold tracking-tight">Ils se démarquent</h2>
        {source && <span className="mono-label text-foreground/40">{source}</span>}
      </div>
      <div className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
        {liste.map(({ player, distinctions: ds }) => (
          <button
            key={player.name}
            type="button"
            onClick={() => ouvrir(player, ds[0])}
            className="flex shrink-0 snap-start flex-col items-center gap-2 text-left"
            aria-label={`${player.name} — ${ds.map((d) => d.detail).join(", ")}. Voir sa carte`}
          >
            <Badge d={ds[0]} />
            <PlayerCard player={player} mode={ds[0].id === "pepite" ? "rare" : "simple"} size={0.56} />
            <span className="max-w-[142px] truncate text-center text-[12px] text-foreground/55">{ds[0].detail}</span>
            {ds.length > 1 && (
              <span className="flex flex-wrap justify-center gap-1">
                {ds.slice(1, 4).map((d) => (
                  <Badge key={d.id + d.titre} d={d} compact />
                ))}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
