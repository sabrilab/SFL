"use client";

// L'accueil — ce qu'on voit en arrivant.
//
// D'abord toi : ton prénom en grand, ta photo, et les trois chiffres qui
// résument ta saison (général, matchs, classement). Puis « À la une » : le
// récap du dernier dimanche en grande carte — c'est en la touchant qu'on
// entre dans le récap — la journée d'avant en petit, et l'annonce du bureau
// (la convocation en cours). Enfin tes ligues.
//
// Aucune donnée nouvelle : tout est déjà dans la saison. Cet écran ne fait
// que hiérarchiser — le joueur d'abord, la ligue ensuite.

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, ChevronRight, Lock } from "lucide-react";
import { usePlayerPhoto } from "@/hooks/use-player-photo";
import { usePresence } from "@/hooks/use-presence";
import { username } from "@/lib/sfl/usernames";
import { journeeScoreSummary, ovr, rareStats, type Journee, type Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

/* -------------------------------- la photo ------------------------------- */

function PhotoHero({ name }: { name: string }) {
  const src = usePlayerPhoto(name);
  const [broken, setBroken] = useState(false);
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[18px] border border-white/10"
      style={{
        width: 124,
        aspectRatio: "3 / 4",
        background:
          "repeating-linear-gradient(122deg, rgba(255,255,255,0.055) 0 8px, rgba(255,255,255,0.012) 8px 16px), linear-gradient(168deg, rgba(255,255,255,0.1), rgba(255,255,255,0.025))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 10px 26px rgba(0,0,0,0.4)",
      }}
    >
      {broken ? (
        <span
          className="flex size-full items-center justify-center text-[52px] leading-none text-foreground/22"
          style={{ fontFamily: "var(--font-anton)" }}
        >
          {name[0]}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          ref={(el) => {
            if (el && el.complete && el.naturalWidth === 0) setBroken(true);
          }}
          onError={() => setBroken(true)}
        />
      )}
    </div>
  );
}

/* ------------------------------ la manchette ----------------------------- */

/** Le titre éditorial d'une journée, déduit du score — jamais inventé. */
function titreJournee(j: Journee): string {
  const matches = j.matches ?? [];
  if (matches.length === 0) return `Journée ${j.j} — le récap`;
  const big = [...matches].sort(
    (a, b) => b.teamA.score + b.teamB.score - (a.teamA.score + a.teamB.score)
  )[0];
  const [gagnant, perdant] =
    big.teamA.score >= big.teamB.score ? [big.teamA, big.teamB] : [big.teamB, big.teamA];
  if (gagnant.score === perdant.score) {
    return `${gagnant.name} et ${perdant.name} se quittent bons amis — le récap`;
  }
  const ecart = gagnant.score - perdant.score;
  const verbe = ecart >= 6 ? "écrase" : ecart >= 3 ? "domine" : "s'impose face à";
  return `${gagnant.name} ${verbe} ${perdant.name} — le récap`;
}

function butsDe(j: Journee): number {
  return (j.matches ?? []).reduce((s, m) => s + m.teamA.score + m.teamB.score, 0);
}

/* ------------------------------- les cartes ------------------------------ */

function CarteUne({
  journee,
  onOuvrir,
}: {
  journee: Journee;
  onOuvrir: () => void;
}) {
  const score = journeeScoreSummary(journee);
  return (
    <motion.button
      onClick={onOuvrir}
      whileTap={{ scale: 0.985 }}
      className="glass relative w-full overflow-hidden rounded-[26px] text-left"
    >
      {/* Le « visuel » : le terrain stylisé, en attendant les vidéos */}
      <div
        className="relative"
        style={{
          height: 190,
          background:
            "radial-gradient(90% 130% at 50% 8%, rgba(111,168,255,0.20), transparent 62%), repeating-linear-gradient(115deg, rgba(255,255,255,0.05) 0 11px, rgba(255,255,255,0.012) 11px 22px)",
        }}
      >
        <span className="pointer-events-none absolute -top-16 left-1/2 size-40 -translate-x-1/2 rounded-full border border-white/10" />
        <span className="pointer-events-none absolute bottom-0 left-1/2 h-16 w-52 -translate-x-1/2 rounded-t-2xl border border-b-0 border-white/10" />

        <span className="absolute top-3.5 left-3.5 flex gap-2">
          <span className="mono-label rounded-full border border-primary/35 bg-primary/15 px-2.5 py-1.5 text-primary">
            Récap · J{journee.j}
          </span>
          {score && (
            <span className="mono-label rounded-full border border-white/14 bg-black/40 px-2.5 py-1.5 text-foreground/75">
              {score.label}
            </span>
          )}
        </span>

        {/* L'affordance d'ouverture, à la place du bouton de lecture */}
        <motion.span
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary/90 shadow-[0_0_30px_rgba(111,168,255,0.45)]"
        >
          <ArrowUpRight className="size-7 text-primary-foreground" strokeWidth={2.5} />
        </motion.span>
      </div>

      <div className="p-4">
        <h3 className="text-[19px] leading-[1.22] font-bold tracking-tight">
          {titreJournee(journee)}
        </h3>
        <p className="mt-1.5 text-[12.5px] text-foreground/42">
          {journee.date} · {butsDe(journee)} buts · Sunday Five League
        </p>
      </div>
    </motion.button>
  );
}

