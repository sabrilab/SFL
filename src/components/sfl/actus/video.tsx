"use client";

// Les vidéos de Bola dans les Actus (lib/sfl/videos.ts) : dans le fil de leur journée (en tête du fil si aucune ne colle),
// une publication comme les autres (l'image, puis sa légende), avec ses
// réactions, ses commentaires et le partage du lien. La toucher ouvre le
// lecteur, plein écran et dans le noir : la vidéo en entier, avec le son,
// ses réactions et ses commentaires par-dessus. Il s'ouvre aussi par
// l'adresse /ligue?video=<id> (le lien partagé, une notification).
//
// Le lecteur est posé sur <body> (createPortal) : sur iPhone, un calque
// plein écran rendu dans #app-scroll passe sous la barre d'onglets
// (discussion-match.tsx, 23/10).
//
// La vidéo n'a jamais d'adresse publique : l'image d'attente et le fichier
// arrivent par des adresses signées qui expirent ; pas de téléchargement
// proposé, pas d'image dans l'image.
//
// Une vidéo peut avoir des images après elle (lib/sfl/carrousels.ts) : sa
// publication devient un carrousel, la vidéo d'abord ; dans « À la une », le
// carrousel a sa tuile, juste après la vidéo ; ses images s'ouvrent en grand
// (VisionneuseDiapos). La vidéo, le carrousel ou une image partent au
// Vestiaire (PieceActu, ActuVue pour la dessiner là-bas).

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clapperboard, GalleryHorizontalEnd, MessageCircle, Play, Send, Share, Trash2, VolumeX, X } from "lucide-react";
import { useAccord } from "@/hooks/use-accord";
import { accordValable } from "@/lib/sfl/confidentialite";
import { changerHorsApp } from "@/lib/sfl/consentement";
import { useSession } from "@/hooks/use-session";
import { useIdentites } from "@/hooks/use-identites";
import { Visages } from "@/components/sfl/suivre";
import {
  adresseSignee,
  commenter,
  EMOJIS_VIDEO,
  LONGUEUR_COMMENTAIRE,
  lireEchos,
  lireVideo,
  lireVideos,
  monIdVideo,
  noterVue,
  partagerVideo,
  reagir,
  retirerCommentaire,
  type Commentaire,
  type EmojiVideo,
  type Echos,
  type Video,
} from "@/lib/sfl/videos";
import { diaposDe, type Diapo } from "@/lib/sfl/carrousels";
import { preparerPiece, type PieceActu } from "@/lib/sfl/vestiaire";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { dateIsoDuLibelle, joursJusquA } from "@/lib/sfl/meteo";

/* ------------------------------ Les données ------------------------------ */

/** Les vidéos publiées, lues une fois par ouverture de l'onglet. */
export function useVideos(): Video[] {
  const session = useSession();
  const connecte = !!session?.server && !session.enAttente;
  const [videos, setVideos] = useState<Video[]>([]);
  useEffect(() => {
    if (!connecte) return;
    let fini = false;
    lireVideos()
      .then((v) => !fini && setVideos(v))
      .catch(() => {});
    return () => {
      fini = true;
    };
  }, [connecte]);
  return videos;
}

let seq = 0;

