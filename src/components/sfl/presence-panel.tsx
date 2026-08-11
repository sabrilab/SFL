"use client";

// Le tableau de présence de la prochaine journée.
//
// Vue joueur : ma réponse, en gros, avec le décompte de l'effectif.
// Vue admin : qui a répondu quoi, et surtout qui n'a pas répondu — la liste
// que l'admin passait son dimanche à reconstituer à la main.
//
// Toute la donnée vient de usePresence : partagée (Supabase, temps réel)
// quand la base est branchée, locale sinon. L'écran ne fait pas la différence.

import { Check, Copy, Radio, X } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { usePresence } from "@/hooks/use-presence";
import { cn } from "@/lib/utils";

export function PresencePanel({ compact = false }: { compact?: boolean }) {
  const session = useSession();
  const admin = !!session?.admin;
  const p = usePresence();

  async function answer(value: "present" | "absent") {
    const next = p.mine === value ? null : value;
    const ok = await p.answer(next);
    if (!ok) {
      toast.error("Réponse impossible à enregistrer. Réessaie dans un instant.");
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
    const list = p.sansReponse.join(", ");
    navigator.clipboard
      ?.writeText(
        `Convocation J${p.journee} — ${p.jour}, ${p.heure}, ${p.lieu}.\n` +
          `${p.presents.length}/${p.effectif} confirmés.\n` +
          `Sans réponse : ${list || "personne"}`
      )
      .then(() => toast.success("Relance copiée"))
      .catch(() => toast.error("Copie impossible"));
  }

  async function publish() {
    if (!p.publish) return;
    const ok = await p.publish();
    if (ok) toast.success("Convocation publiée — la liste devient commune à toute la ligue.");
    else toast.error("Publication impossible. Vérifie l'installation (Réglages → Espace admin).");
  }

  const jauge = Math.min(100, Math.round((p.presents.length / p.effectif) * 100));

  return (
    <section className="glass rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mono-label text-primary">J{p.journee} · Ma présence</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">{p.jour}</h2>
          <p className="mt-1 text-[13px] text-foreground/45">
            {p.heure} · {p.lieu}
          </p>
        </div>
        {p.mine && (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              p.mine === "present" ? "bg-primary/15 text-primary" : "bg-foreground/10 text-foreground/45"
            )}
          >
            {p.mine === "present" ? (
              <Check className="size-[18px]" strokeWidth={2.5} />
            ) : (
              <X className="size-[18px]" strokeWidth={2.5} />
            )}
          </span>
        )}
      </div>

      {/* Les deux boutons — la réponse est modifiable jusqu'à vendredi minuit. */}
      {p.reponsesOuvertes ? (
        <>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => answer("present")}
              className={cn(
                "flex-1 rounded-full py-3.5 text-[15px] font-bold transition-transform active:scale-[0.98]",
                p.mine === "present" ? "bg-primary text-primary-foreground" : "bg-foreground text-background"
              )}
            >
              {p.mine === "present" ? "Je viens ✓" : "Je viens"}
            </button>
            <button
              onClick={() => answer("absent")}
              className={cn(
                "flex-1 rounded-full py-3.5 text-[15px] font-semibold transition-transform active:scale-[0.98]",
                p.mine === "absent" ? "bg-[#FF6B5E]/20 text-[#FF6B5E]" : "glass-soft text-foreground/70"
              )}
            >
              {p.mine === "absent" ? "Pas dispo ✓" : "Pas dispo"}
            </button>
          </div>
          <p className="mono-label mt-2.5 text-center text-foreground/30">
            Réponses jusqu&apos;à vendredi minuit · répondre rapporte 2 ⚽
          </p>
        </>
      ) : (
        <p className="mt-4 rounded-[14px] bg-white/5 px-3.5 py-3 text-[12.5px] leading-snug text-foreground/45">
          Les réponses sont closes depuis vendredi minuit.
          {p.mine === "present"
            ? " Tu es sur la liste — à dimanche ⚽"
            : p.mine === "absent"
              ? " Tu as passé ton tour."
              : " Sans réponse, tu n'es pas retenu. La conversation rouvre lundi."}
        </p>
      )}

      {/* La jauge de l'effectif */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="mono-label text-foreground/40">Effectif confirmé</span>
          <span className="text-[13px] font-bold tabular-nums">
            {p.presents.length}
            <span className="text-foreground/35">/{p.effectif}</span>
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${jauge}%` }}
          />
        </div>
      </div>

      {p.equipesVisibles && p.teams && p.teams.length > 0 && (
        <div className="mt-4 border-t border-white/8 pt-3.5">
          <p className="mono-label text-primary">Les équipes de dimanche</p>
          <div className="mt-2 flex flex-col gap-2">
            {p.teams.map((t) => (
              <p key={t.name} className="text-[12.5px] leading-snug text-foreground/55">
                <strong className="font-bold text-foreground/85">{t.name}</strong>{" "}
                — {t.players.join(" · ")}
              </p>
            ))}
          </div>
        </div>
      )}

      {p.shared ? (
        <p className="mono-label mt-3 flex items-center gap-1.5 text-primary">
          <Radio className="size-3" /> En direct — toute la ligue voit cette liste
        </p>
      ) : (
        <p className="mt-3 text-[12px] leading-snug text-foreground/35">
          Réponses enregistrées sur cet appareil pour l&apos;instant. Elles seront partagées
          avec toute la ligue dès la mise en base.
        </p>
      )}

      {/* Admin, base branchée mais pas de convocation publiée : on publie. */}
      {admin && p.publish && (
        <button
          onClick={publish}
          className="glass-soft mt-3 w-full rounded-full py-3 text-[13px] font-semibold text-foreground/70"
        >
          Publier la convocation J{p.journee} pour toute la ligue
        </button>
      )}

      {/* Vue admin : le tableau complet */}
      {admin && !compact && (
        <div className="mt-5 border-t border-white/8 pt-4">
          <div className="flex items-center justify-between">
            <p className="mono-label text-primary">Vue admin · les réponses</p>
            {p.sansReponse.length > 0 && (
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
                [p.presents.length, "Présents", "text-emerald-400"],
                [p.absents.length, "Absents", "text-foreground/60"],
                [p.sansReponse.length, "Sans réponse", "text-[#FF6B5E]"],
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
              ["Présents", p.presents, "bg-emerald-500/15 text-emerald-400"],
              ["Absents", p.absents, "glass-soft text-foreground/50"],
              ["Sans réponse", p.sansReponse, "bg-[#FF6B5E]/12 text-[#FF6B5E]"],
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
