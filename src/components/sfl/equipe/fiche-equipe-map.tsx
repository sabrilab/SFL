"use client";

// La fenêtre d'une équipe, ouverte depuis son écusson sur la Map (Sabri,
// 23/11/2026 : « une fenêtre avec le trash talk, le clash, la provocation
// […] qu'on puisse affronter une équipe, lui envoyer une demande de
// confrontation et commencer le gameplay de Bola Team »). De haut en bas :
//   · l'écusson en grand, le nom, la ville et l'effectif ; le toucher mène à
//     la page de l'équipe (/bola-team/[id]) ;
//   · son mur (lib/sfl/chambrages.ts) : ce que les autres équipes lui
//     disent, le plus récent en haut, l'écusson de l'auteur devant ;
//   · pour un joueur d'une autre équipe active : les provocations d'un
//     toucher, et sa phrase à lui (140 signes) ;
//   · « Défier » : le défi du mode Team (equipe/defier.tsx), qui part de la
//     Map. Sans équipe, « Monter mon équipe » ; un défi déjà en cours le dit.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUp, ChevronRight, Swords, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { MAX_EQUIPE, active, signataires, type Equipe } from "@/lib/sfl/equipes";
import {
  MAX_CHAMBRAGE,
  PROVOCATIONS,
  chambrer,
  demoChambrages,
  depuis,
  direErreurChambrage,
  lireChambrages,
  retirerChambrage,
  type Chambrage,
} from "@/lib/sfl/chambrages";
import { cn } from "@/lib/utils";

export type DefiPossible = "defier" | "en-cours" | "monter" | null;

