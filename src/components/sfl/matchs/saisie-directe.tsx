"use client";

// La feuille de match en direct, dans la fiche du match (Map).
//
// Le jour du match, un joueur du match touche « Tenir la feuille » : elle est
// à lui. Il note au bord du terrain, joueur par joueur, buts, passes
// décisives, arrêts et interceptions ; le score et les classements bougent
// chez tout le monde. Les autres voient qui la tient et suivent le score, sans
// pouvoir y écrire. « Fin du match » la ferme : le score donne le résultat.
// Un admin peut la reprendre ou la rouvrir à tout moment.
//
// Le verrou et les chiffres vivent en base (lib/sfl/direct.ts) ; ce fichier
// n'est que l'écran.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { useSeason } from "@/components/sfl/season-provider";
import { useSession } from "@/hooks/use-session";
import { useFeuillesDirect } from "@/hooks/use-direct";
import {
  compteursDe,
  feuilleDuMatch,
  finirFeuille,
  noterFeuille,
  prendreFeuille,
  reprendreFeuille,
  ZERO,
  type CompteurDirect,
  type Compteurs,
  type FeuilleDirect,
} from "@/lib/sfl/direct";
import { voteOuvert } from "@/lib/sfl/convocation-temps";
import { couleurEquipe } from "@/lib/sfl/feuille";
import type { JourneeMatch } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

const COMPTEURS: { key: CompteurDirect; label: string }[] = [
  { key: "buts", label: "Buts" },
  { key: "passes", label: "Passes D" },
  { key: "arrets", label: "Arrêts" },
  { key: "interceptions", label: "Interc." },
];

export function SaisieDirecte({ j }: { j: number }) {
  const { saison, journees } = useSeason();
  const session = useSession();
  const feuilles = useFeuillesDirect();
  const numero = saison.numero ?? 0;
  const meta = saison.journees.find((m) => m.j === j);
  const matchs = useMemo(() => journees.find((x) => x.j === j)?.matches ?? [], [journees, j]);
  if (!session?.server || !meta || !matchs.length) return null;

  const moi = session.name;
  const admin = !!session.admin;
  const jourJ = voteOuvert(meta.date, new Date());
  const joue = (m: JourneeMatch) => [...m.teamA.players, ...m.teamB.players].some((p) => p.name === moi);
  const mien = matchs.find(joue);

  const blocs = matchs.filter((m) => {
    if (admin || feuilleDuMatch(feuilles, numero, j, m.id)) return true;
    return m === mien && jourJ;
  });
  if (!blocs.length) return null;

  return (
    <section className="flex flex-col gap-3">
      <p className="mono-label pl-1 text-muted-foreground">En direct</p>
      {blocs.map((m) => (
        <BlocMatch
          key={m.id}
          match={m}
          cle={{ saison: numero, j, matchId: m.id }}
          feuille={feuilleDuMatch(feuilles, numero, j, m.id)}
          plusieurs={matchs.length > 1}
          moi={moi}
          admin={admin}
          depart={() => {
            // Les chiffres déjà saisis par l'admin, pour que la feuille parte d'eux.
            const out: Record<string, Compteurs> = {};
            for (const e of saison.entries) {
              if (e.j !== j || e.extraTime || e.statut !== "Présent") continue;
              if (e.team !== m.teamA.name && e.team !== m.teamB.name) continue;
              const c = compteursDe(e);
              if (Object.values(c).some((n) => n > 0)) out[e.player] = c;
            }
            return out;
          }}
        />
      ))}
    </section>
  );
}

