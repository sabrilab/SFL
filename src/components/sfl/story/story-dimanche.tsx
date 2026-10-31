"use client";

// La fenêtre de la story de ton dimanche (lib/sfl/story-dimanche.ts) : elle
// s'ouvre sur la vidéo en train de se faire, sous tes yeux, puis la rejoue en
// boucle. « Partager » ouvre la feuille de partage du téléphone (Snap,
// Instagram…) avec la vidéo seule, sans titre ni texte : sur iPhone, un texte
// joint passe avant le fichier et Snap s'y perd (feuille-de-match.tsx).
//
// La vidéo s'enregistre dès l'ouverture, pas au toucher : Safari refuse
// d'ouvrir le partage si le geste a attendu les six secondes de
// l'enregistrement. Un téléphone qui ne sait pas enregistrer de vidéo
// partage l'image de la fin, la même story sans mouvement.
//
// Ta carte vient de la capture de la carte 3D (Card3D, ses trois calques) :
// la même que dans Ma carte, finition comprise.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Share, X } from "lucide-react";
import { toast } from "sonner";
import { Card3D, type CapturedLayers } from "@/components/sfl/card-3d";
import { PlayerCard } from "@/components/sfl/player-card";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { findPlayerMatch, ovr, type Player } from "@/lib/sfl/engine";
import { nomDuTerrain } from "@/lib/sfl/matchs-du-jour";
import { rangPepiteApres } from "@/lib/sfl/rangs";
import { terrainDeJournee } from "@/lib/sfl/saisie/mutations";
import {
  dessinerStory,
  enregistrerStory,
  scoreDuJoueur,
  STORY,
  type CalquesStory,
  type PolicesStory,
  type StoryDimanche,
} from "@/lib/sfl/story-dimanche";

function charger(src: string): Promise<HTMLImageElement | null> {
  return new Promise((fin) => {
    const img = new Image();
    img.onload = () => fin(img);
    img.onerror = () => fin(null);
    img.src = src;
  });
}

/** Les familles d'Inter et d'Anton telles que Next les a nommées (layout.tsx). */
function polices(): PolicesStory {
  const style = getComputedStyle(document.documentElement);
  const fam = (v: string, repli: string) => `${style.getPropertyValue(v).trim() || repli}, ${repli}, sans-serif`;
  return { texte: fam("--font-inter", "Inter"), chiffres: fam("--font-anton", "Anton") };
}

/** Reçoit les calques de la carte dès qu'ils sont photographiés. */
function Recevoir({ calques, onPrets }: { calques: CapturedLayers; onPrets: (c: CapturedLayers) => void }) {
  useEffect(() => onPrets(calques), [calques, onPrets]);
  return null;
}

type Etat = { quoi: "carte" } | { quoi: "film"; avance: number } | { quoi: "pret"; fichier: File; video: boolean };