/** Réactions et commentaires d'une vidéo, suivis en temps réel. */
function useEchos(video: string) {
  const [echos, setEchos] = useState<Echos & { demo?: boolean }>({ reactions: [], commentaires: [] });
  const [moi, setMoi] = useState<string | null>(null);
  const charger = useCallback(() => {
    lireEchos(video)
      .then(setEchos)
      .catch(() => {});
  }, [video]);
  useEffect(() => {
    let fini = false;
    monIdVideo().then((id) => !fini && setMoi(id));
    Promise.resolve().then(charger);
    const sb = supabase();
    let arreter: (() => void) | null = null;
    try {
      const canal = sb
        .channel(`sfl-video-${video}-${++seq}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "video_reactions", filter: `video=eq.${video}` }, charger)
        .on("postgres_changes", { event: "*", schema: "public", table: "video_commentaires", filter: `video=eq.${video}` }, charger)
        .subscribe();
      arreter = () => void sb.removeChannel(canal);
    } catch {
      // Sans temps réel, on relit après chaque geste.
    }
    return () => {
      fini = true;
      arreter?.();
    };
  }, [video, charger]);

  const reagirA = async (emoji: EmojiVideo) => {
    if (!moi) return;
    const pose = echos.reactions.some((r) => r.joueur === moi && r.emoji === emoji);
    // Tout de suite à l'écran ; la base suit.
    setEchos((e) => ({
      ...e,
      reactions: pose ? e.reactions.filter((r) => !(r.joueur === moi && r.emoji === emoji)) : [...e.reactions, { joueur: moi, emoji }],
    }));
    try {
      await reagir(video, emoji, !pose, !!echos.demo);
    } catch {
      toast.error("La réaction n'est pas partie.");
    }
    charger();
  };
  const commenterA = async (texte: string) => {
    await commenter(video, texte, !!echos.demo);
    charger();
  };
  const retirer = async (id: number) => {
    setEchos((e) => ({ ...e, commentaires: e.commentaires.filter((c) => c.id !== id) }));
    try {
      await retirerCommentaire(id, !!echos.demo);
    } catch {
      toast.error("Le commentaire n'a pas pu être retiré.");
    }
    charger();
  };
  return { ...echos, moi, reagirA, commenterA, retirer };
}

type Echo = ReturnType<typeof useEchos>;

/** Une adresse signée (ou celle d'un aperçu), demandée quand on en a besoin. */
function useAdresse(chemin: string | null, actif = true): string | null {
  const [url, setUrl] = useState<{ chemin: string; url: string } | null>(null);
  useEffect(() => {
    if (!chemin || !actif) return;
    let fini = false;
    adresseSignee(chemin)
      .then((u) => !fini && setUrl({ chemin, url: u }))
      .catch(() => {});
    return () => {
      fini = true;
    };
  }, [chemin, actif]);
  return url && url.chemin === chemin ? url.url : null;
}

function duree(s: number | null | undefined): string | null {
  if (!s || !Number.isFinite(s)) return null;
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function depuis(at: number): string {
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return new Date(at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

async function partager(v: Video) {
  const issue = await partagerVideo(v);
  if (issue === "copiee") toast.success("Lien copié.");
  else if (issue === "impossible") toast.error("Le partage n'a pas pu s'ouvrir.");
}

/* ------------------------------ Dans le fil ------------------------------ */

/**
 * Le dimanche d'une vidéo (Sabri, 26/10 : « la vidéo qui a été partagée de
 * la journée 3 [doit être] dans le feed de la journée 3 ») : celui que son
 * titre ou son identifiant nomme (« J3 SFL », « j3-sfl ») ; sinon le
 * dimanche le plus proche de sa publication, à trois jours près. null :
 * aucun, elle reste en tête du fil.
 */
export function journeeDeLaVideo(v: Pick<Video, "id" | "titre" | "publiee_le">, journees: { j: number; date: string }[]): number | null {
  const nomme = `${v.titre} ${v.id}`.match(/(?:^|[^a-z0-9])j(?:ourn[ée]e\s*)?(\d{1,3})(?![0-9])/i);
  if (nomme) return Number(nomme[1]);
  if (!v.publiee_le) return null;
  const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(v.publiee_le));
  let proche: { j: number; ecart: number } | null = null;
  for (const m of journees) {
    const iso = dateIsoDuLibelle(m.date, jour);
    if (!iso) continue;
    const ecart = Math.abs(joursJusquA(iso, jour));
    if (ecart <= 3 && (!proche || ecart < proche.ecart)) proche = { j: m.j, ecart };
  }
  return proche?.j ?? null;
}

/** Des vidéos publiées dans le fil des Actus : en tête, ou dans le fil de leur dimanche (course.tsx). */
export function VideosDuFil({ videos, className }: { videos: Video[]; className?: string }) {
  const [ouverte, setOuverte] = useState<{ v: Video; commentaires: boolean } | null>(null);
  if (videos.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {videos.map((v) => (
        <PublicationVideo key={v.id} v={v} ouvrir={(commentaires) => setOuverte({ v, commentaires })} />
      ))}
      <InvitationVisuels className="-mt-2" />
      {ouverte && <LecteurVideo v={ouverte.v} commentaires={ouverte.commentaires} onFermer={() => setOuverte(null)} />}
    </div>
  );
}

/**
 * Une ligne légère à côté des vidéos, pour qui a dit non à sa carte hors de
 * l'app (Sabri, 26/10 : « Vous n'apparaissez pas dans les visuels. Signez
 * tout de suite la charte […] pour qu'ils soient dans les visuels ») :
 * signer, c'est le même geste que l'interrupteur des Réglages
 * (« Ma carte hors de l'app »), et on peut revenir dessus là-bas. Une
 * invitation, jamais une porte : rien ne se rouvre tout seul, et elle
 * disparaît une fois signée.
 */
export function InvitationVisuels({ className }: { className?: string }) {
  const session = useSession();
  const nom = session?.server && !session.enAttente ? session.name : null;
  const { accord } = useAccord(nom);
  const [envoi, setEnvoi] = useState(false);
  if (!nom || !accord || accord.enAttente || !accordValable(accord.version) || accord.horsApp) return null;
  const signer = async () => {
    if (envoi) return;
    setEnvoi(true);
    const ok = await changerHorsApp(nom, true);
    setEnvoi(false);
    toast.success("C'est signé. Tu peux être dans les prochaines vidéos.", {
      description: ok ? "Tu changes d'avis quand tu veux dans Réglages." : "Enregistré sur ce téléphone, envoyé dès que possible.",
    });
  };
  return (
    <div className={cn("mx-5 flex items-center gap-3 border-y border-foreground/[0.08] py-2.5 md:mx-0", className)}>
      <Clapperboard className="size-[16px] shrink-0 text-foreground/45" strokeWidth={1.8} />
      <span className="min-w-0 flex-1 leading-snug">
        <span className="block text-[13px] font-semibold">Tu n&apos;apparais pas dans les visuels.</span>
        <span className="block text-[11.5px] text-foreground/50">Signe la charte pour être dans les prochains.</span>
      </span>
      <button type="button" disabled={envoi} onClick={() => void signer()} className="bouton-secondaire shrink-0 px-3.5 py-1.5 text-[12.5px] font-semibold disabled:opacity-50">
        Signer
      </button>
    </div>
  );
}

/**
 * Une vidéo dans « À la une », le carrousel en tête des Actus (course.tsx) :
 * son image, sa durée, son titre ; la toucher ouvre le lecteur. Sa
 * publication entière (réactions, commentaires) reste dans le fil de son
 * dimanche.
 */
export function TuileVideo({ v, className }: { v: Video; className?: string }) {
  const [ouverte, setOuverte] = useState(false);
  const affiche = useAdresse(v.affiche);
  const fichier = useAdresse(v.affiche ? null : v.fichier);
  const temps = duree(v.duree);
  return (
    <>
      <button
        type="button"
        onClick={() => setOuverte(true)}
        aria-label={`Regarder ${v.titre}`}
        onContextMenu={(e) => e.preventDefault()}
        className={cn("dark relative isolate flex flex-col justify-end overflow-hidden bg-black text-left text-white", className)}
      >
        {affiche ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={affiche} alt="" draggable={false} className="absolute inset-0 -z-10 size-full object-cover" />
        ) : fichier ? (
          <video src={`${fichier}#t=1.5`} muted playsInline preload="metadata" className="absolute inset-0 -z-10 size-full object-cover" />
        ) : null}
        <span aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0)_40%,rgba(0,0,0,0.85)_100%)]" />
        <span className="absolute top-1/2 left-1/2 grid size-[56px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/35 ring-1 ring-white/25 backdrop-blur-md">
          <Play className="ml-0.5 size-[22px] fill-current" strokeWidth={0} />
        </span>
        <span className="mono-label absolute top-3 left-3 text-[10px] text-white/75">Vidéo{temps ? ` · ${temps}` : ""}</span>
        <span className="flex flex-col gap-0.5 p-4">
          <span className="text-[19px] leading-[1.05] font-black tracking-tight">{v.titre}</span>
          {v.legende && <span className="line-clamp-1 text-[12.5px] text-white/60">{v.legende}</span>}
        </span>
      </button>
      {ouverte && <LecteurVideo v={v} commentaires={false} onFermer={() => setOuverte(false)} />}
    </>
  );
}

