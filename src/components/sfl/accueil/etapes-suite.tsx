"use client";

// Après la carte, à l'accueil (accueil.tsx) : les notifications, puis les
// partenaires à suivre. Les mêmes gestes que les invitations de l'ouverture
// (invitation-carte.tsx), qu'on peut remettre à plus tard : « Plus tard » les
// y met en pause deux jours, et elles reviendront ensuite d'elles-mêmes.
//
// Les notifications : iOS ne montre sa demande qu'après un toucher, d'où le
// bouton. Ce que le joueur répond va au journal d'usage, comme depuis
// l'invitation (lib/sfl/notifications.ts). En aperçu (`demo`), rien n'est
// demandé au téléphone ni écrit.

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { Bell, Check, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { mettreEnPause } from "@/components/sfl/invitation-carte";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { useIdentites } from "@/hooks/use-identites";
import { activerNotifications, noterNotifs } from "@/lib/sfl/notifications";
import { suivre } from "@/lib/sfl/suivis";
import { cn } from "@/lib/utils";
import { BoutonDiscret, BoutonPrincipal, Corps, Ligne, Titre, useContexteAccueil } from "./cadre";

/** Ce que Bola envoie, à la manière de l'écran verrouillé (lib/sfl/motifs-notif.ts). */
const EXEMPLES = [
  { de: "On t'a cité au Vestiaire", texte: "« Tu viens dimanche ? »" },
  { de: "Demain 19:00", texte: "Ton match · Il manque 2" },
  { de: "Missions Bola", texte: "Tes missions du dimanche sont là." },
];

export function EtapeNotifs({ nom, onFini }: { nom: string; onFini: () => void }) {
  const { demo } = useContexteAccueil();
  const reduit = useReducedMotion();
  const [envoi, setEnvoi] = useState(false);

  // Proposées : le journal d'usage le note, puis la réponse.
  useEffect(() => {
    if (!demo) noterNotifs("proposee", "ouverture");
  }, [demo]);

  async function activer() {
    if (envoi) return;
    navigator.vibrate?.(10);
    if (demo) {
      onFini();
      return;
    }
    setEnvoi(true);
    try {
      const etat = await activerNotifications("ouverture");
      if (etat === "actives") toast.success("Notifications activées");
      else if (etat === "refusees") toast.error("Refusées : change-le dans les réglages du téléphone.");
    } catch {
      toast.error("Impossible d'activer les notifications.");
    } finally {
      setEnvoi(false);
      onFini();
    }
  }

  function plusTard() {
    if (!demo) {
      mettreEnPause("notifs", nom);
      noterNotifs("plus-tard", "ouverture");
    }
    onFini();
  }

  return (
    <Corps
      pied={
        <>
          <BoutonPrincipal ton="mauve" onClick={activer} disabled={envoi}>
            {envoi ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
            Activer les notifications
          </BoutonPrincipal>
          <BoutonDiscret onClick={plusTard}>Plus tard</BoutonDiscret>
        </>
      }
    >
      <ul className="flex w-full max-w-[340px] flex-col gap-[8px]" aria-hidden>
        {EXEMPLES.map(({ de, texte }, i) => (
          <motion.li
            key={de}
            initial={reduit ? false : { y: -34, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1 - i * 0.18, scale: 1 - i * 0.03 }}
            transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.25 + i * 0.32 }}
            className="glass-soft flex items-center gap-[13px] rounded-[21px] px-[13px] py-[11px]"
          >
            <span className="grid size-[38px] shrink-0 place-items-center rounded-[10px] bg-black ring-1 ring-white/15">
              <Image src="/bola/symbole-blanc.svg" alt="" width={20} height={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-ligne font-bold text-white">{de}</span>
                <span className="shrink-0 text-petit text-white/40">{i === 0 ? "maintenant" : `il y a ${i * 5} min`}</span>
              </span>
              <span className="block truncate text-ligne text-white/70">{texte}</span>
            </span>
          </motion.li>
        ))}
      </ul>
      <div className="mt-[34px] flex flex-col items-center">
        <Titre>Ne rate rien.</Titre>
        <Ligne>Quand on te cite, quand ton match approche, quand la ligue bouge.</Ligne>
      </div>
    </Corps>
  );
}

export function EtapeSuivre({ nom, proposes, onFini }: { nom: string; proposes: string[]; onFini: () => void }) {
  const { demo } = useContexteAccueil();
  const reduit = useReducedMotion();
  const id = useIdentites();
  /** Ceux qu'on a décochés. */
  const [decoches, setDecoches] = useState<Set<string>>(() => new Set());
  const [envoi, setEnvoi] = useState(false);
  const choisis = proposes.filter((n) => !decoches.has(n));

  async function valider() {
    if (envoi || choisis.length === 0) return;
    navigator.vibrate?.([8, 40, 8]);
    if (!demo) {
      setEnvoi(true);
      const erreur = await suivre(nom, choisis);
      setEnvoi(false);
      if (erreur) toast.error(erreur);
    }
    onFini();
  }

  function plusTard() {
    if (!demo) mettreEnPause("suivre", nom);
    onFini();
  }

  return (
    <Corps
      pied={
        <>
          <BoutonPrincipal ton="mauve" onClick={valider} disabled={envoi || choisis.length === 0}>
            {envoi ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            {choisis.length > 1 ? `Suivre les ${choisis.length}` : "Suivre"}
          </BoutonPrincipal>
          <BoutonDiscret onClick={plusTard}>Plus tard</BoutonDiscret>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-x-[13px] gap-y-[21px]">
        {proposes.map((n, i) => {
          const pris = !decoches.has(n);
          return (
            <motion.button
              key={n}
              type="button"
              aria-pressed={pris}
              initial={reduit ? false : { scale: 0.7, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.06 * i }}
              onClick={() => {
                navigator.vibrate?.(6);
                setDecoches((d) => {
                  const s = new Set(d);
                  if (s.has(n)) s.delete(n);
                  else s.add(n);
                  return s;
                });
              }}
              className="flex flex-col items-center gap-[6px]"
            >
              <span className={cn("relative transition-opacity", !pris && "opacity-35")}>
                <CarteDe name={n} size={FORMAT_CARTE.moyenne} inerte />
                <span
                  aria-hidden
                  className={cn(
                    "absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full border-2 border-black transition-colors",
                    pris ? "bg-white text-black" : "bg-white/15 text-transparent"
                  )}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
              </span>
              <span className={cn("max-w-[86px] truncate text-petit font-semibold text-white", !pris && "text-white/40")}>
                {id.nom(n).split(" ")[0]}
              </span>
            </motion.button>
          );
        })}
      </div>
      <div className="mt-[34px] flex flex-col items-center">
        <Titre>Suis tes partenaires.</Titre>
        <Ligne>Ceux avec qui tu joues le plus. Ils passent en premier quand tu montes un match.</Ligne>
      </div>
    </Corps>
  );
}
