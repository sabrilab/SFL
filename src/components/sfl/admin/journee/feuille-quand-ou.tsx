"use client";

// Quand et Où : la date, l'heure, le lieu de la journée, puis l'heure, le
// lieu et le terrain de chaque match, et le SFL Time. On règle une COPIE :
// rien n'est écrit avant « Enregistrer », en une seule version (avant le
// 30/10, chaque lettre tapée d'une date partait à toute la ligue). En bas,
// « Jeter le brouillon » pour une journée que la ligue n'a jamais vue, sinon
// « Supprimer la journée » — l'un et l'autre confirmés, rattrapables par la
// corbeille.

import { useState } from "react";
import { reglerMatch, updateJournee } from "@/lib/sfl/saisie/mutations";
import { dejaPubliee } from "@/lib/sfl/saisie/brouillon";
import type { MatchDuJour, Saison } from "@/lib/sfl/saisie/types";
import { haptique } from "@/lib/sfl/haptique";
import { dimanchesAVenir } from "./feuille-preparer";
import { Etiquette, Feuille, Pastille } from "./ui";

const champ = "glass-soft h-11 w-full min-w-0 rounded-full px-4 text-[15px] outline-none placeholder:text-foreground/30";

export function FeuilleQuandOu({
  open,
  onOpenChange,
  saison,
  j,
  matchs,
  focus,
  faire,
  onJeter,
  onSupprimer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  saison: Saison;
  j: number;
  matchs: MatchDuJour[];
  /** Le match à régler d'abord (toucher son heure sur le terrain). */
  focus?: number | null;
  faire: (f: (s: Saison) => Saison, label: string) => boolean;
  onJeter: () => void;
  onSupprimer: () => void;
}) {
  const meta = saison.journees.find((m) => m.j === j);
  const [date, setDate] = useState(meta?.date ?? "");
  const [heure, setHeure] = useState(meta?.heure ?? "");
  const [terrainId, setTerrainId] = useState<number | undefined>(meta?.terrainId);
  const [sflTime, setSflTime] = useState(!!meta?.sflTime);
  const [parMatch, setParMatch] = useState(() => matchs.map((m) => ({ equipes: m.equipes, heure: m.heure ?? "", terrain: m.terrain ?? "", lieuId: m.lieuId })));
  if (!meta) return null;
  const dimanches = [...new Set([meta.date, ...dimanchesAVenir()])];
  const terrains = saison.terrains ?? [];

  function enregistrer() {
    const ok = faire((s) => {
      let next = updateJournee(s, j, { date: date.trim() || meta!.date, terrainId, sflTime, ...(heure.trim() ? { heure: heure.trim() } : {}) });
      for (const m of parMatch) next = reglerMatch(next, j, m.equipes, { heure: m.heure, terrain: m.terrain, lieuId: m.lieuId });
      return next;
    }, `J${j} · quand et où`);
    if (ok) {
      haptique.ajout();
      onOpenChange(false);
    }
  }

  return (
    <Feuille
      open={open}
      onOpenChange={onOpenChange}
      titre={`J${j} · quand et où`}
      bas={
        <>
          <button type="button" onClick={enregistrer} className="bouton-principal h-12 text-[15px] font-semibold">
            Enregistrer
          </button>
          {dejaPubliee(meta) ? (
            <button type="button" onClick={onSupprimer} className="bouton-discret h-10 text-[14px] font-semibold">
              Supprimer la journée
            </button>
          ) : (
            <button type="button" onClick={onJeter} className="bouton-discret h-10 text-[14px] font-semibold">
              Jeter le brouillon
            </button>
          )}
        </>
      }
    >
      <section className="flex flex-col gap-2">
        <Etiquette>Quand</Etiquette>
        <div className="flex flex-wrap gap-1.5">
          {dimanches.map((d) => (
            <Pastille key={d} actif={d === date} onClick={() => setDate(d)}>
              Dim {d}
            </Pastille>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} className={champ} />
          <input aria-label="Heure" value={heure} placeholder="12h30" onChange={(e) => setHeure(e.target.value)} className={champ} />
        </div>
      </section>

      {terrains.length > 0 && (
        <section className="flex flex-col gap-2">
          <Etiquette>Où</Etiquette>
          <div className="flex flex-wrap gap-1.5">
            {terrains.map((t) => (
              <Pastille key={t.id} actif={t.id === terrainId} onClick={() => setTerrainId(t.id)}>
                {t.nom}
              </Pastille>
            ))}
          </div>
        </section>
      )}

      {parMatch.map((m, k) => (
        <section key={m.equipes.join("-")} className={`flex flex-col gap-2 rounded-[22px] p-3 ${focus === k + 1 ? "bg-secondary" : "glass-soft"}`}>
          <Etiquette>Match {k + 1}</Etiquette>
          <div className="grid grid-cols-2 gap-2">
            <input
              aria-label={`Heure du match ${k + 1}`}
              value={m.heure}
              placeholder={heure || "Heure"}
              onChange={(e) => setParMatch((l) => l.map((x, i) => (i === k ? { ...x, heure: e.target.value } : x)))}
              className={champ}
            />
            <input
              aria-label={`Terrain du match ${k + 1}`}
              value={m.terrain}
              placeholder="Terrain"
              onChange={(e) => setParMatch((l) => l.map((x, i) => (i === k ? { ...x, terrain: e.target.value } : x)))}
              className={champ}
            />
          </div>
          {terrains.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <Pastille actif={m.lieuId == null} onClick={() => setParMatch((l) => l.map((x, i) => (i === k ? { ...x, lieuId: undefined } : x)))}>
                Lieu de la journée
              </Pastille>
              {terrains.map((t) => (
                <Pastille key={t.id} actif={m.lieuId === t.id} onClick={() => setParMatch((l) => l.map((x, i) => (i === k ? { ...x, lieuId: t.id } : x)))}>
                  {t.nom}
                </Pastille>
              ))}
            </div>
          )}
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <Etiquette>SFL Time</Etiquette>
        <div className="flex gap-1.5">
          <Pastille actif={sflTime} onClick={() => setSflTime(true)}>
            Oui
          </Pastille>
          <Pastille actif={!sflTime} onClick={() => setSflTime(false)}>
            Non
          </Pastille>
        </div>
      </section>
    </Feuille>
  );
}
