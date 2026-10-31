"use client";

// La fiche d'une ligne : toucher une carte sur le terrain. La carte en grand,
// puis tout ce qu'une ligne porte, dans l'ordre du dimanche : le camp (les
// seuls camps des matchs qui existent), le statut, le résultat, les chiffres
// au pouce (− valeur +), les honneurs, et les deux gestes : Remplacer
// (le sélecteur, sans la feuille ni les non-joueurs) et Retirer.
// Rien n'est perdu de l'ancienne fiche (entry-sheet.tsx) ni de la grille :
// SFL Time, clean sheet, MVP (auto quand la journée le calcule), Impact,
// Défensive, retard, arrêts, interceptions, Xtratime, bonus, mention.

import { useState } from "react";
import { MiniCarte, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { carteNeutre } from "@/components/sfl/qui-vient";
import { useSeason } from "@/components/sfl/season-provider";
import { ChoisirJoueurs } from "@/components/sfl/admin/choisir-joueurs";
import { entryPP } from "@/lib/sfl/saisie/engine";
import type { EquipeDuJour } from "@/lib/sfl/saisie/equipes";
import { changerEquipeAt, remplacerJoueurAt, updateEntryAt } from "@/lib/sfl/saisie/mutations";
import type { MatchEntry, MatchResult, PlayerStatutSaisie, Saison } from "@/lib/sfl/saisie/types";
import { haptique } from "@/lib/sfl/haptique";
import { cn } from "@/lib/utils";
import { Etiquette, Feuille, Pas, Pastille, Segmente } from "./ui";

const STATUTS: PlayerStatutSaisie[] = ["Présent", "Absent justifié", "Absence injustifiée", "Blessure", "Suspendu"];
const RESULTATS: (MatchResult | null)[] = [null, "Victoire", "Nul", "Défaite"];
const MENTIONS = ["", "Extra time", "Coach", "Gardien"];

function Bascule({ libelle, on, onChange, verrou }: { libelle: string; on: boolean; onChange: (v: boolean) => void; verrou?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={!!verrou}
      onClick={() => {
        haptique.choix();
        onChange(!on);
      }}
      className={cn(
        "flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-ligne font-semibold transition-colors disabled:opacity-60",
        on ? "bg-foreground text-background" : "bg-secondary text-encre-2"
      )}
    >
      {libelle}
      {verrou && <span className="mono-label opacity-70">· {verrou}</span>}
    </button>
  );
}

export function FeuilleLigne({
  saison,
  index,
  equipes,
  mvpAuto,
  places,
  onClose,
  faire,
  onRetirer,
}: {
  saison: Saison;
  index: number | null;
  equipes: EquipeDuJour[];
  mvpAuto: boolean;
  places: ReadonlyMap<string, string>;
  onClose: () => void;
  faire: (f: (s: Saison) => Saison, label: string) => boolean;
  onRetirer: (index: number, ligne: MatchEntry) => void;
}) {
  const { allPlayers } = useSeason();
  const [remplacer, setRemplacer] = useState(false);
  const e = index != null ? saison.entries[index] : undefined;
  const open = !!e;
  if (!e || index == null)
    return <Feuille open={false} onOpenChange={() => onClose()} titre="">{null}</Feuille>;

  const player = allPlayers.find((p) => p.name === e.player) ?? carteNeutre(e.player);
  const patch = (p: Partial<MatchEntry>, label: string) =>
    faire((s) => {
      const i = s.entries.findIndex((x, k) => k === index && x.player === e.player && x.j === e.j);
      return i < 0 ? s : updateEntryAt(s, i, p);
    }, `${label} — ${e.player}`);
  const present = e.statut === "Présent";
  const sienne = equipes.find((t) => t.nom === e.team);

  return (
    <>
      <Feuille
        open={open}
        onOpenChange={(o) => !o && onClose()}
        titre={e.player}
        etat={<span className="mono-label text-encre-3">J{e.j} · {entryPP(e)} PP</span>}
        bas={
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setRemplacer(true)} className="bouton-secondaire h-12 text-lecture font-semibold">
              Remplacer
            </button>
            <button type="button" onClick={() => onRetirer(index, e)} className="bouton-secondaire h-12 text-lecture font-semibold">
              Retirer
            </button>
          </div>
        }
      >
        <div className="flex items-center gap-4">
          <MiniCarte player={player} size={FORMAT_CARTE.moyenne} maillot={sienne?.camp ?? undefined} />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="mono-label text-encre-2">{sienne?.libelle ?? "Sans équipe"}</span>
          </div>
        </div>

        <section className="flex flex-col gap-2">
          <Etiquette>Camp</Etiquette>
          <div className="flex flex-wrap gap-1.5">
            {equipes.map((t) => (
              <Pastille
                key={t.nom}
                actif={t.nom === e.team}
                onClick={() =>
                  faire((s) => {
                    const i = s.entries.findIndex((x, k) => k === index && x.player === e.player);
                    return i < 0 ? s : changerEquipeAt(s, i, t.nom);
                  }, `${e.player} → ${t.libelle}`)
                }
              >
                {t.camp === "Noirs" ? "●" : t.camp === "Blancs" ? "○" : ""} {t.court}
              </Pastille>
            ))}
            <Pastille actif={!e.team} onClick={() => patch({ team: null }, "Sans équipe")}>
              Remplaçant
            </Pastille>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <Etiquette>Statut</Etiquette>
          <div className="flex flex-wrap gap-1.5">
            {STATUTS.map((st) => (
              <Pastille key={st} actif={e.statut === st} onClick={() => patch({ statut: st }, st)}>
                {st}
              </Pastille>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <Etiquette>Résultat</Etiquette>
          <Segmente
            label="Résultat"
            options={RESULTATS.map((r) => ({ id: r ?? "", libelle: r ?? "—" }))}
            valeur={e.result ?? ""}
            onChange={(r) => patch({ result: (r || null) as MatchResult | null }, `Résultat ${r || "—"}`)}
          />
        </section>

        <section className={cn("grid grid-cols-2 gap-x-3 gap-y-3", !present && !e.extraTime && "opacity-40")}>
          {(
            [
              ["buts", "Buts"],
              ["passes", "Passes"],
              ["arrets", "Arrêts"],
              ["interceptions", "Interc."],
            ] as const
          ).map(([k, libelle]) => (
            <div key={k} className="flex flex-col gap-1.5">
              <Etiquette>{libelle}</Etiquette>
              <Pas label={libelle} valeur={(e[k] as number | undefined) ?? 0} onChange={(n) => patch({ [k]: n } as Partial<MatchEntry>, libelle)} />
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <Etiquette>Bonus PP</Etiquette>
            <Pas label="Bonus" valeur={e.pepiteBonus ?? 0} min={-9} onChange={(n) => patch({ pepiteBonus: n || undefined }, "Bonus")} />
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <Etiquette>Honneurs</Etiquette>
          <div className="flex flex-wrap gap-1.5">
            <Bascule libelle="MVP" on={e.mvp} verrou={mvpAuto ? "auto" : undefined} onChange={(v) => patch({ mvp: v }, "MVP")} />
            <Bascule libelle="Impact" on={e.impact} onChange={(v) => patch({ impact: v }, "Impact")} />
            <Bascule libelle="Défensive" on={e.def} onChange={(v) => patch({ def: v }, "Défensive")} />
            <Bascule libelle="CS" on={e.cleanSheet} onChange={(v) => patch({ cleanSheet: v }, "Clean sheet")} />
            <Bascule libelle="SFL Time" on={e.sflTime} onChange={(v) => patch({ sflTime: v }, "SFL Time")} />
            <Bascule libelle="Retard" on={e.retard} onChange={(v) => patch({ retard: v }, "Retard")} />
            <Bascule libelle="Extra" on={!!e.extraTime} onChange={(v) => patch({ extraTime: v || undefined }, "Xtratime")} />
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <Etiquette>Mention</Etiquette>
          <div className="flex flex-wrap gap-1.5">
            {MENTIONS.map((m) => (
              <Pastille key={m || "aucune"} actif={(e.note ?? "") === m} onClick={() => patch({ note: m || undefined }, "Mention")}>
                {m || "—"}
              </Pastille>
            ))}
          </div>
        </section>
      </Feuille>

      <ChoisirJoueurs
        open={remplacer}
        onOpenChange={setRemplacer}
        saison={saison}
        titre={`Remplacer ${e.player}`}
        places={places}
        onChoisir={(nom) =>
          faire((s) => {
            const i = s.entries.findIndex((x, k) => k === index && x.player === e.player);
            return i < 0 ? s : remplacerJoueurAt(s, i, nom);
          }, `${e.player} → ${nom}`)
        }
      />
    </>
  );
}
