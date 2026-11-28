"use client";

// Le j'aime, les commentaires et le partage d'une photo de journée (Bola,
// 28/11/2026 : « faire comme si c'était un réseau social »). Dans la
// visionneuse plein écran (photos-du-joueur.tsx), un rail à droite comme dans
// le fil vertical des Actus : le cœur et son nombre, les commentaires, le
// partage. Deux touchers sur la photo posent le j'aime, avec le cœur qui
// éclot au milieu. Les échos sont ceux des vidéos (useEchos, tables photo_*),
// suivis en temps réel ; le partage ouvre sa feuille (partage-photo.tsx).

import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEchos, type Echo } from "@/components/sfl/actus/video";
import { JAIME } from "@/lib/sfl/videos";
import { cleDePhoto } from "@/lib/sfl/photos-echos";
import type { PhotoJournee } from "@/lib/sfl/photos-journees";

export function usePhotoSociale(p: PhotoJournee) {
  const echos = useEchos(cleDePhoto(p), "photo");
  const jaimes = echos.reactions.filter((r) => r.emoji === JAIME).length;
  const aime = !!echos.moi && echos.reactions.some((r) => r.joueur === echos.moi && r.emoji === JAIME);
  return { echos, jaimes, aime, basculer: () => void echos.reagirA(JAIME), aimer: () => !aime && void echos.reagirA(JAIME) };
}

export type PhotoSociale = ReturnType<typeof usePhotoSociale>;

/** Deux touchers rapprochés : le j'aime (un toucher seul ne fait rien ici). */
export function useDoubleToucher(faire: () => void) {
  const dernier = useRef(0);
  return () => {
    const t = Date.now();
    if (t - dernier.current < 320) {
      dernier.current = 0;
      faire();
    } else dernier.current = t;
  };
}

/** Le cœur qui éclot au milieu de la photo, à chaque j'aime par deux touchers. */
export function CoeurEclos({ signal }: { signal: number }) {
  const [vu, setVu] = useState(0);
  useEffect(() => {
    if (!signal) return;
    const a = setTimeout(() => setVu(signal), 0);
    const b = setTimeout(() => setVu(0), 760);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [signal]);
  if (!vu) return null;
  return (
    <span key={vu} aria-hidden className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
      <Heart className="coeur-eclos size-[96px] fill-white text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)]" strokeWidth={0} />
    </span>
  );
}

function Bouton({ label, n, actif, onClick, children }: { label: string; n?: number; actif?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} aria-pressed={actif} onClick={onClick} className="flex flex-col items-center gap-1 text-white">
      <span className="grid size-12 place-items-center rounded-full bg-black/25 backdrop-blur-xl transition-transform active:scale-90">{children}</span>
      {n !== undefined && <span className="text-[12.5px] font-bold tabular-nums drop-shadow">{n > 0 ? n : ""}</span>}
    </button>
  );
}

/** Le rail : cœur, commentaires, partage. */
export function RailPhoto({
  s,
  onCommentaires,
  onPartager,
  className,
}: {
  s: PhotoSociale;
  onCommentaires: () => void;
  onPartager: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <Bouton label={s.aime ? "Retirer mon j'aime" : "J'aime"} n={s.jaimes} actif={s.aime} onClick={s.basculer}>
        <Heart className={cn("size-[25px] transition-transform", s.aime && "scale-110 fill-[#ff3b5c] text-[#ff3b5c]")} strokeWidth={2} />
      </Bouton>
      <Bouton label="Commentaires" n={s.echos.commentaires.length} onClick={onCommentaires}>
        <MessageCircle className="size-[24px]" strokeWidth={2} />
      </Bouton>
      <Bouton label="Partager" onClick={onPartager}>
        <Send className="size-[22px] -translate-x-px" strokeWidth={2} />
      </Bouton>
    </div>
  );
}

export type { Echo };
