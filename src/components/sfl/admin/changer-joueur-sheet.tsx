"use client";

// Feuille en direct : toucher le nom d'un joueur ouvre ce panneau.
//
// Deux imprévus du bord du terrain (Sabri, 19/10) : un joueur n'est pas venu
// et un autre joue à sa place, ou un joueur change d'équipe. Le remplaçant
// reprend la ligne telle quelle, chiffres compris : c'est lui qui était sur le
// terrain. Le joueur qui change d'équipe emporte ses chiffres avec lui.

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { MatchEntry, Saison } from "@/lib/sfl/saisie/types";

export function ChangerJoueurSheet({
  saison,
  ligne,
  equipes,
  couleur,
  onOpenChange,
  onRemplacer,
  onChangerEquipe,
}: {
  saison: Saison;
  /** La ligne touchée ; null = panneau fermé. */
  ligne: MatchEntry | null;
  /** Les équipes de la journée. */
  equipes: string[];
  couleur: (team: string) => string;
  onOpenChange: (open: boolean) => void;
  onRemplacer: (nom: string) => void;
  onChangerEquipe: (team: string) => void;
}) {
  const [q, setQ] = useState("");

  // Les joueurs de la ligue qui ne sont pas déjà sur la feuille de la journée.
  const candidats = useMemo(() => {
    if (!ligne) return [];
    const surLaFeuille = new Set(
      saison.entries.filter((e) => e.j === ligne.j && !e.extraTime).map((e) => e.player.toLowerCase())
    );
    const cle = q.trim().toLowerCase();
    return saison.roster
      .map((r) => r.name)
      .filter((n) => !surLaFeuille.has(n.toLowerCase()))
      .filter((n) => !cle || n.toLowerCase().includes(cle))
      .sort((a, b) => a.localeCompare(b, "fr"));
  }, [saison.entries, saison.roster, ligne, q]);

  const autres = ligne ? equipes.filter((t) => t !== ligne.team) : [];

  return (
    <Sheet
      open={!!ligne}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQ("");
      }}
    >
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
        {ligne && (
          <>
            <SheetHeader className="flex-row items-center gap-3 px-1">
              <CarteDe name={ligne.player} size={FORMAT_CARTE.moyenne} inerte />
              <div className="min-w-0">
                <SheetTitle className="truncate text-xl">{ligne.player}</SheetTitle>
                {ligne.team && (
                  <span className="mt-1 flex items-center gap-1.5 text-[13px] text-foreground/45">
                    <span className="size-2 rounded-full" style={{ background: couleur(ligne.team) }} />
                    {ligne.team}
                  </span>
                )}
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-4 pb-8">
              {autres.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="mono-label text-foreground/40">Changer d&apos;équipe</h3>
                  <div className="flex flex-wrap gap-2">
                    {autres.map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          onChangerEquipe(t);
                          setQ("");
                        }}
                        className="glass-soft flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-semibold transition-transform active:scale-95"
                      >
                        <span className="size-2.5 rounded-full" style={{ background: couleur(t) }} />
                        {t}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="flex flex-col gap-2">
                <h3 className="mono-label text-foreground/40">Remplacer par</h3>
                <label className="glass-soft flex h-10 items-center gap-2 rounded-full px-3.5">
                  <Search className="size-4 text-foreground/35" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Chercher un joueur"
                    className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-foreground/30"
                  />
                </label>
                {candidats.length === 0 ? (
                  <p className="px-1 py-3 text-[13px] text-foreground/40">Personne d&apos;autre</p>
                ) : (
                  <ul className="flex flex-col">
                    {candidats.map((n) => (
                      <li key={n}>
                        <button
                          onClick={() => {
                            onRemplacer(n);
                            setQ("");
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl px-1 py-1.5 text-left transition-colors active:bg-white/8"
                        >
                          <CarteDe name={n} size={FORMAT_CARTE.petite} inerte />
                          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{n}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
