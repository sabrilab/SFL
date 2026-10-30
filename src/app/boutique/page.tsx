"use client";

// La boutique Bola (Sabri, 30/10 : « tu fais une boutique, comme ça on va
// mieux voir ce que ça donne »). Huit pièces Tapstitch marquées aux fichiers
// officiels, en noir et blanc (lib/boutique/produits.ts).
//
// En tête, la photo portée du survêt Olympe ; dessous, les trois lignes
// (Match, Vestiaire, Fondateurs) en filtre, puis la grille : photo portée,
// nom, prix, pastilles des coloris. Une pièce touchée s'ouvre en fiche :
// les photos portées puis les deux faces à plat du coloris choisi, en
// défilé horizontal ; coloris, tailles, et ce qui est imprimé où.
//
// Rien n'est payable : le bouton de la fiche reste « Bientôt » tant que la
// commande Tapstitch et le paiement ne sont pas branchés. Pas de texte
// d'aide : la fiche se lit comme celle d'une boutique.

import { useMemo, useState } from "react";
import Image from "next/image";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { LIGNES, PRODUITS, type Ligne, type Produit } from "@/lib/boutique/produits";

const UNE = PRODUITS.find((p) => p.id === "survet-olympe")!;

function Pastilles({ produit, actif }: { produit: Produit; actif?: number }) {
  return (
    <span className="flex gap-1.5">
      {produit.coloris.map((c, i) => (
        <span
          key={c.nom}
          className={cn(
            "size-3 rounded-full border border-contraste/25",
            actif === i && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
          )}
          style={{ background: c.teinte }}
        />
      ))}
    </span>
  );
}

/* --------------------------------- la fiche -------------------------------- */

