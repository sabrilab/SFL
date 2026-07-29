"use client";

// Bannière MVP horizontale pour l'accueil — format paysage, dynamique,
// le joueur en photo qui déborde sur un côté, thème or/rayons repris des
// cartes Boost mais adapté en large plutôt qu'en carte verticale.

import { useState } from "react";
import Link from "next/link";
import { Crown } from "lucide-react";
import { display, condensed } from "./card-shell";
import { ovr, type Player } from "@/lib/sfl/engine";
import { usePlayerPhoto } from "@/hooks/use-player-photo";

export function MvpBanner({ player, titles }: { player: Player; titles: number }) {
  const photoUrl = usePlayerPhoto(player.name);
  // Voir card-shell : on suit l'URL et non un état, pour que l'ajout d'une
  // photo relance le chargement au lieu de rester bloqué sur l'échec.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photoOk = loadedUrl === photoUrl;
  const photoFailed = failedUrl === photoUrl;
  const note = ovr(player.stats);

  return (
    <Link
      href="/stats"
      className="relative block h-[148px] w-full overflow-hidden rounded-3xl"
      style={{
        background: "radial-gradient(120% 140% at 18% 30%, #241A06 0%, #120C03 55%, #060402 100%)",
      }}
    >
      {/* Rayons d'énergie */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "conic-gradient(from 200deg at 82% 38%, rgba(244,197,66,.55), transparent 40%, rgba(244,197,66,.28) 60%, transparent 82%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(45% 70% at 88% 50%, rgba(244,197,66,.25), transparent 70%)",
        }}
      />

      {/* Photo, à droite, qui déborde jusqu'au bord */}
      <div className="absolute inset-y-0 right-0 w-[46%]">
        {!photoFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            onLoad={() => setLoadedUrl(photoUrl)}
            onError={() => setFailedUrl(photoUrl)}
            className="absolute inset-0 h-full w-full object-cover object-top"
            style={{ visibility: photoOk ? "visible" : "hidden" }}
          />
        )}
        {!photoOk && (
          <div
            style={{
              ...display,
              color: "#3A2708",
              WebkitTextStroke: "1.5px #2A1B04",
            }}
            className="absolute inset-0 flex items-center justify-center text-[86px] leading-none"
          >
            {player.name[0]}
          </div>
        )}
        {/* Fondu vers le fond, côté intérieur de la photo */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, #120C03 0%, transparent 42%)" }}
        />
      </div>

      {/* Contenu texte, à gauche */}
      <div className="relative z-10 flex h-full flex-col justify-center gap-1.5 pl-5">
        <div className="flex items-center gap-1.5 text-[#F4C542]">
          <Crown className="size-4" fill="currentColor" />
          <span
            style={condensed}
            className="text-[11px] font-bold tracking-widest uppercase"
          >
            MVP de la saison
          </span>
        </div>
        <div style={display} className="text-3xl leading-none text-[#F4E4A6]">
          {player.name}
        </div>
        <div
          style={condensed}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#C9964A]"
        >
          <span>{note} OVR</span>
          <span>·</span>
          <span>{player.poste}</span>
          <span>·</span>
          <span>
            {titles} titre{titles > 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}
