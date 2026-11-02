"use client";

// « Vous avez reçu un carton » (Sabri, 01/11/2026 : « au-delà d'une notif,
// vraiment une animation qu'il reçoit dès qu'il ouvre l'appli […] avec un
// vrai carton jaune »). À l'ouverture de l'app, chaque carton pas encore vu
// (lib/sfl/cartons.ts, cartons-vus.ts) est brandi plein écran, comme par un
// arbitre : le carton sort d'en bas, monte d'un coup de bras, se pose et ne
// bouge plus ; un reflet passe sur le plastique ; le téléphone vibre au
// moment où il arrive en haut. Dessous : « Carton jaune », « Retard · J4 »,
// et la série en trois petits cartons (1/3, 2/3, 3/3) ; au troisième, le
// rouge suit : « Carton rouge », « Suspendu pour la J5 ». Plusieurs cartons :
// l'un après l'autre. Rien d'autre à l'écran : le sigle SFL est imprimé sur
// le carton (contrôle du 01/11 au soir : plus de « Sunday Five League » en
// tête, plus de halo ; la matière dans carton.css).
//
// La vibration : un navigateur ne la donne qu'après un toucher dans l'app
// (Chrome le dit en clair). À l'ouverture, elle ne part que si l'écran a déjà
// été touché ; au carton suivant, le toucher de « Continuer » vient d'avoir
// lieu. Sur iPhone, rien n'est garanti hors d'un toucher.
//
// Le jaune et le rouge sont les seules couleurs hors du noir et blanc, à
// côté de la braise du « Il manque N » (Sabri, 01/11). Sans phrase d'aide.
// « Réduire les animations » : le carton est là, posé, rien ne bouge, ni
// vibration (carton.css, haptique).

import { useEffect, useState } from "react";
import { SigleSfl } from "@/components/sfl/marques-carte";
import { REGLES_CARTONS, texteCarton, type Carton } from "@/lib/sfl/cartons";
import { haptique } from "@/lib/sfl/haptique";
import { cn } from "@/lib/utils";
import "./carton.css";

/** Le carton seul, en plastique, brandi ou posé. */
export function CartonArbitre({ couleur, brandi = true, className }: { couleur: Carton["couleur"]; brandi?: boolean; className?: string }) {
  return (
    <div className={cn("carton-scene", className)}>
      <div className="carton-tenu">
        <div className={cn("carton", couleur === "rouge" && "carton--rouge", brandi && "carton--brandi")} role="img" aria-label={couleur === "rouge" ? "Carton rouge" : "Carton jaune"}>
          <span className="carton__sigle" aria-hidden>
            <SigleSfl hauteur={12} couleur="currentColor" />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Un petit carton (la convocation d'un suspendu, le profil) : jaune, rouge, ou vide. */
export function PetitCarton({ couleur, taille = 1, className }: { couleur: Carton["couleur"] | null; taille?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("carton-mini shrink-0", couleur === "jaune" && "carton-mini--jaune", couleur === "rouge" && "carton-mini--rouge", className)}
      style={taille !== 1 ? { width: 12 * taille, height: 17 * taille, borderRadius: 2 * taille } : undefined}
    />
  );
}

/** La série : trois petits cartons, pleins jusqu'au rang ; le rouge au bout. */
export function SerieDeCartons({ rang, rouge = false, className }: { rang: number; rouge?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} aria-label={`${rang} sur ${REGLES_CARTONS.jaunesPourUnRouge}`}>
      {Array.from({ length: REGLES_CARTONS.jaunesPourUnRouge }, (_, i) => (
        <span key={i} className={cn("carton-mini", i < rang && "carton-mini--jaune")} />
      ))}
      {rouge && (
        <>
          <span aria-hidden className="mx-0.5 opacity-40">
            ›
          </span>
          <span className="carton-mini carton-mini--rouge" />
        </>
      )}
    </span>
  );
}

export function CartonRecu({
  cartons,
  onVu,
  onFini,
}: {
  /** Les cartons à montrer, dans l'ordre (un rouge suit son troisième jaune). */
  cartons: Carton[];
  onVu: (c: Carton) => void;
  onFini: () => void;
}) {
  const [i, setI] = useState(0);
  const c = cartons[Math.min(i, cartons.length - 1)];

  // Le bras arrive en haut : le téléphone vibre à ce moment-là (≈ 0,55 s, carton.css).
  useEffect(() => {
    if (!c) return;
    const t = window.setTimeout(() => haptique.carton(), 540);
    return () => window.clearTimeout(t);
  }, [c]);

  if (!c) return null;
  const { titre, ligne } = texteCarton(c);
  const dernier = i >= cartons.length - 1;

  function suivant() {
    onVu(c);
    if (dernier) onFini();
    else setI((x) => x + 1);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      className="carton-voile dark fixed inset-0 z-[60] flex flex-col items-center justify-between overflow-hidden bg-black/94 px-6 text-white backdrop-blur-md"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-9">
        <CartonArbitre key={c.id} couleur={c.couleur} />
        <div key={`t-${c.id}`} className="carton-texte flex flex-col items-center gap-2.5 text-center">
          <h2 className="text-[30px] leading-none font-extrabold tracking-tight">{titre}</h2>
          <p className="mono-label text-white/60">{ligne}</p>
          <SerieDeCartons rang={c.rang} rouge={c.couleur === "rouge"} className="mt-1" />
        </div>
      </div>

      <button
        type="button"
        onClick={suivant}
        key={`b-${c.id}`}
        className="carton-bouton h-[52px] w-full max-w-[340px] rounded-full bg-white text-lecture font-semibold text-black transition-transform active:scale-[0.98]"
      >
        {dernier ? "Fermer" : "Continuer"}
      </button>
    </div>
  );
}
