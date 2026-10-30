"use client";

// Le sélecteur de joueurs de l'admin, le même partout (30/10/2026).
//
// Sabri, 29/10 : « Il faudrait des menus déroulants quand on choisit les
// joueurs pour une journée, parce que c'est trop compliqué de les trouver par
// ordre alphabétique. Il faudrait pouvoir affiner la recherche par tout
// moyen, même si on écrit son nom mal orthographié, et qu'on puisse voir
// leur visage sur leur carte. »
//
// Une feuille, au téléphone comme sur ordinateur (le panneau de droite) :
//   · la recherche en tête, tolérante (recherche-tolerante.ts) : sans accents
//     ni casse, les fautes de frappe, le même son ; le nom, le nom affiché,
//     le @pseudo, le poste, la division (« d1 ») et l'équipe du jour ;
//   · des filtres rapides : Je viens, pas encore placés, D1 à D3, les postes ;
//   · chaque joueur avec le visage de sa carte, sa note, son poste ;
//   · un joueur déjà sur la feuille est grisé, avec l'endroit où il est : on
//     ne l'ajoute jamais deux fois ;
//   · les membres qui ne jouent pas n'y sont jamais (effectifJouable).

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { useSeason } from "@/components/sfl/season-provider";
import { useIdentites } from "@/hooks/use-identites";
import { ovr } from "@/lib/sfl/engine";
import { divisionDe, etatDivisions } from "@/lib/sfl/divisions";
import { chercherTolerant } from "@/lib/sfl/recherche-tolerante";
import { effectifJouable } from "@/lib/sfl/saisie/effectif";
import { haptique } from "@/lib/sfl/haptique";
import type { Saison } from "@/lib/sfl/saisie/types";
import { cn } from "@/lib/utils";

type Filtre = "tous" | "viens" | "libres" | `d${1 | 2 | 3}` | `poste:${string}`;

