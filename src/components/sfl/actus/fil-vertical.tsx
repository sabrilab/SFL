"use client";

// Le fil vertical des Actus (Bola, 24/11/2026 : « montrer photos et vidéos
// comme Instagram ou TikTok », d'après la maquette qu'il a validée) : les
// publications de Bola, vidéos et photos, une par écran, qu'on fait monter du
// doigt. Adresse : /ligue/videos (?p=<id> ouvre sur une publication).
//
//   · une vidéo se lance seule, sans le son, quand elle est à l'écran ; le
//     bouton en haut à droite remet le son pour tout le fil ; la toucher la
//     met en pause. Ses images (lib/sfl/carrousels.ts) suivent sur le côté ;
//   · une publication en photos (videos.photos) se fait glisser sur le côté,
//     les traits en haut disent où l'on en est ;
//   · une image ou une vidéo en largeur se pose au centre, sur son propre flou ;
//   · à droite : les réactions (les cinq de l'app), les commentaires, le
//     partage du lien ; en bas : la journée, le titre, la légende ;
//   · ce qu'on a vu part en base comme pour le lecteur (video_vue) : les
//     secondes d'une vidéo, le nombre de photos vues d'une publication.
// Sur téléphone, la barre d'onglets reste là ; sur ordinateur (≥ 1024 px),
// les publications à gauche, le fil dans un cadre 9:16 au centre.
// Les données, les adresses signées, les réactions et les commentaires sont
// ceux du lecteur (video.tsx, lib/sfl/videos.ts).

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Images, MessageCircle, Play, Share, Volume2, VolumeX } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { estEnPhotos, lireVideos, noterVue, type Video } from "@/lib/sfl/videos";
import { diaposDe } from "@/lib/sfl/carrousels";
import { cn } from "@/lib/utils";
import { Commentaires, duree, partager, Reactions, useAdresse, useEchos } from "./video";

/** Les titres : Archivo Expanded 900, comme Bola Plus (Bola, 24/11 : « change la police »). */
export const TITRE_FIL: CSSProperties = {
  fontFamily: "var(--font-archivo), Archivo, sans-serif",
  fontWeight: 900,
  fontStretch: "125%",
  letterSpacing: "-0.02em",
};

/** « J7 » : la journée que nomme la publication ; sinon, le jour où elle est parue. */
export function etiquetteDe(v: Video): string {
  const j = `${v.titre} ${v.id}`.match(/(?:^|[^a-z0-9])j(\d{1,3})(?![0-9])/i)?.[1];
  if (j) return `J${j}`;
  return v.publiee_le
    ? new Date(v.publiee_le).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" })
    : "";
}

/** Les publications du fil, lues une fois. undefined : pas encore là. */
function usePublications(): Video[] | undefined {
  const session = useSession();
  const connecte = !!session?.server && !session.enAttente;
  const [liste, setListe] = useState<Video[] | undefined>(undefined);
  useEffect(() => {
    if (!connecte) return;
    let fini = false;
    lireVideos(40)
      .then((v) => !fini && setListe(v))
      .catch(() => !fini && setListe([]));
    return () => {
      fini = true;
    };
  }, [connecte]);
  return liste;
}

const LARGE = "(min-width: 1024px)";

