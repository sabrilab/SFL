"use client";

// Créer la couverture de la page de son équipe (Sabri, 24/10 : « une
// couverture faite justement en IA aussi, avec les joueurs présents de cette
// équipe, leur maillot et leur blason »). Le capitaine et le vice seulement,
// depuis la page de l'équipe (/bola-team/[id]).
//
// En haut, le cadre de la couverture : celle d'aujourd'hui, puis celle qui
// vient d'être créée. Dessous, ce qui part au studio : les cartes des joueurs
// qui seront sur l'image (ceux qui ont signé le Règlement Team version 2,
// qui le prévoit, et qui ont une photo de carte), le maillot et l'écusson,
// peints ici en grand hors de l'écran puis photographiés (html-to-image).
// Ceux qui manquent sont nommés, avec la raison. « Créer la couverture »
// (30 à 60 s), puis « Poser » (bucket « couvertures ») ou « Refaire ».
// Deux par jour et par équipe, remises à minuit, heure de Paris : le crédit
// fal de Sabri (/api/equipes/couverture). « Retirer la couverture » revient
// à la couverture dessinée.

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { CouvertureEquipe } from "@/components/sfl/equipe/couverture";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { Maillot } from "@/components/sfl/equipe/maillot";
import { usePhotoRevision } from "@/hooks/use-player-photo";
import { photoPerso } from "@/lib/sfl/photos";
import {
  VERSION_REGLEMENT,
  creerCouverture,
  direErreurEquipe,
  poserCouverture,
  retirerCouverture,
  signataires,
  type Equipe,
} from "@/lib/sfl/equipes";

/** Recopiée de la route (et de la base) : les changer ensemble. */
const COUVERTURES_JOUR = 2;
const prenom = (nom: string) => nom.split(" ")[0];
/** Le fond gris clair des deux références, comme un studio. */
const FOND_STUDIO = "#ECECEA";

async function enPng(n: HTMLElement | null): Promise<string> {
  if (!n) throw new Error("Rien à photographier.");
  return toPng(n, { pixelRatio: 1, backgroundColor: FOND_STUDIO });
}

