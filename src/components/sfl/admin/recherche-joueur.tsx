"use client";

// Le champ « Trouver un joueur » des écrans d'admin : il filtre à la frappe,
// s'efface d'un geste, et Entrée prend le premier résultat. Le même partout —
// la liste des joueurs, la requalification, l'ajout à une journée.

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function RechercheJoueur({
  valeur,
  onChange,
  onEntree,
  resultats,
  placeholder = "Trouver un joueur…",
  autoFocus = false,
  className,
}: {
  valeur: string;
  onChange: (v: string) => void;
  /** Entrée : prendre le premier résultat. */
  onEntree?: () => void;
  /** Le nombre de résultats, affiché quand on filtre. */
  resultats?: number;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("flex h-10 items-center gap-2 rounded-full bg-secondary px-3", className)}>
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <input
        type="search"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEntree?.();
          } else if (e.key === "Escape") {
            onChange("");
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="go"
        className="min-w-0 flex-1 bg-transparent text-ligne outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {valeur ? (
        <>
          {resultats != null && (
            <span className="shrink-0 text-legende text-muted-foreground tabular-nums">
              {resultats === 0 ? "aucun" : resultats}
            </span>
          )}
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Effacer la recherche"
            className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground/10 text-encre-2"
          >
            <X className="size-3" strokeWidth={2.5} />
          </button>
        </>
      ) : null}
    </label>
  );
}
