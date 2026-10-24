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
// Suivre, et son profil. La croix, Échap, un toucher hors du verre ou la
// poignée tirée vers le bas referment.
//
// Une seule fenêtre (Sabri, 24/10 : « par-dessus, par-dessus, par-dessus.
// C'est pas très cohérent ») : son profil s'ouvre dans la même fenêtre, à
// la place de la carte, avec un retour vers elle (ui/sheet.tsx) ; Comparer
// et ses trophées de même. Une carte touchée dans une fenêtre déjà ouverte
// (la fiche d'un match, un profil, un trophée et ceux qui l'ont) y est posée
// aussi, au lieu d'ouvrir une fenêtre de plus : le retour, à gauche du nom,
// ramène à ce qu'on regardait.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { IdCard, X } from "lucide-react";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import {
  Poignee,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  useFenetre,
  useRetourDEcran,
} from "@/components/ui/sheet";
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

/** Ouvrir une carte en grand : dans la fenêtre où l'on est, sinon dans la sienne. */
export function useCardViewer() {
  const global = useContext(CardViewerContext);
  const poser = useFenetre()?.poser;
  return useMemo(() => (poser ? { open: (card: ViewedCard) => poser(<FeuilleCarte viewed={card} />, "sa carte") } : global), [poser, global]);
}

const ENCRE = "text-[#0a0b0d]";
const VERRE = `verre-clair mx-auto max-h-[calc(100dvh-24px)] w-full gap-0 overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+14px)] sm:max-w-md ${ENCRE}`;

export function CardViewerProvider({ children }: { children: ReactNode }) {
  // La carte reste là le temps que le verre redescende.
  const [viewed, setViewed] = useState<ViewedCard | null>(null);
  const [ouverte, setOuverte] = useState(false);
  const open = useCallback((card: ViewedCard) => {
    setViewed(card);
    setOuverte(true);
  }, []);
  const valeur = useMemo(() => ({ open }), [open]);

  return (
    <CardViewerContext.Provider value={valeur}>
      {children}
      <Sheet open={ouverte} onOpenChange={setOuverte} titre="sa carte">
        <SheetContent side="bottom" showCloseButton={false} className={VERRE}>
          {viewed && <EcranCarte viewed={viewed} />}
        </SheetContent>
      </Sheet>
    </CardViewerContext.Provider>
  );
}

/** La carte touchée, posée dans la fenêtre où on l'a touchée. */
function FeuilleCarte({ viewed }: { viewed: ViewedCard }) {
  return (
    <SheetContent side="bottom" showCloseButton={false} className={VERRE}>
      <EcranCarte viewed={viewed} />
    </SheetContent>
  );
}

function EcranCarte({ viewed }: { viewed: ViewedCard }) {
  const { players } = useSeason();
  const { me } = useMyPlayer();
  const identite = useIdentites();
  const grand = useGrandEcran();
  const fenetre = useFenetre();
  const retour = useRetourDEcran();

  // Un joueur masqué ne montre que sa carte ; un joueur d'une autre saison, pas de profil.
  const joueur = viewed.joueur && !isHidden(viewed.joueur) ? viewed.joueur : null;
  const aUnProfil = !!joueur && joueur !== me && players.some((p) => p.name === joueur);

  return (
    <>
      <Poignee barre="bg-[#0a0b0d]/20" />
      <header className="relative z-10 flex shrink-0 items-start gap-3 px-5 pt-[22px]">
        {retour && <BoutonRetour onRetour={retour.retour} titre={retour.titre ?? "l'écran d'avant"} givre />}
        <div className="min-w-0 flex-1">
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
                onClick={() => fenetre?.poser(<FeuilleProfil nom={joueur} />, "son profil")}
                className="bouton-givre flex h-11 flex-1 items-center justify-center gap-2 text-[15px] font-semibold"
              >
                <IdCard className="size-4" strokeWidth={2.2} /> Son profil
              </button>
            )}
            {joueur === me && (
              <Link
                href="/profil"
                onClick={() => fenetre?.fermer()}
                className="bouton-givre flex h-11 flex-1 items-center justify-center gap-2 text-[15px] font-semibold"
              >
                <IdCard className="size-4" strokeWidth={2.2} /> Ma carte
              </Link>
            )}
          </footer>
        </>
      )}
    </>
  );
}

/**
 * Le profil d'un joueur, comme sur la Map : un écran de la fenêtre où on
 * l'ouvre (fenetre.poser), ou le contenu de sa propre feuille. `onRetour` :
 * ouvert depuis la pile de la Map, qui n'est pas une feuille, un retour y
 * ramène (ui/sheet.tsx).
 */
export function FeuilleProfil({ nom, onRetour }: { nom: string; onRetour?: () => void }) {
  const { players } = useSeason();
  const identite = useIdentites();
  const rangs = useMemo(() => new Map(rankPlayers(players).map((p) => [p.name, p.rank])), [players]);
  const player = players.find((p) => p.name === nom);
  return (
    <SheetContent
      side="bottom"
      onRetour={onRetour}
      className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
    >
      <SheetHeader className="sr-only">
        <SheetTitle>{player ? identite.nom(player.name) : "Profil"}</SheetTitle>
      </SheetHeader>
      <div className="px-4 pt-5">
        {player && <ProfilJoueur key={player.name} player={player} rank={rangs.get(player.name) ?? players.length} />}
      </div>
    </SheetContent>
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
