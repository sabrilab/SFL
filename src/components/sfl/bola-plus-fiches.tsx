"use client";

// La fiche d'une carte de Bola Plus (lib/sfl/bola-plus-fiches.ts) : plein
// écran, au-dessus de la barre d'onglets, déroulée comme une keynote. Chaque
// chapitre entre quand il arrive à l'écran (en mouvement réduit, il est déjà
// là). Le retour du téléphone (le glissé depuis le bord) la ferme, comme la
// croix : la fiche pose une entrée dans l'historique.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Plus, User, X } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { FICHES, fichierFiche, sourcesFiche, type Chapitre, type Etape, type Fiche, type ImageFiche } from "@/lib/sfl/bola-plus-fiches";
import { tic } from "@/lib/sfl/haptique";
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

/** Une image de la fiche, à sa taille, chargée quand elle approche. */
function Image1({ i, seule }: { i: ImageFiche; seule: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- déjà à ses deux largeurs (public/bola-plus-fiches)
    <img
      src={fichierFiche(i.image, 600)}
      srcSet={sourcesFiche(i)}
      sizes={seule ? "(max-width: 430px) 100vw, 430px" : "(max-width: 430px) 50vw, 215px"}
      width={i.largeur}
      height={i.hauteur}
      alt={i.alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className="bpf-image"
    />
  );
}

function ChapitreFiche({ c }: { c: Chapitre }) {
  return (
    <section className="bpf-chapitre" data-entre="">
      <div className={c.images.length > 1 ? "bpf-images bpf-images--deux" : "bpf-images"}>
        {c.images.map((i) => (
          <Image1 key={i.image + i.alt} i={i} seule={c.images.length === 1} />
        ))}
      </div>
      <h3 className="bpf-titre">{c.titre}</h3>
      {c.texte && <p className="bpf-texte">{c.texte}</p>}
      {c.liste && (
        <ul className="bpf-liste">
          {c.liste.map((l) => (
            <li key={l.gauche}>
              <span className="bpf-liste__rang">{l.gauche}</span>
              <span className="bpf-liste__valeur tabular-nums" style={{ fontFamily: ANTON }}>
                {l.droite}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Les cinq ronds de « Ramène 5 », dont `pleins` sont remplis. */
function Ronds({ pleins }: { pleins: number }) {
  return (
    <div className="bpf-ronds" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="bpf-rond" data-plein={i < pleins ? "" : undefined} style={{ ["--i" as string]: i } as CSSProperties}>
          <User className="size-[16px]" strokeWidth={2.4} />
        </span>
      ))}
    </div>
  );
}

function EtapeFiche({ e, n }: { e: Etape; n: number }) {
  return (
    <section className="bpf-etape" data-entre="">
      <span className="bpf-etape__numero tabular-nums" style={{ fontFamily: ANTON }}>
        {String(n).padStart(2, "0")}
      </span>
      <div className="bpf-etape__corps">
        <h3 className="bpf-titre">{e.titre}</h3>
        <p className="bpf-texte">{e.texte}</p>
        <Ronds pleins={e.pleins} />
      </div>
    </section>
  );
}

function Contenu({ fiche }: { fiche: Fiche }) {
  if ("etapes" in fiche) return fiche.etapes.map((e, i) => <EtapeFiche key={e.titre} e={e} n={i + 1} />);
  return fiche.chapitres.map((c) => <ChapitreFiche key={c.titre} c={c} />);
}

/** La fiche ouverte, dans <body>. `part` : « plus » (violet) ou « sfl » (vert), comme la carte. */
export function FicheBolaPlus({ id, part, couleurs, onFermer }: { id: string; part: string; couleurs: CSSProperties; onFermer: () => void }) {
  const fiche = FICHES[id];
  const ref = useRef<HTMLDivElement>(null);
  const fermer = useRef(onFermer);
  useEffect(() => {
    fermer.current = onFermer;
  }, [onFermer]);

  // Le retour du téléphone ferme la fiche ; la croix revient en arrière d'un pas.
  useEffect(() => {
    window.history.pushState({ ficheBolaPlus: id }, "");
    const retour = () => fermer.current();
    window.addEventListener("popstate", retour);
    return () => window.removeEventListener("popstate", retour);
  }, [id]);

  // Les chapitres entrent à l'écran ; le fond ne défile plus.
  useEffect(() => {
    const boite = ref.current;
    if (!boite) return;
    const avant = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    boite.focus({ preventScroll: true });
    const o = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) (e.target as HTMLElement).dataset.vu = "";
      },
      { root: boite, threshold: 0.18 }
    );
    boite.querySelectorAll("[data-entre]").forEach((el) => o.observe(el));
    return () => {
      o.disconnect();
      document.documentElement.style.overflow = avant;
    };
  }, [id]);

  if (!fiche) return null;
  return createPortal(
    <div
      ref={ref}
      className="bpf dark"
      data-part={part}
      style={couleurs}
      role="dialog"
      aria-modal="true"
      aria-label={fiche.titre}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") window.history.back();
      }}
    >
      <div className="bpf-tete">
        <button
          type="button"
          className="bpf-fermer"
          aria-label="Fermer"
          onClick={() => {
            tic();
            window.history.back();
          }}
        >
          <X className="size-5" strokeWidth={2.4} aria-hidden />
        </button>
      </div>
      <h2 className="bpf-grand-titre">{fiche.titre}</h2>
      <Contenu fiche={fiche} />
      <div className="bpf-fin" />
    </div>,
    document.body
  );
}

/** L'état de la fiche ouverte (une à la fois). */
export function useFiche() {
  const [ouverte, setOuverte] = useState<string | null>(null);
  return { ouverte, ouvrir: (id: string) => (aUneFiche(id) ? (tic(), setOuverte(id)) : undefined), fermer: () => setOuverte(null) };
}
