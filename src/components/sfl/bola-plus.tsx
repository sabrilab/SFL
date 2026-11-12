"use client";

// Bola Plus, la précommande (Sabri, 12/11/2026 ; lib/sfl/bola-plus.ts) : ce
// que le joueur en voit.
//
//   · TuileBolaPlus : l'entrée sur Ma carte, sous « Personnaliser ma carte » et
//     « Inviter », sur toute la largeur. Son nom, et « C'est noté » une fois
//     l'intérêt enregistré. Elle ouvre /profil/bola-plus ;
//   · OffreBolaPlus : la page. L'emblème, les deux formules à toucher
//     (Mensuel 20 € par mois, sans engagement ; Annuel 168 € par an, −30 %),
//     puis « Je suis intéressé ». Le bouton marche avec ou sans formule ; une
//     fois touché, il laisse la place à « C'est noté » et à « Annuler ». Les
//     formules restent touchables : en toucher une change la formule notée.
//     Après « Annuler », plus rien n'est coché.
//
// Aucun paiement, aucun formulaire, aucun texte d'aide : le nom, les deux
// prix, le bouton. Ce que contient Bola Plus n'est pas arrêté : l'écran n'en
// dit rien.
//
// L'emblème n'est pas une image : la rosace guillochée du dos de la carte et
// la lune Bola en son centre (motif-carte.tsx, finitions-carte.ts), dessinées
// à l'encre de la page. Noir et blanc, en clair comme en sombre.

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { LOGO_BOLA } from "@/components/sfl/finitions-carte";
import { RosaceBola } from "@/components/sfl/motif-carte";
import { useBolaPlus } from "@/hooks/use-bola-plus";
import { ANNUEL, FORMULES, LIBELLE_REMISE, MENSUEL, NOM_FORMULE, type Formule } from "@/lib/sfl/bola-plus";
import { cn } from "@/lib/utils";
import "@/components/sfl/ma-carte/rubriques.css";

// La rosace dans un carré de 340 (le repère du contrat à la une), la lune au
// centre dans les proportions du dos de la carte (dos-carte.tsx : une lune de
// 300 dans une rosace de rayon intérieur 236).
const ROSACE = { r1: 74, r2: 128 };
const LUNE = (300 / 236) * ROSACE.r1;
// La boîte du symbole dans le repère du logo (finitions-carte.ts).
const SYMBOLE = { x: 17, y: 103.485, c: 112.373 };

/** La rosace guillochée et la lune Bola, à l'encre (currentColor). */
export function EmblemeBolaPlus({ className, trait = 0.7, fond = 0.5 }: { className?: string; trait?: number; fond?: number }) {
  const s = LUNE / SYMBOLE.c;
  return (
    <svg aria-hidden viewBox="-158 -158 316 316" className={className}>
      <g opacity={fond}>
        <RosaceBola cx={0} cy={0} r1={ROSACE.r1} r2={ROSACE.r2} couleur="currentColor" epaisseur={trait} />
      </g>
      <path
        d={LOGO_BOLA.symbole}
        fill="currentColor"
        fillRule="evenodd"
        transform={`translate(${-(SYMBOLE.x + SYMBOLE.c / 2) * s} ${-(SYMBOLE.y + SYMBOLE.c / 2) * s}) scale(${s})`}
      />
    </svg>
  );
}

/** « C'est noté » : la coche dans son rond plein, et les mots. */
function CestNote({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-foreground text-background">
        <Check className="size-3" strokeWidth={3.5} aria-hidden />
      </span>
      C&apos;est noté
    </span>
  );
}

/** L'entrée de Bola Plus sur Ma carte (profil/page.tsx). */
export function TuileBolaPlus() {
  const { interet } = useBolaPlus();
  return (
    <Link
      href="/profil/bola-plus"
      aria-label={interet ? "Bola Plus, c'est noté" : "Bola Plus"}
      className="tuile tuile--plus col-span-2 flex min-h-[76px] items-center justify-between gap-3 px-4"
    >
      <span className="tuile__embleme" aria-hidden>
        <EmblemeBolaPlus className="size-full" trait={0.9} fond={0.28} />
      </span>
      <span className="text-[16px] leading-[1.15] font-bold tracking-[-0.2px] whitespace-nowrap">Bola Plus</span>
      {interet && <CestNote className="mono-label tuile__note" />}
    </Link>
  );
}

const PRIX: Record<Formule, { euros: number; par: string; detail: string }> = {
  mensuel: { euros: MENSUEL, par: "mois", detail: "Sans engagement" },
  annuel: { euros: ANNUEL, par: "an", detail: LIBELLE_REMISE },
};

/** La page Bola Plus : l'emblème, les deux formules, « Je suis intéressé ». */
export function OffreBolaPlus() {
  const { interet, noter, annuler, occupe } = useBolaPlus();
  // La formule touchée avant « Je suis intéressé » ; une fois noté, celle de l'intérêt fait foi.
  const [choix, setChoix] = useState<Formule | null>(null);
  const formule = interet ? interet.formule : choix;

  function choisir(f: Formule) {
    if (!interet) setChoix(f);
    else if (interet.formule !== f) noter(f);
  }

  // Après « Annuler », rien ne reste coché : ni la formule notée, ni celle d'avant.
  function defaire() {
    setChoix(null);
    annuler();
  }

  return (
    <div className="flex flex-col gap-[var(--fib-21)]">
      {/* Sur un écran court (iPhone SE) ou étroit (320 px), l'emblème rétrécit : le bouton reste au-dessus de la barre d'onglets. */}
      <EmblemeBolaPlus className="mx-auto size-[150px] text-foreground [@media(max-height:700px)]:size-[116px] [@media(max-width:350px)]:size-[92px]" />

      <div role="radiogroup" aria-label="Formule" className="flex flex-col gap-2.5">
        {FORMULES.map((f) => {
          const p = PRIX[f];
          const choisie = formule === f;
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={choisie}
              disabled={occupe}
              onClick={() => choisir(f)}
              className={cn(
                "glass flex w-full items-center gap-3 rounded-[24px] px-5 py-4 text-left transition-[border-color] duration-200 motion-reduce:transition-none",
                choisie && "border-foreground"
              )}
            >
              <span className="flex flex-1 flex-col gap-2">
                <span className="mono-label text-encre-3">{NOM_FORMULE[f]}</span>
                <span className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="text-[34px] leading-[0.9] tabular-nums" style={{ fontFamily: ANTON }}>
                    {p.euros}&nbsp;€
                  </span>
                  <span className="text-corps font-medium text-encre-2">/ {p.par}</span>
                </span>
              </span>
              <span className="text-right text-corps leading-tight font-semibold whitespace-nowrap text-encre-2">{p.detail}</span>
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px]",
                  choisie ? "border-foreground bg-foreground text-background" : "border-foreground/30"
                )}
              >
                {choisie && <Check className="size-3.5" strokeWidth={3.5} />}
              </span>
            </button>
          );
        })}
      </div>

      {interet ? (
        <div className="flex flex-col items-center gap-1" role="status">
          <CestNote className="py-4 text-lecture font-bold" />
          <button
            type="button"
            onClick={defaire}
            disabled={occupe}
            className="bouton-discret bouton--rouge min-h-11 px-5 py-2 text-corps font-semibold disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => noter(choix)}
          disabled={occupe}
          className="bouton-principal w-full py-4 text-lecture font-bold disabled:opacity-40"
        >
          Je suis intéressé
        </button>
      )}
    </div>
  );
}
