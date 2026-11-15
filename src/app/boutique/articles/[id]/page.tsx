"use client";

// La fiche d'une pièce de la boutique (une vraie page depuis le 12/11/2026 :
// le retour de l'iPhone y marche, son adresse se partage).
//
//   · la galerie : les grandes images défilent au doigt bord à bord (les
//     photos portées du coloris choisi, ses vues à plat sur la tuile grise,
//     puis les photos portées de l'autre coloris),
//     l'indicateur « 1/4 », et les vignettes dessous : en toucher une amène
//     son image. Sur ordinateur, les vignettes sont en colonne à gauche de
//     la galerie, et les informations à droite restent en vue ;
//   · le badge, le nom, le type, le prix ;
//   · les coloris en vignettes photo (la vue de devant de chacun) ;
//   · les tailles sur l'échelle complète S à 3XL : une taille que la pièce
//     n'a pas est barrée, grisée, inerte. « Guide des tailles » est écrit
//     mais n'ouvre rien : les mesures n'ont pas été lues, il est « Bientôt » ;
//   · « Ajouter au panier » reste « Bientôt » : aucun paiement n'est
//     branché, rien n'est payable. « Favori » garde la pièce sur l'appareil ;
//   · les accordéons : Description, Marquage, Matière et entretien,
//     Livraison et retours. Seul ce qui a été lu est écrit (la fabrication
//     en 1 à 3 jours) ; le reste est « Bientôt », à valider par Sabri ;
//   · « Tu aimeras aussi » : quatre pièces, la même ligne d'abord.
// Un identifiant inconnu : « Article introuvable » et le lien vers la boutique.

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Heart } from "lucide-react";
import { Accordeon } from "@/components/boutique/accordeon";
import { CarteProduit } from "@/components/boutique/carte-produit";
import { EnTeteBoutique } from "@/components/boutique/en-tete";
import { Rail } from "@/components/boutique/rail";
import { FOND_TUILE, Tuile } from "@/components/boutique/tuile";
import { basculerFavori, useFavorisBoutique } from "@/hooks/use-favoris-boutique";
import { TAILLES, aussi, prix, vuesFiche, type Vue } from "@/lib/boutique/catalogue";
import { produitDe, type Produit } from "@/lib/boutique/produits";
import { cn } from "@/lib/utils";

