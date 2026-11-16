"use client";

// La fiche d'une carte de Bola Plus (lib/sfl/bola-plus-fiches.ts). Depuis le
// 16/11 20:54 (Sabri, sa capture de Bola Studio : « c'est comme ça que je
// voulais le design des carrousels sous-jacents »), elle a la forme du
// panneau Bola Studio (studio-bola.tsx) : une feuille du bas aux couleurs de
// sa part (violet Bola Plus, vert SFL), le titre, une phrase, puis le rail
// des vignettes en 4:5, au doigt, accroché carte par carte. Sur le tiers bas
// d'une vignette, son nom et un détail ; dessous, une ligne et une mention.
// Toucher une vignette la pousse en grand dans la même feuille (le retour en
// haut à gauche, components/ui/sheet.tsx). Les étapes de « Ramène 5 » n'ont
// pas d'image : leur numéro et les cinq ronds, sur la teinte de la part.

import { useState, type CSSProperties } from "react";
import { Plus, User } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { FICHES, fichierFiche, sourcesFiche, type CarteFiche } from "@/lib/sfl/bola-plus-fiches";
import { tic } from "@/lib/sfl/haptique";
import "./studio-bola.css";
import "./bola-plus-fiches.css";

/** Cette carte a-t-elle une fiche ? */
export const aUneFiche = (id: string) => id in FICHES;

/** Le petit « + » posé sur une carte qui a une fiche. */
export function PastilleFiche({ onOuvrir, nom }: { onOuvrir: () => void; nom: string }) {
  return (
    <button
      type="button"
      className="bpf-pastille"
      aria-label={`Le détail : ${nom}`}
      onClick={(e) => {
        e.stopPropagation();
        onOuvrir();
      }}
    >
      <Plus className="size-[18px]" strokeWidth={2.6} aria-hidden />
    </button>
  );
}

/** La feuille : comme celle de Bola Studio, elle défile si l'écran est court. */
const FEUILLE = "st-feuille bpf-feuille max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]";

/** Les cinq ronds de « Ramène 5 », dont `pleins` sont remplis. */
function Ronds({ pleins }: { pleins: number }) {
  return (
    <span className="bpf-ronds" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="bpf-rond" data-plein={i < pleins ? "" : undefined}>
          <User className="size-[42%]" strokeWidth={2.4} />
        </span>
      ))}
    </span>
  );
}

/** Le visuel d'une vignette : l'image (entière sur le noir si elle est large), ou une étape et ses ronds. */
function Visuel({ c, grand }: { c: CarteFiche; grand?: boolean }) {
  if (!c.image) return <span className="bpf-etape">{c.pleins !== undefined && <Ronds pleins={c.pleins} />}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- déjà à ses deux largeurs (public/bola-plus-fiches)
    <img
      className={`st-vignette__image${c.entiere ? " bpf-entiere" : ""}`}
      src={fichierFiche(c.image, 600)}
      srcSet={sourcesFiche(c)}
      sizes={grand ? "min(406px, calc(100vw - 24px))" : "min(216px, 58vw)"}
      width={c.largeur}
      height={c.hauteur}
      alt={grand ? c.alt : ""}
      loading={grand ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
    />
  );
}

/** Le tiers bas d'une vignette : le nom, et le détail en Anton. Dans la vue en grand, le nom est le titre de la feuille. */
function Legende({ c, titre }: { c: CarteFiche; titre?: boolean }) {
  const Nom = titre ? SheetTitle : "span";
  return (
    <span className="st-vignette__bas">
      <Nom className="bp-titre st-vignette__nom">{c.nom}</Nom>
      {c.detail && (
        <span className="st-vignette__prix tabular-nums" style={{ fontFamily: ANTON }}>
          {c.detail}
        </span>
      )}
    </span>
  );
}

/** Sous la vignette : la ligne et la mention. */
function Dessous({ c, grand }: { c: CarteFiche; grand?: boolean }) {
  return (
    <span className={`flex flex-col px-1 ${grand ? "gap-3" : "gap-1.5 pt-2.5"}`}>
      <span className={grand ? "text-corps leading-snug text-encre-2" : "line-clamp-2 min-h-[2.5em] text-[13px] leading-[1.25] text-encre-2"}>{c.texte}</span>
      {c.mention && <span className={`leading-none font-semibold text-encre-2 ${grand ? "text-corps" : "text-[13px]"}`}>{c.mention}</span>}
    </span>
  );
}

/** Une vignette en grand, poussée dans la feuille. */
function EnGrand({ c, couleurs, part, onFermer }: { c: CarteFiche | null; couleurs: CSSProperties; part: string; onFermer: () => void }) {
  return (
    <Sheet open={!!c} onOpenChange={(o) => !o && onFermer()}>
      <SheetContent side="bottom" className={`${FEUILLE} bpf-part-${part}`} style={couleurs}>
        {c && (
          <div className="mx-auto w-full max-w-[430px] px-3 pt-3 pb-8">
            <div className="st-fiche">
              <div className="st-vignette st-vignette--grand">
                <Visuel c={c} grand />
                <Legende c={c} titre />
              </div>
              <Dessous c={c} grand />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** La fiche ouverte. `part` : « plus » (violet) ou « sfl » (vert), comme la carte. */
export function FicheBolaPlus({ id, part, couleurs, onFermer }: { id: string; part: string; couleurs: CSSProperties; onFermer: () => void }) {
  const fiche = FICHES[id];
  const [grand, setGrand] = useState<CarteFiche | null>(null);
  if (!fiche) return null;
  return (
    <Sheet open onOpenChange={(o) => !o && onFermer()}>
      <SheetContent side="bottom" className={`${FEUILLE} bpf-part-${part}`} style={couleurs}>
        <div className="st-panneau mx-auto w-full max-w-[430px]">
          <div className="flex flex-col gap-2 px-5">
            <SheetTitle className="bp-titre st-panneau__titre">{fiche.titre}</SheetTitle>
            <p className="st-panneau__phrase tabular-nums">{fiche.phrase}</p>
          </div>
          <ul className="st-rail">
            {fiche.cartes.map((c) => (
              <li key={c.nom} className="st-item">
                <button
                  type="button"
                  className="st-item__bouton"
                  onClick={() => {
                    tic();
                    setGrand(c);
                  }}
                >
                  <span className="st-vignette">
                    <Visuel c={c} />
                    <Legende c={c} />
                  </span>
                  <Dessous c={c} />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <EnGrand c={grand} couleurs={couleurs} part={part} onFermer={() => setGrand(null)} />
      </SheetContent>
    </Sheet>
  );
}

/** L'état de la fiche ouverte (une à la fois). */
export function useFiche() {
  const [ouverte, setOuverte] = useState<string | null>(null);
  return { ouverte, ouvrir: (id: string) => (aUneFiche(id) ? (tic(), setOuverte(id)) : undefined), fermer: () => setOuverte(null) };
}
