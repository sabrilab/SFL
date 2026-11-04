"use client";

// Ton premier match — à la place de « Aucun match Bola pour l'instant. »
// (relifting du premier jour d'un joueur, Sabri, 02/11/2026). Un état vide
// n'est jamais une phrase triste : c'est le geste suivant, et les visages
// qui donnent envie de le faire.
//
// Forme : une tuile de Ma carte (rubriques.css, ton « inviter », le mauve),
// sans objet, et les boutons de l'app (bouton-principal vert : y aller ; bouton-secondaire mauve : les autres) ; aucune
// forme nouvelle (Sabri, 04/11 : l'UX change, l'UI reste celle en ligne). Le
// titre, la pile des visages les plus proches et leur nombre, puis
// « Ouvrir un match » (la Map, la feuille Ouvrir un match) et « Voir les
// joueurs » (la Map, le catalogue). Dessous, « Près de toi » : les cartes
// des joueurs les plus proches (ville donnée, sinon celle tirée de leur nom,
// villeOuLigue), du plus près au plus loin, chacune s'ouvre en grand.
// Ni or, ni bleu, ni rouge : réservés aux cartes MVP, Défensive, Impact.

import Link from "next/link";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { useJoueursProches } from "@/hooks/use-joueurs-proches";
import { photoPerso, photoMiniature } from "@/lib/sfl/photos";
import { nomAffiche } from "@/lib/sfl/identites";

export function PremierMatch({ moi }: { moi: string }) {
  const proches = useJoueursProches(moi);
  const pres = proches.filter((x) => x.d <= 25).length;
  const visages = proches.filter((x) => photoPerso(x.p.name)).slice(0, 4);

  return (
    <div className="flex flex-col gap-4">
      <section
        className="tuile tuile--inviter flex flex-col p-4 text-foreground"
        aria-label="Ton premier match"
      >
        <span className="tuile__etiquette mono-label text-[10px]">
          Premier match
        </span>
        <h2 className="mt-1.5 text-titre leading-[1.1] font-bold tracking-tight">
          Ton premier match
        </h2>
        {pres > 0 && (
          <div className="mt-3 flex items-center gap-2.5">
            {visages.length > 0 && (
              <span aria-hidden className="flex">
                {visages.map(({ p }, i) => {
                  const photo = photoPerso(p.name);
                  return (
                    <span
                      key={p.name}
                      className="size-8 overflow-hidden rounded-full bg-muted ring-2 ring-background"
                      style={{ marginLeft: i ? -10 : 0 }}
                    >
                      {photo && (
                        // eslint-disable-next-line @next/next/no-img-element -- photo de la ligue (Storage)
                        <img
                          src={photoMiniature(photo)}
                          alt=""
                          className="size-full object-cover"
                        />
                      )}
                    </span>
                  );
                })}
              </span>
            )}
            <span className="text-ligne font-semibold text-encre-3">
              {pres} joueur{pres > 1 ? "s" : ""} à moins de 25 km
            </span>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Link
            href="/map?ouvrir="
            className="bouton-principal bouton--vert flex min-h-11 flex-1 items-center justify-center px-4 text-lecture font-semibold"
          >
            Ouvrir un match
          </Link>
          <Link
            href="/map?ville"
            className="bouton-secondaire bouton--mauve flex min-h-11 items-center justify-center px-4 text-lecture font-semibold"
          >
            Les joueurs
          </Link>
        </div>
      </section>
      {proches.length > 0 && (
        <section aria-label="Près de toi" className="flex flex-col gap-2.5">
          <h2 className="px-1 text-titre font-bold tracking-tight">
            Près de toi
          </h2>
          <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            {proches.map(({ p, d }) => (
              <div
                key={p.name}
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <MiniCarte
                  player={p}
                  size={FORMAT_CARTE.petite}
                  cle={`pres-${p.name}`}
                />
                <span className="max-w-[84px] truncate text-petit font-semibold">
                  {nomAffiche(p.name)}
                </span>
                <span className="-mt-1 text-petit text-encre-3 tabular-nums">
                  {d < 1 ? "ta ville" : `${Math.round(d)} km`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
