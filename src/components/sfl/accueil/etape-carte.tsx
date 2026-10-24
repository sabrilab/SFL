"use client";

// La carte, à l'accueil (accueil.tsx) : la carte officielle, puis sa
// révélation.
//
// Sabri, 24/10 : « y compris la carte, parce que la carte, là, elle est faite
// uniquement quand le joueur se rend dans l'onglet Ma carte ». Le parcours
// est celui de Ma carte (carte-officielle.tsx : le studio, le recadrage, la
// photo qui part sur la carte chez tout le monde). L'écran avance seul dès
// que la photo est posée. Le studio demande la caméra, et l'IA trois photos
// par jour au plus : après un premier essai sans photo, « Plus tard » laisse
// passer, et l'invitation de l'ouverture la reproposera (invitation-carte.tsx).
//
// La révélation couronne la partie obligatoire : la carte arrive de dos, on
// la touche, elle se retourne avec le son des cartes (lib/sfl/son.ts), son
// nom, son pseudo et sa photo dessus.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card3D, REMPLISSAGE_3D } from "@/components/sfl/card-3d";
import { FluxCarteOfficielle } from "@/components/sfl/carte-officielle";
import { mettreEnPause } from "@/components/sfl/invitation-carte";
import { PlayerCard } from "@/components/sfl/player-card";
import { usePhotoPerso } from "@/hooks/use-player-photo";
import { sonRevelation } from "@/lib/sfl/son";
import type { Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";
import { BoutonDiscret, BoutonPrincipal, Corps, Ligne, Titre, useContexteAccueil } from "./cadre";
import { CarteDeDos } from "./etapes-compte";

const TEMPS = ["Ton visage", "Le maillot", "La photo"];

export function EtapeCarte({ player, onFini }: { player: Player; onFini: () => void }) {
  const { demo } = useContexteAccueil();
  const reduit = useReducedMotion();
  const photo = usePhotoPerso(player.name);
  const [studio, setStudio] = useState(false);
  /** Le studio a été ouvert puis refermé sans photo : on peut remettre à plus tard. */
  const [essaye, setEssaye] = useState(false);
  const [simule, setSimule] = useState(false);
  const fini = useRef(false);

  function avancer() {
    if (fini.current) return;
    fini.current = true;
    onFini();
  }

  // La photo est posée (le recadrage validé) : la révélation suit. L'aperçu
  // montre l'écran même à qui a déjà sa photo.
  useEffect(() => {
    if (photo && !demo) avancer();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avancer ne change pas d'un rendu à l'autre
  }, [photo]);

  function ouvrir() {
    navigator.vibrate?.(10);
    if (demo) {
      // L'aperçu ne fait aucune photo : le studio coûte, et la carte est celle de tout le monde.
      setSimule(true);
      toast("Aperçu : le studio de la carte s'ouvre ici.", { description: "Rien n'est envoyé." });
      window.setTimeout(avancer, 900);
      return;
    }
    setStudio(true);
  }

  function plusTard() {
    mettreEnPause("carte", player.name);
    avancer();
  }

  return (
    <>
      <Corps
        pied={
          <>
            <BoutonPrincipal ton="or" onClick={ouvrir} disabled={simule}>
              {simule ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Créer ma carte officielle
            </BoutonPrincipal>
            <AnimatePresence initial={false}>
              {essaye && (
                <motion.div
                  initial={reduit ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <BoutonDiscret onClick={plusTard}>Plus tard</BoutonDiscret>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        }
      >
        <div className="relative">
          {/* La lumière du studio, derrière la carte. */}
          <motion.div
            aria-hidden
            className="absolute top-1/2 left-1/2 -z-10 size-[150%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            animate={reduit ? undefined : { opacity: [0.5, 0.85, 0.5], scale: [0.96, 1.04, 0.96] }}
            transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
            style={{ background: "radial-gradient(circle, rgba(244,197,66,0.26) 0%, rgba(244,197,66,0) 62%)" }}
          />
          <motion.div
            initial={reduit ? false : { scale: 0.8, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
          >
            <PlayerCard player={player} size={0.7} />
          </motion.div>
        </div>
        <div className="mt-[34px] flex flex-col items-center">
          <Titre>Ta carte officielle.</Titre>
          <Ligne>Ton visage, le maillot Bola, une vraie photo de studio. Elle apparaît sur ta carte, chez tout le monde.</Ligne>
        </div>
        <ol className="mt-[21px] flex items-center gap-[8px]">
          {TEMPS.map((t, i) => (
            <li key={t} className="flex items-center gap-[8px]">
              {i > 0 && <span aria-hidden className="h-px w-[13px] bg-white/20" />}
              <span className="mono-label text-white/45">{t}</span>
            </li>
          ))}
        </ol>
      </Corps>

      {!demo && (
        <FluxCarteOfficielle
          player={player}
          ouvert={studio}
          onFermer={() => {
            setStudio(false);
            setEssaye(true);
          }}
        />
      )}
    </>
  );
}

/** La carte révélée : sa largeur à l'écran, de dos comme de face. */
const LARGEUR_REVELEE = 210;
/** La 3D n'occupe qu'une part de son cadre : la taille qui la pose à LARGEUR_REVELEE. */
const TAILLE_3D = LARGEUR_REVELEE / (254 * REMPLISSAGE_3D);
/** Ce que le cadre de la 3D déborde de la carte, de chaque côté. */
const DEBORD_X = (254 * TAILLE_3D * (1 - REMPLISSAGE_3D)) / 2;
const DEBORD_Y = (254 * (1656 / 1024) * TAILLE_3D * (1 - REMPLISSAGE_3D)) / 2;

export function EtapeRevelation({ player, prenom, onFini }: { player: Player; prenom: string; onFini: () => void }) {
  const reduit = useReducedMotion();
  const [face, setFace] = useState(false);

  function retourner() {
    if (face) return;
    // Le geste débloque l'audio : la règle des navigateurs.
    sonRevelation("rare");
    navigator.vibrate?.([12, 60, 24]);
    setFace(true);
  }

  return (
    <Corps
      pied={
        <div className={cn("w-full transition-opacity duration-300", face ? "opacity-100 delay-500" : "pointer-events-none opacity-0")}>
          <BoutonPrincipal onClick={onFini} disabled={!face}>
            Continuer
          </BoutonPrincipal>
        </div>
      }
    >
      <motion.span initial={false} animate={{ opacity: face ? 0 : 1 }} className="mono-label text-white/45">
        Ta carte est prête
      </motion.span>
      <div className="relative mt-[21px] grid place-items-center">
        {/* Le halo de la révélation : un éclair, puis la lumière qui respire. */}
        <AnimatePresence>
          {face && (
            <motion.div
              key="halo"
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[170%] -translate-x-1/2 -translate-y-1/2 rounded-full"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={reduit ? { opacity: 0.8, scale: 1 } : { opacity: [0, 1, 0.6, 0.95, 0.6], scale: [0.5, 1.25, 1, 1.1, 1] }}
              transition={
                reduit
                  ? { duration: 0.3 }
                  : { delay: 0.25, duration: 3.2, times: [0, 0.14, 0.45, 0.72, 1], repeat: Infinity, repeatType: "mirror" }
              }
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 62%)" }}
            />
          )}
        </AnimatePresence>
        {/* La face, prête dessous (elle se photographie pendant qu'on regarde le dos), entre de profil. */}
        <motion.div
          aria-hidden={!face}
          className={cn("[grid-area:1/1]", !face && "pointer-events-none")}
          initial={false}
          animate={face ? (reduit ? { opacity: 1 } : { rotateY: [-90, 0], opacity: 1 }) : { rotateY: 0, opacity: 0 }}
          transition={
            !face
              ? { duration: 0 }
              : reduit
                ? { duration: 0.3 }
                : { rotateY: { delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }, opacity: { delay: 0.2, duration: 0 } }
          }
          style={{ transformPerspective: 900 }}
        >
          <div style={{ margin: `${-DEBORD_Y}px ${-DEBORD_X}px` }}>
            <Card3D
              cacheKey={`accueil-face-${player.name}`}
              mode="simple"
              size={TAILLE_3D}
              apercu
              render={(s) => <PlayerCard player={player} size={s} />}
            />
          </div>
        </motion.div>
        {/* Le dos, par-dessus : un toucher, il tourne d'un quart, la face finit le tour. */}
        <motion.button
          type="button"
          onClick={retourner}
          disabled={face}
          aria-label="Retourner ta carte"
          className={cn("[grid-area:1/1] outline-none", face && "pointer-events-none")}
          initial={false}
          animate={face ? (reduit ? { opacity: 0 } : { rotateY: 90, opacity: 0 }) : { rotateY: 0, opacity: 1 }}
          transition={reduit ? { duration: 0.3 } : { rotateY: { duration: 0.2, ease: "easeIn" }, opacity: { delay: 0.2, duration: 0 } }}
          style={{ transformPerspective: 900 }}
        >
          <CarteDeDos player={player} size={LARGEUR_REVELEE / 254} />
        </motion.button>
      </div>
      <div className="mt-[21px] grid min-h-[110px] w-full justify-items-center">
        <AnimatePresence initial={false}>
          {face ? (
            <motion.div
              key="titre"
              className="flex flex-col items-center [grid-area:1/1]"
              initial={reduit ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduit ? 0.1 : 0.5, duration: 0.35 }}
            >
              <Titre>{prenom ? `C'est toi, ${prenom}.` : "C'est toi."}</Titre>
              <Ligne>Elle bouge après chaque dimanche : ta note, tes stats, tes badges.</Ligne>
            </motion.div>
          ) : (
            <motion.span
              key="touche"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className="animate-pulse text-[14px] font-semibold text-white/80 [grid-area:1/1]"
            >
              Touche pour la retourner
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </Corps>
  );
}
