"use client";

// Le Vestiaire — la discussion de toute la ligue, sa page à elle (/vestiaire,
// la bulle de la barre d'onglets).
//
// On y chambre. Chaque message porte la carte de son auteur en pastille (la
// hiérarchie des cartes : petite ici, moyenne pour une carte partagée), et
// peut porter une pièce : sa carte, une feuille de match, un classement. Un
// toucher sur un message ouvre ses réactions (et, pour l'auteur ou l'admin,
// le retrait ; pour l'admin, la sourdine de 24 h).
//
// Depuis le 19/10 (Sabri) : répondre à un message précis (glisser la bulle
// vers la droite, ou la flèche sous elle), réagir d'un émoji (le visage sous
// chaque bulle, ou toucher la bulle), et les vocaux (le micro quand le champ
// est vide ; une minute au plus, bucket « vocaux »), puis les photos et
// vidéos, et tout élément de la Ligue (bouton rond « Au Vestiaire » de chaque
// rubrique : au-vestiaire.tsx), figé tel qu'il était au partage.
//
// Noir et blanc, comme la Ligue : ma bulle en blanc, celles des autres en
// verre. Un écran de discussion, comme Messages : le titre en haut, le fil
// au milieu (seul à défiler, le plus récent en bas), la barre d'écriture
// toujours en bas, même quand le fil est vide. Clavier fermé, elle se pose
// au-dessus des onglets ; clavier ouvert, les onglets s'effacent et elle
// monte juste au-dessus du clavier (hooks/use-ecran-clavier.ts : sur
// iPhone, le clavier recouvre la page sans la redimensionner). Le fil reste
// au plus récent, ou sur le message qu'on lit (hooks/use-fil-au-bas.ts).
//
// Depuis le 23/10 (Sabri : « des composants qui se figent et qui changent de
// place ») : mon message s'affiche dès que je l'envoie, en retrait le temps
// que la base le prenne ; taper une lettre ne redessine plus toutes les
// bulles ; une seule relecture du fil à la fois, la suivante après elle.
//
// Depuis le 22/10, le même écran sert à la discussion de chaque match ouvert
// par un joueur (matchs/discussion-match.tsx) : Discussion, plus bas, reçoit
// son salon (lib/sfl/vestiaire.ts, Salon), son titre et ce qui le distingue
// (la modération et la barre d'onglets restent au Vestiaire, lieu public ;
// l'arrivée d'un joueur est une ligne du fil, pas une bulle).
//
// Sur ordinateur (dès 1024 px ; Sabri, 23/10 : « toutes les sections de
// l'app » sur desktop), la discussion reste une colonne, car une ligne trop
// longue ne se lit plus, mais elle prend la mesure du récap (760 px au lieu
// de 640) ; les photos et vidéos un pas d'or de plus (420 px au lieu de 260),
// les cartes des pièces un cran de plus (useFormatCarte).
//
// Données : lib/sfl/vestiaire.ts. Hors production (développement et aperçus
// Vercel), ?demo=vestiaire remplit le fil de messages d'essai, sans base,
// pour juger le rendu.

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowUp, Bell, BellOff, Camera, Check, Mic, Pause, Play, Plus, Reply, SmilePlus, X } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { useFormatCarte } from "@/hooks/use-format-carte";
import { useSeason } from "@/components/sfl/season-provider";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { Nom } from "@/components/sfl/nom";
import { PointMaillot } from "@/components/sfl/point-maillot";
import { BoutonRecherche } from "@/components/layout/bouton-recherche";
import { BoutonMessages } from "@/components/sfl/messages/bouton-messages";
import { TitreDiscussion } from "@/components/sfl/titre-discussion";
import { useSession } from "@/hooks/use-session";
import { RANKINGS } from "@/lib/sfl/rankings";
import { rankByMetric, type Journee } from "@/lib/sfl/engine";
import { journeeJouee } from "@/lib/sfl/saisie/mutations";
import { activerNotifications, etatNotifications, type EtatNotifications } from "@/lib/sfl/notifications";
import { supabase } from "@/lib/supabase";
import { useEcranClavier } from "@/hooks/use-ecran-clavier";
import { useFilAuBas } from "@/hooks/use-fil-au-bas";
import {
  EMOJIS,
  EVT_PIECE,
  SALON_VESTIAIRE,
  blocageVestiaire,
  chargerProfilsV,
  couperLaParole,
  deposerPhoto,
  deposerVideo,
  deposerVocal,
  formatVocal,
  lienPhoto,
  lienVocal,
  preparerPhoto,
  preparerVideo,
  prendrePiece,
  retirerMessage,
  type Emoji,
  type MessageV,
  type ModeNotifs,
  type Piece,
  type PiecePhoto,
  type PieceLigue,
  type PieceVideo,
  type PieceVocal,
  type ProfilV,
  type Salon,
  VOCAL_MAX_S,
} from "@/lib/sfl/vestiaire";
import { cn } from "@/lib/utils";

/* --------------------------------- Temps -------------------------------- */

function quand(at: number) {
  const d = new Date(at);
  const auj = new Date();
  const hier = new Date(auj.getTime() - 86400_000);
  const h = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === auj.toDateString()) return h;
  if (d.toDateString() === hier.toDateString()) return `hier ${h}`;
  return `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} ${h}`;
}

/** Mm:ss d'une durée en secondes. */
const minutes = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Ce qu'une réponse montre de l'original, en une ligne. */
function apercu(m: MessageV): string {
  if (m.texte.trim()) return m.texte.trim();
  if (m.piece?.type === "ligue") return m.piece.titre;
  const t = m.piece?.type;
  if (t === "rejoint") return "a rejoint le match";
  return t === "vocal" ? "🎤 Message vocal" : t === "photo" ? "📷 Photo" : t === "video" ? "🎬 Vidéo" : t === "carte" ? "Une carte" : t === "feuille" ? "Une feuille de match" : "Un classement";
}

/* -------------------------------- Vocaux -------------------------------- */

/** Une onde fixe, tirée du chemin du fichier : chaque vocal a la sienne. */
function onde(graine: string, n = 28): number[] {
  let h = 2166136261;
  for (let i = 0; i < graine.length; i++) h = Math.imul(h ^ graine.charCodeAt(i), 16777619);
  return Array.from({ length: n }, (_, i) => {
    h = Math.imul(h ^ (i + 1), 2654435761);
    return 0.28 + ((h >>> 0) % 1000) / 1400;
  });
}

function VocalVue({ piece, mien }: { piece: PieceVocal; mien: boolean }) {
  const [src, setSrc] = useState<string | null>(piece.chemin.startsWith("blob:") ? piece.chemin : null);
  const [lecture, setLecture] = useState(false);
  const [pos, setPos] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const barres = useMemo(() => onde(piece.chemin), [piece.chemin]);

  // Le lien est prêt avant le toucher : sur iPhone, le son ne part que dans
  // le geste lui-même, pas après une attente.
  useEffect(() => {
    if (src) return;
    let vivant = true;
    void lienVocal(piece.chemin).then((l) => vivant && setSrc(l));
    return () => {
      vivant = false;
    };
  }, [piece.chemin, src]);
  useEffect(() => () => audio.current?.pause(), []);

  function basculer(e: React.MouseEvent) {
    e.stopPropagation();
    if (!src) return;
    if (!audio.current) {
      const a = new Audio(src);
      a.ontimeupdate = () => setPos(a.currentTime);
      a.onended = () => {
        setLecture(false);
        setPos(0);
      };
      audio.current = a;
    }
    const a = audio.current;
    if (lecture) {
      a.pause();
      setLecture(false);
    } else {
      void a.play().then(
        () => setLecture(true),
        () => toast.error("Lecture impossible.")
      );
    }
  }

  const fait = piece.duree > 0 ? Math.min(1, pos / piece.duree) : 0;
  return (
    <div
      className={cn(
        "flex w-[min(250px,64vw)] items-center gap-2.5 rounded-[20px] py-1.5 pr-3.5 pl-1.5",
        mien ? "bg-foreground text-background" : "glass-soft"
      )}
    >
      <button
        type="button"
        onClick={basculer}
        disabled={!src}
        aria-label={lecture ? "Pause" : "Écouter"}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center disabled:opacity-40",
          mien ? "bouton-encre bouton--mauve" : "bouton-principal bouton--mauve"
        )}
      >
        {lecture ? <Pause className="size-4" fill="currentColor" /> : <Play className="ml-0.5 size-4" fill="currentColor" />}
      </button>
      <span aria-hidden className="flex h-7 min-w-0 flex-1 items-center gap-[2px]">
        {barres.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-full transition-opacity"
            style={{ height: `${h * 100}%`, background: "currentColor", opacity: i / barres.length < fait ? 1 : 0.35 }}
          />
        ))}
      </span>
      <span className="shrink-0 text-[11.5px] font-semibold tabular-nums opacity-70">
        {minutes(lecture || pos > 0 ? pos : piece.duree)}
      </span>
    </div>
  );
}

