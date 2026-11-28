"use client";

// Mes photos, sur Ma carte et sur le profil d'un joueur, comme la grille d'un
// compte Instagram (Bola, 26/11/2026). Les photos de chaque journée où on me
// voit (lib/sfl/photos-journees.ts), la plus récente d'abord : la journée en
// une ligne (« J7 · dim. 22 nov. »), puis ses photos, trois par rangée, en
// 4:5, serrées à 2 px, comme sur Instagram. Toucher une photo l'ouvre en
// plein écran sur le noir ; on passe aux autres en glissant (ou aux flèches,
// au clavier), et les autres joueurs de la photo sont nommés dessous.
// Sans photo, la section ne se montre pas.
//
// Privé ou public (Bola, 28/11) : sur ma propre page, à côté du titre, deux
// mots, « Public » et « Privé », un clic pour passer de l'un à l'autre
// (lib/sfl/photos-privees.ts). En privé, je garde ma grille ; les autres ne
// voient plus une photo dès qu'un des joueurs qu'on y voit l'a mise en privé,
// sauf s'ils sont dessus.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIdentites } from "@/hooks/use-identites";
import { usePlayerPhoto } from "@/hooks/use-player-photo";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { dateCourte, photosDuJoueur, type PhotoJournee } from "@/lib/sfl/photos-journees";
import { Commentaires } from "@/components/sfl/actus/video";
import { CoeurEclos, RailPhoto, useDoubleToucher, usePhotoSociale } from "@/components/sfl/photos/actions-photo";
import { PartagePhoto } from "@/components/sfl/photos/partage-photo";
import { useCardViewer } from "@/components/sfl/card-viewer";
import { PlayerCard } from "@/components/sfl/player-card";
import { useSeason } from "@/components/sfl/season-provider";
import { choisirPhotosPrivees, usePhotosPrivees, usePhotosVisibles } from "@/lib/sfl/photos-privees";

