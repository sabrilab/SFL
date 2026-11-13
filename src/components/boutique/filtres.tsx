"use client";

// Les filtres de la grille : quatre sections repliables, ouvertes à
// l'arrivée. Catégorie et Prix en cases, Couleur en pastilles rondes avec
// leur nom, Taille en boutons rectangulaires. Le même composant sert la
// feuille plein écran du téléphone et le panneau de gauche de l'ordinateur ;
// il ne garde rien : la page lui donne les filtres et reçoit chaque geste
// (la section et la valeur touchées), qu'elle applique à l'adresse du moment.
// `categories` : celles du rayon ; vide, la section Catégorie n'est pas montrée
// (un rayon d'une seule catégorie n'a rien à y choisir).

import { Check } from "lucide-react";
import { COULEURS, TAILLES, TRANCHES, type Filtres as LesFiltres } from "@/lib/boutique/catalogue";
import { TEINTES, type Categorie } from "@/lib/boutique/produits";
import { cn } from "@/lib/utils";
import { Accordeon } from "./accordeon";

function Case({ coche, onChange, children }: { coche: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-lecture">
      <input type="checkbox" checked={coche} onChange={onChange} className="peer sr-only" />
      <span
        className={cn(
          "flex size-[22px] shrink-0 items-center justify-center rounded-[5px] border border-contraste/30 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foreground",
          coche && "border-foreground bg-foreground text-background",
        )}
      >
        {coche && <Check className="size-4" strokeWidth={3} />}
      </span>
      {children}
    </label>
  );
}

export function Filtres({
  filtres,
  categories,
  onBascule,
  className,
}: {
  filtres: LesFiltres;
  categories: readonly Categorie[];
  onBascule: <C extends keyof LesFiltres>(section: C, valeur: LesFiltres[C][number]) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col border-b border-contraste/8", className)}>
      {categories.length > 0 && (
        <Accordeon titre="Catégorie" ouvert>
          {categories.map((c) => (
            <Case key={c} coche={filtres.categories.includes(c)} onChange={() => onBascule("categories", c)}>
              {c}
            </Case>
          ))}
        </Accordeon>
      )}

      <Accordeon titre="Couleur" ouvert>
        <div className="flex gap-6">
          {COULEURS.map((c) => {
            const coche = filtres.couleurs.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={coche}
                onClick={() => onBascule("couleurs", c)}
                className="flex min-w-11 flex-col items-center gap-2 text-corps"
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border border-contraste/25",
                    coche && "outline-2 outline-offset-2 outline-foreground",
                  )}
                  style={{ background: TEINTES[c] }}
                >
                  {coche && <Check className={cn("size-4", c === "Noir" ? "text-[#f4f4f2]" : "text-[#16171a]")} strokeWidth={3} />}
                </span>
                <span className={coche ? "font-bold" : "text-encre-2"}>{c}</span>
              </button>
            );
          })}
        </div>
      </Accordeon>

      <Accordeon titre="Taille" ouvert>
        <div className="grid grid-cols-3 gap-2">
          {TAILLES.map((t) => {
            const coche = filtres.tailles.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={coche}
                onClick={() => onBascule("tailles", t)}
                className={cn(
                  "h-12 rounded-[6px] border text-ligne font-semibold tabular-nums",
                  coche ? "border-foreground bg-foreground text-background" : "border-contraste/20",
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </Accordeon>

      <Accordeon titre="Prix" ouvert>
        {TRANCHES.map((t) => (
          <Case key={t.id} coche={filtres.prix.includes(t.id)} onChange={() => onBascule("prix", t.id)}>
            {t.titre}
          </Case>
        ))}
      </Accordeon>
    </div>
  );
}
