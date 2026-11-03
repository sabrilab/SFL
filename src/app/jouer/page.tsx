"use client";

// Jouer : le jeu de foot de Bola (Sabri, 02/11/2026 : « je veux du FIFA »,
// vertical, au pouce, les joueurs en 3D avec leur visage).
//
// « Cinq attaques » : toi, balle au pied, contre un défenseur et un gardien de
// marbre. Le moteur est dans lib/jeu (three.js, chargé seulement ici) ; cette
// page tient le plein écran, le tableau du haut, les écrans d'avant et
// d'après. Ta tête porte ta photo du studio ; personne d'autre n'y paraît.
//
// Gestes, dans le bas de l'écran : glisser = courir (loin = sprint) ; un coup
// sec puis lâcher = frapper ; toucher = dribbler. Pas de texte d'aide : un
// pouce fantôme montre le geste tant qu'on n'a pas touché l'écran.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { isAdmin } from "@/lib/sfl/admin";
import { photoPerso, rafraichirPhotos } from "@/lib/sfl/photos";
import { cn } from "@/lib/utils";

type Etat = {
  phase: "attente" | "intro" | "jeu" | "frappe" | "resultat" | "fin";
  attaque: number;
  buts: number;
  resultats: string[];
  message: string | null;
};
type Match = { demarrer: () => void; detruire: () => void };

const ATTAQUES = 5;
const rien = () => () => {};

export default function JouerPage() {
  const { me } = useMyPlayer();
  const monte = useSyncExternalStore(rien, () => true, () => false);
  const [etat, setEtat] = useState<Etat | null>(null);
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [touche, setTouche] = useState(false);
  const boite = useRef<HTMLDivElement>(null);
  const match = useRef<Match | null>(null);

  useEffect(() => {
    if (!monte || !boite.current) return;
    let fini = false;
    (async () => {
      try {
        await rafraichirPhotos().catch(() => {});
        const photo = me ? photoPerso(me) : null;
        const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const { creerMatch } = await import("@/lib/jeu/match.js");
        if (fini || !boite.current) return;
        const m = (await creerMatch(boite.current, { photo, reduit, surEtat: (e: Etat) => setEtat(e) })) as Match;
        if (fini) {
          m.detruire();
          return;
        }
        match.current = m;
        // banc de captures (?banc) : le match piloté depuis la console
        if (new URLSearchParams(window.location.search).has("banc")) (window as unknown as { __bolaJeu: Match }).__bolaJeu = m;
        setPret(true);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Le jeu n'a pas pu se charger.");
      }
    })();
    return () => {
      fini = true;
      match.current?.detruire();
      match.current = null;
    };
  }, [monte, me]);

  if (!monte) return null;
  const phase = etat?.phase ?? "attente";
  const enJeu = phase === "intro" || phase === "jeu" || phase === "frappe" || phase === "resultat";

  const page = (
    <div
      className="fixed inset-0 z-[60] select-none overflow-hidden bg-[#05070a] text-white"
      onPointerDown={() => setTouche(true)}
      style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
    >
      <div ref={boite} className="absolute inset-0" />

      {/* le tableau : buts et les cinq ballons */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
      >
        <div className={cn("pointer-events-auto transition-opacity", enJeu && "opacity-0")}>
          <BoutonRetour parent="/" titre="Map" />
        </div>
        {etat && phase !== "attente" && (
          <div className="flex flex-col items-end gap-1.5">
            <span className="font-[family-name:var(--font-anton)] text-[44px] leading-none tabular-nums">{etat.buts}</span>
            <div className="flex gap-1.5">
              {Array.from({ length: ATTAQUES }, (_, i) => {
                const r = etat.resultats[i];
                return (
                  <span
                    key={i}
                    className={cn(
                      "h-2 w-2 rounded-full",
                      r === "but" ? "bg-white" : r ? "bg-white/25" : i === etat.attaque ? "bg-white/70 ring-2 ring-white/30" : "border border-white/40",
                    )}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* le mot du résultat, au milieu */}
      {etat?.message && (
        <div className="pointer-events-none absolute inset-x-0 top-[64%] text-center">
          <span
            key={`${etat.attaque}-${etat.message}`}
            className="jeu-mot inline-block font-[family-name:var(--font-anton)] text-[84px] leading-none tracking-tight"
          >
            {etat.message}
          </span>
        </div>
      )}

      {/* le pouce fantôme : le geste, tant qu'on n'a pas touché */}
      {phase === "jeu" && !touche && (
        <div className="pointer-events-none absolute bottom-[14%] left-1/2 -translate-x-1/2">
          <div className="jeu-fantome h-10 w-10 rounded-full bg-white/80 shadow-[0_2px_14px_rgba(0,0,0,.4)]" />
        </div>
      )}

      {/* avant, et après */}
      {(phase === "attente" || phase === "fin") && (
        <div
          className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-6"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)" }}
        >
          {phase === "fin" && etat && (
            <div className="text-center">
              <div className="font-[family-name:var(--font-anton)] text-[96px] leading-none">
                {etat.buts}
                <span className="text-white/40"> / {ATTAQUES}</span>
              </div>
            </div>
          )}
          {erreur ? (
            <p className="text-center text-[15px] text-white/70">{erreur}</p>
          ) : (
            <button
              disabled={!pret}
              onClick={(e) => {
                e.stopPropagation();
                match.current?.demarrer();
              }}
              className="h-14 w-full max-w-[320px] rounded-full bg-white text-[17px] font-bold text-black transition-opacity disabled:opacity-40"
            >
              {!pret ? "Chargement" : phase === "fin" ? "Rejouer" : "Jouer"}
            </button>
          )}
          {isAdmin(me) && phase === "attente" && (
            <Link href="/jouer/studio" className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/50">
              Studio
            </Link>
          )}
        </div>
      )}

      <style>{`
        .jeu-mot { animation: jeu-mot .5s cubic-bezier(.2,.9,.3,1.2) both; text-shadow: 0 6px 30px rgba(0,0,0,.45); }
        @keyframes jeu-mot { from { transform: scale(.6); opacity: 0 } to { transform: none; opacity: 1 } }
        .jeu-fantome { animation: jeu-fantome 2.2s ease-in-out infinite; }
        @keyframes jeu-fantome {
          0% { transform: translate(0, 0); opacity: 0 }
          12% { opacity: .9 }
          55% { transform: translate(0, -42px); opacity: .9 }
          62% { transform: translate(0, -110px); opacity: 0 }
          100% { opacity: 0 }
        }
        @media (prefers-reduced-motion: reduce) { .jeu-mot, .jeu-fantome { animation: none } }
      `}</style>
    </div>
  );
  return createPortal(page, document.body);
}
