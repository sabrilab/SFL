"use client";

// Le banc : la place de l'entraîneur, hors du terrain (Ilyes, 02/11/2026 :
// « une équipe = 7 joueurs + 1 entraîneur »). Sous le terrain de la page
// Team (terrain-places.tsx garde ses 7 places de joueurs), une huitième
// place, à part :
//   · l'entraîneur en place : sa carte d'entraîneur (carte-entraineur.tsx,
//     le Tableau) au format moyen, 78 px, le palier réduit (la note centrée
//     et l'écusson de l'équipe), son prénom dessous ;
//   · invité : sa carte voilée et le temps qui lui reste (« Adil · 71 h ») ;
//   · personne : au capitaine, un + comme une place libre du terrain, qui
//     ouvre la liste des joueurs ; aux autres, rien.
// Jamais de tirets autour : dans l'app, un bord en tirets veut dire
// « invité », et ce signe reste aux joueurs. Sa carte porte 75 partout tant
// que le calcul de ses trois caractéristiques n'a rien posé.

import { Plus } from "lucide-react";
import { CarteEntraineur } from "@/components/sfl/carte-entraineur";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { usePhotoPerso } from "@/hooks/use-player-photo";
import { DEPART_ENTRAINEUR, type StatsEntraineur } from "@/lib/sfl/entraineur";
import { finInvitation, resteAvant } from "@/lib/sfl/equipes-temps";
import type { Equipe, Membre } from "@/lib/sfl/equipes";
import { cn } from "@/lib/utils";

const DEPART: StatsEntraineur = { RES: DEPART_ENTRAINEUR, PRES: DEPART_ENTRAINEUR, COH: DEPART_ENTRAINEUR };
/** La carte au format moyen : 78 px de large (mini-carte.tsx). */
const COTE = 254 * FORMAT_CARTE.moyenne;
const prenom = (nom: string) => nom.split(" ")[0];

/** La carte d'entraîneur d'un membre, avec sa photo du studio. */
export function CarteEntraineurDuMembre({ equipe, nom, stats = DEPART, size = FORMAT_CARTE.moyenne }: { equipe: Equipe; nom: string; stats?: StatsEntraineur; size?: number }) {
  const photo = usePhotoPerso(nom);
  return (
    <CarteEntraineur
      nom={nom}
      equipe={{ nom: equipe.nom, initiales: equipe.initiales, fond: equipe.fond, blason: equipe.blason }}
      photo={photo}
      stats={stats}
      size={size}
    />
  );
}

export function BancEntraineur({
  equipe,
  entraineur,
  moi,
  onPlus,
  onEntraineur,
}: {
  equipe: Equipe;
  /** L'entraîneur en place ou invité (entraineurDe) ; null : la place est libre. */
  entraineur: Membre | null;
  /** Mon identifiant : ma propre carte dit « Toi ». */
  moi: string | null;
  /** Le capitaine : toucher la place libre ouvre la liste des joueurs ; sans, la place libre ne se montre pas. */
  onPlus?: () => void;
  onEntraineur: (m: Membre) => void;
}) {
  if (!entraineur) {
    if (!onPlus) return null;
    return (
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={onPlus}
          aria-label="Inviter un entraîneur"
          className="grid place-items-center rounded-[12px] bg-contraste/[0.06] text-contraste/80 transition-transform active:scale-95"
          style={{ width: COTE, height: COTE * 1.617 }}
        >
          <Plus className="size-6" strokeWidth={2.4} />
        </button>
        <span className="mono-label text-muted-foreground">Entraîneur</span>
      </div>
    );
  }
  const invite = entraineur.statut === "invite";
  const toi = entraineur.id === moi;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => onEntraineur(entraineur)}
        aria-label={[entraineur.name, "entraîneur", invite && "invité"].filter(Boolean).join(", ")}
        className="relative flex transition-transform active:scale-95"
      >
        <span className={cn("flex", invite && "opacity-45")}>
          <CarteEntraineurDuMembre equipe={equipe} nom={entraineur.name} />
        </span>
      </button>
      <span className={cn("text-ligne", toi ? "font-extrabold" : "font-semibold")}>
        {toi ? "Toi" : prenom(entraineur.name)}
        {invite && entraineur.depuis && (
          <span className="font-medium text-muted-foreground tabular-nums"> · {resteAvant(finInvitation(entraineur.depuis))}</span>
        )}
      </span>
    </div>
  );
}
