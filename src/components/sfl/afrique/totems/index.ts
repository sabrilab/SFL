// Les totems des nations (types.ts, TotemNation) : une ligne par nation.
// Lu par le registre des skins (registre.ts : un totem qui passe devant la
// lune retire le logo du dos) et par totem.tsx, qui les pose. N'importe que
// les fichiers de totems (ni finitions-carte.ts, ni totem.tsx : le registre
// est lu avant les matières).

import type { CodeNation } from "@/lib/sfl/pack-afrique";
import type { TotemNation } from "../types";
import kenya from "./kenya";
import ouganda from "./ouganda";
import tanzanie from "./tanzanie";
import maroc from "./maroc";
import senegal from "./senegal";
import coteDIvoire from "./cote-d-ivoire";
import nigeria from "./nigeria";
import egypte from "./egypte";
import algerie from "./algerie";
import cameroun from "./cameroun";
import mali from "./mali";
import afriqueDuSud from "./afrique-du-sud";

export const TOTEMS: Record<CodeNation, TotemNation> = {
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
