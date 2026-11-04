"use client";

// Le motif d'une matière de nation : le <svg> dans le repère de la carte,
// puis le dessin du fichier de la nation (registre.ts), face ou dos, puis
// son totem (totem.tsx : au dos, le héros ; à la face, dans la marge).

import { useId } from "react";
import type { MotifAfrique } from "./types";
import { SKINS_AFRIQUE } from "./registre";
import { H, W } from "./outils";
import { TotemDos, TotemFace } from "./totem";

export function MotifAfriqueSvg({
  motif,
  graine = 1,
  dos = false,
  nom,
}: {
  motif: MotifAfrique & { clair: string; fonce: string };
  graine?: number;
  dos?: boolean;
  nom?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { Motif } = SKINS_AFRIQUE[motif.nation];
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <Motif cote={dos ? "dos" : "face"} m={{ clair: motif.clair, fonce: motif.fonce }} graine={graine} nom={nom} id={id} />
      {dos ? <TotemDos nation={motif.nation} graine={graine} id={id} /> : <TotemFace nation={motif.nation} graine={graine} id={id} />}
    </svg>
  );
}
