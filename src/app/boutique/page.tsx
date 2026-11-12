"use client";

// L'accueil de la boutique Bola (Sabri, 12/11/2026 : « refais la boutique
// comme ces exemples-là », deux grandes boutiques de foot en référence de
// mise en page ; tout le reste est à Bola : nos photos, nos mots, noir et
// blanc). Le catalogue est celui du 30/10 (lib/boutique/produits.ts), le
// rangement est dans lib/boutique/catalogue.ts.
//
// De haut en bas :
//   · l'en-tête : retour, « Boutique », les favoris, les Ballons ;
//   · le hero : trois photos portées plein cadre qu'on fait défiler au doigt
//     (rien ne défile seul), sans dégradé ni texte posé dessus ; dessous, un
//     titre court, un seul bouton « Voir » et l'indicateur « 1/3 », qui
//     voyage avec sa diapo ;
//   · les rayons en liens texte, qui défilent au doigt ;
//   · trois grands panneaux : Match, Vestiaire, Fondateurs ;
//   · « Acheter par camp » : Noirs, Blancs ;
//   · trois blocs : pour le match, le vestiaire, l'entraînement ;
//   · la réassurance : livraison, retours, paiement en plusieurs fois, tous
//     « Bientôt » tant que rien n'est branché.
// Chaque lien ouvre la grille (/boutique/articles) sur un rayon, ou une
// fiche. Aucun sous-titre, aucune promo, rien de payable.
//
// Sur ordinateur (≥ 1024), les trois diapos du hero tiennent côte à côte,
// comme les panneaux et les blocs.

import Image from "next/image";
import Link from "next/link";
import { EnTeteBoutique } from "@/components/boutique/en-tete";
import { Rail } from "@/components/boutique/rail";
import { Tuile } from "@/components/boutique/tuile";
import { adresseFiche, adresseGrille, type Rayon } from "@/lib/boutique/catalogue";

const HERO = [
  { photo: "/boutique/porte-survet.webp", titre: "Collection 01", vers: adresseGrille() },
  { photo: "/boutique/porte-maillot-noir.webp", titre: "Noirs contre Blancs", vers: adresseGrille({ rayon: "maillots" }) },
  { photo: "/boutique/porte-dos-de-carte.webp", titre: "Ta carte dans le dos", vers: adresseFiche("t-shirt-dos-de-carte") },
];

const RAYONS_ACCUEIL: [titre: string, rayon: Rayon][] = [
  ["Maillots", "maillots"],
  ["Vestiaire", "vestiaire"],
  ["Survêts", "survets"],
  ["Fondateurs", "fondateurs"],
  ["Tout", "tout"],
];

const PANNEAUX: { photo: string; titre: string; rayon: Rayon }[] = [
  { photo: "/boutique/porte-maillot-blanc-dos.webp", titre: "Match", rayon: "maillots" },
  { photo: "/boutique/porte-raglan-blanc.webp", titre: "Vestiaire", rayon: "vestiaire" },
  { photo: "/boutique/porte-sweat-noir.webp", titre: "Fondateurs", rayon: "fondateurs" },
];

const CAMPS = [
  { titre: "Noirs", vue: "/boutique/a-plat-rt0082-black-front.webp", couleur: "Noir" },
  { titre: "Blancs", vue: "/boutique/a-plat-rt0082-white-front.webp", couleur: "Blanc" },
] as const;

const BLOCS: { photo: string; titre: string; rayon: Rayon }[] = [
  { photo: "/boutique/porte-dimanche-noir.webp", titre: "Pour le match", rayon: "maillots" },
  { photo: "/boutique/porte-polo-blanc.webp", titre: "Pour le vestiaire", rayon: "vestiaire" },
  { photo: "/boutique/porte-survet-dos.webp", titre: "Pour l'entraînement", rayon: "survets" },
];

const REASSURANCE = ["Livraison", "Retours", "Paiement en plusieurs fois"];

/* ---------------------------------- le hero -------------------------------- */

