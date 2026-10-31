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
import { PointMaillot } from "@/components/sfl/point-maillot";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { EquipeDuJour } from "@/lib/sfl/saisie/equipes";
import { effectifJouable } from "@/lib/sfl/saisie/effectif";
import { chercherTolerant } from "@/lib/sfl/recherche-tolerante";
import type { MatchEntry, Saison } from "@/lib/sfl/saisie/types";

export function ChangerJoueurSheet({
  saison,
  ligne,
  equipes,
  onOpenChange,
  onRemplacer,
  onChangerEquipe,
  onEchanger,
}: {
  saison: Saison;
  /** La ligne touchée ; null = panneau fermé. */
  ligne: MatchEntry | null;
  /** Les équipes de la journée, match par match (saisie/equipes.ts). */
  equipes: EquipeDuJour[];
  onOpenChange: (open: boolean) => void;
  onRemplacer: (nom: string) => void;
  onChangerEquipe: (team: string) => void;
  /** Échanger les camps avec un joueur d'en face (jamais deux fois le même nom sur la journée). */
  onEchanger?: (autre: MatchEntry) => void;
}) {
  const [q, setQ] = useState("");

  // Les joueurs de la ligue qui ne sont pas déjà sur la feuille de la journée.
  const candidats = useMemo(() => {
    if (!ligne) return [];
    const surLaFeuille = new Set(
      saison.entries.filter((e) => e.j === ligne.j && !e.extraTime).map((e) => e.player.toLowerCase())
    );
    // L'effectif qui joue (jamais un membre qui ne joue pas), même mal écrit.
    const libres = effectifJouable(saison)
      .map((r) => r.name)
      .filter((n) => !surLaFeuille.has(n.toLowerCase()));
    return chercherTolerant(libres, (n) => [n], q);
  }, [saison, ligne, q]);

  const autres = ligne ? equipes.filter((t) => t.nom !== ligne.team) : [];
  // L'adversaire de son match : on échange les camps, pas les noms.
  const enFace = useMemo(() => {
    if (!ligne?.team) return [];
    const sienne = equipes.find((t) => t.nom === ligne.team);
    const adverse = equipes.find((t) => t.match != null && t.match === sienne?.match && t.nom !== ligne.team);
    return adverse ? saison.entries.filter((e) => e.j === ligne.j && e.team === adverse.nom && !e.extraTime) : [];
  }, [ligne, equipes, saison.entries]);
  const sienne = ligne ? equipes.find((t) => t.nom === ligne.team) : undefined;

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
                  <span className="mt-1 flex items-center gap-1.5 text-corps text-encre-3">
                    {sienne?.camp && <PointMaillot camp={sienne.camp} />}
                    {sienne?.libelle ?? ligne.team}
                  </span>
                )}
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-4 pb-8">
              {autres.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="mono-label text-encre-3">Changer d&apos;équipe</h3>
                  <div className="flex flex-wrap gap-2">
                    {autres.map((t) => (
                      <button
                        key={t.nom}
                        onClick={() => {
                          onChangerEquipe(t.nom);
                          setQ("");
                        }}
                        className="bouton-secondaire flex items-center gap-2 px-4 py-2.5 text-ligne font-semibold"
                      >
                        {t.camp && <PointMaillot camp={t.camp} />}
                        {t.libelle}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {onEchanger && enFace.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="mono-label text-encre-3">Échanger avec</h3>
                  <div className="flex flex-wrap gap-2">
                    {enFace.map((e) => (
                      <button
                        key={e.player}
                        onClick={() => onEchanger(e)}
                        className="bouton-secondaire flex items-center gap-2 py-1.5 pr-4 pl-1.5 text-ligne font-semibold"
                      >
                        <CarteDe name={e.player} size={FORMAT_CARTE.petite * 0.7} inerte />
                        {e.player}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="flex flex-col gap-2">
                <h3 className="mono-label text-encre-3">Remplacer par</h3>
                <label className="glass-soft flex h-10 items-center gap-2 rounded-full px-3.5">
                  <Search className="size-4 text-encre-4" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Chercher un joueur"
                    className="min-w-0 flex-1 bg-transparent text-titre outline-none placeholder:text-encre-4"
                  />
                </label>
                {candidats.length === 0 ? (
                  <p className="px-1 py-3 text-corps text-encre-3">Personne d&apos;autre</p>
                ) : (
                  <ul className="flex flex-col">
                    {candidats.map((n) => (
                      <li key={n}>
                        <button
                          onClick={() => {
                            onRemplacer(n);
                            setQ("");
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl px-1 py-1.5 text-left transition-colors active:bg-contraste/8"
                        >
                          <CarteDe name={n} size={FORMAT_CARTE.petite} inerte />
                          <span className="min-w-0 flex-1 truncate text-lecture font-semibold">{n}</span>
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