/** Le micro : enregistrer, annuler, ou finir (renvoie le son et sa durée).
 *  Au bout d'une minute, `auBout` est appelé (le vocal part tout seul). */
function useEnregistreur(auBout: () => void) {
  const [secondes, setSecondes] = useState<number | null>(null);
  const rappel = useRef(auBout);
  useEffect(() => {
    rappel.current = auBout;
  });
  const rec = useRef<{ r: MediaRecorder; flux: MediaStream; bouts: Blob[]; t0: number; minuteur: number; ext: string } | null>(null);
  const finir = useRef<((v: { blob: Blob; duree: number; ext: string } | null) => void) | null>(null);

  const couper = useCallback((garder: boolean) => {
    const e = rec.current;
    if (!e) return;
    window.clearInterval(e.minuteur);
    const duree = (Date.now() - e.t0) / 1000;
    e.r.onstop = () => {
      e.flux.getTracks().forEach((t) => t.stop());
      const blob = new Blob(e.bouts, { type: e.r.mimeType || e.bouts[0]?.type || "audio/mp4" });
      finir.current?.(garder && duree >= 0.6 && blob.size > 0 ? { blob, duree, ext: e.ext } : null);
      finir.current = null;
    };
    if (e.r.state !== "inactive") e.r.stop();
    else e.r.onstop.call(e.r, new Event("stop"));
    rec.current = null;
    setSecondes(null);
  }, []);

  const commencer = useCallback(async () => {
    const format = formatVocal();
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Ce téléphone n'enregistre pas de vocal ici.");
      return;
    }
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(flux, { mimeType: format.mime });
      const bouts: Blob[] = [];
      r.ondataavailable = (ev) => ev.data.size > 0 && bouts.push(ev.data);
      r.start(250);
      const t0 = Date.now();
      const minuteur = window.setInterval(() => {
        const s = (Date.now() - t0) / 1000;
        setSecondes(s);
        if (s >= VOCAL_MAX_S) {
          window.clearInterval(minuteur);
          rappel.current();
        }
      }, 200);
      rec.current = { r, flux, bouts, t0, minuteur, ext: format.ext };
      setSecondes(0);
      if (navigator.vibrate) navigator.vibrate(10);
    } catch {
      toast.error("Micro refusé : autorise-le dans les réglages du téléphone.");
    }
  }, []);

  /** Arrête et rend l'enregistrement (null s'il est trop court). */
  const terminer = useCallback(
    () =>
      new Promise<{ blob: Blob; duree: number; ext: string } | null>((res) => {
        finir.current = res;
        couper(true);
      }),
    [couper]
  );

  useEffect(() => () => couper(false), [couper]);
  return { secondes, commencer, terminer, annuler: () => couper(false) };
}

/* -------------------------------- Photos -------------------------------- */

