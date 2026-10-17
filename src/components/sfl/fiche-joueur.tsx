"use client";

// La fiche d'un joueur, ouverte en touchant sa carte sur la feuille de match :
// sa carte, son nom et son équipe du jour, une phrase qui le résume, ses trois
// points forts, ses faits marquants, puis ses badges, les plus rares d'abord
// (les écussons et médailles de Ma carte). « Voir sa carte en grand » ouvre
// la carte en 3D, comme partout ailleurs.
//
// Le calcul est dans lib/sfl/fiche-joueur.ts.

import { useMemo } from "react";
import { PlayerCard } from "@/components/sfl/player-card";
import { useCardViewer } from "@/components/sfl/card-viewer";
import { useSeason } from "@/components/sfl/season-provider";
import { Ecusson, Medaille } from "@/components/sfl/vitrine";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { Player } from "@/lib/sfl/engine";
import { ficheJoueur } from "@/lib/sfl/fiche-joueur";
import { finsDeSaison, ordinal } from "@/lib/sfl/fin-de-saison";
import { POSTES } from "@/lib/sfl/inscription";
import { vitrine } from "@/lib/sfl/trophees";
import { username } from "@/lib/sfl/usernames";

export interface EquipeDuJour {
  nom: string;
  couleur: string;
  encre: string;
  /** « Terrain 1 », ou null s'il n'y a qu'un match. */
  terrain: string | null;
}

/** Combien de médailles on montre avant « +N ». */
const MEDAILLES = 4;

export function FicheJoueurSheet({
  player,
  equipe,
  onClose,
}: {
  player: Player | null;
  equipe: EquipeDuJour | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!player} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] px-5 pt-6 pb-8 sm:max-w-md">
        {player && <Fiche player={player} equipe={equipe} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function Fiche({ player, equipe, onClose }: { player: Player; equipe: EquipeDuJour | null; onClose: () => void }) {
  const { saison, allPlayers } = useSeason();
  const { open } = useCardViewer();
  const fiche = useMemo(() => ficheJoueur(saison, player, allPlayers), [saison, player, allPlayers]);
  const ecussons = useMemo(
    () => finsDeSaison(saison, player.name, allPlayers).filter((e) => e.meilleur),
    [saison, player.name, allPlayers]
  );
  const medailles = useMemo(
    () =>
      vitrine(saison, player.name, new Date())
        .filter((e) => e.palier > 0)
        .sort((a, b) => b.palier - a.palier || b.valeur - a.valeur),
    [saison, player.name]
  );
  const poste = POSTES.find((p) => p.id === player.poste)?.label;

  function voirEnGrand() {
    onClose();
    open({
      cacheKey: `mini-${player.name}`,
      mode: "simple",
      title: player.name,
      render: (s) => <PlayerCard player={player} size={s} />,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-4">
        <button type="button" onClick={voirEnGrand} aria-label={`Voir la carte de ${player.name} en grand`} className="shrink-0 transition-transform active:scale-95">
          <PlayerCard player={player} size={120 / 254} />
        </button>
        <div className="flex min-w-0 flex-col gap-2 pb-1">
          {equipe && (
            <span
              className="flex items-center gap-1.5 self-start rounded-full py-1 pr-2.5 pl-1.5 text-[12px] font-bold shadow-[inset_0_0_0_1px_rgba(128,128,128,0.45)]"
              style={{ background: equipe.couleur, color: equipe.encre }}
            >
              <span aria-hidden className="size-2.5 rounded-full shadow-[inset_0_0_0_1.5px_currentColor]" />
              {equipe.terrain ? `${equipe.nom} · ${equipe.terrain}` : equipe.nom}
            </span>
          )}
          <SheetTitle className="font-[family-name:var(--font-anton)] text-[38px] leading-[0.95] font-normal tracking-[0.3px] break-words uppercase">
            {player.name}
          </SheetTitle>
          <SheetDescription className="font-mono text-[12px] text-muted-foreground">
            {username(player.name)}
            {poste && ` · ${poste.toLowerCase()}`}
          </SheetDescription>
        </div>
      </div>

      <p className="text-[19px] leading-[1.25] font-bold tracking-[-0.4px]">{fiche.synthese}</p>

      {fiche.forts.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {fiche.forts.map((f) => (
            <div key={f.rang} className="flex flex-col gap-1.5 rounded-2xl bg-secondary px-3 pt-3 pb-2.5">
              <span className="text-[26px] leading-none font-black tracking-[-1px] italic tabular-nums">{f.chiffre}</span>
              <span className="text-[12px] font-semibold">{f.quoi}</span>
              <span className="font-mono text-[10.5px] leading-tight text-muted-foreground">{f.rang}</span>
            </div>
          ))}
        </div>
      )}

      {fiche.faits.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h3 className="mono-label text-muted-foreground">Faits marquants</h3>
          {fiche.faits.map((f) => (
            <div key={f.quand + f.quoi} className="flex items-baseline gap-3">
              <span className="w-[34px] shrink-0 font-mono text-[11px] font-bold text-muted-foreground">{f.quand}</span>
              <span className="text-[15px] font-semibold">{f.quoi}</span>
            </div>
          ))}
        </section>
      )}

      {(ecussons.length > 0 || medailles.length > 0) && (
        <section className="flex flex-col gap-2.5">
          <h3 className="mono-label text-muted-foreground">Badges</h3>
          <div className="flex items-end gap-3 overflow-x-auto pb-1">
            {ecussons.map((e) => (
              <div key={e.def.id} className="flex shrink-0 flex-col items-center gap-1">
                <Ecusson id={e.def.id} rang={e.meilleur!.rang} largeur={46} />
                <span className="text-[10.5px] font-bold">{e.def.nom}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {ordinal(e.meilleur!.rang)} · {e.meilleur!.saison}
                </span>
              </div>
            ))}
            {ecussons.length > 0 && medailles.length > 0 && <span aria-hidden className="mb-9 h-10 w-px shrink-0 bg-foreground/15" />}
            {medailles.slice(0, MEDAILLES).map((e) => (
              <div key={e.def.id} className="flex shrink-0 flex-col items-center gap-1">
                <Medaille e={e} diametre={44} />
                <span className="text-[10.5px] font-bold">{e.def.nom}</span>
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{e.valeur}</span>
              </div>
            ))}
            {medailles.length > MEDAILLES && (
              <span className="mb-9 ml-auto shrink-0 font-mono text-[12px] font-bold text-muted-foreground">+{medailles.length - MEDAILLES}</span>
            )}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={voirEnGrand}
        className="mt-1 flex h-12 items-center justify-center rounded-full bg-foreground text-[15px] font-semibold text-background"
      >
        Voir sa carte en grand
      </button>
    </div>
  );
}
