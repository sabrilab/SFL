// Le registre des skins de nation : une ligne par nation (lib/sfl/pack-afrique.ts
// tient la liste). Il fait de chaque SkinNation une matière (MATIERES,
// finitions-carte.ts, qui l'étale) et retrouve son motif (motifs-afrique.tsx).
// Un totem qui passe devant la lune (totems/, pose.dos.devant) retire le
// logo de dos-carte.tsx : totem.tsx le redessine autour de lui.
// N'importe de finitions-carte.ts que des types.

import type { Matiere } from "@/components/sfl/finitions-carte";
import { NATIONS, type CodeNation } from "@/lib/sfl/pack-afrique";
import type { FinitionAfrique, MotifAfrique, SkinNation } from "./types";
import afriqueDuSud from "./afrique-du-sud";
import algerie from "./algerie";
import cameroun from "./cameroun";
import coteDIvoire from "./cote-d-ivoire";
import egypte from "./egypte";
import kenya from "./kenya";
import mali from "./mali";
import maroc from "./maroc";
import nigeria from "./nigeria";
import ouganda from "./ouganda";
import senegal from "./senegal";
import tanzanie from "./tanzanie";
import { TOTEMS } from "./totems";

export const SKINS_AFRIQUE: Record<CodeNation, SkinNation> = {
  ke: kenya,
  ug: ouganda,
  tz: tanzanie,
  ma: maroc,
  sn: senegal,
  ci: coteDIvoire,
  ng: nigeria,
  eg: egypte,
  dz: algerie,
  cm: cameroun,
  ml: mali,
  za: afriqueDuSud,
};

export function estMotifAfrique(m: { type: string }): m is MotifAfrique {
  return m.type === "afrique";
}

export const MATIERES_AFRIQUE = Object.fromEntries(
  NATIONS.map(({ id }) => {
    const s = SKINS_AFRIQUE[id];
    const t = TOTEMS[id];
    const devant = t.dessine && !!t.pose.dos.devant;
    const matiere: Matiere = {
      ...s.matiere,
      ...(devant && { dos: { ...s.matiere.dos, logo: false as const } }),
      nom: `afrique-${id}`,
      motif: { type: "afrique", nation: id, ...s.matiere.motif },
    };
    return [`afrique-${id}`, matiere];
  })
) as Record<FinitionAfrique, Matiere>;
