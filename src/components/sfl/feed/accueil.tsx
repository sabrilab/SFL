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

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, Play } from "lucide-react";
import { usePlayerPhoto } from "@/hooks/use-player-photo";
import { username } from "@/lib/sfl/usernames";
import { ovr, rareStats, type Journee, type Player } from "@/lib/sfl/engine";
import { dureeLisible, VIDEOS_UNE, type VideoUne } from "@/lib/sfl/une";
import { JourneesDepliables } from "@/components/sfl/feed/journees-depliables";
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
  dernieres,
  aside,
}: {
  player: Player;
  rank: number;
  onOuvrirRecap: (j: number) => void;
  onVoirClassement: () => void;
  /** Les journées jouées, de la plus récente à la plus ancienne. */
  dernieres: Journee[];
  /** Contenu du rail de droite, sous « Tes ligues ». */
  aside?: React.ReactNode;
}) {
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

      {/* ------- La une, puis les journées — deux colonnes sur grand écran ------- */}
      {/* Une seule vidéo, et sous elle toutes les journées nommées et rangées.
          L'ancienne grille de cartes montrait « quelque chose » sans dire quoi :
          on arrivait sur l'app sans comprendre ce qu'on regardait. */}
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <section className="flex min-w-0 flex-col gap-7">
          {vedette && (
            <div className="flex flex-col gap-2.5">
              <p className="mono-label px-1 text-foreground/35">À la une</p>
              <CarteVideo video={vedette} />
            </div>
          )}

          <JourneesDepliables
            journees={dernieres}
            onOuvrir={onOuvrirRecap}
            rangDuJoueur={`${rank}e au Pépite d'Or · ${player.pp} pts`}
          />

          <button
            onClick={onVoirClassement}
            className="glass-soft flex items-center justify-center gap-1.5 rounded-full py-3 text-[13.5px] font-semibold text-foreground/70"
          >
            Voir le classement complet <ChevronRight className="size-3.5" />
          </button>
        </section>

        <aside className="flex min-w-0 flex-col gap-7 lg:sticky lg:top-4">
      {aside}
      </aside>
      </div>
    </div>
  );
}
