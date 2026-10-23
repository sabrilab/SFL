"use client";

// Prise d'une photo de référence — plein écran, caméra en direct.
//
// Le cadre est le même pour les quatre angles et pour tous les joueurs :
// portrait 3:4, une ligne pour le haut de la tête, une pour les pieds, l'axe
// du corps au milieu. C'est ce qui garantit la pose centrale identique dont
// les skins auront besoin. Le petit cadran indique l'orientation demandée
// (vue de dessus : le point est le nez).
//
// Le retardateur (3 ou 10 s) permet de poser le téléphone et de se placer,
// ou de se tourner pour la prise de dos. Pas de caméra (refus, navigateur
// ancien) : on ouvre l'appareil photo du téléphone, jamais la galerie.

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, SwitchCamera, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ANGLES, type Angle } from "@/lib/sfl/inscription";
import { cadrerReference, referenceDepuisFichier } from "@/lib/sfl/references";

const RETARDS = [0, 3, 10] as const;

/** Rotation du cadran : où regarde le joueur, vu de dessus (0° = l'objectif). */
const ORIENTATION: Record<Angle, number> = { face: 0, droite: -90, gauche: 90, dos: 180 };

function Cadran({ angle }: { angle: Angle }) {
  return (
    <svg viewBox="0 0 40 40" className="size-9" aria-hidden>
      <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeOpacity=".35" />
      {/* L'objectif, en bas */}
      <rect x="16" y="36" width="8" height="3" rx="1" fill="currentColor" fillOpacity=".55" />
      <g style={{ transform: `rotate(${ORIENTATION[angle]}deg)`, transformOrigin: "20px 20px", transition: "transform .5s" }}>
        <ellipse cx="20" cy="20" rx="9" ry="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="20" cy="28.5" r="2.4" fill="currentColor" />
      </g>
    </svg>
  );
}

