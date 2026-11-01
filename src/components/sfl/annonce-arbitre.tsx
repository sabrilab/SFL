"use client";

// L'annonce à un arbitre, à l'ouverture de l'app (Sabri, 24/10 : « tu peux
// l'envoyer à Fabio, la notification »). Fabio n'avait activé les
// notifications sur aucun téléphone : la nouvelle l'attend dans l'app.
//
// Une fois par arbitre et par appareil (annonceArbitreVue), la première des
// invitations de l'ouverture après l'équipe (invitation-carte.tsx) : sa carte
// d'arbitre, jaune fluo, arrive, et un bouton active ses notifications quand
// ce téléphone peut en recevoir, ou ouvre sa carte sinon.

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CarteArbitre } from "@/components/sfl/carte-arbitre";
import { activerNotifications, type EtatNotifications } from "@/lib/sfl/notifications";

const VUE = (nom: string) => `sfl-annonce-arbitre-${nom}`;

export function annonceArbitreVue(nom: string): boolean {
  try {
    return localStorage.getItem(VUE(nom)) !== null;
  } catch {
    return false;
  }
}

function noterVue(nom: string) {
  try {
    localStorage.setItem(VUE(nom), String(Date.now()));
  } catch {}
}

export function AnnonceArbitre({ nom, etat, onFermer }: { nom: string; etat: EtatNotifications; onFermer: () => void }) {
  const router = useRouter();
  const reduit = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const notifs = etat === "inactives";
  const entre = (delai: number) => ({
    initial: reduit ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: reduit ? 0 : delai },
  });

  function fermer() {
    noterVue(nom);
    onFermer();
  }

  async function oui() {
    if (!notifs) {
      fermer();
      router.push("/profil");
      return;
    }
    setBusy(true);
    try {
      const r = await activerNotifications("ouverture");
      if (r === "actives") toast.success("Notifications activées");
      else if (r === "refusees") toast.error("Refusées : change-le dans les réglages du téléphone.");
    } catch {
      toast.error("Impossible d'activer les notifications.");
    } finally {
      setBusy(false);
      fermer();
    }
  }

  return (
    <motion.div
      key="annonce-arbitre"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Tu es arbitre"
      className="dark fixed inset-0 z-[55] flex flex-col items-center justify-center gap-6 bg-black/92 px-6 text-foreground backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <motion.div
        initial={reduit ? false : { scale: 0.7, y: 50, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
      >
        <CarteArbitre nom={nom} size={0.82} />
      </motion.div>

      <motion.div {...entre(0.3)} className="flex flex-col items-center gap-1.5 text-center">
        <h2 className="text-titre-g leading-tight font-extrabold tracking-tight text-white">Tu es arbitre</h2>
        <p className="max-w-[290px] text-ligne leading-snug text-white/60">
          Les joueurs de tes matchs te notent : ta satisfaction devient la note de ta carte.
        </p>
      </motion.div>

      <motion.div {...entre(0.45)} className="flex w-full max-w-[340px] flex-col items-center gap-1">
        <button
          type="button"
          onClick={oui}
          disabled={busy}
          className="bouton-principal flex w-full items-center justify-center gap-2 py-[15px] text-lecture font-bold disabled:opacity-50"
        >
          {notifs ? "Activer les notifications" : "Voir ma carte"}
        </button>
        <button type="button" onClick={fermer} className="bouton-discret px-6 py-3 text-ligne font-semibold">
          Fermer
        </button>
      </motion.div>
    </motion.div>
  );
}
