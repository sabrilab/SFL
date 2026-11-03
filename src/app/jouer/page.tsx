"use client";

// Jouer : le jeu de foot de Bola (Sabri, 02/11/2026 : « je veux du FIFA »,
// vertical, au pouce, les joueurs en 3D avec leur visage).
//
// 03/11 : « le plateau Bola avec un gameplay de 5 contre 5, à fond ». Les Noirs
// contre les Blancs sur le plateau BOLA, un match minuté. Le moteur est dans
// lib/jeu (three.js, chargé seulement ici) ; cette page tient le plein écran,
// le tableau du haut (score, chrono), les écrans d'avant et d'après. Ta tête
// porte ta photo du studio ; les autres sont des statues.
//
// Gestes, dans le bas de l'écran : glisser = courir (loin = sprint) ; toucher =
// passe (ou tacle en défense) ; coup sec vers le haut = frappe ; coup sec de
// côté = roulette. Pas de texte d'aide : un pouce fantôme montre le geste tant
// qu'on n'a pas touché l'écran.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { isAdmin } from "@/lib/sfl/admin";
import { photoPerso, rafraichirPhotos } from "@/lib/sfl/photos";
import { cn } from "@/lib/utils";

type Etat = {
  phase: "attente" | "intro" | "engagement" | "jeu" | "but" | "fin";
  noirs: number;
  blancs: number;
  reste: number;
  message: string | null;
  buteur: "moi" | "noirs" | "blancs" | null;
};
type Match = { demarrer: () => void; detruire: () => void };

const chrono = (s: number) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
const rien = () => () => {};

export default function JouerPage() {
  const { me } = useMyPlayer();
  const monte = useSyncExternalStore(rien, () => true, () => false);
  const [etat, setEtat] = useState<Etat | null>(null);
  const [pret, setPret] = useState(false);
  const [progres, setProgres] = useState(0);
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
        const m = (await creerMatch(boite.current, { photo, reduit, surEtat: (e: Etat) => setEtat(e), surProgres: (p: number) => setProgres(p) })) as Match;
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
  const enJeu = phase === "intro" || phase === "engagement" || phase === "jeu" || phase === "but";

  const page = (
    <div
      className="fixed inset-0 z-[60] select-none overflow-hidden bg-[#05070a] text-white"
      onPointerDown={() => setTouche(true)}
      style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
    >
      <div ref={boite} className="absolute inset-0" />

      {/* le tableau : Noirs, Blancs, le temps qui reste */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
      >
        <div className={cn("pointer-events-auto transition-opacity", enJeu && "opacity-0")}>
          <BoutonRetour parent="/" titre="Map" />
        </div>
        {etat && enJeu && (
          <div className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+10px)] flex -translate-x-1/2 items-center overflow-hidden rounded-full bg-black/55 font-[family-name:var(--font-anton)] leading-none backdrop-blur">
            <span className="flex items-center gap-2 py-1.5 pl-3.5 pr-3 text-[22px] tabular-nums">
              <span className="h-2.5 w-2.5 rounded-full border border-white/70 bg-black" />
              {etat.noirs}
              <span className="text-white/40">–</span>
              {etat.blancs}
              <span className="h-2.5 w-2.5 rounded-full bg-white" />
            </span>
            <span className="border-l border-white/15 py-1.5 pl-3 pr-3.5 text-[18px] tabular-nums text-white/80">{chrono(etat.reste)}</span>
          </div>
        )}
      </div>

      {/* le mot du résultat, au milieu */}
      {etat?.message && (
        <div className="pointer-events-none absolute inset-x-0 top-[64%] text-center">
          <span
            key={`${etat.noirs}-${etat.blancs}`}
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
            <div className="flex items-center gap-5 font-[family-name:var(--font-anton)] text-[88px] leading-none tabular-nums">
              <span className={cn(etat.noirs < etat.blancs && "text-white/40")}>{etat.noirs}</span>
              <span className="text-[40px] text-white/40">–</span>
              <span className={cn(etat.blancs < etat.noirs && "text-white/40")}>{etat.blancs}</span>
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
              {!pret ? `${Math.round(progres * 100)} %` : phase === "fin" ? "Rejouer" : "Jouer"}
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