export function StoryDimancheFenetre({ player, donnees, onFermer }: { player: Player; donnees: StoryDimanche; onFermer: () => void }) {
  const toile = useRef<HTMLCanvasElement>(null);
  const [calques, setCalques] = useState<CapturedLayers | null>(null);
  const [etat, setEtat] = useState<Etat>({ quoi: "carte" });
  const [url, setUrl] = useState<string | null>(null);

  // Une seule vidéo par ouverture : la carte peut se rephotographier (un badge
  // arrivé en retard), on garde la première photo.
  const lance = useRef(false);
  const fermerRef = useRef(onFermer);
  useEffect(() => {
    fermerRef.current = onFermer;
  }, [onFermer]);

  // Si la carte ne s'est pas photographiée en 25 secondes, on le dit et on ferme.
  useEffect(() => {
    if (calques) return;
    const garde = setTimeout(() => {
      toast.error("Ta story n'a pas pu se faire. Réessaie dans un instant.");
      fermerRef.current();
    }, 25_000);
    return () => clearTimeout(garde);
  }, [calques]);

  useEffect(() => {
    if (!calques || lance.current) return;
    lance.current = true;
    (async () => {
      const [fond, joueur, stats, logo, symbole, colonne, dos] = await Promise.all([
        charger(calques.background),
        charger(calques.playerLayer),
        charger(calques.stats),
        charger("/bola/logo-noir.svg"),
        charger("/bola/symbole-noir.svg"),
        charger("/story/colonne.png"),
        calques.dos ? charger(calques.dos) : Promise.resolve(null),
      ]);
      const canvas = toile.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !fond || !joueur || !stats) {
        toast.error("Ta story n'a pas pu se faire. Réessaie dans un instant.");
        fermerRef.current();
        return;
      }
      const p = polices();
      // Les polices, sans attendre plus de deux secondes.
      await Promise.race([
        Promise.all([document.fonts.load(`900 104px ${p.texte}`), document.fonts.load(`400 128px ${p.chiffres}`)]).catch(() => {}),
        new Promise((ok) => setTimeout(ok, 2000)),
      ]);
      const c: CalquesStory = { fond, joueur, stats, logo, dos, symbole, colonne, ratio: calques.height / calques.width };
      const dessiner = (t: number) => dessinerStory(ctx, t, donnees, c, p);
      setEtat({ quoi: "film", avance: 0 });
      const blob = await enregistrerStory(canvas, dessiner, (avance) => setEtat({ quoi: "film", avance }));
      dessiner(STORY.duree + 1);
      if (blob) {
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        setUrl(URL.createObjectURL(blob));
        setEtat({ quoi: "pret", video: true, fichier: new File([blob], `mon-dimanche-j${donnees.j}-bola.${ext}`, { type: blob.type }) });
        return;
      }
      // Pas d'enregistrement possible : l'image de la fin.
      const png = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
      if (!png) return;
      setEtat({ quoi: "pret", video: false, fichier: new File([png], `mon-dimanche-j${donnees.j}-bola.png`, { type: "image/png" }) });
    })();
  }, [calques, donnees]);

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  // Échap ferme ; la page dessous ne défile pas.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [onFermer]);

  async function partager() {
    if (etat.quoi !== "pret") return;
    const donneesPartage = { files: [etat.fichier] };
    if (typeof navigator.canShare === "function" && navigator.canShare(donneesPartage)) {
      try {
        await navigator.share(donneesPartage);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") toast.error("Le partage n'a pas pu s'ouvrir.");
      }
      return;
    }
    // Sans feuille de partage (ordinateur) : le fichier se télécharge.
    const lien = URL.createObjectURL(etat.fichier);
    const a = document.createElement("a");
    a.href = lien;
    a.download = etat.fichier.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(lien), 1000);
  }

  const avance = etat.quoi === "film" ? etat.avance : etat.quoi === "pret" ? 1 : 0;

  return createPortal(
    <div role="dialog" aria-modal aria-label="Ton dimanche en story" className="dark fixed inset-0 z-[1500] flex flex-col bg-black text-white">
      <div className="flex shrink-0 justify-end px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <button type="button" onClick={onFermer} aria-label="Fermer" className="bouton-givre grid size-10 place-items-center">
          <X className="size-4" strokeWidth={2.4} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-3">
        <div className="relative h-full max-h-full overflow-hidden rounded-[18px] bg-black" style={{ aspectRatio: "9 / 16" }}>
          <canvas
            ref={toile}
            width={STORY.largeur}
            height={STORY.hauteur}
            className="absolute inset-0 size-full"
          />
          {/* La vidéo par-dessus ; si le navigateur ne sait pas la lire, l'image de fin reste dessous. */}
          {url && <video src={url} autoPlay loop muted playsInline className="absolute inset-0 size-full object-cover" />}
          {etat.quoi === "carte" && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="size-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            </div>
          )}
          {/* La barre qui se remplit pendant l'enregistrement, en bas de la story. */}
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
            <span className="block h-full bg-white transition-[width] duration-150" style={{ width: `${avance * 100}%`, opacity: etat.quoi === "pret" ? 0 : 1 }} />
          </span>
        </div>

        {/* La carte à photographier : la 3D n'est jamais montrée, seuls ses calques servent. */}
        <div aria-hidden className="pointer-events-none absolute top-0 left-0 size-px overflow-hidden opacity-0">
          <div className="relative size-[300px]">
            <Card3D
              cacheKey={`story-${player.name}`}
              render={(s) => <PlayerCard player={player} size={s} />}
              definition={2}
              scene={(c) => <Recevoir calques={c} onPrets={setCalques} />}
            />
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={partager}
          disabled={etat.quoi !== "pret"}
          className="bouton-principal bouton--mauve flex h-12 w-full items-center justify-center gap-2 text-[15px] font-semibold disabled:opacity-40"
        >
          <Share className="size-[18px]" />
          {etat.quoi === "pret" && !etat.video ? "Partager l'image" : "Partager"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Le bouton « Story » de la rubrique Ton dimanche (actus/pelouse.tsx) : il
 * rassemble les chiffres du dimanche et ouvre la fenêtre.
 */
export function BoutonStoryDimanche({ j, date, buts, passes, points, delta }: { j: number; date: string; buts: number; passes: number; points: number; delta: number }) {
  const { player, me } = useMyPlayer();
  const { saison, journees, evolution } = useSeason();
  // Les chiffres sont figés au toucher : une mise à jour de la saison en
  // direct ne doit pas relancer la vidéo en train de se faire.
  const [donnees, setDonnees] = useState<StoryDimanche | null>(null);
  function ouvrir() {
    if (!me) return;
    const journee = journees.find((x) => x.j === j);
    const meta = saison.journees.find((x) => x.j === j);
    const match = journee ? findPlayerMatch(journee, me)?.match : undefined;
    // Le lieu du match s'il a le sien, sinon celui de la journée (matchs-du-jour.ts).
    const lieu =
      (match?.lieuId != null ? saison.terrains?.find((t) => t.id === match.lieuId) : undefined) ??
      (meta ? terrainDeJournee(saison, meta) : null);
    const score = scoreDuJoueur(journee, me);
    setDonnees({
      j,
      date,
      lieu: lieu?.nom ?? null,
      commune: lieu?.commune ?? null,
      terrain: nomDuTerrain(match?.terrain),
      heure: match?.heure?.trim() || meta?.heure || null,
      camp: score?.camp ?? null,
      pour: score?.pour ?? null,
      contre: score?.contre ?? null,
      buts,
      passes,
      points,
      delta,
      rang: rangPepiteApres(saison, me, j, evolution),
      note: player ? ovr(player.stats) : null,
    });
  }
  if (!player) return null;
  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-foreground/75 transition-transform active:scale-95 dark:text-white/75"
      >
        <Share className="size-[16px]" strokeWidth={2} />
        Story
      </button>
      {donnees && <StoryDimancheFenetre player={player} donnees={donnees} onFermer={() => setDonnees(null)} />}
    </>
  );
}
