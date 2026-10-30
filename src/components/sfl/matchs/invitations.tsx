"use client";

// Les invitations à un match, dans l'app (Sabri, 22/10 : une invitation doit
// se voir, pas seulement sonner sur le téléphone). Sur la Map, au-dessus des
// boutons : la carte de qui m'invite, le match, le jour, l'heure et le lieu ;
// la toucher ouvre la fiche du match, où l'on répond (Je viens, Pas dispo).
// Plusieurs invitations : la plus proche, et le nombre des autres.
// La pastille rouge de l'onglet Map compte les mêmes (use-invitations.ts).

import { Pastille } from "@/components/sfl/matchs/feuille-de-match";
import { useSeason } from "@/components/sfl/season-provider";
import { jourCourt } from "@/lib/sfl/jour-long";
import { aujourdhuiIso, type Partie } from "@/lib/sfl/matchs";

const ENCRE = "#0A0B0D";
const BLANC = "#F4F5F2";

/** Mes invitations sans réponse, du match le plus proche au plus loin. */
export function invitationsDe(parties: Partie[], moi: string | null): Partie[] {
  if (!moi) return [];
  const aujourdhui = aujourdhuiIso();
  return parties
    .filter((p) => p.jour >= aujourdhui && p.joueurs.some((j) => j.id === moi && j.statut === "invite"))
    .sort((a, b) => (a.jour + a.heure).localeCompare(b.jour + b.heure));
}

export function Invitations({ invitations, onOuvrir }: { invitations: Partie[]; onOuvrir: (p: Partie) => void }) {
  const { allPlayers } = useSeason();
  const p = invitations[0];
  if (!p) return null;
  const autres = invitations.length - 1;
  const orga = p.organisateur;
  return (
    <div className="w-full px-4">
      <button
        type="button"
        onClick={() => onOuvrir(p)}
        className="map-monte map-touche flex w-full items-center gap-3 rounded-[22px] py-2.5 pr-4 pl-2.5 text-left shadow-[0_6px_14px_rgba(0,0,0,0.22)]"
        style={{ background: BLANC, color: ENCRE }}
      >
        <span className="relative shrink-0">
          <Pastille player={allPlayers.find((x) => x.name === orga)} nom={orga} cote={44} onglet={{ fond: ENCRE, encre: BLANC }} />
          <span aria-hidden className="absolute -top-1 -right-1 size-3 rounded-full" style={{ background: "#FF3B30", boxShadow: `0 0 0 2px ${BLANC}` }} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-lecture font-bold tracking-[-0.2px]">
            {orga.split(" ")[0]} t&apos;invite
          </span>
          <span className="truncate text-corps font-medium opacity-60">
            {jourCourt(p.jour, aujourdhuiIso())} · {p.heure} · {p.lieu}
          </span>
        </span>
        {autres > 0 && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-petit font-bold tabular-nums" style={{ background: ENCRE, color: BLANC }}>
            +{autres}
          </span>
        )}
      </button>
    </div>
  );
}
