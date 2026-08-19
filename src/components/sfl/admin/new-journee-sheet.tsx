"use client";

// Assistant « Nouvelle journée ».
//
// On compose DIRECTEMENT : on choisit une équipe, on touche les joueurs, ils
// y entrent. Auparavant il fallait générer un tirage aléatoire pour pouvoir
// créer la journée — et le tirage obtenu n'était même pas modifiable. Quand
// on sait déjà qui joue avec qui, passer par le hasard pour ensuite tout
// corriger à la main dans la grille n'a aucun sens.
//
// Le tirage équilibré reste là, mais à sa place : un coup de main pour les
// joueurs qu'on n'a pas encore placés, jamais un passage obligé.

import { useMemo, useState } from "react";
import { Dices, Users, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  generateBalancedTeams,
  TEAM_PRESETS,
  type BalancedPlayer,
  type BalancedTeam,
} from "@/lib/sfl/saisie/mutations";

const TEAM_COLORS: Record<string, string> = {
  Orange: "#F9CB9C",
  Bleu: "#C9DAF8",
  Vert: "#D9EAD3",
  Jaune: "#FFF2CC",
  Rouge: "#F4CCCC",
  Gris: "#CCCCCC",
};

/** Le vestiaire : les joueurs retenus qu'on n'a pas encore placés. */
const A_PLACER = "—";