export function FicheCouverture({
  equipe,
  open,
  onOpenChange,
  apercu,
  onPosee,
}: {
  equipe: Equipe | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  apercu?: boolean;
  onPosee: () => void;
}) {
  const refMaillot = useRef<HTMLDivElement>(null);
  const refEcusson = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [restantes, setRestantes] = useState<number | null>(null);
  usePhotoRevision();

  const joueurs = equipe ? signataires(equipe) : [];
  const raison = (m: (typeof joueurs)[number]) =>
    m.reglement !== VERSION_REGLEMENT ? "règlement v2 à signer" : !photoPerso(m.name) ? "sans photo de carte" : null;
  const surLaPhoto = joueurs.filter((m) => !raison(m)).slice(0, 7);
  const absents = joueurs.filter((m) => raison(m));
  const plusDeCredit = restantes === 0;

  const fermer = (o: boolean) => {
    if (!o && enCours) return;
    if (!o) setImage(null);
    onOpenChange(o);
  };

  async function creer() {
    if (!equipe) return;
    if (apercu) {
      toast("Aperçu : rien n'est créé.");
      return;
    }
    setEnCours(true);
    try {
      const [maillot, ecusson] = await Promise.all([enPng(refMaillot.current), enPng(refEcusson.current)]);
      const r = await creerCouverture(equipe.id, maillot, ecusson);
      if (typeof r.restantes === "number") setRestantes(r.restantes);
      if (r.image) {
        setImage(r.image);
        navigator.vibrate?.([10, 40, 18]);
      } else toast.error(r.error ?? "La couverture n'a pas pu être faite. Réessaie.");
    } catch {
      toast.error("La couverture n'a pas pu être faite. Réessaie.");
    } finally {
      setEnCours(false);
    }
  }

  async function poser() {
    if (!equipe || !image) return;
    setEnvoi(true);
    try {
      await poserCouverture(equipe.id, image);
      toast.success("Couverture posée.");
      setImage(null);
      onOpenChange(false);
      onPosee();
    } catch (e) {
      toast.error(direErreurEquipe(e));
    } finally {
      setEnvoi(false);
    }
  }

  async function retirer() {
    if (!equipe) return;
    if (apercu) {
      toast("Aperçu : rien n'est enregistré.");
      return;
    }
    setEnvoi(true);
    try {
      await retirerCouverture(equipe.id);
      toast.success("Couverture retirée.");
      onOpenChange(false);
      onPosee();
    } catch (e) {
      toast.error(direErreurEquipe(e));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Sheet open={open && !!equipe} onOpenChange={fermer}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        {equipe && (
          <>
            <SheetHeader className="px-5 pt-5 pb-0">
              <SheetTitle className="pr-10 text-titre-g font-bold tracking-tight">Couverture</SheetTitle>
            </SheetHeader>
            <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-4">
              <div className="relative aspect-[16/9] overflow-hidden rounded-[22px] bg-card">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- l'image tout juste créée (data URL)
                  <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <CouvertureEquipe equipe={equipe} className="absolute inset-0" />
                )}
                {enCours && (
                  <div className="absolute inset-0 grid place-items-center bg-black/50 text-white backdrop-blur-[2px]">
                    <span className="flex flex-col items-center gap-2">
                      <Loader2 className="size-7 animate-spin" strokeWidth={2.2} />
                      <span className="mono-label text-white/70">30 à 60 s</span>
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span className="mono-label text-muted-foreground">Sur la photo</span>
                <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {surLaPhoto.map((m) => (
                    <CarteDe key={m.id} name={m.name} size={FORMAT_CARTE.petite} inerte />
                  ))}
                  {surLaPhoto.length > 0 && <span className="px-1 text-titre-fort font-light text-muted-foreground">+</span>}
                  <span className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-card">
                    <Maillot initiales={equipe.initiales} fond={equipe.fond} blason={equipe.blason} taille={44} />
                  </span>
                  <span className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-card">
                    <Ecusson initiales={equipe.initiales} fond={equipe.fond} blason={equipe.blason} taille={36} />
                  </span>
                </div>
                {absents.length > 0 && (
                  <p className="text-corps leading-snug text-muted-foreground">
                    {absents.map((m) => `${prenom(m.name)} (${raison(m)})`).join(", ")}
                  </p>
                )}
              </div>

              {image ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    disabled={enCours || envoi || plusDeCredit}
                    onClick={creer}
                    className="h-12 gap-2 rounded-full text-lecture font-semibold"
                  >
                    <RotateCcw className="size-4" strokeWidth={2.4} />
                    Refaire
                  </Button>
                  <Button variant="vert" disabled={enCours || envoi} onClick={poser} className="h-12 rounded-full text-lecture font-semibold">
                    Poser
                  </Button>
                </div>
              ) : (
                <Button
                  variant="vert"
                  disabled={enCours || envoi || surLaPhoto.length < 2 || plusDeCredit}
                  onClick={creer}
                  className="h-12 rounded-full text-lecture font-semibold"
                >
                  Créer la couverture
                </Button>
              )}
              <p className="mono-label -mt-2 text-center text-muted-foreground">
                {restantes == null
                  ? `${COUVERTURES_JOUR} par jour`
                  : restantes > 0
                    ? `Encore ${restantes} aujourd'hui`
                    : "De nouveau demain"}
              </p>

              {equipe.couvertureLe && !image && (
                <button
                  type="button"
                  disabled={envoi || enCours}
                  onClick={retirer}
                  className="bouton-discret bouton--rouge self-center px-4 py-2 text-corps font-semibold disabled:opacity-50"
                >
                  Retirer la couverture
                </button>
              )}
            </div>

            {/* Les deux références du studio, peintes en grand hors de l'écran. */}
            <div aria-hidden className="pointer-events-none fixed top-0 -left-[10000px]">
              <div ref={refMaillot} className="grid size-[640px] place-items-center" style={{ background: FOND_STUDIO }}>
                <Maillot initiales={equipe.initiales} fond={equipe.fond} blason={equipe.blason} taille={600} />
              </div>
              <div ref={refEcusson} className="grid size-[640px] place-items-center" style={{ background: FOND_STUDIO }}>
                <Ecusson initiales={equipe.initiales} fond={equipe.fond} blason={equipe.blason} taille={500} />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
