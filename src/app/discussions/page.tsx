"use client";

// Section Discussions — réplique de l'écran « DISCUSSIONS matte » du design
// de référence : compteur de groupes, filtres en pilules, l'invitation de match
// en tête de liste (posée comme un message, avec sa carte de convocation), puis
// les fils du vestiaire en verre — initiales, aperçu, heure, série.
//
// Verrouillée : le chat exige les comptes joueurs et le temps réel (Supabase).
// On montre l'écran pour donner envie, sans y donner accès. Les données
// affichées sont réelles (convocation en cours, joueurs de la ligue) pour que
// l'aperçu ressemble déjà à la vraie app.

import { useSeason } from "@/components/sfl/season-provider";
import { Locked } from "@/components/sfl/locked";
import { NEXT_MATCH } from "@/lib/sfl/data";
import { rankPlayers } from "@/lib/sfl/engine";
import { activeConvocation } from "@/lib/sfl/saisie/mutations";

const FILTERS = ["Tous", "Snaps", "Groupes", "Équipes"] as const;

/** Initiales façon design : deux lettres max, majuscules. */
function initials(name: string) {
  const w = name.trim().split(/\s+/);
  return (w.length > 1 ? `${w[0][0]}${w[1][0]}` : w[0].slice(0, 2)).toUpperCase();
}

export default function Discussions() {
  const { players, journees, saison } = useSeason();
  const ranked = rankPlayers(players);

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
  const [dJour, dMois] = next.date.split(" ");
  const moisNum = MOIS[Object.keys(MOIS).find((m) => (dMois ?? "").startsWith(m)) ?? "août"];

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

      <Locked
        label="Bientôt"
        chipClassName="-top-9 right-0"
        note="La discussion ouvrira avec les comptes joueurs : chacun devra récupérer son profil pour écrire au vestiaire."
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

          {/* L'invitation de match, en tête de liste comme un message */}
          <div className="flex flex-col gap-[9px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-[7px]">
                <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(111,168,255,0.8)]" />
                <span className="mono-label text-foreground/50">Nouvelle invitation</span>
              </span>
              <span className="mono-label text-foreground/32">Il y a 4 min</span>
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
                  Dimanche on remet ça. Il me manque deux joueurs, réponds vite.
                </p>
              </div>

              <div className="m-3 overflow-hidden rounded-[20px] border border-white/10 bg-white/5">
                <div className="flex items-center gap-3.5 px-[15px] py-3.5">
                  <div className="w-[46px] shrink-0">
                    <div className="mono-label text-foreground/40">J{NEXT_MATCH.journee}</div>
                    <div className="text-2xl leading-[1.1] font-extrabold tracking-tight">
                      {String(dJour).padStart(2, "0")}
                      <span className="text-[12px] text-foreground/40">/{moisNum}</span>
                    </div>
                  </div>
                  <span className="h-10 w-px bg-white/10" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">{next.lieu}</div>
                    <div className="mt-[3px] text-[12.5px] text-foreground/42">
                      {next.heure} · {confirmed}/10 inscrits
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-[5px] rounded-full border border-primary/32 bg-primary/14 px-[11px] py-1.5">
                    <span className="text-[12px] leading-none">⚽</span>
                    <span className="mono-label font-semibold text-primary">+120</span>
                  </span>
                </div>
                <div className="flex gap-2 px-3 pb-3">
                  <span className="flex-1 rounded-full bg-foreground py-2.5 text-center text-[13px] font-bold text-background">
                    Je viens
                  </span>
                  <span className="glass-soft flex-1 rounded-full py-2.5 text-center text-[13px] font-semibold text-foreground/70">
                    Pas dispo
                  </span>
                </div>
              </div>
            </div>
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
