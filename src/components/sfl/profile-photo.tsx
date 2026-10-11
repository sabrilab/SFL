"use client";

// Photo de profil du joueur — pastille ronde avec badge appareil photo, comme
// sur les réseaux sociaux. Choix d'une image depuis la galerie ou l'appareil
// photo, recadrage carré automatique, recompression, puis stockage.
//
// La photo part à la ligue : elle remplit la carte du joueur chez tout le
// monde (voir lib/sfl/photos).

import { useRef, useState } from "react";
import { Camera, Crop, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePhotoPerso, usePlayerPhoto } from "@/hooks/use-player-photo";
import { removePhoto, setPhoto } from "@/lib/sfl/photos";
import { RecadrerPhoto } from "@/components/sfl/recadrer-photo";
import { useSeason } from "@/components/sfl/season-provider";
import { ovr, rareStats } from "@/lib/sfl/engine";
import { username } from "@/lib/sfl/usernames";

export function ProfilePhoto({ name }: { name: string }) {
  const src = usePlayerPhoto(name);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState(false);
  const perso = usePhotoPerso(name);
  const hasCustom = perso !== null;
  const { allPlayers } = useSeason();
  const joueur = allPlayers.find((p) => p.name === name);
  const stats = rareStats(joueur?.stats ?? { VIT: 60, TIR: 60, PAS: 60, DRI: 60, DEF: 60, PHY: 60 });
  // L'image en cours de recadrage (le fichier choisi, ou la photo actuelle).
  const [aRecadrer, setARecadrer] = useState<string | null>(null);

  function fermer() {
    if (aRecadrer?.startsWith("blob:")) URL.revokeObjectURL(aRecadrer);
    setARecadrer(null);
  }

  async function valider(dataUrl: string) {
    fermer();
    setBusy(true);
    try {
      const r = await setPhoto(name, dataUrl);
      setBroken(false);
      if (r.partagee) toast.success("Photo mise à jour", { description: "Elle est sur ta carte, chez tout le monde." });
      else toast.warning("Photo gardée sur cet appareil", { description: r.raison });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo impossible à enregistrer.");
    } finally {
      setBusy(false);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // On réinitialise tout de suite : sans ça, rechoisir le même fichier
    // ne déclenche pas de nouvel événement.
    e.target.value = "";
    if (!file) return;

    // D'abord on la place : le visage là où on le veut, puis elle part.
    setARecadrer(URL.createObjectURL(file));
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
          Elle apparaît sur ta carte, chez tous les joueurs de la ligue.
          Recadrée en carré automatiquement.
        </p>
        {hasCustom && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1.5 -ml-2 h-7 gap-1.5 px-2 text-[12px] text-muted-foreground"
            onClick={async () => {
              await removePhoto(name);
              setBroken(false);
              toast.success("Photo retirée");
            }}
          >
            <Trash2 className="size-3.5" /> Retirer
          </Button>
        )}
        {hasCustom && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1.5 h-7 gap-1.5 px-2 text-[12px] text-muted-foreground"
            onClick={() => setARecadrer(perso)}
          >
            <Crop className="size-3.5" /> Recadrer
          </Button>
        )}
      </div>

      <RecadrerPhoto
        src={aRecadrer}
        carte={{ name, username: username(name), position: joueur?.poste ?? "", overall: ovr(stats), stats }}
        onValider={valider}
        onFermer={fermer}
      />

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
