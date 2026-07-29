"use client";

// Photo de profil du joueur — pastille ronde avec badge appareil photo, comme
// sur les réseaux sociaux. Choix d'une image depuis la galerie ou l'appareil
// photo, recadrage carré automatique, recompression, puis stockage.
//
// La photo alimente ensuite toutes les cartes du joueur (voir lib/sfl/photos).

import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePlayerPhoto } from "@/hooks/use-player-photo";
import { getPhoto, preparePhoto, removePhoto, setPhoto } from "@/lib/sfl/photos";

export function ProfilePhoto({ name }: { name: string }) {
  const src = usePlayerPhoto(name);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState(false);
  const hasCustom = getPhoto(name) !== null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // On réinitialise tout de suite : sans ça, rechoisir le même fichier
    // ne déclenche pas de nouvel événement.
    e.target.value = "";
    if (!file) return;

    setBusy(true);
    try {
      setPhoto(name, await preparePhoto(file));
      setBroken(false);
      toast.success("Photo mise à jour");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo impossible à enregistrer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label="Changer ma photo de profil"
        className="relative size-20 shrink-0 rounded-full transition-opacity active:opacity-70 disabled:opacity-50"
      >
        <span className="block size-20 overflow-hidden rounded-full bg-foreground/10 ring-1 ring-foreground/15">
          {broken ? (
            <span className="flex size-full items-center justify-center text-2xl font-bold text-muted-foreground">
              {name[0]}
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              onError={() => setBroken(true)}
              onLoad={() => setBroken(false)}
              className="size-full object-cover"
            />
          )}
        </span>
        <span className="absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full bg-foreground text-background ring-2 ring-background">
          <Camera className="size-3.5" />
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">Ma photo</p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
          Elle apparaît sur ta carte et dans le feed. Recadrée en carré
          automatiquement.
        </p>
        {hasCustom && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1.5 -ml-2 h-7 gap-1.5 px-2 text-[12px] text-muted-foreground"
            onClick={() => {
              removePhoto(name);
              setBroken(false);
              toast.success("Photo retirée");
            }}
          >
            <Trash2 className="size-3.5" /> Retirer
          </Button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        onChange={onPick}
        className="hidden"
      />
    </div>
  );
}