function BlocMatch({
  match,
  cle,
  feuille,
  plusieurs,
  moi,
  admin,
  depart,
}: {
  match: JourneeMatch;
  cle: { saison: number; j: number; matchId: string };
  feuille: FeuilleDirect | null;
  plusieurs: boolean;
  moi: string;
  admin: boolean;
  depart: () => Record<string, Compteurs>;
}) {
  const [occupe, setOccupe] = useState(false);
  const [fin, setFin] = useState(false);
  const [equipe, setEquipe] = useState<"A" | "B">(() =>
    match.teamB.players.some((p) => p.name === moi) ? "B" : "A"
  );

  async function faire(geste: () => Promise<unknown>) {
    setOccupe(true);
    try {
      await geste();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pas enregistré.");
    } finally {
      setOccupe(false);
    }
  }

  const prendre = () =>
    faire(async () => {
      const f = await prendreFeuille(cle, depart());
      if (f.teneur !== moi) toast(`${f.teneur} tient déjà la feuille.`);
    });

  const titre = plusieurs ? match.label : null;
  const tableau = (
    <div className="flex items-center justify-center gap-4 rounded-[22px] bg-secondary px-4 py-3">
      <Score nom={match.teamA.name} score={match.teamA.score} />
      <span className="text-foreground/25">—</span>
      <Score nom={match.teamB.name} score={match.teamB.score} inverse />
    </div>
  );

  if (!feuille) {
    return (
      <div className="flex flex-col gap-2">
        {titre && <p className="pl-1 text-[13px] font-semibold">{titre}</p>}
        <button
          type="button"
          disabled={occupe}
          onClick={prendre}
          className="flex h-12 items-center justify-center rounded-full bg-foreground text-[15px] font-semibold text-background disabled:opacity-50"
        >
          Tenir la feuille du match
        </button>
      </div>
    );
  }

  const aMoi = feuille.teneur === moi;
  const ecrit = aMoi && (!feuille.finie || admin);
  const eq = equipe === "A" ? match.teamA : match.teamB;
  const valeurs = (nom: string): Compteurs => feuille.stats[nom] ?? ZERO;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 pl-1">
        <p className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
          {titre ? <span className="font-semibold text-foreground">{titre} · </span> : null}
          {feuille.finie ? "Terminé" : aMoi ? "Tu tiens la feuille" : `Tenue par ${feuille.teneur}`}
        </p>
        {admin && !aMoi && (
          <button
            type="button"
            disabled={occupe}
            onClick={() => faire(() => reprendreFeuille(cle))}
            className="h-8 shrink-0 rounded-full bg-secondary px-3 text-[12.5px] font-semibold disabled:opacity-50"
          >
            Reprendre
          </button>
        )}
        {admin && feuille.finie && (
          <button
            type="button"
            disabled={occupe}
            onClick={() => faire(() => finirFeuille(cle, false))}
            className="h-8 shrink-0 rounded-full bg-secondary px-3 text-[12.5px] font-semibold disabled:opacity-50"
          >
            Rouvrir
          </button>
        )}
      </div>

      {tableau}

      <div className="flex w-full rounded-full bg-secondary p-[3px]">
        {(["A", "B"] as const).map((k) => {
          const t = k === "A" ? match.teamA : match.teamB;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setEquipe(k)}
              className={cn(
                "flex h-[34px] flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold",
                equipe === k ? "bg-foreground text-background" : "text-foreground"
              )}
            >
              <span className="size-2 rounded-full" style={{ background: couleurEquipe(t.name) }} />
              {t.name}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {eq.players.map((p) => {
          const v = valeurs(p.name);
          return (
            <div key={p.name} className="rounded-[22px] bg-secondary px-3.5 pt-3 pb-3.5">
              <p className="mb-2.5 truncate text-[15px] font-bold tracking-tight">{p.name}</p>
              <div className="flex gap-2">
                {COMPTEURS.map((c) => (
                  <Compteur
                    key={c.key}
                    label={c.label}
                    value={v[c.key]}
                    actif={ecrit}
                    onSet={(n) =>
                      noterFeuille(cle, p.name, { ...v, [c.key]: n }).catch((e: unknown) =>
                        toast.error(e instanceof Error ? e.message : "Pas enregistré.")
                      )
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {aMoi && !feuille.finie && (
        <button
          type="button"
          disabled={occupe}
          onClick={() => (fin ? faire(() => finirFeuille(cle, true)) : setFin(true))}
          onBlur={() => setFin(false)}
          className={cn(
            "flex h-12 items-center justify-center rounded-full text-[15px] font-semibold disabled:opacity-50",
            fin ? "bg-foreground text-background" : "bg-secondary"
          )}
        >
          {fin ? `Confirmer : ${match.teamA.score} — ${match.teamB.score}` : "Fin du match"}
        </button>
      )}
    </div>
  );
}

function Score({ nom, score, inverse }: { nom: string; score: number; inverse?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", inverse && "flex-row-reverse")}>
      <span className="size-2.5 rounded-full" style={{ background: couleurEquipe(nom) }} />
      <span className="text-[13px] font-semibold text-muted-foreground">{nom}</span>
      <span className="text-[26px] font-extrabold tabular-nums">{score}</span>
    </span>
  );
}

function Compteur({
  label,
  value,
  actif,
  onSet,
}: {
  label: string;
  value: number;
  actif: boolean;
  onSet: (n: number) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className="mono-label text-[8px] text-foreground/40">{label}</span>
      {actif ? (
        <div className="flex w-full items-center justify-between rounded-full bg-background p-1">
          <button
            type="button"
            onClick={() => onSet(Math.max(0, value - 1))}
            aria-label={`${label} moins`}
            disabled={value === 0}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-foreground/50 active:bg-foreground/10 disabled:opacity-25"
          >
            <Minus className="size-3.5" />
          </button>
          <span className={cn("min-w-[18px] text-center text-[15px] font-extrabold tabular-nums", value === 0 && "text-foreground/25")}>
            {value}
          </span>
          <button
            type="button"
            onClick={() => {
              onSet(Math.min(99, value + 1));
              navigator.vibrate?.(10);
            }}
            aria-label={`${label} plus`}
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform active:scale-90"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      ) : (
        <span className={cn("h-9 text-center text-[17px] leading-9 font-extrabold tabular-nums", value === 0 && "text-foreground/25")}>
          {value}
        </span>
      )}
    </div>
  );
}
