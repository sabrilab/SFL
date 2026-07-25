"use client";

// Import des trois photos (face, profil gauche, profil droit) qui servent à
// texturer le visage de l'avatar. Chaque photo passe par la détection du
// visage : elle est recadrée, redressée et détourée avant projection, de
// sorte qu'une photo prise n'importe où reste exploitable.

import { useRef, useState } from "react";
import { Camera, Check, Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { preparePhoto, type PreparedPhoto } from "@/lib/sfl/face-crop";
import type { FacePhotos } from "@/lib/sfl/face-projection";

type Slot = "front" | "left" | "right";

const SLOTS: { key: Slot; label: string; hint: string }[] = [
  { key: "front", label: "De face", hint: "Regard vers l'objectif" },
  { key: "left", label: "Profil gauche", hint: "Tourne la tête à droite" },
  { key: "right", label: "Profil droit", hint: "Tourne la tête à gauche" },
];

type SlotState =
  | { status: "empty" }
  | { status: "loading"; preview: string }
  | { status: "ready"; preview: string; photo: PreparedPhoto }
  | { status: "noface"; preview: string; photo: PreparedPhoto };

export function PhotoImport({
  onApply,
  onReset,
  applied,
}: {
  onApply: (photos: FacePhotos) => void;
  onReset: () => void;
  applied: boolean;
}) {
  const [slots, setSlots] = useState<Record<Slot, SlotState>>({
    front: { status: "empty" },
    left: { status: "empty" },
    right: { status: "empty" },
  });
  const inputs = useRef<Record<Slot, HTMLInputElement | null>>({
    front: null,
    left: null,
    right: null,
  });

  const pick = async (slot: Slot, file: File) => {
    const preview = URL.createObjectURL(file);
    setSlots((s) => ({ ...s, [slot]: { status: "loading", preview } }));
    try {
      const photo = await preparePhoto(preview);
      setSlots((s) => ({
        ...s,
        [slot]: photo.detected
          ? { status: "ready", preview: photo.url, photo }
          : { status: "noface", preview, photo },
      }));
    } catch {
      setSlots((s) => ({ ...s, [slot]: { status: "empty" } }));
    }
  };

  const ready =
    slots.front.status === "ready" &&
    slots.left.status === "ready" &&
    slots.right.status === "ready";

  const apply = () => {
    if (!ready) return;
    onApply({
      front: (slots.front as { photo: PreparedPhoto }).photo,
      left: (slots.left as { photo: PreparedPhoto }).photo,
      right: (slots.right as { photo: PreparedPhoto }).photo,
    });
  };

  const clear = () => {
    setSlots({ front: { status: "empty" }, left: { status: "empty" }, right: { status: "empty" } });
    onReset();
  };

  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
        Mon visage en photo
      </h2>
      <div className="glass rounded-2xl p-3">
        <p className="mb-3 px-1 text-[12px] text-muted-foreground">
          Trois photos et ton visage habille l&apos;avatar. Le cadrage et le fond
          n&apos;ont pas d&apos;importance, le visage est détecté automatiquement.
        </p>

        <div className="flex gap-2">
          {SLOTS.map(({ key, label, hint }) => {
            const st = slots[key];
            return (
              <button
                key={key}
                onClick={() => inputs.current[key]?.click()}
                className="flex flex-1 flex-col items-center gap-1.5"
                aria-label={`${label} — ${hint}`}
              >
                <span
                  className={cn(
                    "relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-foreground/15 bg-foreground/5",
                    st.status === "ready" && "border-solid border-emerald-500/60"
                  )}
                >
                  {st.status === "empty" ? (
                    <Camera className="size-5 text-muted-foreground" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={st.preview} alt={label} className="size-full object-cover" />
                  )}
                  {st.status === "loading" && (
                    <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                      <Loader2 className="size-4 animate-spin" />
                    </span>
                  )}
                  {st.status === "ready" && (
                    <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="size-3" />
                    </span>
                  )}
                  {st.status === "noface" && (
                    <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-white">
                      <TriangleAlert className="size-3" />
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-semibold">{label}</span>
                <span className="text-[10px] leading-tight text-muted-foreground">
                  {st.status === "noface" ? "Visage non détecté" : hint}
                </span>
                <input
                  ref={(el) => {
                    inputs.current[key] = el;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && pick(key, e.target.files[0])}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={apply}
            disabled={!ready}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-opacity",
              ready
                ? "bg-foreground text-background active:opacity-70"
                : "cursor-not-allowed bg-foreground/10 text-muted-foreground"
            )}
          >
            {applied ? "Mettre à jour" : "Appliquer à l'avatar"}
          </button>
          {applied && (
            <button
              onClick={clear}
              aria-label="Revenir au visage dessiné"
              className="flex items-center justify-center rounded-xl bg-foreground/10 px-3 active:opacity-70"
            >
              <RotateCcw className="size-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
