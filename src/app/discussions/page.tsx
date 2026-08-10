"use client";

// Section Discussions — réplique de l'écran « DISCUSSIONS matte » du design
// de référence : compteur de groupes, filtres en pilules, l'invitation de match
// en tête de liste (posée comme un message, avec sa carte de convocation), puis
// les fils du vestiaire en verre — initiales, aperçu, heure, série.
//
// L'INVITATION DE MATCH EST VIVANTE : ses boutons répondent vraiment à la
// convocation (même liste partagée que le panneau du fil, via usePresence).
// Le reste — les fils de discussion — reste verrouillé : le chat exige le
// temps réel, il arrive après la présence.

import { toast } from "sonner";
import { useSeason } from "@/components/sfl/season-provider";
import { Locked } from "@/components/sfl/locked";
import { usePresence } from "@/hooks/use-presence";
import { useSession } from "@/hooks/use-session";
import { NEXT_MATCH } from "@/lib/sfl/data";
import { rankPlayers } from "@/lib/sfl/engine";
import { activeConvocation } from "@/lib/sfl/saisie/mutations";
import { cn } from "@/lib/utils";

const FILTERS = ["Tous", "Snaps", "Groupes", "Équipes"] as const;

/** Initiales façon design : deux lettres max, majuscules. */
function initials(name: string) {
  const w = name.trim().split(/\s+/);
  return (w.length > 1 ? `${w[0][0]}${w[1][0]}` : w[0].slice(0, 2)).toUpperCase();
}