function CarteCompacte({ journee, onOuvrir }: { journee: Journee; onOuvrir: () => void }) {
  return (
    <motion.button
      onClick={onOuvrir}
      whileTap={{ scale: 0.97 }}
      className="glass relative flex min-h-[150px] flex-col justify-end overflow-hidden rounded-[22px] p-3.5 text-left"
      style={{
        background:
          "repeating-linear-gradient(115deg, rgba(255,255,255,0.05) 0 9px, rgba(255,255,255,0.012) 9px 18px)",
      }}
    >
      <span className="mono-label absolute top-3 left-3 rounded-full border border-white/14 bg-black/40 px-2 py-1 text-foreground/70">
        J{journee.j} · {butsDe(journee)} buts
      </span>
      <span className="text-[14px] leading-[1.28] font-bold tracking-tight">
        {titreJournee(journee).replace(" — le récap", "")}
      </span>
      <span className="mt-1 text-[11.5px] text-foreground/40">{journee.date}</span>
    </motion.button>
  );
}

/* --------------------------------- l'écran -------------------------------- */

export function Accueil({
  player,
  rank,
  onOuvrirRecap,
  onVoirClassement,
  dernieres,
}: {
  player: Player;
  rank: number;
  onOuvrirRecap: (j: number) => void;
  onVoirClassement: () => void;
  /** Les journées jouées, de la plus récente à la plus ancienne. */
  dernieres: Journee[];
}) {
  const presence = usePresence();
  const [une, ...suivantes] = dernieres;
  const seconde = suivantes[0];
  const general = ovr(rareStats(player.stats));

  return (
    <div className="flex flex-col gap-7">
      {/* ---------------------------- Toi ---------------------------- */}
      <section className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-foreground/45">Bienvenue,</p>
          <h1
            className="mt-0.5 truncate text-[46px] leading-[0.92] font-black tracking-[-0.01em] uppercase"
            style={{ fontFamily: "var(--font-anton)" }}
          >
            {player.name.split(" ")[0]}
          </h1>
          <p className="mono-label mt-2 truncate text-foreground/40">
            {username(player.name)} · Sunday Five League
          </p>
        </div>
        <PhotoHero name={player.name} />
      </section>

      {/* Les trois chiffres */}
      <section className="-mt-2 border-t border-white/9 pt-4">
        <div className="flex items-stretch">
          {(
            [
              [String(general), "Général", false],
              [String(player.matchs), "Matchs", false],
              [`${rank}e`, "Classement", true],
            ] as const
          ).map(([valeur, label, accent], i) => (
            <div key={label} className={cn("flex-1", i > 0 && "border-l border-white/9 pl-4")}>
              <div
                className={cn(
                  "text-[30px] leading-none font-extrabold tracking-tight tabular-nums",
                  accent && "text-primary"
                )}
              >
                {valeur}
              </div>
              <p className="mono-label mt-1.5 text-foreground/35">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------- À la une -------------------------- */}
      {une && (
        <section className="flex flex-col gap-2.5">
          <p className="mono-label px-1 text-foreground/35">À la une</p>
          <CarteUne journee={une} onOuvrir={() => onOuvrirRecap(une.j)} />

          <div className="grid grid-cols-2 gap-2.5">
            {seconde && (
              <CarteCompacte journee={seconde} onOuvrir={() => onOuvrirRecap(seconde.j)} />
            )}
            {/* L'annonce du bureau : la convocation en cours */}
            <Link
              href="/discussions"
              className="glass flex min-h-[150px] flex-col justify-between rounded-[22px] p-3.5"
            >
              <div>
                <span className="mono-label text-primary">Annonce</span>
                <p className="mt-2 text-[14px] leading-[1.28] font-bold tracking-tight">
                  {presence.reponsesOuvertes
                    ? `Convocation J${presence.journee} — ${presence.jour.toLowerCase()}`
                    : `Convocation J${presence.journee} clôturée`}
                </p>
              </div>
              <div>
                <p className="text-[11.5px] text-foreground/40">
                  Bureau SFL · {presence.presents.length}/{presence.effectif} inscrits
                </p>
                {presence.reponsesOuvertes && (
                  <p
                    className={cn(
                      "mono-label mt-1.5",
                      presence.mine === "present"
                        ? "text-emerald-400"
                        : presence.mine === "absent"
                          ? "text-foreground/35"
                          : "text-[#FF6B5E]"
                    )}
                  >
                    {presence.mine === "present"
                      ? "Tu viens ✓"
                      : presence.mine === "absent"
                        ? "Tu passes ton tour"
                        : "Réponds → +2 ⚽"}
                  </p>
                )}
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* ------------------------- Tes ligues ------------------------- */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between px-1">
          <p className="mono-label text-foreground/35">Tes ligues</p>
          <button onClick={onVoirClassement} className="text-[13px] font-semibold text-primary">
            Tout voir
          </button>
        </div>

        <button
          onClick={onVoirClassement}
          className="glass flex items-center gap-3.5 rounded-[22px] px-4 py-3.5 text-left"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
            <span className="mono-label text-[10px] text-primary">SFL</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold tracking-tight">
              Sunday Five League
            </span>
            <span className="block truncate text-[12.5px] text-foreground/42">
              {rank}e au Pépite d&apos;Or · {player.pp} points · {player.matchs} match
              {player.matchs > 1 ? "s" : ""}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-foreground/30" />
        </button>

        <div className="glass-soft flex items-center gap-3.5 rounded-[22px] px-4 py-3.5 opacity-50">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-foreground/8">
            <Lock className="size-4 text-foreground/40" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold tracking-tight">Golder</span>
            <span className="block text-[12.5px] text-foreground/42">
              Les autres ligues arrivent
            </span>
          </span>
        </div>
      </section>
    </div>
  );
}
