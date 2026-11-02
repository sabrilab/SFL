"use client";

// Mon Flair, relu après coup (Sabri, 30/10 : « le flair doit apparaître dans
// ma carte […] comme ma saison, niveau XP, évolution » ; « sur les récaps,
// qu'il y ait le résultat du flair »). On choisit toujours sur la feuille de
// match (matchs/flair.tsx) ; ici, on relit :
//   · FicheFlair : une journée, chacun de mes choix, juste ou raté, la bonne
//     réponse quand je me suis trompé, l'XP de la journée ;
//   · RubriqueFlair : cette fiche dans le récap d'un dimanche des Actus ;
//   · la page /profil/flair (app/profil/flair) et sa tuile dans Ma carte
//     (ma-carte/rubriques.tsx) lisent les mêmes (useMonFlair).
// La même fiche noire que sur la feuille (flair.css), dans les deux modes :
// ni or, ni bleu, ni rouge (cartes MVP / Défensive / Impact) ; le juste en
// vert, le raté barré.

import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { heureLisible } from "@/lib/sfl/revelation";
import { PlayerCard } from "@/components/sfl/player-card";
import { useSeason } from "@/components/sfl/season-provider";
import { BLANCS, NOIRS, Pouls } from "@/components/sfl/actus/missions";
import { useIdentites } from "@/hooks/use-identites";
import { useMonFlair } from "@/hooks/use-pronos";
import { NOM_ECART, type ChoixFlair, type FlairDeJournee } from "@/lib/sfl/pronos";
import { cn } from "@/lib/utils";
import "@/components/sfl/matchs/flair.css";

export const NOM_CAMP: Record<string, string> = { noirs: "Noirs", nul: "Nul", blancs: "Blancs" };
/** Un choix qui n'est pas un joueur : un camp (Noirs, Nul, Blancs) ou un écart (Serré, Net, Large). */
export const NOM_CHOIX: Record<string, string> = { ...NOM_CAMP, ...NOM_ECART };
const estCamp = (s: string) => s in NOM_CHOIX;

/** Juste · +20 XP, Raté, Posé trop tard, ou rien tant que la feuille n'est pas remplie. */
export function VerdictFlair({ etat, xp }: { etat: ChoixFlair["etat"]; xp?: number }) {
  if (etat === "juste") return <span className="mono-label text-[#9fe0a8]">Juste{xp ? ` · +${xp} XP` : ""}</span>;
  if (etat === "faux") return <span className="mono-label text-white/45">Raté</span>;
  if (etat === "hors-delai") return <span className="mono-label text-white/45">Posé trop tard</span>;
  return <span className="mono-label text-white/45">En attente</span>;
}

/** Un camp, dans ses couleurs de maillot ; le nul en verre. */
export function PastilleCamp({ camp, barre }: { camp: string; barre?: boolean }) {
  const ton = camp === "noirs" ? NOIRS : camp === "blancs" ? BLANCS : null;
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-3 text-corps font-bold",
        !ton && "bg-white/[0.08] text-white",
        camp === "noirs" && "shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22)]",
        barre && "line-through decoration-2 opacity-60"
      )}
      style={ton ? { background: ton.fond, color: ton.encre } : undefined}
    >
      {NOM_CHOIX[camp] ?? camp}
    </span>
  );
}

/** Un de mes choix : le sujet, ce que j'ai dit, le verdict, la bonne réponse si je me suis trompé. */
function LigneChoix({ c }: { c: ChoixFlair }) {
  const { allPlayers } = useSeason();
  const identite = useIdentites();
  const rate = c.etat === "faux";
  const camp = estCamp(c.choix);
  const p = camp ? undefined : allPlayers.find((x) => x.name === c.choix);
  const reponse = rate && c.bons?.length ? c.bons.map((n) => (estCamp(n) ? NOM_CHOIX[n] : identite.nom(n).split(" ")[0])).join(", ") : null;
  return (
    <div className="flex items-center gap-3">
      {!camp && (
        <span className={cn("shrink-0", rate && "opacity-60")}>
          {p ? (
            <PlayerCard player={p} size={FORMAT_CARTE.petite} />
          ) : (
            <span className="block rounded-[8px] border border-dashed border-white/30" style={{ width: 254 * FORMAT_CARTE.petite, height: 254 * FORMAT_CARTE.petite * 1.4 }} />
          )}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="mono-label text-white/55">{c.titre}</span>
        {camp ? (
          <span>
            <PastilleCamp camp={c.choix} barre={rate} />
          </span>
        ) : (
          <span className={cn("truncate text-titre leading-tight font-bold", rate && "text-white/60 line-through decoration-2")}>{identite.nom(c.choix)}</span>
        )}
        {reponse && <span className="font-mono text-legende text-white/50">C&apos;était {reponse}</span>}
      </div>
      <span className="shrink-0 text-right">
        <VerdictFlair etat={c.etat} xp={c.etat === "juste" ? c.xp : undefined} />
      </span>
    </div>
  );
}

/** Ce que dit l'en-tête d'une journée de Flair, à droite. */
function EtatJournee({ f }: { f: FlairDeJournee }) {
  if (f.phase === "ouvert")
    return (
      <span className="mono-label flex shrink-0 items-center gap-2 text-white/80">
        <Pouls bat={false} /> Ouvert
      </span>
    );
  if (!f.juges)
    return (
      <span className="mono-label flex shrink-0 items-center gap-2 text-white/80">
        <Pouls bat={f.phase === "en-jeu"} /> En jeu
      </span>
    );
  return (
    <span className={cn("mono-label shrink-0", f.xp ? "text-[#9fe0a8]" : "text-white/55")}>
      {f.phase === "en-jeu" ? `Verdict à ${heureLisible(f.finDuJour)} · ` : ""}+{f.xp} XP
    </span>
  );
}

/** Une journée de mon Flair : la fiche noire, mes choix, le verdict. */
export function FicheFlair({ f, titre = "Ton Flair", className }: { f: FlairDeJournee; titre?: string; className?: string }) {
  return (
    <section aria-label={`${titre}, J${f.j}`} className={cn("flair flex flex-col gap-3.5 p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="titre-lettrage text-titre-m leading-[0.95]">{titre}</h3>
          <span className="mono-label text-white/50">{[titre === "Ton Flair" ? `J${f.j}` : null, f.date || null].filter(Boolean).join(" · ")}</span>
        </div>
        <EtatJournee f={f} />
      </div>
      <div className="flair__bloc flex flex-col gap-3.5">
        {f.choix.map((c) => (
          <LigneChoix key={c.sujet} c={c} />
        ))}
      </div>
      {f.juges > 0 && (
        <p className="mono-label text-white/45">
          {f.justes} sur {f.choix.length} · {f.plafond} XP au plus par journée
        </p>
      )}
    </section>
  );
}

/** Mon Flair dans le récap d'un dimanche : rien si je n'y ai rien choisi, ou si le dimanche n'a pas commencé. */
export function RubriqueFlair({ j, className }: { j: number; className?: string }) {
  const { saison } = useSeason();
  const mon = useMonFlair();
  const f = mon?.journees.find((x) => x.j === j && x.saison === (saison.numero ?? 0));
  if (!f || f.phase === "ouvert") return null;
  return <FicheFlair f={f} className={cn("mx-4 my-2 md:mx-0 md:my-0", className)} />;
}
