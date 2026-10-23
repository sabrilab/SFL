"use client";

// La carte touchée, en grand : n'importe quelle carte affichée dans l'app
// s'ouvre ici et se manipule en 3D, comme dans la Collection. Fournit un
// contexte `useCardViewer()` + un wrapper pratique `<ViewableCard>` qui rend
// une Card3D cliquable.
//
// Sabri, 23/10 : « quand on clique sur un joueur, c'est très, très moche.
// Essaye de reprendre la modal qu'on a dans map quand on clique sur les
// joueurs, avec le même style […] Pas que ça flotte comme ça. On peut
// toujours manipuler la carte, mais il faut que ça fasse plus cadré. » La
// carte ne flotte plus au milieu de l'écran : elle est posée dans la pop-up
// du bas de la Map (map/collection-pile.tsx), le même verre clair
// (globals.css), la page floutée derrière. En tête, ce qui a fait toucher la
// carte (« 1e · 7 buts ») et le nom, la croix à droite ; au centre, la carte
// en 3D, qu'on tourne toujours au doigt.
//
// La carte d'un joueur de la ligue (`joueur`, son nom de saison) porte
// dessous ses abonnés comme sur Instagram (suivre.tsx : ses abonnés et ses
// abonnements, « Suivi par Kader, Anis et 3 autres que tu connais »), puis
// deux pilules côte à côte, comme « Suivre » et « Message » sur Instagram :
// Suivre, et son profil, qui s'ouvre ici même, comme sur la Map. La croix,
// Échap, un toucher hors du verre ou la poignée tirée vers le bas referment.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { IdCard, X } from "lucide-react";
import { Poignee, Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIdentites } from "@/hooks/use-identites";
import { useGrandEcran } from "@/hooks/use-media-query";
import { rankPlayers } from "@/lib/sfl/engine";
import { isHidden } from "@/lib/sfl/hidden";
import { Card3D, prechaufferCarte } from "./card-3d";
import { useMyPlayer } from "./player-provider";
import { useSeason } from "./season-provider";
import { BoutonSuivre, ReseauJoueur } from "./suivre";

// Le profil complet d'un joueur, chargé au premier « Son profil ».
const ProfilJoueur = dynamic(() => import("./profil-joueur").then((m) => m.ProfilJoueur), { ssr: false });

interface ViewedCard {
  cacheKey: string;
  mode: "simple" | "rare";
  title: string;
  subtitle?: string;
  /** La carte d'un joueur de la ligue : son nom de saison. */
  joueur?: string;
  render: (size: number) => ReactNode;
}

const CardViewerContext = createContext<{ open: (card: ViewedCard) => void }>({
  open: () => {},
});

export function useCardViewer() {
  return useContext(CardViewerContext);
}

const ENCRE = "text-[#0a0b0d]";

