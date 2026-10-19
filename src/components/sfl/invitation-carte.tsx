"use client";

// Les invitations de l'ouverture : la carte officielle, puis les
// notifications. Une seule par ouverture, jamais les deux.
//
// 1. La carte officielle. Tant que le joueur connecté n'a pas de photo à lui
//    sur sa carte, l'app se voile, sa carte actuelle arrive, et un bouton
//    ouvre directement le parcours (carte-officielle.tsx). On ne décide
//    qu'après avoir relu la liste des photos de la ligue : un cache vide sur
//    un nouvel appareil ne doit pas inviter quelqu'un qui a déjà sa photo.
// 2. Les notifications. Une fois la photo là, si ce téléphone peut recevoir
//    des notifications et ne les a ni activées ni refusées, la même carte
//    propose de les activer (lib/sfl/notifications). Un iPhone dans Safari
//    ne peut pas : le guide d'installation s'en charge d'abord.
//
// Le prénom, le nom, le pseudo et l'email passent avant tout (identite.tsx) :
// rien ne s'ouvre ici tant que le joueur ne les a pas confirmés.
//
// « Plus tard » fait taire chaque invitation deux jours, sur cet appareil.
// À chaque ouverture, un téléphone déjà abonné redonne son abonnement.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card3D } from "@/components/sfl/card-3d";
import { FluxCarteOfficielle } from "@/components/sfl/carte-officielle";
import { PlayerCard } from "@/components/sfl/player-card";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSession } from "@/hooks/use-session";
import { identiteConfirmee, rafraichirIdentites } from "@/lib/sfl/identites";
import { photoPerso, rafraichirPhotos } from "@/lib/sfl/photos";
import { activerNotifications, etatNotifications, rafraichirAbonnement } from "@/lib/sfl/notifications";

type Invitation = "carte" | "notifs";

const PLUS_TARD = (quoi: Invitation, nom: string) =>
  quoi === "carte" ? `sfl-invitation-carte-${nom}` : `sfl-invitation-notifs-${nom}`;
/** Silence après « Plus tard ». */
const PAUSE_MS = 2 * 24 * 3600 * 1000;
/** Après le splash, et après la cérémonie des nouvelles cartes si elle passe. */
const DELAI_MS = 2600;

const TEXTES: Record<Invitation, { titre: string; ligne: string; bouton: string }> = {
  carte: {
    titre: "Ta carte officielle",
    ligne: "Ton visage, le maillot Bola. Elle apparaît sur ta carte, chez tout le monde.",
    bouton: "Créer ma carte officielle",
  },
  notifs: {
    titre: "Les notifications",
    ligne: "Bola te prévient sur ton téléphone quand il se passe quelque chose dans la ligue.",
    bouton: "Activer les notifications",
  },
};

function enPause(quoi: Invitation, nom: string): boolean {
  try {
    const t = Number(localStorage.getItem(PLUS_TARD(quoi, nom)) ?? 0);
    return Date.now() - t < PAUSE_MS;
  } catch {
    return false;
  }
}

/** En dev, `?invitation` ou `?invitation=notifs` la montre sans compte vérifié (captures). */
function apercu(): Invitation | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("invitation");
  return v === null ? null : v === "notifs" ? "notifs" : "carte";
}

export function InvitationCarte() {
  const session = useSession();
  const { player } = useMyPlayer();
  const [forcee] = useState(apercu);
  const nom = forcee || (session?.server && session.name === player.name) ? player.name : null;

  const [visible, setVisible] = useState<Invitation | null>(null);
  const [flux, setFlux] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!nom) return;
    void rafraichirAbonnement().catch(() => {});
    let annule = false;
    const timer = setTimeout(async () => {
      if (forcee) {
        setVisible(forcee);
        return;
      }
      await Promise.all([rafraichirPhotos(), rafraichirIdentites()]);
      if (annule || identiteConfirmee(nom) === false) return;
      if (photoPerso(nom) === null) {
        if (!enPause("carte", nom)) setVisible("carte");
        return;
      }
      if (enPause("notifs", nom)) return;
      const etat = await etatNotifications().catch(() => "indisponible" as const);
      if (!annule && etat === "inactives") setVisible("notifs");
    }, DELAI_MS);
    return () => {
      annule = true;
      clearTimeout(timer);
    };
  }, [nom, forcee]);

  if (!nom) return null;

  function plusTard() {
    if (!visible) return;
    try {
      localStorage.setItem(PLUS_TARD(visible, nom!), String(Date.now()));
    } catch {}
    setVisible(null);
  }

  async function oui() {
    if (visible === "carte") {
      setVisible(null);
      setFlux(true);
      return;
    }
    setBusy(true);
    try {
      const etat = await activerNotifications();
      if (etat === "actives") toast.success("Notifications activées");
      else if (etat === "refusees") toast.error("Refusées : change-le dans les réglages du téléphone.");
    } catch {
      toast.error("Impossible d'activer les notifications.");
    } finally {
      setBusy(false);
      setVisible(null);
    }
  }

  const texte = visible ? TEXTES[visible] : null;
  const Icone = visible === "notifs" ? Bell : Sparkles;

  return (
    <>
      <AnimatePresence>
        {texte && (
          <motion.div
            key="invitation"
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
              <h2 className="text-[24px] leading-tight font-extrabold tracking-tight text-white">{texte.titre}</h2>
              <p className="max-w-[290px] text-[14px] leading-snug text-white/60">{texte.ligne}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="flex w-full max-w-[340px] flex-col items-center gap-1"
            >
              <button
                type="button"
                onClick={oui}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-[15px] text-[15px] font-bold text-black transition-opacity active:opacity-80 disabled:opacity-50"
              >
                <Icone className="size-4" />
                {texte.bouton}
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
