"use client";

// Ton premier match — à la place de « Aucun match Bola pour l'instant. »
// (relifting du premier jour d'un joueur, Sabri, 02/11/2026). Un état vide
// n'est jamais une phrase triste : c'est le geste suivant, et les visages
// qui donnent envie de le faire.
//
// Une tuile mauve de la charte (#e0b3cb, encre noire dans les deux modes) :
// le titre, la pile des visages les plus proches et leur nombre, puis
// « Ouvrir un match » (la Map, la feuille Ouvrir un match) et « Voir les
// joueurs » (la Map, le catalogue). Dessous, « Près de toi » : les cartes
// des joueurs les plus proches (ville donnée, sinon celle tirée de leur nom,
// villeOuLigue), du plus près au plus loin, chacune s'ouvre en grand.
// Ni or, ni bleu, ni rouge : réservés aux cartes MVP, Défensive, Impact.

import Link from "next/link";
import { useMemo } from "react";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { useJoueursDeLaMap } from "@/hooks/use-joueurs-de-la-map";
import { useVillesRevision } from "@/hooks/use-villes";
import { usePhotoRevision } from "@/hooks/use-player-photo";
import { maVille, villeOuLigue } from "@/lib/sfl/villes";
import { photoPerso, photoMiniature } from "@/lib/sfl/photos";
import { nomAffiche } from "@/lib/sfl/identites";

const MAUVE = "#e0b3cb";
const ENCRE = "#0a0b0d";

/** Distance en km entre deux points (haversine). */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const d = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(d));
}

export function PremierMatch({ moi }: { moi: string }) {
  const joueurs = useJoueursDeLaMap();
  const revVilles = useVillesRevision();
  const revPhotos = usePhotoRevision();
  const proches = useMemo(() => {
    void revVilles;
    void revPhotos;
    const ici = maVille(moi) ?? villeOuLigue(moi);
    if (!ici) return [];
    return joueurs
      .filter((p) => p.name !== moi)
      .map((p) => {
        const v = villeOuLigue(p.name);
        return v ? { p, d: km(ici, v) } : null;
      })
      .filter((x) => x !== null)
      .sort((a, b) => a.d - b.d || (photoPerso(b.p.name) ? 1 : 0) - (photoPerso(a.p.name) ? 1 : 0))
      .slice(0, 12);
  }, [joueurs, moi, revVilles, revPhotos]);
  const pres = proches.filter((x) => x.d <= 25).length;
  const visages = proches.filter((x) => photoPerso(x.p.name)).slice(0, 4);

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-[28px] p-5" style={{ background: MAUVE, color: ENCRE }} aria-label="Ton premier match">
        <h2 className="text-titre-l leading-[1.02] font-extrabold tracking-[-0.6px]">Ton premier match</h2>
        {pres > 0 && (
          <div className="mt-3 flex items-center gap-2.5">
            {visages.length > 0 && <span aria-hidden className="flex">
              {visages.map(({ p }, i) => {
                const photo = photoPerso(p.name);
                return (
                  <span
                    key={p.name}
                    className="size-8 overflow-hidden rounded-full bg-[#0a0b0d]/15"
                    style={{ marginLeft: i ? -10 : 0, boxShadow: `0 0 0 2px ${MAUVE}` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- photo de la ligue (Storage) */}
                    {photo && <img src={photoMiniature(photo)} alt="" className="size-full object-cover" />}
                  </span>
                );
              })}
            </span>}
            <span className="text-ligne font-semibold">
              {pres} joueur{pres > 1 ? "s" : ""} à moins de 25 km
            </span>
          </div>
        )}
        <div className="mt-5 flex gap-2">
          <Link
            href="/map?ouvrir="
            className="flex min-h-12 flex-1 items-center justify-center rounded-full px-4 text-lecture font-bold active:scale-[0.98]"
            style={{ background: ENCRE, color: MAUVE }}
          >
            Ouvrir un match
          </Link>
          <Link
            href="/map?ville"
            className="flex min-h-12 items-center justify-center rounded-full px-4 text-lecture font-semibold active:scale-[0.98]"
            style={{ boxShadow: `inset 0 0 0 1.5px ${ENCRE}` }}
          >
            Les joueurs
          </Link>
        </div>
      </section>
      {proches.length > 0 && (
        <section aria-label="Près de toi" className="flex flex-col gap-2.5">
          <h2 className="px-1 text-titre font-bold tracking-tight">Près de toi</h2>
          <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            {proches.map(({ p, d }) => (
              <div key={p.name} className="flex shrink-0 flex-col items-center gap-1.5">
                <MiniCarte player={p} size={FORMAT_CARTE.petite} cle={`pres-${p.name}`} />
                <span className="max-w-[84px] truncate text-petit font-semibold">{nomAffiche(p.name)}</span>
                <span className="-mt-1 text-petit text-encre-3 tabular-nums">{d < 1 ? "ta ville" : `${Math.round(d)} km`}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