export function NewJourneeSheet({
  open,
  onOpenChange,
  roster,
  initialChecked = [],
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Joueurs sélectionnables (nom + OVR de la carte + dispo). */
  roster: { name: string; ovr: number; actif: boolean }[];
  /** Pré-cochés à l'ouverture (ex. confirmés de la convocation). */
  initialChecked?: string[];
  onCreate: (teams: BalancedTeam[]) => void;
}) {
  const [teamCount, setTeamCount] = useState(2);
  // joueur → équipe (ou A_PLACER). Absent de la table = pas retenu.
  const [affectation, setAffectation] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialChecked.map((n) => [n, A_PLACER]))
  );
  const [pinceau, setPinceau] = useState<string>(TEAM_PRESETS[0]);

  const equipes = useMemo(() => TEAM_PRESETS.slice(0, teamCount), [teamCount]);
  const ovrDe = useMemo(() => new Map(roster.map((r) => [r.name, r.ovr])), [roster]);

  const retenus = Object.keys(affectation);
  const aPlacer = retenus.filter((n) => affectation[n] === A_PLACER);
  const parEquipe = useMemo(() => {
    const m = new Map<string, string[]>(equipes.map((e) => [e, []]));
    for (const [nom, eq] of Object.entries(affectation)) m.get(eq)?.push(nom);
    return m;
  }, [affectation, equipes]);

  /** Touche un joueur : il entre dans l'équipe au pinceau, ou en ressort. */
  function toucher(nom: string) {
    setAffectation((prev) => {
      const next = { ...prev };
      if (next[nom] === pinceau) delete next[nom];
      else next[nom] = pinceau;
      return next;
    });
  }

  /** Répartit les joueurs encore au vestiaire, équilibrés selon l'OVR. */
  function repartir() {
    const restants: BalancedPlayer[] = aPlacer.map((n) => ({ name: n, ovr: ovrDe.get(n) ?? 75 }));
    if (restants.length === 0) return;
    // On repart des équipes déjà composées pour que le tirage les complète
    // au lieu de les écraser : ce qui a été placé à la main est acquis.
    const tirage = generateBalancedTeams(restants, teamCount, equipes);
    setAffectation((prev) => {
      const next = { ...prev };
      // La plus légère d'abord, pour rattraper un déséquilibre existant.
      const ordre = [...equipes].sort(
        (a, b) => (parEquipe.get(a)?.length ?? 0) - (parEquipe.get(b)?.length ?? 0)
      );
      tirage.forEach((t, i) => {
        for (const p of t.players) next[p.name] = ordre[i % ordre.length];
      });
      return next;
    });
  }

  function viderEquipes() {
    setAffectation((prev) =>
      Object.fromEntries(Object.keys(prev).map((n) => [n, A_PLACER]))
    );
  }

  function reset() {
    setAffectation(Object.fromEntries(initialChecked.map((n) => [n, A_PLACER])));
    setTeamCount(2);
    setPinceau(TEAM_PRESETS[0]);
  }

  const equipesGarnies = equipes.filter((e) => (parEquipe.get(e)?.length ?? 0) > 0);
  const pret = aPlacer.length === 0 && equipesGarnies.length === teamCount;
  const blocage =
    retenus.length === 0
      ? "Touche des joueurs pour les faire entrer dans l'équipe choisie."
      : aPlacer.length > 0
        ? `${aPlacer.length} joueur${aPlacer.length > 1 ? "s" : ""} encore au vestiaire.`
        : equipesGarnies.length < teamCount
          ? "Chaque équipe doit avoir au moins un joueur."
          : null;

  function creer() {
    const teams: BalancedTeam[] = equipes.map((nom) => {
      const joueurs = (parEquipe.get(nom) ?? []).map((n) => ({
        name: n,
        ovr: ovrDe.get(n) ?? 75,
      }));
      return {
        name: nom,
        players: joueurs,
        totalOvr: joueurs.reduce((s, p) => s + p.ovr, 0),
      };
    });
    onCreate(teams);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="px-1">
          <SheetTitle className="text-xl">Nouvelle journée</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-1 pb-8">
          {/* Combien d'équipes */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Équipes</span>
            <div className="flex gap-1">
              {[2, 4, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setTeamCount(n);
                    // Les joueurs placés dans une équipe qui disparaît
                    // retournent au vestiaire plutôt que de s'évaporer.
                    const gardees = TEAM_PRESETS.slice(0, n) as readonly string[];
                    setAffectation((prev) =>
                      Object.fromEntries(
                        Object.entries(prev).map(([nom, eq]) => [
                          nom,
                          gardees.includes(eq) ? eq : A_PLACER,
                        ])
                      )
                    );
                    setPinceau(TEAM_PRESETS[0]);
                  }}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                    teamCount === n ? "bg-foreground text-background" : "bg-card text-muted-foreground"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Le pinceau : l'équipe dans laquelle les joueurs touchés entrent. */}
          <div>
            <p className="mb-2 text-sm font-semibold">
              Je compose{" "}
              <span className="font-normal text-muted-foreground">
                — choisis une équipe, puis touche les joueurs
              </span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[...equipes, A_PLACER].map((eq) => {
                const actif = pinceau === eq;
                const n = eq === A_PLACER ? aPlacer.length : (parEquipe.get(eq)?.length ?? 0);
                const membres = eq === A_PLACER ? aPlacer : (parEquipe.get(eq) ?? []);
                const moyenne = membres.length
                  ? Math.round(
                      membres.reduce((s, m) => s + (ovrDe.get(m) ?? 75), 0) / membres.length
                    )
                  : 0;
                return (
                  <button
                    key={eq}
                    type="button"
                    onClick={() => setPinceau(eq)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors",
                      actif
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/60 bg-card text-muted-foreground"
                    )}
                  >
                    {eq !== A_PLACER && (
                      <span
                        className="size-2.5 rounded-full ring-1 ring-black/20"
                        style={{ background: TEAM_COLORS[eq] ?? "#ddd" }}
                      />
                    )}
                    {eq === A_PLACER ? "Vestiaire" : eq}
                    <span className="tabular-nums opacity-70">{n}</span>
                    {moyenne > 0 && eq !== A_PLACER && (
                      <span className="text-[10px] opacity-55 tabular-nums">Ø{moyenne}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Le vivier */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Users className="size-4" /> Effectif
                <span className="text-muted-foreground tabular-nums">({retenus.length} retenus)</span>
              </span>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={repartir}
                  disabled={aPlacer.length === 0}
                  className="flex items-center gap-1 text-[13px] font-semibold text-primary disabled:opacity-35"
                >
                  <Dices className="size-3.5" /> Répartir le vestiaire
                </button>
                <button
                  type="button"
                  onClick={viderEquipes}
                  disabled={retenus.length === 0}
                  className="flex items-center gap-1 text-[13px] font-semibold text-muted-foreground disabled:opacity-35"
                >
                  <Eraser className="size-3.5" /> Vider
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {roster.map((r) => {
                const eq = affectation[r.name];
                const place = eq !== undefined && eq !== A_PLACER;
                const auVestiaire = eq === A_PLACER;
                return (
                  <button
                    key={r.name}
                    type="button"
                    disabled={!r.actif}
                    onClick={() => toucher(r.name)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-3 py-2 text-left text-[13px] font-medium transition-colors",
                      !r.actif && "opacity-35",
                      place
                        ? "border-foreground/25 bg-secondary"
                        : auVestiaire
                          ? "border-primary/60 bg-primary/8"
                          : "border-border/60 bg-card hover:bg-secondary"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={cn(
                          "size-2.5 shrink-0 rounded-full ring-1",
                          place ? "ring-black/20" : "ring-border"
                        )}
                        style={place ? { background: TEAM_COLORS[eq] ?? "#ddd" } : undefined}
                      />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                      {r.ovr}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {blocage && <p className="text-center text-xs text-muted-foreground">{blocage}</p>}

          <Button disabled={!pret} onClick={creer} className="font-semibold">
            Créer la journée ({retenus.length} joueurs)
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