function PublicationVideo({ v, ouvrir }: { v: Video; ouvrir: (commentaires: boolean) => void }) {
  const echos = useEchos(v.id);
  const affiche = useAdresse(v.affiche);
  // Sans image d'attente : la vidéo elle-même, arrêtée sur une image.
  const fichier = useAdresse(v.affiche ? null : v.fichier);
  const temps = duree(v.duree);
  const diapos = diaposDe(v.id);
  const video = (
    <button
      type="button"
      onClick={() => ouvrir(false)}
      aria-label={`Regarder ${v.titre}`}
      className={cn("relative block w-full overflow-hidden bg-black", diapos.length ? "shrink-0 snap-center" : "sm:rounded-[22px]")}
      style={{ aspectRatio: "4 / 5" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {affiche ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={affiche} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
      ) : fichier ? (
        <video src={`${fichier}#t=1.5`} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
      ) : null}
      <span className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/45" />
      <span className="absolute top-1/2 left-1/2 grid size-[68px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white ring-1 ring-white/25 backdrop-blur-md">
        <Play className="ml-1 size-[26px] fill-current" strokeWidth={0} />
      </span>
      {temps && (
        <span className="mono-label absolute top-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-white tabular-nums backdrop-blur-sm">
          {temps}
        </span>
      )}
    </button>
  );
  return (
    <article className="actu-publication flex flex-col">
      {diapos.length > 0 ? (
        <Carrousel v={v} diapos={diapos}>
          {video}
        </Carrousel>
      ) : (
        video
      )}
      <div className="flex items-start gap-2 pt-2.5 pr-1.5 pl-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug font-semibold">{v.titre}</p>
          {v.legende && <p className="mt-0.5 line-clamp-2 text-[13.5px] leading-snug text-foreground/55">{v.legende}</p>}
        </div>
        <button
          type="button"
          aria-label="Partager le lien"
          onClick={() => void partager(v)}
          className="bouton-discret bouton--mauve -mt-1.5 grid size-9 shrink-0 place-items-center"
        >
          <Share className="size-[18px]" strokeWidth={1.8} />
        </button>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 pt-2.5 [scrollbar-width:none]">
        <Reactions echos={echos} />
        <button
          type="button"
          onClick={() => ouvrir(true)}
          className="ml-auto flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-foreground/60 tabular-nums"
          aria-label="Commentaires"
        >
          <MessageCircle className="size-[16px]" strokeWidth={1.8} />
          {echos.commentaires.length > 0 && echos.commentaires.length}
        </button>
      </div>
    </article>
  );
}

/**
 * La vidéo puis ses images, à faire glisser (lib/sfl/carrousels.ts) : comme
 * un carrousel d'Instagram, une page à la fois, les points dessous (rien
 * par-dessus les images : elles ont déjà leur en-tête).
 */
function Carrousel({ v, diapos, children }: { v: Video; diapos: Diapo[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [rang, setRang] = useState(0);
  const [grande, setGrande] = useState<number | null>(null);
  const total = diapos.length + 1;
  const suivre = () => {
    const el = ref.current;
    if (!el || !el.clientWidth) return;
    setRang(Math.min(total - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  };
  const aller = (i: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return (
    <div className="flex flex-col">
      <div className="relative overflow-hidden bg-black sm:rounded-[22px]">
        <div
          ref={ref}
          onScroll={suivre}
          aria-roledescription="carrousel"
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {children}
          {diapos.map((d, i) => (
            <button key={d.src} type="button" onClick={() => setGrande(i)} aria-label={`Voir en grand : ${d.alt}`} className="block w-full shrink-0 snap-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={d.src}
                alt={d.alt}
                draggable={false}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                className="block w-full object-cover"
                style={{ aspectRatio: "4 / 5" }}
              />
            </button>
          ))}
        </div>
      </div>
      {grande !== null && <VisionneuseDiapos v={v} diapos={diapos} depart={grande} onFermer={() => setGrande(null)} />}
      <div className="flex justify-center gap-[5px] pt-2.5" role="tablist" aria-label="Pages du carrousel">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === rang}
            aria-label={i === 0 ? "La vidéo" : diapos[i - 1].alt}
            onClick={() => aller(i)}
            className={cn("size-[6px] rounded-full transition-colors", i === rang ? "bg-foreground" : "bg-foreground/20")}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------- Les images en grand ------------------------- */

/** Envoyer une actu au Vestiaire : elle attend dans la barre d'écriture (au-vestiaire.tsx). */
function useAuVestiaire() {
  const router = useRouter();
  return (piece: PieceActu) => {
    preparerPiece(piece);
    router.push("/vestiaire");
  };
}

/**
 * Le carrousel dans « À la une » (Sabri, 26/10 : « la vidéo d'abord […] et à
 * sa droite, tu mets le carrousel. On peut cliquer dedans et voir les
 * différentes slides ») : sa première image, le nombre d'images ; le toucher
 * l'ouvre en grand.
 */
export function TuileCarrousel({ v, className }: { v: Video; className?: string }) {
  const diapos = diaposDe(v.id);
  const [ouvert, setOuvert] = useState(false);
  if (diapos.length === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label={`Voir le carrousel : ${diapos[0].alt}`}
        onContextMenu={(e) => e.preventDefault()}
        className={cn("dark relative isolate overflow-hidden bg-black text-white", className)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={diapos[0].src} alt="" draggable={false} decoding="async" className="absolute inset-0 -z-10 size-full object-cover" />
        <span className="mono-label absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] text-white/85 tabular-nums backdrop-blur-sm">
          <GalleryHorizontalEnd className="size-[13px]" strokeWidth={1.8} />
          {diapos.length}
        </span>
      </button>
      {ouvert && <VisionneuseDiapos v={v} diapos={diapos} depart={0} onFermer={() => setOuvert(false)} />}
    </>
  );
}

/**
 * Les images d'un carrousel en grand, dans le noir, à faire glisser. En bas,
 * de quoi l'envoyer au Vestiaire : le carrousel entier, ou l'image qu'on
 * regarde. Posé sur <body>, comme le lecteur.
 */
export function VisionneuseDiapos({
  v,
  diapos,
  depart,
  onFermer,
  envoyer = true,
}: {
  v: Pick<Video, "id" | "titre">;
  diapos: Diapo[];
  depart: number;
  onFermer: () => void;
  envoyer?: boolean;
}) {
  const auVestiaire = useAuVestiaire();
  const ref = useRef<HTMLDivElement>(null);
  const [rang, setRang] = useState(depart);
  const [monte, setMonte] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = depart * el.clientWidth;
    Promise.resolve().then(() => setMonte(true));
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const echap = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", echap);
    return () => {
      document.body.style.overflow = avant;
      window.removeEventListener("keydown", echap);
    };
    // La première image n'est posée qu'à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suivre = () => {
    const el = ref.current;
    if (!el || !el.clientWidth) return;
    setRang(Math.min(diapos.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={v.titre}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "dark fixed inset-0 z-[60] flex flex-col bg-black text-white transition-opacity duration-300 motion-reduce:transition-none",
        monte ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="flex items-center justify-between px-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
        <button type="button" onClick={onFermer} aria-label="Fermer" className="bouton-secondaire grid size-10 place-items-center">
          <X className="size-[18px]" />
        </button>
        <span className="mono-label text-white/70 tabular-nums">
          {rang + 1} / {diapos.length}
        </span>
        <span className="size-10" />
      </div>
      <div
        ref={ref}
        onScroll={suivre}
        aria-roledescription="carrousel"
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {diapos.map((d, i) => (
          <div key={d.src} className="flex h-full w-full shrink-0 snap-center items-center justify-center px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.src} alt={d.alt} draggable={false} loading={Math.abs(i - depart) < 2 ? "eager" : "lazy"} decoding="async" className="max-h-full max-w-full object-contain" />
          </div>
        ))}
      </div>
      {envoyer && (
        <div className="flex justify-center gap-2 px-4 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}>
          <button
            type="button"
            onClick={() => auVestiaire({ type: "actu", video: v.id, titre: v.titre, montre: "carrousel" })}
            className="bouton-secondaire flex items-center gap-1.5 px-4 py-2.5 text-[13.5px] font-semibold"
          >
            <Send className="size-[15px]" strokeWidth={1.8} />
            Le carrousel
          </button>
          <button
            type="button"
            onClick={() => auVestiaire({ type: "actu", video: v.id, titre: v.titre, montre: rang })}
            className="bouton-secondaire flex items-center gap-1.5 px-4 py-2.5 text-[13.5px] font-semibold"
          >
            <Send className="size-[15px]" strokeWidth={1.8} />
            Cette image
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}

/**
 * Une actu dans le Vestiaire (PieceActu) : la vidéo, à regarder ; le
 * carrousel, sa première image et le nombre d'images ; ou une image seule.
 * Toucher ouvre le lecteur ou les images en grand.
 */
export function ActuVue({ piece }: { piece: PieceActu }) {
  const session = useSession();
  const connecte = !!session?.server && !session.enAttente;
  const [v, setV] = useState<Video | null | undefined>(undefined);
  const [ouvert, setOuvert] = useState(false);
  const diapos = diaposDe(piece.video);
  const estVideo = piece.montre === "video";
  useEffect(() => {
    if (!estVideo || !connecte) return;
    let fini = false;
    lireVideo(piece.video)
      .then((x) => !fini && setV(x))
      .catch(() => !fini && setV(null));
    return () => {
      fini = true;
    };
  }, [estVideo, connecte, piece.video]);

  const cadre = "block w-[min(220px,56vw)] overflow-hidden rounded-[20px] bg-black lg:w-[300px]";
  if (estVideo) {
    if (v === null) return <p className="glass-soft rounded-[20px] px-4 py-3 text-[13px] text-foreground/50">« {piece.titre} » n&apos;est plus en ligne.</p>;
    if (!v) return <span className={cn(cadre, "aspect-[4/5]")} />;
    return (
      <span onClick={(e) => e.stopPropagation()} className="contents">
        <TuileVideo v={v} className={cn(cadre, "aspect-[4/5]")} />
      </span>
    );
  }
  const depart = typeof piece.montre === "number" ? piece.montre : 0;
  const d = diapos[depart];
  if (!d) return <p className="glass-soft rounded-[20px] px-4 py-3 text-[13px] text-foreground/50">« {piece.titre} »</p>;
  return (
    <>
      <button type="button" onClick={(e) => {
          e.stopPropagation();
          setOuvert(true);
        }} aria-label={d.alt} className={cn(cadre, "relative aspect-[4/5]")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={d.src} alt="" draggable={false} decoding="async" className="size-full object-cover" />
        {piece.montre === "carrousel" && (
          <span className="mono-label absolute right-2.5 bottom-2.5 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/85 tabular-nums backdrop-blur-sm">
            <GalleryHorizontalEnd className="size-[12px]" strokeWidth={1.8} />
            {diapos.length}
          </span>
        )}
      </button>
      {ouvert && (
        <VisionneuseDiapos
          v={{ id: piece.video, titre: piece.titre }}
          diapos={piece.montre === "carrousel" ? diapos : [d]}
          depart={0}
          envoyer={false}
          onFermer={() => setOuvert(false)}
        />
      )}
    </>
  );
}

/** Les cinq réactions : la mienne allumée, le nombre à côté. */
function Reactions({ echos, sombre = false }: { echos: Echo; sombre?: boolean }) {
  return (
    <>
      {EMOJIS_VIDEO.map((e) => {
        const n = echos.reactions.filter((r) => r.emoji === e).length;
        const mienne = !!echos.moi && echos.reactions.some((r) => r.joueur === echos.moi && r.emoji === e);
        return (
          <button
            key={e}
            type="button"
            aria-pressed={mienne}
            aria-label={`Réagir ${e}`}
            onClick={() => void echos.reagirA(e)}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold tabular-nums ring-1 transition-transform active:scale-90",
              sombre
                ? mienne
                  ? "bg-white/22 text-white ring-white/50"
                  : "bg-white/8 text-white/75 ring-white/12"
                : mienne
                  ? "bg-foreground/12 text-foreground ring-foreground/40"
                  : "bg-foreground/[0.04] text-foreground/60 ring-foreground/10"
            )}
          >
            <span className="text-[15px] leading-none">{e}</span>
            {n > 0 && <span>{n}</span>}
          </button>
        );
      })}
    </>
  );
}

/* ------------------------------ Le lecteur ------------------------------ */

/** Le lecteur ouvert par une adresse (/ligue?video=<id>) : il lit la vidéo d'abord. */
export function LecteurParLien({ id, onFermer }: { id: string; onFermer: () => void }) {
  const session = useSession();
  const connecte = !!session?.server && !session.enAttente;
  const [v, setV] = useState<Video | null | undefined>(undefined);
  useEffect(() => {
    if (!connecte) return;
    let fini = false;
    lireVideo(id)
      .then((x) => !fini && setV(x))
      .catch(() => !fini && setV(null));
    return () => {
      fini = true;
    };
  }, [id, connecte]);
  useEffect(() => {
    if (v === null) {
      toast("Cette vidéo n'est plus en ligne.");
      onFermer();
    }
  }, [v, onFermer]);
  if (!v) return null;
  return <LecteurVideo v={v} commentaires={false} onFermer={onFermer} />;
}

export function LecteurVideo({ v, commentaires, onFermer }: { v: Video; commentaires: boolean; onFermer: () => void }) {
  const auVestiaire = useAuVestiaire();
  const echos = useEchos(v.id);
  const src = useAdresse(v.fichier);
  const affiche = useAdresse(v.affiche);
  const ref = useRef<HTMLVideoElement>(null);
  const [sansSon, setSansSon] = useState(false);
  const [enPause, setEnPause] = useState(false);
  const [avance, setAvance] = useState(0);
  const [panneau, setPanneau] = useState(commentaires);
  const [monte, setMonte] = useState(false);
  // Ce qui part en base : le plus loin atteint, au plus toutes les 5 s.
  const suivi = useRef({ lancee: false, max: 0, note: 0, fini: false });

  useEffect(() => {
    Promise.resolve().then(() => setMonte(true));
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const echap = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", echap);
    return () => {
      document.body.style.overflow = avant;
      window.removeEventListener("keydown", echap);
    };
  }, [onFermer]);

  // En partant : ce qu'on a vu.
  useEffect(() => {
    const s = suivi.current;
    return () => {
      if (s.lancee && s.max > s.note) noterVue(v.id, false, s.max, s.fini);
    };
  }, [v.id]);

  // Avec le son si le téléphone le permet ; sinon sans, et un bouton pour le remettre.
  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    el.muted = false;
    el.play().catch(() => {
      el.muted = true;
      setSansSon(true);
      el.play().catch(() => setEnPause(true));
    });
  }, [src]);

  const temps = () => {
    const el = ref.current;
    if (!el) return;
    const s = suivi.current;
    s.max = Math.max(s.max, el.currentTime);
    if (el.duration) setAvance(el.currentTime / el.duration);
    if (s.max - s.note >= 5) {
      s.note = s.max;
      noterVue(v.id, false, s.max, s.fini);
    }
  };

  const basculer = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className={cn(
        "dark fixed inset-0 z-[45] flex flex-col bg-black text-white transition-opacity duration-300 motion-reduce:transition-none",
        monte ? "opacity-100" : "opacity-0"
      )}
      role="dialog"
      aria-modal="true"
      aria-label={v.titre}
      onContextMenu={(e) => e.preventDefault()}
    >
      <video
        ref={ref}
        src={src ?? undefined}
        poster={affiche ?? undefined}
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noplaybackrate noremoteplayback"
        className="absolute inset-0 size-full object-contain"
        onClick={basculer}
        onPlay={() => {
          setEnPause(false);
          const s = suivi.current;
          noterVue(v.id, true, s.max, s.fini);
          s.lancee = true;
        }}
        onPause={() => setEnPause(true)}
        onTimeUpdate={temps}
        onEnded={() => {
          const s = suivi.current;
          s.fini = true;
          s.max = Math.max(s.max, ref.current?.duration ?? s.max);
          s.note = s.max;
          noterVue(v.id, false, s.max, true);
        }}
      />
      {enPause && src && (
        <button
          type="button"
          onClick={basculer}
          aria-label="Lecture"
          className="absolute top-1/2 left-1/2 grid size-[76px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/35 ring-1 ring-white/25 backdrop-blur-md"
        >
          <Play className="ml-1 size-[30px] fill-current" strokeWidth={0} />
        </button>
      )}

      {/* En haut : fermer, et le son quand le téléphone l'a coupé. */}
      <div
        className="pointer-events-none relative flex items-start justify-between px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <button type="button" onClick={onFermer} aria-label="Fermer" className="bouton-secondaire pointer-events-auto grid size-10 place-items-center">
          <X className="size-[18px]" />
        </button>
        {sansSon && (
          <button
            type="button"
            aria-label="Remettre le son"
            onClick={() => {
              const el = ref.current;
              if (!el) return;
              el.muted = false;
              setSansSon(false);
              void el.play().catch(() => {});
            }}
            className="bouton-secondaire pointer-events-auto grid size-10 place-items-center"
          >
            <VolumeX className="size-[18px]" />
          </button>
        )}
      </div>

      {/* En bas : le titre, les réactions, les commentaires, le partage, l'avancée. */}
      <div
        className="pointer-events-none relative mt-auto bg-gradient-to-t from-black/80 via-black/45 to-black/0 px-4 pt-16"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
      >
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[17px] leading-tight font-bold tracking-tight">{v.titre}</p>
            {v.legende && <p className="mt-1 text-[13.5px] leading-snug text-white/65">{v.legende}</p>}
          </div>
          <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPanneau(true)}
              aria-label="Commentaires"
              className="flex h-8 items-center gap-1.5 rounded-full bg-white/8 px-2.5 text-[13px] font-semibold text-white/80 tabular-nums ring-1 ring-white/12"
            >
              <MessageCircle className="size-[16px]" strokeWidth={1.8} />
              {echos.commentaires.length > 0 && echos.commentaires.length}
            </button>
            <button
              type="button"
              onClick={() => auVestiaire({ type: "actu", video: v.id, titre: v.titre, montre: "video" })}
              aria-label="Envoyer au Vestiaire"
              className="grid size-8 place-items-center rounded-full bg-white/8 text-white/80 ring-1 ring-white/12"
            >
              <Send className="size-[15px]" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={() => void partager(v)}
              aria-label="Partager le lien"
              className="grid size-8 place-items-center rounded-full bg-white/8 text-white/80 ring-1 ring-white/12"
            >
              <Share className="size-[16px]" strokeWidth={1.8} />
            </button>
          </div>
        </div>
        <div className="pointer-events-auto mt-3.5 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
          <Reactions echos={echos} sombre />
        </div>
        <div className="mt-3.5 h-[3px] overflow-hidden rounded-full bg-white/18">
          <div className="h-full rounded-full bg-white" style={{ width: `${avance * 100}%` }} />
        </div>
      </div>

      {panneau && <Commentaires echos={echos} onFermer={() => setPanneau(false)} />}
    </div>,
    document.body
  );
}

/* ---------------------------- Les commentaires ---------------------------- */

function Commentaires({ echos, onFermer }: { echos: Echo; onFermer: () => void }) {
  const session = useSession();
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const liste = useRef<HTMLDivElement>(null);
  const n = echos.commentaires.length;
  useEffect(() => {
    liste.current?.scrollTo({ top: liste.current.scrollHeight });
  }, [n]);
  const envoyer = async () => {
    if (!texte.trim() || envoi) return;
    setEnvoi(true);
    try {
      await echos.commenterA(texte);
      setTexte("");
    } catch {
      toast.error("Le commentaire n'est pas parti.");
    }
    setEnvoi(false);
  };
  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-end" onClick={onFermer}>
      <div
        className="flex max-h-[61.8%] min-h-[38.2%] flex-col rounded-t-[26px] bg-[#111214]/95 ring-1 ring-white/10 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <p className="mono-label text-white/45">{n > 0 ? `${n} commentaire${n > 1 ? "s" : ""}` : "Commentaires"}</p>
          <button type="button" onClick={onFermer} aria-label="Fermer les commentaires" className="-mr-2 grid size-9 place-items-center text-white/55">
            <X className="size-[17px]" />
          </button>
        </div>
        <div ref={liste} className="flex-1 overflow-y-auto overscroll-contain px-5">
          {n === 0 ? (
            <p className="py-8 text-center text-[14px] text-white/40">Personne n&apos;a encore commenté.</p>
          ) : (
            <ul className="flex flex-col gap-4 py-2">
              {echos.commentaires.map((c) => (
                <LigneCommentaire
                  key={c.id}
                  c={c}
                  retirable={c.joueur === echos.moi || !!session?.admin}
                  retirer={() => void echos.retirer(c.id)}
                />
              ))}
            </ul>
          )}
        </div>
        <form
          className="flex items-center gap-2 border-t border-white/8 px-4 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
          onSubmit={(e) => {
            e.preventDefault();
            void envoyer();
          }}
        >
          <input
            value={texte}
            onChange={(e) => setTexte(e.target.value.slice(0, LONGUEUR_COMMENTAIRE))}
            placeholder="Ajoute un commentaire"
            enterKeyHint="send"
            className="h-11 min-w-0 flex-1 rounded-full bg-white/8 px-4 text-[15px] text-white ring-1 ring-white/10 outline-none placeholder:text-white/35 focus:ring-white/30"
          />
          <button
            type="submit"
            disabled={!texte.trim() || envoi}
            aria-label="Envoyer"
            className="bouton-principal bouton--vert grid size-11 shrink-0 place-items-center"
          >
            <Send className="size-[17px]" strokeWidth={2} />
          </button>
        </form>
      </div>
    </div>
  );
}

function LigneCommentaire({ c, retirable, retirer }: { c: Commentaire; retirable: boolean; retirer: () => void }): ReactNode {
  const id = useIdentites();
  return (
    <li className="flex items-start gap-3">
      <Visages noms={[c.nom]} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-tight">
          <span className="font-bold">{id.nom(c.nom)}</span>
          <span className="ml-2 text-white/35">{depuis(c.at)}</span>
        </p>
        <p className="mt-1 text-[14.5px] leading-snug break-words text-white/85">{c.texte}</p>
      </div>
      {retirable && (
        <button type="button" onClick={retirer} aria-label="Retirer le commentaire" className="-mr-1.5 grid size-8 shrink-0 place-items-center text-white/30">
          <Trash2 className="size-[15px]" strokeWidth={1.8} />
        </button>
      )}
    </li>
  );
}