export default function Discussions() {
  const { players, journees, saison } = useSeason();
  const ranked = rankPlayers(players);
  const presence = usePresence();
  const session = useSession();

  const convoc = activeConvocation(saison);
  const next = convoc
    ? { date: convoc.date, heure: convoc.heure, lieu: convoc.lieu }
    : { date: NEXT_MATCH.date, heure: NEXT_MATCH.heure, lieu: NEXT_MATCH.lieu };
  const confirmed = convoc
    ? Object.values(convoc.reponses).filter((r) => r === "present").length
    : 0;
  // « 09/08 » à partir de « 16 août » : jour + mois, comme le design.
  const MOIS: Record<string, string> = {
    janv: "01", févr: "02", mars: "03", avr: "04", mai: "05", juin: "06",
    juil: "07", août: "08", sept: "09", oct: "10", nov: "11", déc: "12",
  };
  // « Dimanche 16 août » → jour 16, mois 08 — pour le gros « 16/08 » du design.
  const dateMatch = presence.jour.match(/(\d+)\s+(\S+)/);
  const dJour = dateMatch?.[1] ?? next.date.split(" ")[0];
  const dMois = dateMatch?.[2] ?? next.date.split(" ")[1];
  const moisNum = MOIS[Object.keys(MOIS).find((m) => (dMois ?? "").startsWith(m)) ?? "août"];

  async function answer(value: "present" | "absent") {
    const nextVal = presence.mine === value ? null : value;
    const ok = await presence.answer(nextVal);
    if (!ok) {
      toast.error("Réponse impossible à enregistrer. Réessaie dans un instant.");
      return;
    }
    toast.success(
      nextVal === "present"
        ? "C'est noté : tu es de la partie ⚽"
        : nextVal === "absent"
          ? "C'est noté : tu passes ton tour."
          : "Réponse retirée."
    );
  }

  const lastJ = [...journees].reverse().find((j) => (j.matches ?? []).length > 0);
  // « Sosso Coach — 5 buts » → « Sosso Coach » : le fait porte la stat,
  // ici on ne veut que le nom.
  const buteur = (lastJ?.faits.buteur ?? ranked[0]?.name ?? "Ilyes").split("—")[0].trim();

  const CHATS = [
    {
      name: "Le vestiaire",
      initials: "SFL",
      preview: `Convocation J${NEXT_MATCH.journee} — ${next.date}, ${next.heure}`,
      time: "12:04",
      unread: true,
      streak: `${confirmed}/10`,
    },
    {
      name: "Ligue générale",
      initials: "LG",
      preview: `${buteur} : la reprise de volée à la 88e 🔥`,
      time: "10:41",
      unread: true,
      streak: "🔥 12",
    },
    {
      name: ranked[0]?.name ?? "Ilyes",
      initials: initials(ranked[0]?.name ?? "Ilyes"),
      preview: "T'as vu ma carte après dimanche ? 😮‍💨",
      time: "Hier",
      unread: false,
      streak: "🔥 5",
    },
    {
      name: "Équipe Orange",
      initials: "OR",
      preview: `${ranked[1]?.name ?? "Anis"} : on garde la même compo`,
      time: "Hier",
      unread: false,
      streak: null,
    },
    {
      name: ranked[2]?.name ?? "Ilies",
      initials: initials(ranked[2]?.name ?? "Ilies"),
      preview: "Photo · ouverte",
      time: "Sam.",
      unread: false,
      streak: null,
    },
  ];

  const unreadCount = CHATS.filter((c) => c.unread).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-4 sm:py-8">
      <h1 className="text-[30px] font-bold tracking-tight">Discussions</h1>

      {/* L'invitation de match — VIVANTE : répond à la vraie convocation */}
      <section className="flex flex-col gap-[9px]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-[7px]">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(111,168,255,0.8)]" />
            <span className="mono-label text-foreground/50">
              {presence.shared ? "Convocation · en direct" : "Convocation"}
            </span>
          </span>
          <span className="mono-label text-foreground/32">J{presence.journee}</span>
        </div>

        <div className="glass overflow-hidden rounded-[26px]">
          <div className="px-4 pt-3.5">
            <div className="flex items-center gap-2.5">
              <span className="glass-soft flex size-[30px] shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-foreground/85">
                IL
              </span>
              <div className="min-w-0">
                <div className="text-[13.5px] font-bold">Ilyes</div>
                <div className="mono-label mt-0.5 text-foreground/35">Admin · SFL</div>
              </div>
            </div>
            <p className="mt-[11px] text-[13.5px] leading-[1.45] text-foreground/62">
              Dimanche on remet ça. Réponds vite, la compo se fait dans l&apos;ordre.
            </p>
          </div>

          <div className="m-3 overflow-hidden rounded-[20px] border border-white/10 bg-white/5">
            <div className="flex items-center gap-3.5 px-[15px] py-3.5">
              <div className="w-[46px] shrink-0">
                <div className="mono-label text-foreground/40">J{presence.journee}</div>
                <div className="text-2xl leading-[1.1] font-extrabold tracking-tight">
                  {String(dJour).padStart(2, "0")}
                  <span className="text-[12px] text-foreground/40">/{moisNum}</span>
                </div>
              </div>
              <span className="h-10 w-px bg-white/10" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{presence.lieu}</div>
                <div className="mt-[3px] text-[12.5px] text-foreground/42">
                  {presence.heure} · {presence.presents.length}/{presence.effectif} inscrits
                </div>
              </div>
              {presence.mine && (
                <span
                  className={cn(
                    "mono-label shrink-0 rounded-full px-2.5 py-1",
                    presence.mine === "present"
                      ? "bg-primary/15 text-primary"
                      : "glass-soft text-foreground/50"
                  )}
                >
                  {presence.mine === "present" ? "Inscrit ✓" : "Pas dispo"}
                </span>
              )}
            </div>
            <div className="flex gap-2 px-3 pb-3">
              <button
                onClick={() => answer("present")}
                className={cn(
                  "flex-1 rounded-full py-2.5 text-center text-[13px] font-bold transition-transform active:scale-[0.98]",
                  presence.mine === "present"
                    ? "bg-primary text-primary-foreground"
                    : "bg-foreground text-background"
                )}
              >
                {presence.mine === "present" ? "Je viens ✓" : "Je viens"}
              </button>
              <button
                onClick={() => answer("absent")}
                className={cn(
                  "flex-1 rounded-full py-2.5 text-center text-[13px] font-semibold transition-transform active:scale-[0.98]",
                  presence.mine === "absent"
                    ? "bg-[#FF6B5E]/20 text-[#FF6B5E]"
                    : "glass-soft text-foreground/70"
                )}
              >
                {presence.mine === "absent" ? "Pas dispo ✓" : "Pas dispo"}
              </button>
            </div>
          </div>

          {/* L'admin voit d'un coup d'œil qui manque à l'appel */}
          {session?.admin && (
            <div className="flex items-center gap-3 border-t border-white/8 px-4 py-2.5">
              <span className="mono-label text-primary">{presence.presents.length} présents</span>
              <span className="mono-label text-foreground/45">{presence.absents.length} absents</span>
              <span className="mono-label text-[#FF6B5E]">
                {presence.sansReponse.length} sans réponse
              </span>
            </div>
          )}
        </div>
      </section>

      <Locked
        label="Bientôt"
        chipClassName="-top-9 right-0"
        note="La discussion ouvrira bientôt : l'invitation ci-dessus est déjà active, le chat arrive après."
      >
        <div className="flex flex-col gap-5">
          {/* Ligne d'état + bouton appareil photo */}
          <div className="flex items-start justify-between">
            <p className="text-[13px] text-foreground/42">
              {CHATS.length} fils · {unreadCount} message{unreadCount > 1 ? "s" : ""} non lu
              {unreadCount > 1 ? "s" : ""}
            </p>
            <span className="glass-soft mt-[3px] flex size-[38px] items-center justify-center rounded-full">
              <span className="size-3 rounded-full border-[1.5px] border-foreground/65" />
            </span>
          </div>

          {/* Filtres */}
          <div className="flex gap-2">
            {FILTERS.map((f, i) => (
              <span
                key={f}
                className={
                  i === 0
                    ? "rounded-full bg-foreground px-4 py-2.5 text-[13px] font-bold text-background"
                    : "glass-soft rounded-full px-4 py-2.5 text-[13px] font-semibold text-foreground/55"
                }
              >
                {f}
              </span>
            ))}
          </div>

          {/* Les fils */}
          <div className="flex flex-col gap-2.5">
            {CHATS.map((c) => (
              <div key={c.name} className="glass flex items-center gap-3.5 rounded-[22px] px-[15px] py-3.5">
                <span className="glass-soft flex size-[46px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-foreground/75">
                  {c.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold tracking-tight">{c.name}</div>
                  <div className="mt-1 flex items-center gap-[7px]">
                    {c.unread && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                    <span className="truncate text-[12.5px] text-foreground/42">{c.preview}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="mono-label text-foreground/32">{c.time}</span>
                  {c.streak && (
                    <span className="glass-soft mono-label rounded-full px-2 py-[3px] text-foreground/60">
                      {c.streak}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Locked>
    </div>
  );
}
