"use client";

// Tes premiers pas — en tête de Ma carte, tant qu'il en reste un à faire
// (relifting du premier jour d'un joueur, Sabri, 02/11/2026 : « c'est pas
// assez agréable », un nouveau joueur ne voyait que des zéros).
//
// Le cycle Hooked : chaque pas est un investissement du joueur (sa ville, sa
// photo, ses suivis, son premier match) qui charge le déclencheur suivant ;
// on montre ce qu'il a déjà fait et le prochain pas, jamais ce qui lui manque.
// Quatre pas, cochés au fil de l'eau ; la tuile disparaît à quatre sur quatre.
//
// Forme : celle des tuiles de Ma carte (rubriques.css, ton « saison », le vert
// du terrain), sans objet : la lueur, le filet, les coins de coupe, l'étiquette
// en capitales ; la barre est faite des traits des tuiles (tuile__trait,
// tuile__plein). Aucune forme nouvelle (Sabri, 04/11 : l'UX change, l'UI reste
// celle de l'app en ligne). Ni or, ni bleu, ni rouge.
// Chaque rangée fait 48 px de haut (cible tactile) et porte son libellé
// entier pour VoiceOver.

import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { useSuivis } from "@/hooks/use-suivis";
import { useVillesRevision } from "@/hooks/use-villes";
import { usePhotoRevision } from "@/hooks/use-player-photo";
import { maVille } from "@/lib/sfl/villes";
import { photoPerso } from "@/lib/sfl/photos";
import { cn } from "@/lib/utils";

interface Pas {
  cle: string;
  fait: boolean;
  libelle: string;
  href?: string;
  onClick?: () => void;
}

export function PremiersPas({
  nom,
  aJoue,
  onPhoto,
}: {
  nom: string;
  aJoue: boolean;
  onPhoto: () => void;
}) {
  const revVilles = useVillesRevision();
  const revPhotos = usePhotoRevision();
  const suivis = useSuivis();
  void revVilles;
  void revPhotos;
  const nbSuivis = suivis.abonnements(nom).length;
  const pas: Pas[] = [
    {
      cle: "ville",
      fait: !!maVille(nom),
      libelle: "Ta ville",
      href: "/map?ville",
    },
    {
      cle: "photo",
      fait: photoPerso(nom) !== null,
      libelle: "Ta photo",
      onClick: onPhoto,
    },
    {
      cle: "suivre",
      fait: nbSuivis >= 3,
      libelle:
        nbSuivis > 0 && nbSuivis < 3
          ? `Suis 3 joueurs · ${nbSuivis}/3`
          : "Suis 3 joueurs",
      href: "/recherche",
    },
    { cle: "match", fait: aJoue, libelle: "Ton premier match", href: "/map" },
  ];
  const faits = pas.filter((p) => p.fait).length;
  // Tant que les suivis ne sont pas lus, on ne montre pas un pas à faire pour rien.
  if (faits === pas.length || !suivis.lue) return null;
  const prochain = pas.find((p) => !p.fait)?.cle;

  return (
    <section
      aria-label={`Tes premiers pas, ${faits} sur ${pas.length}`}
      className="tuile tuile--saison flex w-full flex-col p-4 text-foreground"
    >
      <span className="tuile__etiquette mono-label text-[10px]">
        Premiers pas
      </span>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <h2 className="text-titre leading-[1.1] font-bold tracking-tight">
          Tes premiers pas
        </h2>
        <p
          aria-hidden
          className="pr-4 font-display text-[30px] leading-[0.9] tabular-nums"
        >
          {faits}
          <span className="opacity-40">/{pas.length}</span>
        </p>
      </div>
      <div aria-hidden className="mt-3 flex gap-1.5">
        {pas.map((p) => (
          <span
            key={p.cle}
            className={cn(
              "h-[5px] flex-1 rounded-full",
              p.fait ? "tuile__plein" : "tuile__trait",
            )}
          />
        ))}
      </div>
      <ul className="mt-3 -mx-1.5 flex flex-col gap-0.5">
        {pas.map((p) => {
          const contenu = (
            <>
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
                  p.fait
                    ? "tuile__plein text-background"
                    : "border-[1.5px] border-current opacity-30",
                )}
              >
                {p.fait && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 text-lecture font-semibold",
                  p.fait && "text-encre-3 line-through",
                )}
              >
                {p.libelle}
              </span>
              {!p.fait && (
                <ChevronRight
                  aria-hidden
                  className="size-5 shrink-0 text-encre-3"
                />
              )}
            </>
          );
          const classes = cn(
            "flex min-h-12 w-full items-center gap-3 rounded-[14px] px-1.5 text-left transition-transform active:scale-[0.98]",
            p.cle === prochain && "tuile__trait",
          );
          const etiquette = `${p.libelle}${p.fait ? ", fait" : ""}`;
          return (
            <li key={p.cle}>
              {p.fait ? (
                <div className={classes} aria-label={etiquette}>
                  {contenu}
                </div>
              ) : p.href ? (
                <Link href={p.href} className={classes} aria-label={etiquette}>
                  {contenu}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={p.onClick}
                  className={classes}
                  aria-label={etiquette}
                >
                  {contenu}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