export function FilVertical({ depart }: { depart: string | null }) {
  const liste = usePublications();
  const [actif, setActif] = useState<string | null>(depart);
  const [son, setSon] = useState(false);
  const [large, setLarge] = useState(false);
  const defile = useRef<HTMLDivElement>(null);
  const place = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia(LARGE);
    const f = () => setLarge(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);

  // À l'ouverture, la publication demandée (?p=) ; sinon la plus récente.
  useEffect(() => {
    if (!liste?.length || place.current) return;
    place.current = true;
    const i = Math.max(0, depart ? liste.findIndex((v) => v.id === depart) : 0);
    const el = defile.current?.children[i] as HTMLElement | undefined;
    if (el) defile.current?.scrollTo({ top: el.offsetTop });
    setActif(liste[i]?.id ?? null);
  }, [liste, depart, large]);

  // Celle qui est à l'écran : l'adresse la suit, sans entrée dans l'historique.
  useEffect(() => {
    const racine = defile.current;
    if (!racine || !liste?.length) return;
    const obs = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) {
          if (!e.isIntersecting) continue;
          const id = (e.target as HTMLElement).dataset.pub ?? null;
          setActif(id);
          if (id) window.history.replaceState(window.history.state, "", `/ligue/videos?p=${encodeURIComponent(id)}`);
        }
      },
      { root: racine, threshold: 0.6 }
    );
    for (const el of Array.from(racine.children)) obs.observe(el);
    return () => obs.disconnect();
  }, [liste, large]);

  const aller = useCallback((id: string) => {
    const el = defile.current?.querySelector<HTMLElement>(`[data-pub="${CSS.escape(id)}"]`);
    if (el) defile.current?.scrollTo({ top: el.offsetTop, behavior: "smooth" });
  }, []);

  const courante = liste?.find((v) => v.id === actif) ?? liste?.[0];

  const fil = (
    <div ref={defile} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {liste?.map((v) => (
        <Publication key={v.id} v={v} actif={v.id === courante?.id} son={son} large={large} />
      ))}
      {liste && liste.length === 0 && (
        <div className="grid h-full place-items-center px-8 text-center text-[15px] text-white/55">Rien à voir pour l&apos;instant.</div>
      )}
    </div>
  );

  const bouton = (
    <button
      type="button"
      onClick={() => setSon((s) => !s)}
      aria-label={son ? "Couper le son" : "Mettre le son"}
      className="pointer-events-auto grid size-10 place-items-center rounded-full bg-black/25 text-white backdrop-blur-md"
    >
      {son ? <Volume2 className="size-[20px]" /> : <VolumeX className="size-[20px]" />}
    </button>
  );

  if (large) {
    return (
      <div className="fixed inset-0 z-[39] flex bg-background text-foreground">
        <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-r border-foreground/[0.08] px-6 pt-8 pb-28">
          <Link href="/ligue" className="mb-7 flex items-center gap-1 text-[15px] font-semibold text-foreground/70">
            <ChevronLeft className="size-5" /> Actus
          </Link>
          <p className="mono-label mb-3 text-foreground/45">Photos et vidéos</p>
          <div className="flex flex-col gap-1">
            {liste?.map((v) => (
              <LignePublication key={v.id} v={v} choisie={v.id === courante?.id} onClick={() => aller(v.id)} />
            ))}
          </div>
        </aside>
        <main className="relative flex flex-1 items-center justify-center pt-6 pb-[104px]">
          <div className="dark relative aspect-[9/16] h-full overflow-hidden rounded-[22px] bg-black text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            {fil}
            <div className="pointer-events-none absolute top-4 right-4">{bouton}</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dark fixed inset-0 z-[39] bg-black text-white">
      {fil}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
      >
        <Link
          href="/ligue"
          className="pointer-events-auto flex h-10 items-center gap-0.5 rounded-full bg-black/25 pr-3.5 pl-2 text-[15px] font-semibold backdrop-blur-md"
        >
          <ChevronLeft className="size-[22px]" /> Actus
        </Link>
        {bouton}
      </div>
    </div>
  );
}

/** Une publication dans la colonne de l'ordinateur. */
function LignePublication({ v, choisie, onClick }: { v: Video; choisie: boolean; onClick: () => void }) {
  const affiche = useAdresse(v.affiche ?? (estEnPhotos(v) ? v.photos![0] : null));
  const t = duree(v.duree);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex items-center gap-3 rounded-[16px] p-2 text-left transition-colors", choisie ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]")}
    >
      <span className="h-14 w-10 shrink-0 overflow-hidden rounded-[8px] bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {affiche && <img src={affiche} alt="" className="size-full object-cover" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold">{v.titre}</span>
        <span className="flex items-center gap-1 text-[12px] text-foreground/50">
          {estEnPhotos(v) ? (
            <>
              <Images className="size-3" /> {v.photos!.length} photos
            </>
          ) : (
            <>
              <Play className="size-3" /> {t ?? "Vidéo"}
            </>
          )}
        </span>
      </span>
    </button>
  );
}

