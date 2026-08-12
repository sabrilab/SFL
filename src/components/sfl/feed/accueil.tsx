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
import { useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, ChevronRight, Lock, Play } from "lucide-react";
import { usePlayerPhoto } from "@/hooks/use-player-photo";
import { usePresence } from "@/hooks/use-presence";
import { username } from "@/lib/sfl/usernames";
import { journeeScoreSummary, ovr, rareStats, type Journee, type Player } from "@/lib/sfl/engine";
import { dureeLisible, VIDEOS_UNE, type VideoUne } from "@/lib/sfl/une";
import { cn } from "@/lib/utils";

/* -------------------------------- la photo ------------------------------- */

function PhotoHero({ name }: { name: string }) {
  const src = usePlayerPhoto(name);
  const [broken, setBroken] = useState(false);
  return (
    <div
      className="relative w-[124px] shrink-0 overflow-hidden rounded-[18px] border border-white/10 lg:w-[188px] lg:rounded-[24px]"
      style={{
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

/**
 * La grande carte de la une : une vidéo. Elle ne charge RIEN tant qu'on ne
 * la lance pas (`preload="none"`) — seule l'image de couverture s'affiche.
 * Au premier toucher, la lecture démarre en place et les contrôles natifs
 * prennent le relais ; `playsInline` évite le plein écran forcé sur iOS.
 */
function CarteVideo({ video }: { video: VideoUne }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [lance, setLance] = useState(false);

  function lire() {
    const el = ref.current;
    if (!el) return;
    // On passe en mode lecteur dans tous les cas : si play() est refusé
    // (règle d'autoplay, codec absent), les contrôles natifs restent
    // affichés et offrent un bouton de lecture — jamais un écran mort.
    setLance(true);
    void el.play().catch(() => {});
  }

  return (
    <div className="glass relative w-full overflow-hidden rounded-[26px] text-left">
      <div className="relative bg-black" style={{ aspectRatio: "16 / 10" }}>
        <video
          ref={ref}
          poster={video.poster}
          preload="none"
          playsInline
          controls={lance}
          onEnded={() => setLance(false)}
          className="size-full object-cover"
          // Le recadrage 16/9 → 16/10 se prend sur le bas : les visages
          // vivent en haut du cadre, on ne leur coupe pas la tête.
          style={{ objectPosition: "center 28%" }}
        >
          <source src={video.src} type="video/mp4" />
          {video.srcWebm && <source src={video.srcWebm} type="video/webm" />}
        </video>

        {!lance && (
          <button
            onClick={lire}
            aria-label={`Lire : ${video.titre}`}
            className="absolute inset-0 flex items-center justify-center"
          >
            {/* Un voile qui garde le texte lisible par-dessus l'image */}
            <span
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.08) 42%, rgba(0,0,0,0.55) 100%)",
              }}
            />
            <span className="absolute top-3.5 left-3.5 flex gap-2">
              <span className="mono-label rounded-full border border-primary/40 bg-primary/18 px-2.5 py-1.5 text-primary backdrop-blur-sm">
                {video.rubrique}
                {video.journee ? ` · J${video.journee}` : ""}
              </span>
              <span className="mono-label flex items-center gap-1 rounded-full border border-white/16 bg-black/45 px-2.5 py-1.5 text-foreground/85 backdrop-blur-sm">
                <Play className="size-2.5 fill-current" /> {dureeLisible(video.duree)}
              </span>
            </span>
            <motion.span
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
              className="relative flex size-[68px] items-center justify-center rounded-full bg-primary/90 shadow-[0_0_34px_rgba(111,168,255,0.5)]"
            >
              <Play className="size-7 fill-primary-foreground text-primary-foreground" />
            </motion.span>
          </button>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-[19px] leading-[1.22] font-bold tracking-tight">{video.titre}</h3>
        <p className="mt-1.5 text-[12.5px] text-foreground/42">
          {video.journee ? `Journée ${video.journee} · ` : ""}
          {video.meta}
        </p>
      </div>
    </div>
  );
}

/**
 * Le récap du dernier dimanche — l'entrée dans la section Ligue, qui vit
 * désormais sous l'accueil. Le terrain stylisé tient lieu de visuel.
 */
function CarteRecap({ journee, onOuvrir }: { journee: Journee; onOuvrir: () => void }) {
  const score = journeeScoreSummary(journee);
  return (
    <motion.button
      onClick={onOuvrir}
      whileTap={{ scale: 0.985 }}
      className="glass relative flex w-full items-center gap-3.5 overflow-hidden rounded-[22px] p-3.5 text-left"
    >
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 160% at 88% 50%, rgba(111,168,255,0.16), transparent 60%)",
        }}
      />
      <span className="relative min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="mono-label rounded-full border border-primary/35 bg-primary/15 px-2 py-1 text-primary">
            Récap · J{journee.j}
          </span>
          {score && <span className="mono-label text-foreground/35">{score.label}</span>}
        </span>
        <span className="mt-2 block text-[15px] leading-[1.25] font-bold tracking-tight">
          {titreJournee(journee).replace(" — le récap", "")}
        </span>
        <span className="mt-1 block text-[12px] text-foreground/40">
          {journee.date} · {butsDe(journee)} buts · ouvrir la Ligue
        </span>
      </span>
      <motion.span
        animate={{ scale: [1, 1.07, 1] }}
        transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
        className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/90"
      >
        <ArrowUpRight className="size-5 text-primary-foreground" strokeWidth={2.5} />
      </motion.span>
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

/** Les trois chiffres de la saison — même bloc en mobile et en colonne. */
function Chiffres({
  general,
  matchs,
  rank,
}: {
  general: number;
  matchs: number;
  rank: number;
}) {
  return (
    <div className="flex items-stretch">
      {(
        [
          [String(general), "Général", false],
          [String(matchs), "Matchs", false],
          [`${rank}e`, "Classement", true],
        ] as const
      ).map(([valeur, label, accent], i) => (
        <div key={label} className={cn("flex-1", i > 0 && "border-l border-white/9 pl-4")}>
          <div
            className={cn(
              "text-[30px] leading-none font-extrabold tracking-tight tabular-nums lg:text-[34px]",
              accent && "text-primary"
            )}
          >
            {valeur}
          </div>
          <p className="mono-label mt-1.5 text-foreground/35">{label}</p>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- l'écran -------------------------------- */

export function Accueil({
  player,
  rank,
  onOuvrirRecap,
  onVoirClassement,
  onOuvrirLigue,
  dernieres,
  aside,
}: {
  player: Player;
  rank: number;
  onOuvrirRecap: (j: number) => void;
  onVoirClassement: () => void;
  /** Entrer dans la section Ligue — elle vit sous cet écran. */
  onOuvrirLigue: () => void;
  /** Les journées jouées, de la plus récente à la plus ancienne. */
  dernieres: Journee[];
  /** Contenu du rail de droite, sous « Tes ligues ». */
  aside?: React.ReactNode;
}) {
  const presence = usePresence();
  const [une, ...suivantes] = dernieres;
  const seconde = suivantes[0];
  const general = ovr(rareStats(player.stats));
  const vedette = VIDEOS_UNE[0];

  return (
    <div className="flex flex-col gap-7">
      {/* ---------------------------- Toi ---------------------------- */}
      {/* Sur grand écran le bloc d'identité et les trois chiffres partagent
          la même hauteur que la photo : plus de vide sous le pseudo. */}
      <section className="flex items-start justify-between gap-4 lg:gap-8">
        <div className="flex min-w-0 flex-1 flex-col lg:min-h-[188px] lg:justify-between">
          <div className="min-w-0">
            <p className="text-[15px] text-foreground/45">Bienvenue,</p>
            <h1
              className="mt-0.5 truncate text-[46px] leading-[0.92] font-black tracking-[-0.01em] uppercase lg:text-[68px]"
              style={{ fontFamily: "var(--font-anton)" }}
            >
              {player.name.split(" ")[0]}
            </h1>
            <p className="mono-label mt-2 truncate text-foreground/40">
              {username(player.name)} · Sunday Five League
            </p>
          </div>
          {/* Les trois chiffres remontent dans la colonne à partir de lg. */}
          <div className="mt-5 hidden border-t border-white/9 pt-4 lg:block">
            <Chiffres general={general} matchs={player.matchs} rank={rank} />
          </div>
        </div>
        <PhotoHero name={player.name} />
      </section>

      {/* Les trois chiffres — version mobile, pleine largeur sous la photo */}
      <section className="-mt-2 border-t border-white/9 pt-4 lg:hidden">
        <Chiffres general={general} matchs={player.matchs} rank={rank} />
      </section>

      {/* --------- À la une + le rail — deux colonnes sur grand écran --------- */}
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <section className="flex min-w-0 flex-col gap-2.5">
        <p className="mono-label px-1 text-foreground/35">À la une</p>

        {/* La vidéo tient la une tant qu'il y en a une. */}
        {vedette && <CarteVideo video={vedette} />}

        {/* Puis le récap du dernier dimanche : la porte de la Ligue. */}
        {une && <CarteRecap journee={une} onOuvrir={() => onOuvrirRecap(une.j)} />}

        {une && (
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
        )}
      </section>

      {/* ------------------- Le rail : tes ligues + la suite ------------------- */}
      <aside className="flex min-w-0 flex-col gap-7 lg:sticky lg:top-4">
      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between px-1">
          <p className="mono-label text-foreground/35">Tes ligues</p>
          <button onClick={onVoirClassement} className="text-[13px] font-semibold text-primary">
            Tout voir
          </button>
        </div>

        <button
          onClick={onOuvrirLigue}
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

      {/* Ce que la page veut mettre à côté — la convocation, aujourd'hui. */}
      {aside}
      </aside>
      </div>
    </div>
  );
}