function Hero() {
  return (
    <section aria-label="À la une" className="-mx-5 lg:mx-0">
      <Rail className="lg:grid lg:grid-cols-3 lg:gap-3 lg:overflow-visible">
        {HERO.map((d, i) => (
          <Link key={d.titre} href={d.vers} className="flex w-full shrink-0 snap-center flex-col">
            <span className="relative block aspect-[4/5]">
              <Image
                src={d.photo}
                alt=""
                fill
                priority={i === 0}
                sizes="(max-width: 1023px) 100vw, 33vw"
                className="object-cover"
              />
            </span>
            <span className="flex flex-col gap-4 px-5 pt-5 lg:px-0">
              <span className="titre-lettrage text-nom leading-[0.95] text-balance lg:text-titre-g">{d.titre}</span>
              <span className="flex items-center justify-between">
                <span className="bouton-principal px-7 py-3 text-lecture font-bold">Voir</span>
                {/* L'indicateur voyage avec sa diapo : il dit toujours vrai, sans rien écouter. */}
                <span aria-hidden className="mono-label text-encre-3 lg:hidden">
                  {i + 1}/{HERO.length}
                </span>
              </span>
            </span>
          </Link>
        ))}
      </Rail>
    </section>
  );
}

/* --------------------------------- l'écran --------------------------------- */

export default function Boutique() {
  return (
    <div className="shell flex flex-col gap-10 py-4 sm:py-8">
      <div className="flex flex-col gap-4">
        <EnTeteBoutique titre="Boutique" />
        <Hero />
      </div>

      <nav aria-label="Rayons" className="-mx-5 -my-3 lg:mx-0">
        <Rail className="snap-none gap-7 px-5 lg:px-0">
          {RAYONS_ACCUEIL.map(([titre, rayon]) => (
            <Link key={rayon} href={adresseGrille({ rayon })} className="flex min-h-11 shrink-0 items-center text-lecture font-semibold">
              {titre}
            </Link>
          ))}
        </Rail>
      </nav>

      <section aria-label="Collections" className="-mx-5 lg:mx-0">
        <Rail className="gap-2 px-5 [scroll-padding-inline:20px] lg:grid lg:grid-cols-3 lg:gap-3 lg:overflow-visible lg:px-0">
          {PANNEAUX.map((p) => (
            <Link key={p.titre} href={adresseGrille({ rayon: p.rayon })} className="flex w-[82%] shrink-0 snap-start flex-col lg:w-auto">
              <span className="relative block aspect-[4/5] overflow-hidden rounded-[2px]">
                <Image src={p.photo} alt="" fill sizes="(max-width: 1023px) 82vw, 33vw" className="object-cover" />
              </span>
              <span className="flex items-center justify-between gap-3 pt-4">
                <span className="titre-lettrage text-titre-m leading-none">{p.titre}</span>
                <span className="bouton-secondaire px-5 py-2.5 text-ligne font-semibold">Voir</span>
              </span>
            </Link>
          ))}
        </Rail>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="titre-lettrage text-titre">Acheter par camp</h2>
        <div className="-mx-5 grid grid-cols-2 gap-0.5 sm:mx-0 sm:gap-3 lg:max-w-2xl">
          {CAMPS.map((c) => (
            <Link key={c.titre} href={adresseGrille({ filtres: { couleurs: [c.couleur] } })} className="flex flex-col">
              <Tuile src={c.vue} sizes="(max-width: 1023px) 50vw, 500px" />
              <span className="px-5 pt-3 text-lecture font-bold sm:px-1">{c.titre}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="Par usage" className="grid gap-9 lg:grid-cols-3 lg:gap-3">
        {BLOCS.map((b) => (
          <Link key={b.titre} href={adresseGrille({ rayon: b.rayon })} className="-mx-5 flex flex-col sm:mx-0">
            <span className="relative block aspect-[4/5] overflow-hidden sm:rounded-[2px]">
              <Image src={b.photo} alt="" fill sizes="(max-width: 1023px) 100vw, 33vw" className="object-cover" />
            </span>
            <span className="flex flex-col items-start gap-2 px-5 pt-4 sm:px-0">
              <span className="text-titre-fort leading-tight font-black tracking-tight">{b.titre}</span>
              <span className="text-lecture font-semibold underline underline-offset-4">Voir</span>
            </span>
          </Link>
        ))}
      </section>

      <ul className="grid grid-cols-3 border-y border-contraste/8">
        {REASSURANCE.map((r, i) => (
          <li
            key={r}
            className={`flex flex-col items-center justify-center gap-1.5 px-2 py-5 text-center ${i > 0 ? "border-l border-contraste/8" : ""}`}
          >
            <span className="text-corps leading-tight font-semibold">{r}</span>
            <span className="mono-label text-encre-3">Bientôt</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