function Fiche({ produit }: { produit: Produit }) {
  const [coloris, setColoris] = useState(0);
  const [taille, setTaille] = useState<string | null>(null);
  // Les photos portées montrent le premier coloris : un autre choisi passe ses vues à plat devant.
  const aPlat = produit.coloris[coloris].aPlat;
  const vues = coloris === 0 ? [...produit.porte, ...aPlat] : [...aPlat, ...produit.porte];

  return (
    <div className="flex flex-col gap-5 pt-[4.5rem] pb-2">
      <div key={coloris} className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {vues.map((src) => (
          <div
            key={src}
            className={cn(
              "relative aspect-[4/5] w-[82%] shrink-0 snap-center overflow-hidden rounded-[22px] sm:w-[70%]",
              src.includes("a-plat") && "bg-white",
            )}
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="(max-width: 640px) 82vw, 320px"
              className={src.includes("a-plat") ? "object-contain" : "object-cover"}
            />
          </div>
        ))}
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="mono-label text-foreground/40">{produit.ligne}</span>
          <SheetTitle className="mt-1 text-[24px] leading-tight font-black tracking-tight">
            {produit.nom}
          </SheetTitle>
        </div>
        <span className="shrink-0 text-[22px] font-extrabold tracking-tight tabular-nums">
          {produit.euros} €
        </span>
      </div>

      {produit.coloris.length > 1 && (
        <div className="flex gap-2">
          {produit.coloris.map((c, i) => (
            <button
              key={c.nom}
              onClick={() => setColoris(i)}
              className={cn(
                "flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold",
                i === coloris ? "bg-foreground text-background" : "glass-soft text-foreground/72",
              )}
            >
              <span
                className="size-3 rounded-full border border-contraste/25"
                style={{ background: c.teinte }}
              />
              {c.nom}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {produit.tailles.map((t) => (
          <button
            key={t}
            onClick={() => setTaille(t)}
            className={cn(
              "min-w-12 rounded-full px-3 py-2.5 text-[13px] font-bold tabular-nums",
              t === taille ? "bg-foreground text-background" : "glass-soft text-foreground/72",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <button
        disabled
        className="rounded-full bg-foreground py-[15px] text-center text-[15px] font-bold text-background opacity-40"
      >
        Bientôt
      </button>

      <dl className="flex flex-col gap-3 border-t border-contraste/8 pt-4 text-[13.5px]">
        <div>
          <dt className="mono-label text-foreground/40">Marquage</dt>
          {produit.marquage.map((m) => (
            <dd key={m} className="mt-1 font-medium">
              {m}
            </dd>
          ))}
        </div>
        <div>
          <dt className="mono-label text-foreground/40">Matière</dt>
          <dd className="mt-1 font-medium">{produit.matiere}</dd>
        </div>
        <div className="flex gap-8">
          <div>
            <dt className="mono-label text-foreground/40">Fabrication</dt>
            <dd className="mt-1 font-medium">1 à 3 jours</dd>
          </div>
          <div>
            <dt className="mono-label text-foreground/40">Réf.</dt>
            <dd className="mt-1 font-medium tabular-nums">{produit.tapstitch}</dd>
          </div>
        </div>
      </dl>
    </div>
  );
}

/* --------------------------------- l'écran -------------------------------- */

export default function Boutique() {
  const [ligne, setLigne] = useState<Ligne | null>(null);
  const [ouvert, setOuvert] = useState<Produit | null>(null);
  const [visible, setVisible] = useState(false);
  const liste = useMemo(
    () => (ligne ? PRODUITS.filter((p) => p.ligne === ligne) : PRODUITS),
    [ligne],
  );
  const ouvrir = (p: Produit) => {
    setOuvert(p);
    setVisible(true);
  };

  return (
    <div className="shell flex flex-col gap-4 py-4 sm:py-8">
      <div className="flex items-center gap-3">
        <BoutonRetour />
        <h1 className="text-[30px] font-black tracking-tight">Boutique</h1>
      </div>

      <button
        onClick={() => ouvrir(UNE)}
        className="relative aspect-[4/5] w-full overflow-hidden rounded-[28px] text-left sm:aspect-[16/9]"
      >
        <Image
          src={UNE.porte[0]}
          alt=""
          fill
          priority
          sizes="(max-width: 640px) 100vw, 900px"
          className="object-cover object-[50%_30%]"
        />
        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
        <span className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3 text-white">
          <span>
            <span className="mono-label text-white/60">Collection 01</span>
            <span className="mt-1 block text-[26px] leading-none font-black tracking-tight">
              {UNE.nom}
            </span>
          </span>
          <span className="text-[20px] font-extrabold tabular-nums">{UNE.euros} €</span>
        </span>
      </button>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[null, ...LIGNES].map((l) => (
          <button
            key={l ?? "tout"}
            onClick={() => setLigne(l)}
            className={cn(
              "shrink-0 rounded-full px-[15px] py-2.5 text-[13px]",
              l === ligne
                ? "bg-foreground font-bold text-background"
                : "glass-soft font-semibold text-foreground/72",
            )}
          >
            {l ?? "Tout"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 items-start gap-x-[11px] gap-y-5 lg:grid-cols-4">
        {liste.map((p) => (
          <button key={p.id} onClick={() => ouvrir(p)} className="flex flex-col text-left">
            <span className="relative block aspect-[4/5] overflow-hidden rounded-[22px]">
              <Image
                src={p.porte[0]}
                alt=""
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover"
              />
            </span>
            <span className="mt-2.5 block px-1 text-[14px] leading-[1.3] font-bold tracking-tight">
              {p.nom}
            </span>
            <span className="mt-1.5 flex items-center justify-between px-1">
              <span className="text-[15px] font-extrabold tabular-nums">{p.euros} €</span>
              <Pastilles produit={p} />
            </span>
          </button>
        ))}
      </div>

      <Sheet open={visible} onOpenChange={setVisible} titre="la boutique">
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[calc(100dvh-24px)] w-full gap-0 overflow-y-auto rounded-t-[28px] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] sm:max-w-lg"
        >
          {ouvert && <Fiche key={ouvert.id} produit={ouvert} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