export function FicheEquipeMap({
  equipe,
  equipes,
  mienne,
  moiId,
  capitaineIci,
  defi,
  demo,
  onOpenChange,
  onDefier,
}: {
  equipe: Equipe | null;
  /** Toutes les équipes : l'écusson de l'auteur de chaque message. */
  equipes: Equipe[];
  mienne: Equipe | null;
  moiId: string | null;
  /** Je suis le capitaine de l'équipe ouverte : je retire ce qui est sur son mur. */
  capitaineIci: boolean;
  defi: DefiPossible;
  demo: boolean;
  onOpenChange: (o: boolean) => void;
  onDefier: () => void;
}) {
  const id = equipe?.id ?? null;
  // Le mur lu (ou retouché) pour une équipe ; une autre ouverte repart de rien.
  const [lu, setLu] = useState<{ id: number; items: Chambrage[] } | null>(null);
  const [saisie, setSaisie] = useState<{ id: number | null; t: string }>({ id: null, t: "" });
  const [envoi, setEnvoi] = useState(false);
  const texte = saisie.id === id ? saisie.t : "";
  const setTexte = (t: string) => setSaisie({ id, t });
  const murDemo = useMemo(() => (equipe && demo ? demoChambrages(equipe, equipes) : null), [equipe, equipes, demo]);
  const mur: Chambrage[] | null = lu && lu.id === id ? lu.items : murDemo;
  const poser = (items: Chambrage[]) => id != null && setLu({ id, items });

  const relire = useCallback(async () => {
    if (id == null || demo) return;
    try {
      const items = await lireChambrages(id);
      setLu({ id, items });
    } catch {
      setLu((l) => (l && l.id === id ? l : { id, items: [] }));
    }
  }, [id, demo]);

  useEffect(() => {
    if (id == null || demo) return;
    let fini = false;
    lireChambrages(id)
      .then((items) => !fini && setLu({ id, items }))
      .catch(() => !fini && setLu((l) => (l && l.id === id ? l : { id, items: [] })));
    return () => {
      fini = true;
    };
  }, [id, demo]);

  const peutEcrire = !!mienne && !!equipe && mienne.id !== equipe.id && active(mienne);

  async function envoyer(t: string) {
    const phrase = t.trim();
    if (!equipe || !mienne || !phrase || envoi) return;
    if (demo) {
      // Aperçu : le message se pose sur le mur, rien n'est écrit en base.
      poser([
        { id: Math.min(0, ...(mur ?? []).map((x) => x.id)) - 1, equipe: mienne.id, auteur: mienne.membres.find((x) => x.id === moiId)?.name ?? "Moi", auteurId: moiId ?? "", texte: phrase, le: new Date().toISOString() },
        ...(mur ?? []),
      ]);
      setTexte("");
      navigator.vibrate?.(10);
      return;
    }
    setEnvoi(true);
    try {
      await chambrer(equipe.id, phrase);
      navigator.vibrate?.(10);
      setTexte("");
      await relire();
    } catch (e) {
      toast.error(direErreurChambrage(e));
    } finally {
      setEnvoi(false);
    }
  }

  async function retirer(c: Chambrage) {
    if (demo) {
      poser((mur ?? []).filter((x) => x.id !== c.id));
      return;
    }
    try {
      await retirerChambrage(c.id);
      poser((mur ?? []).filter((x) => x.id !== c.id));
    } catch (e) {
      toast.error(direErreurChambrage(e));
    }
  }

  const parId = new Map(equipes.map((e) => [e.id, e]));
  const n = equipe ? signataires(equipe).length : 0;

  return (
    <Sheet open={!!equipe} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden rounded-t-[28px] p-0 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] md:mx-auto md:max-w-[520px]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{equipe?.nom ?? "Équipe"}</SheetTitle>
        </SheetHeader>
        {equipe && (
          <>
            {/* L'équipe : son écusson, son nom, sa page. */}
            <Link
              href={`/bola-team/${equipe.id}`}
              className="flex items-center gap-4 px-5 pt-6 pb-4 transition-transform active:scale-[0.99]"
            >
              <Ecusson initiales={equipe.initiales} fond={equipe.fond} blason={equipe.blason} taille={76} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[24px] leading-tight font-extrabold tracking-tight">{equipe.nom}</span>
                <span className="truncate text-corps font-medium text-muted-foreground">
                  {[equipe.ville, `${n} / ${MAX_EQUIPE}`].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={2.2} />
            </Link>

            {/* Le mur. */}
            <div className="flex min-h-0 flex-1 flex-col border-t border-foreground/10">
              <div className="flex items-baseline justify-between px-5 pt-4 pb-2">
                <h2 className="mono-label text-muted-foreground">Le mur</h2>
                {mur && mur.length > 0 && <span className="font-mono text-petit font-bold text-muted-foreground tabular-nums">{mur.length}</span>}
              </div>
              <ul className="flex min-h-[72px] flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-3">
                {mur === null && (
                  <>
                    <li className="h-[58px] animate-pulse rounded-[18px] bg-card" />
                    <li className="h-[58px] animate-pulse rounded-[18px] bg-card opacity-60" />
                  </>
                )}
                {mur?.length === 0 && <li className="px-1 py-3 text-corps text-muted-foreground">Personne n&apos;a encore parlé.</li>}
                {mur?.map((c) => {
                  const e = parId.get(c.equipe);
                  const aMoi = !!moiId && c.auteurId === moiId;
                  return (
                    <li key={c.id} className="flex items-start gap-3 rounded-[18px] bg-card px-3 py-2.5">
                      <span className="mt-0.5 shrink-0">
                        {e ? <Ecusson initiales={e.initiales} fond={e.fond} blason={e.blason} taille={30} /> : <span className="block size-[30px]" />}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-petit font-semibold text-muted-foreground">
                          {c.auteur}
                          {e ? ` · ${e.nom}` : ""} · {depuis(c.le)}
                        </span>
                        <span className="text-lecture leading-snug font-bold tracking-[-0.2px] [overflow-wrap:anywhere]">{c.texte}</span>
                      </span>
                      {(aMoi || capitaineIci) && (
                        <button
                          type="button"
                          aria-label="Retirer"
                          onClick={() => void retirer(c)}
                          className="bouton-discret -mr-1 grid size-8 shrink-0 place-items-center text-muted-foreground"
                        >
                          <X className="size-4" strokeWidth={2.2} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Provoquer : d'un toucher, ou sa phrase. */}
            {peutEcrire && (
              <div className="flex flex-col gap-2 border-t border-foreground/10 pt-3">
                <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                  {PROVOCATIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={envoi}
                      onClick={() => void envoyer(p)}
                      className="bouton-secondaire shrink-0 px-3.5 py-1.5 text-corps font-semibold whitespace-nowrap disabled:opacity-50"
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <form
                  className="flex items-center gap-2 px-4"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    void envoyer(texte);
                  }}
                >
                  <input
                    value={texte}
                    onChange={(ev) => setTexte(ev.target.value.slice(0, MAX_CHAMBRAGE))}
                    maxLength={MAX_CHAMBRAGE}
                    placeholder={`Un mot pour ${equipe.nom}`}
                    enterKeyHint="send"
                    className="h-11 min-w-0 flex-1 rounded-full bg-card px-4 text-[16px] outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    type="submit"
                    aria-label="Envoyer"
                    disabled={!texte.trim() || envoi}
                    className="bouton-principal grid size-11 shrink-0 place-items-center disabled:opacity-40"
                  >
                    <ArrowUp className="size-5" strokeWidth={2.4} />
                  </button>
                </form>
              </div>
            )}

            {/* L'affronter. */}
            {defi && (
              <div className={cn("px-4 pt-3", !peutEcrire && "border-t border-foreground/10")}>
                {defi === "defier" ? (
                  <button
                    type="button"
                    onClick={onDefier}
                    className="bouton-principal bouton--mauve flex h-12 w-full items-center justify-center gap-2 text-lecture font-semibold"
                  >
                    <Swords className="size-[18px]" strokeWidth={2.2} />
                    Défier {equipe.nom}
                  </button>
                ) : defi === "en-cours" ? (
                  <div className="bouton-secondaire flex h-12 w-full items-center justify-center gap-2 text-lecture font-semibold opacity-70">
                    <Swords className="size-[18px]" strokeWidth={2.2} />
                    Défi en cours
                  </div>
                ) : (
                  <Link href="/bola-team" className="bouton-principal flex h-12 w-full items-center justify-center text-lecture font-semibold">
                    Monter mon équipe
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
