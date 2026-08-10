"use client";

// Le tableau de présence de la prochaine journée.
//
// Vue joueur : ma réponse, en gros, avec le décompte de l'effectif.
// Vue admin : qui a répondu quoi, et surtout qui n'a pas répondu — la liste
// que l'admin passait son dimanche à reconstituer à la main.

import { useMemo } from "react";
import { Check, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { useSeason } from "@/components/sfl/season-provider";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSession } from "@/hooks/use-session";
import { listPresence, setPresence, PRESENCE_IS_SHARED } from "@/lib/sfl/presence";
import { NEXT_MATCH } from "@/lib/sfl/data";
import { cn } from "@/lib/utils";

const EFFECTIF_CIBLE = 10;

export function PresencePanel({ compact = false }: { compact?: boolean }) {
  const { saison } = useSeason();
  const { player } = useMyPlayer();
  const session = useSession();
  const admin = !!session?.admin;

  const state = useMemo(
    () => listPresence(saison, saison.roster.map((r) => ({ name: r.name, profil: r.profil }))),
    [saison]
  );

  const convoc = state.convocation;
  const mine = convoc ? ((convoc.reponses[player.name] as "present" | "absent" | undefined) ?? null) : null;
  const jour = convoc ? `${convoc.jour} ${convoc.date}` : `${NEXT_MATCH.jour} ${NEXT_MATCH.date}`;
  const heure = convoc?.heure ?? NEXT_MATCH.heure;
  const lieu = convoc?.lieu ?? NEXT_MATCH.lieu;

  function answer(value: "present" | "absent") {
    const next = mine === value ? null : value;
    if (!setPresence(saison, player.name, next)) {
      toast.error("Aucune convocation ouverte pour l'instant.");
      return;
    }
    toast.success(
      next === "present"
        ? "C'est noté : tu es de la partie ⚽"
        : next === "absent"
          ? "C'est noté : tu passes ton tour."
          : "Réponse retirée."
    );
  }

  function copyRelances() {
    const list = state.sansReponse.join(", ");
    navigator.clipboard
      ?.writeText(
        `Convocation J${NEXT_MATCH.journee} — ${jour}, ${heure}, ${lieu}.\n` +
          `${state.presents.length}/${EFFECTIF_CIBLE} confirmés.\n` +
          `Sans réponse : ${list || "personne"}`
      )
      .then(() => toast.success("Relance copiée"))
      .catch(() => toast.error("Copie impossible"));
  }

  const jauge = Math.min(100, Math.round((state.presents.length / EFFECTIF_CIBLE) * 100));

  return (
    <section className="glass rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mono-label text-primary">J{NEXT_MATCH.journee} · Ma présence</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">{jour}</h2>
          <p className="mt-1 text-[13px] text-foreground/45">
            {heure} · {lieu}
          </p>
        </div>
        {mine && (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              mine === "present" ? "bg-primary/15 text-primary" : "bg-foreground/10 text-foreground/45"
            )}
          >
            {mine === "present" ? (
              <Check className="size-[18px]" strokeWidth={2.5} />
            ) : (
              <X className="size-[18px]" strokeWidth={2.5} />
            )}
          </span>
        )}
      </div>

      {/* Les deux boutons — la réponse est modifiable jusqu'au coup d'envoi. */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => answer("present")}
          className={cn(
            "flex-1 rounded-full py-3.5 text-[15px] font-bold transition-transform active:scale-[0.98]",
            mine === "present" ? "bg-primary text-primary-foreground" : "bg-foreground text-background"
          )}
        >
          {mine === "present" ? "Je viens ✓" : "Je viens"}
        </button>
        <button
          onClick={() => answer("absent")}
          className={cn(
            "flex-1 rounded-full py-3.5 text-[15px] font-semibold transition-transform active:scale-[0.98]",
            mine === "absent" ? "bg-[#FF6B5E]/20 text-[#FF6B5E]" : "glass-soft text-foreground/70"
          )}
        >
          {mine === "absent" ? "Pas dispo ✓" : "Pas dispo"}
        </button>
      </div>

      {/* La jauge de l'effectif */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="mono-label text-foreground/40">Effectif confirmé</span>
          <span className="text-[13px] font-bold tabular-nums">
            {state.presents.length}
            <span className="text-foreground/35">/{EFFECTIF_CIBLE}</span>
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${jauge}%` }}
          />
        </div>
      </div>

      {!PRESENCE_IS_SHARED && (
        <p className="mt-3 text-[12px] leading-snug text-foreground/35">
          Réponses enregistrées sur cet appareil pour l&apos;instant. Elles seront partagées
          avec toute la ligue dès la mise en base.
        </p>
      )}

      {/* Vue admin : le tableau complet */}
      {admin && !compact && (
        <div className="mt-5 border-t border-white/8 pt-4">
          <div className="flex items-center justify-between">
            <p className="mono-label text-primary">Vue admin · les réponses</p>
            {state.sansReponse.length > 0 && (
              <button
                onClick={copyRelances}
                className="glass-soft mono-label flex items-center gap-1.5 rounded-full px-2.5 py-1 text-foreground/60"
              >
                <Copy className="size-3" /> Relance
              </button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {(
              [
                [state.presents.length, "Présents", "text-primary"],
                [state.absents.length, "Absents", "text-foreground/60"],
                [state.sansReponse.length, "Sans réponse", "text-[#FF6B5E]"],
              ] as const
            ).map(([n, label, cls]) => (
              <div key={label} className="glass-soft rounded-2xl px-2 py-3 text-center">
                <div className={cn("text-[22px] leading-none font-extrabold tabular-nums", cls)}>
                  {n}
                </div>
                <p className="mono-label mt-1.5 text-foreground/40">{label}</p>
              </div>
            ))}
          </div>

          {(
            [
              ["Présents", state.presents, "bg-primary/15 text-primary"],
              ["Absents", state.absents, "glass-soft text-foreground/50"],
              ["Sans réponse", state.sansReponse, "bg-[#FF6B5E]/12 text-[#FF6B5E]"],
            ] as const
          ).map(([label, list, cls]) =>
            list.length > 0 ? (
              <div key={label} className="mt-3.5">
                <p className="mono-label mb-2 text-foreground/40">{label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((n) => (
                    <span
                      key={n}
                      className={cn("rounded-full px-2.5 py-1 text-[12.5px] font-semibold", cls)}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
    </section>
  );
}
