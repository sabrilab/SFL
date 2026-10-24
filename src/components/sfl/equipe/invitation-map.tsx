"use client";

// L'invitation d'une équipe du mode Team, sur la Map (passe du 23/10 : une
// invitation qu'on ne voyait que sur la page Team restait sans réponse).
// La même carte que celle d'un match (matchs/invitations.tsx), l'écusson de
// l'équipe à la place de la carte de l'organisateur : qui m'invite, où,
// l'effectif et jusqu'à quand. La toucher ouvre la signature sur la page
// Team (/bola-team?invitation=id). Plusieurs : la plus ancienne (elle tombe
// la première), et le nombre des autres. La pastille de l'onglet Map les
// compte aussi (bottom-nav.tsx).

import Link from "next/link";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { inviteur, signataires, type Equipe, type Membre } from "@/lib/sfl/equipes";
import { finInvitation, quandTombe } from "@/lib/sfl/equipes-temps";

const ENCRE = "#0A0B0D";
const BLANC = "#F4F5F2";

export function InvitationsEquipe({ invitations, moi }: { invitations: Equipe[]; moi: string | null }) {
  const rangees = invitations
    .map((e) => ({ e, m: e.membres.find((x) => x.id === moi && x.statut === "invite") }))
    .filter((x): x is { e: Equipe; m: Membre } => !!x.m)
    .sort((a, b) => (a.m.depuis ?? "").localeCompare(b.m.depuis ?? ""));
  const premiere = rangees[0];
  if (!premiere) return null;
  const { e, m } = premiere;
  const n = signataires(e).length;
  const autres = rangees.length - 1;
  return (
    <div className="w-full px-4">
      <Link
        href={`/bola-team?invitation=${e.id}`}
        className="map-monte map-touche flex w-full items-center gap-3 rounded-[22px] py-2.5 pr-4 pl-2.5 text-left shadow-[0_6px_14px_rgba(0,0,0,0.22)]"
        style={{ background: BLANC, color: ENCRE }}
      >
        <span className="relative shrink-0">
          <Ecusson initiales={e.initiales} fond={e.fond} blason={e.blason} taille={42} />
          <span aria-hidden className="absolute -top-1 -right-1 size-3 rounded-full" style={{ background: "#FF3B30", boxShadow: `0 0 0 2px ${BLANC}` }} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-bold tracking-[-0.2px]">
            {inviteur(e, m)} t&apos;invite · {e.nom}
          </span>
          <span className="truncate text-[13px] font-medium opacity-60">
            Bola Team · {n} joueur{n > 1 ? "s" : ""}
            {m.depuis && <> · jusqu&apos;à {quandTombe(finInvitation(m.depuis))}</>}
          </span>
        </span>
        {autres > 0 && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums" style={{ background: ENCRE, color: BLANC }}>
            +{autres}
          </span>
        )}
      </Link>
    </div>
  );
}