export function PriseReference({
  angle,
  onPrise,
  onFermer,
}: {
  angle: Angle;
  onPrise: (dataUrl: string) => void;
  onFermer: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const [face, setFace] = useState<"environment" | "user">("environment");
  const [retard, setRetard] = useState<(typeof RETARDS)[number]>(3);
  const [compte, setCompte] = useState<number | null>(null);
  const [indispo, setIndispo] = useState(false);
  const [flash, setFlash] = useState(false);
  const info = ANGLES.find((a) => a.id === angle)!;

  // Ouvre la caméra ; la referme en partant ou en changeant d'objectif.
  useEffect(() => {
    let flux: MediaStream | null = null;
    let annule = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setIndispo(true);
        return;
      }
      try {
        flux = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: face, width: { ideal: 1440 }, height: { ideal: 1920 } },
        });
        if (annule) {
          flux.getTracks().forEach((t) => t.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = flux;
          await video.current.play().catch(() => {});
        }
        setIndispo(false);
      } catch {
        setIndispo(true);
      }
    })();
    return () => {
      annule = true;
      flux?.getTracks().forEach((t) => t.stop());
    };
  }, [face]);

  const declencher = useCallback(() => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    try {
      const dataUrl = cadrerReference(v, v.videoWidth, v.videoHeight, face === "user");
      navigator.vibrate?.(18);
      setFlash(true);
      setTimeout(() => onPrise(dataUrl), 180);
    } catch {
      setIndispo(true);
    }
  }, [face, onPrise]);

  // Le compte à rebours.
  useEffect(() => {
    if (compte === null) return;
    navigator.vibrate?.(6);
    const t = setTimeout(() => {
      if (compte <= 1) {
        setCompte(null);
        declencher();
      } else setCompte(compte - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [compte, declencher]);

  function appuyer() {
    if (compte !== null) {
      setCompte(null);
      return;
    }
    if (retard === 0) declencher();
    else setCompte(retard);
  }

  async function depuisFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      onPrise(await referenceDepuisFichier(f));
    } catch {}
  }

  return (
    <div className="dark fixed inset-0 z-[80] flex flex-col bg-black text-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* En-tête : l'angle demandé */}
      <div className="flex items-center gap-3 px-5 pt-3 pb-2">
        <Cadran angle={angle} />
        <div className="min-w-0 flex-1">
          <p className="mono-label text-white/45">
            {ANGLES.findIndex((a) => a.id === angle) + 1} / 4
          </p>
          <p className="text-[21px] leading-tight font-extrabold tracking-tight">{info.label}</p>
        </div>
        <button onClick={onFermer} aria-label="Fermer" className="bouton-secondaire grid size-10 place-items-center">
          <X className="size-5" />
        </button>
      </div>

      {/* Le viseur 3:4 et ses repères */}
      <div className="relative mx-auto aspect-[3/4] w-[calc(100%-2rem)] max-h-[calc(100dvh-230px)] max-w-[calc((100dvh-230px)*0.75)] overflow-hidden rounded-[21px] bg-white/5">
        {!indispo && (
          <video
            ref={video}
            playsInline
            muted
            className={cn("absolute inset-0 size-full object-cover", face === "user" && "-scale-x-100")}
          />
        )}
        {indispo && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <div>
              <Camera className="mx-auto size-8 text-white/50" />
              <p className="mt-3 text-[14px] text-white/60">La caméra ne s&apos;ouvre pas ici.</p>
              <button
                onClick={() => fichier.current?.click()}
                className="bouton-principal bouton--or mt-5 px-6 py-3 text-[14px] font-bold"
              >
                Ouvrir l&apos;appareil photo
              </button>
            </div>
          </div>
        )}
        {/* Repères : haut de la tête, pieds, axe du corps */}
        <svg viewBox="0 0 300 400" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          <line x1="0" x2="300" y1="34" y2="34" stroke="white" strokeOpacity=".55" strokeDasharray="4 6" />
          <line x1="0" x2="300" y1="372" y2="372" stroke="white" strokeOpacity=".55" strokeDasharray="4 6" />
          <line x1="150" x2="150" y1="34" y2="372" stroke="white" strokeOpacity=".22" />
        </svg>
        <span className="mono-label absolute top-[5%] left-3 -translate-y-full pb-1 text-white/60">Tête</span>
        <span className="mono-label absolute bottom-[7%] left-3 translate-y-full pt-1 text-white/60">Pieds</span>
        {compte !== null && (
          <div className="absolute inset-0 grid place-items-center bg-black/25">
            <span key={compte} className="animate-in zoom-in-50 fade-in text-[89px] font-black tabular-nums">
              {compte}
            </span>
          </div>
        )}
        {flash && <div className="absolute inset-0 animate-out fade-out bg-white duration-300" />}
      </div>

      <p className="px-8 pt-3 text-center text-[13px] leading-snug text-white/60">{info.consigne}</p>

      {/* Commandes */}
      <div className="mt-auto flex items-center justify-between px-8 pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 21px)" }}>
        <div className="flex gap-1 rounded-full bg-white/10 p-1">
          {RETARDS.map((r) => (
            <button
              key={r}
              onClick={() => setRetard(r)}
              className={cn(
                "px-2.5 py-1.5 text-[12px] font-bold tabular-nums",
                retard === r ? "bouton-principal" : "bouton-discret text-white/60"
              )}
            >
              {r === 0 ? "Direct" : `${r} s`}
            </button>
          ))}
        </div>
        <button
          onClick={indispo ? () => fichier.current?.click() : appuyer}
          aria-label={compte !== null ? "Annuler le retardateur" : "Prendre la photo"}
          className="grid size-[72px] place-items-center rounded-full border-[3px] border-white"
        >
          <span
            className={cn(
              "block rounded-full bg-white transition-all",
              compte !== null ? "size-7 rounded-[8px]" : "size-[58px]"
            )}
          />
        </button>
        <button
          onClick={() => setFace((f) => (f === "user" ? "environment" : "user"))}
          aria-label="Changer de caméra"
          className="bouton-secondaire grid size-11 place-items-center"
          disabled={indispo}
        >
          {indispo ? <RefreshCw className="size-5 opacity-30" /> : <SwitchCamera className="size-5" />}
        </button>
      </div>

      <input
        ref={fichier}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={depuisFichier}
        className="hidden"
      />
    </div>
  );
}
