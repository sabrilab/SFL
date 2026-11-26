"use client";

// Mes photos, sur Ma carte et sur le profil d'un joueur, comme la grille d'un
// compte Instagram (Bola, 26/11/2026). Les photos de chaque journée où on me
// voit (lib/sfl/photos-journees.ts), la plus récente d'abord : la journée en
// une ligne (« J7 · dim. 22 nov. »), puis ses photos, trois par rangée, en
// 4:5, serrées à 2 px, comme sur Instagram. Toucher une photo l'ouvre en
// plein écran sur le noir ; on passe aux autres en glissant (ou aux flèches,
// au clavier), et les autres joueurs de la photo sont nommés dessous.
// Sans photo, la section ne se montre pas.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIdentites } from "@/hooks/use-identites";
import { usePlayerPhoto } from "@/hooks/use-player-photo";
import { dateCourte, photosApercu, photosDuJoueur, type PhotoJournee } from "@/lib/sfl/photos-journees";

export function PhotosDuJoueur({ nom, moi = false, className }: { nom: string; moi?: boolean; className?: string }) {
  const [apercu, setApercu] = useState<PhotoJournee[] | null>(null);
  useEffect(() => setApercu(moi ? photosApercu() : null), [moi]);
  const jours = useMemo(
    () => photosDuJoueur(nom, apercu ? apercu.map((p) => ({ ...p, joueurs: [...p.joueurs, nom] })) : undefined),
    [nom, apercu]
  );
  const toutes = useMemo(() => jours.flatMap((j) => j.photos), [jours]);
  const [ouverte, setOuverte] = useState<number | null>(null);
  if (toutes.length === 0) return null;

  return (
    <section className={cn("w-full", className)} aria-label="Photos">
      <div className="mb-[var(--fib-13)] flex items-baseline justify-between">
        <h2 className="text-titre-fort font-bold tracking-[-0.3px]">Photos</h2>
        <span className="font-mono text-petit text-encre-3">{toutes.length}</span>
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

function Visionneuse({ photos, depart, nom, onFermer }: { photos: PhotoJournee[]; depart: number; nom: string; onFermer: () => void }) {
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

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`J${p.journee}, photo ${index + 1} sur ${photos.length}`} className="dark fixed inset-0 z-[60] bg-black text-white">
      <div
        ref={rang}
        className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
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

      {autres.length > 0 && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-4 pt-10"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)" }}
        >
          {autres.map((j) => (
            <Pastille key={j} nom={j} />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

function Pastille({ nom }: { nom: string }) {
  const src = usePlayerPhoto(nom);
  const identite = useIdentites();
  const [casse, setCasse] = useState(false);
  return (
    <span className="flex items-center gap-2 rounded-full bg-white/12 py-1 pr-3.5 pl-1 text-[14px] font-semibold backdrop-blur-xl">
      <span className="flex size-7 items-center justify-center overflow-hidden rounded-full bg-white/15 text-[12px]">
        {casse ? (
          nom[0]
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="size-full object-cover" onError={() => setCasse(true)} />
        )}
      </span>
      {identite.nom(nom)}
    </span>
  );
}
