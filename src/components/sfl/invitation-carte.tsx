"use client";

// L'invitation à faire sa carte officielle — à l'ouverture de l'app.
//
// Il n'y a pas de notification sur le téléphone (pas de web push) : c'est
// donc ici qu'on prévient chaque joueur, à sa prochaine ouverture. Tant que
// le joueur connecté n'a pas de photo à lui sur sa carte, l'app se voile,
// sa carte actuelle arrive, et un bouton ouvre directement le parcours de
// la carte officielle (carte-officielle.tsx).
//
// On ne décide qu'après avoir relu la liste des photos de la ligue : un
// cache vide sur un nouvel appareil ne doit pas inviter quelqu'un qui a
// déjà sa photo. « Plus tard » la fait taire deux jours, sur cet appareil.
// Dès qu'une photo est posée, elle ne revient plus.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { Card3D } from "@/components/sfl/card-3d";
import { FluxCarteOfficielle } from "@/components/sfl/carte-officielle";
import { PlayerCard } from "@/components/sfl/player-card";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSession } from "@/hooks/use-session";
import { photoPerso, rafraichirPhotos } from "@/lib/sfl/photos";

const PLUS_TARD = (nom: string) => `sfl-invitation-carte-${nom}`;
/** Silence après « Plus tard ». */
const PAUSE_MS = 2 * 24 * 3600 * 1000;
/** Après le splash, et après la cérémonie des nouvelles cartes si elle passe. */
const DELAI_MS = 2600;

function enPause(nom: string): boolean {
  try {
    const t = Number(localStorage.getItem(PLUS_TARD(nom)) ?? 0);
    return Date.now() - t < PAUSE_MS;
  } catch {
    return false;
  }
}

export function InvitationCarte() {
  const session = useSession();
  const { player } = useMyPlayer();
  const nom = session?.server && session.name === player.name ? player.name : null;

  const [visible, setVisible] = useState(false);
  const [flux, setFlux] = useState(false);

  useEffect(() => {
    if (!nom || enPause(nom)) return;
    let annule = false;
    const timer = setTimeout(() => {
      void rafraichirPhotos().then(() => {
        if (!annule && photoPerso(nom) === null) setVisible(true);
      });
    }, DELAI_MS);
    return () => {
      annule = true;
      clearTimeout(timer);
    };
  }, [nom]);

  if (!nom) return null;

  function plusTard() {
    try {
      localStorage.setItem(PLUS_TARD(nom!), String(Date.now()));
    } catch {}
    setVisible(false);
  }

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="invitation-carte"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex flex-col items-center justify-center gap-6 bg-black/92 px-6 backdrop-blur-sm"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <motion.div
              initial={{ scale: 0.7, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 22 }}
            >
              <Card3D
                cacheKey={`invitation-${nom}`}
                mode="simple"
                size={0.82}
                interactive={false}
                render={(s) => <PlayerCard player={player} size={s} />}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <h2 className="text-[24px] leading-tight font-extrabold tracking-tight text-white">
                Ta carte officielle
              </h2>
              <p className="max-w-[290px] text-[14px] leading-snug text-white/60">
                Ton visage, le maillot Bola. Elle apparaît sur ta carte, chez tout le monde.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="flex w-full max-w-[340px] flex-col items-center gap-1"
            >
              <button
                type="button"
                onClick={() => {
                  setVisible(false);
                  setFlux(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-[15px] text-[15px] font-bold text-black transition-opacity active:opacity-80"
              >
                <Sparkles className="size-4" />
                Créer ma carte officielle
              </button>
              <button type="button" onClick={plusTard} className="px-6 py-3 text-[14px] font-semibold text-white/50">
                Plus tard
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <FluxCarteOfficielle player={player} ouvert={flux} onFermer={() => setFlux(false)} />
    </>
  );
}
