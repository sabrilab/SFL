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
// Forme : une tuile pleine au vert sauge de la charte (#a9cba9), encre noire
// dans les deux modes (comme les tuiles claires des inspirations de Sabri) ;
// ni or, ni bleu, ni rouge (réservés aux cartes MVP, Défensive, Impact).
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

const SAUGE = "#a9cba9";
const ENCRE = "#0a0b0d";

interface Pas {
  cle: string;
  fait: boolean;
  libelle: string;
  href?: string;
  onClick?: () => void;
}

export function PremiersPas({ nom, aJoue, onPhoto }: { nom: string; aJoue: boolean; onPhoto: () => void }) {
  const revVilles = useVillesRevision();
  const revPhotos = usePhotoRevision();
  const suivis = useSuivis();
  void revVilles;
  void revPhotos;
  const nbSuivis = suivis.abonnements(nom).length;
  const pas: Pas[] = [
    { cle: "ville", fait: !!maVille(nom), libelle: "Ta ville", href: "/map?ville" },
    { cle: "photo", fait: photoPerso(nom) !== null, libelle: "Ta photo", onClick: onPhoto },
    {
      cle: "suivre",
      fait: nbSuivis >= 3,
      libelle: nbSuivis > 0 && nbSuivis < 3 ? `Suis 3 joueurs · ${nbSuivis}/3` : "Suis 3 joueurs",
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
      className="w-full overflow-hidden rounded-[28px] p-5"
      style={{ background: SAUGE, color: ENCRE }}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-titre-fort leading-[1.1] font-extrabold tracking-[-0.4px]">Tes premiers pas</h2>
        <p aria-hidden className="font-display text-[34px] leading-[0.9] tabular-nums">
          {faits}
          <span className="opacity-40">/{pas.length}</span>
        </p>
      </div>
      <div aria-hidden className="mt-3 flex gap-1.5">
        {pas.map((p) => (
          <span key={p.cle} className="h-[5px] flex-1 rounded-full" style={{ background: ENCRE, opacity: p.fait ? 1 : 0.16 }} />
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-1.5">
        {pas.map((p) => {
          const contenu = (
            <>
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full"
                style={p.fait ? { background: ENCRE, color: SAUGE } : { boxShadow: `inset 0 0 0 1.5px ${ENCRE}33` }}
              >
                {p.fait && <Check className="size-4" strokeWidth={3} />}
              </span>
              <span className={cn("min-w-0 flex-1 text-lecture font-semibold", p.fait && "line-through opacity-45")}>{p.libelle}</span>
              {!p.fait && <ChevronRight aria-hidden className="size-5 shrink-0 opacity-60" />}
            </>
          );
          const classes = cn(
            "flex min-h-12 w-full items-center gap-3 rounded-[18px] px-3 text-left transition-transform active:scale-[0.98]",
            p.cle === prochain && "bg-[#0a0b0d]/[0.08]"
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
                <button type="button" onClick={p.onClick} className={classes} aria-label={etiquette}>
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
