"use client";

// Préparer la J5 : créer une journée comme un joueur ouvre un match
// (ouvrir-match.tsx) — QUAND (les dimanches, le prochain d'abord, et l'heure),
// OÙ (les terrains de la ligue), MATCHS (combien, le nombre tiré des « Je
// viens »), et les « Je viens » de la convocation de ce dimanche déjà posés
// sur les terrains (31/10/2026 : ses équipes si elle en a, sinon celles du
// moteur des divisions ; venus-sur-la-feuille.ts).
// Le bouton dit le résultat : « Préparer la J5 · dim 9 nov. ». Une journée
// existe déjà ce dimanche-là : il devient « Ouvrir la J5 » (une seule
// journée par dimanche). Elle naît en brouillon : seule l'organisation la voit.

import { useMemo, useState } from "react";
import { TERRAINS_MAX } from "@/lib/sfl/equipes-division";
import { labelDateFr, prochainDimanche } from "@/lib/sfl/convocation-temps";
import { ajouterMatch, journeeDeLaDate, libelleCourt, memeDate, poserEquipes, preparerJournee, updateJournee } from "@/lib/sfl/saisie/mutations";
import { equipesDesVenus, joueursPoses } from "@/lib/sfl/saisie/venus-sur-la-feuille";
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
  convocation,
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
  /** La convocation en cours : son dimanche (« Dimanche 1 nov. ») et ses « Je viens », dans l'ordre d'arrivée. */
  convocation: { jour: string; venus: string[] };
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
  const existante = journeeDeLaDate(saison, date);
  const j = existante?.j ?? saison.journees.reduce((m, x) => Math.max(m, x.j), 0) + 1;
  // Les « Je viens » ne valent que pour le dimanche de leur convocation.
  const duDimanche = memeDate(convocation.jour.replace(/^\D+/, ""), date);
  const proposees = useMemo(
    () => (duDimanche ? equipesDesVenus(saison, j, convocation.venus, equipesConvocation) : null),
    [duDimanche, saison, j, convocation.venus, equipesConvocation]
  );
  const [avecVenus, setAvecVenus] = useState(true);
  const poses = joueursPoses(proposees);
  const avecEquipes = avecVenus && !!proposees;
  const heures = [...new Set([...HEURES, heure])].sort();

  function preparer() {
    if (existante) {
      if (avecEquipes && proposees && !faire((s) => poserEquipes(s, existante.j, proposees, date), `${poses} joueurs sur la J${existante.j}`)) return;
      onOuverte(existante.j);
      onOpenChange(false);
      return;
    }
    const ok = faire((s) => {
      const p = preparerJournee(s, date, { brouillon: { par, le: new Date() } });
      let next = updateJournee(p.saison, p.j, { heure, terrainId });
      if (avecEquipes && proposees) next = poserEquipes(next, p.j, proposees, date);
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
        <button type="button" onClick={preparer} className="bouton-principal h-12 text-lecture font-semibold">
          {existante
            ? `Ouvrir la J${j}${avecEquipes ? ` · ${poses} joueurs` : ""}`
            : `Préparer la J${j} · dim ${date}${avecEquipes && proposees ? ` · ${Math.floor(proposees.length / 2)} match${proposees.length >= 4 ? "s" : ""}` : ` · ${matchs} match${matchs > 1 ? "s" : ""}`}`}
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

      {(!existante || proposees) && (
        <section className="flex flex-col gap-2">
          <Etiquette>Matchs</Etiquette>
          {proposees && (
            <div className="flex flex-wrap gap-1.5">
              <Pastille actif={avecVenus} onClick={() => setAvecVenus(true)}>
                {existante ? "Placer les Je viens" : "Je viens de la convocation"} · {poses}
              </Pastille>
              <Pastille actif={!avecVenus} onClick={() => setAvecVenus(false)}>
                {existante ? "Laisser" : "Terrains vides"}
              </Pastille>
            </div>
          )}
          {!existante && !avecEquipes && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: TERRAINS_MAX + 1 }, (_, k) => k + 1).map((n) => (
                <Pastille key={n} actif={n === matchs} onClick={() => setMatchs(n)}>
                  {n} match{n > 1 ? "s" : ""}
                </Pastille>
              ))}
            </div>
          )}
          {avecEquipes && proposees && <EquipesProposees teams={proposees} />}
          <p className="mono-label text-encre-3">{duDimanche ? convocation.venus.length : 0} JE VIENS</p>
        </section>
      )}
    </Feuille>
  );
}

/** Les terrains proposés, en noms : « M1 · Noirs 1 · Ilyes, Sidali… ». */
function EquipesProposees({ teams }: { teams: ConvocationTeam[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: Math.floor(teams.length / 2) }, (_, k) => [teams[k * 2], teams[k * 2 + 1]] as const).map(([a, b], k) => (
        <div key={k} className="glass flex flex-col gap-1 rounded-[18px] px-3 py-2.5">
          <span className="mono-label text-encre-3">M{k + 1}</span>
          {[a, b].map((t) => (
            <p key={t.name} className="text-corps leading-snug">
              <span className="font-semibold">{t.name.replace(/ \d+$/, "")} · {t.players.length}</span>{" "}
              <span className="text-encre-2">{t.players.join(", ")}</span>
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