export function CardViewerProvider({ children }: { children: ReactNode }) {
  // La carte reste là le temps que le verre redescende.
  const [viewed, setViewed] = useState<ViewedCard | null>(null);
  const [ouverte, setOuverte] = useState(false);
  const [profil, setProfil] = useState<string | null>(null);
  const open = useCallback((card: ViewedCard) => {
    setViewed(card);
    setOuverte(true);
  }, []);
  const { players } = useSeason();
  const { me } = useMyPlayer();
  const identite = useIdentites();
  const grand = useGrandEcran();
  const rangs = useMemo(() => new Map(rankPlayers(players).map((p) => [p.name, p.rank])), [players]);
  const profilJoueur = profil ? players.find((p) => p.name === profil) : undefined;

  // Un joueur masqué ne montre que sa carte ; un joueur d'une autre saison, pas de profil.
  const joueur = viewed?.joueur && !isHidden(viewed.joueur) ? viewed.joueur : null;
  const aUnProfil = !!joueur && joueur !== me && players.some((p) => p.name === joueur);

  return (
    <CardViewerContext.Provider value={{ open }}>
      {children}
      <Sheet open={ouverte} onOpenChange={setOuverte}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className={`verre-clair mx-auto max-h-[calc(100dvh-24px)] w-full gap-0 overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+14px)] sm:max-w-md ${ENCRE}`}
        >
          {viewed && (
            <>
              <Poignee barre="bg-[#0a0b0d]/20" />
              <header className="relative z-10 flex shrink-0 items-start justify-between gap-3 px-5 pt-[22px]">
                <div className="min-w-0">
                  {viewed.subtitle ? (
                    <SheetDescription className="mono-label text-[#0a0b0d]/55">{viewed.subtitle}</SheetDescription>
                  ) : (
                    joueur && <SheetDescription className="font-mono text-[12px] text-[#0a0b0d]/55">{identite.pseudo(joueur)}</SheetDescription>
                  )}
                  <SheetTitle className={`truncate text-[26px] leading-[1.1] font-bold tracking-tight ${ENCRE}`}>
                    {viewed.joueur ? identite.nom(viewed.joueur) : viewed.title}
                  </SheetTitle>
                </div>
                <SheetClose aria-label="Fermer" className="bouton-givre grid size-10 shrink-0 place-items-center">
                  <X className="size-4" strokeWidth={2.4} />
                </SheetClose>
              </header>

              {/* Le cadre de la 3D garde autour de la carte de quoi la
                  tourner : ses bords vides passent sous le nom et les
                  abonnés, qui restent au-dessus (relative). */}
              <div className="-mt-[var(--fib-13)] -mb-[var(--fib-21)] flex shrink-0 justify-center">
                <Card3D
                  cacheKey={`viewer-${viewed.cacheKey}`}
                  mode={viewed.mode}
                  size={grand ? 1 : 0.92}
                  render={viewed.render}
                  apercu
                />
              </div>

              {joueur && (
                <>
                  <ReseauJoueur nom={joueur} clair centre={false} className="relative px-5" />
                  <footer className="flex gap-2.5 px-5 pt-[var(--fib-21)]">
                    <BoutonSuivre nom={joueur} clair className="h-11 flex-1 text-[15px]" />
                    {aUnProfil && (
                      <button
                        type="button"
                        onClick={() => {
                          setOuverte(false);
                          setProfil(joueur);
                        }}
                        className="bouton-givre flex h-11 flex-1 items-center justify-center gap-2 text-[15px] font-semibold"
                      >
                        <IdCard className="size-4" strokeWidth={2.2} /> Son profil
                      </button>
                    )}
                    {joueur === me && (
                      <Link
                        href="/profil"
                        onClick={() => setOuverte(false)}
                        className="bouton-givre flex h-11 flex-1 items-center justify-center gap-2 text-[15px] font-semibold"
                      >
                        <IdCard className="size-4" strokeWidth={2.2} /> Ma carte
                      </Link>
                    )}
                  </footer>
                </>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Le profil d'un joueur, comme sur la Map */}
      <Sheet open={!!profilJoueur} onOpenChange={(o) => !o && setProfil(null)}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          <SheetHeader className="sr-only">
            <SheetTitle>{profilJoueur ? identite.nom(profilJoueur.name) : "Profil"}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pt-5">
            {profilJoueur && <ProfilJoueur key={profilJoueur.name} player={profilJoueur} rank={rangs.get(profilJoueur.name) ?? players.length} />}
          </div>
        </SheetContent>
      </Sheet>
    </CardViewerContext.Provider>
  );
}

// Carte 3D cliquable : le tap (sans glissement) ouvre le viewer.
// On distingue tap et drag pour ne pas ouvrir la pop-up quand on
// manipule simplement la carte en place.
export function ViewableCard({
  cacheKey,
  mode,
  size,
  title,
  subtitle,
  render,
}: {
  cacheKey: string;
  mode: "simple" | "rare";
  size: number;
  title: string;
  subtitle?: string;
  render: (size: number) => ReactNode;
}) {
  const { open } = useCardViewer();
  const [downAt, setDownAt] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Voir la carte ${title} en grand`}
      onPointerDown={(e) => {
        setDownAt({ x: e.clientX, y: e.clientY });
        prechaufferCarte();
      }}
      onPointerUp={(e) => {
        if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 8) {
          open({ cacheKey, mode, title, subtitle, render });
        }
        setDownAt(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open({ cacheKey, mode, title, subtitle, render });
        }
      }}
      className="cursor-pointer"
    >
      <Card3D cacheKey={cacheKey} mode={mode} size={size} render={render} />
    </div>
  );
}