export default function FicheProduit() {
  const { id } = useParams<{ id: string }>();
  const produit = produitDe(id);
  return (
    <div className="shell flex flex-col gap-4 py-4 sm:py-8">
      <EnTeteBoutique />
      {produit ? (
        <Fiche key={produit.id} produit={produit} />
      ) : (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <p className="text-titre font-bold">Article introuvable</p>
          <Link href="/boutique" className="text-lecture font-semibold underline underline-offset-4">
            Boutique
          </Link>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- la galerie ------------------------------- */

function Galerie({ vues }: { vues: Vue[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const [courante, setCourante] = useState(0);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const vue = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) {
          if (e.isIntersecting) setCourante(Number((e.target as HTMLElement).dataset.vue));
        }
      },
      { root: el, threshold: 0.6 },
    );
    for (const d of el.children) vue.observe(d);
    return () => vue.disconnect();
  }, [vues]);

  const montrer = (i: number) => {
    const el = rail.current;
    const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollTo({ left: (el.children[i] as HTMLElement).offsetLeft, behavior: doux ? "smooth" : "auto" });
  };

  return (
    <div className="flex flex-col gap-3 sm:max-lg:mx-auto sm:max-lg:w-full sm:max-lg:max-w-[520px] lg:flex-row-reverse lg:items-start">
      <div className="relative -mx-5 min-w-0 flex-1 sm:mx-0">
        <Rail ref={rail} className="relative">
          {vues.map((v, i) => (
            <span
              key={v.src}
              data-vue={i}
              className={cn("relative block aspect-[4/5] w-full shrink-0 snap-center sm:rounded-[2px]", v.aPlat && FOND_TUILE)}
            >
              <Image
                src={v.src}
                alt=""
                fill
                priority={i === 0}
                sizes="(max-width: 1023px) 100vw, 560px"
                className={v.aPlat ? "object-contain mix-blend-multiply" : "object-cover sm:rounded-[2px]"}
              />
            </span>
          ))}
        </Rail>
        <span aria-hidden className="mono-label absolute right-4 bottom-4 rounded-full bg-[#ECECEA] px-2.5 py-1.5 text-[#121316]">
          {courante + 1}/{vues.length}
        </span>
      </div>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 py-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0.5 lg:flex-col lg:overflow-visible [&::-webkit-scrollbar]:hidden">
        {vues.map((v, i) => (
          <button
            key={v.src}
            type="button"
            onClick={() => montrer(i)}
            aria-label={`Image ${i + 1}`}
            aria-current={i === courante}
            className={cn(
              "relative size-14 shrink-0 overflow-hidden rounded-[2px]",
              FOND_TUILE,
              i === courante && "outline-2 outline-offset-1 outline-foreground",
            )}
          >
            <Image
              src={v.src}
              alt=""
              fill
              sizes="56px"
              className={v.aPlat ? "object-contain mix-blend-multiply" : "object-cover"}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- la fiche -------------------------------- */

function Ligne({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <p className="flex items-baseline justify-between gap-4 text-ligne">
      <span>{titre}</span>
      <span className="mono-label text-encre-3">{children}</span>
    </p>
  );
}

function Fiche({ produit }: { produit: Produit }) {
  const [coloris, setColoris] = useState(0);
  const [taille, setTaille] = useState<string | null>(null);
  const favori = useFavorisBoutique().includes(produit.id);
  // Le même tableau tant que le coloris ne change pas : la galerie n'a pas à se rebrancher.
  const vues = useMemo(() => vuesFiche(produit, coloris), [produit, coloris]);

  return (
    <>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
        <Galerie key={coloris} vues={vues} />

        <div className="flex flex-col gap-6 lg:sticky lg:top-8">
          <div className="flex flex-col">
            {produit.badge && <span className="mono-label text-encre-3">{produit.badge}</span>}
            <h1 className="mt-1.5 text-titre-g leading-[1.08] font-black tracking-tight">{produit.nom}</h1>
            <p className="mt-1 text-lecture text-encre-3">{produit.type}</p>
            <p className="mt-3 text-titre-fort font-bold tabular-nums">{prix(produit.euros)}</p>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-lecture font-bold">{produit.coloris[coloris].nom}</p>
            <div className="flex gap-2.5">
              {produit.coloris.map((c, i) => (
                <button
                  key={c.nom}
                  type="button"
                  onClick={() => setColoris(i)}
                  aria-label={c.nom}
                  aria-pressed={i === coloris}
                  className={cn("rounded-[2px]", i === coloris && "outline-2 outline-offset-2 outline-foreground")}
                >
                  <Tuile src={c.aPlat[0]} sizes="64px" className="size-16" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <p className="text-lecture font-bold">Taille</p>
              <p className="flex items-baseline gap-2 text-corps text-encre-3">
                Guide des tailles
                <span className="mono-label">Bientôt</span>
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TAILLES.map((t) => {
                const existe = produit.tailles.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={!existe}
                    aria-pressed={t === taille}
                    onClick={() => setTaille(t)}
                    className={cn(
                      "relative h-12 overflow-hidden rounded-[6px] border text-ligne font-semibold tabular-nums",
                      !existe
                        ? "border-contraste/8 bg-contraste/4 text-encre-4"
                        : t === taille
                          ? "border-foreground bg-foreground text-background"
                          : "border-contraste/20",
                    )}
                  >
                    {t}
                    {!existe && (
                      <span aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top_right,transparent_calc(50%-0.5px),currentColor_calc(50%-0.5px),currentColor_calc(50%+0.5px),transparent_calc(50%+0.5px))]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled
              className="bouton-principal flex w-full flex-col items-center py-3 text-lecture leading-tight font-bold opacity-60"
            >
              Ajouter au panier
              <span className="bouton-sous mono-label mt-1">Bientôt</span>
            </button>
            <button
              type="button"
              onClick={() => basculerFavori(produit.id)}
              aria-pressed={favori}
              className="bouton-secondaire flex w-full items-center justify-center gap-2 py-4 text-lecture font-bold"
            >
              {favori ? "Dans tes favoris" : "Favori"}
              <Heart className="size-[18px]" strokeWidth={2} fill={favori ? "currentColor" : "none"} />
            </button>
          </div>

          <div className="flex flex-col border-b border-contraste/8">
            <Accordeon titre="Description" ouvert>
              <p className="text-lecture leading-relaxed">{produit.description}</p>
            </Accordeon>
            <Accordeon titre="Marquage">
              <ul className="flex flex-col gap-1.5 text-ligne">
                {produit.marquage.map((m) => (
                  <li key={m}>{m}</li>
                ))}
                <li className="text-encre-3">Impression numérique, une encre</li>
              </ul>
            </Accordeon>
            <Accordeon titre="Matière et entretien">
              <div className="flex flex-col gap-2.5">
                <p className="text-ligne">{produit.matiere}</p>
                <Ligne titre="Entretien">Bientôt</Ligne>
              </div>
            </Accordeon>
            <Accordeon titre="Livraison et retours">
              <div className="flex flex-col gap-2.5">
                <p className="text-ligne">Fabriqué à la commande, 1 à 3 jours</p>
                <Ligne titre="Livraison">Bientôt</Ligne>
                <Ligne titre="Retours">Bientôt</Ligne>
              </div>
            </Accordeon>
          </div>
        </div>
      </div>

      <section className="mt-6 flex flex-col gap-4">
        <h2 className="titre-lettrage text-titre">Tu aimeras aussi</h2>
        <div className="-mx-5 lg:mx-0">
          <Rail className="gap-0.5 px-5 [scroll-padding-inline:20px] sm:gap-3 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
            {aussi(produit).map((p) => (
              <CarteProduit key={p.id} produit={p} sizes="(max-width: 1023px) 44vw, 280px" className="w-[44%] shrink-0 snap-start lg:w-auto" />
            ))}
          </Rail>
        </div>
      </section>
    </>
  );
}
