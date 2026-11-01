"use client";

// Requalification des cartes — toutes les fiches sur une seule grille.
//
// À l'ouverture d'une saison, les admins revoient la carte de chacun : les six
// stats de base (VIT TIR PAS DRI DEF PHY) qui font la note générale. La fiche
// joueur permet déjà de le faire un par un ; ici on le fait pour tout l'effectif
// d'un coup, avec sous les yeux ce que le joueur a produit la saison passée —
// on requalifie sur des faits, pas de mémoire.
//
// Six tuiles sur grand écran, trois par rangée sur téléphone : chaque tuile
// doit loger « − valeur + » (72 px) sans empiéter sur sa voisine.
//
// Chaque modification passe par `commit` : elle s'annule au ⌘Z comme le reste,
// et part en base comme le reste.

import { useMemo, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RechercheJoueur } from "@/components/sfl/admin/recherche-joueur";
import { chercherJoueurs } from "@/lib/sfl/recherche-joueur";
import { computeStandings } from "@/lib/sfl/saisie/engine";
import { saisonDepuisArchive, updateRosterAt } from "@/lib/sfl/saisie/mutations";
import type { RosterEntry, Saison } from "@/lib/sfl/saisie/types";
import { cn } from "@/lib/utils";

const STATS = ["VIT", "TIR", "PAS", "DRI", "DEF", "PHY"] as const;
const BASE_DEFAUT = [75, 75, 75, 75, 75, 75];

const ovrDe = (base: number[]) => Math.ceil(base.reduce((a, b) => a + b, 0) / 6);

export function Requalification({
  saison,
  onCommit,
}: {
  saison: Saison;
  onCommit: (next: Saison, label: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const derniere = saison.archives?.[saison.archives.length - 1];

  // Ce que chacun a produit la saison passée : la référence pour requalifier.
  const reference = useMemo(() => {
    if (!derniere) return new Map<string, { pp: number; matchs: number; buts: number; passes: number }>();
    const players = computeStandings(saisonDepuisArchive(derniere));
    return new Map(players.map((p) => [p.name, { pp: p.pp, matchs: p.matchs, buts: p.buts, passes: p.passes }]));
  }, [derniere]);

  const lignes = useMemo(
    () =>
      saison.roster
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.profil !== "En attente")
        .sort((a, b) => a.r.name.localeCompare(b.r.name)),
    [saison.roster]
  );
  const visibles = useMemo(() => chercherJoueurs(lignes, (l) => l.r.name, recherche), [lignes, recherche]);

  function poser(i: number, r: RosterEntry, k: number, v: number) {
    const base = [...(r.base ?? BASE_DEFAUT)];
    base[k] = Math.max(40, Math.min(99, v));
    onCommit(updateRosterAt(saison, i, { base }), `Carte — ${r.name} ${STATS[k]} ${base[k]}`);
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-card">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-lecture font-bold tracking-tight">Requalifier les cartes</span>
          <span className="block text-petit text-muted-foreground">
            {lignes.length} joueurs · les six stats de base, toutes sur une grille
            {derniere ? ` · référence : ${derniere.nom}` : ""}
          </span>
        </span>
        <span className="text-petit font-semibold text-primary">{ouvert ? "Fermer" : "Ouvrir"}</span>
      </button>

      {ouvert && (
        <div className="border-t border-border/60">
          <div className="px-4 pt-3">
            <RechercheJoueur valeur={recherche} onChange={setRecherche} resultats={visibles.length} autoFocus />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 text-etiquette font-semibold tracking-wide text-muted-foreground uppercase">
            <span className="w-[88px] shrink-0">Joueur</span>
            {derniere && <span className="w-[72px] shrink-0 text-center">{derniere.nom.replace("Saison ", "S")} pp·b·p</span>}
            <span className="flex-1" />
            <span className="w-9 text-center">OVR</span>
          </div>
          {visibles.map(({ r, i }) => {
            const base = r.base ?? BASE_DEFAUT;
            const ref = reference.get(r.name);
            return (
              <div key={r.name} className="border-t border-border/40 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-[88px] shrink-0 truncate text-ligne font-semibold">{r.name}</span>
                  {derniere && (
                    <span className="w-[72px] shrink-0 text-center text-legende text-muted-foreground tabular-nums">
                      {ref ? `${ref.pp}·${ref.buts}·${ref.passes}` : "—"}
                    </span>
                  )}
                  <span className="flex-1" />
                  <span className={cn("w-9 text-center text-lecture font-black tabular-nums", !r.base && "text-muted-foreground")}>
                    {ovrDe(base)}
                  </span>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-1 sm:grid-cols-6">
                  {STATS.map((nom, k) => (
                    <div key={nom} className="flex flex-col items-center rounded-xl bg-secondary/60 py-1">
                      <span className="text-micro font-bold tracking-wider text-muted-foreground">{nom}</span>
                      <div className="flex items-center gap-0.5">
                        <button type="button" aria-label={`${nom} −1`} onClick={() => poser(i, r, k, base[k] - 1)}
                          className="bouton-discret grid size-6 place-items-center">
                          <Minus className="size-3" />
                        </button>
                        <span className="w-6 text-center text-corps font-bold tabular-nums">{base[k]}</span>
                        <button type="button" aria-label={`${nom} +1`} onClick={() => poser(i, r, k, base[k] + 1)}
                          className="bouton-discret grid size-6 place-items-center">
                          <Plus className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-2.5">
            <p className="text-legende text-muted-foreground">
              Entre 40 et 99. La note générale est la moyenne des six, arrondie au-dessus.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="bouton--rouge rounded-full text-petit"
              onClick={() => {
                // Remise à 75 partout : le point de départ neutre d'une saison.
                let next = saison;
                saison.roster.forEach((r, i) => {
                  next = updateRosterAt(next, i, { base: [...BASE_DEFAUT] });
                });
                onCommit(next, "Cartes — toutes remises à 75");
              }}
            >
              <RotateCcw className="mr-1 size-3.5" /> Tout à 75
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
