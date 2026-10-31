"use client";

// Une conversation privée, plein écran (/messages/<lui>) : l'écran du
// Vestiaire (components/sfl/vestiaire.tsx, Discussion), mêmes bulles,
// réponses, réactions, vocaux, photos, pour deux joueurs seulement.
//
// En haut, le retour (là d'où l'on vient : sa carte, son profil, la liste des
// messages, ou la liste quand on arrive d'une notification), sa carte en
// pastille et son nom ; la cloche (Tout ou Rien : en privé, tout m'est
// adressé) ; les trois points, pour le bloquer ou le débloquer. En tête du
// fil, sa carte moyenne : on sait à qui l'on parle même quand rien n'est
// encore écrit.
//
// L'écran est posé sur <body>, hors de la page, comme la discussion d'un
// match (matchs/discussion-match.tsx) : sur iPhone, la page défile dans un
// conteneur dont WebKit fait une seule couche, sous la barre d'onglets, et
// la barre d'écriture serait restée derrière elle.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { CarteDe } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { Discussion } from "@/components/sfl/vestiaire";
import { useFormatCarte } from "@/hooks/use-format-carte";
import { bloquer, debloquer, estBloque, salonPrive } from "@/lib/sfl/messages-prives";
import type { MessageV, ModeNotifs } from "@/lib/sfl/vestiaire";

const MODES_PRIVE: [ModeNotifs, string][] = [
  ["tout", "Tout"],
  ["rien", "Rien"],
];

export function Conversation({
  avec,
  nom,
  demo = null,
}: {
  /** L'autre joueur (profiles.id ; en démo, son nom). */
  avec: string;
  /** Son nom de saison, « » tant qu'il n'est pas connu. */
  nom: string;
  demo?: MessageV[] | null;
}) {
  const salon = useMemo(() => salonPrive(avec), [avec]);
  const format = useFormatCarte();
  const [bloque, setBloque] = useState(false);
  const [menu, setMenu] = useState(false);
  const [monte, setMonte] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMonte(true));
    if (demo) return () => cancelAnimationFrame(t);
    let vivant = true;
    void estBloque(avec).then((b) => vivant && setBloque(b));
    return () => {
      vivant = false;
      cancelAnimationFrame(t);
    };
  }, [avec, demo]);

  async function basculerBlocage() {
    setMenu(false);
    if (demo) return setBloque((b) => !b);
    const ok = bloque ? await debloquer(avec) : await bloquer(avec);
    if (!ok) return void toast.error("Ça n'a pas marché. Réessaie dans un instant.");
    navigator.vibrate?.(8);
    setBloque(!bloque);
  }

  const ecran = (
    <Discussion
      salon={salon}
      libelleNotifs="Notifications de la conversation"
      modesNotifs={MODES_PRIVE}
      vide=""
      demo={demo}
      titre={
        <div className="flex min-w-0 items-center gap-3">
          <BoutonRetour parent="/messages" titre="Messages" />
          <CarteDe name={nom || "?"} size={format.petite * 0.8} />
          <h1 className="min-w-0 truncate text-[clamp(20px,5.6vw,24px)] leading-tight font-bold tracking-tight">
            {nom ? <Nom n={nom} /> : " "}
          </h1>
        </div>
      }
      sousTitre={bloque ? <p className="mt-1 pl-14 text-corps font-semibold text-encre-3">Bloqué</p> : undefined}
      aDroite={
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-label="Plus"
            aria-expanded={menu}
            className="bouton-secondaire flex size-11 items-center justify-center"
          >
            <MoreHorizontal className="size-[18px]" />
          </button>
          {menu && (
            <div className="glass absolute top-[52px] right-0 z-20 w-[220px] rounded-3xl p-1.5 shadow-2xl">
              <button
                type="button"
                onClick={() => void basculerBlocage()}
                className="flex w-full items-center rounded-2xl px-3.5 py-2.5 text-left text-ligne font-semibold active:bg-contraste/8"
              >
                {bloque ? "Débloquer" : "Bloquer"}
              </button>
            </div>
          )}
        </div>
      }
      tete={
        nom ? (
          <div className="flex justify-center pt-6 pb-3">
            <CarteDe name={nom} size={format.moyenne} />
          </div>
        ) : null
      }
    />
  );
  // Posé d'un geste, jamais au premier rendu du serveur.
  return monte ? createPortal(ecran, document.body) : null;
}
