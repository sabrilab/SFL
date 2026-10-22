"use client";

// Au-dessus de la carte du match choisi, sur la Map : les deux derniers
// messages de sa discussion, en pilules de verre (Sabri, 22/10 : « on peut
// voir, au-dessus de la carte, les deux derniers messages qui sont
// envoyés », qu'on voie qu'une discussion est en cours). Le plus récent en
// bas, contre la carte ; le précédent au-dessus, en retrait. Un message pas
// encore lu porte le point mauve à la place de son heure ; chaque message
// qui arrive monte en pilule et se pose. Les toucher ouvre la discussion.
//
// Seuls ceux du match les voient : la base ne montre la discussion qu'à eux.
// La place des pilules est gardée tant qu'un de mes matchs a sa discussion
// (HAUTEUR_PILULES) : faire défiler les cartes ne fait pas sauter la Map.

import { useSyncExternalStore } from "react";
import { CarteDe } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { arriveesVisibles, type ApercuDiscussion } from "@/lib/sfl/discussion-match";
import type { Partie } from "@/lib/sfl/matchs";
import { resumeMessage } from "@/lib/sfl/resume-message";
import { cn } from "@/lib/utils";

/** Deux pilules et leur écart : la place à garder au-dessus du carrousel. */
export const HAUTEUR_PILULES = 2 * 36 + 6;
/** Le mauve des autres (boutons.css, bouton--mauve), assez soutenu pour le verre blanc. */
const MAUVE = "#C2569A";

// L'heure, à la minute : de quoi dire « 4 min » sans redessiner sans cesse.
const ecouterMinute = (f: () => void) => {
  const t = window.setInterval(f, 20_000);
  return () => window.clearInterval(t);
};
const minute = () => Math.floor(Date.now() / 60_000) * 60_000;

/** « maintenant », « 4 min », « 2 h », « hier », « 3 j ». */
function depuis(at: number, maintenant: number): string {
  const min = Math.max(0, Math.round((maintenant - at) / 60_000));
  if (min < 1) return "maintenant";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? "hier" : `${j} j`;
}

export function PilulesDiscussion({
  apercu,
  partie,
  onOuvrir,
}: {
  apercu: ApercuDiscussion;
  partie: Partie;
  onOuvrir: () => void;
}) {
  const maintenant = useSyncExternalStore(ecouterMinute, minute, () => 0);
  const dans = new Set([partie.organisateurId, ...partie.joueurs.map((j) => j.id)]);
  const deux = arriveesVisibles(apercu.derniers, dans).slice(-2);
  if (deux.length === 0) return null;
  const nomDe = (id: string) =>
    (id === partie.organisateurId ? partie.organisateur : partie.joueurs.find((j) => j.id === id)?.name) ?? "";

  return (
    <div data-traverse className="flex w-full flex-col items-center justify-end gap-1.5 px-4" style={{ height: HAUTEUR_PILULES }}>
      {deux.map((m, i) => {
        const nom = nomDe(m.auteurId);
        const nonLu = apercu.nonLus > 0 && !m.mien && m.at > apercu.lu;
        const ancien = i === 0 && deux.length > 1;
        return (
          <button
            key={m.id}
            type="button"
            onClick={onOuvrir}
            aria-label={`Ouvrir la discussion du match${nonLu ? ", nouveau message" : ""}`}
            className={cn(
              "bouton-givre pilule-entre flex h-9 max-w-[min(340px,100%)] min-w-0 items-center gap-2 py-0 pr-3.5 pl-1 text-left",
              ancien && "origin-bottom scale-[0.94] opacity-85"
            )}
            style={{ ["--i" as string]: i }}
          >
            <CarteDe name={nom || "?"} size={0.112} inerte className="overflow-hidden rounded-full" />
            <span className="min-w-0 flex-1 truncate text-[13.5px] leading-none tracking-[-0.1px]">
              <span className="font-bold">{m.mien ? "Toi" : nom ? <Nom n={nom} /> : "Quelqu'un"}</span>{" "}
              {m.piece?.type === "rejoint" ? (
                <span className="font-medium">{m.mien ? "as rejoint le match" : "a rejoint le match"}</span>
              ) : (
                <span className="font-medium opacity-75">{resumeMessage(m.texte, m.piece)}</span>
              )}
            </span>
            {nonLu ? (
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: MAUVE }} />
            ) : (
              <span className="shrink-0 text-[11px] font-semibold opacity-45 tabular-nums">{depuis(m.at, maintenant)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
