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
//
// Depuis le 23/10, chaque match se joue les Noirs contre les Blancs (Sabri :
// « On oublie les couleurs […]. Noir contre blanc, juste match 1 et match 2,
// c'est ça qui les diffère ») : on compose les Noirs et les Blancs de chaque
// match, et chacun peut recevoir ici son heure, son terrain et son lieu
// (vides : ceux de la journée).

import { Fragment, useMemo, useState } from "react";
import { Dices, Users, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PointMaillot } from "@/components/sfl/point-maillot";
import { cn } from "@/lib/utils";
import {
  generateBalancedTeams,
  TEAM_PRESETS,
  type BalancedPlayer,
  type BalancedTeam,
} from "@/lib/sfl/saisie/mutations";
import { lireEquipe } from "@/lib/sfl/saisie/equipes";

/** L'heure, le terrain et le lieu d'un match ; vides, ceux de la journée. */
export interface ReglageMatch {
  heure?: string;
  terrain?: string;
  lieuId?: number;
}

/** Le vestiaire : les joueurs retenus qu'on n'a pas encore placés. */
const A_PLACER = "—";

export function NewJourneeSheet({
  open,
  onOpenChange,
  roster,
  initialChecked = [],
  lieux = [],
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Joueurs sélectionnables (nom + OVR de la carte + dispo). */
  roster: { name: string; ovr: number; actif: boolean }[];
  /** Pré-cochés à l'ouverture (ex. confirmés de la convocation). */
  initialChecked?: string[];
  /** Les lieux de la ligue (saison.terrains). */
  lieux?: { id: number; nom: string }[];
  /** Les équipes, Noirs puis Blancs match par match, et le réglage de chaque match. */
  onCreate: (teams: BalancedTeam[], reglages: ReglageMatch[]) => void;
}) {
  const [teamCount, setTeamCount] = useState(2);
  // joueur → équipe (ou A_PLACER). Absent de la table = pas retenu.
  const [affectation, setAffectation] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialChecked.map((n) => [n, A_PLACER]))
  );
  const [pinceau, setPinceau] = useState<string>(TEAM_PRESETS[0]);
  // Match par match (0 pour le Match 1) : son heure, son terrain, son lieu.
  const [reglages, setReglages] = useState<ReglageMatch[]>([]);
  const regler = (i: number, r: ReglageMatch) =>
    setReglages((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...r };
      return next;
    });

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
    setReglages([]);
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
    onCreate(teams, Array.from({ length: teamCount / 2 }, (_, i) => reglages[i] ?? {}));
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
          {/* Combien de matchs */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Matchs</span>
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
                    "px-3.5 py-1.5 text-corps font-semibold",
                    teamCount === n ? "bouton-principal" : "bouton-secondaire text-muted-foreground"
                  )}
                >
                  {n / 2}
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
            <div className="flex flex-wrap items-center gap-1.5">
              {[...equipes, A_PLACER].map((eq, i) => {
                const actif = pinceau === eq;
                const n = eq === A_PLACER ? aPlacer.length : (parEquipe.get(eq)?.length ?? 0);
                const membres = eq === A_PLACER ? aPlacer : (parEquipe.get(eq) ?? []);
                const moyenne = membres.length
                  ? Math.round(
                      membres.reduce((s, m) => s + (ovrDe.get(m) ?? 75), 0) / membres.length
                    )
                  : 0;
                // Les Noirs et les Blancs de chaque match, deux par deux.
                const lu = eq === A_PLACER ? null : lireEquipe(eq);
                const match = eq !== A_PLACER && i % 2 === 0 && teamCount > 2 ? i / 2 + 1 : null;
                return (
                  <Fragment key={eq}>
                  {match != null && (
                    <span className={cn("mono-label w-full text-muted-foreground", i > 0 && "mt-1")}>
                      Match {match}
                    </span>
                  )}
                  {eq === A_PLACER && teamCount > 2 && <span className="mt-1 w-full" />}
                  <button
                    type="button"
                    onClick={() => setPinceau(eq)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-corps font-semibold",
                      actif
                        ? "bouton-principal"
                        : "bouton-secondaire text-muted-foreground"
                    )}
                  >
                    {lu && <PointMaillot camp={lu.camp} />}
                    {eq === A_PLACER ? "Vestiaire" : (lu?.camp ?? eq)}
                    <span className="tabular-nums opacity-70">{n}</span>
                    {moyenne > 0 && eq !== A_PLACER && (
                      <span className="text-etiquette opacity-55 tabular-nums">Ø{moyenne}</span>
                    )}
                  </button>
                  </Fragment>
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
                  className="bouton-discret bouton--vert -mx-2 flex items-center gap-1 px-2 py-1 text-corps font-semibold disabled:opacity-35"
                >
                  <Dices className="size-3.5" /> Répartir le vestiaire
                </button>
                <button
                  type="button"
                  onClick={viderEquipes}
                  disabled={retenus.length === 0}
                  className="bouton-discret bouton--rouge -mx-2 flex items-center gap-1 px-2 py-1 text-corps font-semibold disabled:opacity-35"
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
                const lu = place ? lireEquipe(eq) : null;
                return (
                  <button
                    key={r.name}
                    type="button"
                    disabled={!r.actif}
                    onClick={() => toucher(r.name)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-3 py-2 text-left text-corps font-medium transition-colors",
                      !r.actif && "opacity-35",
                      place
                        ? "border-foreground/25 bg-secondary"
                        : auVestiaire
                          ? "border-primary/60 bg-primary/8"
                          : "border-border/60 bg-card hover:bg-secondary"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {lu ? (
                        <PointMaillot camp={lu.camp} />
                      ) : (
                        <span className="size-2.5 shrink-0 rounded-full ring-1 ring-border" />
                      )}
                      <span className="truncate">{r.name}</span>
                      {lu && teamCount > 2 && (
                        <span className="shrink-0 text-etiquette font-semibold text-muted-foreground tabular-nums">
                          M{lu.n}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-legende text-muted-foreground tabular-nums">
                      {r.ovr}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chaque match : son heure, son terrain sur place, son lieu. */}
          <div className="flex flex-col gap-2.5">
            <span className="text-sm font-semibold">{teamCount > 2 ? "Les matchs" : "Le match"}</span>
            {Array.from({ length: teamCount / 2 }, (_, i) => {
              const r = reglages[i] ?? {};
              return (
                <div key={i} className="flex flex-col gap-1.5">
                  {teamCount > 2 && <span className="mono-label text-muted-foreground">Match {i + 1}</span>}
                  <div className="grid grid-cols-[4.75rem_5.5rem_minmax(0,1fr)] gap-2">
                    <Input
                      value={r.heure ?? ""}
                      placeholder="Heure"
                      aria-label={`Heure du Match ${i + 1}`}
                      onChange={(e) => regler(i, { heure: e.target.value })}
                    />
                    <Input
                      value={r.terrain ?? ""}
                      placeholder="Terrain"
                      aria-label={`Terrain du Match ${i + 1}`}
                      onChange={(e) => regler(i, { terrain: e.target.value })}
                    />
                    <select
                      value={r.lieuId ?? ""}
                      aria-label={`Lieu du Match ${i + 1}`}
                      onChange={(e) => regler(i, { lieuId: e.target.value ? Number(e.target.value) : undefined })}
                      className="h-9 min-w-0 rounded-md border border-input bg-transparent px-2 text-sm"
                    >
                      <option value="">Lieu de la journée</option>
                      {lieux.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          {blocage && <p className="text-center text-xs text-muted-foreground">{blocage}</p>}

          <Button variant="vert" disabled={!pret} onClick={creer} className="font-semibold">
            Créer la journée ({retenus.length} joueurs)
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