export function ChoisirJoueurs({
  open,
  onOpenChange,
  saison,
  titre = "Ajouter un joueur",
  places,
  viens,
  garder,
  plusieurs,
  onChoisir,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Le document de saison (l'effectif) — jamais une saison filtrée pour écrire. */
  saison: Pick<Saison, "roster">;
  titre?: string;
  /** Qui est déjà placé, et où (placementsDeLaJournee) : grisés, jamais choisis deux fois. */
  places: ReadonlyMap<string, string>;
  /** Ceux qui ont dit « Je viens ». */
  viens?: ReadonlySet<string>;
  /** Le joueur actuel de la ligne (Remplacer) : il reste choisissable. */
  garder?: string;
  /** Plusieurs d'un coup (au plus `max`), validés ensemble. */
  plusieurs?: { max: number; libelle: (n: number) => string; onValider: (noms: string[]) => void };
  onChoisir?: (nom: string) => void;
}) {
  const { saison: lue, allPlayers } = useSeason();
  const ids = useIdentites();
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [coches, setCoches] = useState<string[]>([]);

  const fermer = (o: boolean) => {
    if (!o) {
      setQ("");
      setFiltre("tous");
      setCoches([]);
    }
    onOpenChange(o);
  };

  const parNom = useMemo(() => new Map(allPlayers.map((p) => [p.name.toLowerCase(), p])), [allPlayers]);
  const divisions = useMemo(() => {
    const etat = etatDivisions(lue);
    return (nom: string) => (etat ? divisionDe(etat, nom) : null);
  }, [lue]);

  const joueurs = useMemo(
    () =>
      effectifJouable(saison).map((r) => {
        const p = parNom.get(r.name.toLowerCase());
        const lieu = r.name === garder ? undefined : places.get(r.name.trim().toLowerCase());
        return {
          nom: r.name,
          note: p ? ovr(p.stats) : Math.ceil((r.base ?? [75, 75, 75, 75, 75, 75]).reduce((a, b) => a + b, 0) / 6),
          poste: r.poste && r.poste !== "—" ? r.poste : null,
          division: divisions(r.name),
          viens: !!viens?.has(r.name),
          lieu,
          profil: r.profil,
        };
      }),
    [saison, parNom, places, garder, viens, divisions]
  );

  const postes = useMemo(() => [...new Set(joueurs.map((x) => x.poste).filter((p): p is string => !!p))].sort(), [joueurs]);
  const aDesDivisions = joueurs.some((x) => x.division != null);

  const filtres: [Filtre, string][] = [
    ["tous", "Tous"],
    ...(viens?.size ? ([["viens", "Je viens"]] as [Filtre, string][]) : []),
    ["libres", "Pas placés"],
    ...(aDesDivisions ? ([1, 2, 3] as const).map((d): [Filtre, string] => [`d${d}`, `D${d}`]) : []),
    ...postes.map((p): [Filtre, string] => [`poste:${p}`, p]),
  ];

  const liste = useMemo(() => {
    const garde = joueurs.filter((x) => {
      if (filtre === "viens") return x.viens;
      if (filtre === "libres") return !x.lieu;
      if (filtre.startsWith("poste:")) return x.poste === filtre.slice(6);
      if (/^d\d$/.test(filtre)) return x.division === Number(filtre.slice(1));
      return true;
    });
    // Sans recherche : les « Je viens » pas encore placés d'abord, les placés à la fin.
    const ordre = (x: (typeof garde)[number]) => (x.lieu ? 2 : x.viens ? 0 : 1);
    const range = [...garde].sort((a, b) => ordre(a) - ordre(b) || a.nom.localeCompare(b.nom, "fr"));
    return chercherTolerant(range, (x) => [x.nom, ids.nom(x.nom), ids.pseudo(x.nom), x.poste, x.division ? `d${x.division}` : null, x.lieu], q);
  }, [joueurs, filtre, q, ids]);

  const plein = !!plusieurs && coches.length >= plusieurs.max;

  return (
    <Sheet open={open} onOpenChange={fermer} titre={titre}>
      <SheetContent side="bottom" className="data-[side=bottom]:h-[86dvh] rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-titre-g font-bold tracking-tight">{titre}</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
          <label className="glass-soft flex h-11 items-center gap-2 rounded-full px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom, pseudo, poste, division"
              aria-label="Chercher un joueur"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-lecture outline-none placeholder:text-encre-4"
            />
          </label>
          {filtres.length > 1 && (
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filtres.map(([id, libelle]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filtre === id}
                  onClick={() => {
                    haptique.choix();
                    setFiltre(id);
                  }}
                  className={cn(
                    "mono-label h-8 shrink-0 rounded-full px-3.5",
                    filtre === id ? "bg-foreground text-background" : "bg-secondary text-encre-2"
                  )}
                >
                  {libelle}
                </button>
              ))}
            </div>
          )}
          <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 pb-2" role="listbox" aria-label={titre}>
            {liste.map((x) => {
              const coche = coches.includes(x.nom);
              const bloque = !!x.lieu || (plein && !coche);
              return (
                <button
                  key={x.nom}
                  type="button"
                  role="option"
                  aria-selected={coche}
                  disabled={bloque}
                  onClick={() => {
                    haptique.choix();
                    if (plusieurs) {
                      setCoches((l) => (coche ? l.filter((n) => n !== x.nom) : [...l, x.nom]));
                      return;
                    }
                    onChoisir?.(x.nom);
                    fermer(false);
                  }}
                  className={cn(
                    "flex min-h-[60px] items-center gap-3 rounded-[18px] bg-card px-3 py-2 text-left transition-transform active:scale-[0.98] disabled:active:scale-100",
                    bloque && "[&>*]:opacity-40"
                  )}
                >
                  <CarteDe name={x.nom} size={FORMAT_CARTE.petite} inerte />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-lecture font-semibold">
                      <Nom n={x.nom} />
                    </span>
                    <span className="mono-label truncate text-encre-3">
                      {[String(x.note), x.poste, x.division ? `D${x.division}` : null, x.viens ? "JE VIENS" : null, x.profil !== "Actif" ? x.profil.toUpperCase() : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {x.lieu ? (
                    <span className="mono-label shrink-0 text-right text-encre-2">{x.lieu}</span>
                  ) : plusieurs ? (
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-[26px] shrink-0 place-items-center rounded-full transition-colors",
                        coche ? "bg-foreground text-background" : "shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]"
                      )}
                    >
                      {coche && <Check className="size-4" strokeWidth={3} />}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {liste.length === 0 && <p className="mono-label py-10 text-center text-encre-3">Personne</p>}
          </div>
          {plusieurs && coches.length > 0 && (
            <button
              type="button"
              onClick={() => {
                haptique.ajout();
                plusieurs.onValider(coches);
                fermer(false);
              }}
              className="bouton-principal h-12 shrink-0 text-lecture font-semibold"
            >
              {plusieurs.libelle(coches.length)}
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
