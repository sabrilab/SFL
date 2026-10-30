"use client";

// Préparer la J5 : créer une journée comme un joueur ouvre un match
// (ouvrir-match.tsx) — QUAND (les dimanches, le prochain d'abord, et l'heure),
// OÙ (les terrains de la ligue), MATCHS (combien, le nombre tiré des « Je
// viens »), et, si la convocation a déjà ses équipes, les poser d'un coup.
// Le bouton dit le résultat : « Préparer la J5 · dim 9 nov. ». Une journée
// existe déjà ce dimanche-là : il devient « Ouvrir la J5 » (une seule
// journée par dimanche). Elle naît en brouillon : seule l'organisation la voit.

import { useMemo, useState } from "react";
import { TERRAINS_MAX } from "@/lib/sfl/equipes-division";
import { labelDateFr, prochainDimanche } from "@/lib/sfl/convocation-temps";
import { ajouterMatch, journeeDeLaDate, libelleCourt, poserEquipes, preparerJournee, updateJournee } from "@/lib/sfl/saisie/mutations";
import type { ConvocationTeam, Saison } from "@/lib/sfl/saisie/types";
import { haptique } from "@/lib/sfl/haptique";
import { Etiquette, Feuille, Pastille, PastilleEtat } from "./ui";

const HEURES = ["10h00", "11h00", "12h30", "13h00", "14h00", "15h00"];

export function dimanchesAVenir(n = 4, maintenant = new Date()): string[] {
  const out: string[] = [];
  let d = maintenant;
  const jour = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", weekday: "short" }).format(d);
  if (jour === "Sun") out.push(libelleCourt(labelDateFr(d)));
  while (out.length < n) {
    d = prochainDimanche(d);
    out.push(libelleCourt(labelDateFr(d)));
  }
  return out;
}

export function FeuillePreparer({
  open,
  onOpenChange,
  saison,
  viennent,
  equipesConvocation,
  par,
  faire,
  onOuverte,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  saison: Saison;
  /** Combien ont dit « Je viens » : le nombre de matchs par défaut. */
  viennent: number;
  /** Les équipes déjà composées pour la convocation (par division), s'il y en a. */
  equipesConvocation: ConvocationTeam[] | null;
  par: string;
  faire: (f: (s: Saison) => Saison, label: string) => boolean;
  onOuverte: (j: number) => void;
}) {
  const dimanches = useMemo(() => dimanchesAVenir(), []);
  const avant = [...saison.journees].sort((a, b) => b.j - a.j)[0];
  // Le premier dimanche encore libre : toucher « J10 + » prépare la J10, pas la J9 déjà posée.
  const [date, setDate] = useState(() => dimanches.find((d) => !journeeDeLaDate(saison, d)) ?? dimanches[0]);
  const [heure, setHeure] = useState(avant?.heure ?? "12h30");
  const [terrainId, setTerrainId] = useState<number | undefined>(avant?.terrainId ?? saison.terrains?.find((t) => t.defaut)?.id);
  const [matchs, setMatchs] = useState(Math.min(TERRAINS_MAX, Math.max(1, Math.round(viennent / 10)) || 1));
  const pleines = (equipesConvocation ?? []).filter((t) => t.players.length > 0);
  const [avecEquipes, setAvecEquipes] = useState(pleines.length >= 2);
  const existante = journeeDeLaDate(saison, date);
  const j = existante?.j ?? saison.journees.reduce((m, x) => Math.max(m, x.j), 0) + 1;
  const heures = [...new Set([...HEURES, heure])].sort();

  function preparer() {
    if (existante) {
      onOuverte(existante.j);
      onOpenChange(false);
      return;
    }
    const ok = faire((s) => {
      const p = preparerJournee(s, date, { brouillon: { par, le: new Date() } });
      let next = updateJournee(p.saison, p.j, { heure, terrainId });
      if (avecEquipes && pleines.length >= 2) next = poserEquipes(next, p.j, pleines, date);
      else for (let k = 0; k < matchs; k++) next = ajouterMatch(next, p.j, {}, TERRAINS_MAX).saison;
      return next;
    }, `J${j} préparée`);
    if (ok) {
      haptique.ajout();
      onOuverte(j);
      onOpenChange(false);
    }
  }

  return (
    <Feuille
      open={open}
      onOpenChange={onOpenChange}
      titre={existante ? `La J${j}` : `Préparer la J${j}`}
      etat={<PastilleEtat etat="brouillon" />}
      bas={
        <button type="button" onClick={preparer} className="bouton-principal h-12 text-[15px] font-semibold">
          {existante
            ? `Ouvrir la J${j}`
            : `Préparer la J${j} · dim ${date}${avecEquipes && pleines.length >= 2 ? ` · ${Math.floor(pleines.length / 2)} match${pleines.length >= 4 ? "s" : ""}` : ` · ${matchs} match${matchs > 1 ? "s" : ""}`}`}
        </button>
      }
    >
      <section className="flex flex-col gap-2">
        <Etiquette>Quand</Etiquette>
        <div className="flex flex-wrap gap-1.5">
          {dimanches.map((d) => (
            <Pastille key={d} actif={d === date} onClick={() => setDate(d)}>
              Dim {d}
              {journeeDeLaDate(saison, d) && <span className="opacity-60">· J{journeeDeLaDate(saison, d)!.j}</span>}
            </Pastille>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {heures.map((h) => (
            <Pastille key={h} actif={h === heure} onClick={() => setHeure(h)}>
              {h}
            </Pastille>
          ))}
        </div>
      </section>

      {(saison.terrains ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <Etiquette>Où</Etiquette>
          <div className="flex flex-wrap gap-1.5">
            {(saison.terrains ?? []).map((t) => (
              <Pastille key={t.id} actif={t.id === terrainId} onClick={() => setTerrainId(t.id)}>
                {t.nom}
              </Pastille>
            ))}
          </div>
        </section>
      )}

      {!existante && (
        <section className="flex flex-col gap-2">
          <Etiquette>Matchs</Etiquette>
          {pleines.length >= 2 && (
            <div className="flex flex-wrap gap-1.5">
              <Pastille actif={avecEquipes} onClick={() => setAvecEquipes(true)}>
                Équipes de la convocation · {pleines.reduce((n, t) => n + t.players.length, 0)}
              </Pastille>
              <Pastille actif={!avecEquipes} onClick={() => setAvecEquipes(false)}>
                Terrains vides
              </Pastille>
            </div>
          )}
          {!(avecEquipes && pleines.length >= 2) && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: TERRAINS_MAX + 1 }, (_, k) => k + 1).map((n) => (
                <Pastille key={n} actif={n === matchs} onClick={() => setMatchs(n)}>
                  {n} match{n > 1 ? "s" : ""}
                </Pastille>
              ))}
            </div>
          )}
          <p className="mono-label text-foreground/45">{viennent} JE VIENS</p>
        </section>
      )}
    </Feuille>
  );
}
