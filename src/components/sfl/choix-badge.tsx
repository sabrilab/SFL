"use client";

// Choisir le badge de sa carte, depuis Ma carte. Le bouton montre le badge
// posé en ce moment ; la feuille montre la carte elle-même, qui change à
// chaque choix, puis les choix : le meilleur (par défaut, suit les saisons),
// chaque badge gagné, ou aucun. Le choix part à la ligue (badges-choisis.ts).

import { useState } from "react";
import { Check } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Badge3D, nomBadge } from "@/components/sfl/badge-3d";
import { PlayerCard } from "@/components/sfl/player-card";
import { useSeason } from "@/components/sfl/season-provider";
import { useBadgeCarte, useChoixBadge } from "@/hooks/use-badge-carte";
import { badgesGagnes, cleBadge, type BadgeCarte } from "@/lib/sfl/badge-carte";
import { choisirBadge } from "@/lib/sfl/badges-choisis";
import type { Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

function Mini({ badge, taille }: { badge: BadgeCarte; taille: number }) {
  return <Badge3D badge={badge} largeur={taille} socle />;
}

function Option({
  actif,
  onClick,
  children,
  label,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cn(
        "flex min-h-[60px] w-full items-center gap-3.5 rounded-[18px] px-3.5 py-2.5 text-left transition-colors",
        actif ? "bg-foreground/[0.14] ring-1 ring-foreground/40" : "bg-foreground/[0.06] active:bg-foreground/10"
      )}
    >
      {children}
      <span className="min-w-0 flex-1 text-[16px] font-semibold">{label}</span>
      {actif && <Check className="size-5 shrink-0" aria-hidden />}
    </button>
  );
}

export function ChoixBadge({ player }: { player: Player }) {
  const { saison } = useSeason();
  const [ouvert, setOuvert] = useState(false);
  const badge = useBadgeCarte(player.name);
  const choix = useChoixBadge(player.name) ?? "auto";
  const gagnes = badgesGagnes(saison, player.name);
  const meilleur = gagnes[0] ?? null;
  // Un choix qui ne correspond plus à rien de gagné est en fait le meilleur.
  const actif = choix === "aucun" ? "aucun" : gagnes.some((b) => cleBadge(b) === choix) ? choix : "auto";
  const choisir = (c: string) => void choisirBadge(player.name, c);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label={badge ? `Badge de ma carte : ${nomBadge(badge)}. Changer` : "Choisir le badge de ma carte"}
        className="bouton-secondaire bouton--or flex size-[52px] shrink-0 items-center justify-center"
      >
        {badge ? <Mini badge={badge} taille={34} /> : <span className="size-[22px] rounded-full border-[1.5px] border-dashed border-foreground/45" />}
      </button>

      <Sheet open={ouvert} onOpenChange={setOuvert}>
        <SheetContent side="bottom" className="mx-auto max-h-[90vh] w-full overflow-y-auto rounded-t-[28px] px-5 pt-6 pb-8 sm:max-w-md">
          <SheetTitle className="text-[19px] font-extrabold tracking-tight">Le badge de ma carte</SheetTitle>
          <div className="mt-4 flex justify-center">
            <PlayerCard player={player} size={0.62} />
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <Option actif={actif === "auto"} onClick={() => choisir("auto")} label={meilleur ? `Le meilleur · ${nomBadge(meilleur)}` : "Le meilleur"}>
              {meilleur ? <Mini badge={meilleur} taille={44} /> : <span className="size-9 shrink-0" />}
            </Option>
            {gagnes.map((b) => (
              <Option key={cleBadge(b)} actif={actif === cleBadge(b)} onClick={() => choisir(cleBadge(b))} label={nomBadge(b)}>
                <Mini badge={b} taille={44} />
              </Option>
            ))}
            <Option actif={actif === "aucun"} onClick={() => choisir("aucun")} label="Aucun">
              <span className="size-9 shrink-0 rounded-full border-[1.5px] border-dashed border-foreground/40" />
            </Option>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
