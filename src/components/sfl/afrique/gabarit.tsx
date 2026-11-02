// Le gabarit : ce que porte une nation tant que son skin n'est pas dessiné.
// Jamais tiré (pack-afrique.ts : seul « valide » se tire), jamais montré à
// un joueur ; il ne sert qu'au banc d'aperçu et à garder le registre complet.
// Une carte de papier gris, une trame fine à 45°, plus serrée au dos.

import type { CodeNation } from "@/lib/sfl/pack-afrique";
import type { PropsMotifNation, SkinNation } from "./types";
import { H, W } from "./outils";

function Trame({ cote, m, id }: PropsMotifNation) {
  const pas = cote === "dos" ? 18 : 30;
  return (
    <>
      <defs>
        <pattern id={`gabarit-${id}`} width={pas} height={pas} patternUnits="userSpaceOnUse" patternTransform={`rotate(45 ${W / 2} ${H / 2})`}>
          <path d={`M0 0L0 ${pas}`} stroke={m.fonce} strokeWidth={1.2} />
          <path d={`M3 0L3 ${pas}`} stroke={m.clair} strokeWidth={1} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#gabarit-${id})`} />
    </>
  );
}

export function gabarit(nation: CodeNation): SkinNation {
  return {
    nation,
    nom: "À dessiner",
    quoi: "",
    sources: [],
    dessine: false,
    matiere: {
      titre: "afrique",
      encre: "236,236,232",
      sombre: true,
      papier: "linear-gradient(160deg, #3a3b3f 0%, #2a2b2f 55%, #1d1e21 100%)",
      motif: { clair: "rgba(255,255,255,0.08)", fonce: "rgba(0,0,0,0.25)" },
      fond: "#2a2b2f",
      lueur: "rgba(255,255,255,0.4)",
      rayures: 0.05,
      micro: 0.06,
      reflet: 0.25,
      coins: 0.6,
      etiquette: { fond: "rgba(255,255,255,0.08)", bord: "rgba(236,236,232,0.6)", texte: "#ecece8" },
      symbole: "/bola/symbole-blanc.svg",
      rebord: { lumiere: "rgba(255,255,255,0.35)", ombre: "rgba(0,0,0,0.5)" },
      puce: "linear-gradient(135deg, #f3f3f1, #b9bab5 45%, #e6e6e3 70%, #a7a8a3)",
      cadre: "#2a2b2f",
      voile: "rgba(0,0,0,0.6)",
      onglet: { fond: "#ecece8", encre: "#1d1e21" },
      vive: "#ecece8",
      tranche: { couleur: "#2a2b2f", metal: 0.2, rugosite: 0.55 },
      holo: { force: 0.25, teinte: null },
    },
    Motif: Trame,
  };
}