/** Une photo dans le fil, à sa forme (bornée), et en grand au toucher. */
function PhotoVue({ piece }: { piece: PiecePhoto }) {
  const directe = piece.chemin.startsWith("blob:") || piece.chemin.startsWith("/");
  const [src, setSrc] = useState<string | null>(directe ? piece.chemin : null);
  const [grand, setGrand] = useState(false);

  useEffect(() => {
    if (src) return;
    let vivant = true;
    void lienPhoto(piece.chemin).then((l) => vivant && setSrc(l));
    return () => {
      vivant = false;
    };
  }, [piece.chemin, src]);

  // Ni trop haute ni trop plate : entre 4:5 debout et 16:9 couchée.
  const ratio = Math.min(16 / 9, Math.max(4 / 5, piece.l / piece.h));

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (src) setGrand(true);
        }}
        aria-label="Voir la photo"
        className="block w-[min(260px,64vw)] overflow-hidden rounded-[20px] bg-contraste/8 lg:w-[420px]"
        style={{ aspectRatio: ratio }}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element -- lien signé, hors de l'optimiseur d'images
          <img src={src} alt="" className="size-full object-cover" draggable={false} />
        )}
      </button>
      {grand &&
        src &&
        // Au-dessus de tout, barre d'onglets comprise : hors du Vestiaire.
        createPortal(
          <div
            role="dialog"
            aria-label="Photo"
            onClick={() => setGrand(false)}
            className="dark fixed inset-0 z-[60] flex items-center justify-center bg-black"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- lien signé */}
            <img src={src} alt="" className="max-h-full max-w-full object-contain" />
            <button
              type="button"
              onClick={() => setGrand(false)}
              aria-label="Fermer"
              className="bouton-secondaire absolute top-[max(env(safe-area-inset-top),14px)] right-4 flex size-10 items-center justify-center"
            >
              <X className="size-5" />
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

/** Une vidéo dans le fil : sa première image et sa durée ; au toucher, en grand, avec le son. */
function VideoVue({ piece }: { piece: PieceVideo }) {
  const directe = piece.chemin.startsWith("blob:") || piece.chemin.startsWith("/");
  const [src, setSrc] = useState<string | null>(directe ? piece.chemin : null);
  const [grand, setGrand] = useState(false);

  useEffect(() => {
    if (src) return;
    let vivant = true;
    void lienPhoto(piece.chemin).then((l) => vivant && setSrc(l));
    return () => {
      vivant = false;
    };
  }, [piece.chemin, src]);

  const ratio = Math.min(16 / 9, Math.max(4 / 5, piece.l / piece.h));

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (src) setGrand(true);
        }}
        aria-label="Lire la vidéo"
        className="relative block w-[min(260px,64vw)] overflow-hidden rounded-[20px] bg-contraste/8 lg:w-[420px]"
        style={{ aspectRatio: ratio }}
      >
        {/* #t=0.1 : Safari montre alors la première image au lieu d'un cadre noir. */}
        {src && <video src={`${src}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover" />}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
            <Play className="ml-0.5 size-5 fill-current" />
          </span>
        </span>
        <span className="absolute right-2.5 bottom-2 rounded-full bg-black/55 px-2 py-0.5 text-[11.5px] font-bold text-white tabular-nums">
          {minutes(piece.duree)}
        </span>
      </button>
      {grand &&
        src &&
        createPortal(
          <div role="dialog" aria-label="Vidéo" className="dark fixed inset-0 z-[60] flex items-center justify-center bg-black">
            <video src={src} controls autoPlay playsInline className="max-h-full max-w-full" />
            <button
              type="button"
              onClick={() => setGrand(false)}
              aria-label="Fermer"
              className="bouton-secondaire absolute top-[max(env(safe-area-inset-top),14px)] right-4 flex size-10 items-center justify-center"
            >
              <X className="size-5" />
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

/* -------------------------------- Pièces -------------------------------- */

function PieceVue({ piece, onOuvrirJournee, mien = false }: { piece: Piece; onOuvrirJournee?: (j: number) => void; mien?: boolean }) {
  const { journees } = useSeason();
  const format = useFormatCarte();

  // L'arrivée d'un joueur n'est pas une pièce à dessiner : le fil en fait une ligne (LigneArrivee).
  if (piece.type === "rejoint") return null;
  if (piece.type === "vocal") return <VocalVue piece={piece} mien={mien} />;
  if (piece.type === "photo") return <PhotoVue piece={piece} />;
  if (piece.type === "video") return <VideoVue piece={piece} />;
  if (piece.type === "ligue") return <LigueVue piece={piece} onOuvrirJournee={onOuvrirJournee} />;

  if (piece.type === "carte") {
    return (
      <div className="flex justify-center px-1 pt-1 pb-3">
        <CarteDe name={piece.joueur} size={format.grande} detail="Partagée au Vestiaire" />
      </div>
    );
  }

  if (piece.type === "classement") {
    const def = RANKINGS.find((r) => r.id === piece.id);
    return (
      <div className="flex flex-col gap-1.5 px-3 py-3">
        <p className="mono-label text-foreground/45">{def?.label ?? "Classement"}</p>
        {piece.top.map((l, i) => (
          <div key={l.n} className="flex items-center gap-2.5">
            <span className="w-4 text-[13px] font-bold text-foreground/40 tabular-nums">{i + 1}</span>
            <CarteDe name={l.n} size={format.petite} />
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
              <Nom n={l.n} />
            </span>
            <span className="text-[15px] font-bold tabular-nums">
              {l.v}
              <span className="mono-label ml-1 text-foreground/40">{def?.unit}</span>
            </span>
          </div>
        ))}
      </div>
    );
  }

  const jn = journees.find((x) => x.j === piece.j);
  if (!jn) return <p className="px-3 py-3 text-[13px] text-foreground/45">Journée {piece.j}</p>;
  return <FeuilleVue journee={jn} onOuvrir={onOuvrirJournee ? () => onOuvrirJournee(jn.j) : undefined} />;
}

/**
 * Un élément de la Ligue, figé au partage. La hiérarchie des cartes : un
 * joueur seul en grande carte, deux en moyennes côte à côte, plus en petites
 * sur des lignes, comme un podium. Toucher ouvre la journée dans la Ligue.
 */
function LigueVue({ piece, onOuvrirJournee }: { piece: PieceLigue; onOuvrirJournee?: (j: number) => void }) {
  const format = useFormatCarte();
  const joueurs = piece.lignes.filter((l) => l.n);
  const chiffres = piece.lignes.filter((l) => !l.n);
  const ouvrir = piece.j != null && onOuvrirJournee ? () => onOuvrirJournee(piece.j!) : undefined;
  const Corps = ouvrir ? "button" : "div";
  return (
    <Corps
      {...(ouvrir ? { type: "button" as const, onClick: (e: React.MouseEvent) => (e.stopPropagation(), ouvrir()) } : {})}
      className="flex w-full flex-col gap-2.5 px-3 py-3 text-left"
    >
      <span>
        <span className="mono-label block text-foreground/45">Ligue{piece.j != null && ` · J${piece.j}`}</span>
        <span className="block text-[15px] leading-tight font-bold">{piece.titre}</span>
      </span>
      {joueurs.length === 1 ? (
        <span className="flex flex-col items-center gap-1.5 pt-1">
          <CarteDe name={joueurs[0].n!} size={format.grande} detail={piece.titre} inerte />
          <span className="text-center text-[13px] font-semibold text-foreground/70">{joueurs[0].v}</span>
        </span>
      ) : joueurs.length === 2 ? (
        <span className="flex justify-center gap-4 pt-1">
          {joueurs.map((l) => (
            <span key={l.n} className="flex flex-col items-center gap-1.5">
              <CarteDe name={l.n!} size={format.moyenne} detail={piece.titre} inerte />
              <span className="max-w-[110px] text-center text-[12.5px] leading-tight font-semibold text-foreground/70">{l.v}</span>
            </span>
          ))}
        </span>
      ) : (
        joueurs.map((l, i) => (
          <span key={l.n} className="flex items-center gap-2.5">
            <span className="w-4 text-[13px] font-bold text-foreground/40 tabular-nums">{i + 1}</span>
            <CarteDe name={l.n!} size={format.petite} inerte />
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
              <Nom n={l.n!} />
            </span>
            <span className="shrink-0 text-right text-[13px] font-bold tabular-nums">{l.v}</span>
          </span>
        ))
      )}
      {chiffres.length > 0 && (
        <span className="grid grid-cols-2 gap-2">
          {chiffres.map((l) => (
            <span key={l.l} className="flex flex-col rounded-2xl bg-contraste/[0.06] px-3 py-2.5">
              <span className="text-[22px] leading-none font-bold tabular-nums">{l.v}</span>
              <span className="mono-label mt-1 text-foreground/45">{l.l}</span>
            </span>
          ))}
        </span>
      )}
    </Corps>
  );
}

/** Une feuille de match en résumé : les scores, puis les décisifs en cartes. */
function FeuilleVue({ journee, onOuvrir }: { journee: Journee; onOuvrir?: () => void }) {
  const format = useFormatCarte();
  const matches = journee.matches ?? [];
  const decisifs = matches
    .flatMap((m) => [...m.teamA.players, ...m.teamB.players])
    .filter((l) => l.buts + l.passes > 0)
    .sort((a, b) => b.buts * 2 + b.passes - (a.buts * 2 + a.passes))
    .slice(0, 3);
  return (
    <button
      type="button"
      onClick={(e) => {
        if (!onOuvrir) return;
        e.stopPropagation();
        onOuvrir();
      }}
      className="block w-full px-3 py-3 text-left"
    >
      <p className="mono-label text-foreground/45">
        Feuille de match · J{journee.j} · {journee.date}
      </p>
      <div className="mt-2 flex flex-col gap-1">
        {matches.map((m, i) => (
          <div key={m.id} className="flex items-center justify-between gap-2 text-[13.5px] font-semibold">
            <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
              {matches.length > 1 && <span className="mono-label mr-0.5 text-foreground/35">T{i + 1}</span>}
              <PointMaillot camp="Noirs" /> Noirs
            </span>
            <span className="shrink-0 text-[17px] font-extrabold tabular-nums">
              {m.teamA.score}
              <span className="mx-1 text-foreground/30">–</span>
              {m.teamB.score}
            </span>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 truncate">
              Blancs <PointMaillot camp="Blancs" />
            </span>
          </div>
        ))}
      </div>
      {decisifs.length > 0 && (
        <div className="mt-3 flex gap-3">
          {decisifs.map((l) => (
            <span key={l.name} className="flex min-w-0 flex-col items-center gap-1">
              <CarteDe name={l.name} size={format.petite} inerte />
              <span className="mono-label text-[9px] text-foreground/55 tabular-nums">
                {l.buts > 0 && `${l.buts}B`}
                {l.buts > 0 && l.passes > 0 && " "}
                {l.passes > 0 && `${l.passes}P`}
              </span>
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

/* --------------------------- Choisir une pièce -------------------------- */

function ChoixPiece({ onChoix, onPhoto, onFermer }: { onChoix: (p: Piece) => void; onPhoto: () => void; onFermer: () => void }) {
  const { me } = useMyPlayer();
  const { players, saison, journees } = useSeason();
  const [etape, setEtape] = useState<"menu" | "feuille" | "classement">("menu");
  const jouees = useMemo(
    () => [...journees].filter((j) => journeeJouee(saison, j.j) && (j.matches?.length ?? 0) > 0).reverse(),
    [journees, saison]
  );

  const ligne = "flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-left text-[14.5px] font-semibold active:bg-contraste/8";

  return (
    <div className="glass mb-2 overflow-hidden rounded-3xl p-1.5">
      <div className="flex items-center justify-between px-2.5 pt-1.5 pb-1">
        <span className="mono-label text-foreground/45">
          {etape === "menu" ? "Partager" : etape === "feuille" ? "Feuille de match" : "Classement"}
        </span>
        <button type="button" onClick={onFermer} aria-label="Fermer" className="bouton-discret flex size-7 items-center justify-center">
          <X className="size-4" />
        </button>
      </div>
      <div className="choix-ecriture max-h-[42dvh] overflow-y-auto">
        {etape === "menu" && (
          <>
            <button type="button" className={ligne} onClick={onPhoto}>
              Une photo ou une vidéo
            </button>
            <button type="button" className={ligne} onClick={() => onChoix({ type: "carte", joueur: me })}>
              Ma carte
            </button>
            <button type="button" className={ligne} onClick={() => setEtape("feuille")} disabled={jouees.length === 0}>
              Une feuille de match
            </button>
            <button type="button" className={ligne} onClick={() => setEtape("classement")}>
              Un classement
            </button>
          </>
        )}
        {etape === "feuille" &&
          jouees.map((j) => (
            <button key={j.j} type="button" className={ligne} onClick={() => onChoix({ type: "feuille", j: j.j })}>
              <span>J{j.j}</span>
              <span className="text-[13px] font-medium text-foreground/50">{j.date}</span>
            </button>
          ))}
        {etape === "classement" &&
          RANKINGS.filter((r) => r.id !== "discipline").map((r) => {
            const top = rankByMetric(players, r.value)
              .filter((p) => r.showAll || p.value > 0)
              .slice(0, 3);
            if (top.length === 0) return null;
            return (
              <button
                key={r.id}
                type="button"
                className={ligne}
                onClick={() => onChoix({ type: "classement", id: r.id, top: top.map((p) => ({ n: p.name, v: p.value })) })}
              >
                <span>{r.label}</span>
                <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-foreground/50">
                  <CarteDe name={top[0].name} size={FORMAT_CARTE.petite * 0.62} inerte />
                  <span className="truncate">
                    <Nom n={top[0].name} /> · {top[0].value}
                  </span>
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

/* ------------------------------ Notifications --------------------------- */

const MODES: [ModeNotifs, string][] = [
  ["tout", "Tout"],
  ["cite", "Quand on me cite"],
  ["rien", "Rien"],
];

function ReglageNotifs({
  mode,
  modes = MODES,
  onMode,
  onFermer,
}: {
  mode: ModeNotifs;
  modes?: [ModeNotifs, string][];
  onMode: (m: ModeNotifs) => void;
  onFermer: () => void;
}) {
  const [etat, setEtat] = useState<EtatNotifications | null>(null);
  useEffect(() => {
    void etatNotifications().then(setEtat);
  }, []);
  return (
    <div className="glass absolute top-[52px] right-0 z-20 w-[248px] rounded-3xl p-1.5 shadow-2xl">
      {modes.map(([m, label]) => (
        <button
          key={m}
          type="button"
          onClick={() => {
            onMode(m);
            onFermer();
          }}
          className="flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-[14px] font-semibold active:bg-contraste/8"
        >
          {label}
          {mode === m && <Check className="size-4" />}
        </button>
      ))}
      {etat === "inactives" && (
        <button
          type="button"
          onClick={async () => {
            const e = await activerNotifications("vestiaire").catch(() => "inactives" as const);
            setEtat(e);
            if (e === "actives") toast.success("Notifications activées");
          }}
          className="bouton-principal bouton--mauve mt-1 w-full py-2.5 text-[13px] font-bold"
        >
          Activer sur ce téléphone
        </button>
      )}
    </div>
  );
}

/* -------------------------------- Message ------------------------------- */

/** Les gestes sur un message. Les mêmes d'un rendu à l'autre : taper une
 *  lettre dans la barre d'écriture ne redessine pas les bulles du fil. */
interface ActionsBulle {
  toucher: (id: number) => void;
  reagir: (m: MessageV, e: Emoji) => void;
  retirer: (m: MessageV) => void;
  couper: (m: MessageV) => void;
  repondre: (m: MessageV) => void;
  allerA: (id: number) => void;
}

const Bulle = memo(function Bulle({
  m,
  cite,
  surligne,
  suite,
  ouvert,
  moi,
  admin,
  attente = false,
  actions,
  onOuvrirJournee,
}: {
  m: MessageV;
  /** Le message auquel celui-ci répond (s'il est dans le fil). */
  cite?: MessageV;
  /** Un instant mis en avant : on vient d'y sauter depuis une réponse. */
  surligne: boolean;
  /** Même auteur que le message d'avant, de peu : pas de carte ni de nom. */
  suite: boolean;
  ouvert: boolean;
  moi: string | null;
  admin: boolean;
  /** Mon message parti, que la base n'a pas encore pris : en retrait, sans gestes. */
  attente?: boolean;
  actions: ActionsBulle;
  onOuvrirJournee?: (j: number) => void;
}) {
  const pastille = 254 * FORMAT_CARTE.petite;
  const reactions = EMOJIS.filter((e) => (m.reactions[e]?.length ?? 0) > 0);
  const onToucher = () => !attente && actions.toucher(m.id);
  const onRepondre = () => !attente && actions.repondre(m);
  const onReagir = (e: Emoji) => actions.reagir(m, e);

  // Glisser la bulle vers la droite : répondre, comme dans WhatsApp.
  const depart = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const [tire, setTire] = useState(0);
  const SEUIL = 56;
  const touche = {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      depart.current = { x: t.clientX, y: t.clientY, horizontal: null };
    },
    onTouchMove: (e: React.TouchEvent) => {
      const d = depart.current;
      if (!d) return;
      const t = e.touches[0];
      const dx = t.clientX - d.x;
      const dy = t.clientY - d.y;
      if (d.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) d.horizontal = dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.4;
      if (!d.horizontal) return;
      const v = Math.min(72, Math.max(0, dx));
      if (v >= SEUIL && tire < SEUIL && navigator.vibrate) navigator.vibrate(6);
      setTire(v);
    },
    onTouchEnd: () => {
      if (tire >= SEUIL) onRepondre();
      depart.current = null;
      setTire(0);
    },
  };

  return (
    <div
      id={`m-${m.id}`}
      data-ancre=""
      aria-busy={attente || undefined}
      {...touche}
      onTouchCancel={touche.onTouchEnd}
      className={cn(
        "relative flex touch-pan-y items-end gap-2 rounded-3xl transition-[background-color,opacity] duration-700",
        m.mien ? "flex-row-reverse" : "flex-row",
        suite ? "mt-1" : "mt-[var(--fib-13)]",
        surligne && "bg-contraste/[0.07]",
        attente && "opacity-60"
      )}
      style={{ transform: tire ? `translateX(${tire}px)` : undefined, transition: tire ? "none" : "transform 0.25s ease" }}
    >
      {tire > 0 && (
        <span
          aria-hidden
          className="absolute top-1/2 -left-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-contraste/10"
          style={{ opacity: Math.min(1, tire / SEUIL) }}
        >
          <Reply className="size-4" />
        </span>
      )}
      {!m.mien &&
        (suite ? (
          <span className="shrink-0" style={{ width: pastille }} />
        ) : (
          <CarteDe name={m.auteur || "?"} size={FORMAT_CARTE.petite} className="mb-[18px]" />
        ))}
      <div className={cn("flex min-w-0 max-w-[78%] flex-col", m.mien ? "items-end" : "items-start")}>
        {!m.mien && !suite && (
          <span className="mb-1 px-1 text-[12px] font-semibold text-foreground/55">
            {m.auteur ? <Nom n={m.auteur} /> : "Quelqu'un"}
          </span>
        )}
        {/* Une div plutôt qu'un bouton : la pièce contient ses propres boutons
            (la carte s'ouvre en grand, la feuille ouvre la journée). */}
        <div
          role="button"
          tabIndex={0}
          onClick={onToucher}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToucher())}
          className={cn(
            "flex min-w-0 flex-col gap-1 text-left transition-transform active:scale-[0.985]",
            m.mien ? "items-end" : "items-start"
          )}
        >
          {cite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                actions.allerA(cite.id);
              }}
              className="max-w-full rounded-2xl border-l-[3px] border-foreground/45 bg-contraste/[0.06] py-1.5 pr-3 pl-2.5 text-left"
            >
              <span className="block text-[11.5px] font-bold text-foreground/65">
                {cite.mien ? "Toi" : cite.auteur ? <Nom n={cite.auteur} /> : "Quelqu'un"}
              </span>
              <span className="line-clamp-2 text-[13px] leading-snug text-foreground/55">{apercu(cite)}</span>
            </button>
          )}
          {m.texte && (
            <p
              className={cn(
                "rounded-[20px] px-3.5 py-2 text-[15px] leading-snug break-words whitespace-pre-wrap",
                m.mien ? "bg-foreground text-background" : "glass-soft"
              )}
            >
              {m.texte}
            </p>
          )}
          {/* La pièce à part, sous la phrase : une carte se montre nue, une
              feuille ou un classement dans son verre. */}
          {m.piece &&
            (m.piece.type === "carte" || m.piece.type === "vocal" || m.piece.type === "photo" || m.piece.type === "video" ? (
              <PieceVue piece={m.piece} mien={m.mien} />
            ) : (
              <div className="glass-soft w-[min(280px,68vw)] overflow-hidden rounded-[20px]">
                <PieceVue piece={m.piece} onOuvrirJournee={onOuvrirJournee} />
              </div>
            ))}
        </div>

        {reactions.length > 0 && (
          <div className={cn("-mt-2 flex gap-1 px-2", m.mien ? "justify-end" : "justify-start")}>
            {reactions.map((e) => {
              const qui = m.reactions[e] ?? [];
              const mienne = !!moi && qui.includes(moi);
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => onReagir(e)}
                  className={cn(
                    "flex h-6 items-center gap-1 px-1.5 text-[12px] font-bold tabular-nums",
                    mienne ? "bouton-secondaire bouton--mauve" : "bouton-secondaire"
                  )}
                >
                  <span className="text-[13px] leading-none">{e}</span>
                  {qui.length > 1 && qui.length}
                </button>
              );
            })}
          </div>
        )}

        {ouvert && (
          <div className={cn("mt-1.5 flex flex-col gap-1.5", m.mien ? "items-end" : "items-start")}>
            <div className="glass flex gap-0.5 rounded-full p-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onReagir(e)}
                  className={cn(
                    "flex size-9 items-center justify-center text-[20px]",
                    moi && m.reactions[e]?.includes(moi) ? "bouton-secondaire bouton--mauve" : "bouton-discret"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            {(m.mien || admin) && (
              <div className="flex gap-1.5">
                <button type="button" onClick={() => actions.retirer(m)} className="bouton-secondaire bouton--rouge px-3 py-1.5 text-[12.5px] font-semibold">
                  Retirer
                </button>
                {admin && !m.mien && (
                  <button type="button" onClick={() => actions.couper(m)} className="bouton-secondaire bouton--rouge px-3 py-1.5 text-[12.5px] font-semibold">
                    Couper la parole 24 h
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* L'heure, et sous chaque bulle les deux gestes : répondre, réagir. */}
        <div className={cn("mt-0.5 flex items-center gap-0.5", m.mien ? "flex-row-reverse" : "flex-row", attente && "pointer-events-none")}>
          <span className="px-1 text-[10.5px] font-medium text-foreground/30 tabular-nums">{quand(m.at)}</span>
          <button
            type="button"
            onClick={onRepondre}
            aria-label="Répondre"
            className="bouton-discret bouton--mauve flex size-7 items-center justify-center opacity-55"
          >
            <Reply className="size-[15px]" />
          </button>
          <button
            type="button"
            onClick={onToucher}
            aria-label="Réagir"
            aria-expanded={ouvert}
            className={cn("bouton-discret bouton--mauve flex size-7 items-center justify-center", !ouvert && "opacity-55")}
          >
            <SmilePlus className="size-[15px]" />
          </button>
        </div>
      </div>
    </div>
  );
});

/* ------------------------------- Arrivée -------------------------------- */

/** « Kader a rejoint le match » : une ligne au milieu du fil, sa carte en pastille. */
const LigneArrivee = memo(function LigneArrivee({ m }: { m: MessageV }) {
  return (
    <div id={`m-${m.id}`} data-ancre="" className="mt-[var(--fib-13)] flex items-center justify-center gap-2 px-6 text-center">
      <CarteDe name={m.auteur || "?"} size={FORMAT_CARTE.petite * 0.62} inerte />
      <span className="text-[13px] font-semibold text-foreground/55">
        {m.mien ? "Tu as rejoint le match" : m.auteur ? <><Nom n={m.auteur} /> a rejoint le match</> : "Quelqu'un a rejoint le match"}
      </span>
      <span className="text-[10.5px] font-medium text-foreground/30 tabular-nums">{quand(m.at)}</span>
    </div>
  );
});

/* ------------------------------ Vestiaire ------------------------------- */

// Aussi sur les aperçus Vercel : ?demo=vestiaire se juge sur un téléphone sans écrire en base.
const DEMO = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";

export function Vestiaire({ onOuvrirJournee }: { onOuvrirJournee?: (j: number) => void }) {
  const { players, journees } = useSeason();
  // ?demo=vestiaire : un fil d'essai ; ?demo=vestiaire-vide : le fil vide.
  const demoVal = useMemo(() => (DEMO && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("demo") : null), []);
  const demo = useMemo(
    () => (demoVal === "vestiaire" ? messagesDemo(players.map((p) => p.name), journees) : demoVal === "vestiaire-vide" ? [] : null),
    [demoVal, players, journees]
  );
  return (
    <Discussion
      salon={SALON_VESTIAIRE}
      titre={<TitreDiscussion actif="/vestiaire" />}
      aDroite={
        <>
          <BoutonMessages className="size-10" />
          <BoutonRecherche className="size-10" />
        </>
      }
      libelleNotifs="Notifications du Vestiaire"
      vide="Le Vestiaire est vide."
      onglets
      moderation
      pieces
      serre
      demo={demo}
      onOuvrirJournee={onOuvrirJournee}
    />
  );
}

/* ------------------------------ Discussion ------------------------------ */

/** L'heure d'un envoi (hors rendu). */
const horloge = () => Date.now();
/** Un écran tactile : Entrée y va à la ligne au lieu d'envoyer. */
const tactile = () => window.matchMedia("(pointer: coarse)").matches;

/** Le même message, tel que la base le rend à nouveau ? */
function pareil(a: MessageV, b: MessageV): boolean {
  return (
    a.texte === b.texte &&
    a.at === b.at &&
    a.auteur === b.auteur &&
    a.auteurId === b.auteurId &&
    a.mien === b.mien &&
    a.reponseA === b.reponseA &&
    JSON.stringify(a.piece) === JSON.stringify(b.piece) &&
    JSON.stringify(a.reactions) === JSON.stringify(b.reactions)
  );
}

/** Le fil relu, où chaque message inchangé reste l'objet déjà affiché : sa bulle ne se redessine pas. */
function garderLesMemes(avant: MessageV[], apres: MessageV[]): MessageV[] {
  if (avant.length === 0) return apres;
  const deja = new Map(avant.map((m) => [m.id, m]));
  return apres.map((m) => {
    const a = deja.get(m.id);
    return a && pareil(a, m) ? a : m;
  });
}

/** Mon message parti : à l'écran tout de suite, avant que la base ne le rende. */
interface Parti {
  cle: number;
  m: MessageV;
  /** La base l'a pris : il porte son vrai numéro, la relecture le remplacera. */
  pris: boolean;
}

/**
 * Un écran de discussion : le Vestiaire, ou la discussion d'un match
 * (matchs/discussion-match.tsx). Ce qui les distingue arrive par les
 * propriétés ; le fil, les bulles, la barre d'écriture sont les mêmes.
 */
export function Discussion({
  salon,
  titre,
  sousTitre,
  aDroite,
  libelleNotifs,
  modesNotifs,
  vide,
  onglets = false,
  serre = false,
  moderation = false,
  pieces = false,
  demo = null,
  secours,
  tete,
  filtre,
  onOuvrirJournee,
  className,
}: {
  salon: Salon;
  /** À gauche de l'en-tête : le titre de l'écran. */
  titre: React.ReactNode;
  /** Sous la ligne du titre, de toute sa largeur (le match : où, quand, ce qu'il manque). */
  sousTitre?: React.ReactNode;
  /** À droite, après la cloche des notifications. */
  aDroite?: React.ReactNode;
  libelleNotifs: string;
  /** Ce que la cloche propose (une conversation privée : Tout ou Rien, tout y est pour moi). */
  modesNotifs?: [ModeNotifs, string][];
  /** Ce que dit le fil vide (rien si vide). */
  vide: string;
  /** La barre d'onglets reste dessous (le Vestiaire) ; sinon l'écran la recouvre, posé sur <body> (matchs/discussion-match.tsx). */
  onglets?: boolean;
  /** Trois boutons en haut (le Vestiaire : la cloche, les messages, la loupe) : un cran plus petits, pour que le titre tienne. */
  serre?: boolean;
  /** L'admin modère : il retire n'importe quel message et coupe la parole (le Vestiaire, lieu public). */
  moderation?: boolean;
  /** Prend la pièce préparée ailleurs (« Au Vestiaire » d'un classement, d'une feuille). */
  pieces?: boolean;
  /** Un fil d'essai, sans base : rien n'est lu ni écrit. */
  demo?: MessageV[] | null;
  /** Si la base n'a pas encore cette discussion (les aperçus) : le fil d'essai à montrer. */
  secours?: () => MessageV[];
  /** En tête du fil, avant le premier message. */
  tete?: React.ReactNode;
  /** Ce qu'on montre du fil (les arrivées encore vraies, pour un match). */
  filtre?: (ms: MessageV[]) => MessageV[];
  onOuvrirJournee?: (j: number) => void;
  className?: string;
}) {
  const session = useSession();
  const [moi, setMoi] = useState<string | null>(null);
  const [profils, setProfils] = useState<ProfilV[]>([]);
  const [messages, setMessages] = useState<MessageV[]>([]);
  const [partis, setPartis] = useState<Parti[]>([]);
  /** Mes messages envoyés d'ici : leur bulle garde la clé de l'envoi, rendue par la base (pas de remontage, pas d'éclair sur une photo). */
  const [cles, setCles] = useState<ReadonlyMap<number, string>>(() => new Map());
  const [prete, setPrete] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [texte, setTexte] = useState("");
  const [piece, setPiece] = useState<Piece | null>(null);
  const [reponse, setReponse] = useState<MessageV | null>(null);
  const [surligne, setSurligne] = useState<number | null>(null);
  const [choix, setChoix] = useState(false);
  // Une minute : le vocal part tout seul.
  const micro = useEnregistreur(() => void envoyerVocal());
  const peutVocal = useMemo(() => typeof window !== "undefined" && !!formatVocal(), []);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [mode, setMode] = useState<ModeNotifs>("tout");
  const [reglage, setReglage] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [sourdine, setSourdine] = useState<number | null>(null);
  const ecran = useEcranClavier();
  const champ = useRef<HTMLTextAreaElement>(null);
  const choixPhoto = useRef<HTMLInputElement>(null);
  /** La photo ou la vidéo choisie, en attente d'envoi (la pièce porte son lien local). */
  const photoLocale = useRef<{ url: string; blob: Blob } | null>(null);
  /** Mes messages partent un à un, dans l'ordre où je les ai écrits. */
  const fileEnvoi = useRef<Promise<unknown>>(Promise.resolve());
  /** Une relecture du fil à la fois ; une autre demandée entre-temps la suit. */
  const relecture = useRef({ enCours: false, encore: false });
  const { fil, contenu, onScroll, noter, tenir, allerEnBas, montrer } = useFilAuBas();

  // Un fil d'essai (démo, ou secours des aperçus) : tout reste sur l'écran.
  const [secoursActif, setSecoursActif] = useState(false);
  const essai = demo !== null || secoursActif;
  const empeche = essai ? null : blocageVestiaire(salon.ou);
  const admin = moderation && !!session?.admin;

  // Le fil relu par la base prend sa place ; mes messages qu'elle rend
  // quittent l'attente dans le même rendu (ni trou, ni doublon).
  const poser = useCallback(
    (ms: MessageV[]) => {
      noter();
      setMessages((avant) => garderLesMemes(avant, ms));
      setPartis((l) => (l.some((x) => x.pris) ? l.filter((x) => !x.pris || !ms.some((m) => m.id === x.m.id)) : l));
    },
    [noter]
  );

  // Une rafale (un message, des réactions, le mien) : une relecture à la
  // fois, une seule après elle. Deux relectures croisées pouvaient revenir
  // dans le désordre et faire disparaître puis réapparaître un message.
  const recharger = useCallback(
    async (uid: string, liste: ProfilV[]) => {
      const etat = relecture.current;
      if (etat.enCours) {
        etat.encore = true;
        return;
      }
      etat.enCours = true;
      try {
        do {
          etat.encore = false;
          const r = await salon.charger(uid, liste);
          if (!r.ok) setErreur(r.raison);
          else {
            setErreur(null);
            poser(r.messages);
          }
          setPrete(true);
        } while (etat.encore);
      } finally {
        etat.enCours = false;
      }
    },
    [salon, poser]
  );

  // Premier chargement, temps réel, et lecture.
  useEffect(() => {
    if (demo) {
      Promise.resolve().then(() => {
        setMoi("moi");
        setMessages(demo);
        setPrete(true);
      });
      return;
    }
    if (!session?.server) {
      Promise.resolve().then(() => setPrete(true));
      return;
    }
    let vivant = true;
    let stop = () => {};
    (async () => {
      const sb = supabase();
      const { data: auth } = await sb.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!vivant) return;
      setMoi(uid);
      if (!uid) {
        setErreur("Ta session a expiré. Déconnecte-toi puis reconnecte-toi.");
        setPrete(true);
        return;
      }
      const [liste, suivi, sd] = await Promise.all([
        chargerProfilsV(),
        salon.lireSuivi(),
        moderation
          ? sb.from("vestiaire_sourdines").select("jusqu_au").eq("user_id", uid).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!vivant) return;
      setProfils(liste);
      setMode(suivi.notifs);
      const fin = sd.data ? new Date((sd.data as { jusqu_au: string }).jusqu_au).getTime() : 0;
      setSourdine(fin > Date.now() ? fin : null);
      const r = await salon.charger(uid, liste);
      if (!vivant) return;
      if (!r.ok && secours) {
        setSecoursActif(true);
        setMessages(secours());
        setPrete(true);
        return;
      }
      if (!r.ok) setErreur(r.raison);
      else poser(r.messages);
      setPrete(true);
      stop = salon.ecouter(() => void recharger(uid, liste));
    })();
    return () => {
      vivant = false;
      stop();
    };
  }, [session?.server, recharger, poser, demo, salon, moderation, secours]);

  // La discussion ouverte devant moi : tout ce qui arrive est lu.
  const dernier = messages[messages.length - 1]?.at ?? 0;
  useEffect(() => {
    if (demo || !prete || !session?.server) return;
    void salon.marquerLu(Math.max(Date.now(), dernier));
  }, [dernier, prete, demo, session?.server, salon]);

  // Sous mes yeux : pas de notification tant que je regarde. Redit toutes
  // les 20 s quand l'écran est visible, effacé dès qu'il ne l'est plus.
  useEffect(() => {
    if (demo || !session?.server) return;
    let minuteur = 0;
    const suivre = () => {
      window.clearInterval(minuteur);
      const visible = document.visibilityState === "visible";
      void salon.direDevant(visible);
      if (visible) minuteur = window.setInterval(() => void salon.direDevant(true), 20_000);
    };
    suivre();
    document.addEventListener("visibilitychange", suivre);
    return () => {
      window.clearInterval(minuteur);
      document.removeEventListener("visibilitychange", suivre);
      void salon.direDevant(false);
    };
  }, [demo, session?.server, salon]);

  // Le fil en place à chaque changement : au plus récent, ou sur le message
  // qu'on lit (le clavier, la barre d'écriture et les photos qui chargent :
  // useFilAuBas les suit seul).
  useLayoutEffect(() => {
    if (prete) tenir();
  }, [prete, messages, partis, tenir]);

  // Une pièce préparée ailleurs (« Au Vestiaire » d'un classement, d'une
  // feuille de match) attend dans la barre d'écriture.
  useEffect(() => {
    if (!pieces) return;
    const prendre = () => {
      const p = prendrePiece();
      if (p) {
        setPiece(p);
        champ.current?.focus();
      }
    };
    prendre();
    window.addEventListener(EVT_PIECE, prendre);
    return () => window.removeEventListener(EVT_PIECE, prendre);
  }, [pieces]);

  // @pseudo : les joueurs qui commencent par ce qui est tapé.
  const enCours = /(?:^|\s)@([\p{L}0-9_.-]*)$/u.exec(texte)?.[1]?.toLowerCase();
  const suggestions =
    enCours !== undefined
      ? profils.filter((p) => p.id !== moi && (p.pseudo.startsWith(enCours) || p.name.toLowerCase().startsWith(enCours))).slice(0, 5)
      : [];

  async function envoyer(vocal?: PieceVocal) {
    let p = vocal ?? piece;
    if (envoi || (!texte.trim() && !p)) return;
    // Une photo ou une vidéo choisie part d'abord dans le stockage, puis avec le message.
    const locale = photoLocale.current;
    /** La pièce telle que la barre la montre (une photo : son lien local), pour l'y remettre si rien ne part. */
    const choisie = vocal ? null : piece;
    if (!vocal && !essai && (p?.type === "photo" || p?.type === "video") && locale && p.chemin === locale.url) {
      setEnvoi(true);
      const deposee =
        p.type === "photo" ? await deposerPhoto(locale.blob, p.l, p.h) : await deposerVideo(locale.blob, p.l, p.h, p.duree);
      setEnvoi(false);
      if (!deposee) {
        toast.error(p.type === "photo" ? "Photo pas envoyée. Réessaie." : "Vidéo pas envoyée. Réessaie.");
        return;
      }
      p = deposee;
    }
    const corps = vocal ? "" : texte;
    const rep = reponse;
    if (!vocal) {
      setTexte("");
      setPiece(null);
    }
    setReponse(null);
    allerEnBas();
    const at = horloge();
    const mien: MessageV = { id: -at, auteurId: moi ?? "moi", auteur: "", texte: corps.trim(), piece: p, at, mien: true, reponseA: rep?.id ?? null, reactions: {} };
    if (essai) {
      setMessages((ms) => [...ms, { ...mien, id: at }]);
      return;
    }
    // Mon message est à l'écran tout de suite, en retrait le temps que la
    // base le prenne : la barre ne se fige plus le temps de l'envoi, et le
    // fil ne saute plus quand il arrive. Il part après les précédents.
    setPartis((l) => [...l, { cle: at, m: mien, pris: false }]);
    const tache = fileEnvoi.current.then(() => salon.poster(corps, p, rep?.id ?? null));
    fileEnvoi.current = tache.catch(() => undefined);
    const r = await tache.catch(() => ({ ok: false as const, raison: "Message pas envoyé. Réessaie." }));
    if (!r.ok) {
      setPartis((l) => l.filter((x) => x.cle !== at));
      // Ce qui n'est pas parti revient dans la barre, si rien d'autre n'y a été écrit.
      if (!vocal) {
        setTexte((t) => t || corps);
        setPiece((x) => x ?? choisie);
      }
      setReponse((x) => x ?? rep);
      toast.error(r.raison);
      return;
    }
    if (navigator.vibrate) navigator.vibrate(8);
    // Partie : la bulle lit la photo en ligne, le lien local ne sert plus (sauf si une autre a été choisie depuis).
    if (!vocal && locale && photoLocale.current === locale && p !== choisie) oublierPhoto();
    const id = r.id;
    if (id != null) setCles((c) => new Map(c).set(id, `p${at}`));
    setPartis((l) => (id == null ? l.filter((x) => x.cle !== at) : l.map((x) => (x.cle === at ? { ...x, m: { ...x.m, id }, pris: true } : x))));
    if (moi) void recharger(moi, profils);
  }

  /** Une photo ou une vidéo choisie dans la photothèque, ou prise à l'instant. */
  async function choisirPhoto(fichier: File | undefined) {
    if (!fichier) return;
    if (fichier.type.startsWith("video/")) {
      const v = await preparerVideo(fichier);
      if (!v.ok) {
        toast.error(v.raison);
        return;
      }
      oublierPhoto();
      const url = URL.createObjectURL(fichier);
      photoLocale.current = { url, blob: fichier };
      setPiece({ type: "video", chemin: url, l: v.l, h: v.h, duree: v.duree });
      setChoix(false);
      return;
    }
    const prete = await preparerPhoto(fichier);
    if (!prete) {
      toast.error("Cette image ne s'ouvre pas.");
      return;
    }
    oublierPhoto();
    const url = URL.createObjectURL(prete.blob);
    photoLocale.current = { url, blob: prete.blob };
    setPiece({ type: "photo", chemin: url, l: prete.l, h: prete.h });
    setChoix(false);
  }

  function oublierPhoto() {
    // En démo, la bulle envoyée garde le lien local : on ne le libère pas.
    if (photoLocale.current && !essai) URL.revokeObjectURL(photoLocale.current.url);
    photoLocale.current = null;
  }

  /** Le vocal fini : on le dépose, puis il part comme un message. */
  async function envoyerVocal() {
    const fin = await micro.terminer();
    if (!fin) return;
    if (essai) {
      void envoyer({ type: "vocal", chemin: URL.createObjectURL(fin.blob), duree: Math.round(fin.duree * 10) / 10 });
      return;
    }
    setEnvoi(true);
    const p = await deposerVocal(fin.blob, fin.duree, fin.ext);
    setEnvoi(false);
    if (!p) {
      toast.error("Vocal pas envoyé. Réessaie.");
      return;
    }
    await envoyer(p);
  }

  function repondreA(m: MessageV) {
    setOuvert(null);
    setReponse(m);
    champ.current?.focus();
  }

  function allerA(id: number) {
    const el = document.getElementById(`m-${id}`);
    if (!el) return;
    montrer(el);
    setSurligne(id);
    window.setTimeout(() => setSurligne((x) => (x === id ? null : x)), 1400);
  }

  async function basculerReaction(m: MessageV, e: Emoji) {
    const deja = !!moi && (m.reactions[e] ?? []).includes(moi);
    // Tout de suite à l'écran ; la base suit.
    setMessages((ms) =>
      ms.map((x) =>
        x.id !== m.id || !moi
          ? x
          : {
              ...x,
              reactions: {
                ...x.reactions,
                [e]: deja ? (x.reactions[e] ?? []).filter((u) => u !== moi) : [...(x.reactions[e] ?? []), moi],
              },
            }
      )
    );
    setOuvert(null);
    if (essai) return;
    const ok = await salon.reagir(m.id, e, !deja);
    if (!ok && moi) {
      toast.error("Réaction pas enregistrée.");
      await recharger(moi, profils);
    }
  }

  async function retirer(m: MessageV) {
    setOuvert(null);
    if (essai) {
      setMessages((ms) => ms.filter((x) => x.id !== m.id));
      return;
    }
    if (!(await retirerMessage(m.id))) toast.error("Impossible de retirer ce message.");
    else if (moi) await recharger(moi, profils);
  }

  async function couper(m: MessageV) {
    setOuvert(null);
    if (essai || !moderation) return;
    const ok = await couperLaParole(m.auteurId, 24);
    if (ok) toast.success("Parole coupée pour 24 h");
    else toast.error("Impossible pour l'instant.");
  }

  async function changerMode(m: ModeNotifs) {
    setMode(m);
    if (!essai && !(await salon.reglerNotifs(m))) toast.error("Réglage pas enregistré.");
  }

  // Les gestes des bulles : les mêmes à chaque rendu (une bulle ne se
  // redessine que si son message change), qui appellent ceux du dernier.
  const gestes = useRef<ActionsBulle | null>(null);
  useLayoutEffect(() => {
    gestes.current = {
      toucher: (id) => setOuvert((o) => (o === id ? null : id)),
      reagir: (m, e) => void basculerReaction(m, e),
      retirer: (m) => void retirer(m),
      couper: (m) => void couper(m),
      repondre: repondreA,
      allerA,
    };
  });
  const actions = useMemo<ActionsBulle>(
    () => ({
      toucher: (id) => gestes.current?.toucher(id),
      reagir: (m, e) => gestes.current?.reagir(m, e),
      retirer: (m) => gestes.current?.retirer(m),
      couper: (m) => gestes.current?.couper(m),
      repondre: (m) => gestes.current?.repondre(m),
      allerA: (id) => gestes.current?.allerA(id),
    }),
    []
  );

  const parId = new Map(messages.map((m) => [m.id, m]));
  const affiches = filtre ? filtre(messages) : messages;
  // Au bout du fil, mes messages en route ; une fois rendus par la base, c'est elle qui les montre.
  const lignes = [
    ...affiches.map((m) => ({ cle: cles.get(m.id) ?? String(m.id), m, attente: false })),
    ...partis.filter((x) => !(x.pris && parId.has(x.m.id))).map((x) => ({ cle: `p${x.cle}`, m: x.m, attente: !x.pris })),
  ];

  const enTete = (
    <header className="relative mx-auto w-full max-w-[640px] shrink-0 px-5 pt-3 pb-2 lg:max-w-[760px]">
      <div className="flex items-center justify-between gap-3">
        {titre}
        {!empeche && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setReglage((v) => !v)}
              aria-label={libelleNotifs}
              aria-expanded={reglage}
              className={cn("bouton-secondaire bouton--mauve flex items-center justify-center", serre ? "size-10" : "size-11")}
            >
              {mode === "rien" ? <BellOff className="size-[18px]" /> : <Bell className="size-[18px]" />}
            </button>
            {aDroite}
          </div>
        )}
      </div>
      {sousTitre}
      {reglage && <ReglageNotifs mode={mode} modes={modesNotifs} onMode={changerMode} onFermer={() => setReglage(false)} />}
    </header>
  );

  return (
    // Tout l'écran ; clavier ouvert, la partie visible, la barre d'écriture
    // juste au-dessus du clavier (hooks/use-ecran-clavier.ts, globals.css).
    // data-ecran-fixe : rien d'autre que le fil n'y fait glisser la page
    // (pwa/viewport-lock.tsx).
    <section
      ref={ecran}
      data-ecran-fixe=""
      data-onglets={onglets ? "" : undefined}
      // Sans onglets (un match, une équipe, posés sur <body>) : au-dessus de la
      // barre d'onglets (z 40), sous les feuilles (z 50), dont la carte d'un
      // joueur touchée dans le fil.
      className={cn("ecran-discussion fixed inset-x-0 top-0 flex flex-col bg-background", onglets ? "z-[35]" : "z-[45]", className)}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {enTete}

      <div ref={fil} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          ref={contenu}
          className="mx-auto flex min-h-full w-full max-w-[640px] flex-col justify-end px-5 pb-3 lg:max-w-[760px]"
          onClick={(e) => e.target === e.currentTarget && setOuvert(null)}
        >
          {empeche && (
            <p className="glass my-auto flex items-start gap-1.5 rounded-3xl p-4 text-[13.5px] leading-snug text-foreground/70">
              <AlertTriangle className="mt-[2px] size-3.5 shrink-0" />
              {empeche}
            </p>
          )}
          {erreur && !empeche && (
            <p className="mb-auto flex items-start gap-1.5 rounded-2xl border border-contraste/10 px-3.5 py-3 text-[13px] leading-snug text-foreground/70">
              <AlertTriangle className="mt-[2px] size-3.5 shrink-0" />
              {erreur}
            </p>
          )}
          {/* La tête du fil (les cartes du match) arrive avec les messages :
              posée seule, elle sautait en haut quand ils arrivaient. */}
          {!empeche && prete && tete}
          {!empeche && prete && lignes.length === 0 && !erreur && vide && (
            <p className="my-auto text-center text-[15px] font-semibold text-foreground/35">{vide}</p>
          )}
          {lignes.map(({ cle, m, attente }, i) => {
            if (m.piece?.type === "rejoint") return <LigneArrivee key={cle} m={m} />;
            const avant = lignes[i - 1]?.m;
            const suite = !!avant && avant.piece?.type !== "rejoint" && avant.auteurId === m.auteurId && m.at - avant.at < 5 * 60_000;
            return (
              <Bulle
                key={cle}
                m={m}
                cite={m.reponseA ? parId.get(m.reponseA) : undefined}
                surligne={surligne === m.id}
                suite={suite}
                ouvert={ouvert === m.id}
                moi={moi}
                admin={admin}
                attente={attente}
                actions={actions}
                onOuvrirJournee={onOuvrirJournee}
              />
            );
          })}
        </div>
      </div>

      {/* La barre d'écriture : au-dessus des onglets, ou du clavier. */}
      {!empeche && (
        <div className="mx-auto w-full max-w-[640px] shrink-0 px-3 pt-2 lg:max-w-[760px]" style={{ paddingBottom: "var(--pied-ecriture)" }}>
          {choix && (
            <ChoixPiece
              onFermer={() => setChoix(false)}
              onPhoto={() => choixPhoto.current?.click()}
              onChoix={(p) => {
                setPiece(p);
                setChoix(false);
                champ.current?.focus();
              }}
            />
          )}

          {suggestions.length > 0 && (
            <div className="mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  // Garder le clavier ouvert : le champ ne perd pas la main.
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setTexte((t) => t.replace(/@([\p{L}0-9_.-]*)$/u, `@${p.pseudo} `));
                    champ.current?.focus();
                  }}
                  className="bouton-secondaire bouton--mauve flex shrink-0 items-center gap-2 py-1 pr-3.5 pl-1"
                >
                  <CarteDe name={p.name} size={FORMAT_CARTE.petite * 0.62} inerte />
                  <span className="text-[13px] font-semibold">@{p.pseudo}</span>
                </button>
              ))}
            </div>
          )}

          {reponse && (
            <div className="glass mb-2 flex items-center gap-2 rounded-3xl py-2 pr-2 pl-3.5">
              <Reply className="size-4 shrink-0 text-foreground/50" />
              <div className="min-w-0 flex-1 border-l-[3px] border-foreground/45 pl-2.5">
                <span className="block text-[11.5px] font-bold text-foreground/65">
                  {reponse.mien ? "Toi" : reponse.auteur ? <Nom n={reponse.auteur} /> : "Quelqu'un"}
                </span>
                <span className="block truncate text-[13px] text-foreground/55">{apercu(reponse)}</span>
              </div>
              <button type="button" onClick={() => setReponse(null)} aria-label="Ne plus répondre" className="bouton-secondaire flex size-7 shrink-0 items-center justify-center">
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {(piece?.type === "photo" || piece?.type === "video") && (
            <div className="glass mb-2 flex items-start gap-2 rounded-3xl p-2">
              {piece.type === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element -- aperçu local
                <img src={piece.chemin} alt="" className="h-24 max-w-[60%] rounded-[16px] object-cover" />
              ) : (
                <span className="relative h-24 max-w-[60%] overflow-hidden rounded-[16px]">
                  <video src={`${piece.chemin}#t=0.1`} muted playsInline preload="metadata" className="h-full object-cover" />
                  <span className="absolute right-1.5 bottom-1.5 rounded-full bg-black/55 px-1.5 text-[11px] font-bold text-white tabular-nums">
                    {minutes(piece.duree)}
                  </span>
                </span>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => {
                  oublierPhoto();
                  setPiece(null);
                }}
                aria-label="Retirer"
                className="bouton-secondaire flex size-7 shrink-0 items-center justify-center"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {piece && piece.type !== "photo" && piece.type !== "video" && (
            <div className="attente-ecriture glass mb-2 flex max-h-[38dvh] items-start gap-2 overflow-y-auto rounded-3xl">
              <div className="min-w-0 flex-1">
                <PieceVue piece={piece} />
              </div>
              <button type="button" onClick={() => setPiece(null)} aria-label="Retirer la pièce" className="bouton-secondaire m-2 flex size-7 shrink-0 items-center justify-center">
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {sourdine ? (
            <p className="glass rounded-full px-4 py-3 text-center text-[13.5px] font-semibold text-foreground/55">
              Parole coupée jusqu&apos;à {quand(sourdine)}
            </p>
          ) : micro.secondes !== null ? (
            // L'enregistrement en cours : annuler, la durée, envoyer.
            <div className="glass flex items-center gap-1.5 rounded-[26px] p-1.5">
              <button
                type="button"
                onClick={micro.annuler}
                aria-label="Annuler le vocal"
                className="bouton-secondaire bouton--rouge flex size-10 shrink-0 items-center justify-center"
              >
                <X className="size-5" />
              </button>
              <span className="flex min-w-0 flex-1 items-center gap-2.5 px-2">
                <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-foreground motion-reduce:animate-none" />
                <span className="text-[16px] font-semibold tabular-nums">{minutes(micro.secondes)}</span>
                <span className="text-[13px] font-medium text-foreground/35 tabular-nums">/ {minutes(VOCAL_MAX_S)}</span>
              </span>
              <button
                type="button"
                onClick={() => void envoyerVocal()}
                aria-label="Envoyer le vocal"
                className="bouton-principal bouton--mauve flex size-10 shrink-0 items-center justify-center"
              >
                <ArrowUp className="size-5" strokeWidth={2.75} />
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void envoyer();
              }}
              className="glass flex items-end gap-1.5 rounded-[26px] p-1.5"
            >
              <button
                type="button"
                onClick={() => setChoix((v) => !v)}
                aria-label="Partager une carte, une feuille, un classement"
                aria-expanded={choix}
                className={cn("bouton--mauve flex size-10 shrink-0 items-center justify-center", choix ? "bouton-principal" : "bouton-secondaire")}
              >
                <Plus className="size-5" strokeWidth={2.5} />
              </button>
              <textarea
                ref={champ}
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                onKeyDown={(e) => {
                  // Entrée envoie sur ordinateur ; au téléphone, elle va à la ligne.
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !tactile()) {
                    e.preventDefault();
                    void envoyer();
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder="Message"
                className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-[9px] text-[16px] leading-snug outline-none placeholder:text-foreground/30 [field-sizing:content]"
              />
              <input
                ref={choixPhoto}
                type="file"
                accept="image/*,video/*"
                hidden
                onChange={(e) => {
                  void choisirPhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {/* Champ vide : l'appareil photo et le micro, comme dans WhatsApp. */}
              {!texte.trim() && !piece && (
                <button
                  type="button"
                  onClick={() => choixPhoto.current?.click()}
                  disabled={envoi}
                  aria-label="Envoyer une photo ou une vidéo"
                  className="bouton-discret bouton--mauve flex size-10 shrink-0 items-center justify-center disabled:opacity-25"
                >
                  <Camera className="size-5" strokeWidth={2.25} />
                </button>
              )}
              {peutVocal && !texte.trim() && !piece ? (
                <button
                  type="button"
                  onClick={() => void micro.commencer()}
                  disabled={envoi}
                  aria-label="Enregistrer un vocal"
                  className="bouton-secondaire bouton--mauve flex size-10 shrink-0 items-center justify-center disabled:opacity-25"
                >
                  <Mic className="size-5" strokeWidth={2.25} />
                </button>
              ) : (
                <button
                  type="submit"
                  // Envoyer sans fermer le clavier, comme dans Messages.
                  onPointerDown={(e) => e.preventDefault()}
                  disabled={envoi || (!texte.trim() && !piece)}
                  aria-label="Envoyer"
                  className="bouton-principal bouton--mauve flex size-10 shrink-0 items-center justify-center disabled:opacity-25"
                >
                  <ArrowUp className="size-5" strokeWidth={2.75} />
                </button>
              )}
            </form>
          )}
        </div>
      )}
    </section>
  );
}


/* ---------------------------------- Démo -------------------------------- */

// Hors production (?demo=vestiaire) : un fil d'essai avec les vrais
// noms de la saison, pour juger le rendu sans écrire en base.
function messagesDemo(noms: string[], journees: Journee[]): MessageV[] {
  const n = (i: number) => noms[i % Math.max(1, noms.length)] ?? "Ilyes";
  const t0 = Date.now() - 50 * 60_000;
  const jn = [...journees].reverse().find((j) => (j.matches?.length ?? 0) > 0);
  const lignes: [string, string, Piece | null, Partial<Record<Emoji, string[]>>, number | null][] = [
    [n(3), "Qui a vu le retourné de dimanche ? Je l'attends encore au ralenti", null, { "😂": ["a", "b"] }, null],
    [n(0), "Personne parce que c'était un centre raté 😭", null, { "💀": ["a", "b", "c"] }, 1],
    [n(0), "", jn ? { type: "feuille", j: jn.j } : null, {}, null],
    [n(5), "Regarde le classement avant de parler", { type: "classement", id: "buts", top: [{ n: n(0), v: 20 }, { n: n(1), v: 14 }, { n: n(5), v: 10 }] }, { "🐐": ["a"] }, null],
    ["moi", "@" + n(5).toLowerCase() + " ta carte elle sort du pack de Noël", { type: "carte", joueur: n(1) }, { "🔥": ["a", "b"], "🤡": ["c"] }, null],
    [n(3), "", { type: "vocal", chemin: "blob:demo", duree: 14.2 }, { "😂": ["a"] }, null],
    [n(4), "Tu le crois ça ?", { type: "ligue", titre: "L'équipe type", j: jn?.j, lignes: [0, 1, 2, 3, 4].map((k) => ({ n: n(k), v: `+${30 - k * 4} pts` })) }, { "🔥": ["a", "b"] }, null],
    [n(0), "", { type: "ligue", titre: "L'homme du dimanche", j: jn?.j, lignes: [{ n: n(0), v: "3 buts · 1 passe · +42 pts" }] }, { "🐐": ["a", "b", "c"] }, null],
    [n(1), "La preuve", { type: "photo", chemin: "/avatars/maillot-noir.png", l: 460, h: 480 }, { "💀": ["a", "b"] }, null],
    [n(2), "", { type: "video", chemin: "/videos/j8-bensou.webm", l: 1280, h: 720, duree: 17.2 }, { "🔥": ["a", "b", "c"] }, null],
    ["moi", "Dimanche on règle ça sur le terrain", null, {}, 6],
  ];
  return lignes.map(([auteur, texte, piece, reactions, reponseA], i) => ({
    id: i + 1,
    auteurId: auteur,
    auteur: auteur === "moi" ? "" : auteur,
    texte,
    piece,
    at: t0 + i * 7 * 60_000,
    mien: auteur === "moi",
    reponseA,
    reactions,
  }));
}
