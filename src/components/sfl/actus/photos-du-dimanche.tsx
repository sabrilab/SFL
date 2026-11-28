"use client";

// Les photos d'un dimanche, dans son fil d'Actus (Bola, 28/11/2026 : « les
// photos qui sont prises pendant la J7, tu me les mettes au scroll dans
// l'onglet Actu, dans la J7 […] pareil pour la J8 et la J9 »). Elles viennent
// de la même liste que la grille de Ma carte (lib/sfl/photos-journees.ts) et
// se glissent entre les rubriques du dimanche (course.tsx, Dimanche) : une
// photo en largeur seule, deux photos en hauteur côte à côte. Le carrousel
// « J7, en images. » en tête des Actus ne change pas.
//
// Comme sur un réseau social (Bola, 28/11 : « réagir à la photo, mettre un
// j'aime, mettre un commentaire ») : chaque photo porte en bas son nombre de
// j'aime et de commentaires (une lecture pour tout le dimanche,
// lireCompteurs) ; deux touchers posent le j'aime, avec le cœur qui éclot ;
// un toucher ouvre la visionneuse (photos-du-joueur.tsx), où sont le cœur,
// les commentaires et le partage.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Heart, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CoeurEclos } from "@/components/sfl/photos/actions-photo";
import { cleDePhoto, lireCompteurs, SANS_ECHO, type Compteurs } from "@/lib/sfl/photos-echos";
import { JAIME, reagir } from "@/lib/sfl/videos";
import type { PhotoJournee } from "@/lib/sfl/photos-journees";

interface FilPhotos {
  ouvrir: (p: PhotoJournee) => void;
  compteurs: Map<string, Compteurs>;
  aimer: (p: PhotoJournee) => void;
}

export const FilDesPhotos = createContext<FilPhotos>({ ouvrir: () => {}, compteurs: new Map(), aimer: () => {} });

/** Les compteurs des photos d'un dimanche, et le j'aime posé depuis le fil. */
export function useFilDesPhotos(photos: PhotoJournee[], ouvrir: (p: PhotoJournee) => void, relire: unknown): FilPhotos {
  const [compteurs, setCompteurs] = useState<Map<string, Compteurs>>(() => new Map());
  const cles = useMemo(() => photos.map(cleDePhoto), [photos]);
  useEffect(() => {
    let fini = false;
    void lireCompteurs(cles).then((m) => !fini && setCompteurs(m));
    return () => {
      fini = true;
    };
  }, [cles, relire]);
  const aimer = useCallback(
    (p: PhotoJournee) => {
      const cle = cleDePhoto(p);
      const e = compteurs.get(cle) ?? SANS_ECHO;
      if (e.moi) return;
      setCompteurs((m) => new Map(m).set(cle, { ...e, jaimes: e.jaimes + 1, moi: true }));
      reagir(cle, JAIME, true, false, "photo").catch(() => {
        toast.error("Le j'aime n'est pas parti.");
        setCompteurs((m) => new Map(m).set(cle, e));
      });
    },
    [compteurs]
  );
  return useMemo(() => ({ ouvrir, compteurs, aimer }), [ouvrir, compteurs, aimer]);
}

function PhotoDuFil({ p, seule }: { p: PhotoJournee; seule: boolean }) {
  const { ouvrir, compteurs, aimer } = useContext(FilDesPhotos);
  const c = compteurs.get(cleDePhoto(p)) ?? SANS_ECHO;
  const [eclos, setEclos] = useState(0);
  // Un toucher ouvre, deux touchers aiment : on attend un instant avant d'ouvrir.
  const attente = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (attente.current && clearTimeout(attente.current)), []);
  const toucher = () => {
    if (attente.current) {
      clearTimeout(attente.current);
      attente.current = null;
      aimer(p);
      setEclos((n) => n + 1);
      return;
    }
    attente.current = setTimeout(() => {
      attente.current = null;
      ouvrir(p);
    }, 260);
  };
  return (
    <button
      type="button"
      onClick={toucher}
      aria-label="Voir la photo"
      className={cn(
        "relative block w-full touch-manipulation overflow-hidden bg-contraste/[0.06]",
        seule && p.largeur >= p.hauteur ? "aspect-[16/10]" : "aspect-[4/5]"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.src} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      <CoeurEclos signal={eclos} />
      {(c.jaimes > 0 || c.commentaires > 0) && (
        <span className="absolute bottom-2.5 left-2.5 flex items-center gap-2.5 rounded-full bg-black/40 px-2.5 py-1 text-[12.5px] font-bold text-white tabular-nums backdrop-blur-md">
          {c.jaimes > 0 && (
            <span className="flex items-center gap-1">
              <Heart className={cn("size-[13px]", c.moi && "fill-[#ff3b5c] text-[#ff3b5c]")} strokeWidth={2.4} />
              {c.jaimes}
            </span>
          )}
          {c.commentaires > 0 && (
            <span className="flex items-center gap-1">
              <MessageCircle className="size-[13px]" strokeWidth={2.4} />
              {c.commentaires}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

export function BlocPhotos({ bloc, className }: { bloc: PhotoJournee[]; className?: string }) {
  const seule = bloc.length === 1;
  return (
    <div className={cn("grid gap-[2px] overflow-hidden md:rounded-[18px]", seule ? "grid-cols-1" : "grid-cols-2", className)}>
      {bloc.map((p) => (
        <PhotoDuFil key={p.id} p={p} seule={seule} />
      ))}
    </div>
  );
}