/* ------------------------------ Une publication ------------------------------ */

type Diapo = { genre: "video" } | { genre: "image"; chemin: string; signee: boolean };

function Publication({ v, actif, son, large }: { v: Video; actif: boolean; son: boolean; large: boolean }) {
  const echos = useEchos(v.id);
  const photos = estEnPhotos(v);
  const diapos: Diapo[] = photos
    ? v.photos!.map((chemin) => ({ genre: "image", chemin, signee: true }))
    : [{ genre: "video" }, ...diaposDe(v.id).map((d) => ({ genre: "image" as const, chemin: d.src, signee: false }))];
  const [index, setIndex] = useState(0);
  const [reagir, setReagir] = useState(false);
  const [panneau, setPanneau] = useState(false);
  const rang = useRef<HTMLDivElement>(null);
  const vues = useRef({ max: 0, note: false });

  // Les photos vues : le plus loin atteint, une fois par geste.
  useEffect(() => {
    if (!actif || !photos) return;
    const s = vues.current;
    const vu = index + 1;
    if (vu <= s.max && s.note) return;
    const debut = !s.note;
    s.max = Math.max(s.max, vu);
    s.note = true;
    noterVue(v.id, debut, s.max, s.max >= diapos.length);
  }, [actif, index, photos, v.id, diapos.length]);

  const total = echos.reactions.length;
  const n = echos.commentaires.length;
  const etiquette = etiquetteDe(v);
  const bas = large ? "bottom-6" : "bottom-[104px]";

  const commentaires = panneau && <Commentaires echos={echos} onFermer={() => setPanneau(false)} />;

  return (
    <section data-pub={v.id} className="relative h-full w-full snap-start snap-always overflow-hidden bg-black" aria-label={v.titre}>
      <div
        ref={rang}
        className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
      >
        {diapos.map((d, i) => (
          <div key={i} className="relative h-full w-full shrink-0 snap-center">
            {d.genre === "video" ? (
              <DiapoVideo v={v} joue={actif && index === 0} son={son} large={large} />
            ) : (
              <DiapoImage chemin={d.chemin} signee={d.signee} charger={actif || Math.abs(i - index) <= 1} />
            )}
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

      {diapos.length > 1 && (
        <div
          className="pointer-events-none absolute inset-x-4 flex gap-1"
          style={{ top: large ? 72 : "calc(env(safe-area-inset-top, 0px) + 62px)" }}
        >
          {diapos.map((_, i) => (
            <span key={i} className={cn("h-[3px] flex-1 rounded-full", i === index ? "bg-white" : "bg-white/35")} />
          ))}
        </div>
      )}

      <div className={cn("pointer-events-none absolute right-[76px] left-4", bas)}>
        {etiquette && <p className="mb-2 text-[12px] font-bold tracking-[0.14em] text-white/70 uppercase">{etiquette}</p>}
        <h2 className="text-balance uppercase leading-[0.98]" style={{ ...TITRE_FIL, fontSize: large ? 30 : 26 }}>
          {v.titre}
        </h2>
        {v.legende && <p className="mt-2 line-clamp-2 max-w-[32ch] text-[15px] leading-snug text-white/85">{v.legende}</p>}
      </div>

      <div className={cn("absolute right-3 flex flex-col items-center gap-4", large ? "bottom-8" : "bottom-[116px]")}>
        <div className="relative">
          {reagir && (
            <div className="absolute top-1/2 right-[calc(100%+8px)] flex -translate-y-1/2 gap-1 rounded-full bg-black/55 p-1.5 backdrop-blur-xl">
              <Reactions echos={echos} sombre />
            </div>
          )}
          <BoutonRail etiquette={total > 0 ? String(total) : null} label="Réagir" onClick={() => setReagir((r) => !r)} actif={reagir}>
            <span className="text-[24px] leading-none">🔥</span>
          </BoutonRail>
        </div>
        <BoutonRail etiquette={n > 0 ? String(n) : null} label="Commentaires" onClick={() => setPanneau(true)}>
          <MessageCircle className="size-[23px]" strokeWidth={2} />
        </BoutonRail>
        <BoutonRail etiquette={null} label="Partager le lien" onClick={() => void partager(v)}>
          <Share className="size-[21px]" strokeWidth={2} />
        </BoutonRail>
      </div>

      {commentaires && (large ? commentaires : createPortal(<div className="dark fixed inset-0 z-[46] text-white">{commentaires}</div>, document.body))}
    </section>
  );
}

function BoutonRail({
  children,
  etiquette,
  label,
  onClick,
  actif,
}: {
  children: React.ReactNode;
  etiquette: string | null;
  label: string;
  onClick: () => void;
  actif?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex flex-col items-center gap-1 text-white">
      <span
        className={cn(
          "grid size-12 place-items-center rounded-full backdrop-blur-md transition-transform active:scale-90",
          actif ? "bg-white/30" : "bg-white/12"
        )}
      >
        {children}
      </span>
      {etiquette && <span className="text-[13px] font-semibold tabular-nums">{etiquette}</span>}
    </button>
  );
}

/** Une image : en hauteur, plein cadre ; en largeur, au centre sur son flou. */
function DiapoImage({ chemin, signee, charger }: { chemin: string; signee: boolean; charger: boolean }) {
  const url = useAdresse(signee ? chemin : null, charger);
  const src = signee ? url : chemin;
  const [largeur, setLargeur] = useState(false);
  if (!src || !charger) return null;
  return (
    <>
      {largeur && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" aria-hidden className="absolute inset-0 size-full scale-125 object-cover opacity-60 blur-2xl" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onLoad={(e) => setLargeur(e.currentTarget.naturalWidth > e.currentTarget.naturalHeight)}
        className={cn("absolute inset-0 size-full", largeur ? "object-contain" : "object-cover")}
      />
    </>
  );
}

/** La vidéo d'une publication : lancée seule quand elle est à l'écran, sans le son par défaut. */
function DiapoVideo({ v, joue, son, large }: { v: Video; joue: boolean; son: boolean; large: boolean }) {
  const src = useAdresse(v.fichier, joue);
  const affiche = useAdresse(v.affiche);
  const ref = useRef<HTMLVideoElement>(null);
  const [pause, setPause] = useState(false);
  const [avance, setAvance] = useState(0);
  const suivi = useRef({ lancee: false, max: 0, note: 0, fini: false });
  const enLargeur = (v.largeur ?? 0) > (v.hauteur ?? 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (joue && src && !pause) {
      el.muted = !son;
      el.play().catch(() => {
        el.muted = true;
        void el.play().catch(() => {});
      });
    } else el.pause();
  }, [joue, src, son, pause]);

  // En quittant la publication : ce qu'on a vu.
  useEffect(() => {
    const s = suivi.current;
    if (joue) return;
    if (s.lancee && s.max > s.note) {
      s.note = s.max;
      noterVue(v.id, false, s.max, s.fini);
    }
  }, [joue, v.id]);

  const temps = () => {
    const el = ref.current;
    if (!el) return;
    const s = suivi.current;
    s.max = Math.max(s.max, el.currentTime);
    if (el.duration) setAvance(el.currentTime / el.duration);
    // Elle tourne en boucle : arrivée à la fin, elle a été vue en entier.
    const finie = !s.fini && !!el.duration && el.currentTime >= el.duration - 0.6;
    if (finie) s.fini = true;
    if (finie || s.max - s.note >= 5) {
      s.note = s.max;
      noterVue(v.id, false, s.max, s.fini);
    }
  };

  return (
    <>
      {enLargeur && affiche && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={affiche} alt="" aria-hidden className="absolute inset-0 size-full scale-125 object-cover opacity-60 blur-2xl" />
      )}
      <video
        ref={ref}
        src={src ?? undefined}
        poster={affiche ?? undefined}
        loop
        playsInline
        muted
        preload="metadata"
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noplaybackrate noremoteplayback"
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => setPause((p) => !p)}
        onPlay={() => {
          const s = suivi.current;
          if (!s.lancee) noterVue(v.id, true, s.max, s.fini);
          s.lancee = true;
        }}
        onTimeUpdate={temps}
        className={cn("absolute inset-0 size-full", enLargeur ? "object-contain" : "object-cover")}
      />
      {pause && (
        <button
          type="button"
          onClick={() => setPause(false)}
          aria-label="Lecture"
          className="absolute top-1/2 left-1/2 grid size-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/35 ring-1 ring-white/25 backdrop-blur-md"
        >
          <Play className="ml-1 size-[28px] fill-current" strokeWidth={0} />
        </button>
      )}
      <div className={cn("pointer-events-none absolute inset-x-4 h-[3px] overflow-hidden rounded-full bg-white/20", large ? "bottom-3" : "bottom-[92px]")}>
        <div className="h-full rounded-full bg-white" style={{ width: `${avance * 100}%` }} />
      </div>
    </>
  );
}

/* ------------------------------ Dans les Actus ------------------------------ */

/**
 * L'entrée du fil vertical, en haut des Actus (course.tsx) : les dernières
 * publications en vignettes debout ; en toucher une ouvre le fil sur elle.
 */
export function RangeePublications({ videos, className }: { videos: Video[]; className?: string }) {
  if (videos.length === 0) return null;
  return (
    <section aria-label="Photos et vidéos" className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-baseline justify-between px-5 md:px-0">
        <h2 className="text-[19px] uppercase leading-none" style={TITRE_FIL}>
          Photos et vidéos
        </h2>
        <Link href="/ligue/videos" className="text-[14px] font-semibold text-foreground/60">
          Tout voir
        </Link>
      </div>
      <div className="flex snap-x gap-2.5 overflow-x-auto px-5 [scrollbar-width:none] md:px-0 [&::-webkit-scrollbar]:hidden">
        {videos.map((v) => (
          <Vignette key={v.id} v={v} />
        ))}
      </div>
    </section>
  );
}

function Vignette({ v }: { v: Video }) {
  const affiche = useAdresse(v.affiche ?? (estEnPhotos(v) ? v.photos![0] : null));
  const [maintenant] = useState(() => Date.now());
  const neuve = !!v.publiee_le && maintenant - Date.parse(v.publiee_le) < 3 * 86_400_000;
  const t = duree(v.duree);
  return (
    <Link
      href={`/ligue/videos?p=${encodeURIComponent(v.id)}`}
      className="dark relative isolate h-[220px] w-[124px] shrink-0 snap-start overflow-hidden rounded-[16px] bg-black text-white"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {affiche && <img src={affiche} alt="" draggable={false} className="absolute inset-0 -z-10 size-full object-cover" />}
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      {neuve && (
        <span className="absolute top-2 left-2 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-black uppercase">
          Nouveau
        </span>
      )}
      <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[11px] font-semibold backdrop-blur">
        {estEnPhotos(v) ? <Images className="size-3" /> : <Play className="size-3 fill-current" strokeWidth={0} />}
        {estEnPhotos(v) ? v.photos!.length : t}
      </span>
      <span className="absolute right-2 bottom-2 left-2 line-clamp-3 text-[13.5px] leading-tight font-semibold">{v.titre}</span>
    </Link>
  );
}