export function PhotosDuJoueur({ nom, className }: { nom: string; className?: string }) {
  const { me } = useMyPlayer();
  const aMoi = !!me && me === nom;
  const visible = usePhotosVisibles(me ?? null);
  const prive = usePhotosPrivees().has(nom);
  const jours = useMemo(
    () => photosDuJoueur(nom).map((j) => ({ ...j, photos: j.photos.filter(visible) })).filter((j) => j.photos.length > 0),
    [nom, visible]
  );
  const toutes = useMemo(() => jours.flatMap((j) => j.photos), [jours]);
  const [ouverte, setOuverte] = useState<number | null>(null);
  if (toutes.length === 0) return null;

  return (
    <section className={cn("w-full", className)} aria-label="Photos">
      <div className="mb-[var(--fib-13)] flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-titre-fort font-bold tracking-[-0.3px]">
          Photos <span className="font-mono text-petit font-normal text-encre-3">{toutes.length}</span>
        </h2>
        {aMoi && <PublicPrive nom={nom} prive={prive} />}
      </div>
      <div className="flex flex-col gap-[var(--fib-13)]">
        {jours.map((j) => (
          <div key={j.journee}>
            <p className="mb-[var(--fib-8)] font-mono text-petit text-encre-3">
              J{j.journee} · {dateCourte(j.date)}
            </p>
            <div className="grid grid-cols-3 gap-[2px] overflow-hidden rounded-[14px]">
              {j.photos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setOuverte(toutes.indexOf(p))}
                  aria-label={`Photo ${p.id}, J${p.journee}`}
                  className="relative aspect-[4/5] overflow-hidden bg-foreground/10"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-300 hover:scale-[1.03] motion-reduce:transition-none"
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {ouverte !== null && <Visionneuse photos={toutes} depart={ouverte} nom={nom} onFermer={() => setOuverte(null)} />}
    </section>
  );
}

/** Deux mots, un clic : mes photos à tout le monde, ou à moi seul. */
function PublicPrive({ nom, prive }: { nom: string; prive: boolean }) {
  const [enCours, setEnCours] = useState(false);
  const choisir = async (p: boolean) => {
    if (p === prive || enCours) return;
    setEnCours(true);
    navigator.vibrate?.(8);
    const erreur = await choisirPhotosPrivees(nom, p);
    setEnCours(false);
    if (erreur) toast.error(erreur);
  };
  const option = (p: boolean, libelle: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={prive === p}
      onClick={() => void choisir(p)}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors motion-reduce:transition-none",
        prive === p ? "bg-foreground text-background" : "text-foreground/55"
      )}
    >
      {p && <Lock className="size-3.5" strokeWidth={2.4} />}
      {libelle}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Qui voit mes photos" className="flex items-center rounded-full bg-foreground/[0.08] p-[3px]">
      {option(false, "Public")}
      {option(true, "Privé")}
    </div>
  );
}

export function Visionneuse({ photos, depart, nom, onFermer }: { photos: PhotoJournee[]; depart: number; nom: string; onFermer: () => void }) {
  const rang = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(depart);
  const p = photos[index];

  const aller = useCallback((i: number) => {
    const el = rang.current;
    if (!el) return;
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: reduit ? "auto" : "smooth" });
  }, []);

  useEffect(() => {
    const el = rang.current;
    if (el) el.scrollLeft = depart * el.clientWidth;
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = avant;
    };
  }, [depart]);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
      if (e.key === "ArrowRight") aller(Math.min(photos.length - 1, index + 1));
      if (e.key === "ArrowLeft") aller(Math.max(0, index - 1));
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [aller, index, onFermer, photos.length]);

  const autres = p.joueurs.filter((j) => j !== nom);
  // Comme sur un réseau social (28/11) : j'aime, commentaires, partage (photos/actions-photo.tsx).
  const s = usePhotoSociale(p);
  const [commentaires, setCommentaires] = useState(false);
  const [partage, setPartage] = useState(false);
  const [eclos, setEclos] = useState(0);
  const doubleToucher = useDoubleToucher(() => {
    s.aimer();
    setEclos((n) => n + 1);
  });

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`J${p.journee}, photo ${index + 1} sur ${photos.length}`} className="dark fixed inset-0 z-[60] bg-black text-white">
      <div
        ref={rang}
        className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        onPointerUp={doubleToucher}
      >
        {photos.map((ph, i) => (
          <div key={ph.id} className="flex h-full w-full shrink-0 snap-center items-center justify-center">
            {Math.abs(i - index) <= 1 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ph.src} alt="" className="max-h-full max-w-full object-contain lg:max-h-[86dvh] lg:max-w-[86vw]" />
            )}
          </div>
        ))}
      </div>

      <CoeurEclos signal={eclos} />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-3 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
      >
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer"
          className="pointer-events-auto flex size-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-xl"
        >
          <X className="size-5" strokeWidth={2.2} />
        </button>
        <span className="font-mono text-petit text-white/80">
          J{p.journee} · {dateCourte(p.date)}
        </span>
        <span className="flex size-11 items-center justify-center font-mono text-petit text-white/60">
          {index + 1}/{photos.length}
        </span>
      </div>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => aller(Math.max(0, index - 1))}
            disabled={index === 0}
            aria-label="Photo précédente"
            className="absolute top-1/2 left-5 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 backdrop-blur-xl transition-opacity disabled:opacity-0 lg:flex"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            onClick={() => aller(Math.min(photos.length - 1, index + 1))}
            disabled={index === photos.length - 1}
            aria-label="Photo suivante"
            className="absolute top-1/2 right-5 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 backdrop-blur-xl transition-opacity disabled:opacity-0 lg:flex"
          >
            <ChevronRight className="size-6" />
          </button>
        </>
      )}

      <RailPhoto
        s={s}
        onCommentaires={() => setCommentaires(true)}
        onPartager={() => setPartage(true)}
        className="absolute right-3 bottom-[calc(env(safe-area-inset-bottom,0px)+96px)] z-[5] lg:right-24 lg:bottom-1/2 lg:translate-y-1/2"
      />
      {commentaires && <Commentaires echos={s.echos} onFermer={() => setCommentaires(false)} />}
      {partage && <PartagePhoto p={p} onFermer={() => setPartage(false)} />}

      {autres.length > 0 && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-4 pt-10"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)" }}
        >
          {autres.map((j) => (
            <Pastille key={j} nom={j} onOuvrir={onFermer} />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

/**
 * Un joueur de la photo (Bola, 28/11 : « en cliquant sur leur identification,
 * tomber sur leur compte Bola ») : la visionneuse se ferme et sa carte s'ouvre,
 * avec Suivre et son profil (card-viewer.tsx). Un nom hors de la saison reste
 * une simple étiquette.
 */
function Pastille({ nom, onOuvrir }: { nom: string; onOuvrir: () => void }) {
  const src = usePlayerPhoto(nom);
  const identite = useIdentites();
  const [casse, setCasse] = useState(false);
  const { allPlayers } = useSeason();
  const { open } = useCardViewer();
  const player = allPlayers.find((p) => p.name === nom);
  const ouvrir = () => {
    if (!player) return;
    onOuvrir();
    open({
      cacheKey: `mini-${player.name}`,
      mode: "simple",
      title: player.name,
      joueur: player.name,
      render: (t) => <PlayerCard player={player} size={t} />,
    });
  };
  return (
    <button
      type="button"
      onClick={ouvrir}
      disabled={!player}
      aria-label={player ? `Voir le compte de ${identite.nom(nom)}` : undefined}
      className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/12 py-1 pr-3.5 pl-1 text-[14px] font-semibold backdrop-blur-xl transition-transform active:scale-95 disabled:pointer-events-none"
    >
      <span className="flex size-7 items-center justify-center overflow-hidden rounded-full bg-white/15 text-[12px]">
        {casse ? (
          nom[0]
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="size-full object-cover" onError={() => setCasse(true)} />
        )}
      </span>
      {identite.nom(nom)}
    </button>
  );
}
